// src/services/graniteTrendingService.ts
import 'server-only';

import { assertIBMEnv, BASE_URL, MODEL_ID, PROJECT_ID, getIamToken } from '@/services/ibmClient';

export type TrendingTopic = {
  id: string;
  title: string;
  description: string;
  starter: string;
  tag: 'sports' | 'news' | 'politics' | 'trend';
};

const DEBUG = process.env.DEBUG_TRENDING === '1';

// Keep output compact to avoid truncation; model budget is generous but tight JSON helps.
const NUM_TOPICS = 6;
const CURR_YEAR = new Date().getFullYear();

const SYSTEM = `You produce a short JSON list of high-signal conversation topics from the CURRENT YEAR for small talk.
- Include sports, news, politics, and general trends.
- Safe and non-graphic; avoid harmful or NSFW items.
- Each item: id (slug), title, description (<= 18 words), starter (<= 12 words), tag (one of: sports, news, politics, trend).
- Return ONLY JSON. No preamble, no markdown fences.
Schema:
{"topics":[{"id":"string-slug","title":"string","description":"string","starter":"string","tag":"sports|news|politics|trend"}]}`;

function promptBody() {
  return `[SYSTEM]
${SYSTEM}

[USER]
Generate exactly ${NUM_TOPICS} diverse, ${CURR_YEAR}-${CURR_YEAR + 1} conversation topics that won't stale within a few weeks.
Output strictly valid JSON matching the schema.
Do not include any explanations or markdown.`;
}

const ALLOWED_TAGS = new Set(['sports', 'news', 'politics', 'trend']);
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Short-lived “fresh” cache (last success within TTL) and a durable last-good cache.
let freshCache: { ts: number; data: TrendingTopic[]; key: string } | null = null;
let lastGood:   { ts: number; data: TrendingTopic[]; key: string } | null = null;

const toSlug = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function sanitize(raw: any): TrendingTopic[] {
  const arr = Array.isArray(raw?.topics) ? raw.topics : [];
  const seen = new Set<string>();
  const out: TrendingTopic[] = [];
  for (let i = 0; i < arr.length && out.length < 12; i++) {
    const t = arr[i] || {};
    const id = toSlug(String(t.id || t.title || `topic-${i}`));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let tag = String(t.tag || 'trend').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) tag = 'trend';
    out.push({
      id,
      title: String(t.title || 'Topic').slice(0, 80),
      description: String(t.description || '').slice(0, 140),
      starter: String(t.starter || 'Want to chat about this?').replace(/^"|"$/g, '').slice(0, 120),
      tag: tag as TrendingTopic['tag'],
    });
  }
  return out;
}

/* ---------- tolerant parsing helpers ---------- */

function preclean(s: string): string {
  return s
    .replace(/^\uFEFF/, '')      // BOM
    .replace(/```(?:json)?/gi, '```')
    .replace(/^\s*```/m, '')     // leading fence
    .replace(/```[\s\S]*$/m, '') // trailing fence + anything after
    .trim();
}

function parseObjectLenient(objText: string): any {
  try { return JSON.parse(objText); } catch {}
  const relaxed = objText.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(relaxed);
}

function extractBalancedObject(s: string, i: number): { text: string; end: number } | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  const start = i;

  for (let p = i; p < s.length; p++) {
    const ch = s[p];

    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = false; }
      continue;
    }

    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { text: s.slice(start, p + 1), end: p + 1 };
    }
  }
  return null; // truncated mid-object
}

function extractTopicsLenient(raw: string): any[] {
  const src = preclean(String(raw));

  // Strict parse first
  try {
    const j = JSON.parse(src);
    if (Array.isArray(j?.topics)) return j.topics;
  } catch { /* ignore */ }

  // Find the "topics": [ ... ] array
  const m = /"topics"\s*:/.exec(src);
  let idx = -1;
  if (m) {
    const after = m.index + m[0].length;
    const openArr = src.indexOf('[', after);
    if (openArr !== -1) idx = openArr;
  }

  // Or fallback to the first array
  if (idx === -1) idx = src.indexOf('[');
  if (idx === -1) throw new Error('No JSON array found.');

  const arrText = src.slice(idx);
  const items: any[] = [];
  let p = 1; // position after '['

  while (p < arrText.length) {
    while (p < arrText.length && /[\s,]/.test(arrText[p])) p++;
    if (p >= arrText.length) break;

    const ch = arrText[p];
    if (ch === ']') break;

    if (ch === '{') {
      const obj = extractBalancedObject(arrText, p);
      if (!obj) break; // truncated
      try {
        items.push(parseObjectLenient(obj.text));
      } catch (e) {
        if (DEBUG) console.error('[trending] Failed to parse object:', (e as Error).message, obj.text.slice(0, 200));
      }
      p = obj.end;
      continue;
    }

    p++; // skip unexpected char defensively
  }

  return items;
}

