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

// Keep output compact to avoid truncation; we’ll also raise the token budget.
const NUM_TOPICS = 6;

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
Generate exactly ${NUM_TOPICS} diverse, CURRENT YEAR conversation topics that won't stale within a few weeks.
Output strictly valid JSON matching the schema.
Do not include any explanations or markdown.`;
}

const ALLOWED_TAGS = new Set(['sports', 'news', 'politics', 'trend']);
const CACHE_TTL_MS = 3 * 60 * 1000;

let cache: { ts: number; data: TrendingTopic[]; key: string } | null = null;

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

/** Remove common wrappers/noise. */
function preclean(s: string): string {
  return s
    .replace(/^\uFEFF/, '')      // BOM
    .replace(/```(?:json)?/gi, '```')
    .replace(/^\s*```/m, '')     // leading fence
    .replace(/```[\s\S]*$/m, '') // trailing fence + anything after
    .trim();
}

/** JSON.parse with a simple trailing-comma repair. */
function parseObjectLenient(objText: string): any {
  try { return JSON.parse(objText); } catch {}
  const relaxed = objText.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(relaxed);
}

/** Extracts a balanced JSON object starting at index `i` (where s[i] === '{'). */
function extractBalancedObject(s: string, i: number): { text: string; end: number } | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let start = i;

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
      if (depth === 0) {
        return { text: s.slice(start, p + 1), end: p + 1 };
      }
    }
  }
  return null; // truncated
}

/**
 * Extract topics array leniently even if the JSON is truncated:
 * - Prefer object-with-"topics":[...] form; if found, parse complete objects inside the array.
 * - Otherwise, try top-level array.
 */
function extractTopicsLenient(raw: string): any[] {
  const src = preclean(String(raw));

  // 1) Try strict parse first
  try {
    const j = JSON.parse(src);
    if (Array.isArray(j?.topics)) return j.topics;
  } catch { /* fallthrough */ }

  // 2) Find the "topics": [ ... ] array and incrementally parse objects
  const m = /"topics"\s*:/.exec(src);
  let idx = -1;
  if (m) {
    const after = m.index + m[0].length;
    const openArr = src.indexOf('[', after);
    if (openArr !== -1) idx = openArr;
  }

  // 3) Or fallback to top-level array
  if (idx === -1) {
    idx = src.indexOf('[');
  }

  if (idx === -1) throw new Error('No JSON array found.');

  const arrText = src.slice(idx); // from '[' onward; may be truncated
  const items: any[] = [];
  let p = 1; // position after '[' in arrText

  while (p < arrText.length) {
    // skip whitespace and commas
    while (p < arrText.length && /[\s,]/.test(arrText[p])) p++;

    if (p >= arrText.length) break;
    const ch = arrText[p];

    if (ch === ']') break; // array closed properly

    if (ch === '{') {
      const obj = extractBalancedObject(arrText, p);
      if (!obj) {
        // truncated mid-object; stop here, we keep what we parsed so far
        break;
      }
      try {
        const parsed = parseObjectLenient(obj.text);
        items.push(parsed);
      } catch (e) {
        if (DEBUG) console.error('[trending] Failed to parse object:', (e as Error).message, obj.text.slice(0, 200));
        // skip this object and continue
      }
      p = obj.end;
      continue;
    }

    // If we see something unexpected, advance one char to avoid infinite loop
    p++;
  }

  return items;
}

/* ---------- fetch + build ---------- */

async function fetchFromGranite(): Promise<TrendingTopic[]> {
  assertIBMEnv();
  const token = await getIamToken();

  const body = {
    model_id: MODEL_ID,
    project_id: PROJECT_ID,
    input: promptBody(),
    parameters: {
      decoding_method: 'sample',
      temperature: 0.35,   // a bit lower to reduce rambling
      top_p: 0.9,
      top_k: 50,
      max_new_tokens: 520, // more headroom to avoid truncation
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

  // Parse leniently (handles trailing garbage OR truncation)
  const topicItems = extractTopicsLenient(String(raw));

  const topics = sanitize({ topics: topicItems });
  if (!topics.length) {
    if (DEBUG) console.error('[trending] sanitize produced 0 topics. Parsed items count =', topicItems.length);
    throw new Error('Empty topics after sanitize.');
  }
  return topics;
}

/** Public: getTrendingTopics (short in-memory cache). Use `force: true` to bypass cache. */
export async function getTrendingTopics(opts?: { force?: boolean; key?: string }): Promise<TrendingTopic[]> {
  const now = Date.now();
  const key = opts?.key || 'default';

  if (!opts?.force && cache && cache.key === key && now - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const topics = await fetchFromGranite();
    cache = { ts: now, data: topics, key };
    return topics;
  } catch (e: any) {
    if (DEBUG) console.error('[trending] graceful fallback reason:', e?.message || e);
    const fallback: TrendingTopic[] = [
      { id: 'football-weekend', title: 'Football', description: 'Fixtures and standout players.', starter: 'Who will stand out this weekend?', tag: 'sports' },
      { id: 'uk-politics',      title: 'UK Politics', description: 'Parliament headlines and debates.', starter: 'What’s your take on the latest debate?', tag: 'politics' },
      { id: 'breaking-news',    title: 'News', description: 'Top stories and why they matter.', starter: 'Have you followed today’s top story?', tag: 'news' },
      { id: 'tech-trends',      title: 'Tech', description: 'AI, gadgets, and software updates.', starter: 'What new tech has caught your eye?', tag: 'trend' },
    ];
    cache = { ts: now, data: fallback, key };
    return fallback;
  }
}
