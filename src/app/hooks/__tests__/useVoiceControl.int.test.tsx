import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, useState } from 'react';
import { render, act } from '@testing-library/react';

// ────────────────────────────
// Hoisted mocks
// ────────────────────────────
const speech = vi.hoisted(() => ({
  startListening: vi.fn(),
  stopListening: vi.fn(),
  state: {
    transcript: '',
    browserSupportsSpeechRecognition: true,
    resetTranscript: vi.fn(() => {
      speech.state.transcript = '';
    }),
  },
}));

vi.mock('react-speech-recognition', () => ({
  default: {
    startListening: speech.startListening,
    stopListening: speech.stopListening,
  },
  useSpeechRecognition: () => ({
    transcript: speech.state.transcript,
    resetTranscript: speech.state.resetTranscript,
    browserSupportsSpeechRecognition: speech.state.browserSupportsSpeechRecognition,
  }),
}));

// Avoid real Firebase init
vi.mock('@/lib/fireBaseConfig', () => {
  const auth = { currentUser: { uid: 'test_uid' } };
  const db = { __isDb: true };
  const app = { __mock: true };
  return { auth, db, app };
});

// Stable system prompt + profile
vi.mock('@/app/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: { tone: 'warm', description: 'Test user' },
  }),
}));
vi.mock('@/app/utils/systemPrompt', () => ({
  buildSystemPrompt: () => 'SYSTEM_PROMPT_TEST',
}));

// Granite client
const getCandidatesMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/graniteClient', () => ({
  getCandidates: getCandidatesMock,
}));

// SUT
import { useVoiceControl } from '../useVoiceControl';
import type { GenerateResponse } from '@/services/graniteClient';

// ────────────────────────────
// Test harness
// ────────────────────────────
function Harness({
  onResponses,
  onLoading,
  context,
}: {
  onResponses: (r: GenerateResponse) => void;
  onLoading: (b: boolean) => void;
  context?: string[];
}) {
  const hook = useVoiceControl(onResponses, onLoading, context ?? []);
  const [tick, setTick] = useState(0);

  // Expose helpers (and force re-render when we update transcript)
  useEffect(() => {
    (window as any).__seed = (txt: string, sender: 'guest' | 'user' = 'guest') => {
      hook.messageHistory.push({
        sender,
        content: txt,
        createdAt: new Date().toISOString(),
      } as any);
      setTick((t) => t + 1);
    };
    (window as any).__start = () => (hook as any).startNewConversation?.();
    (window as any).__resume = () => (hook as any).resumeConversation?.();
    (window as any).__stop = () => (hook as any).stopConversation?.();
    (window as any).__setTranscript = (t: string) => {
      speech.state.transcript = t;
      setTick((x) => x + 1); // force re-render so the hook sees the new transcript
    };
  }, [hook]);

  return <div data-testid="harness" data-tick={tick} />;
}

// ────────────────────────────
// Tests
// ────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  getCandidatesMock.mockResolvedValue({
    candidates: [{ text: 'Option A' }],
    meta: { model_id: 'test' },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useVoiceControl – finalize on silence integration', () => {
  it('starts listening, detects silence, stops listening, calls model, emits responses', async () => {
    const onResponses = vi.fn();
    const onLoading = vi.fn();

    render(<Harness onResponses={onResponses} onLoading={onLoading} />);

    // Start new conversation (activates listening)
    act(() => {
      (window as any).__start();
    });

    // Simulate speech (and force re-render so effect sees it)
    act(() => {
      (window as any).__setTranscript('Hello there from mic');
    });

    // Advance past the 2s silence window
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await Promise.resolve(); // let microtasks flush
    });

    // Loading toggled while calling the model
    expect(onLoading).toHaveBeenCalledWith(true);

    // Let getCandidates resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Responses propagated and loading ended
    expect(onResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.any(Array),
        meta: expect.any(Object),
      })
    );
    expect(onLoading).toHaveBeenLastCalledWith(false);

    // STT should stop
    expect(speech.stopListening).toHaveBeenCalled();
  });

  it('does nothing if browser STT unsupported', async () => {
    speech.state.browserSupportsSpeechRecognition = false;

    const onResponses = vi.fn();
    const onLoading = vi.fn();
    render(<Harness onResponses={onResponses} onLoading={onLoading} />);

    act(() => {
      (window as any).__start();
    });

    act(() => {
      (window as any).__setTranscript('Ignored text');
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(getCandidatesMock).not.toHaveBeenCalled();
    expect(onResponses).not.toHaveBeenCalled();
    expect(onLoading).not.toHaveBeenCalled();
    expect(speech.startListening).not.toHaveBeenCalled();

    // restore
    speech.state.browserSupportsSpeechRecognition = true;
  });
});

describe('useVoiceControl – regenerate flow', () => {
  it('uses latest message and toggles loading around getCandidates', async () => {
    const onResponses = vi.fn();
    const onLoading = vi.fn();

    render(<Harness onResponses={onResponses} onLoading={onLoading} />);

    // Seed a last message (prefer guest over user)
    act(() => {
      (window as any).__seed('Most recent guest message', 'guest');
    });

    act(() => {
      window.dispatchEvent(new Event('ui:regenerate'));
    });

    await Promise.resolve();

    // Loading toggled
    expect(onLoading).toHaveBeenCalledWith(true);
    expect(onLoading).toHaveBeenLastCalledWith(false);

    // Model call
    expect(getCandidatesMock).toHaveBeenCalledTimes(1);
    const [contentArg, systemArg, ctxArg] = (getCandidatesMock as any).mock.calls[0];

    expect(contentArg).toBe('Most recent guest message');
    expect(systemArg).toBe('SYSTEM_PROMPT_TEST');
    expect(Array.isArray(ctxArg)).toBe(true);

    // Responses bubbled up
    expect(onResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.any(Array),
        meta: expect.any(Object),
      })
    );
  });
});
