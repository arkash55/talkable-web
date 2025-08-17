import { getCandidates } from '@/services/graniteClient';
import { Candidate, GenerateResponse } from '@/services/graniteService';
import { getIBMResponses } from '@/services/ibmService';
import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import {
  appendWithSlidingWindow,
  buildContextWindow,
  type MessageHistoryItem,
} from '@/app/utils/contextWindow';
import React from 'react';
import { buildSystemPrompt } from '../utils/systemPrompt';
import { useUserProfile } from './useUserProfile';

// Tune these as needed
const HISTORY_LIMIT = { maxCount: 50, maxChars: 8000 };
const CTX_LIMIT     = { maxMessages: 12, maxChars: 1500 };

export function useVoiceControl(
  onResponses: (responses: GenerateResponse) => void,
  onLoadingChange?: (loading: boolean) => void
) {
  // State
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);

  // Local conversation history kept as a MUTABLE ref (in-place sliding window)
  const historyRef = useRef<MessageHistoryItem[]>([]);

  // Refs
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const processingTranscript = useRef<boolean>(false);
  const pendingTranscript = useRef<string>('');
  const stableOnResponses = useRef(onResponses);
  const safeOnLoadingChange = useRef(onLoadingChange ?? (() => {}));

  // STT
  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();


  const { profile } = useUserProfile();

  // MOVE system prompt memoization to top level (safe hook position)
  const systemPrompt = React.useMemo(
    () => buildSystemPrompt(profile?.tone, profile?.description),
    [profile?.tone, profile?.description]
  );

  // Update refs
  useEffect(() => {
    stableOnResponses.current = onResponses;
    safeOnLoadingChange.current = onLoadingChange ?? (() => {});
  }, [onResponses, onLoadingChange]);

  // Start conversation (+ dispatch event)
  const startConversation = () => {
    if (!browserSupportsSpeechRecognition) return;
    if (isConversationActive) return;

    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });

    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('conversation:start'));
        console.log('Starting STT listening');
        window.dispatchEvent(new CustomEvent('stt:startListening'));
      }, 100);
    }
  };

  // Stop conversation (+ dispatch event)
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
    pendingTranscript.current = '';
    safeOnLoadingChange.current(false);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversation:end'));
    }
  };

  // Toggle conversation
  const toggleConversation = () => {
    if (isConversationActive) stopConversation();
    else startConversation();
  };

  // Resume listening after TTS
  const resumeListening = () => {
    if (isConversationActive && !listening) {
      SpeechRecognition.startListening({ continuous: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stt:startListening'));
      }
      setListening(true);
      resetTranscript();
      setHasSoundLeeway(true);
    }
  };

  // Listen for TTS events
  useEffect(() => {
    const handleTtsStart = () => setSpeaking(true);
    const handleTtsEnd = () => {
      setSpeaking(false);
      if (isConversationActive) {
        setTimeout(resumeListening, 300);
      }
    };

    window.addEventListener('tts:start', handleTtsStart);
    window.addEventListener('tts:end', handleTtsEnd);

    return () => {
      window.removeEventListener('tts:start', handleTtsStart);
      window.removeEventListener('tts:end', handleTtsEnd);
    };
  }, [isConversationActive, listening]);

  // (Optional) If you want to capture selected AI replies as 'user' messages:
  useEffect(() => {
    const onGridClick = (e: Event) => {
      const detail = (e as CustomEvent).detail as { label?: string };
      const text = (detail?.label ?? '').trim();
      if (!text) return;

      appendWithSlidingWindow(
        historyRef.current,
        { sender: 'user', content: text, createdAt: new Date().toISOString() },
        HISTORY_LIMIT
      );
    };
    window.addEventListener('ui:voicegrid:click', onGridClick);
    return () => window.removeEventListener('ui:voicegrid:click', onGridClick);
  }, []);

  // Silence → finalize
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

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('stt:finalTranscript', {
              detail: pendingTranscript.current
            }));
          }

            setListening(false);
            setHasSoundLeeway(false);
            safeOnLoadingChange.current(true);

          try {
            const guestMsg: MessageHistoryItem = {
              sender: 'guest',
              content: pendingTranscript.current,
              createdAt: new Date().toISOString(),
            };
            appendWithSlidingWindow(historyRef.current, guestMsg, HISTORY_LIMIT);

            const ctx = buildContextWindow(historyRef.current, CTX_LIMIT);
            console.log('Context for AI:', ctx);

            // Use memoized prompt (no hook call here)
            const responses: GenerateResponse = await getCandidates(
              guestMsg.content,
              { system: systemPrompt, context: ctx }
            );

            stableOnResponses.current(responses);
          } catch (err) {
            console.error('Error getting responses:', err);
          } finally {
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
  }, [transcript, listening, speaking, isConversationActive, systemPrompt]); // add systemPrompt dep

  // Cleanup
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

    // If you need to inspect the live window for debugging:
    messageHistory: historyRef.current,
  };
}
