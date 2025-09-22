'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { createLiveConversation, sendMessage } from '@/services/firestoreService';
import { auth } from '../../../lib/fireBaseConfig';



type GlobalSync = {
  listenersRegistered: boolean;
  creating: boolean;
  creationPromise: Promise<string | null> | null;
  lastCid: string | null;

  
  recent: Map<string, number>;
  pendingKeys: Set<string>;

  
  recentTextByCid: Map<string, number>;

  recentTtlMs: number;
  uid: string | null; 
};

function getGlobalSync(): GlobalSync {
  if (typeof window === 'undefined') {
    return {
      listenersRegistered: false,
      creating: false,
      creationPromise: null,
      lastCid: null,
      recent: new Map(),
      pendingKeys: new Set(),
      recentTextByCid: new Map(),
      recentTtlMs: 6000,
      uid: null,
    };
  }
  const w = window as any;
  if (!w.__talkableLiveSync3) {
    w.__talkableLiveSync3 = {
      listenersRegistered: false,
      creating: false,
      creationPromise: null,
      lastCid: null,
      recent: new Map(),
      pendingKeys: new Set(),
      recentTextByCid: new Map(),
      recentTtlMs: 6000,
      uid: null,
    } as GlobalSync;
  }
  return w.__talkableLiveSync3 as GlobalSync;
}

