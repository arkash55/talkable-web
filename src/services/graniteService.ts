// lib/graniteService.ts
// Ranked candidates with: stance enforcement, ≥3 outputs guaranteed,
// YES/NO/MAYBE for polar/offer prompts, stronger variety, and cleanup.

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
  k?: number;               // target count (default 6, max 8)
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

const API_KEY = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID = process.env.IBM_MODEL_ID || "ibm/granite-3-8b-instruct";
const BASE_URL = (process.env.IBM_WATSON_ENDPOINT || "").replace(/\/+$/, "");

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

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
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

// very simple activity extraction for offers like “do you want to X”, “would you like to X”
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
  const hardRule = [
    "Reply with ONLY the final message as plain text (no labels or brackets).",
    "Sound like a real person speaking in first person.",
    "Do not start with filler like “Thanks for asking,” “Well,” or “Honestly,”.",
    "Start with a letter (not punctuation).",
    "Avoid repetition. Keep grammar natural. Do not claim a name or persona.",
    "If a [STANCE] section is present, you MUST follow it.",
  ].join(" ");

  const sys = [system?.trim(), hardRule].filter(Boolean).join("\n\n");
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
    const key = words.slice(0, 2).join(" ");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(i);
  }
  return keep.length ? keep : texts.map((_, i) => i);
}

