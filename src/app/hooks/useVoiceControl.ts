import { getIBMResponses } from '@/services/ibmService';
import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export function useVoiceControl(
  onResponses: (responses: string[]) => void,
  onLoadingChange?: (loading: boolean) => void
) {
  // State
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);

  // Refs
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const processingTranscript = useRef<boolean>(false);
  const pendingTranscript = useRef<string>(''); // store transcript until TTS ends
  const stableOnResponses = useRef(onResponses);
  const safeOnLoadingChange = useRef(onLoadingChange ?? (() => {}));

  // STT
  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Update refs if callbacks change
  useEffect(() => {
    stableOnResponses.current = onResponses;
  }, [onResponses]);

  useEffect(() => {
    safeOnLoadingChange.current = onLoadingChange ?? (() => {});
  }, [onLoadingChange]);

  // Start
  const startConversation = () => {
    if (!browserSupportsSpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }
    if (isConversationActive) return;

    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });
    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);
  };

  // Stop
  const stopConversation = () => {
    if (!isConversationActive) return;

    setIsConversationActive(false);
    SpeechRecognition.stopListening();
    setListening(false);
    setHasSoundLeeway(false);

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }

    resetTranscript();
    processingTranscript.current = false;
    pendingTranscript.current = '';
    safeOnLoadingChange.current(false);
  };

  // Toggle
  const toggleConversation = () => {
    if (isConversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  };

  // Resume listening after TTS ends, then clear transcript
  useEffect(() => {
    const handleTtsStart = () => setSpeaking(true);

    const handleTtsEnd = () => {
      setSpeaking(false);

      // Clear transcript after TTS ends
      resetTranscript();
      pendingTranscript.current = '';

      // Resume listening
      if (isConversationActive) {
        setTimeout(() => {
          SpeechRecognition.startListening({ continuous: true });
          setListening(true);
          setHasSoundLeeway(true);
        }, 300);
      }
    };

    window.addEventListener('tts:start', handleTtsStart);
    window.addEventListener('tts:end', handleTtsEnd);

    return () => {
      window.removeEventListener('tts:start', handleTtsStart);
      window.removeEventListener('tts:end', handleTtsEnd);
    };
  }, [isConversationActive, resetTranscript]);

  // Detect 2s of silence to trigger response
  useEffect(() => {
    if (!isConversationActive || !listening || speaking) return;

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
    }

    if (transcript.trim()) {
      silenceTimer.current = setTimeout(async () => {
        if (!processingTranscript.current && transcript.trim()) {
          processingTranscript.current = true;
          pendingTranscript.current = transcript.trim();

          SpeechRecognition.stopListening();
          setListening(false);
          setHasSoundLeeway(false);
          safeOnLoadingChange.current(true);

          try {
            const responses = await getIBMResponses(pendingTranscript.current);
            stableOnResponses.current(responses);
          } catch (err) {
            console.error('Error getting responses:', err);
          } finally {
            // Don’t reset transcript here — we wait until TTS ends
            processingTranscript.current = false;
            safeOnLoadingChange.current(false);
          }
        }
      }, 2000);
    }

    return () => {
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
    };
  }, [transcript, listening, speaking, isConversationActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      SpeechRecognition.stopListening();
      safeOnLoadingChange.current(false);
    };
  }, []);

  return {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    isConversationActive,
    toggleConversation,
    startConversation,
    stopConversation,
    browserSupportsSpeechRecognition,
  };
}
