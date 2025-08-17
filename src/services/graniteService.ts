// lib/graniteService.ts
// Granite ranked candidates with:
// - 6 calls per wave (varied seeds & decoding)
// - softer pruning (lenient cutoff)
// - ≥3 varied outputs guaranteed (2nd wave regen + smart fallbacks)
// - stance plan for offers/polar prompts
// - dedupe + distinct starts + cleanup

type GenParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_new_tokens?: number;
  stop?: string[];
};

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
  relativeProb: number;     // 0..1 softmax across candidates
  seed: number;
  variant: "primary" | "alt";
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

const API_KEY   = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID   = process.env.IBM_MODEL_ID || "ibm/granite-3-8b-instruct";
const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || "").replace(/\/+$/, "");
// console.log(MODEL_ID)
// ---------- token cache ----------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIamToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`IAM token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
  return cachedToken.token;
}

// ---------- stops & helpers ----------
const DEFAULT_STOPS = [
  "\nAssistant:",
  "\nUser:",
  "\n[",
  "\n---",
  "```",
  "\n#",
];

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function buildStops(userStops?: string[]): string[] {
  const merged = uniq([...(userStops || []), ...DEFAULT_STOPS]);
  return merged.slice(0, 6); // watsonx limit
}

// ---------- prompt analysis, stance, extraction ----------
type PromptKind = "polar" | "offer" | "open";
type Stance = "YES" | "NO" | "MAYBE" | "CLARIFY" | "DEFLECT" | "BOUNDARY" | "LATER" | "";

function detectPromptKind(prompt: string): PromptKind {
  const p = prompt.trim();
  const offerRe = /\b(?:do you want|would you like|are you up for|shall we|how about|join .+ for|up for)\b/i;
  const polarRe = /\b(?:do|did|will|would|can|could|should|are|were|is|was|have|has|had)\b.*\?$/i;
  if (offerRe.test(p)) return "offer";
  if (polarRe.test(p)) return "polar";
  return "open";
}

function stancePlan(k: number, kind: PromptKind): Stance[] {
  const base: Stance[] =
    kind === "open"
      ? ["", "", "", "CLARIFY", "DEFLECT", "BOUNDARY", "LATER", ""]
      : ["YES", "NO", "MAYBE", "CLARIFY", "DEFLECT", "BOUNDARY", "LATER", ""];
  return base.slice(0, Math.min(Math.max(1, k), 8));
}

// very light activity extraction
function extractActivity(prompt: string): string | null {
  const p = prompt.trim().replace(/\s+/g, " ");
  const m1 = /(?:do you want|would you like|are you up for|shall we|how about)\s+(to\s+)?(.+?)(?:\?|$)/i.exec(p);
  if (m1 && m1[2]) return m1[2].trim().replace(/\.$/, "");
  const m2 = /join (?:me|us)? for (.+?)(?:\?|$)/i.exec(p);
  if (m2 && m2[1]) return m2[1].trim().replace(/\.$/, "");
  return null;
}

// ---------- input composition ----------
const STANCE_HINT: Record<Exclude<Stance, "">, string> = {
  YES: "Take a YES stance. Accept clearly and positively.",
  NO: "Take a NO stance. Decline politely with a brief reason or alternative.",
  MAYBE: "Take a MAYBE stance. Suggest a different time or condition.",
  CLARIFY: "Ask one brief clarifying question to decide.",
  DEFLECT: "Deflect politely and propose a nearby option.",
  BOUNDARY: "Accept in spirit but set a clear boundary (time/energy/budget).",
  LATER: "Acknowledge and propose doing it later with a concrete window.",
};

function composeInput(
  system: string | undefined,
  context: string[] | undefined,
  prompt: string,
  stance: Stance
): string {
  const parts: string[] = [];


  const sys = [system?.trim()].filter(Boolean).join("\n\n");
  if (sys) parts.push(`[SYSTEM]\n${sys}`);

  if (context?.length) {
    parts.push(`[CONTEXT]\n${context.map((c) => c.trim()).filter(Boolean).join("\n---\n")}`);
  }

  if (stance && STANCE_HINT[stance as Exclude<Stance, "">]) {
    parts.push(`[STANCE]\n${stance}\n\n[GUIDANCE]\n${STANCE_HINT[stance as Exclude<Stance, "">]}`);
  }

  parts.push(`[USER]\n${prompt.trim()}`);
  return parts.join("\n\n") + "\n\nAssistant: ";
}

