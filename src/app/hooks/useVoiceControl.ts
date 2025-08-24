'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import { getCandidates } from '@/services/graniteClient';
import { GenerateResponse } from '@/services/graniteService';

import {
  appendWithSlidingWindow,
  buildContextWindow,
  type MessageHistoryItem,
} from '@/app/utils/contextWindow';

import { buildSystemPrompt } from '../utils/systemPrompt';
import { useUserProfile } from './useUserProfile';

// Firestore writes are centralized in useLiveConversationSync.

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

  // Track current conversation id locally for UI logic only
  const currentCidRef = useRef<string | null>(null);

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

  useEffect(() => {
    stableOnResponses.current = onResponses;
    safeOnLoadingChange.current = onLoadingChange ?? (() => {});
  }, [onResponses, onLoadingChange]);

  const clearContext = React.useCallback(() => {
    historyRef.current.length = 0; // wipe the context window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('context:cleared'));
    }
  }, []);

  // Keep local cid in sync for UI logic only (no writes here)
  useEffect(() => {
    const onCreated = (e: Event) => {
      const any = e as CustomEvent<string>;
      const id = (any.detail || '').trim();
      if (id) currentCidRef.current = id;
    };
    const onEnd = () => {
      currentCidRef.current = null;
    };
    window.addEventListener('conversation:created', onCreated);
    window.addEventListener('conversation:end', onEnd);
    return () => {
      window.removeEventListener('conversation:created', onCreated);
      window.removeEventListener('conversation:end', onEnd);
    };
  }, []);

  // Append autostart seed to local context as a *user* message
  useEffect(() => {
    const onSeed = (e: Event) => {
      const any = e as CustomEvent<{ text?: string; sender?: 'user' | 'guest' }>;
      const text = any.detail?.text?.trim();
      const sender = any.detail?.sender || 'guest';
      if (!text) return;

      appendWithSlidingWindow(
        historyRef.current,
        { sender: sender === 'user' ? 'user' : 'guest', content: text, createdAt: new Date().toISOString() },
        HISTORY_LIMIT
      );
    };
    window.addEventListener('conversation:seed', onSeed as EventListener);
    return () => window.removeEventListener('conversation:seed', onSeed as EventListener);
  }, []);

  // ---- explicit starters ----
  const startNewConversation = async () => {
    if (!browserSupportsSpeechRecognition) return;
    if (isConversationActive) return;

    currentCidRef.current = null;

    // Flip UI/live listening
    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });

    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);

    // Announce NEW (creation handled by useLiveConversationSync)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
      window.dispatchEvent(new CustomEvent('stt:startListening'));
    }
  };

  const resumeConversation = () => {
    if (!browserSupportsSpeechRecognition) return;
    if (isConversationActive) return;

    setIsConversationActive(true);
    SpeechRecognition.startListening({ continuous: true });

    setListening(true);
    resetTranscript();
    setHasSoundLeeway(true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversation:resume'));
      window.dispatchEvent(new CustomEvent('stt:startListening'));
    }
  };

  // Backwards-compatible generic start (kept for callers that still use it)
  const startConversation = () => {
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
    resetTranscript();

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }

    processingTranscript.current = false;
    pendingTranscript.current = '';
    currentCidRef.current = null;

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

  // Capture selected AI replies as 'user' messages for local context (writes centralized elsewhere)
  useEffect(() => {
    const onGridClick = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { label?: string };
      const text = (detail?.label ?? '').trim();
      if (!text) return;

      // Append locally for context as *user*
      appendWithSlidingWindow(
        historyRef.current,
        { sender: 'user', content: text, createdAt: new Date().toISOString() },
        HISTORY_LIMIT
      );
      // Firestore write happens in useLiveConversationSync via 'ui:voicegrid:click'
    };

    window.addEventListener('ui:voicegrid:click', onGridClick as EventListener);
    return () => window.removeEventListener('ui:voicegrid:click', onGridClick as EventListener);
  }, []);

  // Finalize on silence (guest speech)
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
            // Sync hook will persist this as a guest message
            window.dispatchEvent(new CustomEvent('stt:finalTranscript', {
              detail: pendingTranscript.current
            }));
          }

          setListening(false);
          setHasSoundLeeway(false);
          safeOnLoadingChange.current(true);

          try {
            // 1) Append guest message locally for context
            const guestMsg: MessageHistoryItem = {
              sender: 'guest',
              content: pendingTranscript.current,
              createdAt: new Date().toISOString(),
            };
            appendWithSlidingWindow(historyRef.current, guestMsg, HISTORY_LIMIT);

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
    startNewConversation,
    resumeConversation,
    browserSupportsSpeechRecognition,

    messageHistory: historyRef.current,
  };
}
