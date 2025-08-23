// src/app/components/chat/ChatVoiceBar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import MicOffIcon from '@mui/icons-material/MicOff';

import VoiceWaveform from '@/app/components/home/VoiceWaveform';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { START_NEW_BUTTON_SX, STOP_BUTTON_SX } from '@/app/styles/buttonStyles';

type Props = {
  /** Optional: handle the final transcript. Leave unimplemented if you want (no-op). */
  onTranscript?: (finalText: string) => void;
  /** Silence (ms) after which we finalize the transcript. Default 2000ms. */
  silenceMs?: number;
  /** How long to keep the final transcript on screen after STT ends. Default 5000ms. */
  keepFinalMs?: number;
  /** Show the transcript under the bar. Default true. */
  showTranscript?: boolean;
};



const EVT_START = 'chat:stt:startListening';
const EVT_FINAL = 'chat:stt:finalTranscript';

export default function ChatVoiceBar({
  onTranscript,
  silenceMs = 2000,
  keepFinalMs = 5000,
  showTranscript = true,
}: Props) {
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [speaking] = useState(false); // reserved for symmetry with VoiceWaveform
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);

  // Live STT state from the lib
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  // Local display buffer so we can show the last final result even after resetting the lib transcript
  const [displayText, setDisplayText] = useState('');

  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const processing = useRef(false);

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      SpeechRecognition.stopListening();
    };
  }, []);

  // While listening, restart silence timer whenever transcript grows.
  useEffect(() => {
    if (!listening) return;

    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (!transcript.trim()) return;

    silenceTimer.current = setTimeout(async () => {
      if (processing.current) return;
      processing.current = true;

      finalize(transcript.trim());
    }, silenceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, listening, silenceMs]);

  if (!browserSupportsSpeechRecognition) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">
          Your browser doesn't support speech recognition. Please try Chrome, Edge, or Safari.
        </Typography>
      </Box>
    );
  }

  const startListening = () => {
    if (listening) return;

    // Clear any previous display + hide timers
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setDisplayText('');

    resetTranscript();
    setHasSoundLeeway(true);
    setListening(true);
    SpeechRecognition.startListening({ continuous: true });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVT_START));
    }
  };

  const stopNow = () => {
    if (!listening) return;

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }

    const finalText = transcript.trim();
    finalize(finalText);
  };

  const finalize = (finalText: string) => {
    SpeechRecognition.stopListening();
    setListening(false);
    setHasSoundLeeway(false);

    // Show the final transcript for keepFinalMs
    if (finalText) {
      setDisplayText(finalText);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVT_FINAL, { detail: finalText }));
      }
      try {
        onTranscript?.(finalText);
      } finally {
        // Clear the STT lib's internal buffer immediately,
        // but keep our own displayText visible for keepFinalMs.
        resetTranscript();
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          setDisplayText('');
        }, keepFinalMs);
      }
    } else {
      // Nothing captured; just reset
      resetTranscript();
      setDisplayText('');
    }

    processing.current = false;
  };

  const textToShow = listening ? transcript : displayText;

  return (
    <Box
      sx={{
        width: '100%',
        px: 4,
        py: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Conversation With Name
      </Typography>

      {(listening || speaking) && (
        <VoiceWaveform
          listening={listening}
          speaking={speaking}
          hasSound={hasSoundLeeway}
        />
      )}

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        {!listening ? (
          <Button
            variant="contained"
            startIcon={<RecordVoiceOverIcon />}
            onClick={startListening}
            sx={START_NEW_BUTTON_SX}
          >
            Custom Message
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<MicOffIcon />}
            onClick={stopNow}
            sx={STOP_BUTTON_SX}
          >
            Stop Listening
          </Button>
        )}
      </Stack>

      {showTranscript && textToShow && (
        <Typography
          variant="body1"
          sx={{
            width: '100%',
            mt: 2,
            fontStyle: 'italic',
            color: theme.palette.text.secondary,
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}
        >
          {textToShow}
        </Typography>
      )}
    </Box>
  );
}
