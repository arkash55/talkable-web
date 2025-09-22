
import { describe, it, expect, beforeEach, vi } from 'vitest';


vi.mock('firebase/firestore', () => import('../../__mocks__/firebase/firestore'));


vi.mock('../../lib/fireBaseConfig', () => {
  return { db: { __isDb: true } };
});


import {
  doc,
  collection,
  getDoc,
  getDocs,
  serverTimestamp,   
  __resetFirestore,
  __setDoc,
} from 'firebase/firestore';

import {
  addUser,
  updateUser,
  deleteUser,
  getUsers,
  createLiveConversation,
  findOnlineConversationBetweenByMembers,
  createOnlineConversationSafe,
  ensureOnlineConversation,
  deleteConversation,
  onInbox,
  sendMessage,
  getInboxPage,
  onMessages,
  type Conversation,
  type InboxItem,
  type Message,
} from './firestoreService';


const getUserDoc = (uid: string) => doc({ __isDb: true } as any, 'users', uid);
const getConvoDoc = (cid: string) => doc({ __isDb: true } as any, 'conversations', cid);
const userInboxDoc = (uid: string, cid: string) =>
  doc({ __isDb: true } as any, 'userConversations', uid, 'items', cid);
const messagesCol = (cid: string) =>
  collection({ __isDb: true } as any, 'conversations', cid, 'messages');

