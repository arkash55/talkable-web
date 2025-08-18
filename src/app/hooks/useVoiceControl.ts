'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import React from 'react';

import { getCandidates, type GenerateResponse } from '@/services/graniteClient';

import {
  appendWithSlidingWindow,
  buildContextWindow,
  type MessageHistoryItem,
} from '@/app/utils/contextWindow';

import { buildSystemPrompt } from '../utils/systemPrompt';
import { useUserProfile } from './useUserProfile';

// Tune these as needed
const HISTORY_LIMIT = { maxCount: 50, maxChars: 8000 };
const CTX_LIMIT     = { maxMessages: 12, maxChars: 1500 };

// Helper: trim arbitrary context lines to CTX_LIMIT
function limitContextLines(lines: string[], limit = CTX_LIMIT): string[] {
  const maxMessages = limit.maxMessages ?? 12;
  const maxChars = limit.maxChars ?? 1500;

  let chars = 0;
  const picked: string[] = [];
  for (let i = lines.length - 1; i >= 0 && picked.length < maxMessages; i--) {
    const line = lines[i] ?? '';
    if (!line) continue;
    if (chars + line.length > maxChars) break;
    picked.push(line);
    chars += line.length;
  }
  return picked.reverse();
}

export function useVoiceControl(
  onResponses: (responses: GenerateResponse) => void,
  onLoadingChange?: (loading: boolean) => void,
  externalContext?: string[],              // NEW: pass Firestore-built history (e.g., guest:/user: lines)
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
  const stableOnResponses = useRef(onResponses);
  const safeOnLoadingChange = useRef(onLoadingChange ?? (() => {}));
  const externalContextRef = useRef<string[]>(externalContext || []);

  // STT
  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Profile → system prompt
  const { profile } = useUserProfile();
  const SYSTEM_PROMPT = React.useMemo(
    () => buildSystemPrompt(profile),
    [profile?.tone, profile?.description]
  );

  // keep refs fresh
  useEffect(() => { stableOnResponses.current = onResponses; }, [onResponses]);
  useEffect(() => { safeOnLoadingChange.current = onLoadingChange ?? (() => {}); }, [onLoadingChange]);
  useEffect(() => { externalContextRef.current = externalContext || []; }, [externalContext]);

  const clearContext = useCallback(() => {
    historyRef.current.length = 0; // wipe the local context window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('context:cleared'));
    }
  }, []);

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
    safeOnLoadingChange.current(false);
    clearContext();

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

  // Single processing path for final utterances (from silence OR direct event)
  const processUtterance = useCallback(async (finalText: string) => {
    const text = (finalText || '').trim();
    if (!text) return;
    if (processingTranscript.current) return;

    processingTranscript.current = true;
    safeOnLoadingChange.current(true);

    try {
      // 1) Append the guest message in-place (sliding window)
      const guestMsg: MessageHistoryItem = {
        sender: 'guest',
        content: text,
        createdAt: new Date().toISOString(),
      };
      appendWithSlidingWindow(historyRef.current, guestMsg, HISTORY_LIMIT);

      // 2) Build the (read-only) context from the bounded local history
      const localCtx = buildContextWindow(historyRef.current, CTX_LIMIT);

      // 3) Merge external Firestore context (older convo) + localCtx (this session)
      const mergedCtx = limitContextLines(
        [...(externalContextRef.current || []), ...localCtx],
        CTX_LIMIT
      );

      console.log('Context for AI (merged):', mergedCtx);

      // 4) Call model with context
      const responses: GenerateResponse = await getCandidates(
        text,
        SYSTEM_PROMPT,
        mergedCtx,
        { k: 6 }
      );

      console.log('AI responses:', responses);
      // 5) Deliver to UI
      stableOnResponses.current(responses);
    } catch (err) {
      console.error('Error getting responses:', err);
    } finally {
      processingTranscript.current = false;
      safeOnLoadingChange.current(false);
    }
  }, [SYSTEM_PROMPT]);

  // Silence → finalize (kept your behavior, now calls unified processUtterance)
  useEffect(() => {
    if (!isConversationActive || !listening || speaking) return;

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
    }

    if (transcript.trim()) {
      silenceTimer.current = setTimeout(async () => {
        // Stop listening while we process the current turn
        SpeechRecognition.stopListening();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('stt:finalTranscript', { detail: transcript.trim() })
          );
        }
        setListening(false);
        setHasSoundLeeway(false);

        // The actual processing happens in the event listener below
      }, 2000);
    }

    return () => {
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
    };
  }, [transcript, listening, speaking, isConversationActive]);

  // NEW: also react to externally fired 'stt:finalTranscript' (e.g., autostart from /general → /home)
  useEffect(() => {
    const onFinal = (e: Event) => {
      const text = (e as CustomEvent<string>).detail || '';
      processUtterance(text);
    };
    window.addEventListener('stt:finalTranscript', onFinal);
    return () => window.removeEventListener('stt:finalTranscript', onFinal);
  }, [processUtterance]);

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
