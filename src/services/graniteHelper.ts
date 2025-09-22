


export type GenParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_new_tokens?: number;
  stop?: string[];
};


export const DEFAULT_STOPS = [
  "\nAssistant:",
  "\nUser:",
  "\n[",
  "\n---",
  "```",
  "\n#",
];

export function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export function buildStops(userStops?: string[]): string[] {
  const merged = uniq([...(userStops || []), ...DEFAULT_STOPS]);
  return merged.slice(0, 6); 
}


export type PromptKind = "polar" | "offer" | "open" | "smalltalk";
export type Stance = "YES" | "NO" | "MAYBE" | "CLARIFY" | "DEFLECT" | "BOUNDARY" | "LATER" | "";

export function isPhatic(p: string) {
  const s = p.trim().toLowerCase();
  const greet = /\b(hi|hey|hello|yo|hiya|sup|good (morning|afternoon|evening))\b/;
  const howare = /(how (are|r) (you|u)|how's it going|hru|how ya doin|how are ya)/;
  return greet.test(s) || howare.test(s);
}

export function detectPromptKind(prompt: string): PromptKind {
  const p = prompt.trim();
  if (isPhatic(p)) return "smalltalk";
  const offerRe = /\b(?:do you want|would you like|are you up for|shall we|how about|join .+ for|up for)\b/i;
  const polarRe = /\b(?:do|did|will|would|can|could|should|are|were|is|was|have|has|had)\b.*\?$/i;
  if (offerRe.test(p)) return "offer";
  if (polarRe.test(p)) return "polar";
  return "open";
}


export function extractActivity(prompt: string): string | null {
  const p = prompt.trim().replace(/\s+/g, " ");
  const m1 = /(?:do you want|would you like|are you up for|shall we|how about)\s+(to\s+)?(.+?)(?:\?|$)/i.exec(p);
  if (m1 && m1[2]) return m1[2].trim().replace(/\.$/, "");
  const m2 = /join (?:me|us)? for (.+?)(?:\?|$)/i.exec(p);
  if (m2 && m2[1]) return m2[1].trim().replace(/\.$/, "");
  return null;
}


export type SentimentPolarity = "POS" | "NEU" | "NEG";
export type SentimentIntensity = "SUPER" | "PLAIN" | "SLIGHT";
export type SentimentMode = { pol: SentimentPolarity; int: SentimentIntensity; tag: string };

export const ALL_SENTIMENTS: SentimentMode[] = [
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


export function sentimentPlan(): SentimentMode[] {
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

  const seed: SentimentMode[] = [pick(pos, 1)[0], pick(neu, 1)[0], pick(neg, 1)[0]];
  const used = new Set(seed.map(s => s.tag));
  const remaining = ALL_SENTIMENTS.filter(s => !used.has(s.tag));

  const haveInt = new Set(seed.map(s => `${s.pol}:${s.int}`));
  const prioritized = [
    ...remaining.filter(s => !haveInt.has(`${s.pol}:${s.int}`)),
    ...remaining.filter(s => haveInt.has(`${s.pol}:${s.int}`)),
  ];

  for (let i = prioritized.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [prioritized[i], prioritized[j]] = [prioritized[j], prioritized[i]];
  }

  const out: SentimentMode[] = [...seed];
  for (const m of prioritized) {
    if (out.length >= 6) break;
    if (!out.some(x => x.tag === m.tag)) out.push(m);
  }

  const seen = new Set<string>();
  return out.filter(m => (seen.has(m.tag) ? false : (seen.add(m.tag), true))).slice(0, 6);
}


export const STANCE_HINT: Record<Exclude<Stance, "">, string> = {
  YES: "Take a YES stance. Accept clearly and positively.",
  NO: "Take a NO stance. Decline politely with a brief reason or alternative.",
  MAYBE: "Take a MAYBE stance. Suggest a different time or condition.",
  CLARIFY: "Ask one brief clarifying question to decide.",
  DEFLECT: "Deflect politely and propose a nearby option.",
  BOUNDARY: "Accept in spirit but set a clear boundary (time/energy/budget).",
  LATER: "Acknowledge and propose doing it later with a concrete window.",
};

export function sentimentGuidance(mode: SentimentMode): string {
  const { pol, int } = mode;
  const core =
    pol === "POS" ? "Positive tone."
    : pol === "NEG" ? "Negative tone."
    : "Neutral tone.";
  const shading =
    int === "SUPER"  ? (pol === "POS" ? "Very enthusiastic, upbeat." : pol === "NEG" ? "Strongly negative; firm." : "Warm neutral; friendly.")
    : int === "PLAIN" ? (pol === "POS" ? "Clearly positive." : pol === "NEG" ? "Clearly negative." : "Even, matter-of-fact.")
    :      (pol === "POS" ? "Slightly positive." : pol === "NEG" ? "Slightly negative." : "Terse neutral.");
  return `${core} ${shading} 1–2 sentences, natural, concise. No emoji or role labels.`;
}

export function composeInput(
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

  parts.push(`[SENTIMENT]\n${mode.tag}\n\n[GUIDANCE]\n${sentimentGuidance(mode)}`);

  if (kind === "smalltalk") {
    parts.push(`[STYLE]\nCasual, warm, 1–2 sentences. Use contractions. It’s okay to add a brief “How about you?”`);
  } else if (stance && STANCE_HINT[stance as Exclude<Stance, "">]) {
    parts.push(`[STANCE]\n${stance}\n\n[GUIDANCE]\n${STANCE_HINT[stance as Exclude<Stance, "">]}`);
  }

  parts.push(`[USER]\n${prompt.trim()}`);
  return parts.join("\n\n") + "\n\nAssistant: ";
}


const GENERIC_OPENERS = [
  /^thanks for (the )?asking[,!.\s-]*/i,
  /^it['’]s been (a )?(busy|hectic) day[,!.\s-]*/i,
  /^just (trying|trying to) (to )?keep up[,!.\s-]*/i,
  /^honestly[,!.\s-]*/i,
  /^well[,!.\s-]*/i,
  /^sure[,!.\s-]*/i,
];

export function dropGenericOpeners(t: string): string {
  let out = t;
  for (const re of GENERIC_OPENERS) out = out.replace(re, "").trim();
  return out;
}

export function ensureBounceBackForSmalltalk(reply: string): string {
  const r = reply.trim();
  const hasQuestion = /(\?|how (about|are) you|what about you)/i.test(r);
  if (hasQuestion) return r;
  return r.endsWith(".") ? r + " How about you?" : r + " — how about you?";
}

export function finalizeUtterance(text: string, kind?: PromptKind): string {
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


export function enforceSentimentText(mode: SentimentMode, t: string): string {
  const s = t.trim();

  const POS_WORDS = ["great", "glad", "happy", "awesome", "sounds good", "love", "nice"];
  const NEG_WORDS = ["can’t", "won’t", "don’t", "unfortunately", "rather not", "not ideal"];
  const NEU_WORDS = ["noted", "okay", "sure", "alright"];

  const has = (arr: string[]) => arr.some(w => new RegExp(`\\b${w}\\b`, "i").test(s));

  if (mode.pol === "POS" && !has(POS_WORDS)) return s.replace(/\.$/, "") + ". Sounds good.";
  if (mode.pol === "NEG" && !has(NEG_WORDS)) return s.replace(/\.$/, "") + ". I’d rather not.";
  if (mode.pol === "NEU" && !has([...NEU_WORDS, ...POS_WORDS, ...NEG_WORDS])) return s.replace(/\.$/, "") + ". Okay.";

  if (mode.int === "SUPER" && mode.pol === "POS" && !/!\s*$/.test(s)) return s.replace(/\.$/, "!");
  if (mode.int === "SUPER" && mode.pol === "NEG") return s;
  if (mode.int === "SLIGHT" && mode.pol !== "NEU") return s.replace(/\b(definitely|absolutely|never|always)\b/gi, "maybe");
  return s;
}


type RawGenResult = {
  results?: Array<{
    generated_text?: string;
    generated_tokens?: Array<{ logprob?: number }>;
    tokens?: Array<{ logprob?: number }>;
  }>;
};

export async function getIamToken(apiKey: string): Promise<string> {
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });
  if (!res.ok) throw new Error(`IAM token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const ttlMs = (Number(json.expires_in) || 3600) * 1000;
  return json.access_token as string;
}

export async function generateOnce(args: {
  token: string;
  input: string;
  seed: number;
  params: Required<GenParams>;
  baseUrl: string;
  modelId: string;
  projectId: string;
}): Promise<{ text: string; tokens: number; avgLogProb: number }> {
  const { token, input, seed, params, baseUrl, modelId, projectId } = args;

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/ml/v1/text/generation?version=2024-08-01`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_id: modelId,
      project_id: projectId,
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


export function softmaxFromAvgLogProbs(avgLogs: number[], refLength: number): number[] {
  const scores = avgLogs.map((l) => (Number.isFinite(l) ? l * refLength : -1e9));
  const maxS = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maxS));
  const denom = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / denom);
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(a.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  const B = new Set(b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

export function enforceDistinctStarts(texts: string[]): number[] {
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

export function dedupe(texts: string[], threshold = 0.85): number[] {
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

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function pickTargetCount(k?: number) {
  if (typeof k === "number") return clamp(Math.round(k), 3, 6);
  const p = Math.random();
  if (p < 0.55) return 5 + (Math.random() < 0.5 ? 0 : 1);
  return 3 + (Math.random() < 0.5 ? 0 : 1);
}


export function paramsForIndex(idx: number, base: Required<GenParams>): Required<GenParams> {
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


export function matchesYes(t: string)   { return /\b(yes|sure|definitely|let'?s|sounds good|i'?m in)\b/i.test(t); }
export function matchesNo(t: string)    { return /\b(no|can['’]t|cannot|won['’]t|rather not|unfortunately|sorry,? i can['’]?t)\b/i.test(t); }
export function matchesMaybe(t: string) { return /\b(maybe|perhaps|could|another time|later|not sure)\b/i.test(t); }

export function enforceStanceText(stance: Stance, prompt: string, current: string): string {
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


export function ynmFallbacks(prompt: string): string[] {
  const a = extractActivity(prompt);
  const act = a ? a.replace(/^to\s+/i, "") : null;
  return [
    act ? `Yes, let’s ${act}.`               : "Yes, let’s do it.",
    act ? `I can’t ${act} today—sorry.`      : "I can’t today—sorry.",
    act ? `Maybe—how about ${act} later?`    : "Maybe—how about a bit later?",
  ];
}

export function openFallbacks(): string[] {
  return [
    "Could you tell me a bit more?",
    "Got it—what would you like me to focus on?",
    "I’m not sure I follow—can you clarify?",
  ];
}

export function smalltalkFallbacks(): string[] {
  return [
    "Hey! I’m good—how are you?",
    "Doing well, thanks for asking. How’s your day going?",
    "Pretty good over here. What’s up?",
    "I’m doing alright! How about you?",
    "Not bad at all—how are you doing?",
  ];
}