describe('firestoreService (Firestore-only)', () => {
  beforeEach(() => {
    __resetFirestore();
  });

  
  
  

  it('addUser creates/merges a user with server timestamp', async () => {
    await addUser('u1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      pronouns: 'she/her',
      tone: 'warm',
      voice: 'alto',
      description: 'Math pioneer',
      email: 'ada@example.com',
    });

    const snap = await getDoc(getUserDoc('u1'));
    expect(snap.exists()).toBe(true);
    const data = snap.data()!;
    expect(data.firstName).toBe('Ada');
    expect(data.createdAt).toBeInstanceOf(Date); 
  });

  it('updateUser patches existing user fields', async () => {
    await addUser('u1', {
      firstName: 'A',
      lastName: 'L',
      pronouns: 'she/her',
      tone: 'warm',
      voice: 'alto',
      description: 'x',
      email: 'a@x.com',
    });
    await updateUser('u1', { firstName: 'Ada', description: 'Legend' });
    const data = (await getDoc(getUserDoc('u1'))).data()!;
    expect(data.firstName).toBe('Ada');
    expect(data.description).toBe('Legend');
  });

  it('deleteUser removes user and their inbox items', async () => {
    
    await addUser('u1', {
      firstName: 'A',
      lastName: 'B',
      pronouns: '',
      tone: '',
      voice: '',
      description: '',
      email: 'u1@x.com',
    });

    __setDoc('userConversations/u1/items/c1', {
      mode: 'online',
      title: 'c1',
      lastMessagePreview: '',
      lastMessageAt: serverTimestamp(),  
      lastReadAt: null,
      lastMessageSenderId: null,
    } as InboxItem);

    __setDoc('userConversations/u1/items/c2', {
      mode: 'live',
      title: 'c2',
      lastMessagePreview: '',
      lastMessageAt: serverTimestamp(),  
      lastReadAt: null,
      lastMessageSenderId: null,
    } as InboxItem);

    await deleteUser('u1');

    expect((await getDoc(getUserDoc('u1'))).exists()).toBe(false);
    expect((await getDoc(userInboxDoc('u1', 'c1'))).exists()).toBe(false);
    expect((await getDoc(userInboxDoc('u1', 'c2'))).exists()).toBe(false);
  });

  it('getUsers lists directory entries and can exclude a uid', async () => {
    await addUser('u1', {
      firstName: 'Ada',
      lastName: 'L',
      pronouns: 'she/her',
      tone: '',
      voice: '',
      description: 'd1',
      email: 'ada@example.com',
    });
    await addUser('u2', {
      firstName: 'Alan',
      lastName: 'T',
      pronouns: 'he/him',
      tone: '',
      voice: '',
      description: 'd2',
      email: 'alan@example.com',
    });

    const all = await getUsers();
    const names = all.map((r) => r.uid).sort();
    expect(names).toEqual(['u1', 'u2']);

    const excl = await getUsers({ excludeUid: 'u1' });
    expect(excl.map((r) => r.uid)).toEqual(['u2']);
  });

  
  
  

  it('createLiveConversation creates convo + inbox for owner', async () => {
    const cid = await createLiveConversation({ ownerUid: 'u1', title: 'Live Now' });

    const cSnap = await getDoc(getConvoDoc(cid));
    expect(cSnap.exists()).toBe(true);
    const c = cSnap.data() as Conversation;
    expect(c.mode).toBe('live');
    expect(c.memberIds).toEqual(['u1']);
    expect(c.createdAt).toBeInstanceOf(Date);

    const iSnap = await getDoc(userInboxDoc('u1', cid));
    expect(iSnap.exists()).toBe(true);
    const inbox = iSnap.data() as InboxItem;
    expect(inbox.mode).toBe('live');
    
    expect(inbox.lastMessageAt).toBeInstanceOf(Date);
    expect(inbox.lastMessageSenderId).toBeNull();
  });

  it('createOnlineConversationSafe creates convo and both inbox entries', async () => {
    const cid = await createOnlineConversationSafe({
      creatorUid: 'u1',
      otherUid: 'u2',
      title: 'Chat',
    });

    const c = (await getDoc(getConvoDoc(cid))).data() as Conversation;
    expect(c.mode).toBe('online');
    expect(c.memberIds.sort()).toEqual(['u1', 'u2']);

    expect((await getDoc(userInboxDoc('u1', cid))).exists()).toBe(true);
    expect((await getDoc(userInboxDoc('u2', cid))).exists()).toBe(true);
  });

  it('findOnlineConversationBetweenByMembers finds existing by members map', async () => {
    const cid = await createOnlineConversationSafe({
      creatorUid: 'uA',
      otherUid: 'uB',
      title: 'Pair',
    });

    const found = await findOnlineConversationBetweenByMembers('uA', 'uB');
    expect(found).toBe(cid);

    const none = await findOnlineConversationBetweenByMembers('uA', 'uC');
    expect(none).toBeNull();
  });

  it('ensureOnlineConversation reuses existing or creates new', async () => {
    const cid1 = await ensureOnlineConversation('u1', 'u2', 'First');
    const cid2 = await ensureOnlineConversation('u1', 'u2', 'Whatever');
    expect(cid2).toBe(cid1); 
  });

  
  
  

  it('sendMessage writes message, updates convo + both inbox items', async () => {
    
    const cid = await createOnlineConversationSafe({
      creatorUid: 'u1',
      otherUid: 'u2',
    });

    await sendMessage({ cid, senderId: 'u1', text: 'Hello from u1' });

    
    const msgs = await getDocs(messagesCol(cid));
    expect(msgs.size).toBe(1);
    const m = msgs.docs[0].data() as Message;
    expect(m.text).toBe('Hello from u1');
    expect(m.senderId).toBe('u1');
    expect(m.sentAt).toBeInstanceOf(Date);

    
    const convo = (await getDoc(getConvoDoc(cid))).data() as Conversation;
    expect(convo.lastMessage?.text).toBe('Hello from u1');
    expect(convo.lastMessage?.senderId).toBe('u1');
    expect(convo.lastMessageAt).toBeInstanceOf(Date);

    
    const i1 = (await getDoc(userInboxDoc('u1', cid))).data() as InboxItem;
    const i2 = (await getDoc(userInboxDoc('u2', cid))).data() as InboxItem;
    expect(i1.lastMessagePreview).toBe('Hello from u1');
    expect(i2.lastMessagePreview).toBe('Hello from u1');
    expect(i1.lastMessageSenderId).toBe('u1');
    expect(i2.lastMessageSenderId).toBe('u1');
  });

  it('sendMessage enforces sender membership for online conversations', async () => {
    const cid = await createOnlineConversationSafe({
      creatorUid: 'u1',
      otherUid: 'u2',
    });

    await expect(
      sendMessage({ cid, senderId: 'u3', text: 'I should not post' })
    ).rejects.toThrow(/not a member/i);
  });

  it('sendMessage allows owner or guest in live conversations', async () => {
    const cid = await createLiveConversation({ ownerUid: 'owner' });
    
    await expect(sendMessage({ cid, senderId: 'owner', text: 'hi' })).resolves.toBeUndefined();
    
    await expect(sendMessage({ cid, senderId: 'guest', text: 'hello' })).resolves.toBeUndefined();
    
    await expect(sendMessage({ cid, senderId: 'u3', text: 'nope' })).rejects.toThrow(/invalid sender/i);
  });

  
  
  

  it('getInboxPage returns items and a nextCursor', async () => {
    
    const cid = await createOnlineConversationSafe({ creatorUid: 'u1', otherUid: 'u2' });
    await sendMessage({ cid, senderId: 'u1', text: 'First message' });

    const page = await getInboxPage({ uid: 'u1', pageSize: 1 });
    expect(page.items.length).toBe(1);
    expect(page.nextCursor).not.toBeNull();
  });

 





});
