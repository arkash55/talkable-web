// wx-smoke.ts — minimal watsonx.ai generation test (Node 18+)
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' }); // load envs for this script

const API_KEY = process.env.IBM_API_KEY!;
const PROJECT_ID = process.env.IBM_PROJECT_ID!;
const MODEL_ID = process.env.IBM_MODEL_ID || "ibm/granite-13b-instruct-v2";
const BASE_URL = (process.env.IBM_WATSON_ENDPOINT || "").replace(/\/+$/, ""); // trim trailing slash

async function getIamToken(): Promise<string> {
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`IAM token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

async function main() {
  if (!API_KEY || !PROJECT_ID || !BASE_URL) {
    const missing = [
      !API_KEY && 'IBM_API_KEY',
      !PROJECT_ID && 'IBM_PROJECT_ID',
      !BASE_URL && 'IBM_WATSON_ENDPOINT',
    ].filter(Boolean).join(', ');
    throw new Error(`Missing env: ${missing}`);
  }

  const token = await getIamToken();

  const gen = await fetch(
    `${BASE_URL}/ml/v1/text/generation?version=2024-08-01`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: MODEL_ID,
        project_id: PROJECT_ID,
        input: "Say hello in one short friendly sentence.",
        parameters: { max_new_tokens: 60, temperature: 0.2, random_seed: 42 },
      }),
    }
  );

  if (!gen.ok) throw new Error(`Generation error: ${gen.status} ${await gen.text()}`);
  const data = await gen.json();
  const text = data?.results?.[0]?.generated_text ?? "";
  console.log("✅ Granite responded:\n", text);
}

main().catch((e) => {
  console.error("❌ Test failed:", e.message);
  process.exit(1);
});
