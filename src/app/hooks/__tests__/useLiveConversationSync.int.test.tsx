// src/app/hooks/__tests__/useLiveConversation.int.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

// ──────────────────────────────
// Mocks (must be BEFORE SUT import)
// ──────────────────────────────
vi.mock('firebase/auth', () => {
  // Minimal API that our code touches
  return {
    // used by the hook
    onAuthStateChanged: (_auth: any, cb: any) => {
      // immediately emit signed-in user
      cb({ uid: 'u1' });
      return () => {};
    },
    // used by lib/fireBaseConfig at module load (so we must provide it)
    getAuth: () => ({ currentUser: { uid: 'u1' } }),
  };
});

// Stop real Firebase config from running and just provide a fake auth object
vi.mock('../../../lib/fireBaseConfig', () => ({
  auth: { currentUser: { uid: 'u1' } },
}));

// Firestore service calls
const createLiveConversationMock = vi.fn(async () => 'cid-123');
const sendMessageMock = vi.fn(async () => {});
vi.mock('@/services/firestoreService', () => ({
  createLiveConversation: (...args: any[]) => createLiveConversationMock(...args),
  sendMessage: (...args: any[]) => sendMessageMock(...args),
}));

// ──────────────────────────────
// Import SUT after mocks
// ──────────────────────────────
import { useLiveConversationSync } from '../useLiveConversation';

// Simple harness that mounts the hook
function Harness() {
  useLiveConversationSync();
  return null;
}

beforeEach(() => {
  createLiveConversationMock.mockClear();
  sendMessageMock.mockClear();
  // Reset the global singleton that the hook uses
  (window as any).__talkableLiveSync3 = undefined;
});

describe('useLiveConversationSync (integration)', () => {
  it('creates a live conversation on startNew and sends guest transcript', async () => {
    render(<Harness />);

    // Start a new conversation → should create exactly once
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
    });

    await waitFor(() => expect(createLiveConversationMock).toHaveBeenCalledTimes(1));

    // Finalized STT → should send as guest
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

    // Ensure conversation exists
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:startNew'));
    });
   await waitFor(() => {
  expect(createLiveConversationMock).toHaveBeenCalled();
  // optionally:
  expect(createLiveConversationMock.mock.calls.length).toBeLessThanOrEqual(2);
});

    // User click → send as user
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

    // Same text arrives via STT within TTL → should be deduped (no send)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stt:finalTranscript', { detail: 'Pick me' })
      );
    });

    // give the event loop a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(sendMessageMock).not.toHaveBeenCalled();

    // Different text → should send as guest
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
