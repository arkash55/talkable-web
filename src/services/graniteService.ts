// lib/graniteService.ts
// Orchestrator that uses helpers + Level-1 flow ranking.
// relativeProb is set to flow.prob for backward compatibility.

import { scoreFlowLevel1, type FlowSignalsOutput, type FlowSignalsInput } from '../app/utils/flowRank';

import {
  GenParams,
  buildStops,
  detectPromptKind,
  sentimentPlan,
  enforceSentimentText,
  composeInput,
  finalizeUtterance,
  softmaxFromAvgLogProbs,
  enforceDistinctStarts,
  dedupe,
  paramsForIndex,
  pickTargetCount,
  ynmFallbacks,
  openFallbacks,
  smalltalkFallbacks,
  type SentimentMode,
  type Stance,
  enforceStanceText,
  getIamToken,
  generateOnce,
} from './graniteHelper';

export type GenerateRequest = {
  prompt: string;
  context?: string[];
  system?: string;
  k?: number;               // requested count (we still call 6x to source variety)
  params?: GenParams;
};

export type Candidate = {
  text: string;
  tokens: number;
  avgLogProb: number;       // closer to 0 = more likely
  /** kept for backward compat; equals flow.prob */
  relativeProb: number;     // 0..1 softmax across candidates
  seed: number;
  variant: "primary" | "alt";
  flow: {
    simToLastUser: number;       // 0..1
    lengthPenalty: number;
    repetitionPenalty: number;
    totalPenalty: number;
    utility: number;             // a*meanLogProb + b*sim - g*penalty
    prob: number;                // softmax over utilities across shown set
    weights: { a: number; b: number; g: number; tau: number };
  };
};

export type GenerateResponse = {
  candidates: Candidate[];
  meta: {
    model_id: string;
    usedK: number;
    dropped: number;
    params: Required<GenParams>;
  };
};

// Env config (kept here for clarity)
const API_KEY    = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID   = process.env.IBM_MODEL_ID || "ibm/granite-3-8b-instruct";
const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || "").replace(/\/+$/, "");

// ---------- small token cache ----------
let cachedToken: { token: string; expiresAt: number } | null = null;
async function getTokenCached(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const token = await getIamToken(API_KEY);
  cachedToken = { token, expiresAt: now + 55 * 60 * 1000 }; // refresh a bit early
  return token;
}

