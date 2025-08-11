// services/graniteClient.ts
// Browser-side helper for fetching ranked suggestions from your Granite API route.
// Usage: const texts = await getSuggestions("user prompt");

type GenParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_new_tokens?: number;
  stop?: string[];
};

export type Candidate = {
  text: string;
  tokens: number;
  avgLogProb: number;     // closer to 0 = more likely
  relativeProb: number;   // 0..1, softmax across candidates
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

export type SuggestionOptions = {
  system?: string;
  context?: string[];
  k?: number;                 // default 6
  params?: GenParams;         // decoding knobs
  padTo?: number;             // pad output texts to N slots (default 6)
  signal?: AbortSignal;       // optional abort
  route?: string;             // override route path (default "/api/granite/generate")
};

/**
 * Fetch full ranked candidates (texts + scores) from the Granite route.
 * Prefer this if you want probabilities/confidence bars in the UI.
 */
export async function getCandidates(
  prompt: string,
  opts: SuggestionOptions = {}
): Promise<GenerateResponse> {
  const {
    system = "You are Talkable. Reply in one short, polite sentence.",
    context = [],
    k = 6,
    // sensible defaults for AAC-style short replies
    params = { temperature: 0.5, top_p: 0.9, top_k: 50, max_new_tokens: 35, stop: ["\n\n"] },
    route = "/api/granite/generate",
    signal,
  } = opts;

  const res = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, context, prompt, k, params }),
    signal,
  });

  // Handle non-2xx with a readable error
  if (!res.ok) {
    let msg = `Granite route error: ${res.status}`;
    try {
      const maybe = await res.json();
      if (maybe?.error) msg = maybe.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as GenerateResponse;
  // Basic sanity: ensure candidates is an array
  if (!data || !Array.isArray(data.candidates)) {
    throw new Error("Malformed Granite response");
  }
  return data;
}

/**
 * Fetch just the suggestion texts (ranked), padded to a fixed grid size.
 * This is the drop-in replacement for your old `getIBMResponses`.
 */
export async function getSuggestions(
  prompt: string,
  opts: SuggestionOptions = {}
): Promise<string[]> {
  const { padTo = 6 } = opts;
  const data = await getCandidates(prompt, opts);
  const texts = data.candidates.map((c) => (c.text || "").trim());
  // Pad to fixed length so your grid stays stable
  while (texts.length < padTo) texts.push("");
  return texts.slice(0, padTo);
}

/**
 * Temporary alias to avoid breaking existing imports.
 * You can delete this once you've updated callers to `getSuggestions`.
 */
export { getSuggestions as getIBMResponses };
