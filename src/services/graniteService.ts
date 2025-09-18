
import { scoreFlowLevel1, type FlowSignalsInput } from '../app/utils/flowRank';
import { getIamToken, generateOnce, type GenParams } from './graniteHelper';

export type GenerateRequest = {
  prompt: string;
  system: string;        // ← REQUIRED: pass buildSystemPrompt(profile) from the caller
  context?: string[];

  /** Number of candidates to request (ignored if perCallInstructions is provided) */
  k?: number;
  params?: GenParams;

  /** One instruction string per generation call. If provided, its length decides N calls. */
  perCallInstructions?: string[];

  /** Optional: shortlist controls (coverage-based) */
  minReturn?: number;        // default 3
  maxReturn?: number;        // default 6
  coverageTarget?: number;   // override adaptive coverage (0..1)
  /** Soft target for final count when coverage is satisfied; clamped to [minReturn,maxReturn]. Default 5. */
  preferCount?: number;

  /** @deprecated kept for compat; selection now uses coverage, not a hard prob threshold */
  probThreshold?: number;

  /** Optional: control randomness */
  samplingSeed?: number;     // if set, seeds become deterministic per request
};

export type Candidate = {
  text: string;
  tokens: number;
  avgLogProb: number;
  /** kept for backward compat; equals flow.prob */
  relativeProb: number;
  seed: number;
  variant: 'primary' | 'alt';
  flow: {
    simToLastUser: number;
    lengthPenalty: number;
    repetitionPenalty: number;
    totalPenalty: number;
    utility: number;
    prob: number;
    weights: { a: number; b: number; g: number; tau: number };
  };
};

export type GenerateResponse = {
  candidates: Candidate[];
  meta: {
    model_id: string;
    usedK: number;
    dropped: number; // includes failed generations + filtered-out items
    params: Required<GenParams>;
  };
};

// ---- Env ----
const API_KEY    = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID   = process.env.IBM_MODEL_ID || 'ibm/granite-3-8b-instruct';
const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || '').replace(/\/+$/, '');

// ---- Tiny IAM token cache ----
let cachedToken: { token: string; expiresAt: number } | null = null;
async function getTokenCached(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const token = await getIamToken(API_KEY);
  cachedToken = { token, expiresAt: now + 55 * 60 * 1000 };
  return token;
}

// ---- Helpers ----
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

// Stronger stop if the model starts printing meta again
const DEFAULT_STOPS = ['\n[', '\nUser:', '```', '\n#', '\n---'];
function mergeStops(userStops?: string[]) {
  const s = new Set([...(userStops || []), ...DEFAULT_STOPS]);
  // watsonx limit ≤ 6
  return Array.from(s).slice(0, 6);
}

// Remove emojis (incl. ZWJ sequences) robustly
function stripEmojis(s: string): string {
  let out = s;
  try {
    out = out.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    out = out.replace(
      /[\u200D\uFE0E\uFE0F]|\uD83C[\uDFFB-\uDFFF]|[\u231A-\u231B]|\u23F0|\u23F3|\u24C2|\u25FD|\u25FE|[\u2600-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]/g,
      ''
    );
  }
  out = out.replace(/[\u200D\uFE0E\uFE0F]/g, '');
  return out;
}

// Remove wrapping quotes/backticks/markdown quote blocks
function stripWrappingQuotes(s: string): string {
  let t = s.trim();
  t = t
    .split('\n')
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim();
  if (/^```/.test(t) && /```$/.test(t)) t = t.replace(/^```+/, '').replace(/```+$/, '').trim();
  if ((t.startsWith('`') && t.endsWith('`')) || (t.startsWith('``') && t.endsWith('``'))) {
    t = t.replace(/^`+/, '').replace(/`+$/, '').trim();
  }
  const pairs: Array<[RegExp, RegExp]> = [
    [/^"(.*)"$/s, /^"|"$/g],
    [/^'(.*)'$/s, /^'|'$/g],
    [/^“([\s\S]*)”$/s, /^“|”$/g],
    [/^‘([\s\S]*)’$/s, /^‘|’$/g],
  ];
  for (const [wrap, stripRe] of pairs) {
    if (wrap.test(t)) { t = t.replace(stripRe, '').trim(); break; }
  }
  return t.replace(/\s{2,}/g, ' ').trim();
}

