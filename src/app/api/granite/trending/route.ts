import { NextResponse } from 'next/server';

const API_KEY    = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID   = process.env.IBM_MODEL_ID || 'ibm/granite-3-8b-instruct';
const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || '').replace(/\/+$/, '');

let cachedToken: { token: string; expiresAt: number } | null = null;
async function getIamToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`IAM token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
  return cachedToken.token;
}

const SYSTEM = `You produce a short JSON list of high-signal conversation topics for small talk:
- Include sports, news, politics, and general trends.
- Keep it safe and non-graphic; avoid harmful or NSFW items.
- Each item: id (slug), title, description (<= 20 words), starter (<= 16 words), tag (one of: sports, news, politics, trend).
- Return ONLY JSON. No preamble.
Schema:
{"topics":[{"id": "string-slug","title":"string","description":"string","starter":"string","tag":"sports|news|politics|trend"}]}`;

function promptBody() {
  return `[SYSTEM]
${SYSTEM}

[USER]
Generate 9 diverse, current conversation topics. Keep them broadly timeless within the last few weeks so they won't stale immediately.`;
}

export async function GET() {
  try {
    if (!API_KEY || !BASE_URL || !PROJECT_ID) {
      return NextResponse.json({ error: 'Missing IBM credentials' }, { status: 500 });
    }
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
      return NextResponse.json({ error: `Granite error: ${res.status} ${body}` }, { status: 500 });
    }

    const data = await res.json();
    const raw = data?.results?.[0]?.generated_text ?? '';
    // strict parse; fall back gracefully if needed
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // simple rescue: try to find first {...} block
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];

    // light sanitize + enforce minimal shape
    const clean = topics.slice(0, 12).map((t: any, i: number) => {
      const id = String(t?.id || t?.title || `topic-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const title = String(t?.title || 'Topic').slice(0, 80);
      const description = String(t?.description || '').slice(0, 140);
      const starter = String(t?.starter || 'Want to chat about this?').slice(0, 120);
      const tag = /^(sports|news|politics|trend)$/i.test(t?.tag) ? t.tag.toLowerCase() : 'trend';
      return { id, title, description, starter, tag };
    });

    return NextResponse.json({ topics: clean }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
