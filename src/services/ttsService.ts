// services/googleTTS.ts

export async function callGoogleTTS(
  text: string,
  tone: string = 'calm',
  voiceName: string = 'en-US-Wavenet-D',
  name?: string
): Promise<string> {
  const toneMap: Record<string, { rate: string; pitch: string }> = {
    calm: { rate: 'slow', pitch: '-2st' },
    excited: { rate: 'fast', pitch: '+4st' },
    slow: { rate: 'x-slow', pitch: 'default' },
    fast: { rate: 'x-fast', pitch: 'default' },
  };

  const { rate, pitch } = toneMap[tone] || toneMap.calm;

  // If a name is provided, prepend it to the message
  const speakerText = name ? `${name} says: ${text}` : text;

  const ssml = `
    <speak>
      <prosody rate="${rate}" pitch="${pitch}">
        ${speakerText}
      </prosody>
    </speak>
  `.trim();

  const languageCode = voiceName.split('-').slice(0, 2).join('-'); // e.g., 'en-US'

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { ssml },
        voice: {
          languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Google TTS API error:', error);
    throw new Error('TTS API call failed');
  }

  const data = await response.json();
  return data.audioContent;
}
