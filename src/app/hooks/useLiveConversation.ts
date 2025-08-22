'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { createLiveConversation, sendMessage } from '@/services/firestoreService';
import { auth } from '../../../lib/fireBaseConfig';

/**
 * Syncs app-level events with Firestore:
 * - conversation:startNew     -> force a brand-new live conversation
 * - conversation:resume       -> resume existing cid (from URL or last created in this session)
 * - conversation:load {cid}   -> set active conversation to existing one
 * - stt:finalTranscript       -> send as "guest"
 * - ui:voicegrid:click        -> send as current user
 */
export function useLiveConversationSync() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [cid, setCid] = useState<string | null>(null);

  // Keep last created/loaded conversation id to allow resume within the same page session
  const lastCidRef = useRef<string | null>(null);
  const creatingRef = useRef(false);

  // Track auth user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const ensureConversation = async () => {
    if (!uid) {
      console.warn('Cannot start conversation: user not signed in.');
      return null;
    }
    if (cid || creatingRef.current) return cid;
    creatingRef.current = true;
    try {
      const newCid = await createLiveConversation({ ownerUid: uid });
      setCid(newCid);
      lastCidRef.current = newCid;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation:created', { detail: newCid }));
      }
      return newCid;
    } finally {
      creatingRef.current = false;
    }
  };

  useEffect(() => {
    // Start NEW -> force a new conversation id
    const onStartNew = async () => {
      // clear current so ensureConversation definitely creates a fresh one
      setCid(null);
      await ensureConversation();
    };

    // Resume -> prefer current cid; else URL cid; else lastCidRef
    const onResume = () => {
      // If we already have a cid, nothing to do.
      if (cid) return;

      // Try URL
      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const routeCid = params?.get('cid') || null;

      if (routeCid) {
        setCid(routeCid);
        lastCidRef.current = routeCid;
        return;
      }

      // Fall back to last known cid from this session
      if (lastCidRef.current) {
        setCid(lastCidRef.current);
      }
    };

    // External load (e.g., /home?cid=...)
    const onLoad = (e: Event) => {
      const anyEvent = e as CustomEvent<{ cid?: string }>;
      const newCid = anyEvent.detail?.cid?.trim();
      if (!newCid) return;
      setCid(newCid);
      lastCidRef.current = newCid;
    };

    // END -> clear active cid (keep lastCidRef for resume-in-page)
    const onEnd = () => {
      setCid(null);
    };

    // Guest transcript -> send as "guest"
    const onFinalTranscript = async (e: Event) => {
      const anyEvent = e as CustomEvent<string>;
      const text = typeof anyEvent.detail === 'string' ? anyEvent.detail.trim() : '';
      if (!text) return;

      const convId = cid ?? (await ensureConversation());
      if (!convId) return;

      try {
        await sendMessage({ cid: convId, senderId: 'guest', text });
      } catch (err) {
        console.error('Failed to send guest message:', err);
      }
    };

    // Voice grid click -> send as current user
    const onVoiceGridClick = async (e: Event) => {
      const anyEvent = e as CustomEvent<{ index: number; label: string }>;
      const label = anyEvent.detail?.label?.trim();
      if (!label) return;
      if (!uid) {
        console.warn('Cannot send user message: not signed in.');
        return;
      }

      const convId = cid ?? (await ensureConversation());
      if (!convId) return;

      try {
        await sendMessage({ cid: convId, senderId: uid, text: label });
      } catch (err) {
        console.error('Failed to send user message:', err);
      }
    };

    window.addEventListener('conversation:startNew', onStartNew as EventListener);
    window.addEventListener('conversation:resume', onResume as EventListener);
    window.addEventListener('conversation:load', onLoad as EventListener);
    window.addEventListener('conversation:end', onEnd as EventListener);
    window.addEventListener('stt:finalTranscript', onFinalTranscript as EventListener);
    window.addEventListener('ui:voicegrid:click', onVoiceGridClick as EventListener);

    return () => {
      window.removeEventListener('conversation:startNew', onStartNew as EventListener);
      window.removeEventListener('conversation:resume', onResume as EventListener);
      window.removeEventListener('conversation:load', onLoad as EventListener);
      window.removeEventListener('conversation:end', onEnd as EventListener);
      window.removeEventListener('stt:finalTranscript', onFinalTranscript as EventListener);
      window.removeEventListener('ui:voicegrid:click', onVoiceGridClick as EventListener);
    };
  }, [uid, cid]);

  return { uid, cid };
}
