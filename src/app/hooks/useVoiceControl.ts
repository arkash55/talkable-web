// src/app/hooks/useVoiceControl.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import { getCandidates } from '@/services/graniteClient';
import { GenerateResponse } from '@/services/graniteService'; // keep if you use it elsewhere

import {
  appendWithSlidingWindow,
  buildContextWindow,
  type MessageHistoryItem,
} from '@/app/utils/contextWindow';

import { buildSystemPrompt } from '../utils/systemPrompt';
import { useUserProfile } from './useUserProfile';

// 🔗 Firestore integration
import { getAuth } from 'firebase/auth';
import { createLiveConversation, sendMessage } from '@/services/firestoreService';

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

  // 🔗 Track current conversation id + first user message gate
  const currentCidRef = useRef<string | null>(null);
  const firstUserMessageSentRef = useRef<boolean>(false);

  // STT
  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const { profile } = useUserProfile();
  const SYSTEM_PROMPT = React.useMemo(
    () => buildSystemPrompt(profile),
    [profile?.tone, profile?.description]
  );

  // Update refs
  useEffect(() => {
    stableOnResponses.current = onResponses;
    safeOnLoadingChange.current = onLoadingChange ?? (() => {});
  }, [onResponses, onLoadingChange]);

  const clearContext = React.useCallback(() => {
    historyRef.current.length = 0; // wipe the context window
    firstUserMessageSentRef.current = false; // allow a fresh seed on next start
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('context:cleared'));
    }
  }, []);

  // ---- NEW explicit starters ----
  const startNewConversation = async () => {
    if (!browserSupportsSpeechRecognition) return;
    if (isConversationActive) return;

    currentCidRef.current = null;
    // 1) Flip UI/live listening
    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });

    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);

    // 2) Announce NEW (not resume)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
      window.dispatchEvent(new CustomEvent('stt:startListening'));
    }
  };

  const resumeConversation = () => {
    if (!browserSupportsSpeechRecognition) return;
    if (isConversationActive) return;

    // (Optional) If you want to support resuming by URL ?cid=..., you could read and set currentCidRef here.

    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });

    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);

    if (typeof window !== 'undefined') {
      // announce RESUME (keep cid)
      window.dispatchEvent(new CustomEvent('conversation:resume'));
      window.dispatchEvent(new CustomEvent('stt:startListening'));
    }
  };

  // Backwards-compatible generic start (kept for callers that still use it)
  const startConversation = () => {
    // Default to RESUME if URL has cid, else NEW.
    const hasRouteCid =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('cid');

    if (hasRouteCid) {
      resumeConversation();
    } else {
      startNewConversation();
    }
  };

  // Stop conversation
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
    currentCidRef.current = null;
    firstUserMessageSentRef.current = false;

    clearContext();
    safeOnLoadingChange.current(false);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversation:end'));
    }
  };

  // Toggle (kept)
  const toggleConversation = () => {
    if (isConversationActive) stopConversation();
    else startConversation();
  };

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

  // TTS events
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

  // Capture selected AI replies as 'user' messages (used for auto-start seed too)
  useEffect(() => {
    const onGridClick = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { label?: string };
      const text = (detail?.label ?? '').trim();
      if (!text) return;

      // Append locally
      appendWithSlidingWindow(
        historyRef.current,
        { sender: 'user', content: text, createdAt: new Date().toISOString() },
        HISTORY_LIMIT
      );

      // Persist the *first* user/seed message if we have a conversation id
      if (!firstUserMessageSentRef.current && currentCidRef.current) {
        try {
          await sendMessage({
            cid: currentCidRef.current,
            senderId: 'guest',
            text,
          });
          firstUserMessageSentRef.current = true;
        } catch (err) {
          console.error('Failed to persist first user/seed message:', err);
        }
      }
    };

    window.addEventListener('ui:voicegrid:click', onGridClick as EventListener);
    return () => window.removeEventListener('ui:voicegrid:click', onGridClick as EventListener);
  }, []);

  // Finalize on silence
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
            // 1) Append guest message in sliding window
            const guestMsg: MessageHistoryItem = {
              sender: 'guest',
              content: pendingTranscript.current,
              createdAt: new Date().toISOString(),
            };
            appendWithSlidingWindow(historyRef.current, guestMsg, HISTORY_LIMIT);

            // 🔗 Persist spoken message to Firestore if we have a cid
            try {
              if (currentCidRef.current && guestMsg.content.trim()) {
                await sendMessage({
                  cid: currentCidRef.current,
                  senderId: 'guest',
                  text: guestMsg.content.trim(),
                });
                // mark that at least one user message has been sent (covers edge case where the seed didn't fire)
                firstUserMessageSentRef.current = true;
              }
            } catch (err) {
              console.error('Failed to persist spoken user message:', err);
            }

            // 2) Build context
            const ctx = buildContextWindow(historyRef.current, CTX_LIMIT);
            console.log('Context for AI:', ctx);

            // 3) Call model
            const responses: GenerateResponse = await getCandidates(
              guestMsg.content, SYSTEM_PROMPT, ctx
            );
            console.log('AI responses:', responses);
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
  }, [transcript, listening, speaking, isConversationActive]);

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
    startConversation,     // backward-compatible
    stopConversation,
    startNewConversation,  // NEW (now creates Firestore convo + emits conversation:created)
    resumeConversation,    // NEW
    browserSupportsSpeechRecognition,

    messageHistory: historyRef.current,
  };
}
