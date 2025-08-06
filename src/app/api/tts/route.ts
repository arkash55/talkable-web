import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, tone, voiceName, name } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const toneMap: Record<string, { rate: string; pitch: string }> = {
      calm: { rate: 'slow', pitch: '-2st' },
      excited: { rate: 'fast', pitch: '+4st' },
      slow: { rate: 'x-slow', pitch: 'default' },
      fast: { rate: 'x-fast', pitch: 'default' },
    };

    const { rate, pitch } = toneMap[tone] || toneMap.calm;

    const speakerText = name ? `${name} says: ${text}` : text;

    const ssml = `
      <speak>
        <prosody rate="${rate}" pitch="${pitch}">
          ${speakerText}
        </prosody>
      </speak>
    `.trim();

    const languageCode = voiceName?.split('-').slice(0, 2).join('-') || 'en-US';

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { ssml },
        voice: {
          languageCode,
          name: voiceName || 'en-US-Wavenet-D',
        },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google TTS API error:', error);
      return NextResponse.json({ error: 'Google TTS failed' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ audioContent: data.audioContent });

  } catch (err) {
    console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
