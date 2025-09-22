

import 'server-only';


export type TrendingTopic = {
  id: string;
  title: string;
  description: string;
  starter: string;
  tag: 'sports' | 'news' | 'politics' | 'trend';
};




const GU_API_KEY = process.env.GU_API_KEY || process.env.GUARDIAN_API_KEY;
if (!GU_API_KEY) {
  console.warn('[guardian] Missing GU_API_KEY (or GUARDIAN_API_KEY) env var');
}

const CACHE_TTL_MS = 5 * 60 * 1000; 

type CacheBucket = {
  ts: number;
  data: TrendingTopic[]; 
  key: string;           
};

let freshCache: CacheBucket | null = null;
let lastGood: CacheBucket | null = null;

const toSlug = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stripHtml = (s?: string) => String(s || '').replace(/<[^>]+>/g, '');

function mapSectionToTag(sectionName?: string, sectionId?: string): TrendingTopic['tag'] {
  const s = `${sectionName || ''} ${sectionId || ''}`.toLowerCase();
  if (/\bsport/.test(s)) return 'sports';
  if (/\bpolitic/.test(s)) return 'politics';
  return 'news';
}


function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed = Date.now()): T[] {
  const r = mulberry32(seed >>> 0);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


export type GuardianGetOpts = {
  force?: boolean;
  key?: string;                           
  variant?: 'newest' | 'shuffle' | 'sample';
  seed?: number;                          
  page?: number;                          
  days?: number;                          
  sections?: string;                      
};


async function fetchGuardianPool(limit: number, opts?: GuardianGetOpts): Promise<TrendingTopic[]> {
  const days = opts?.days && opts.days > 0 ? opts.days : 14;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const basePageSize =
    opts?.variant === 'newest' ? Math.max(limit * 2, 12) :
    opts?.variant === 'shuffle' ? Math.max(limit * 6, 30) :
                     Math.max(limit * 10, 50);

  const params = new URLSearchParams({
    'order-by': 'newest',
    'page-size': String(basePageSize),
    'show-fields': 'trailText',
    'from-date': fromDate,
    'to-date': toDate,
    'api-key': String(GU_API_KEY || 'test'), 
  });

  if (opts?.sections) params.set('section', opts.sections);
  if (opts?.page && opts.page > 0) params.set('page', String(opts.page));

  const url = `https://content.guardianapis.com/search?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Guardian fetch failed: ${res.status} ${res.statusText} ${text.slice(0, 240)}`);
  }

  const data = await res.json();
  const results: any[] = data?.response?.results ?? [];

  const mapped: TrendingTopic[] = results.map((it, i) => {
    const title: string = String(it?.webTitle || 'Headline');
    const sectionName: string | undefined = it?.sectionName;
    const sectionId: string | undefined = it?.sectionId;
    const tag = mapSectionToTag(sectionName, sectionId);

    const id = toSlug(it?.id || title) || `guardian-${i}`;
    const description = stripHtml(it?.fields?.trailText).slice(0, 140);
    const starter = `Let's talk about ${title}`.slice(0, 120);

    return { id, title, description, starter, tag };
  });

  
  return mapped.filter((t, i, arr) => arr.findIndex(x => x.title === t.title) === i);
}


export async function getGuardianTopics(
  limit = 6,
  opts?: GuardianGetOpts
): Promise<TrendingTopic[]> {
  const now = Date.now();
  const key = [
    opts?.variant || 'newest',
    opts?.page || 1,
    opts?.days || 14,
    opts?.sections || 'all',
    opts?.key || 'default',
  ].join('|');

  
  if (!opts?.force && freshCache && freshCache.key === key && now - freshCache.ts < CACHE_TTL_MS) {
    const pool = freshCache.data;
    if (opts?.variant === 'shuffle') {
      return seededShuffle(pool, opts.seed ?? now).slice(0, limit);
    }
    if (opts?.variant === 'sample') {
      
      return seededShuffle(pool, opts.seed ?? now).slice(0, limit);
    }
    
    return pool.slice(0, limit);
  }

  try {
    let pool = await fetchGuardianPool(limit, opts);

    
    if (opts?.variant === 'shuffle') {
      pool = seededShuffle(pool, opts.seed ?? now);
    } else if (opts?.variant === 'sample') {
      
      const page2 = (opts?.page || 1) + 1;
      const extra = await fetchGuardianPool(limit, { ...opts, page: page2 });
      pool = seededShuffle([...pool, ...extra], opts.seed ?? now);
    }
    

    
    freshCache = { ts: now, data: pool, key };
    lastGood   = { ts: now, data: pool, key };

    return pool.slice(0, limit);
  } catch (err) {
    
    if (lastGood && lastGood.key === key) {
      const pool = lastGood.data;
      if (opts?.variant === 'shuffle' || opts?.variant === 'sample') {
        return seededShuffle(pool, opts.seed ?? now).slice(0, limit);
      }
      return pool.slice(0, limit);
    }
    throw err;
  }
}
