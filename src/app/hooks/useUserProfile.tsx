'use client';

import * as React from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';

import type { UserProfile } from '@/services/firestoreService';
import { db } from '../../../lib/fireBaseConfig';

export type SlimProfile = Pick<UserProfile, 'firstName' | 'lastName' | 'description' | 'tone' | 'voice'> & {
  _updatedAt?: number; // millis (for cache freshness)
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(uid: string) {
  return `tp.userProfile.${uid}`;
}

function loadCache(uid: string): SlimProfile | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const data = JSON.parse(raw) as SlimProfile;
    if (!data?._updatedAt) return data;
    const fresh = Date.now() - data._updatedAt < CACHE_TTL_MS;
    return fresh ? data : data; // we still return; Firestore will revalidate
  } catch {
    return null;
  }
}

function saveCache(uid: string, profile: SlimProfile) {
  try {
    const payload = JSON.stringify({ ...profile, _updatedAt: Date.now() });
    localStorage.setItem(cacheKey(uid), payload);
  } catch {}
}

export function useUserProfile() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<SlimProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // watch auth
  React.useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setError(null);
      setLoading(true);
      setProfile(null);

      // seed from cache quickly
      if (user?.uid) {
        const cached = loadCache(user.uid);
        if (cached) {
          setProfile(cached);
          setLoading(false); // show UI immediately; snapshot will refine
        }
      }
    });
  }, []);

  // subscribe to profile doc when uid is present
  React.useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as UserProfile;
        const slim: SlimProfile = {
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          description: data.description ?? '',
          tone: data.tone ?? '',
          voice: data.voice ?? '',
          _updatedAt: (data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now()),
        };
        setProfile(slim);
        saveCache(uid, slim);
        setLoading(false);
      },
      (err) => {
        console.error('profile subscribe error', err);
        setError(err?.message || 'Failed to load profile');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { uid, profile, loading, error };
}
