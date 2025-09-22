'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useSearchParams, useRouter } from 'next/navigation';

import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import ControlPanel, { ActionLogEntry } from '@/app/components/home/ControlPanel';

import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { GenerateResponse } from '@/services/graniteClient';
import { useLiveConversationSync } from '@/app/hooks/useLiveConversation';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { useConversationHistory } from '@/app/hooks/useConversationHistory';
import { Candidate } from '@/services/graniteService';

type AutoStartPayload = { mode: 'new' | 'resume'; seed?: string } | null;

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(false);
  const [actions, setActions] = useState<ActionLogEntry[]>([]);
  const [autoStart, setAutoStart] = useState<AutoStartPayload>(null);

  const { cid } = useLiveConversationSync();
  const theme = useTheme();

  
  const searchParams = useSearchParams();
  const router = useRouter();

  
  const { profile } = useUserProfile();
  const activeVoice = profile?.voice || 'en-GB-Neural2-A';
  const activeTone  = profile?.tone  || 'friendly';

  
  const sessionWasResumedRef = useRef<boolean>(false);
  const lastCreatedCidRef = useRef<string | null>(null); 

  
  const loggedMsgIdsRef = useRef<Set<string>>(new Set());
  
  const lastCidSeenRef = useRef<string | null>(null);


  const resumeTargetCidRef = useRef<string | null>(null);

  
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

  
  const prevCtxSigRef = useRef<string>('');
  const { history, contextLines } = useConversationHistory(cid, {
    onNewMessages: (msgs) => {
       const seen = loggedMsgIdsRef.current;
      for (const m of msgs) {
            if (!m?.createdAt || seen.has(m.createdAt)) continue;
            seen.add(m.createdAt);

        console.log(`[history:new] [${m.sender}] ${m.content}`);
        logAction({
          type: 'Chat Message',
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
          type: 'history_updated',
          label: `History updated (${e.payload.appended} new, total ${e.payload.total}).`,
        });
      }
      if (e.type === 'history_reset') {
        logAction({ type: 'history_reset', label: `Loaded conversation ${e.payload.cid}` });
      }
    },
    window: { maxCount: 200, maxChars: 12000 },
    context: { maxMessages: 16, maxChars: 2000 },
  });

  useEffect(() => {
  if (cid) {
    
      resumeTargetCidRef.current = cid;
    if (cid !== lastCidSeenRef.current) {
      loggedMsgIdsRef.current.clear();
      lastCidSeenRef.current = cid;
    }
  }
  
}, [cid]);


  
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

  
  useEffect(() => {
    const onCreated = (e: Event) => {
      const any = e as CustomEvent<string>;
      const id = (any.detail || '').trim();
      if (id) lastCreatedCidRef.current = id;
    };
    window.addEventListener('conversation:created', onCreated);
    return () => window.removeEventListener('conversation:created', onCreated);
  }, []);


 useEffect(() => {
    const onRegen = () => {
      regenInProgressRef.current = true;
      logAction({ type: 'regenerate', label: 'Regenerating responses…' });
    };
    window.addEventListener('ui:regenerate', onRegen as EventListener);
    return () => window.removeEventListener('ui:regenerate', onRegen as EventListener);
  }, []);









  const clearUiForNewSession = () => {
    setAiResponses([]);      
    setActiveIndex(null);
    setIsLoading(false);
  };


    
 useEffect(() => {
    const onStartNew = () => {
      clearUiForNewSession();
      setActions([]);
      stripCidFromUrlIfPresent();
      loggedMsgIdsRef.current.clear();
      lastCidSeenRef.current = null;
      resumeTargetCidRef.current = null; 
      sessionWasResumedRef.current = false;
    };
    const onResume = () => {
      clearUiForNewSession();
       sessionWasResumedRef.current = true;
    };
    const onEnd = () => {
      clearUiForNewSession();
    };
    const onContextCleared = () => {
      
      clearUiForNewSession();
    };

    window.addEventListener('conversation:startNew', onStartNew as EventListener);
    window.addEventListener('conversation:resume', onResume as EventListener);
    window.addEventListener('conversation:end', onEnd as EventListener);
    window.addEventListener('context:cleared', onContextCleared as EventListener);

    return () => {
      window.removeEventListener('conversation:startNew', onStartNew as EventListener);
      window.removeEventListener('conversation:resume', onResume as EventListener);
      window.removeEventListener('conversation:end', onEnd as EventListener);
      window.removeEventListener('context:cleared', onContextCleared as EventListener);
    };
  }, []);

  
  useEffect(() => {
    const onConvStart = () => {
      logAction({ type: 'conv_start', label: sessionWasResumedRef.current ? 'Resumed conversation.' : 'New conversation started.' });
      sessionWasResumedRef.current = false;
    };
    const onConvEnd = () => {
      logAction({ type: 'conv_end', label: 'Conversation ended.' });
      if (sessionWasResumedRef.current) {
        stripCidFromUrlIfPresent();
      }
    };

    window.addEventListener('conversation:start', onConvStart);
    window.addEventListener('conversation:end', onConvEnd);
    return () => {
      window.removeEventListener('conversation:start', onConvStart);
      window.removeEventListener('conversation:end', onConvEnd);
    };
  }, []);

  
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
      });
    };

    window.addEventListener('stt:startListening', onStartListening);
    window.addEventListener('stt:finalTranscript', onEndListening);
    return () => {
      window.removeEventListener('stt:startListening', onStartListening);
      window.removeEventListener('stt:finalTranscript', onEndListening);
    };
  }, []);


 const regenInProgressRef = useRef(false);
 const genLogTimeoutRef = useRef<number | null>(null);

  

