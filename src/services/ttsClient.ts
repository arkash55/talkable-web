

type ToneKey =
  | 'friendly' | 'confident' | 'cheerful' | 'calm'
  | 'enthusiastic' | 'serious' | 'sad' | 'angry';

type TonePreset = {
  rate: number;           
  pitch: number;          
  volume: number;         
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

function buildSSML(text: string, preset: TonePreset, name?: string) {
  const safe = (text || 'Hello!').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const emphOpen  = preset.emphasis ? `<emphasis level="${preset.emphasis}">` : '';
  const emphClose = preset.emphasis ? `</emphasis>` : '';
  return `<speak>${emphOpen}${safe}${emphClose}</speak>`;
}

export async function speakWithGoogleTTSClient(
  text: string,
  tone: string = 'calm',
  voiceName: string = 'en-GB-Neural2-A',
  name?: string
) {
  const key = (tone as ToneKey);
  const preset = TONE_PRESETS[key] ?? TONE_PRESETS.calm;

  const payload = {
    text,
    ssml: buildSSML(text, preset, name),
    voiceName,
    name,
    audioConfig: {
      speakingRate: preset.rate,
      pitch: preset.pitch,
      volumeGainDb: preset.volume,
    },
  };

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts:start'));
    }

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`TTS HTTP ${res.status} ${res.statusText} — ${errText}`);
    }

    const { audioContent } = await res.json();
    if (!audioContent) throw new Error('TTS response missing audioContent');

    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.onended = () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tts:end'));
    };
    audio.onerror = () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tts:end'));
    };

    await audio.play().catch(() => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tts:end'));
    });
  } catch (err) {
    console.error('TTS error:', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts:end'));
    }
  }
}