// ---------- text cleanup ----------
const GENERIC_OPENERS = [
  /^thanks for (the )?asking[,!.\s-]*/i,
  /^it['’]s been (a )?(busy|hectic) day[,!.\s-]*/i,
  /^just (trying|trying to) (to )?keep up[,!.\s-]*/i,
  /^honestly[,!.\s-]*/i,
  /^well[,!.\s-]*/i,
  /^sure[,!.\s-]*/i,
];

function dropGenericOpeners(t: string): string {
  let out = t;
  for (const re of GENERIC_OPENERS) out = out.replace(re, "").trim();
  return out;
}

function finalizeUtterance(text: string): string {
  let t = (text || "")
    .replace(/^\s*(?:\[.*?\]\s*)+/g, "")
    .replace(/^(Assistant|System|User):\s*/i, "")
    .replace(/^[“"'\-•>*\s¿¡?,.]+/, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  t = dropGenericOpeners(t);

  const lastOpen = Math.max(t.lastIndexOf("["), t.lastIndexOf("("), t.lastIndexOf("{"), t.lastIndexOf("“"), t.lastIndexOf('"'), t.lastIndexOf("'"));
  const lastClose = Math.max(t.lastIndexOf("]"), t.lastIndexOf(")"), t.lastIndexOf("}"), t.lastIndexOf("”"), t.lastIndexOf('"'), t.lastIndexOf("'"));
  if (lastOpen > lastClose) t = t.slice(0, lastOpen).trim();

  const lastEnd = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf("?"));
  if (lastEnd > -1) t = t.slice(0, lastEnd + 1).trim();
  if (t && !/[.!?…]$/.test(t)) t += ".";

  // de-dup sentences
  const seen = new Set<string>();
  t = t
    .split(/(?<=[.!?])\s+/)
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");

  if (t && /^[a-z]/.test(t)) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

// ---------- calling watsonx ----------
type RawGenResult = {
  results?: Array<{
    generated_text?: string;
    generated_tokens?: Array<{ logprob?: number }>;
    tokens?: Array<{ logprob?: number }>;
  }>;
};

async function generateOnce(
  token: string,
  input: string,
  seed: number,
  params: Required<GenParams>
): Promise<{ text: string; tokens: number; avgLogProb: number }> {
  const res = await fetch(`${BASE_URL}/ml/v1/text/generation?version=2024-08-01`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: MODEL_ID,
      project_id: PROJECT_ID,
      input,
      parameters: {
        decoding_method: params.temperature === 0 ? "greedy" : "sample",
        temperature: params.temperature,
        top_p: params.top_p,
        top_k: params.top_k,
        max_new_tokens: params.max_new_tokens,
        random_seed: seed,
        stop_sequences: params.stop && params.stop.length ? params.stop : undefined,
      },
      return_options: { token_logprobs: true, token_ranks: true, top_n_tokens: 0 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Generation error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as RawGenResult;
  const r = data?.results?.[0];
  const text = r?.generated_text?.trim() || "";

  const tokensArr = (r as any)?.generated_tokens ?? (r as any)?.tokens ?? [];
  const estimateTokenCount = (s: string) => Math.max(1, Math.round(s.split(/\s+/).filter(Boolean).length * 1.3));
  const tokensCount = Array.isArray(tokensArr) && tokensArr.length ? tokensArr.length : estimateTokenCount(text);

  let avgLogProb: number;
  if (Array.isArray(tokensArr) && tokensArr.length) {
    const sum = tokensArr.reduce((s, t) => s + (typeof t.logprob === "number" ? t.logprob : 0), 0);
    avgLogProb = sum / tokensArr.length;
  } else {
    avgLogProb = -1.5;
  }

  return { text, tokens: tokensCount, avgLogProb };
}

// ---------- utilities: variety & ranking ----------
function softmaxFromAvgLogProbs(avgLogs: number[], refLength: number): number[] {
  const scores = avgLogs.map((l) => (Number.isFinite(l) ? l * refLength : -1e9));
  const maxS = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maxS));
  const denom = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / denom);
}

function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(a.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  const B = new Set(b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function enforceDistinctStarts(texts: string[]): number[] {
  const seen = new Set<string>();
  const keep: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const words = texts[i].toLowerCase().split(/\s+/).filter(Boolean);
    const key = words.slice(0, 2).join(" "); // distinct first two words
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(i);
  }
  return keep.length ? keep : texts.map((_, i) => i);
}

function dedupe(texts: string[], threshold = 0.85): number[] {
  // threshold is high => only *very* similar items are dropped (more lenient)
  const keep: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || t.length < 2) continue;
    let dup = false;
    for (const ki of keep) {
      if (jaccardSimilarity(texts[ki], t) >= threshold) { dup = true; break; }
    }
    if (!dup) keep.push(i);
  }
  return keep;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pickTargetCount(k?: number) {
  // If caller provides k, respect it (clamped 3..6)
  if (typeof k === "number") return clamp(Math.round(k), 3, 6);

  // Otherwise randomize:
  // 55% -> 5 or 6 (50/50 within)
  // 45% -> 3 or 4 (50/50 within)
  const p = Math.random();
  if (p < 0.55) return 5 + (Math.random() < 0.5 ? 0 : 1);
  return 3 + (Math.random() < 0.5 ? 0 : 1);
}

/** idx 0 conservative, others increasingly exploratory (for variety). */
function paramsForIndex(idx: number, base: Required<GenParams>): Required<GenParams> {
  if (idx === 0) {
    return {
      ...base,
      temperature: Math.min(base.temperature, 0.25),
      top_p: Math.min(base.top_p, 0.9),
      top_k: Math.min(base.top_k, 40),
    };
  }
  const t  = clamp(0.75 + idx * 0.05, 0.75, 1.05);
  const tp = clamp(0.9  + idx * 0.02, 0.9,  0.995);
  const tk = clamp(60   + idx * 12,   60,   180);
  return { ...base, temperature: t, top_p: tp, top_k: tk };
}

// ---------- stance enforcement (post-process) ----------
function matchesYes(t: string)   { return /\b(yes|sure|definitely|let'?s|sounds good|i'?m in)\b/i.test(t); }
function matchesNo(t: string)    { return /\b(no|can['’]t|cannot|won['’]t|rather not|unfortunately|sorry,? i can['’]?t)\b/i.test(t); }
function matchesMaybe(t: string) { return /\b(maybe|perhaps|could|another time|later|not sure)\b/i.test(t); }

function enforceStanceText(stance: Stance, prompt: string, current: string): string {
  if (!stance) return current;
  const t = current.trim();

  if (stance === "YES"   && matchesYes(t))   return t;
  if (stance === "NO"    && matchesNo(t))    return t;
  if (stance === "MAYBE" && matchesMaybe(t)) return t;

  const activity = extractActivity(prompt);
  const a = activity ? activity.replace(/^to\s+/i, "") : null;

  if (stance === "YES")   return a ? `Yes, let’s ${a}.` : "Yes, let’s do it.";
  if (stance === "NO")    return a ? `I can’t ${a} today—sorry.` : "I can’t today—sorry.";
  if (stance === "MAYBE") return a ? `Maybe—how about ${a} a bit later?` : "Maybe—how about a bit later?";
  return t || (a ? `Maybe—how about ${a} another time?` : "Maybe—another time?");
}

// ---------- fallbacks ----------
function ynmFallbacks(prompt: string): string[] {
  const a = extractActivity(prompt);
  const act = a ? a.replace(/^to\s+/i, "") : null;
  return [
    act ? `Yes, let’s ${act}.`               : "Yes, let’s do it.",
    act ? `I can’t ${act} today—sorry.`      : "I can’t today—sorry.",
    act ? `Maybe—how about ${act} later?`    : "Maybe—how about a bit later?",
  ];
}

function openFallbacks(): string[] {
  return [
    "Could you tell me a bit more?",
    "Got it—what would you like me to focus on?",
    "I’m not sure I follow—can you clarify?",
  ];
}

// ---------- main ----------
export async function generateRankedCandidates(req: GenerateRequest): Promise<GenerateResponse> {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error("Missing IBM_API_KEY, IBM_WATSON_ENDPOINT, or IBM_PROJECT_ID");
  }

  // We *source* variety from 6 model calls; we'll still honor req.k on the final slice.
  const SOURCE_CALLS = 6;
  const MAX_OUTPUT   = Math.min(6, Math.max(3, req.k ?? 6)); // client-visible cap

  const defaults: Required<GenParams> = {
    temperature: 0.5,
    top_p: 0.9,
    top_k: 50,
    max_new_tokens: 48,
    stop: [],
  };

  const userParams  = { ...(req.params || {}) };
  const mergedStops = buildStops(userParams.stop);
  const baseParams: Required<GenParams> = { ...defaults, ...userParams, stop: mergedStops };

  const kind = detectPromptKind(req.prompt);
  const plan = stancePlan(SOURCE_CALLS, kind);

  const token = await getIamToken();

  // --- helper: one wave of 6 calls ---
  async function runWave(seedBase: number, moreExploratory = false) {
    const seeds = Array.from({ length: SOURCE_CALLS }, (_, i) => (i === 0 ? 101 : seedBase + i));
    const calls = seeds.map((seed, idx) => {
      const stance = plan[idx] || "";
      const params = moreExploratory ? paramsForIndex(idx + 1, baseParams) : paramsForIndex(idx, baseParams);
      const input  = composeInput(req.system || "", req.context || [], req.prompt, stance);
      return generateOnce(token, input, seed, params).then((r) => ({
        ...r,
        seed,
        variant: idx === 0 ? "primary" as const : "alt" as const,
        stance,
      }));
    });
    const settled = await Promise.allSettled(calls);
    return settled
      .map((pr, i) =>
        pr.status === "fulfilled"
          ? pr.value
          : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: seeds[i], stance: plan[i] || "" }
      );
  }

  // Wave 1: 6 calls (mixed conservative + exploratory)
  const wave1 = await runWave(1000, false);
  let ok = wave1.filter((x: any) => !(x as any).error) as Array<{ text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary"|"alt"; stance: Stance }>;

  // cleanup + stance touch-up
  let processed = ok.map((r) => ({ ...r, text: finalizeUtterance(r.text) }));
  if (kind !== "open") {
    for (let i = 0; i < Math.min(3, processed.length); i++) {
      const s = plan[i] || "";
      if (s === "YES" || s === "NO" || s === "MAYBE") {
        processed[i].text = finalizeUtterance(enforceStanceText(s, req.prompt, processed[i].text));
      }
    }
  }

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
  let keepIdxs = dedupe(texts0, 0.85);                 // only drop *very* similar
  let kept = keepIdxs.map((i) => processed[i]);

  const startsIdx = enforceDistinctStarts(kept.map((r) => r.text));
  kept = startsIdx.map((i) => kept[i]);

  // If after wave 1 we still have <3, run a second wave with *more exploratory* params
  if (kept.length < 3) {
    const wave2 = await runWave(2000, true);
    const ok2 = wave2.filter((x: any) => !(x as any).error) as Array<{ text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary"|"alt"; stance: Stance }>;
    let processed2 = ok2.map((r) => ({ ...r, text: finalizeUtterance(r.text) }));
    if (kind !== "open") {
      for (let i = 0; i < Math.min(3, processed2.length); i++) {
        const s = plan[i] || "";
        if (s === "YES" || s === "NO" || s === "MAYBE") {
          processed2[i].text = finalizeUtterance(enforceStanceText(s, req.prompt, processed2[i].text));
        }
      }
    }
    processed2 = processed2.filter(({ text, tokens }) => {
      if (!text) return false;
      const words = text.split(/\s+/).filter(Boolean).length;
      return (tokens ?? 0) >= MIN_TOKENS || words >= MIN_WORDS;
    });

    // merge waves then re-variety
    const merged = [...processed, ...processed2];
    const textsM = merged.map((r) => r.text);
    // relax dedupe slightly to allow more near-variants if needed
    const k1 = dedupe(textsM, merged.length < 6 ? 0.9 : 0.85);
    let keptM = k1.map((i) => merged[i]);
    const k2 = enforceDistinctStarts(keptM.map((r) => r.text));
    kept = k2.map((i) => keptM[i]);
  }

  // If still <3 → smart fallbacks (no duplicates, stance-aware for offers/polar)
  if (kept.length < 3) {
    const have = new Set(kept.map((r) => r.text.toLowerCase()));
    const adds = (kind === "open" ? openFallbacks() : ynmFallbacks(req.prompt))
      .filter(t => !have.has(t.toLowerCase()))
      .slice(0, 3 - kept.length)
      .map((text, i) => ({
        text,
        tokens: Math.max(3, Math.round(text.split(/\s+/).length * 1.3)),
        avgLogProb: -1.5,
        seed: 9900 + i,
        variant: "alt" as const,
        stance: "" as Stance,
      }));
    kept = kept.concat(adds);
  }

  // Rank with lenient cutoff
  const avgLogs = kept.map((r) => r.avgLogProb);
  const tokenCounts = kept.map((r) => r.tokens);
  const medianTokens = tokenCounts.slice().sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] || 48;
  const rel = softmaxFromAvgLogProbs(avgLogs, medianTokens);

  // Lower prob cutoff so we keep more viable options
  const NEGLIGIBLE = 0.005;
  let filtered = kept
    .map((r, i) => ({ ...r, relativeProb: rel[i] }))
    .filter((x) => x.relativeProb >= NEGLIGIBLE || kept.length <= 4);

  // Ensure at least 3 survive ranking
  if (filtered.length < Math.min(3, kept.length)) {
    filtered = kept
      .map((r, i) => ({ ...r, relativeProb: rel[i] }))
      .sort((a, b) => b.relativeProb - a.relativeProb)
      .slice(0, Math.min(3, kept.length));
  }

// Decide how many to return this call (randomized unless req.k provided)
const TARGET = pickTargetCount(req.k);

// Final slice
filtered.sort((a, b) => b.relativeProb - a.relativeProb);
const final = filtered.slice(0, TARGET);

  const candidates: Candidate[] = final.map((r) => ({
    text: r.text,
    tokens: r.tokens,
    avgLogProb: r.avgLogProb,
    relativeProb: (r as any).relativeProb ?? 1 / final.length,
    seed: r.seed,
    variant: r.variant,
  }));

  return {
    candidates,
    meta: {
      model_id: MODEL_ID,
      usedK: final.length,
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
