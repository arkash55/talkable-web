export async function speakWithGoogleTTSClient(
  text: string,
  tone: string = 'calm',
  voiceName: string = 'en-US-Wavenet-D',
  name?: string
) {
  try {
    // Notify start of TTS
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts:start'));
    }

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, tone, voiceName, name }),
    });

    const { audioContent } = await res.json();
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.play();

    audio.onended = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tts:end'));
      }
    };
  } catch (err) {
    console.error('TTS error:', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts:end'));
    }
  }
}
