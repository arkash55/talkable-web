// lib/graniteService.ts
// GraniteService: generate K candidates with logprobs, rank, filter, dedupe.

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

// ---- input composition ----
function composeInput(system: string | undefined, context: string[] | undefined, prompt: string): string {
  const parts: string[] = [];
  if (system?.trim()) parts.push(`[SYSTEM]\n${system.trim()}`);
  if (context?.length) {
    parts.push(`[CONTEXT]\n${context.map((c) => c.trim()).filter(Boolean).join("\n---\n")}`);
  }
  parts.push(`[USER]\n${prompt.trim()}`);
  return parts.join("\n\n");
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
      // ask for token-level info for ranking (field names vary by version; we handle both)
      return_options: {
        token_logprobs: true,
        token_ranks: true,
        top_n_tokens: 0,
      },
    }),
  });

  if (!res.ok) throw new Error(`Generation error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as RawGenResult;

const r = data?.results?.[0];
const text = r?.generated_text?.trim() || "";

// tokens array may be absent depending on model/plan
const tokensArr =
  (r as any)?.generated_tokens ??
  (r as any)?.tokens ??
  [];

// Fallback: estimate tokens from text if we didn’t get token-level info
const estimateTokenCount = (s: string) => {
  const words = s.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3)); // rough word→token factor
};

let tokensCount = Array.isArray(tokensArr) && tokensArr.length ? tokensArr.length : estimateTokenCount(text);

// compute average token log-prob over generated tokens, or fallback
let avgLogProb: number;
if (Array.isArray(tokensArr) && tokensArr.length) {
  const sum = tokensArr.reduce((s, t) => s + (typeof t.logprob === "number" ? t.logprob : 0), 0);
  avgLogProb = sum / tokensArr.length;
} else {
  // neutral-ish fallback so softmax won’t zero out everything
  avgLogProb = -1.5;
}

return { text, tokens: tokensCount, avgLogProb };
}

// ---- utilities: softmax, similarity, dedupe ----
function softmaxFromAvgLogProbs(avgLogs: number[], refLength: number): number[] {
  // convert avg log-probs to comparable scores by scaling to a reference length
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
  // returns indices to keep
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
  const defaults: Required<GenParams> = {
    temperature: 0.5,
    top_p: 0.9,
    top_k: 50,
    max_new_tokens: 50,
    stop: [],
  };
  const params: Required<GenParams> = { ...defaults, ...(req.params || {}) };

  // primary = lower temperature (more deterministic)
  const primaryParams: Required<GenParams> = { ...params, temperature: Math.min(params.temperature, 0.2) };

  const token = await getIamToken();
  const input = composeInput(req.system, req.context, req.prompt);

  // seeds: 1 primary + (k-1) alternatives
  const seeds: number[] = [101, ...Array.from({ length: k - 1 }, (_, i) => 1000 + i)];

  // fire requests in parallel (k is small; allSettled is fine)
  const resultsRaw = await Promise.allSettled(
    seeds.map((seed, idx) =>
        generateOnce(token, input, seed, idx === 0 ? primaryParams : params).then((r) => {
        const variant: "primary" | "alt" = idx === 0 ? "primary" : "alt";
        return { ...r, seed, variant };
        })
  )
  );

  // normalize results: successes or { error, seed }
  const results: Array<
    | { text: string; tokens: number; avgLogProb: number; seed: number; variant: "primary" | "alt" }
    | { error: string; seed: number }
  > = resultsRaw.map((pr, idx) =>
    pr.status === "fulfilled"
      ? pr.value
      : { error: String((pr as any).reason?.message || (pr as any).reason || "Generation failed"), seed: seeds[idx] }
  );

  // filter successful
  const ok = results
    .map((r, idx) => ({ r, idx }))
    .filter((x): x is { r: Exclude<typeof results[number], { error: string }>; idx: number } => !(x.r as any).error);

  if (!ok.length) {
    throw new Error("All generations failed");
  }

  // drop empties / fragments
const MIN_TOKENS = 5;
const MIN_WORDS = 3;

const clean = ok.filter(({ r }) => {
  if (!r.text) return false;
  const words = r.text.split(/\s+/).filter(Boolean).length;
  return r.tokens >= MIN_TOKENS || words >= MIN_WORDS;
});

if (!clean.length) {
  throw new Error("No useful generations (all empty or too short)");
}

  // dedupe near-duplicates
  const texts = clean.map(({ r }) => r.text);
  const keepIdxs = dedupe(texts, 0.9);
  const kept = keepIdxs.map((i) => clean[i]);

  // compute relative probs (length-neutral)
  const avgLogs = kept.map(({ r }) => r.avgLogProb);
  const tokenCounts = kept.map(({ r }) => r.tokens);
  const medianTokens = tokenCounts.slice().sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] || 50;
  const rel = softmaxFromAvgLogProbs(avgLogs, medianTokens);

  // threshold negligible (<2%), but keep at least 3 if possible
  const NEGLIGIBLE = 0.02;
  let filtered = kept
    .map((item, i) => ({ ...item, relativeProb: rel[i] }))
    .filter((x) => x.relativeProb >= NEGLIGIBLE);

  if (filtered.length < Math.min(3, kept.length)) {
    // ensure minimum viable list
    filtered = kept
      .map((item, i) => ({ ...item, relativeProb: rel[i] }))
      .sort((a, b) => b.relativeProb - a.relativeProb)
      .slice(0, Math.min(3, kept.length));
  }

  // sort best → worst and cap to 6
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
        temperature: params.temperature,
        top_p: params.top_p,
        top_k: params.top_k,
        max_new_tokens: params.max_new_tokens,
        stop: params.stop,
      },
    },
  };
}
