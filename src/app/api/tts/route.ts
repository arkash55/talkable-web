import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ToneKey =
  | 'friendly' | 'confident' | 'cheerful' | 'calm'
  | 'enthusiastic' | 'serious' | 'sad' | 'angry';

type TonePreset = {
  rate: number;
  pitch: number;         // semitones
  volume: number;        // dB
  emphasis?: 'reduced' | 'moderate' | 'strong';
};

const TONE_PRESETS: Record<ToneKey, TonePreset> = {
  friendly:     { rate: 1.02, pitch: +1, volume: 0,  emphasis: 'moderate' },
  confident:    { rate: 0.98, pitch:  0, volume: +1, emphasis: 'reduced'  },
  cheerful:     { rate: 1.08, pitch: +2, volume: 0,  emphasis: 'moderate' },
  calm:         { rate: 0.90, pitch: -1, volume: 0,  emphasis: 'reduced'  },
  enthusiastic: { rate: 1.14, pitch: +3, volume: +1, emphasis: 'strong'   },
  serious:      { rate: 0.95, pitch: -1, volume: 0,  emphasis: 'reduced'  },
  sad:          { rate: 0.85, pitch: -2, volume: -1, emphasis: 'reduced'  },
  angry:        { rate: 1.10, pitch: +1, volume: +2, emphasis: 'strong'   },
};

function escapeSSML(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSSML(text: string, preset: TonePreset, who?: string) {
  const safe = escapeSSML(text || 'Hello!');
  const pre = who ? `<s>${escapeSSML(who)} says:</s> ` : '';
  const emphOpen  = preset.emphasis ? `<emphasis level="${preset.emphasis}">` : '';
  const emphClose = preset.emphasis ? `</emphasis>` : '';
  return `<speak>${pre}${emphOpen}${safe}${emphClose}</speak>`;
}

function languageFromVoice(voiceName?: string): string {
  if (!voiceName) return 'en-US';
  const parts = voiceName.split('-');
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return 'en-US';
}

export async function POST(req: NextRequest) {
  const key =
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY;

  if (!key) {
    return NextResponse.json({ error: 'Missing GOOGLE_TTS_API_KEY' }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    text = '',
    tone = 'calm',
    voiceName = 'en-GB-Neural2-A',
    name,
    ssml: clientSSML,
    audioConfig: clientCfg,
  } = body || {};

  const preset: TonePreset = TONE_PRESETS[(tone as ToneKey)] ?? TONE_PRESETS.calm;

  // Prefer client-provided SSML, else build ours with emphasis
  const ssml = clientSSML || buildSSML(text, preset, name);

  const voice = {
    name: voiceName,
    languageCode: languageFromVoice(voiceName),
  };

  // Merge numeric prosody (has strong audible effect) with any client overrides
  const audioConfig = {
    audioEncoding: 'MP3',
    speakingRate: preset.rate,
    pitch: preset.pitch,
    volumeGainDb: preset.volume,
    ...(clientCfg || {}),
  };

  const gRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { ssml },
        voice,
        audioConfig,
      }),
    }
  );

  if (!gRes.ok) {
    const errText = await gRes.text().catch(() => '');
    console.error('Google TTS error', gRes.status, errText);
    return NextResponse.json(
      { error: 'Google TTS failed', status: gRes.status, details: errText.slice(0, 800) },
      { status: 502 }
    );
  }

  const data = await gRes.json().catch(() => ({} as any));
  const audioContent = data?.audioContent;
  if (!audioContent) {
    return NextResponse.json({ error: 'No audioContent returned' }, { status: 502 });
  }

  return NextResponse.json({ audioContent });
}
