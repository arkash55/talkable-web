'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  Stack,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Message } from '@/app/types/types';
import { getResponsesFromAI } from '@/app/actions/getResponseFromAI';
import VoiceWaveform from '@/app/components/home/VoiceWaveform';

interface VoiceControlBarProps {
  onResponses: (responses: string[]) => void;
}

export default function VoiceControlBar({ onResponses }: VoiceControlBarProps) {
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hasSound, setHasSound] = useState(false);
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const leewayTimeout = useRef<NodeJS.Timeout | null>(null);

  // Listen for TTS events
  useEffect(() => {
    const handleStart = () => setSpeaking(true);
    const handleEnd = () => setSpeaking(false);

    window.addEventListener('tts:start', handleStart);
    window.addEventListener('tts:end', handleEnd);

    return () => {
      window.removeEventListener('tts:start', handleStart);
      window.removeEventListener('tts:end', handleEnd);
    };
  }, []);

  // Whenever hasSound changes, update hasSoundLeeway with a delay
  useEffect(() => {
    if (hasSound) {
      if (leewayTimeout.current) clearTimeout(leewayTimeout.current);
      setHasSoundLeeway(true);
    } else {
      // Wait 1.5s before setting hasSoundLeeway to false
      leewayTimeout.current = setTimeout(() => setHasSoundLeeway(false), 1000);
    }
    return () => {
      if (leewayTimeout.current) clearTimeout(leewayTimeout.current);
    };
  }, [hasSound]);

  const toggleListening = async () => {
    if (!listening) {
      setListening(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256; // More bins for smoother bars
        source.connect(analyserRef.current);

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const updateLevels = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);

            const avgVolume = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
            setHasSound(avgVolume > 30); // Adjust threshold as needed
          }
          animationFrameRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();
      } catch (err) {
        setListening(false);
      }
    } else {
      setListening(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setHasSound(false);
    }
  };

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
      {/* Left side: Title */}
      <Typography
        variant="h6"
        sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
      >
        Voice Controls
      </Typography>

      {/* Waveform shows if speaking or listening */}
      {(listening || speaking) && (
        <VoiceWaveform
          listening={listening}
          speaking={speaking}
          hasSound={hasSoundLeeway}
        />
      )}

      {/* Right side: Controls */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        {/* Start Listening */}
        <Button
          variant="contained"
          startIcon={<MicIcon />}
          onClick={toggleListening}
          sx={{
            fontWeight: 'bold',
            px: 3,
            py: 1.5,
            minWidth: 180,
          }}
        >
          {listening ? 'Stop Listening' : 'Start Listening'}
        </Button>


        {/* Regenerate Responses */}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => alert('Regenerating responses...')}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 200 }}
        >
          Regenerate Responses
        </Button>

        {/* Repeat Question */}
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={() => alert('Repeating question...')}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 180 }}
        >
          Repeat Question
        </Button>
      </Stack>
    </Box>
  );
}
