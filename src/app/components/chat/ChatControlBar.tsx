// src/app/components/chat/ChatControlBar.tsx
'use client';

import { Box, Button, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import VoiceWaveform from '@/app/components/home/VoiceWaveform';

type Props = {
  listening: boolean;
  transcript: string;
  onStart: () => void;
  onStop: () => void;
};

export default function ChatControlBar({ listening, transcript, onStart, onStop }: Props) {
  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Online Chat
      </Typography>

      {listening ? (
        <Button
          variant="contained"
          color="error"
          startIcon={<StopIcon />}
          onClick={onStop}
        >
          Stop & Send
        </Button>
      ) : (
        <Button
          variant="contained"
          startIcon={<MicIcon />}
          onClick={onStart}
        >
          Record Message
        </Button>
      )}

      {listening && <VoiceWaveform listening={listening} speaking={false} hasSound={true} />}

      {transcript && (
        <Typography sx={{ ml: 2, fontStyle: 'italic', color: 'text.secondary' }}>
          {transcript}
        </Typography>
      )}
    </Box>
  );
}