/* ---------- helpers: shuffle + pad ---------- */

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CURATED_FILLERS: TrendingTopic[] = [
  { id: 'football-weekend', title: 'Football',      description: 'Fixtures and standout players.', starter: 'Who will stand out this weekend?', tag: 'sports'   },
  { id: 'uk-politics',      title: 'UK Politics',    description: 'Parliament headlines and debates.', starter: 'What’s your take on the latest debate?', tag: 'politics' },
  { id: 'breaking-news',    title: 'News',           description: 'Top stories and why they matter.', starter: 'Have you followed today’s top story?', tag: 'news'    },
  { id: 'tech-trends',      title: 'Tech',           description: 'AI, gadgets, and software updates.', starter: 'What new tech has caught your eye?', tag: 'trend'   },
  { id: 'film-tv',          title: 'Film & TV',      description: 'Series finales and new releases.', starter: 'Seen anything good lately?',          tag: 'trend'   },
  { id: 'weather-chat',     title: 'Weather',        description: 'Heatwaves, storms, and travel plans.', starter: 'How’s the weather your side?',    tag: 'news'    },
  { id: 'fitness-wellbeing',title: 'Wellbeing',      description: 'Sleep, running, and staying active.', starter: 'What helps you unwind?',          tag: 'trend'   },
  { id: 'gaming-releases',  title: 'Gaming',         description: 'Fresh releases and updates.',        starter: 'Tried any new games?',             tag: 'trend'   },
];

function padAndLimit(base: TrendingTopic[], n: number): TrendingTopic[] {
  const used = new Set(base.map(t => t.id));
  const fillers = CURATED_FILLERS.filter(t => !used.has(t.id));
  const merged = [...base, ...fillers].slice(0, n);
  return merged;
}

/* ---------- fetch + retries ---------- */

type GenParamOverrides = Partial<{
  temperature: number;
  top_p: number;
  top_k: number;
  max_new_tokens: number;
}>;

async function fetchFromGranite(overrides?: GenParamOverrides): Promise<TrendingTopic[]> {
  assertIBMEnv();
  const token = await getIamToken();

  const body = {
    model_id: MODEL_ID,
    project_id: PROJECT_ID,
    input: promptBody(),
    parameters: {
      decoding_method: 'sample',
      temperature: overrides?.temperature ?? 0.35,
      top_p:       overrides?.top_p       ?? 0.9,
      top_k:       overrides?.top_k       ?? 50,
      max_new_tokens: overrides?.max_new_tokens ?? 520,
      stop_sequences: ['```', '\nAssistant:', '\nUser:'],
    },
    return_options: { token_logprobs: false, token_ranks: false, top_n_tokens: 0 },
  };

  const res = await fetch(`${BASE_URL}/ml/v1/text/generation?version=2024-08-01`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (DEBUG) console.error('[trending] watsonx HTTP error', res.status, res.statusText, text?.slice(0, 800));
    throw new Error(`Watsonx ${res.status} ${res.statusText} ${text?.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.results?.[0]?.generated_text ?? '';
  if (DEBUG) console.log('[trending] raw (first 400):', String(raw).slice(0, 400));

  const topicItems = extractTopicsLenient(String(raw));
  let topics = sanitize({ topics: topicItems });

  // If the model returned fewer than requested, keep what we have and pad later.
  topics = shuffleInPlace(topics);
  return topics;
}

async function fetchWithRetry(): Promise<TrendingTopic[]> {
  try {
    return await fetchFromGranite(); // attempt 1
  } catch (e) {
    if (DEBUG) console.error('[trending] attempt 1 failed:', (e as Error).message);
  }
  // attempt 2: slightly different sampling / bigger budget
  return await fetchFromGranite({ temperature: 0.3, top_p: 0.92, max_new_tokens: 560 });
}

/** Public: getTrendingTopics. Returns 6 items, uses fresh cache if present, never caches fallback. */
export async function getTrendingTopics(opts?: { force?: boolean; key?: string }): Promise<TrendingTopic[]> {
  const now = Date.now();
  const key = opts?.key || 'default';

  // Serve fresh cache if valid and not forced
  if (!opts?.force && freshCache && freshCache.key === key && now - freshCache.ts < CACHE_TTL_MS) {
    return freshCache.data;
  }

  try {
    let topics = await fetchWithRetry();
    if (topics.length < NUM_TOPICS) {
      topics = padAndLimit(topics, NUM_TOPICS);
    } else {
      topics = topics.slice(0, NUM_TOPICS);
    }

    // Cache only on success
    freshCache = { ts: now, data: topics, key };
    lastGood   = { ts: now, data: topics, key };
    return topics;
  } catch (e: any) {
    if (DEBUG) console.error('[trending] graceful failure:', e?.message || e);

    // If we have a last good set, return it (even if TTL expired).
    if (lastGood && lastGood.key === key) {
      return lastGood.data;
    }

    // As a final resort, return curated fallback — but DO NOT cache it.
    return padAndLimit([], NUM_TOPICS);
  }
}
