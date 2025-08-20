// src/services/graniteTrendingService.ts
// Server-only: fetch & shape trending topics via Granite; short in-memory cache.

import { assertIBMEnv, BASE_URL, MODEL_ID, PROJECT_ID, getIamToken } from '@/services/ibmClient';

export type TrendingTopic = {
  id: string;          // slug
  title: string;
  description: string;
  starter: string;
  tag: 'sports' | 'news' | 'politics' | 'trend';
};

const SYSTEM = `You produce a short JSON list of high-signal conversation topics for small talk:
- Include sports, news, politics, and general trends.
- Keep it safe and non-graphic; avoid harmful or NSFW items.
- Each item: id (slug), title, description (<= 20 words), starter (<= 16 words), tag (one of: sports, news, politics, trend).
- Return ONLY JSON. No preamble.
Schema:
{"topics":[{"id":"string-slug","title":"string","description":"string","starter":"string","tag":"sports|news|politics|trend"}]}`;

function promptBody() {
  return `[SYSTEM]
${SYSTEM}

[USER]
Generate 9 diverse, current conversation topics. Keep them broadly timeless within the last few weeks so they won't stale immediately.`;
}

const ALLOWED_TAGS = new Set(['sports', 'news', 'politics', 'trend']);
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

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

async function fetchFromGranite(): Promise<TrendingTopic[]> {
  assertIBMEnv();
  const token = await getIamToken();

  const res = await fetch(`${BASE_URL}/ml/v1/text/generation?version=2024-08-01`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: MODEL_ID,
      project_id: PROJECT_ID,
      input: promptBody(),
      parameters: {
        decoding_method: 'sample',
        temperature: 0.6,
        top_p: 0.95,
        top_k: 60,
        max_new_tokens: 280,
        stop_sequences: ['\nAssistant:', '\nUser:'],
      },
      return_options: { token_logprobs: false, token_ranks: false, top_n_tokens: 0 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Granite error: ${res.status} ${body}`);
  }

  const data = await res.json();
  const raw = data?.results?.[0]?.generated_text ?? '';

  // Strict parse first; then rescue first {...} block if present.
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  return sanitize(parsed);
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
  } catch (e) {
    // Graceful fallback
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
