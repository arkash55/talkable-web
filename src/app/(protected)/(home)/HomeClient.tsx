'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import ControlPanel, { ActionLogEntry } from '@/app/components/home/ControlPanel';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { getIBMResponses } from '@/services/ibmService';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false); // disable grid during TTS
  const [activeIndex, setActiveIndex] = useState<number | null>(null); // highlight selected cell
  const [actions, setActions] = useState<ActionLogEntry[]>([]);
  const theme = useTheme();

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

  // Helper: push an action entry to the panel (with simple de-dupe for conv start/end)
  const logAction = (entry: Omit<ActionLogEntry, 'id' | 'ts'>) => {
    setActions(prev => {
      const last = prev[prev.length - 1];
      if (
        last &&
        (entry.type === 'conv_start' || entry.type === 'conv_end') &&
        last.type === entry.type
      ) {
        // ignore consecutive identical conv_start/conv_end
        return prev;
      }
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      return [...prev, { id, ts: Date.now(), ...entry }];
    });
  };

  // Conversation lifecycle via window events
  useEffect(() => {
    const onConvStart = () => {
      logAction({ type: 'conv_start', label: 'Conversation started.' })
      // logAction({ type: 'begun listening', label: 'Listening for recipient speech...' });
    };
    const onConvEnd = () => logAction({ type: 'conv_end', label: 'Conversation ended.' });
    window.addEventListener('conversation:start', onConvStart);
    window.addEventListener('conversation:end', onConvEnd);
    return () => {
      window.removeEventListener('conversation:start', onConvStart);
      window.removeEventListener('conversation:end', onConvEnd);
    };
  }, []);


  

  // TTS lifecycle -> disable/enable grid + action log
  useEffect(() => {
    const onStart = () => {setIsPlaying(true);};

    const onEnd = () => {
      setIsPlaying(false);
      setActiveIndex(null);
      logAction({ type: 'TTS End', label: 'User finished talking.'});
    };
    
    window.addEventListener('tts:start', onStart);
    window.addEventListener('tts:end', onEnd);
    return () => {
      window.removeEventListener('tts:start', onStart);
      window.removeEventListener('tts:end', onEnd);
    };
  }, []);

  //STT lifecycle -> handle listening state (separate useEffect)
  useEffect(() => {
    const onStartListening = () => {
      logAction({ type: 'begun listening', label: 'Listening for recipient speech...' });
    };

    const onEndListening = (event: Event) => {
      const finalTranscript = (event as CustomEvent).detail;
      logAction({ type: 'ended listening', label: 'Recipient has stopped speaking.' });
      logAction({
        type: 'final transcript',
        label: `Recipient: ${finalTranscript}`,
        payload: { transcript: finalTranscript },
        backgroundColor: theme.palette.grey[300]
       });
    };

    
    window.addEventListener('stt:startListening', onStartListening);
    window.addEventListener('stt:finalTranscript', onEndListening);
    return () => {
      window.removeEventListener('stt:startListening', onStartListening);
      window.removeEventListener('stt:finalTranscript', onEndListening);
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


    logAction({ type: 'TTS Start', label: 'User is speaking…' });
    
    // Log this specific AI line as a clickable action (rewind target)
    logAction({
      type: 'ai_message',
      label: `User: ${text}`,
      clickable: true,
      payload: { index, text },
      backgroundColor: theme.palette.primary.main,
      textColor: theme.palette.primary.contrastText,
    });

 

    try {
      await speakWithGoogleTTSClient(text, speaker.tone, speaker.voice, speaker.name);
    } catch (err) {
      console.error('TTS error:', err);
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

      <ConversationSidebar />
    </div>
  );
}
