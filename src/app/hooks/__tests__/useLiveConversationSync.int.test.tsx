
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';




vi.mock('firebase/auth', () => {
  
  return {
    
    onAuthStateChanged: (_auth: any, cb: any) => {
      
      cb({ uid: 'u1' });
      return () => {};
    },
    
    getAuth: () => ({ currentUser: { uid: 'u1' } }),
  };
});


vi.mock('../../../lib/fireBaseConfig', () => ({
  auth: { currentUser: { uid: 'u1' } },
}));


const createLiveConversationMock = vi.fn(async () => 'cid-123');
const sendMessageMock = vi.fn(async () => {});
vi.mock('@/services/firestoreService', () => ({
  createLiveConversation: (...args: any[]) => createLiveConversationMock(...args),
  sendMessage: (...args: any[]) => sendMessageMock(...args),
}));




import { useLiveConversationSync } from '../useLiveConversation';


function Harness() {
  useLiveConversationSync();
  return null;
}

beforeEach(() => {
  createLiveConversationMock.mockClear();
  sendMessageMock.mockClear();
  
  (window as any).__talkableLiveSync3 = undefined;
});

describe('useLiveConversationSync (integration)', () => {
  it('creates a live conversation on startNew and sends guest transcript', async () => {
    render(<Harness />);

    
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
    });

    await waitFor(() => expect(createLiveConversationMock).toHaveBeenCalledTimes(1));

    
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stt:finalTranscript', { detail: 'hello there' })
      );
    });

    await waitFor(() =>
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cid: 'cid-123',
          senderId: 'guest',
          text: 'hello there',
        })
      )
    );
  });

  it('ui:voicegrid:click sends user message and dedupes same text across events', async () => {
    render(<Harness />);

    
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
    });
   await waitFor(() => {
  expect(createLiveConversationMock).toHaveBeenCalled();
  
  expect(createLiveConversationMock.mock.calls.length).toBeLessThanOrEqual(2);
});

    
    act(() => {
      window.dispatchEvent(
        new CustomEvent('ui:voicegrid:click', { detail: { index: 0, label: 'Pick me' } })
      );
    });

    await waitFor(() =>
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cid: 'cid-123',
          senderId: 'u1',
          text: 'Pick me',
        })
      )
    );

    sendMessageMock.mockClear();

    
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stt:finalTranscript', { detail: 'Pick me' })
      );
    });

    
    await new Promise((r) => setTimeout(r, 10));
    expect(sendMessageMock).not.toHaveBeenCalled();

    
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stt:finalTranscript', { detail: 'Different' })
      );
    });

    await waitFor(() =>
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cid: 'cid-123',
          senderId: 'guest',
          text: 'Different',
        })
      )
    );
  });
});
