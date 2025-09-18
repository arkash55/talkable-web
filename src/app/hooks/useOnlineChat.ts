'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { onMessages, sendMessage } from '@/services/firestoreService';
import { getCandidates } from '@/services/graniteClient';
import {
  appendWithSlidingWindow,
  buildContextWindow,
  type MessageHistoryItem,
} from '@/app/utils/contextWindow';
import { Candidate } from '@/services/graniteService';
import { buildSystemPrompt } from '../utils/systemPrompt';
import { useUserProfile } from './useUserProfile';

type UseOnlineChatReturn = {
  aiResponses: Candidate[];
  messages: Array<{ id: string; text: string; senderId: string; sentAt?: Date }>;
  sendTextMessage: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
};

const HISTORY_LIMIT = { maxCount: 200, maxChars: 12000 };
const CTX_LIMIT = { maxMessages: 12, maxChars: 1500 };

export function useOnlineChat(cid: string | null): UseOnlineChatReturn {
  const [aiResponses, setAiResponses] = useState<Candidate[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; text: string; senderId: string; sentAt?: Date }>>([]);

  const myUid = useMemo(() => getAuth().currentUser?.uid ?? null, []);
  const historyRef = useRef<MessageHistoryItem[]>([]);
  const lastGeneratedForMsgId = useRef<string | null>(null);
  const generating = useRef<boolean>(false);

    const { profile } = useUserProfile();
    const SYSTEM_PROMPT = useMemo(
      () => buildSystemPrompt(profile),
      [profile?.tone, profile?.description]
    );

  // Helper: rebuild sliding history (idempotent) from Firestore messages
  const rebuildHistory = (arr: Array<{ id: string; text: string; senderId: string }>) => {
    historyRef.current.length = 0; // clear
    for (const m of arr) {
      appendWithSlidingWindow(
        historyRef.current,
        {
          sender: m.senderId === myUid ? 'user' : 'guest',
          content: m.text,
          createdAt: new Date().toISOString(),
        },
        HISTORY_LIMIT
      );
    }
  };

  // Generate suggestions based on last message
  const generateForLast = async () => {
    if (!cid || generating.current) return;
    if (!messages.length) return;

    const last = messages[messages.length - 1];
    if (lastGeneratedForMsgId.current === last.id) return;

    const lastFromMe = last.senderId === myUid;

    // 🔒 NEW: If the last message was from *me*, DO NOT CALL THE API.
    // Also clear any stale suggestions and mark this message as handled.
    if (lastFromMe) {
      setAiResponses([]);
      lastGeneratedForMsgId.current = last.id;
      return;
    }

    generating.current = true;
    try {
      const ctx = buildContextWindow(historyRef.current, CTX_LIMIT);

      // For other-user last message → normal assistant suggestions
      const system = 'You are a helpful, concise chat assistant. Suggest short, natural replies (1–2 sentences). Provide diverse but relevant tones.';
      const prompt = last.text;

      const resp = await getCandidates(prompt, SYSTEM_PROMPT, ctx, {
        k: 6,
        params: { temperature: 0.7, top_p: 0.95, top_k: 50, max_new_tokens: 64 },
      });

      setAiResponses(resp.candidates ?? []);
      lastGeneratedForMsgId.current = last.id;
    } catch (e) {
      console.error('generateForLast error:', e);
    } finally {
      generating.current = false;
    }
  };

  // Real-time subscription to messages
  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(
      cid,
      (fsMsgs) => {
        // Normalize and keep time as Date if available
        const norm = fsMsgs.map((m) => ({
          id: m.id,
          text: m.text,
          senderId: m.senderId,
          sentAt: (m.sentAt as any)?.toDate ? (m.sentAt as any).toDate() : undefined,
        }));
        setMessages(norm);
        rebuildHistory(norm);
      },
      200
    );
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, myUid]);

  // Whenever messages change, try generating
  useEffect(() => {
    if (!cid) return;
    if (!messages.length) return;
    generateForLast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, messages.map(m => m.id).join('|')]);

  // Send text (user typed or STT transcript or clicked candidate)
  const sendTextMessage = async (text: string) => {
    const clean = (text ?? '').trim();
    if (!clean || !cid || !myUid) return;
    await sendMessage({ cid, senderId: myUid, text: clean });
    // subscription will update and will *not* generate suggestions until the other user replies
  };

  const regenerate = async () => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    // Only regenerate if the last message is from the *other user*.
    if (last.senderId === myUid) {
      setAiResponses([]);
      return;
    }
    lastGeneratedForMsgId.current = null;
    await generateForLast();
  };

  return { aiResponses, messages, sendTextMessage, regenerate };
}
