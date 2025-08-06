'use client';

import { useState, useTransition, useEffect } from 'react';
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
  const [isPending, startTransition] = useTransition();

  const handleStartListening = () => {
    setListening(true);

    const mockTranscript = 'Do you want to go outside today?';

    startTransition(async () => {
      const conversation: Message[] = [{ sender: 'other', text: mockTranscript }];
      const responses = await getResponsesFromAI(conversation);
      onResponses(responses);
      setListening(false);
    });
  };

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
        {(listening || speaking) && <VoiceWaveform />}


      {/* Right side: Controls */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        {/* Start Listening */}
        <Button
          variant="contained"
          startIcon={<MicIcon />}
          onClick={handleStartListening}
          disabled={listening || isPending}
          sx={{
            fontWeight: 'bold',
            px: 3,
            py: 1.5,
            minWidth: 180,
          }}
        >
          {listening || isPending ? 'Listening...' : 'Start Listening'}
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
