// src/services/ttsClient.ts
export async function speakWithGoogleTTSClient(
  text: string,
  tone: string,
  voice: string,
  speakerName: string
): Promise<void> {
  // Web Speech Synthesis fallback (client-side). Replace with your real Google TTS if needed.
  return new Promise<void>((resolve, reject) => {
    try {
      // Cancel any ongoing speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      const utter = new SpeechSynthesisUtterance(text);

      // Map your "voice" string to an available voice if possible (best-effort)
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.name.includes(voice)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (match) utter.voice = match;

      // Optional: adjust based on "tone"
      // You can fine-tune pitch/rate to approximate tone.
      switch (tone) {
        case 'friendly':
          utter.rate = 1.0;  utter.pitch = 1.2;  break;
        case 'confident':
          utter.rate = 0.95; utter.pitch = 1.0;  break;
        case 'cheerful':
          utter.rate = 1.05; utter.pitch = 1.3;  break;
        case 'calm':
          utter.rate = 0.9;  utter.pitch = 0.95; break;
        case 'enthusiastic':
          utter.rate = 1.1;  utter.pitch = 1.35; break;
        case 'serious':
          utter.rate = 0.95; utter.pitch = 0.9;  break;
        case 'sad':
          utter.rate = 0.85; utter.pitch = 0.8;  break;   // slower, lower pitch
        case 'angry':
          utter.rate = 1.08; utter.pitch = 0.9;  break;   // slightly faster, firmer
        default:
          utter.rate = 1.0;  utter.pitch = 1.0;  break;
      }


      utter.onstart = () => {
        window.dispatchEvent(new Event('tts:start'));
      };

      utter.onend = () => {
        window.dispatchEvent(new Event('tts:end'));
        resolve();
      };

      utter.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        // still dispatch end to unblock UI
        window.dispatchEvent(new Event('tts:end'));
        reject(e);
      };

      window.speechSynthesis.speak(utter);
    } catch (e) {
      window.dispatchEvent(new Event('tts:end'));
      reject(e);
    }
  });
}
