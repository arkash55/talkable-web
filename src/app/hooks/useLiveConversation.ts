'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { createLiveConversation, sendMessage } from '@/services/firestoreService';
import { auth } from '../../../lib/fireBaseConfig';

/**
 * Listens to app-level events and syncs with Firestore:
 * - conversation:start      -> ensures live conversation exists (respects preloaded cid)
 * - conversation:load {cid} -> sets current conversation to an existing one
 * - stt:finalTranscript     -> sends message as "guest"
 * - ui:voicegrid:click      -> sends message as the current user
 *
 * Also self-inits from the URL (?cid=...) on mount and on popstate navigation.
 */
export function useLiveConversationSync() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [cid, setCid] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // Track auth user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // On mount: read ?cid=... directly from location to avoid any race
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialCid = params.get('cid');
    if (initialCid) setCid(initialCid);

    // Re-read on browser nav (back/forward)
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const c = p.get('cid');
      setCid(c || null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Ensure live conversation (respects existing cid)
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

      // Optional broadcast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation:created', { detail: newCid }));
      }
      return newCid;
    } finally {
      creatingRef.current = false;
    }
  };

  useEffect(() => {
    // START -> ensure a live conversation exists; do NOT clear preloaded cid
    const onStart = async () => {
      await ensureConversation();
    };

    // END -> clear current conversation id (end the session)
    const onEnd = () => {
      setCid(null);
    };

    // LOAD -> pick a specific existing conversation id (from route or UI)
    const onLoad = (e: Event) => {
      const anyEvent = e as CustomEvent<{ cid?: string }>;
      const newCid = anyEvent.detail?.cid?.trim();
      if (!newCid) return;
      setCid(newCid);
    };

    // Guest transcript sends message as "guest"
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

    // Voice grid click sends message as current user
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

    window.addEventListener('conversation:start', onStart as EventListener);
    window.addEventListener('conversation:end', onEnd as EventListener);
    window.addEventListener('conversation:load', onLoad as EventListener);
    window.addEventListener('stt:finalTranscript', onFinalTranscript as EventListener);
    window.addEventListener('ui:voicegrid:click', onVoiceGridClick as EventListener);

    return () => {
      window.removeEventListener('conversation:start', onStart as EventListener);
      window.removeEventListener('conversation:end', onEnd as EventListener);
      window.removeEventListener('conversation:load', onLoad as EventListener);
      window.removeEventListener('stt:finalTranscript', onFinalTranscript as EventListener);
      window.removeEventListener('ui:voicegrid:click', onVoiceGridClick as EventListener);
    };
  }, [uid, cid]);

  return { uid, cid };
}
