// lib/firestoreService.ts
// Firestore service for Next.js + TypeScript
// Unified schema: text-only messages, unified `senderId`, no presence.

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
} from "firebase/firestore";
import { db } from "../../lib/fireBaseConfig";

// ---------- Types (mirror your schema) ----------
export type ConversationMode = "live" | "online";

export type UserProfile = {
  firstName: string;
  lastName: string;
  pronouns: string;
  mood: string;
  description: string;
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
};

// ---------- Path helpers ----------
const usersCol = () => collection(db, "users");
const userDoc = (uid: string) => doc(db, "users", uid);

const conversationsCol = () => collection(db, "conversations");
const conversationDoc = (cid: string) => doc(db, "conversations", cid);
const messagesCol = (cid: string) =>
  collection(db, "conversations", cid, "messages");

const userInboxCol = (uid: string) =>
  collection(db, "userConversations", uid, "items");
const userInboxDoc = (uid: string, cid: string) =>
  doc(db, "userConversations", uid, "items", cid);

// ---------- Small utils ----------
const preview = (text: string, max = 120) =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

// =====================================================
// Users
// =====================================================

/** Add a user profile (idempotent if called with same uid). */
export async function addUser(
  uid: string,
  data: Omit<UserProfile, "createdAt">
) {
  await setDoc(
    userDoc(uid),
    {
      ...data,
      createdAt: serverTimestamp(),
    } as UserProfile,
    { merge: true }
  );
}

/** Update a user profile (partial). */
export async function updateUser(
  uid: string,
  updates: Partial<Omit<UserProfile, "createdAt">>
) {
  await updateDoc(userDoc(uid), updates as Partial<UserProfile>);
}

/** Delete a user profile and their inbox index (does not delete conversations). */
export async function deleteUser(uid: string) {
  // 1) Delete the user document
  await deleteDoc(userDoc(uid));

  // 2) Best-effort cleanup of their inbox items
  await batchDeleteCollection(userInboxCol(uid) as CollectionReference<DocumentData>);
}

// =====================================================
// Conversations
// =====================================================

/** Create an ONLINE conversation for exactly two users. */
export async function createOnlineConversation(params: {
  creatorUid: string;
  otherUid: string;
  title?: string | null;
}): Promise<string> {
  const { creatorUid, otherUid, title = null } = params;

  const cid = await runTransaction(db, async (tx) => {
    const cRef = doc(conversationsCol());
    const convo: Conversation = {
      mode: "online",
      title,
      createdAt: serverTimestamp(),
      createdBy: creatorUid,
      members: { [creatorUid]: true, [otherUid]: true },
      memberIds: [creatorUid, otherUid],
    };
    tx.set(cRef, convo);

    // Initialize inbox entries for both users
    const baseInbox: InboxItem = {
      mode: "online",
      title,
      lastMessagePreview: "",
      lastMessageAt: serverTimestamp(),
      lastReadAt: null as any,
    };
    tx.set(userInboxDoc(creatorUid, cRef.id), baseInbox);
    tx.set(userInboxDoc(otherUid, cRef.id), baseInbox);

    return cRef.id;
  });

  return cid;
}

/** Create a LIVE conversation (single owner). */
export async function createLiveConversation(params: {
  ownerUid: string;
  title?: string | null;
}): Promise<string> {
  const { ownerUid, title = null } = params;

  const ref = await addDoc(conversationsCol(), {
    mode: "live",
    title,
    createdAt: serverTimestamp(),
    createdBy: ownerUid,
    members: { [ownerUid]: true },
    memberIds: [ownerUid],
  } as Conversation);

  // Owner's inbox entry
  await setDoc(
    userInboxDoc(ownerUid, ref.id),
    {
      mode: "live",
      title,
      lastMessagePreview: "",
      lastMessageAt: serverTimestamp(),
      lastReadAt: null,
    } as InboxItem,
    { merge: true }
  );

  return ref.id;
}

/**
 * Delete a conversation and its messages, and remove inbox entries for members.
 * Note: Firestore requires manual subcollection cleanup; this function deletes messages in batches.
 */
export async function deleteConversation(cid: string) {
  // 1) Load conversation to know memberIds
  const cSnap = await getDoc(conversationDoc(cid));
  if (!cSnap.exists()) return;

  const convo = cSnap.data() as Conversation;
  const memberIds = convo.memberIds ?? [];

  // 2) Delete all messages in batches
  await batchDeleteCollection(messagesCol(cid) as CollectionReference<DocumentData>);

  // 3) Delete inbox entries for each member
  for (const uid of memberIds) {
    await deleteDoc(userInboxDoc(uid, cid));
  }

  // 4) Finally delete the conversation document
  await deleteDoc(conversationDoc(cid));
}

