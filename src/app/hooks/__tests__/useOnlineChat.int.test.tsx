import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Granite (avoid network)
// ─────────────────────────────────────────────────────────────────────────────
const getCandidatesMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/graniteClient', () => ({
  getCandidates: getCandidatesMock,
}));

// ─────────────────────────────────────────────────────────────────────────────
/** Prevent real Firebase init */
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('@/lib/fireBaseConfig', () => ({ app: {}, auth: {}, db: {}, storage: {} }));

// ─────────────────────────────────────────────────────────────────────────────
// Firestore mock (in-memory) — supports both collection() overloads
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('firebase/firestore', () => {
  type Msg = { id: string; text: string; senderId: string; sentAt: any };

  const byConv = new Map<string, Msg[]>();            // convId -> messages[]
  const listeners = new Map<string, Set<Function>>(); // convId -> Set(callback)
  const docsStore = new Map<string, any>();           // docPath -> data

  const Timestamp = {
    now() {
      const d = new Date();
      return { toMillis: () => +d, toDate: () => d };
    },
    fromDate(d: Date) {
      return { toMillis: () => +d, toDate: () => d };
    },
  };

  const persistentSingleTabManager = (_opts?: any) => ({ __singleTab: true });
  const persistentLocalCache = (_opts?: any) => ({ __localCache: true });
  const limit = (n: number) => ({ __limit: n });

  function ensureConv(cid: string) {
    if (!byConv.has(cid)) byConv.set(cid, []);
    if (!listeners.has(cid)) listeners.set(cid, new Set());
  }

  function emit(cid: string) {
    const msgs = (byConv.get(cid) ?? []).slice().sort((a, b) => {
      const am = a.sentAt?.toMillis?.() ?? 0;
      const bm = b.sentAt?.toMillis?.() ?? 0;
      return am - bm;
    });
    const docs = msgs.map((m) => ({ id: m.id, data: () => m }));
    const snap = { docs };
    for (const cb of listeners.get(cid) ?? []) cb(snap);
  }

  return {
    // Config-time APIs used by your app
    initializeFirestore: (_app: any, _opts?: any) => ({}),
    getFirestore: () => ({}),
    persistentLocalCache,
    persistentSingleTabManager,
    Timestamp,
    limit,

    // Refs
    doc: (_db: any, col: string, id: string) => ({ __type: 'doc', path: `${col}/${id}`, col, id }),

    // Support BOTH overloads:
    //  A) collection(db, 'conversations', cid, 'messages')
    //  B) collection(docRef, 'messages')
    collection: (first: any, ...segments: string[]) => {
      // Overload B: collection(docRef, 'messages')
      if (first && first.__type === 'doc') {
        const docRef = first; // { __type:'doc', path:'conversations/<cid>', id:'<cid>' }
        const [sub] = segments;
        if (sub !== 'messages') throw new Error('Only messages subcollection supported');
        const cid = docRef.id ?? String(docRef.path).split('/')[1];
        return { __type: 'col', path: `${docRef.path}/${sub}`, cid, sub };
      }

      // Overload A: collection(db, 'conversations', cid, 'messages')
      const [root, cid, sub] = segments;
      if (root !== 'conversations') throw new Error('Expected conversations root');
      if (sub && sub !== 'messages') throw new Error('Only messages subcollection supported');
      return { __type: 'col', path: segments.join('/'), cid, sub };
    },

    // Query helpers (no-ops in this mock)
    query: (ref: any, ..._clauses: any[]) => ref,
    orderBy: (_f: string, _d?: 'asc' | 'desc') => ({ __orderBy: true }),
    where: (..._args: any[]) => ({ __where: true }),

    // Reads
    onSnapshot: (ref: any, cb: Function) => {
      if (ref?.sub !== 'messages') throw new Error('Only messages onSnapshot supported');
      const cid = ref.cid as string;
      ensureConv(cid);
      listeners.get(cid)!.add(cb);
      // initial emit
      emit(cid);
      return () => listeners.get(cid)!.delete(cb);
    },

    // Optional: getDoc for services that read docs directly
    getDoc: async (ref: any) => {
      const data = docsStore.get(ref.path);
      return { exists: () => Boolean(data), data: () => data, id: ref.id };
    },

    // Writes
    setDoc: async (ref: any, data: any) => {
      docsStore.set(ref.path, { ...(docsStore.get(ref.path) || {}), ...data });
    },
    updateDoc: async (ref: any, data: any) => {
      const prev = docsStore.get(ref.path) || {};
      docsStore.set(ref.path, { ...prev, ...data });
    },
    serverTimestamp: () => ({ __serverTimestamp: true }),

    addDoc: async (colRef: any, data: any) => {
      const cid = colRef.cid as string;
      ensureConv(cid);
      const id = `m${(byConv.get(cid)!.length + 1).toString()}`;
      const sentAt = data.sentAt?.__serverTimestamp ? Timestamp.now() : data.sentAt ?? Timestamp.now();
      const msg: Msg = {
        id,
        text: data.text ?? data.content ?? '',
        senderId: data.senderId ?? data.sender ?? 'unknown',
        sentAt,
      };
      byConv.get(cid)!.push(msg);
      emit(cid);
      return { id };
    },

    // Transactions
    runTransaction: async (_db: any, updateFn: (tx: any) => any) => {
      const tx = {
        async get(ref: any) {
          const data = docsStore.get(ref.path);
          return { exists: () => Boolean(data), data: () => data, id: ref.id };
        },
        async set(ref: any, data: any) {
          docsStore.set(ref.path, { ...(docsStore.get(ref.path) || {}), ...data });
        },
        async update(ref: any, data: any) {
          const prev = docsStore.get(ref.path) || {};
          docsStore.set(ref.path, { ...prev, ...data });
        },
      };
      return await updateFn(tx);
    },

    // Test helpers
    __seedMessage: (cid: string, id: string, data: any) => {
      ensureConv(cid);
      const msg: Msg = {
        id,
        text: data.text ?? '',
        senderId: data.senderId ?? 'x',
        sentAt: data.sentAt ?? Timestamp.now(),
      };
      byConv.get(cid)!.push(msg);
      emit(cid);
    },

    __seedConversation: (cid: string, data?: any) => {
      // Satisfy both “online” (members map) and “live” (memberIds array) checks
      const seeded = {
        id: cid,
        memberIds: ['u1'],     // current user from auth mock
        members: { u1: true },
        __seeded: true,
        ...(data ?? {}),
      };
      docsStore.set(`conversations/${cid}`, seeded);

      if (!byConv.has(cid)) byConv.set(cid, []);
      if (!listeners.has(cid)) listeners.set(cid, new Set());
    },

    __clear: () => {
      byConv.clear();
      listeners.clear();
      docsStore.clear();
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
/** Auth + Profile mocks */
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1' } }),
}));

vi.mock('@/app/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: { tone: 'warm', description: '' } }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SUT + helpers from mocked module
// ─────────────────────────────────────────────────────────────────────────────
import { useOnlineChat } from '../useOnlineChat';
import * as FS from 'firebase/firestore';
const FSTimestamp = FS.Timestamp as any;
const seedMessage = (FS as any).__seedMessage as (cid: string, id: string, data: any) => void;
const seedConversation = (FS as any).__seedConversation as (cid: string, data?: any) => void;
const clearAll = (FS as any).__clear as () => void;

// Test harness to render the hook
function Harness({ cid }: { cid: string }) {
  const { messages, sendTextMessage, waitingForOther } = useOnlineChat(cid as any);
  (window as any).__send = (t: string) => sendTextMessage?.(t);
  return (
    <div>
      <div data-testid="cid">{cid}</div>
      <div data-testid="count">{messages?.length ?? 0}</div>
      <div data-testid="waiting">{String(Boolean((waitingForOther as any) ?? false))}</div>
      <div data-testid="concat">{(messages ?? []).map((m: any) => m.text || m.content).join('|')}</div>
    </div>
  );
}

beforeEach(() => {
  clearAll();
  getCandidatesMock.mockReset();
  getCandidatesMock.mockResolvedValue({
    candidates: [{ text: 'OK' }],
    meta: { model_id: 'test' },
  });
});

describe('useOnlineChat (integration)', () => {
  it('subscribes to messages and sorts by sentAt (oldest→newest)', async () => {
    const cid = 'c1';
    const now = new Date();
    const t1 = FSTimestamp.fromDate(new Date(now.getTime() - 1000));
    const t2 = FSTimestamp.fromDate(new Date(now.getTime() + 1000));

    seedMessage(cid, 'a', { text: 'Older', senderId: 'uX', sentAt: t1 });
    seedMessage(cid, 'b', { text: 'Newer', senderId: 'uY', sentAt: t2 });

    render(<Harness cid={cid} />);

    expect(await screen.findByTestId('count')).toHaveTextContent('2');
    expect(screen.getByTestId('concat').textContent).toBe('Older|Newer');
  });

//   it('sendTextMessage appends a message and updates subscription', async () => {
//     const cid = 'c2';
//     seedConversation(cid, {}); // ensure conversation exists
//     render(<Harness cid={cid} />);

//     // initially 0
//     expect(screen.getByTestId('count')).toHaveTextContent('0');

//     // wait until hook exposes sendTextMessage
//     await waitFor(() => {
//       expect(typeof (window as any).__send).toBe('function');
//     });

//     // send a message
//     await act(async () => {
//       (window as any).__send('Hello world');
//     });

//     // await async update
//     expect(await screen.findByTestId('count')).toHaveTextContent('1');
//     expect(screen.getByTestId('concat').textContent).toBe('Hello world');
//     expect(screen.getByTestId('waiting').textContent).toMatch(/^(true|false)$/);
//   });

  it('switching conversation id re-subscribes to the new one', async () => {
    const cid1 = 'cA';
    const cid2 = 'cB';
    seedMessage(cid1, 'm1', { text: 'From A', senderId: 'u2' });
    seedMessage(cid2, 'm1', { text: 'From B', senderId: 'u3' });

    const { rerender } = render(<Harness cid={cid1} />);
    expect(await screen.findByTestId('concat')).toHaveTextContent('From A');

    rerender(<Harness cid={cid2} />);
    expect(await screen.findByTestId('concat')).toHaveTextContent('From B');
  });
});
