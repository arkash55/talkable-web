
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';


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


vi.mock('@/lib/fireBaseConfig', () => ({ app: {}, auth: {}, db: {}, storage: {} }));


vi.mock('@/app/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: { tone: 'warm', description: 'Test user' } }),
}));
vi.mock('@/app/utils/systemPrompt', () => ({
  buildSystemPrompt: () => 'SYSTEM_PROMPT_TEST',
}));


const getCandidatesMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/graniteClient', () => ({
  getCandidates: getCandidatesMock,
}));


import VoiceControlBar from '../VoiceControlBar';


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

    
    await act(async () => { await Promise.resolve(); });
    expect(speech.startListening).toHaveBeenCalled();

    
    act(() => {
      window.dispatchEvent(new CustomEvent('conversation:seed', {
        detail: { text: 'Last said', sender: 'guest' },
      }));
    });

    
    act(() => { window.dispatchEvent(new Event('ui:regenerate')); });

    
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

      
      await act(async () => {  });
      expect(speech.startListening).toHaveBeenCalled();

      
      act(() => { (speech.state.transcript = 'Hello world'); });

      
      rerender(
        <VoiceControlBar
          onLoadingChange={onLoading}
          onResponses={onResponses}
          modelContext={[]}
          autoStart={{ mode: 'new' }}
        />
      );
      await act(async () => {  });

      
      act(() => { vi.advanceTimersByTime(2100); });

      
      await act(async () => { await Promise.resolve(); });

      
      expect(onLoading).toHaveBeenCalledWith(true);
      expect(onResponses).toHaveBeenCalled();
      expect(onLoading).toHaveBeenLastCalledWith(false);
      expect(speech.stopListening).toHaveBeenCalled();

      
      await act(async () => {  });
      expect(getByText('Hello world')).toBeInTheDocument();
    }
  );
});
