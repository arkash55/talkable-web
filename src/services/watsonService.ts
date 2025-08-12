// lib/services/aiService.ts

import axios from 'axios';

const WATSONX_API = `${process.env.IBM_WATSONX_ENDPOINT}/ml/v1/text/generation`;

type Message = {
  sender: 'user' | 'other';
  text: string;
};

function formatConversation(messages: Message[]) {
  return messages
    .map((msg) => `${msg.sender === 'user' ? 'User' : 'Other'}: ${msg.text}`)
    .join('\n');
}



export async function generateAIResponses(conversation: Message[]): Promise<string[]> {
  const userContext = `
The user:
- Has MND and uses this app to communicate
- Enjoys calm, clear communication
- Likes nature and music
- Dislikes loud or crowded environments
- Prefers short, friendly responses
`;

  const prompt = `
${userContext}

Here is the recent conversation:

${formatConversation(conversation)}

Generate 6 likely responses the user might give next, ordered by likelihood.
Return just the text.
`;

  try {
    const response = await axios.post(
      WATSONX_API,
      {
        model_id: 'granite-13b-instruct',
        input: prompt,
        parameters: {
          decoding_method: 'sample',
          max_new_tokens: 100,
          temperature: 0.7,
          top_k: 5,
          top_p: 0.9,
          repetition_penalty: 1.1,
          return_options: { num_generations: 6 },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.IBM_API_KEY}`,
          'Content-Type': 'application/json',
          'Project-ID': process.env.IBM_PROJECT_ID,
        },
      }
    );

    return response.data.results.map((r: any) => r.generated_text.trim());
  } catch (error) {
    console.error('Error generating AI responses:', error);
    return [];
  }
}


export async function queryWatson(prompt: string): Promise<string> {
  const apiKey = process.env.IBM_API_KEY!;
  const projectId = process.env.IBM_PROJECT_ID!;
  const endpoint = process.env.IBM_ENDPOINT!;
  const modelId = process.env.IBM_MODEL_ID!;

  console.log({
  apiKey: apiKey?.slice(0, 8),
  projectId,
  endpoint,
  modelId
});


  const url = `${endpoint}/ml/v1/text/generation?version=2023-05-29`;

  try {
    const token = await getAccessToken(apiKey);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model_id: modelId,
        input: prompt,
        parameters: {
          decoding_method: 'sample',
          max_new_tokens: 100,
          temperature: 0.7,
          top_k: 50,
        },
        project_id: projectId,
      }),
    });

    const data = await response.json();

    console.log('Watsonx response:', JSON.stringify(data, null, 2));

    if (data.errors || data.error) {
      throw new Error(JSON.stringify(data));
    }

    return data.results?.[0]?.generated_text || 'No response';
  } catch (err) {
    console.error('Watsonx error:', err);
    return 'Watsonx request failed.';
  }
}

async function getAccessToken(apiKey: string): Promise<string> {
  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
  });
  const data = await res.json();
  return data.access_token;
}