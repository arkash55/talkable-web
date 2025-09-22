


import type { GenParams } from './graniteHelper';        
import type { Candidate } from './graniteService';        

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
  k?: number;                     
  params?: GenParams;
  padTo?: number;                 
  signal?: AbortSignal;
  route?: string;                 
  perCallInstructions?: string[]; 
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

  
  const wantK = Math.max(2, k);

  const body = {
    system,
    context,
    prompt,
    k: wantK,
    params,
    profile,
    ...(perCallInstructions ? { perCallInstructions } : {}), 
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