// Strip leading meta blocks and role labels, and cut before any later meta
function stripMeta(text: string): string {
  let s = (text || '').trim();
  s = s.replace(/^(?:\s*\[[^\]]+\]\s*)+/i, '').trim();
  s = s.replace(/^(assistant|system|user)\s*:\s*/i, '').trim();
  const cuts = [
    s.indexOf('\n['),
    s.indexOf('\nUser:'),
    s.indexOf('\n```'),
    s.indexOf('\n#'),
    s.indexOf('\n---'),
  ].filter((i) => i > 0);
  if (cuts.length) s = s.slice(0, Math.min(...cuts)).trim();
  s = stripWrappingQuotes(s);
  s = stripEmojis(s);
  return s.replace(/\s{2,}/g, ' ').trim();
}

// Small randomness helper (±pct jitter)
function jitter(val: number, pct: number, min: number, max: number) {
  const j = 1 + (Math.random() * 2 - 1) * pct;
  return clamp(val * j, min, max);
}

/** idx 0 conservative; others increasingly exploratory (with tiny jitter for diversity) */
function paramsForIndex(idx: number, base: Required<GenParams>): Required<GenParams> {
  if (idx === 0) {
    return {
      ...base,
      temperature: Math.min(base.temperature, 0.25),
      top_p: Math.min(base.top_p, 0.9),
      top_k: Math.min(base.top_k, 40),
    };
  }
  let t  = clamp((base.temperature ?? 0.6) + 0.05 * idx, 0.55, 1.05);
  let tp = clamp((base.top_p ?? 0.95) + 0.01 * idx, 0.85, 0.995);
  let tk = clamp((base.top_k ?? 60) + 10 * idx, 40, 200);
  t  = jitter(t,  0.08, 0.5,  1.1);
  tp = jitter(tp, 0.03, 0.8,  0.999);
  tk = clamp(Math.round(tk + (Math.random() * 12 - 6)), 40, 220);
  return { ...base, temperature: t, top_p: tp, top_k: tk };
}

function composeVariantInput(
  system: string | undefined,
  context: string[] | undefined,
  prompt: string,
  instruction: string | undefined
): string {
  const parts: string[] = [];
  if (system && system.trim()) parts.push(`[SYSTEM]\n${system.trim()}`);
  if (context && context.length) {
    parts.push(`[CONTEXT]\n${context.map((c) => c.trim()).filter(Boolean).join('\n---\n')}`);
  }

  // Universal constraints to improve quality & consistency
  const guard =
    'Important: Answer only (no tags or headings). Be specific and helpful. ' +
    'Use one concrete detail or example where relevant. No emojis. No filler or rhetorical questions.';

  const instr = (instruction || '').trim();
  const instrWithGuard = instr ? `${instr}\n\n${guard}` : guard;

  parts.push(`[INSTRUCTIONS]\n${instrWithGuard}`);
  parts.push(`[USER]\n${prompt.trim()}`);
  return parts.join('\n\n') + '\n\nAssistant: ';
}

// Default per-call instruction variants (used if caller doesn't pass their own)
const DEFAULT_INSTRUCTION_VARIANTS = [
  'Be conservative and concise. Provide one clear, concrete suggestion the user can do next.',
  'Be concise and warm but precise. Offer one actionable tip with a brief reason.',
  'Ask one short clarifying question.',
  'Concisely decline or set a boundary if appropriate, briefly state why, and propose a practical alternative.',
  'Concisely offer a different approach in one sentence and include a small example or step.',
  'Be positive and direct and concise. Start with a verb and keep it under two sentences.',
];

// Create randomized seeds per request (optionally deterministic with samplingSeed)
function randomSeedBase() {
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return (arr[0] ^ Date.now()) >>> 0;
    }
  } catch {}
  return (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
}
function makeSeeds(k: number, samplingSeed?: number) {
  const base = typeof samplingSeed === 'number' ? samplingSeed >>> 0 : randomSeedBase();
  return Array.from({ length: k }, (_, i) => (base + i) >>> 0);
}
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// Normalized entropy
function normalizedEntropy(ps: number[]): number {
  const safe = ps.map((p) => Math.max(1e-12, p));
  const sum = safe.reduce((a, b) => a + b, 0) || 1;
  const p = safe.map((q) => q / sum);
  const H = -p.reduce((acc, q) => acc + q * Math.log(q), 0);
  const Hmax = Math.log(p.length || 1);
  return Hmax > 0 ? H / Hmax : 0;
}