// ---------- main ----------
export async function generateRankedCandidates(req: GenerateRequest): Promise<GenerateResponse> {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error("Missing IBM_API_KEY, IBM_WATSON_ENDPOINT, or IBM_PROJECT_ID");
  }

  const SOURCE_CALLS = 6;
  const MAX_OUTPUT   = Math.min(6, Math.max(3, req.k ?? 6));

  const defaults: Required<GenParams> = {
    temperature: 0.6,
    top_p: 0.95,
    top_k: 60,
    max_new_tokens: 64,
    stop: [],
  };

  const userParams  = { ...(req.params || {}) };
  const mergedStops = buildStops(userParams.stop);
  const baseParams: Required<GenParams> = { ...defaults, ...userParams, stop: mergedStops };

  const kind = detectPromptKind(req.prompt);
  const stancePlanLocal: Stance[] = (() => {
    const count = Math.min(Math.max(1, SOURCE_CALLS), 8);
    if (kind === "smalltalk") return Array(count).fill("") as Stance[];
    const base: Stance[] =
      kind === "open"
        ? ["", "", "", "CLARIFY", "DEFLECT", "BOUNDARY", "LATER", ""]
        : ["YES", "NO", "MAYBE", "CLARIFY", "DEFLECT", "BOUNDARY", "LATER", ""];
    return base.slice(0, count);
  })();

  const modes = sentimentPlan(); // 6 sentiment modes
  const token = await getTokenCached();

  // --- helper: one wave of 6 calls ---
  async function runWave(seedBase: number, moreExploratory = false) {
    const seeds = Array.from({ length: SOURCE_CALLS }, (_, i) => (i === 0 ? 101 : seedBase + i));
    const calls = seeds.map((seed, idx) => {
      const stance = stancePlanLocal[idx] || "";
      const params = moreExploratory ? paramsForIndex(idx + 1, baseParams) : paramsForIndex(idx, baseParams);
      const input  = composeInput(req.system || "", req.context || [], req.prompt, stance, kind, modes[idx]);
      return generateOnce({
        token,
        input,
        seed,
        params,
        baseUrl: BASE_URL,
        modelId: MODEL_ID,
        projectId: PROJECT_ID,
      }).then((r) => ({
        ...r,
        seed,
        variant: idx === 0 ? "primary" as const : "alt" as const,
        stance,
        mode: modes[idx],
      }));
    });
    const settled = await Promise.allSettled(calls);
    return settled.map((pr, i) =>
      pr.status === "fulfilled"
        ? pr.value
        : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: 1000 + i, stance: stancePlanLocal[i] || "", mode: modes[i] }
    );
  }

  // Wave 1
  const wave1 = await runWave(1000, false);
  let ok = wave1.filter((x: any) => !(x as any).error) as Array<{
    text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary"|"alt"; stance: Stance; mode: SentimentMode
  }>;

  // cleanup + stance + sentiment touch-up
  let processed = ok.map((r) => {
    let txt = finalizeUtterance(r.text, kind);
    if (kind !== "open" && kind !== "smalltalk") {
      if (r.stance === "YES" || r.stance === "NO" || r.stance === "MAYBE") {
        txt = finalizeUtterance(enforceStanceText(r.stance, req.prompt, txt), kind);
      }
    }
    txt = enforceSentimentText(r.mode, txt);
    return { ...r, text: txt };
  });

  // filter short/empty
  const MIN_TOKENS = 3;
  const MIN_WORDS  = 2;
  processed = processed.filter(({ text, tokens }) => {
    if (!text) return false;
    const words = text.split(/\s+/).filter(Boolean).length;
    return (tokens ?? 0) >= MIN_TOKENS || words >= MIN_WORDS;
  });

  // Variety: lenient dedupe + distinct starts
  const texts0 = processed.map((r) => r.text);
  let keepIdxs = dedupe(texts0, 0.85);
  let kept = keepIdxs.map((i) => processed[i]);

  const startsIdx = enforceDistinctStarts(kept.map((r) => r.text));
  kept = startsIdx.map((i) => kept[i]);

  // If after wave 1 we still have <3, run wave 2 more exploratory
  if (kept.length < 3) {
    const modes2 = sentimentPlan();
    const seeds = Array.from({ length: SOURCE_CALLS }, (_, i) => 2000 + i);
    const calls = seeds.map((seed, idx) => {
      const stance = stancePlanLocal[idx] || "";
      const params = paramsForIndex(idx + 1, baseParams);
      const input  = composeInput(req.system || "", req.context || [], req.prompt, stance, kind, modes2[idx]);
      return generateOnce({
        token,
        input,
        seed,
        params,
        baseUrl: BASE_URL,
        modelId: MODEL_ID,
        projectId: PROJECT_ID,
      }).then((r) => ({
        ...r,
        seed,
        variant: idx === 0 ? "primary" as const : "alt" as const,
        stance,
        mode: modes2[idx],
      }));
    });
    const settled = await Promise.allSettled(calls);
    const ok2 = settled
      .map((pr, i) => pr.status === "fulfilled" ? pr.value : null)
      .filter(Boolean) as typeof ok;

    let processed2 = ok2.map((r) => {
      let txt = finalizeUtterance(r.text, kind);
      if (kind !== "open" && kind !== "smalltalk") {
        if (r.stance === "YES" || r.stance === "NO" || r.stance === "MAYBE") {
          txt = finalizeUtterance(enforceStanceText(r.stance, req.prompt, txt), kind);
        }
      }
      txt = enforceSentimentText(r.mode, txt);
      return { ...r, text: txt };
    });

    processed2 = processed2.filter(({ text, tokens }) => {
      if (!text) return false;
      const words = text.split(/\s+/).filter(Boolean).length;
      return (tokens ?? 0) >= MIN_TOKENS || words >= MIN_WORDS;
    });

    const merged = [...processed, ...processed2];
    const textsM = merged.map((r) => r.text);
    const k1 = dedupe(textsM, merged.length < 6 ? 0.9 : 0.85);
    let keptM = k1.map((i) => merged[i]);
    const k2 = enforceDistinctStarts(keptM.map((r) => r.text));
    kept = k2.map((i) => keptM[i]);
  }

  // If still <3 → smart fallbacks
  if (kept.length < 3) {
    const have = new Set(kept.map((r) => r.text.toLowerCase()));
    const pools = { smalltalk: smalltalkFallbacks(), open: openFallbacks(), ynm: ynmFallbacks(req.prompt) };
    const pool = kind === "smalltalk" ? pools.smalltalk : kind === "open" ? pools.open : pools.ynm;

    const adds = pool
      .filter(t => !have.has(t.toLowerCase()))
      .slice(0, 3 - kept.length)
      .map((text, i) => ({
        text,
        tokens: Math.max(3, Math.round(text.split(/\s+/).length * 1.3)),
        avgLogProb: -1.5,
        seed: 9900 + i,
        variant: "alt" as const,
        stance: "" as Stance,
        mode: { pol: "NEU", int: "PLAIN", tag: "neutral" } as SentimentMode,
      }));
    kept = kept.concat(adds);
  }

  // Initial ranking via avg log-prob (legacy) to feed polarity-aware slice
  const avgLogs = kept.map((r) => r.avgLogProb);
  const tokenCounts = kept.map((r) => r.tokens);
  const medianTokens = tokenCounts.slice().sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] || 48;
  const rel = softmaxFromAvgLogProbs(avgLogs, medianTokens);

  const allShort = kept.every(r => (r.text?.length || 0) < 60);
  const NEGLIGIBLE = allShort ? 0.0 : 0.005;

  let filtered = kept
    .map((r, i) => ({ ...r, relativeProb: rel[i] }))
    .filter((x) => x.relativeProb >= NEGLIGIBLE || kept.length <= 4);

  if (filtered.length < Math.min(3, kept.length)) {
    filtered = kept
      .map((r, i) => ({ ...r, relativeProb: rel[i] }))
      .sort((a, b) => b.relativeProb - a.relativeProb)
      .slice(0, Math.min(3, kept.length));
  }

  const TARGET = Math.min(pickTargetCount(req.k), MAX_OUTPUT);

  type WithMode = typeof kept[number] & { mode?: SentimentMode };

  // Polarity-aware slice keeps POS/NEU/NEG coverage where possible
  function polarityAwareSlice(items: Array<WithMode & { relativeProb: number }>, n: number) {
    const byPol = {
      POS: items.filter(i => i.mode?.pol === "POS").sort((a,b)=>b.relativeProb-a.relativeProb),
      NEU: items.filter(i => i.mode?.pol === "NEU").sort((a,b)=>b.relativeProb-a.relativeProb),
      NEG: items.filter(i => i.mode?.pol === "NEG").sort((a,b)=>b.relativeProb-a.relativeProb),
    };

    const picked: Array<WithMode & { relativeProb: number }> = [];
    (["POS","NEU","NEG"] as const).forEach(pol => {
      if (byPol[pol].length) picked.push(byPol[pol][0]);
    });

    const already = new Set(picked.map(p => p.text));
    const rest = items
      .slice()
      .sort((a,b)=>b.relativeProb-a.relativeProb)
      .filter(x => !already.has(x.text));

    while (picked.length < Math.min(n, items.length) && rest.length) picked.push(rest.shift()!);
    return picked.slice(0, n);
  }

  filtered.sort((a, b) => b.relativeProb - a.relativeProb);
  const final = polarityAwareSlice(filtered as any, TARGET);

  // -------- Level-1 Flow Ranking (Likelihood + Alignment) --------
  const lastUser = (req.prompt || '').trim();
  const flowInputs: FlowSignalsInput[] = final.map(r => ({ text: r.text, meanLogProb: r.avgLogProb }));

  const flowRows: FlowSignalsOutput[] = await scoreFlowLevel1(flowInputs, {
    lastUser,
    // getEmbedding: async (s: string) => [...], // optional future plug-in
    weights: { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 },
  });

  const withFlow = final.map((r, i) => {
    const f = flowRows[i];
    return {
      ...r,
      flow: {
        simToLastUser: f.simToLastUser,
        lengthPenalty: f.lengthPenalty,
        repetitionPenalty: f.repetitionPenalty,
        totalPenalty: f.totalPenalty,
        utility: f.flowUtility,
        prob: f.flowProb,
        weights: { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 },
      },
      relativeProb: f.flowProb, // expose flow prob for backward-compat UI
    };
  });

  withFlow.sort((a, b) => b.flow.utility - a.flow.utility);

  const candidates: Candidate[] = withFlow.map((r) => ({
    text: r.text,
    tokens: r.tokens,
    avgLogProb: r.avgLogProb,
    relativeProb: r.relativeProb,
    seed: r.seed,
    variant: r.variant,
    flow: r.flow,
  }));

  return {
    candidates,
    meta: {
      model_id: MODEL_ID,
      usedK: candidates.length,
      dropped: kept.length - final.length,
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
