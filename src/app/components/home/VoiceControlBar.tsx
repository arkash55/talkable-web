'use client';

import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';
import VoiceWaveform from '@/app/components/home/VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';


interface VoiceControlBarProps {
  onResponses: (responses: string[]) => void;
}

export default function VoiceControlBar({ onResponses }: VoiceControlBarProps) {
  const theme = useTheme();
  const {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    toggleListening,
  } = useVoiceControl(onResponses);

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
        Voice Controls
      </Typography>

      {(listening || speaking) && (
        <VoiceWaveform
          listening={listening}
          speaking={speaking}
          hasSound={hasSoundLeeway}
        />
      )}

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<MicIcon />}
          onClick={toggleListening}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 180 }}
        >
          {listening ? 'Stop Listening' : 'Start Listening'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => alert('Regenerating responses...')}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 200 }}
        >
          Regenerate Responses
        </Button>
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={() => alert('Repeating question...')}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 180 }}
        >
          Repeat Question
        </Button>
      </Stack>

      {transcript && (
        <Typography
          variant="body1"
          sx={{
            width: '100%',
            mt: 2,
            fontStyle: 'italic',
            color: theme.palette.text.secondary,
            whiteSpace: 'pre-wrap',
          }}
        >
          {transcript}
        </Typography>
      )}
    </Box>
  );
}
