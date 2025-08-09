'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
;
import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { getIBMResponses } from '@/services/ibmService';
import ControlPanel, { ActionLogEntry } from '@/app/components/home/ControlPanel';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionLogEntry[]>([]);

  // Speakers just label the grid; the clicked text is the user's chosen reply
  const speakers = useMemo(
    () => [
      { name: 'Maya',  tone: 'friendly',     voice: 'en-US-Wavenet-F' },
      { name: 'Liam',  tone: 'confident',    voice: 'en-US-Wavenet-D' },
      { name: 'Olivia',tone: 'cheerful',     voice: 'en-US-Wavenet-C' },
      { name: 'Noah',  tone: 'calm',         voice: 'en-US-Wavenet-B' },
      { name: 'Emma',  tone: 'enthusiastic', voice: 'en-US-Wavenet-E' },
      { name: 'James', tone: 'serious',      voice: 'en-US-Wavenet-A' },
    ],
    []
  );

  // Helper: push an action entry to the panel
  const logAction = (entry: Omit<ActionLogEntry, 'id' | 'ts'>) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setActions(prev => [...prev, { id, ts: Date.now(), ...entry }]);
  };

  // Drive UI from TTS lifecycle
  useEffect(() => {
    const onStart = () => {
      setIsPlaying(true);
      logAction({ type: 'tts_start', label: 'Recipient is talking…' });
    };
    const onEnd = () => {
      setIsPlaying(false);
      setActiveIndex(null);
      logAction({ type: 'tts_end', label: 'Recipient finished talking.' });
    };
    window.addEventListener('tts:start', onStart);
    window.addEventListener('tts:end', onEnd);
    return () => {
      window.removeEventListener('tts:start', onStart);
      window.removeEventListener('tts:end', onEnd);
    };
  }, []);

  // Called by VoiceControlBar while models are working
  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      logAction({ type: 'generating', label: 'Generating responses…' });
    }
  };

  // Called by VoiceControlBar when it has responses (from IBM/Granite/etc.)
  const handleResponsesReady = (responses: string[]) => {
    setAiResponses(responses);
    logAction({ type: 'responses_ready', label: 'Responses ready.' });
  };

  // Clicking a VoiceGrid cell -> play that response (AI message)
  const handleBlockClick = async (index: number) => {
    if (isPlaying) return;

    const speaker = speakers[index];
    const text = (aiResponses?.[index] ?? '').trim() || `Fallback message from ${speaker.name}`;

    // mark selected visually
    setActiveIndex(index);

    // Log this specific AI line as a clickable action (rewind target)
    logAction({
      type: 'ai_message',
      label: `AI: ${text}`,
      clickable: true,
      payload: { index, text },
    });

    try {
      await speakWithGoogleTTSClient(text, speaker.tone, speaker.voice, speaker.name);
      // tts:start / tts:end are dispatched by the TTS client itself
    } catch (err) {
      console.error('TTS error:', err);
      // Ensure UI unlocks if an error
      window.dispatchEvent(new Event('tts:end'));
    }
  };

  // Rewind to a clicked AI message (in ControlPanel)
  const handleRewind = async (actionId: string) => {
    const a = actions.find(x => x.id === actionId);
    if (!a || a.type !== 'ai_message' || !a.clickable) return;

    // Stop any current TTS and unlock UI
    window.dispatchEvent(new Event('tts:end'));

    // Trim action log up to & including the clicked message
    const idx = actions.findIndex(x => x.id === actionId);
    setActions(prev => prev.slice(0, idx + 1));
    logAction({ type: 'rewind', label: 'Rewound to selected AI message.' });

    // Generate new responses from that AI line (mocked)
    const sourceText: string = (a.payload as any)?.text ?? 'Continue';
    logAction({ type: 'generating', label: 'Generating responses from rewind…' });
    const newCandidates = await getIBMResponses(sourceText);
    setAiResponses(newCandidates);
    logAction({ type: 'responses_ready', label: 'Responses ready (after rewind).' });
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      {/* LEFT: Control Panel with action log + time-travel (AI-only click) */}
      <ControlPanel actions={actions} onRewind={handleRewind} />

      {/* CENTER: Voice control + grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VoiceControlBar
          onResponses={handleResponsesReady}
          onLoadingChange={handleLoadingChange}
        />

        {/* While generating, show a spinner instead of VoiceGrid */}
        {isLoading ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Generating responses…
            </Typography>
          </Box>
        ) : (
          <VoiceGrid
            blocks={speakers.map((speaker, index) => ({
              label: (aiResponses?.[index] ?? '').trim() || `Priority ${index + 1}`,
              onClick: () => handleBlockClick(index),
            }))}
            disabled={isPlaying}
            activeIndex={activeIndex}
          />
        )}
      </div>

      {/* RIGHT: your existing sidebar (kept) */}
      <ConversationSidebar />
    </div>
  );
}
