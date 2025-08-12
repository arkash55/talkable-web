// lib/graniteService.ts
// GraniteService: generate K candidates with logprobs, rank, filter, dedupe.
// Fixes: enforce ≤6 stop sequences, strong-but-safe default stops, finalizeUtterance(),
// and clearer upstream error surfacing.

type GenParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_new_tokens?: number;
  stop?: string[];          // optional
};

export type GenerateRequest = {
  prompt: string;
  context?: string[];       // small, pre-trimmed snippets
  system?: string;          // style/guardrail instructions
  k?: number;               // target count (default 6)
  params?: GenParams;
};

export type Candidate = {
  text: string;
  tokens: number;
  avgLogProb: number;       // higher (closer to 0) = better
  relativeProb: number;     // softmax over candidates (0..1)
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

// ---- token cache ----
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

// ---- stops & helpers ----
// Use at most 6 stops (watsonx limit). Keep them generic to catch section starts.
const DEFAULT_STOPS: string[] = [
  "\nAssistant:",
  "\nUser:",
  "\n[",     // catches [SYSTEM], [USER], [CONTEXT], etc.
  "\n---",
  "```",
  "\n#"
];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Merge user-provided stops with defaults, enforce ≤6, preserve user priority. */
function buildStops(userStops?: string[]): string[] {
  const merged = uniq([...(userStops || []), ...DEFAULT_STOPS]);
  return merged.slice(0, 6); // hard cap
}

// ---- input composition ----
function composeInput(system: string | undefined, context: string[] | undefined, prompt: string): string {
  const parts: string[] = [];
  const hardRule =
    "Reply with ONLY the final message as plain text. No labels or brackets. Avoid repetition. Keep grammar natural. Do not claim a name or persona.";

  const sys = [system?.trim(), hardRule].filter(Boolean).join("\n\n");
  if (sys) parts.push(`[SYSTEM]\n${sys}`);

  if (context?.length) {
    parts.push(`[CONTEXT]\n${context.map((c) => c.trim()).filter(Boolean).join("\n---\n")}`);
  }

  parts.push(`[USER]\n${prompt.trim()}`);

  // Clear place where the model should begin the reply.
  return parts.join("\n\n") + "\n\nAssistant: ";
}

// ---- text cleanup: drop tags/brackets, finish sentences, tidy punctuation ----
function finalizeUtterance(text: string): string {
  let t = (text || "")
    .replace(/^\s*(?:\[.*?\]\s*)+/g, "")    // drop leading [TAGS]
    .replace(/^(Assistant|System|User):\s*/i, "")
    .replace(/^[“"'\-•>*\s¿¡?]+/, "")       // drop stray openers (quotes, bullets, '?', etc.)
    .replace(/\s+([,.!?;:])/g, "$1")        // tidy spaces before punctuation
    .replace(/\s{2,}/g, " ")
    .trim();

  // Remove simple persona claims like "I'm John." at the start (best-effort)
  t = t.replace(/^i['’]m\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?[.!]?\s*/i, "").trim();

  // If there’s an unmatched opening bracket/quote at the end, cut it off.
  const lastOpen = Math.max(
    t.lastIndexOf("["),
    t.lastIndexOf("("),
    t.lastIndexOf("{"),
    t.lastIndexOf("“"),
    t.lastIndexOf('"'),
    t.lastIndexOf("'")
  );
  const lastClose = Math.max(
    t.lastIndexOf("]"),
    t.lastIndexOf(")"),
    t.lastIndexOf("}"),
    t.lastIndexOf("”"),
    t.lastIndexOf('"'),
    t.lastIndexOf("'")
  );
  if (lastOpen > lastClose) t = t.slice(0, lastOpen).trim();

  // Trim to the last full sentence end if present.
  const lastEnd = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf("?"));
  if (lastEnd > -1) t = t.slice(0, lastEnd + 1).trim();

  // If still no terminal punctuation, add a period for a clean finish.
  if (t && !/[.!?…]$/.test(t)) t += ".";

  // De-duplicate exact repeated sentences.
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

  // Capitalize first letter for a human feel.
  if (t && /^[a-z]/.test(t)) t = t[0].toUpperCase() + t.slice(1);

  return t;
}

// ---- call watsonx.ai text generation ----
type RawGenResult = {
  results?: Array<{
    generated_text?: string;
    generated_tokens?: Array<{ logprob?: number }>;
    tokens?: Array<{ logprob?: number }>; // some versions use 'tokens'
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
      return_options: {
        token_logprobs: true,
        token_ranks: true,
        top_n_tokens: 0,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Generation error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as RawGenResult;

  const r = data?.results?.[0];
  const text = r?.generated_text?.trim() || "";

  const tokensArr =
    (r as any)?.generated_tokens ??
    (r as any)?.tokens ??
    [];

  const estimateTokenCount = (s: string) => {
    const words = s.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words * 1.3));
  };

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

// ---- utilities: softmax, similarity, dedupe ----
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

function dedupe(texts: string[], threshold = 0.9): number[] {
  const keep: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || t.length < 2) continue;
    let dup = false;
    for (const ki of keep) {
      if (jaccardSimilarity(texts[ki], t) >= threshold) {
        dup = true;
        break;
      }
    }
    if (!dup) keep.push(i);
  }
  return keep;
}

// ---- main service ----
export async function generateRankedCandidates(req: GenerateRequest): Promise<GenerateResponse> {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error("Missing IBM_API_KEY, IBM_WATSON_ENDPOINT, or IBM_PROJECT_ID");
  }

  const k = Math.max(1, Math.min(req.k ?? 6, 8));

  // Defaults tuned for short, human-like replies.
  const defaults: Required<GenParams> = {
    temperature: 0.5,
    top_p: 0.9,
    top_k: 50,
    max_new_tokens: 48,    // headroom; we'll finish sentences in finalizeUtterance()
    stop: [],              // merged and capped below
  };

  const userParams = { ...(req.params || {}) };
  const mergedStops = buildStops(userParams.stop);

  const baseParams: Required<GenParams> = {
    ...defaults,
    ...userParams,
    stop: mergedStops,
  };

  const primaryParams: Required<GenParams> = { ...baseParams, temperature: Math.min(baseParams.temperature, 0.2) };
  const altParams:     Required<GenParams> = { ...baseParams };

  const token = await getIamToken();
  const input = composeInput(req.system || "", req.context || [], req.prompt);

  const seeds: number[] = [101, ...Array.from({ length: k - 1 }, (_, i) => 1000 + i)];

  const resultsRaw = await Promise.allSettled(
    seeds.map((seed, idx) =>
      generateOnce(token, input, seed, idx === 0 ? primaryParams : altParams).then((r) => {
        const variant: "primary" | "alt" = idx === 0 ? "primary" : "alt";
        return { ...r, seed, variant };
      })
    )
  );

  const results: Array<
    | { text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary" | "alt" }
    | { error: string; seed: number }
  > = resultsRaw.map((pr, idx) =>
    pr.status === "fulfilled"
      ? pr.value
      : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: seeds[idx] }
  );

  const errors = results.filter((x: any) => (x as any).error) as Array<{ error: string; seed: number }>;
  const ok = results
    .map((r, idx) => ({ r, idx }))
    .filter((x): x is { r: Exclude<typeof results[number], { error: string }>; idx: number } => !(x.r as any).error);

  if (!ok.length) {
    const firstErr = errors[0]?.error || "Unknown";
    throw new Error(`All generations failed: ${firstErr}`);
  }

  // Post-process BEFORE filtering/dedupe so fragments don't skew similarity
  const processed = ok.map(({ r, idx }) => ({
    r: { ...r, text: finalizeUtterance(r.text) },
    idx
  }));

  const MIN_TOKENS = 3;
  const MIN_WORDS = 2;

  const clean = processed.filter(({ r }) => {
    if (!r.text) return false;
    const words = r.text.split(/\s+/).filter(Boolean).length;
    return r.tokens >= MIN_TOKENS || words >= MIN_WORDS;
  });

  if (!clean.length) {
    const firstErr = errors[0]?.error || "no non-empty results";
    throw new Error(`All generations failed: ${firstErr}`);
  }

  const texts = clean.map(({ r }) => r.text);
  const keepIdxs = dedupe(texts, 0.85);
  const kept = keepIdxs.map((i) => clean[i]);

  const avgLogs = kept.map(({ r }) => r.avgLogProb);
  const tokenCounts = kept.map(({ r }) => r.tokens);
  const medianTokens = tokenCounts.slice().sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] || 50;
  const rel = softmaxFromAvgLogProbs(avgLogs, medianTokens);

  const NEGLIGIBLE = 0.02;
  let filtered = kept
    .map((item, i) => ({ ...item, relativeProb: rel[i] }))
    .filter((x) => x.relativeProb >= NEGLIGIBLE);

  if (filtered.length < Math.min(3, kept.length)) {
    filtered = kept
      .map((item, i) => ({ ...item, relativeProb: rel[i] }))
      .sort((a, b) => b.relativeProb - a.relativeProb)
      .slice(0, Math.min(3, kept.length));
  }

  filtered.sort((a, b) => b.relativeProb - a.relativeProb);
  const final = filtered.slice(0, 6);

  const candidates: Candidate[] = final.map(({ r, relativeProb }) => ({
    text: r.text,
    tokens: r.tokens,
    avgLogProb: r.avgLogProb,
    relativeProb,
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
