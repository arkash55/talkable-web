// services/graniteClient.ts
// Browser helper for fetching ranked suggestions from your Granite API route.

import { GenParams } from "./graniteHelper";
import { Candidate } from "./graniteService";




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
  system: string,
  context: string[],
  opts: SuggestionOptions = {}
): Promise<GenerateResponse> {
  const {
    k = 6,
    params = { temperature: 0.5, top_p: 0.9, top_k: 50, max_new_tokens: 50 },
    route = "/api/granite/generate",
    signal,
  } = opts;

  // Always ask for at least 3
  const wantK = Math.max(2, k);

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





