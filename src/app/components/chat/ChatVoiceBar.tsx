
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useRouter } from 'next/navigation';

import VoiceWaveform from '@/app/components/home/VoiceWaveform';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { START_NEW_BUTTON_SX, STOP_BUTTON_SX } from '@/app/styles/buttonStyles';

type Props = {
  recipientName: string;
  onTranscript?: (finalText: string) => void;
  silenceMs?: number;
  keepFinalMs?: number;
  showTranscript?: boolean;
};

const EVT_START = 'chat:stt:startListening';
const EVT_FINAL = 'chat:stt:finalTranscript';

export default function ChatVoiceBar({
  recipientName,
  onTranscript,
  silenceMs = 2000,
  keepFinalMs = 5000,
  showTranscript = true,
}: Props) {
  const theme = useTheme();
  const router = useRouter();

  const [listening, setListening] = useState(false);
  const [speaking] = useState(false); 
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);

  const { transcript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const [displayText, setDisplayText] = useState('');

  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const processing = useRef(false);

  
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/'); 
    }
  };

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      SpeechRecognition.stopListening();
    };
  }, []);

  
  useEffect(() => {
    if (!listening) return;

    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (!transcript.trim()) return;

    silenceTimer.current = setTimeout(async () => {
      if (processing.current) return;
      processing.current = true;

      finalize(transcript.trim());
    }, silenceMs);
    
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

    if (finalText) {
      setDisplayText(finalText);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVT_FINAL, { detail: finalText }));
      }
      try {
        onTranscript?.(finalText);
      } finally {
        resetTranscript();
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setDisplayText(''), keepFinalMs);
      }
    } else {
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
      {}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Tooltip title="Back">
          <IconButton
            aria-label="Back"
            onClick={handleBack}
            size="large"
            color="inherit"
            sx={{ mr: 0.5 }}
          >
             <ChevronLeftIcon sx={{ fontSize: 30, mr: 2 }} />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {`Conversation With ${recipientName}`}
        </Typography>
      </Stack>

      {(listening || speaking) && (
        <VoiceWaveform
          listening={listening}
          speaking={speaking}
          hasSound={hasSoundLeeway}
        />
      )}

      {}
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
