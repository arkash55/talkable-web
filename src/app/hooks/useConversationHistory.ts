'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onMessages } from '@/services/firestoreService';
import { MessageHistoryItem, appendWithSlidingWindow, buildContextWindow } from '../utils/contextWindow';


type LogFn = (e: { type: string; payload?: any }) => void;

export function useConversationHistory(
  cid: string | null,
  opts?: {
    onLog?: LogFn;
    onNewMessages?: (msgs: MessageHistoryItem[]) => void; 
    window?: { maxCount?: number; maxChars?: number };
    context?: { maxMessages?: number; maxChars?: number };
  }
) {
  const [version, setVersion] = useState(0); 
  const historyRef = useRef<MessageHistoryItem[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set()); 

  
  useEffect(() => {
    historyRef.current = [];
    seenKeysRef.current.clear();
    setVersion((v) => v + 1);
    if (cid) {
      opts?.onLog?.({ type: 'history_reset', payload: { cid } });
    }
  }, [cid]);

  
  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(cid, (msgs) => {
      
      const newlyAppended: MessageHistoryItem[] = [];

      for (const m of msgs) {
        const sender = m.senderId === 'guest' ? 'guest' : 'user';
        const content = (m.text || '').trim();
        const createdAt =
          (m as any).sentAt?.toDate?.()?.toISOString?.() ||
          new Date().toISOString();

        
        const key = (m as any).id
          ? String((m as any).id)
          : `${sender}|${createdAt}|${content}`;

        if (seenKeysRef.current.has(key)) {
          continue; 
        }
        seenKeysRef.current.add(key);

        const item: MessageHistoryItem = { sender, content, createdAt };
        appendWithSlidingWindow(historyRef.current, item, opts?.window);
        newlyAppended.push(item);
      }

      if (newlyAppended.length) {
        
        opts?.onNewMessages?.(newlyAppended);

        
        opts?.onLog?.({
          type: 'history_appended',
          payload: { cid, appended: newlyAppended.length, total: historyRef.current.length },
        });
        setVersion((v) => v + 1);
      }
    });

    return () => unsub?.();
    
  }, [cid]);

  const history = historyRef.current;
  const contextLines = useMemo(
    () => buildContextWindow(history, opts?.context),
    
    [version, opts?.context?.maxChars, opts?.context?.maxMessages]
  );

  return { history, contextLines };
}
