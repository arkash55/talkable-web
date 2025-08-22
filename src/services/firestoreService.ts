'use client';

// Firestore service for Next.js + TypeScript
// Unified schema: text-only messages, unified `senderId`, no presence.

if (typeof window === 'undefined') {
  throw new Error('firestoreService is client-only. Use Admin SDK on the server.');
}

import {
  serverTimestamp,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as qLimit,
  startAfter,
  onSnapshot,
  writeBatch,
  runTransaction,
  DocumentData,
  Query,
  CollectionReference,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/fireBaseConfig';
import { getAuth, signOut } from 'firebase/auth';

// ---------- Types (mirror your schema) ----------
export type ConversationMode = 'live' | 'online';

export type UserProfile = {
  firstName: string;
  lastName: string;
  pronouns: string;
  tone: string;
  voice: string;
  description: string;
  email: string;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
};

export type Conversation = {
  mode: ConversationMode;
  title: string | null;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  createdBy: string; // uid
  members: Record<string, true>;
  memberIds: string[];
  lastMessage?: {
    id: string;
    text: string;
    sentAt: Timestamp | ReturnType<typeof serverTimestamp>;
    senderId: string; // uid OR "guest"
  };
  lastMessageAt?: Timestamp | ReturnType<typeof serverTimestamp>;
};

export type Message = {
  text: string;
  sentAt: Timestamp | ReturnType<typeof serverTimestamp>;
  senderId: string; // uid or "guest"
};

export type InboxItem = {
  mode: ConversationMode;
  title: string | null;
  lastMessagePreview: string;
  lastMessageAt: Timestamp | ReturnType<typeof serverTimestamp>;
  lastReadAt: Timestamp | null | ReturnType<typeof serverTimestamp>;
  lastMessageSenderId: string | null; // <-- single source of truth (uid or 'guest')
};

// ---------- Path helpers ----------
const usersCol = () => collection(db, 'users');
const userDoc = (uid: string) => doc(db, 'users', uid);

const conversationsCol = () => collection(db, 'conversations');
const conversationDoc = (cid: string) => doc(db, 'conversations', cid);
const messagesCol = (cid: string) => collection(db, 'conversations', cid, 'messages');

const userInboxCol = (uid: string) => collection(db, 'userConversations', uid, 'items');
const userInboxDoc = (uid: string, cid: string) => doc(db, 'userConversations', uid, 'items', cid);

// ---------- Small utils ----------
const preview = (text: string, max = 120) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

// =====================================================
// Users
// =====================================================

export async function addUser(uid: string, data: Omit<UserProfile, 'createdAt'>) {
  await setDoc(
    userDoc(uid),
    {
      ...data,
      createdAt: serverTimestamp(),
    } as UserProfile,
    { merge: true }
  );
}

export async function updateUser(uid: string, updates: Partial<Omit<UserProfile, 'createdAt'>>) {
  await updateDoc(userDoc(uid), updates as Partial<UserProfile>);
}

export async function deleteUser(uid: string) {
  await deleteDoc(userDoc(uid));
  await batchDeleteCollection(userInboxCol(uid) as CollectionReference<DocumentData>);
}


export async function getUsers(options?: {
  excludeUid?: string;
  search?: string;
  limit?: number;
}): Promise<UserDirectoryEntry[]> {
  const excludeUid = options?.excludeUid?.trim() || '';
  const search = (options?.search || '').trim().toLowerCase();
  const limitN = Math.max(1, Math.min(options?.limit ?? 500, 2000)); // safety cap

  // Basic capped scan; adjust to indexed prefix queries if you maintain `emailLower` fields.
  const qRef = query(usersCol(), qLimit(limitN));
  const snap = await getDocs(qRef);

  const rows: UserDirectoryEntry[] = [];
  snap.forEach((d) => {
    if (excludeUid && d.id === excludeUid) return;

    const data = d.data() as any;
    const entry: UserDirectoryEntry = {
      uid: d.id,
      email: data?.email ?? data?.contact?.email ?? undefined,
      firstName: data?.firstName,
      lastName: data?.lastName,
      pronouns: data?.pronouns,
      description: data?.description,
      createdAt: data?.createdAt,
    };

    if (search) {
      const hay =
        `${entry.firstName ?? ''} ${entry.lastName ?? ''} ${entry.email ?? ''}`
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
      if (!hay.includes(search)) return;
    }

    rows.push(entry);
  });

  rows.sort((a, b) => {
    const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
    const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim().toLowerCase();
    if (an && bn && an !== bn) return an.localeCompare(bn);
    const ae = (a.email ?? '').toLowerCase();
    const be = (b.email ?? '').toLowerCase();
    return ae.localeCompare(be);
  });

  return rows;
}


// =====================================================
// Conversations
// =====================================================

export async function createOnlineConversation(params: {
  creatorUid: string;
  otherUid: string;
  title?: string | null;
}): Promise<string> {
  const { creatorUid, otherUid, title = null } = params;

  const cid = await runTransaction(db, async (tx) => {
    const cRef = doc(conversationsCol());
    const convo: Conversation = {
      mode: 'online',
      title,
      createdAt: serverTimestamp(),
      createdBy: creatorUid,
      members: { [creatorUid]: true, [otherUid]: true },
      memberIds: [creatorUid, otherUid],
    };
    tx.set(cRef, convo);

    const baseInbox: InboxItem = {
      mode: 'online',
      title,
      lastMessagePreview: '',
      lastMessageAt: serverTimestamp(),
      lastReadAt: null as any,
      lastMessageSenderId: null, // no message yet
    };

    tx.set(userInboxDoc(creatorUid, cRef.id), baseInbox);
    tx.set(userInboxDoc(otherUid, cRef.id), baseInbox);

    return cRef.id;
  });

  return cid;
}

export async function createLiveConversation(params: { ownerUid: string; title?: string | null }): Promise<string> {
  const { ownerUid, title = null } = params;

  const ref = await addDoc(conversationsCol(), {
    mode: 'live',
    title,
    createdAt: serverTimestamp(),
    createdBy: ownerUid,
    members: { [ownerUid]: true },
    memberIds: [ownerUid],
  } as Conversation);

  await setDoc(
    userInboxDoc(ownerUid, ref.id),
    {
      mode: 'live',
      title,
      lastMessagePreview: '',
      lastMessageAt: serverTimestamp(),
      lastReadAt: null,
      lastMessageSenderId: null, // no messages yet
    } as InboxItem,
    { merge: true }
  );

  return ref.id;
}

export async function deleteConversation(cid: string) {
  const cSnap = await getDoc(conversationDoc(cid));
  if (!cSnap.exists()) return;

  const convo = cSnap.data() as Conversation;
  const memberIds = convo.memberIds ?? [];

  await batchDeleteCollection(messagesCol(cid) as CollectionReference<DocumentData>);

  for (const uid of memberIds) {
    await deleteDoc(userInboxDoc(uid, cid));
  }

  await deleteDoc(conversationDoc(cid));
}

/**
 * Real-time inbox for a user (new/updated conversations).
 */
export function onInbox(
  uid: string,
  callback: (items: Array<{ id: string } & InboxItem>) => void,
  options?: { mode?: ConversationMode; pageSize?: number }
) {
  const pageSize = options?.pageSize ?? 50;

  let qRef = query(userInboxCol(uid), orderBy('lastMessageAt', 'desc'), qLimit(pageSize));
  if (options?.mode) qRef = query(qRef, where('mode', '==', options.mode));

  return onSnapshot(qRef, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as InboxItem) }));
    callback(items);
  });
}

