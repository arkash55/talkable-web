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

  
  const rebuildHistory = (arr: Array<{ id: string; text: string; senderId: string }>) => {
    historyRef.current.length = 0; 
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

  
  const generateForLast = async () => {
    if (!cid || generating.current) return;
    if (!messages.length) return;

    const last = messages[messages.length - 1];
    if (lastGeneratedForMsgId.current === last.id) return;

    const lastFromMe = last.senderId === myUid;

    
    
    if (lastFromMe) {
      setAiResponses([]);
      lastGeneratedForMsgId.current = last.id;
      return;
    }

    generating.current = true;
    try {
      const ctx = buildContextWindow(historyRef.current, CTX_LIMIT);

      
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

  
  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(
      cid,
      (fsMsgs) => {
        
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
    
  }, [cid, myUid]);

  
  useEffect(() => {
    if (!cid) return;
    if (!messages.length) return;
    generateForLast();
    
  }, [cid, messages.map(m => m.id).join('|')]);

  
  const sendTextMessage = async (text: string) => {
    const clean = (text ?? '').trim();
    if (!clean || !cid || !myUid) return;
    await sendMessage({ cid, senderId: myUid, text: clean });
    
  };

  const regenerate = async () => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    
    if (last.senderId === myUid) {
      setAiResponses([]);
      return;
    }
    lastGeneratedForMsgId.current = null;
    await generateForLast();
  };

  return { aiResponses, messages, sendTextMessage, regenerate };
}
