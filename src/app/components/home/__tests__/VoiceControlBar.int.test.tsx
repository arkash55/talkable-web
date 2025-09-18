// src/app/components/home/__tests__/VoiceControlBar.int.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';

// ── Hoisted mocks ───────────────────────────────────────────────────────────
const speech = vi.hoisted(() => ({
  startListening: vi.fn(),
  stopListening: vi.fn(),
  state: {
    transcript: '',
    browserSupportsSpeechRecognition: true,
    resetTranscript: vi.fn(() => { speech.state.transcript = ''; }),
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
const setTranscript = (t: string) => { speech.state.transcript = t; };

// Avoid real Firebase init
vi.mock('@/lib/fireBaseConfig', () => ({ app: {}, auth: {}, db: {}, storage: {} }));

// Stable user profile + system prompt
vi.mock('@/app/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: { tone: 'warm', description: 'Test user' } }),
}));
vi.mock('@/app/utils/systemPrompt', () => ({
  buildSystemPrompt: () => 'SYSTEM_PROMPT_TEST',
}));

// Granite client (hoisted mock to avoid TDZ)
const getCandidatesMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/graniteClient', () => ({
  getCandidates: getCandidatesMock,
}));

// SUT
import VoiceControlBar from '../VoiceControlBar';

// ── Lifecycle ───────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.useFakeTimers();
  getCandidatesMock.mockReset();
  getCandidatesMock.mockResolvedValue({
    candidates: [{ text: 'Hi there' }],
    meta: { model_id: 'test' },
  });
  speech.startListening.mockClear();
  speech.stopListening.mockClear();
  setTranscript('');
});
afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────────────────
describe('VoiceControlBar (integration)', () => {
  it('autoStart + Regenerate calls Granite and toggles loading', async () => {
    const onLoading = vi.fn();
    const onResponses = vi.fn();

    render(
      <VoiceControlBar
        onLoadingChange={onLoading}
        onResponses={onResponses}
        modelContext={[]}
        autoStart={{ mode: 'new' }}
      />,
    );

    // Let autoStart effect run
    await act(async () => { await Promise.resolve(); });
    expect(speech.startListening).toHaveBeenCalled();

    // Seed last message (hook listens to conversation:seed and appends to local context)
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:seed', {
        detail: { text: 'Last said', sender: 'guest' },
      }));
    });

    // Trigger regenerate via global event the hook listens to
    act(() => { window.dispatchEvent(new Event('ui:regenerate')); });

    // Flush microtasks
    await act(async () => { await Promise.resolve(); });

    expect(getCandidatesMock).toHaveBeenCalledTimes(1);
    expect(onLoading).toHaveBeenCalledWith(true);
    expect(onResponses).toHaveBeenCalled();
    expect(onLoading).toHaveBeenLastCalledWith(false);
  });

  it(
    'speech → 2s silence → finalize: stops listening, calls Granite, shows transcript',
    { timeout: 10000 },
    async () => {
      const onLoading = vi.fn();
      const onResponses = vi.fn();

      const { rerender, getByText } = render(
        <VoiceControlBar
          onLoadingChange={onLoading}
          onResponses={onResponses}
          modelContext={[]}
          autoStart={{ mode: 'new' }}
        />
      );

      // Ensure autoStart ran (hook is active/listening)
      await act(async () => { /* flush effects */ });
      expect(speech.startListening).toHaveBeenCalled();

      // 1) Provide transcript
      act(() => { (speech.state.transcript = 'Hello world'); });

      // 2) Force a render so hook sees new transcript, then flush effects
      rerender(
        <VoiceControlBar
          onLoadingChange={onLoading}
          onResponses={onResponses}
          modelContext={[]}
          autoStart={{ mode: 'new' }}
        />
      );
      await act(async () => { /* flush effects to schedule 2s timer */ });

      // 3) Advance past the 2s silence window
      act(() => { vi.advanceTimersByTime(2100); });

      // 4) Let async getCandidates resolve (microtasks)
      await act(async () => { await Promise.resolve(); });

      // Assertions
      expect(onLoading).toHaveBeenCalledWith(true);
      expect(onResponses).toHaveBeenCalled();
      expect(onLoading).toHaveBeenLastCalledWith(false);
      expect(speech.stopListening).toHaveBeenCalled();

      // Transcript rendered (wait for paint)
      await act(async () => { /* flush effects */ });
      expect(getByText('Hello world')).toBeInTheDocument();
    }
  );
});
