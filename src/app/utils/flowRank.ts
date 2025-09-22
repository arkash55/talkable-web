



export type FlowWeights = {
  
  a: number;
  
  b: number;
  
  g: number;
  
  tau: number;
};

export type FlowSignalsInput = {
  text: string;
  
  meanLogProb: number;
};

export type FlowSignalsOutput = {
  
  text: string;
  meanLogProb: number;

  
  simToLastUser: number;       
  lengthPenalty: number;       
  repetitionPenalty: number;   
  totalPenalty: number;        
  flowUtility: number;         
  flowProb: number;            
};

export type FlowRankOptions = {
  
  lastUser: string;

  
  getEmbedding?: (s: string) => Promise<number[]>;

  
  weights?: Partial<FlowWeights>;

  
  penaltyFn?: (text: string) => { lengthPenalty: number; repetitionPenalty: number };
};


const DEFAULT_WEIGHTS: FlowWeights = { a: 1.0, b: 0.8, g: 0.2, tau: 0.9 };

function softmax(vals: number[], tau = 1.0): number[] {
  const m = Math.max(...vals);
  const exps = vals.map(v => Math.exp((v - m) / tau));
  const Z = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => e / Z);
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function jaccardTokens(a: string, b: string): number {
  const tok = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  const A = new Set(tok(a));
  const B = new Set(tok(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function defaultPenalty(text: string) {
  const len = text.length;
  const lengthPenalty = Math.max(0, len - 400) / 400; 
  
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let rep = 0;
  if (words.length >= 6) {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < words.length - 1; i++) {
      const k = `${words[i]} ${words[i + 1]}`;
      bigrams.set(k, (bigrams.get(k) || 0) + 1);
    }
    const repeats = Array.from(bigrams.values()).filter(v => v > 1).reduce((a, b) => a + (b - 1), 0);
    rep = repeats / Math.max(1, words.length - 1);
  }
  const repetitionPenalty = rep;
  return { lengthPenalty, repetitionPenalty };
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }


export async function scoreFlowLevel1(
  inputs: FlowSignalsInput[],
  opts: FlowRankOptions
): Promise<FlowSignalsOutput[]> {
  const w: FlowWeights = { ...DEFAULT_WEIGHTS, ...(opts?.weights || {}) };
  const last = opts.lastUser || "";

  
  let sims: number[] = [];
  if (opts.getEmbedding) {
    
    try {
      const [lastEmb, candEmbs] = await Promise.all([
        opts.getEmbedding(last),
        Promise.all(inputs.map(c => opts.getEmbedding!(c.text)))
      ]);
      sims = candEmbs.map(e => (cosine(e, lastEmb) + 1) / 2); 
    } catch {
      sims = inputs.map(c => jaccardTokens(c.text, last)); 
    }
  } else {
    sims = inputs.map(c => jaccardTokens(c.text, last)); 
  }

  
  const rows = inputs.map((c, i) => {
    const pen = opts.penaltyFn ? opts.penaltyFn(c.text) : defaultPenalty(c.text);
    const totalPenalty = pen.lengthPenalty + pen.repetitionPenalty;
    const sim01 = clamp01(sims[i]);
    const flowUtility = w.a * c.meanLogProb + w.b * sim01 - w.g * totalPenalty;
    return {
      text: c.text,
      meanLogProb: c.meanLogProb,
      simToLastUser: sim01,
      lengthPenalty: pen.lengthPenalty,
      repetitionPenalty: pen.repetitionPenalty,
      totalPenalty,
      flowUtility,
      flowProb: 0, 
    };
  });

  
  const probs = softmax(rows.map(r => r.flowUtility), w.tau);
  rows.forEach((r, i) => (r.flowProb = probs[i]));
  return rows;
}