function dedupe(texts: string[], threshold = 0.75): number[] {
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

/** idx 0 conservative, others increasingly exploratory. */
function paramsForIndex(idx: number, base: Required<GenParams>): Required<GenParams> {
  if (idx === 0) {
    return {
      ...base,
      temperature: Math.min(base.temperature, 0.25),
      top_p: Math.min(base.top_p, 0.9),
      top_k: Math.min(base.top_k, 40),
    };
  }
  const t = clamp(0.7 + idx * 0.06, 0.7, 1.0);
  const tp = clamp(0.9 + idx * 0.02, 0.9, 0.99);
  const tk = clamp(60 + idx * 12, 60, 160);
  return { ...base, temperature: t, top_p: tp, top_k: tk };
}

// ---------- stance enforcement (post-process) ----------
function matchesYes(t: string) {
  return /\b(yes|sure|definitely|let'?s|sounds good|i'?m in)\b/i.test(t);
}
function matchesNo(t: string) {
  return /\b(no|can['’]t|cannot|won['’]t|rather not|unfortunately|sorry,? i can['’]?t)\b/i.test(t);
}
function matchesMaybe(t: string) {
  return /\b(maybe|perhaps|could|another time|later|not sure)\b/i.test(t);
}

function enforceStanceText(stance: Stance, prompt: string, current: string): string {
  if (!stance) return current;
  const t = current.trim();

  if (stance === "YES" && matchesYes(t)) return t;
  if (stance === "NO" && matchesNo(t)) return t;
  if (stance === "MAYBE" && matchesMaybe(t)) return t;

  const activity = extractActivity(prompt);
  const a = activity ? activity.replace(/^to\s+/i, "") : null;

  if (stance === "YES") {
    return a ? `Yes, let’s ${a}.` : "Yes, let’s do it.";
  }
  if (stance === "NO") {
    return a ? `I can’t ${a} today—sorry.` : "I can’t today—sorry.";
  }
  if (stance === "MAYBE") {
    return a ? `Maybe—how about ${a} a bit later?` : "Maybe—how about a bit later?";
  }
  return t || (a ? `Maybe—how about ${a} another time?` : "Maybe—another time?");
}

// ---------- Y/N/Maybe hard fallbacks ----------
function ynmFallbacks(prompt: string): string[] {
  const a = extractActivity(prompt);
  const act = a ? a.replace(/^to\s+/i, "") : null;
  return [
    act ? `Yes, let’s ${act}.` : "Yes, let’s do it.",
    act ? `I can’t ${act} today—sorry.` : "I can’t today—sorry.",
    act ? `Maybe—how about ${act} a bit later?` : "Maybe—how about a bit later?",
  ];
}

// ---------- main ----------
export async function generateRankedCandidates(req: GenerateRequest): Promise<GenerateResponse> {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error("Missing IBM_API_KEY, IBM_WATSON_ENDPOINT, or IBM_PROJECT_ID");
  }

  const k = Math.max(3, Math.min(req.k ?? 6, 8)); // request at least 3

  const defaults: Required<GenParams> = {
    temperature: 0.5,
    top_p: 0.9,
    top_k: 50,
    max_new_tokens: 48,
    stop: [],
  };

  const userParams = { ...(req.params || {}) };
  const mergedStops = buildStops(userParams.stop);

  const baseParams: Required<GenParams> = {
    ...defaults,
    ...userParams,
    stop: mergedStops,
  };

  const kind = detectPromptKind(req.prompt);
  const plan = stancePlan(k, kind);

  const token = await getIamToken();
  const seeds: number[] = [101, ...Array.from({ length: k - 1 }, (_, i) => 1000 + i)];

  const resultsRaw = await Promise.allSettled(
    seeds.map((seed, idx) => {
      const stance = plan[idx] || "";
      const input = composeInput(req.system || "", req.context || [], req.prompt, stance);
      return generateOnce(token, input, seed, paramsForIndex(idx, baseParams)).then((r) => {
        const variant: "primary" | "alt" = idx === 0 ? "primary" : "alt";
        return { ...r, seed, variant, stance };
      });
    })
  );

  const results = resultsRaw.map((pr, idx) =>
    pr.status === "fulfilled"
      ? pr.value
      : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: seeds[idx], stance: plan[idx] || "" }
  );

  const ok = results.filter((x: any) => !(x as any).error) as Array<{ text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary"|"alt"; stance: Stance }>;

  // If *everything* failed, hard Y/N/Maybe
  if (!ok.length) {
    const fall = ynmFallbacks(req.prompt).map((text, i) => ({
      text,
      tokens: Math.max(3, Math.round(text.split(/\s+/).length * 1.3)),
      avgLogProb: -1.5,
      relativeProb: 1/3,
      seed: 9000 + i,
      variant: i === 0 ? "primary" as const : "alt" as const,
    }));
    return {
      candidates: fall,
      meta: { model_id: MODEL_ID, usedK: k, dropped: 0, params: baseParams },
    };
  }

  // Clean & enforce stance for first three (polar/offer only)
  let processed = ok.map((r) => ({
    ...r,
    text: finalizeUtterance(r.text),
  }));

  if (kind === "polar" || kind === "offer") {
    for (let i = 0; i < Math.min(3, processed.length); i++) {
      const s = plan[i] || "";
      if (s === "YES" || s === "NO" || s === "MAYBE") {
        processed[i].text = finalizeUtterance(enforceStanceText(s, req.prompt, processed[i].text));
      }
    }
  }

  // Filter empties/super short
  const MIN_TOKENS = 3;
  const MIN_WORDS = 2;
  processed = processed.filter(({ text, tokens }) => {
    if (!text) return false;
    const words = text.split(/\s+/).filter(Boolean).length;
    return (tokens ?? 0) >= MIN_TOKENS || words >= MIN_WORDS;
  });

  // If <3 after filtering and it's a polar/offer prompt, top up with Y/N/Maybe
  if ((kind === "polar" || kind === "offer") && processed.length < 3) {
    const need = 3 - processed.length;
    const adds = ynmFallbacks(req.prompt).slice(0, need).map((text, i) => ({
      text,
      tokens: Math.max(3, Math.round(text.split(/\s+/).length * 1.3)),
      avgLogProb: -1.5,
      seed: 9900 + i,
      variant: "alt" as const,
      stance: "" as Stance,
    }));
    processed = processed.concat(adds);
  }

  // Variety: dedupe + distinct starts
  const texts0 = processed.map((r) => r.text);
  const keepA = dedupe(texts0, 0.75);
  let kept = keepA.map((i) => processed[i]);

  const texts1 = kept.map((r) => r.text);
  const keepB = enforceDistinctStarts(texts1);
  kept = keepB.map((i) => kept[i]);

  // Rank
  const avgLogs = kept.map((r) => r.avgLogProb);
  const tokenCounts = kept.map((r) => r.tokens);
  const medianTokens = tokenCounts.slice().sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] || 48;
  const rel = softmaxFromAvgLogProbs(avgLogs, medianTokens);

  const NEGLIGIBLE = 0.02;
  let filtered = kept
    .map((r, i) => ({ ...r, relativeProb: rel[i] }))
    .filter((x) => x.relativeProb >= NEGLIGIBLE || kept.length <= 3);

  if (filtered.length < Math.min(3, kept.length)) {
    filtered = kept
      .map((r, i) => ({ ...r, relativeProb: rel[i] }))
      .sort((a, b) => b.relativeProb - a.relativeProb)
      .slice(0, Math.min(3, kept.length));
  }

  filtered.sort((a, b) => b.relativeProb - a.relativeProb);
  const final = filtered.slice(0, 6);

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
      usedK: k,
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
