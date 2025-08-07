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
    resetTranscript();
    setHasSoundLeeway(true); // animate waveform while listening
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
    resetTranscript();
    onLoadingChange?.(false);
  };

  const toggleConversation = () => {
    if (isConversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  };

  // TTS event handling (resume listening after playback ends)
  useEffect(() => {
    const handleTtsStart = () => setSpeaking(true);
    const handleTtsEnd = () => {
      setSpeaking(false);
      // Resume listening after TTS finishes if conversation is active
      if (isConversationActive) {
        setTimeout(() => {
          SpeechRecognition.startListening({ continuous: true });
          setListening(true);
          resetTranscript();
          setHasSoundLeeway(true);
        }, 300); // small delay to avoid clipping the first word
      }
    };

    window.addEventListener('tts:start', handleTtsStart);
    window.addEventListener('tts:end', handleTtsEnd);

    return () => {
      window.removeEventListener('tts:start', handleTtsStart);
      window.removeEventListener('tts:end', handleTtsEnd);
    };
  }, [isConversationActive, resetTranscript]);

  // Detect 2s of "silence" by lack of transcript changes
  useEffect(() => {
    if (!isConversationActive || !listening || speaking) return;

    // Clear any existing timer
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
    }

    // If there's text, start a 2s timer; if timer fires, treat it as end-of-utterance
    if (transcript.trim()) {
      silenceTimer.current = setTimeout(async () => {
        if (!processingTranscript.current && transcript.trim()) {
          processingTranscript.current = true;

          // Pause STT while generating responses
          SpeechRecognition.stopListening();
          setListening(false);
          setHasSoundLeeway(false);
          onLoadingChange?.(true);

          try {
            const responses = await getIBMResponses(transcript.trim());
            onResponses(responses); // send to parent (HomeClient)
          } catch (err) {
            console.error('Error getting responses:', err);
          } finally {
            resetTranscript();
            processingTranscript.current = false;
            onLoadingChange?.(false);
            // DO NOT restart listening here; we wait for TTS selection/click to play,
            // and then the TTS 'end' event resumes listening automatically.
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
  }, [transcript, listening, speaking, isConversationActive, onResponses, resetTranscript, onLoadingChange]);

  // Cleanup on unmount
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