// =====================================================
// Messages
// =====================================================

export async function sendMessage(params: { cid: string; senderId: string; text: string }) {
  const { cid, senderId, text } = params;

  await runTransaction(db, async (tx) => {
    const cRef = conversationDoc(cid);
    const cSnap = await tx.get(cRef);
    if (!cSnap.exists()) throw new Error('Conversation not found');

    const convo = cSnap.data() as Conversation;

    if (convo.mode === 'online') {
      if (!convo.members[senderId]) throw new Error('Sender is not a member of this online conversation');
    } else {
      const ownerUid = convo.memberIds[0];
      if (!(senderId === ownerUid || senderId === 'guest')) throw new Error('Invalid sender for live conversation');
    }

    const mRef = doc(messagesCol(cid));
    tx.set(mRef, { text, sentAt: serverTimestamp(), senderId } as Message);

    tx.update(cRef, {
      lastMessage: { id: mRef.id, text, sentAt: serverTimestamp(), senderId },
      lastMessageAt: serverTimestamp(),
    } as Partial<Conversation>);

    const pv = preview(text);

    for (const uid of convo.memberIds) {
      const inboxRef = userInboxDoc(uid, cid);
      tx.set(
        inboxRef,
        {
          mode: convo.mode,
          title: convo.title ?? null,
          lastMessagePreview: pv,
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: senderId, // uid or 'guest'
        } as Partial<InboxItem>,
        { merge: true }
      );
    }
  });
}

// =====================================================
// Convenience
// =====================================================

export async function getInboxPage(params: {
  uid: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  mode?: ConversationMode;
}) {
  const { uid, pageSize = 25, cursor = null, mode } = params;

  let qRef = query(userInboxCol(uid), orderBy('lastMessageAt', 'desc'), qLimit(pageSize));
  if (mode) qRef = query(qRef, where('mode', '==', mode));
  if (cursor) qRef = query(qRef, startAfter(cursor));

  const snap = await getDocs(qRef);
  return {
    docs: snap.docs,
    items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as InboxItem) })),
    nextCursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

export function onMessages(cid: string, callback: (msgs: Array<{ id: string } & Message>) => void, pageSize = 50) {
  const baseQ: Query<DocumentData> = query(messagesCol(cid), orderBy('sentAt', 'asc'), qLimit(pageSize));
  return onSnapshot(baseQ, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
    callback(msgs);
  });
}

// =====================================================
// Internal: batch delete helper
// =====================================================

async function batchDeleteCollection(colRef: CollectionReference<DocumentData>, pageSize = 300) {
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const baseQ: Query<DocumentData> = query(colRef, qLimit(pageSize));
    const qRef: Query<DocumentData> = cursor ? query(baseQ, startAfter(cursor)) : baseQ;

    const snap = await getDocs(qRef);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
}

// Marks user offline (best effort) then signs out
export async function logoutUser(): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  try {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          online: false,
          lastLogoutAt: serverTimestamp(),
        });
      } catch {
        // non-fatal if user doc missing or permission denied
      }
    }
    await signOut(auth);
  } catch (err) {
    // bubble to caller so UI can show feedback
    throw err;
  }
}
