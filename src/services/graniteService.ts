// lib/graniteService.ts
// Granite ranked candidates with:
// - 6 calls per wave (varied seeds & decoding)
// - explicit sentiment buckets (POS/NEU/NEG × SUPER/PLAIN/SLIGHT) — 6 sampled modes per wave
// - softer pruning (lenient cutoff)
// - ≥3 varied outputs guaranteed (2nd wave regen + smart fallbacks)
// - smalltalk bypass + casual style nudge + bounce-back
// - lenient dedupe for short replies, distinct starts for longer
// - cleanup that keeps natural smalltalk openers

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

const API_KEY    = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID   = process.env.IBM_MODEL_ID || "ibm/granite-3-8b-instruct";
const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || "").replace(/\/+$/, "");

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
  return merged.slice(0, 6); // watsonx limit: ≤ 6
}

// ---------- prompt analysis, stance, extraction ----------
type PromptKind = "polar" | "offer" | "open" | "smalltalk";
type Stance = "YES" | "NO" | "MAYBE" | "CLARIFY" | "DEFLECT" | "BOUNDARY" | "LATER" | "";

function isPhatic(p: string) {
  const s = p.trim().toLowerCase();
  const greet = /\b(hi|hey|hello|yo|hiya|sup|good (morning|afternoon|evening))\b/;
  const howare = /(how (are|r) (you|u)|how's it going|hru|how ya doin|how are ya)/;
  return greet.test(s) || howare.test(s);
}

function detectPromptKind(prompt: string): PromptKind {
  const p = prompt.trim();
  if (isPhatic(p)) return "smalltalk";
  const offerRe = /\b(?:do you want|would you like|are you up for|shall we|how about|join .+ for|up for)\b/i;
  const polarRe = /\b(?:do|did|will|would|can|could|should|are|were|is|was|have|has|had)\b.*\?$/i;
  if (offerRe.test(p)) return "offer";
  if (polarRe.test(p)) return "polar";
  return "open";
}

// activity extraction (for Y/N/M fallbacks)
function extractActivity(prompt: string): string | null {
  const p = prompt.trim().replace(/\s+/g, " ");
  const m1 = /(?:do you want|would you like|are you up for|shall we|how about)\s+(to\s+)?(.+?)(?:\?|$)/i.exec(p);
  if (m1 && m1[2]) return m1[2].trim().replace(/\.$/, "");
  const m2 = /join (?:me|us)? for (.+?)(?:\?|$)/i.exec(p);
  if (m2 && m2[1]) return m2[1].trim().replace(/\.$/, "");
  return null;
}

// ---------- sentiment model ----------
type SentimentPolarity = "POS" | "NEU" | "NEG";
type SentimentIntensity = "SUPER" | "PLAIN" | "SLIGHT";
type SentimentMode = { pol: SentimentPolarity; int: SentimentIntensity; tag: string };

const ALL_SENTIMENTS: SentimentMode[] = [
  { pol: "POS", int: "SUPER",  tag: "super_positive" },
  { pol: "POS", int: "PLAIN",  tag: "positive" },
  { pol: "POS", int: "SLIGHT", tag: "slightly_positive" },
  { pol: "NEU", int: "SUPER",  tag: "warm_neutral" },
  { pol: "NEU", int: "PLAIN",  tag: "neutral" },
  { pol: "NEU", int: "SLIGHT", tag: "terse_neutral" },
  { pol: "NEG", int: "SLIGHT", tag: "slightly_negative" },
  { pol: "NEG", int: "PLAIN",  tag: "negative" },
  { pol: "NEG", int: "SUPER",  tag: "super_negative" },
];

// Choose 6 distinct sentiment modes per wave, covering all polarities where possible.
function sentimentPlan(): SentimentMode[] {
  // Bias to include at least one of each polarity
  const pick = <T,>(arr: T[], n: number) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };

  const pos = ALL_SENTIMENTS.filter(s => s.pol === "POS");
  const neu = ALL_SENTIMENTS.filter(s => s.pol === "NEU");
  const neg = ALL_SENTIMENTS.filter(s => s.pol === "NEG");

  const seed: SentimentMode[] = [
    pick(pos, 2)[0],
    pick(neu, 2)[0],
    pick(neg, 2)[0],
  ].filter(Boolean);

  const remaining = ALL_SENTIMENTS.filter(s => !seed.includes(s));
  const extra = pick(remaining, 6 - seed.length);
  const plan = [...seed, ...extra].slice(0, 6);

  // Ensure uniqueness by tag
  const seen = new Set<string>();
  return plan.filter(m => (seen.has(m.tag) ? false : (seen.add(m.tag), true)));
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

function sentimentGuidance(mode: SentimentMode): string {
  const { pol, int } = mode;
  // Keep guidance crisp; no moral overreach, just tone.
  const core =
    pol === "POS" ? "Positive tone."
    : pol === "NEG" ? "Negative tone."
    : "Neutral tone.";
  const shading =
    int === "SUPER"  ? (pol === "POS" ? "Very enthusiastic, upbeat." : pol === "NEG" ? "Strongly negative; firm." : "Warm neutral; friendly.")
    : int === "PLAIN" ? (pol === "POS" ? "Clearly positive." : pol === "NEG" ? "Clearly negative." : "Even, matter-of-fact.")
    : /* SLIGHT */     (pol === "POS" ? "Slightly positive." : pol === "NEG" ? "Slightly negative." : "Terse neutral.");
  // Style guardrails for brevity & realism
  return `${core} ${shading} 1–2 sentences, natural, concise. No emoji or role labels.`;
}

function composeInput(
  system: string | undefined,
  context: string[] | undefined,
  prompt: string,
  stance: Stance,
  kind: PromptKind | undefined,
  mode: SentimentMode
): string {
  const parts: string[] = [];

  const sys = [system?.trim()].filter(Boolean).join("\n\n");
  if (sys) parts.push(`[SYSTEM]\n${sys}`);

  if (context?.length) {
    parts.push(`[CONTEXT]\n${context.map((c) => c.trim()).filter(Boolean).join("\n---\n")}`);
  }

  // Sentiment is always enforced
  parts.push(`[SENTIMENT]\n${mode.tag}\n\n[GUIDANCE]\n${sentimentGuidance(mode)}`);

  if (kind === "smalltalk") {
    parts.push(`[STYLE]\nCasual, warm, 1–2 sentences. Use contractions. It’s okay to add a brief “How about you?”`);
  } else if (stance && STANCE_HINT[stance as Exclude<Stance, "">]) {
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

function ensureBounceBackForSmalltalk(reply: string): string {
  const r = reply.trim();
  const hasQuestion = /(\?|how (about|are) you|what about you)/i.test(r);
  if (hasQuestion) return r;
  return r.endsWith(".") ? r + " How about you?" : r + " — how about you?";
}

function finalizeUtterance(text: string, kind?: PromptKind): string {
  let t = (text || "")
    .replace(/^\s*(?:\[.*?\]\s*)+/g, "")
    .replace(/^(Assistant|System|User):\s*/i, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (kind !== "smalltalk") t = dropGenericOpeners(t);

  const lastOpen = Math.max(t.lastIndexOf("["), t.lastIndexOf("("), t.lastIndexOf("{"), t.lastIndexOf("“"), t.lastIndexOf('"'), t.lastIndexOf("'"));
  const lastClose = Math.max(t.lastIndexOf("]"), t.lastIndexOf(")"), t.lastIndexOf("}"), t.lastIndexOf("”"), t.lastIndexOf('"'), t.lastIndexOf("'"));
  if (lastOpen > lastClose) t = t.slice(0, lastOpen).trim();

  const lastEnd = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf("?"));
  if (lastEnd > -1) t = t.slice(0, lastEnd + 1).trim();
  if (t && !/[.!?…]$/.test(t)) t += ".";

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

  if (kind === "smalltalk") t = ensureBounceBackForSmalltalk(t);
  return t;
}

// ---------- sentiment post-enforcement ----------
function enforceSentimentText(mode: SentimentMode, t: string): string {
  const s = t.trim();

  // Lexical nudges: minimal edits to respect the requested polarity.
  const POS_WORDS = ["great", "glad", "happy", "awesome", "sounds good", "love", "nice"];
  const NEG_WORDS = ["can’t", "won’t", "don’t", "unfortunately", "rather not", "not ideal"];
  const NEU_WORDS = ["noted", "okay", "sure", "alright"];

  const has = (arr: string[]) => arr.some(w => new RegExp(`\\b${w}\\b`, "i").test(s));

  if (mode.pol === "POS" && !has(POS_WORDS)) {
    return s.replace(/\.$/, "") + ". Sounds good.";
  }
  if (mode.pol === "NEG" && !has(NEG_WORDS)) {
    return s.replace(/\.$/, "") + ". I’d rather not.";
  }
  if (mode.pol === "NEU" && !has([...NEU_WORDS, ...POS_WORDS, ...NEG_WORDS])) {
    return s.replace(/\.$/, "") + ". Okay.";
  }

  // Intensity shading (very light)
  if (mode.int === "SUPER" && mode.pol === "POS" && !/!\s*$/.test(s)) return s.replace(/\.$/, "!"); // upbeat
  if (mode.int === "SUPER" && mode.pol === "NEG") return s; // keep firm without extra punctuation
  if (mode.int === "SLIGHT" && mode.pol !== "NEU") {
    // soften extremes
    return s.replace(/\b(definitely|absolutely|never|always)\b/gi, "maybe");
  }
  return s;
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
  const short = texts.every(t => (t?.length || 0) < 45);
  if (short) return texts.map((_, i) => i);
  const seen = new Set<string>();
  const keep: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const words = texts[i].toLowerCase().split(/\s+/).filter(Boolean);
    const key = words.slice(0, 2).join(" ");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(i);
  }
  return keep.length ? keep : texts.map((_, i) => i);
}

function dedupe(texts: string[], threshold = 0.85): number[] {
  const keep: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || t.length < 2) continue;
    const localThresh = t.length < 45 ? 0.97 : threshold;
    let dup = false;
    for (const ki of keep) {
      if (jaccardSimilarity(texts[ki], t) >= localThresh) { dup = true; break; }
    }
    if (!dup) keep.push(i);
  }
  return keep;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pickTargetCount(k?: number) {
  if (typeof k === "number") return clamp(Math.round(k), 3, 6);
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

// ---------- stance helpers (legacy fallbacks) ----------
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

function smalltalkFallbacks(): string[] {
  return [
    "Hey! I’m good—how are you?",
    "Doing well, thanks for asking. How’s your day going?",
    "Pretty good over here. What’s up?",
    "I’m doing alright! How about you?",
    "Not bad at all—how are you doing?",
  ];
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

  const token = await getIamToken();

  // --- helper: one wave of 6 calls ---
  async function runWave(seedBase: number, moreExploratory = false) {
    const seeds = Array.from({ length: SOURCE_CALLS }, (_, i) => (i === 0 ? 101 : seedBase + i));
    const calls = seeds.map((seed, idx) => {
      const stance = stancePlanLocal[idx] || "";
      const params = moreExploratory ? paramsForIndex(idx + 1, baseParams) : paramsForIndex(idx, baseParams);
      const input  = composeInput(req.system || "", req.context || [], req.prompt, stance, kind, modes[idx]);
      return generateOnce(token, input, seed, params).then((r) => ({
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

  // If after wave 1 we still have <3, run a second wave (fresh sentiment plan) with more exploratory params
  if (kept.length < 3) {
    const modes2 = sentimentPlan();
    const wave2 = await (async () => {
      const seeds = Array.from({ length: SOURCE_CALLS }, (_, i) => 2000 + i);
      const calls = seeds.map((seed, idx) => {
        const stance = stancePlanLocal[idx] || "";
        const params = paramsForIndex(idx + 1, baseParams);
        const input  = composeInput(req.system || "", req.context || [], req.prompt, stance, kind, modes2[idx]);
        return generateOnce(token, input, seed, params).then((r) => ({
          ...r,
          seed,
          variant: idx === 0 ? "primary" as const : "alt" as const,
          stance,
          mode: modes2[idx],
        }));
      });
      const settled = await Promise.allSettled(calls);
      return settled.map((pr, i) =>
        pr.status === "fulfilled" ? pr.value : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: 2000 + i, stance: stancePlanLocal[i] || "", mode: modes2[i] }
      );
    })();

    const ok2 = wave2.filter((x: any) => !(x as any).error) as Array<{
      text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary"|"alt"; stance: Stance; mode: SentimentMode
    }>;
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

  // If still <3 → smart fallbacks (keep sentiment spread: pos/neu/neg)
  if (kept.length < 3) {
    const have = new Set(kept.map((r) => r.text.toLowerCase()));
    const pools = {
      smalltalk: smalltalkFallbacks(),
      open: openFallbacks(),
      ynm: ynmFallbacks(req.prompt),
    };
    const pool =
      kind === "smalltalk" ? pools.smalltalk
      : kind === "open"    ? pools.open
      : pools.ynm;

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

  // Rank with lenient cutoff
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