export function useLiveConversationSync() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [cid, setCid] = useState<string | null>(null);

  const g = getGlobalSync();

  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      g.uid = u?.uid ?? null;
    });
    
    g.uid = auth.currentUser?.uid ?? null;
    return () => unsub();
  }, []);

  
  useEffect(() => {
    const onCidChange = (e: Event) => {
      const any = e as CustomEvent<{ cid: string | null }>;
      setCid(any.detail?.cid ?? null);
    };
    window.addEventListener('talkable:cidChanged', onCidChange as EventListener);
    return () => window.removeEventListener('talkable:cidChanged', onCidChange as EventListener);
  }, []);

  const now = () => Date.now();

  const keyFor = (event: string, payload: { text?: string; sender?: string; cid?: string | null }) => {
    const t = (payload.text || '').slice(0, 500);
    const s = payload.sender || '';
    const c = payload.cid || '';
    return `${event}|${s}|${c}|${t}`;
  };

  const norm = (s: string) =>
    s
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  
  const markAndCheckRecentGlobal = (key: string): boolean => {
    const tPrev = g.recent.get(key);
    const n = now();
    if (tPrev && n - tPrev < g.recentTtlMs) {
      return false;
    }
    g.recent.set(key, n);
    if (g.recent.size > 500) {
      for (const [k, ts] of g.recent) {
        if (n - ts > g.recentTtlMs) g.recent.delete(k);
      }
    }
    return true;
  };

  
  const dedupeByText = (cidVal: string, text: string): boolean => {
    const ntext = norm(text);
    const composite = `${cidVal}|${ntext}`;
    const tPrev = g.recentTextByCid.get(composite);
    const n = now();
    if (tPrev && n - tPrev < g.recentTtlMs) {
      
      return false;
    }
    g.recentTextByCid.set(composite, n);
    
    if (g.recentTextByCid.size > 1000) {
      for (const [k, ts] of g.recentTextByCid) {
        if (n - ts > g.recentTtlMs) g.recentTextByCid.delete(k);
      }
    }
    return true;
  };

  const withPendingOnce = async <T,>(key: string, fn: () => Promise<T>): Promise<T | null> => {
    if (g.pendingKeys.has(key)) return null; 
    g.pendingKeys.add(key);
    try {
      return await fn();
    } finally {
      g.pendingKeys.delete(key);
    }
  };

  const dispatchCid = (cidVal: string | null) => {
    try {
      const evt = new CustomEvent('talkable:cidChanged', { detail: { cid: cidVal } });
      window.dispatchEvent(evt);
    } catch {}
  };

  const ensureConversation = async (): Promise<string | null> => {
    if (!g.uid) {
      console.warn('Cannot start conversation: user not signed in.');
      return null;
    }
    
    if (g.lastCid) return g.lastCid;

    
    if (g.creating && g.creationPromise) {
      const res = await g.creationPromise;
      return res;
    }

    
    g.creating = true;
    g.creationPromise = (async () => {
      try {
        const newCid = await createLiveConversation({ ownerUid: g.uid! });
        g.lastCid = newCid;
        dispatchCid(newCid);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('conversation:created', { detail: newCid }));
        }
        return newCid;
      } catch (err) {
        console.error('Failed to create conversation:', err);
        return null;
      } finally {
        g.creating = false;
        g.creationPromise = null;
      }
    })();
    return await g.creationPromise;
  };

  
  useEffect(() => {
    if (g.listenersRegistered) return;
    g.listenersRegistered = true;

    const onStartNew = async () => {
      g.lastCid = null;
      dispatchCid(null);
      await ensureConversation();
    };

    const onResume = () => {
      
      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const routeCid = params?.get('cid') || null;
      if (routeCid) {
        g.lastCid = routeCid;
      }
      dispatchCid(g.lastCid ?? null);
    };

    const onLoad = (e: Event) => {
      const anyEvent = e as CustomEvent<{ cid?: string }>;
      const newCid = anyEvent.detail?.cid?.trim() ?? null;
      g.lastCid = newCid;
      dispatchCid(newCid);
    };

    const onEnd = () => {
      
      dispatchCid(null);
    };

    
    const onFinalTranscript = async (e: Event) => {
      const anyEvent = e as CustomEvent<string>;
      const text = typeof anyEvent.detail === 'string' ? anyEvent.detail.trim() : '';
      if (!text) return;

      const convId = g.lastCid ?? (await ensureConversation());
      if (!convId) return;

      
      if (!dedupeByText(convId, text)) return;

      
      const key = keyFor('stt:finalTranscript', { text, sender: 'guest', cid: convId });
      if (!markAndCheckRecentGlobal(key)) return;

      await withPendingOnce(key, async () => {
        await sendMessage({ cid: convId, senderId: 'guest', text });
      });
    };

    
    const onVoiceGridClick = async (e: Event) => {
      const anyEvent = e as CustomEvent<{ index: number; label: string }>;
      const label = anyEvent.detail?.label?.trim();
      if (!label) return;
      if (!g.uid) {
        console.warn('Cannot send user message: not signed in.');
        return;
      }

      const convId = g.lastCid ?? (await ensureConversation());
      if (!convId) return;

      
      if (!dedupeByText(convId, label)) return;

      const key = keyFor('ui:voicegrid:click', { text: label, sender: 'user', cid: convId });
      if (!markAndCheckRecentGlobal(key)) return;

      await withPendingOnce(key, async () => {
        await sendMessage({ cid: convId, senderId: g.uid!, text: label });
      });
    };

    
    const onSeed = async (e: Event) => {
      const any = e as CustomEvent<{ text?: string; sender?: 'user' | 'guest' }>;
      const text = any.detail?.text?.trim();
      const sender = any.detail?.sender || 'guest';
      if (!text) return;

      const convId = g.lastCid ?? (await ensureConversation());
      if (!convId) return;

      
      if (!dedupeByText(convId, text)) return;

      const key = keyFor('conversation:seed', { text, sender, cid: convId });
      if (!markAndCheckRecentGlobal(key)) return;

      await withPendingOnce(key, async () => {
        if (sender === 'user') {
          if (!g.uid) {
            console.warn('Seed intended as user message, but no uid available.');
            return;
          }
          await sendMessage({ cid: convId, senderId: g.uid!, text });
        } else {
          await sendMessage({ cid: convId, senderId: 'guest', text });
        }
      });
    };

    window.addEventListener('conversation:startNew', onStartNew as EventListener);
    window.addEventListener('conversation:resume', onResume as EventListener);
    window.addEventListener('conversation:load', onLoad as EventListener);
    window.addEventListener('conversation:end', onEnd as EventListener);
    window.addEventListener('stt:finalTranscript', onFinalTranscript as EventListener);
    window.addEventListener('ui:voicegrid:click', onVoiceGridClick as EventListener);
    window.addEventListener('conversation:seed', onSeed as EventListener);

    
    return () => {};
    
  }, []);

  
  return { uid, cid };
}