const handleLoadingChange = (loading: boolean) => {
  setIsLoading(loading);

  
  if (genLogTimeoutRef.current) {
    clearTimeout(genLogTimeoutRef.current);
    genLogTimeoutRef.current = null;
  }

  if (loading) {
    
    genLogTimeoutRef.current = window.setTimeout(() => {
      if (!regenInProgressRef.current) {
        logAction({ type: 'generating', label: 'Generating responses…' });
      }
      genLogTimeoutRef.current = null;
    }, 0);
  }
};
  
  const handleResponsesReady = (responses: GenerateResponse) => {
    if (regenInProgressRef.current) regenInProgressRef.current = false; 
    setAiResponses(responses.candidates);
    logAction({ type: 'responses_ready', label: 'Responses ready.' });
  };

  
  const handleBlockClick = async (index: number) => {
    if (isPlaying) return;

    const text = (aiResponses?.[index]?.text ?? '').trim() || `Here's a response.`;
    setActiveIndex(index);

    logAction({ type: 'TTS Start', label: 'User is speaking…' });

    try {
      await speakWithGoogleTTSClient(text, activeTone, activeVoice);
    } catch (err) {
      console.error('TTS error:', err);
      window.dispatchEvent(new Event('tts:end'));
    }
  };


const visibleCount = Math.min(Math.max(aiResponses.length, 2), 6);

const blocks = aiResponses.slice(0, visibleCount).map((c, i) => {
  const label = (c?.text ?? '').trim();

  return {
    label: label || `Option ${i + 1}`,
    onClick: () => handleBlockClick(i),

    
    debug: {
      prob: c?.flow?.prob ?? c?.relativeProb,                 
      utility: c?.flow?.utility,
      meanLogProb: c?.avgLogProb,
      simToLastUser: c?.flow?.simToLastUser,
      lengthPenalty: c?.flow?.lengthPenalty,
      repetitionPenalty: c?.flow?.repetitionPenalty,
      totalPenalty:
        c?.flow?.totalPenalty ??
        ((c?.flow?.lengthPenalty ?? 0) + (c?.flow?.repetitionPenalty ?? 0)),
      weights: c?.flow?.weights, 
    },
  };
});

  

  
  useEffect(() => {
    const qcid = searchParams.get('cid');
    if (!qcid) return;
    sessionWasResumedRef.current = true; 
    window.dispatchEvent(new CustomEvent('conversation:load', { detail: { cid: qcid } }));
  }, [searchParams]);

  
  const autostartFiredRef = useRef(false);

  useEffect(() => {
    const starter = searchParams.get('starter');
    const auto = searchParams.get('autostart');
    if (!starter || auto !== '1') return;

    if (autostartFiredRef.current) return; 
    autostartFiredRef.current = true;

    
    try {
      const w = window as any;
      const token = `starter|${starter}`;
      if (w.__talkableAutoStartToken === token) {
        return; 
      }
      w.__talkableAutoStartToken = token;
    } catch {}

    setAutoStart({ mode: 'new', seed: starter });

    
    speakWithGoogleTTSClient(starter, activeTone, activeVoice).catch(() => {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('tts:end'));
    });

    
    window.dispatchEvent(new CustomEvent('conversation:startNew'));
    window.dispatchEvent(new CustomEvent('conversation:seed', { detail: { text: starter, sender: 'user' } }));

    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('starter'); params.delete('topic'); params.delete('autostart');
    router.replace(`/home${params.size ? `?${params.toString()}` : ''}`);
    
  }, []); 

  
  const canResume =
  !!searchParams.get('cid') ||
  !!lastCreatedCidRef.current ||
  !!resumeTargetCidRef.current;

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
          autoStart={autoStart}
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
            type={'homePage'}
            activeConversation={Boolean(cid)}
          />
        )}
      </div>
    </div>
  );
}