/**
 * Listen to a user's inbox (new/updated conversations in real-time).
 * This covers: new messages (lastMessageAt changes) and new conversations started with the user.
 */
export function onInbox(
  uid: string,
  callback: (items: Array<{ id: string } & InboxItem>) => void,
  options?: { mode?: ConversationMode; pageSize?: number }
) {
  const pageSize = options?.pageSize ?? 50;

  let qRef = query(
    userInboxCol(uid),
    orderBy("lastMessageAt", "desc"),
    qLimit(pageSize)
  );

  if (options?.mode) {
    qRef = query(qRef, where("mode", "==", options.mode));
  }

  return onSnapshot(qRef, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as InboxItem),
    }));
    callback(items);
  });
}

// =====================================================
// Messages
// =====================================================

/**
 * Send a text message in either LIVE or ONLINE conversation.
 * - online: senderId must be one of conversation.memberIds
 * - live: senderId may be ownerUid or "guest"
 *
 * This also updates lastMessage/lastMessageAt and mirrors inbox for members.
 */
export async function sendMessage(params: {
  cid: string;
  senderId: string; // uid or "guest"
  text: string;
}) {
  const { cid, senderId, text } = params;

  await runTransaction(db, async (tx) => {
    const cRef = conversationDoc(cid);
    const cSnap = await tx.get(cRef);
    if (!cSnap.exists()) throw new Error("Conversation not found");

    const convo = cSnap.data() as Conversation;

    // Validate sender
    if (convo.mode === "online") {
      if (!convo.members[senderId]) {
        throw new Error("Sender is not a member of this online conversation");
      }
    } else {
      // live: senderId can be owner or "guest"
      const ownerUid = convo.memberIds[0];
      if (!(senderId === ownerUid || senderId === "guest")) {
        throw new Error("Invalid sender for live conversation");
      }
    }

    // 1) add message
    const mRef = doc(messagesCol(cid));
    tx.set(mRef, {
      text,
      sentAt: serverTimestamp(),
      senderId,
    } as Message);

    // 2) update conversation lastMessage
    tx.update(cRef, {
      lastMessage: {
        id: mRef.id,
        text,
        sentAt: serverTimestamp(),
        senderId,
      },
      lastMessageAt: serverTimestamp(),
    } as Partial<Conversation>);

    // 3) mirror to inbox for all members
    const pv = preview(text);
    for (const uid of convo.memberIds) {
      const inboxRef = userInboxDoc(uid, cid);
      const base: Partial<InboxItem> = {
        mode: convo.mode,
        title: convo.title ?? null,
        lastMessagePreview: pv,
        lastMessageAt: serverTimestamp(),
      };
      tx.set(inboxRef, base, { merge: true });
    }
  });
}

// =====================================================
// Optional: convenience fetchers
// =====================================================

/** Fetch a page of inbox items (non-realtime). */
export async function getInboxPage(params: {
  uid: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  mode?: ConversationMode;
}) {
  const { uid, pageSize = 25, cursor = null, mode } = params;

  let qRef = query(
    userInboxCol(uid),
    orderBy("lastMessageAt", "desc"),
    qLimit(pageSize)
  );

  if (mode) qRef = query(qRef, where("mode", "==", mode));
  if (cursor) qRef = query(qRef, startAfter(cursor));

  const snap = await getDocs(qRef);
  return {
    docs: snap.docs,
    items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as InboxItem) })),
    nextCursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

/** Listen to messages in a conversation (ascending by sentAt). */
export function onMessages(
  cid: string,
  callback: (msgs: Array<{ id: string } & Message>) => void,
  pageSize = 50
) {
  const baseQ: Query<DocumentData> = query(
    messagesCol(cid),
    orderBy("sentAt", "asc"),
    qLimit(pageSize)
  );

  return onSnapshot(baseQ, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
    callback(msgs);
  });
}

// =====================================================
// Internal: strongly-typed batch delete helper
// =====================================================

/**
 * Delete documents from a collection in batches using a snapshot cursor.
 * Pass a CollectionReference<DocumentData>, not a path string.
 */
async function batchDeleteCollection(
  colRef: CollectionReference<DocumentData>,
  pageSize = 300
) {
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const baseQ: Query<DocumentData> = query(colRef, qLimit(pageSize));
    const qRef: Query<DocumentData> = cursor
      ? query(baseQ, startAfter(cursor))
      : baseQ;

    const snap = await getDocs(qRef);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
}
