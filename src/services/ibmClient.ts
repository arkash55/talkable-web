


let cachedToken: { token: string; expiresAt: number } | null = null;

export const API_KEY    = process.env.IBM_API_KEY!;
export const PROJECT_ID = process.env.IBM_PROJECT_ID!;
export const MODEL_ID   = process.env.IBM_MODEL_ID || 'ibm/granite-3-8b-instruct';
export const BASE_URL   = (process.env.IBM_WATSON_ENDPOINT || '').replace(/\/+$/, '');

export function assertIBMEnv() {
  if (!API_KEY || !BASE_URL || !PROJECT_ID) {
    throw new Error('Missing IBM credentials (IBM_API_KEY, IBM_WATSON_ENDPOINT, IBM_PROJECT_ID).');
  }
}

export async function getIamToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: API_KEY,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`IAM token error: ${res.status} ${body}`);
  }

  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
  return cachedToken.token;
}
