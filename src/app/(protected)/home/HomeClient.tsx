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

  // URL helpers
  const searchParams = useSearchParams();
  const router = useRouter();

  // Profile
  const { profile } = useUserProfile();
  const activeVoice = profile?.voice || 'en-GB-Neural2-A';
  const activeTone  = profile?.tone  || 'friendly';

  // Track mode of the current session
  const sessionWasResumedRef = useRef<boolean>(false);
  const lastCreatedCidRef = useRef<string | null>(null); // to enable resume-in-page without URL

  // Helper: push action to panel
  const logAction = (entry: Omit<ActionLogEntry, 'id' | 'ts'>) => {
    setActions(prev => {
      const last = prev[prev.length - 1];
      if (last && (entry.type === 'conv_start' || entry.type === 'conv_end') && last.type === entry.type) {
        return prev;
      }
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      return [...prev, { id, ts: Date.now(), ...entry }];
    });
  };

  // Conversation history + context
  const prevCtxSigRef = useRef<string>('');
  const { history, contextLines } = useConversationHistory(cid, {
    onNewMessages: (msgs) => {
      for (const m of msgs) {
        console.log(`[history:new] [${m.sender}] ${m.content}`);
        logAction({
          type: 'history_message',
          label: `${m.sender}: ${m.content}`,
          backgroundColor: m.sender === 'guest' ? '#2e7d32' : theme.palette.primary.main,
          textColor: 'white',
        });
      }
    },
    onLog: (e) => {
      if (e.type === 'history_appended') {
        console.log(`[history] ${e.payload.appended} new, total ${e.payload.total} (cid=${cid})`);
        logAction({
          type: 'history_update',
          label: `History updated (${e.payload.appended} new, total ${e.payload.total}).`,
        });
      }
      if (e.type === 'history_reset') {
        // We loaded an existing conversation -> Resume path
        sessionWasResumedRef.current = true;
        logAction({ type: 'history_reset', label: `Loaded conversation ${e.payload.cid}` });
      }
    },
    window: { maxCount: 200, maxChars: 12000 },
    context: { maxMessages: 16, maxChars: 2000 },
  });

  // Log context changes
  useEffect(() => {
    const sig = `${contextLines.length}|${contextLines[contextLines.length - 1] || ''}`;
    if (sig !== prevCtxSigRef.current) {
      prevCtxSigRef.current = sig;
      console.log(`[context] lines=${contextLines.length}`, contextLines);
      logAction({
        type: 'context_update',
        label: `Context window updated (${contextLines.length} lines).`,
        payload: { contextLines },
      });
    }
  }, [contextLines]);

  // Util: strip ?cid from URL
  const stripCidFromUrlIfPresent = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('cid')) {
        params.delete('cid');
        const next = `/home${params.size ? `?${params.toString()}` : ''}`;
        router.replace(next);
      }
    } catch {}
  };

  // Listen: someone created a new live conversation -> remember it for resume-in-page
  useEffect(() => {
    const onCreated = (e: Event) => {
      const any = e as CustomEvent<string>;
      const id = (any.detail || '').trim();
      if (id) lastCreatedCidRef.current = id;
    };
    window.addEventListener('conversation:created', onCreated);
    return () => window.removeEventListener('conversation:created', onCreated);
  }, []);

  // Listen: resume/new intent so we know how to manage logs/URL
  useEffect(() => {
    const onResume = () => {
      sessionWasResumedRef.current = true;
    };
    const onStartNew = () => {
      sessionWasResumedRef.current = false;
      // Starting NEW right now: clear panel & strip stale cid before anything else
      setActions([]);
      stripCidFromUrlIfPresent();
    };
    window.addEventListener('conversation:resume', onResume as EventListener);
    window.addEventListener('conversation:startNew', onStartNew as EventListener);
    return () => {
      window.removeEventListener('conversation:resume', onResume as EventListener);
      window.removeEventListener('conversation:startNew', onStartNew as EventListener);
    };
  }, []);

  // Conversation lifecycle panel entries + Stop cleanup
  useEffect(() => {
    const onConvStart = () => {
      logAction({ type: 'conv_start', label: sessionWasResumedRef.current ? 'Resumed conversation.' : 'New conversation started.' });
    };
    const onConvEnd = () => {
      logAction({ type: 'conv_end', label: 'Conversation ended.' });
      // If this session was a resume, clear the URL to avoid sticky cid on next start
      if (sessionWasResumedRef.current) {
        stripCidFromUrlIfPresent();
      }
      // Do not reset the flag here; if they resume again without leaving, the next resume should still be treated as resume.
    };

    window.addEventListener('conversation:start', onConvStart);
    window.addEventListener('conversation:end', onConvEnd);
    return () => {
      window.removeEventListener('conversation:start', onConvStart);
      window.removeEventListener('conversation:end', onConvEnd);
    };
  }, []);

  // TTS lifecycle
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

  // -------- Arrival integrations --------

  // If we arrive with ?cid=..., mark as a resume target and load it
  useEffect(() => {
    const qcid = searchParams.get('cid');
    if (!qcid) return;
    sessionWasResumedRef.current = true; // future start is a RESUME
    window.dispatchEvent(new CustomEvent('conversation:load', { detail: { cid: qcid } }));
  }, [searchParams]);

  // If we arrive with ?starter=...&autostart=1, auto start using that opener
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
  }, []); // once

  // Can we resume? yes if URL has ?cid OR we created a convo in this page session
  const canResume =
    !!searchParams.get('cid') ||
    !!lastCreatedCidRef.current;

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
          modelContext={contextLines}
          canResume={canResume}
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
