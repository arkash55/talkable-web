'use client';

import { Box, Button, Typography, useTheme, Stack, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useState } from 'react';

export default function VoiceControlBar() {
  const theme = useTheme();
  const [listening, setListening] = useState(false);

  const handleStartListening = () => {
    setListening(true);
    // TODO: Integrate with audio recording
    setTimeout(() => setListening(false), 5000); // mock stop after 5 seconds
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
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Left side: Title or instructions */}
      <Typography
        variant="h6"
        sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
      >
        Voice Controls
      </Typography>

      {/* Right side: Buttons */}
      <Stack direction="row" spacing={2} alignItems="center">
        {/* Start Listening */}
        <Button
          variant="contained"
          startIcon={<MicIcon />}
          onClick={handleStartListening}
          sx={{
            fontWeight: 'bold',
            px: 3,
            py: 1.5,
            minWidth: 160,
          }}
        >
          {listening ? 'Listening...' : 'Start Listening'}
        </Button>

        {/* Optional waveform indicator (mocked with spinner) */}
        {listening && <CircularProgress size={28} thickness={4} />}

        {/* Regenerate Responses */}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 200 }}
          onClick={() => alert('Regenerating responses...')}
        >
          Regenerate Responses
        </Button>

        {/* Repeat Question */}
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 180 }}
          onClick={() => alert('Repeating question...')}
        >
          Repeat Question
        </Button>
      </Stack>
    </Box>
  );
}