// Diversity helpers
function tok(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}
function jaccardTokens(a: string, b: string): number {
  const A = new Set(tok(a)), B = new Set(tok(b));
  if (!A.size && !B.size) return 1;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function mmrReorder(items: Candidate[], lambda = 0.15): Candidate[] {
  if (items.length <= 2) return items.slice();
  const remaining = items.slice().sort((a, b) => b.flow.utility - a.flow.utility);
  const selected: Candidate[] = [remaining.shift()!];
  while (remaining.length) {
    let bestIdx = 0, bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      let maxSim = 0;
      for (const s of selected) maxSim = Math.max(maxSim, jaccardTokens(c.text, s.text));
      const score = c.flow.utility - lambda * maxSim;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}
function filterNearDuplicates(items: Candidate[], shortThresh = 0.97, longThresh = 0.88, distinctStartWords = 2): Candidate[] {
  const kept: Candidate[] = [];
  const seenStarts = new Set<string>();
  for (const it of items) {
    const words = tok(it.text);
    const startKey = words.slice(0, distinctStartWords).join(' ');
    if (startKey && seenStarts.has(startKey)) continue;
    let dup = false;
    for (const k of kept) {
      const sim = jaccardTokens(it.text, k.text);
      const t = (it.text.length < 45 || k.text.length < 45) ? shortThresh : longThresh;
      if (sim >= t) { dup = true; break; }
    }
    if (!dup) { kept.push(it); if (startKey) seenStarts.add(startKey); }
  }
  return kept;
}
function sliceByCoverage(items: Candidate[], minCount: number, maxCount: number, coverage: number, minFourthProb = 0.04): Candidate[] {
  if (!items.length) return [];
  const byProb = [...items].sort((a, b) => b.flow.prob - a.flow.prob);
  const out: Candidate[] = [];
  let cum = 0;
  for (let i = 0; i < byProb.length && out.length < maxCount; i++) {
    out.push(byProb[i]); cum += byProb[i].flow.prob;
    if (out.length >= minCount && cum >= coverage) break;
  }
  if (out.length === 3 && byProb[3] && byProb[3].flow.prob >= minFourthProb && out.length < maxCount) out.push(byProb[3]);
  if (out.length < Math.min(minCount, byProb.length)) return byProb.slice(0, Math.min(minCount, byProb.length));
  return out;
}
function trimToPreferredCount(items: Candidate[], preferCount: number, minCount: number, coverage: number, tolerance = 0.01): Candidate[] {
  let out = [...items];
  while (out.length > preferCount) {
    const tail = out[out.length - 1];
    const cum = out.reduce((s, c) => s + c.flow.prob, 0);
    if (out.length - 1 >= minCount && (cum - tail.flow.prob) >= Math.max(coverage - tolerance, 0)) {
      out.pop();
    } else break;
  }
  return out;
}

// ---- Main ----
export async function generateRankedCandidates(req: GenerateRequest): Promise<GenerateResponse> {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error('Missing IBM_API_KEY, IBM_WATSON_ENDPOINT, or IBM_PROJECT_ID');
  }

  const systemToUse = (req.system || '').trim();

  // Decide how many calls to make
  const plan = (req.perCallInstructions?.length
    ? req.perCallInstructions
    : DEFAULT_INSTRUCTION_VARIANTS).slice(0, 8);

  // Shuffle when using defaults to vary styles across requests
  const planShuffled = req.perCallInstructions?.length ? plan : shuffle([...plan]);

  const wantK = clamp(req.perCallInstructions?.length ?? req.k ?? 6, 1, 8);

  const defaults: Required<GenParams> = {
    temperature: 0.6,
    top_p: 0.95,
    top_k: 60,
    max_new_tokens: 64,
    stop: [],
  };
  const userParams  = { ...(req.params || {}) };
  const baseParams: Required<GenParams> = { ...defaults, ...userParams, stop: mergeStops(userParams.stop) };

  const token = await getTokenCached();

  // Randomized seeds per request (or deterministic if samplingSeed provided)
  const seeds = makeSeeds(wantK, req.samplingSeed);

  const calls = seeds.map((seed, idx) => {
    const instruction = planShuffled[idx % planShuffled.length];
    const input = composeVariantInput(systemToUse, req.context, req.prompt, instruction);
    const params = paramsForIndex(idx, baseParams);

    return generateOnce({
      token,
      input,
      seed,
      params,
      baseUrl: BASE_URL,
      modelId: MODEL_ID,
      projectId: PROJECT_ID,
    })
      .then((r) => ({ ...r, seed, variant: idx === 0 ? ('primary' as const) : ('alt' as const) }))
      .catch((e) => ({ error: String(e?.message || e), seed, variant: idx === 0 ? 'primary' : 'alt' }));
  });

  const settled = await Promise.all(calls);
  const ok = settled.filter((x: any) => !(x as any).error) as Array<{
    text: string; tokens: number; avgLogProb: number; seed: number; variant: 'primary'|'alt';
  }>;
  const genDropped = settled.length - ok.length;

  // Clean each generation (strip meta/labels/quotes/emojis) and drop empties
  const cleaned = ok
    .map((r) => ({ ...r, text: stripMeta(r.text) }))
    .filter((r) => r.text.length > 0);

  if (!cleaned.length) {
    return {
      candidates: [],
      meta: {
        model_id: MODEL_ID,
        usedK: 0,
        dropped: genDropped,
        params: {
          temperature: baseParams.temperature,
          top_p: baseParams.top_p,
          top_k: baseParams.top_k,
          max_new_tokens: baseParams.max_new_tokens,
          stop: baseParams.stop,
        },
      },
    };
  }

  // ---- FlowRank (Level 1) ----
  const flowInputs: FlowSignalsInput[] = cleaned.map((r) => ({
    text: r.text,
    meanLogProb: r.avgLogProb,
  }));

  const flowRows = await scoreFlowLevel1(flowInputs, {
    lastUser: (req.prompt || '').trim(),
    weights: { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 },
  });

  // Attach flow + expose flowProb as relativeProb
  let ranked: Candidate[] = cleaned.map((r, i) => {
    const f = flowRows[i];
    return {
      text: r.text,
      tokens: r.tokens,
      avgLogProb: r.avgLogProb,
      relativeProb: f.flowProb,
      seed: r.seed,
      variant: r.variant,
      flow: {
        simToLastUser: f.simToLastUser,
        lengthPenalty: f.lengthPenalty,
        repetitionPenalty: f.repetitionPenalty,
        totalPenalty: f.totalPenalty,
        utility: f.flowUtility,
        prob: f.flowProb,
        weights: { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 },
      },
    };
  });

  // Sort by flow utility (best first)
  ranked.sort((a, b) => b.flow.utility - a.flow.utility);

  // Diversity (MMR) + de-dupe
  const mmrRanked = mmrReorder(ranked, 0.15);
  const deduped = filterNearDuplicates(mmrRanked, 0.97, 0.88, 2);

  // ---- Final slice: ADAPTIVE coverage-based 3–6 selection ----
  const minReturn = clamp(Math.round(req.minReturn ?? 3), 3, 6);
  const maxReturn = clamp(Math.round(req.maxReturn ?? 6), minReturn, 6);
  const baseList = deduped.length >= Math.min(minReturn, mmrRanked.length) ? deduped : mmrRanked;

  const probs = baseList.map((c) => c.flow.prob);
  const Hnorm = normalizedEntropy(probs);
  const adaptiveCoverage = clamp(0.84 + 0.08 * Hnorm, 0.82, 0.94);
  const coverage = typeof req.coverageTarget === 'number'
    ? clamp(req.coverageTarget, 0.6, 0.98)
    : adaptiveCoverage;

  const selected = sliceByCoverage(baseList, minReturn, maxReturn, coverage, 0.04);
  const preferCount = clamp(Math.round(req.preferCount ?? 5), minReturn, maxReturn);
  const finalSelected = trimToPreferredCount(selected, preferCount, minReturn, coverage, 0.01);

  // Re-sort selected by utility for UI
  finalSelected.sort((a, b) => b.flow.utility - a.flow.utility);

  const totalDropped = genDropped + (ranked.length - finalSelected.length);

  return {
    candidates: finalSelected,
    meta: {
      model_id: MODEL_ID,
      usedK: finalSelected.length,
      dropped: totalDropped,
      params: {
        temperature: baseParams.temperature,
        top_p: baseParams.top_p,
        top_k: baseParams.top_k,
        max_new_tokens: baseParams.max_new_tokens,
        stop: baseParams.stop,
      },
    },
  };
}
