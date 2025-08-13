// services/graniteClient.ts
// Browser helper for fetching ranked suggestions from your Granite API route.

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
  avgLogProb: number;
  relativeProb: number;
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
  params?: GenParams;
  padTo?: number;             // pad output texts to N slots (default 6)
  signal?: AbortSignal;
  route?: string;             // default "/api/granite/generate"
};

export async function getCandidates(
  prompt: string,
  opts: SuggestionOptions = {}
): Promise<GenerateResponse> {
  const {
    system = "You are Talkable. Reply in one short, natural sentence.",
    context = [],
    k = 6,
    params = { temperature: 0.5, top_p: 0.9, top_k: 50, max_new_tokens: 50 },
    route = "/api/granite/generate",
    signal,
  } = opts;

  // Always ask for at least 3
  const wantK = Math.max(3, k);

  const res = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, context, prompt, k: wantK, params }),
    signal,
  });

  if (!res.ok) {
    let body = "";
    const ct = res.headers.get("content-type") || "";
    try {
      body = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
    } catch {}
    throw new Error(`Granite route error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 800)}` : ""}`);
  }

  const data = (await res.json()) as GenerateResponse;
  if (!data || !Array.isArray(data.candidates)) {
    throw new Error("Malformed Granite response");
  }
  return data;
}

export async function getSuggestions(
  prompt: string,
  opts: SuggestionOptions = {}
): Promise<string[]> {
  const { padTo = 6 } = opts;
  const data = await getCandidates(prompt, opts);
  const texts = data.candidates.map((c) => (c.text || "").trim());
  while (texts.length < padTo) texts.push("");
  return texts.slice(0, padTo);
}

// Temporary alias (remove once you’ve migrated)
export { getSuggestions as getIBMResponses };
