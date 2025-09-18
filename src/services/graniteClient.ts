// services/graniteClient.ts
// Browser helper for fetching ranked suggestions from your Granite API route.

import type { GenParams } from './graniteHelper';        // adjust path if your files are in /lib
import type { Candidate } from './graniteService';        // type-only import to avoid bundling server code

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
  k?: number;                     // default 6 (ignored by server if perCallInstructions is provided)
  params?: GenParams;
  padTo?: number;                 // pad output texts to N slots (default: no padding)
  signal?: AbortSignal;
  route?: string;                 // default "/api/granite/generate"
  perCallInstructions?: string[]; // NEW: one instruction per generation call
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
    route = '/api/granite/generate',
    signal,
    perCallInstructions,
    padTo,
    profile,
  } = opts;

  // Always ask for at least 3 when k is used (server may ignore if perCallInstructions provided)
  const wantK = Math.max(2, k);

  const body = {
    system,
    context,
    prompt,
    k: wantK,
    params,
    profile,
    ...(perCallInstructions ? { perCallInstructions } : {}), // ← pass through variant instructions
  };

  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    const ct = res.headers.get('content-type') || '';
    try {
      detail = ct.includes('application/json')
        ? JSON.stringify(await res.json())
        : await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      `Granite route error: ${res.status} ${res.statusText}${
        detail ? ` — ${detail.slice(0, 800)}` : ''
      }`
    );
  }

  const data = (await res.json()) as GenerateResponse;
  if (!data || !Array.isArray(data.candidates)) {
    throw new Error('Malformed Granite response');
  }

  // Optional client-side padding to a fixed number of slots
  if (padTo && data.candidates.length < padTo) {
    const missing = padTo - data.candidates.length;
    const blanks: Candidate[] = Array.from({ length: missing }, () => ({
      text: '',
      tokens: 0,
      avgLogProb: -1.5,
      relativeProb: 0,
      seed: 0,
      variant: 'alt',
      flow: {
        simToLastUser: 0,
        lengthPenalty: 0,
        repetitionPenalty: 0,
        totalPenalty: 0,
        utility: 0,
        prob: 0,
        weights: { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 },
      },
    }));
    return { ...data, candidates: [...data.candidates, ...blanks] };
  }

  return data;
}
