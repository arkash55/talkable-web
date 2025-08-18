'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useSearchParams, useRouter } from 'next/navigation';

import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import ControlPanel, { ActionLogEntry } from '@/app/components/home/ControlPanel';

import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { Candidate, GenerateResponse } from '@/services/graniteClient';
import { useLiveConversationSync } from '@/app/hooks/useLiveConversation';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { useConversationHistory } from '@/app/hooks/useConversationHistory';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(false);
  const [actions, setActions] = useState<ActionLogEntry[]>([]);

  const { cid } = useLiveConversationSync();
  const theme = useTheme();

  // URL query helpers
  const searchParams = useSearchParams();
  const router = useRouter();

  // 🔊 Pull voice & tone from the live user profile
  const { profile } = useUserProfile();
  const activeVoice = profile?.voice || 'en-GB-Neural2-A';
  const activeTone  = profile?.tone  || 'friendly';

  // Helper: push an action entry to the panel
  const logAction = (entry: Omit<ActionLogEntry, 'id' | 'ts'>) => {
    setActions(prev => {
      const last = prev[prev.length - 1];
      if (
        last &&
        (entry.type === 'conv_start' || entry.type === 'conv_end') &&
        last.type === entry.type
      ) {
        return prev;
      }
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      return [...prev, { id, ts: Date.now(), ...entry }];
    });
  };

  // Conversation history + model context
  const prevCtxSigRef = useRef<string>('');
  const { history, contextLines } = useConversationHistory(cid, {
    // Log each new message
    onNewMessages: (msgs) => {
      for (const m of msgs) {
        // Console log each message
        console.log(`[history:new] [${m.sender}] ${m.content}`);

        // Panel log each message with light styling
        logAction({
          type: 'history_message',
          label: `${m.sender}: ${m.content}`,
          backgroundColor: m.sender === 'guest' ? '#2e7d32' /* green-ish */ : theme.palette.primary.main,
          textColor: 'white',
        });
      }
    },
    // Keep your aggregate info too
    onLog: (e) => {
      if (e.type === 'history_appended') {
        console.log(`[history] ${e.payload.appended} new, total ${e.payload.total} (cid=${cid})`);
        // logAction({
        //   type: 'history_update',
        //   label: `History updated (${e.payload.appended} new, total ${e.payload.total}).`,
        // });
      }
      if (e.type === 'history_reset') {
        // logAction({ type: 'history_reset', label: `Loaded conversation ${e.payload.cid}` });
      }
    },
    window: { maxCount: 200, maxChars: 12000 },
    context: { maxMessages: 16, maxChars: 2000 },
  });

  // Also log when the context window changes (length or last line)
  useEffect(() => {
    const sig = `${contextLines.length}|${contextLines[contextLines.length - 1] || ''}`;
    if (sig !== prevCtxSigRef.current) {
      prevCtxSigRef.current = sig;
      console.log(`[context] lines=${contextLines.length}`, contextLines);
      // logAction({
      //   type: 'context_update',
      //   label: `Context window updated (${contextLines.length} lines).`,
      //   payload: { contextLines },
      // });
    }
  }, [contextLines]);

  // Conversation lifecycle
  useEffect(() => {
    const onConvStart = () => {
      setActions([]);
      logAction({ type: 'conv_start', label: 'Conversation started.' });
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
    const onStart = () => setIsPlaying(true);
    const onEnd = () => {
      setIsPlaying(false);
      setActiveIndex(null);
      logAction({ type: 'TTS End', label: 'User finished talking.' });
    };
    window.addEventListener('tts:start', onStart);
    window.addEventListener('tts:end', onEnd);
    return () => {
      window.removeEventListener('tts:start', onStart);
      window.removeEventListener('tts:end', onEnd);
    };
  }, []);

  // STT lifecycle (panel log)
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
        backgroundColor: '#32CD32',
      });
    };

    window.addEventListener('stt:startListening', onStartListening);
    window.addEventListener('stt:finalTranscript', onEndListening);
    return () => {
      window.removeEventListener('stt:startListening', onStartListening);
      window.removeEventListener('stt:finalTranscript', onEndListening);
    };
  }, []);

  // Loading from VoiceControlBar
  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    if (loading) logAction({ type: 'generating', label: 'Generating responses…' });
  };

  // Responses from VoiceControlBar
  const handleResponsesReady = (responses: GenerateResponse) => {
    setAiResponses(responses.candidates);
    logAction({ type: 'responses_ready', label: 'Responses ready.' });
  };

  // Click a grid cell -> speak with *current profile* voice & tone
  const handleBlockClick = async (index: number) => {
    if (isPlaying) return;

    const text = (aiResponses?.[index]?.text ?? '').trim() || `Here's a response.`;
    setActiveIndex(index);

    logAction({ type: 'TTS Start', label: 'User is speaking…' });
    logAction({
      type: 'ai_message',
      label: `User: ${text}`,
      payload: { index, text },
      backgroundColor: theme.palette.primary.main,
      textColor: 'white',
    });

    try {
      await speakWithGoogleTTSClient(text, activeTone, activeVoice);
    } catch (err) {
      console.error('TTS error:', err);
      window.dispatchEvent(new Event('tts:end'));
    }
  };

  // Build blocks from responses (2–6)
  const visibleCount = Math.min(Math.max(aiResponses.length, 2), 6);
  const blocks = Array.from({ length: visibleCount }, (_, i) => {
    const label = (aiResponses[i]?.text ?? '').trim();
    return {
      label: label || `Option ${i + 1}`,
      onClick: () => handleBlockClick(i),
    };
  });

  // -------- Query param integrations --------

  // A) If we arrive with ?cid=..., also emit conversation:load (belt & braces)
  useEffect(() => {
    const qcid = searchParams.get('cid');
    if (!qcid) return;
    window.dispatchEvent(new CustomEvent('conversation:load', { detail: { cid: qcid } }));
  }, [searchParams]);

  // B) If we arrive with ?starter=...&autostart=1, auto start a convo using that opener
  useEffect(() => {
    const starter = searchParams.get('starter');
    const auto = searchParams.get('autostart');
    if (!starter || auto !== '1') return;

    window.dispatchEvent(new CustomEvent('conversation:start'));
    window.dispatchEvent(new CustomEvent('stt:finalTranscript', { detail: starter }));

    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('starter'); params.delete('topic'); params.delete('autostart');
    router.replace(`/home${params.size ? `?${params.toString()}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once only

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      <ControlPanel
        actions={actions}
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed(p => !p)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VoiceControlBar
          onResponses={handleResponsesReady}
          onLoadingChange={handleLoadingChange}
          modelContext={contextLines} // <- passes past messages to Granite via your hook
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
            blocks={blocks}
            disabled={isPlaying}
            activeIndex={activeIndex}
          />
        )}
      </div>
    </div>
  );
}
