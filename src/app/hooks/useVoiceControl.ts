// src/app/hooks/useVoiceControl.ts
import { getIBMResponses } from '@/services/ibmService';
import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export function useVoiceControl(
  onResponses: (responses: string[]) => void,
  onLoadingChange?: (loading: boolean) => void
) {
  // States
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);

  // Refs
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const processingTranscript = useRef<boolean>(false);

  // STT (react-speech-recognition)
  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Start/stop conversation
  const startConversation = () => {
    if (!browserSupportsSpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }
    if (isConversationActive) return;

    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });
    setListening(true);
    resetTranscript(); // ✅ this is fine here, only at start
    setHasSoundLeeway(true);
  };

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

    processingTranscript.current = false;
    onLoadingChange?.(false);
  };

  const toggleConversation = () => {
    if (isConversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  };

  // TTS event handling
  useEffect(() => {
    const handleTtsStart = () => setSpeaking(true);

    const handleTtsEnd = () => {
      setSpeaking(false);
      resetTranscript(); // ✅ NOW we reset transcript only after TTS finishes

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

  // Silence detection
  useEffect(() => {
    if (!isConversationActive || !listening || speaking) return;

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
    }

    if (transcript.trim()) {
      silenceTimer.current = setTimeout(async () => {
        if (!processingTranscript.current && transcript.trim()) {
          processingTranscript.current = true;

          SpeechRecognition.stopListening();
          setListening(false);
          setHasSoundLeeway(false);
          onLoadingChange?.(true);

          try {
            const responses = await getIBMResponses(transcript.trim());
            onResponses(responses);
          } catch (err) {
            console.error('Error getting responses:', err);
          } finally {
            // ❌ DO NOT resetTranscript() here
            processingTranscript.current = false;
            onLoadingChange?.(false);
            // resume STT will be handled in tts:end
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
  }, [transcript, listening, speaking, isConversationActive, onResponses, onLoadingChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      SpeechRecognition.stopListening();
      onLoadingChange?.(false);
    };
  }, [onLoadingChange]);

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
