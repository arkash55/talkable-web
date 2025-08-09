'use client';

import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import RefreshIcon from '@mui/icons-material/Refresh';
import VoiceWaveform from './VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';

interface VoiceControlBarProps {
  onResponses: (responses: string[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function VoiceControlBar({ onResponses, onLoadingChange }: VoiceControlBarProps) {
  const theme = useTheme();

  const {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    isConversationActive,
    toggleConversation,
    browserSupportsSpeechRecognition,
  } = useVoiceControl(onResponses, onLoadingChange);

  if (!browserSupportsSpeechRecognition) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">
          Your browser doesn't support speech recognition. Please try Chrome, Edge, or Safari.
        </Typography>
      </Box>
    );
  }

  const handleToggle = () => {
    // Proactively dispatch conversation start/end so the panel definitely logs it.
    if (typeof window !== 'undefined') {
      if (isConversationActive) {
        // we are about to stop
        window.dispatchEvent(new CustomEvent('conversation:end'));
      } else {
        // we are about to start
        window.dispatchEvent(new CustomEvent('conversation:start'));
      }
    }
    toggleConversation();
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
          onClick={handleToggle}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 200 }}
        >
          {isConversationActive
            ? listening
              ? 'Listening…'
              : speaking
              ? 'Speaking…'
              : 'Stop Conversation'
            : 'Start Conversation'}
        </Button>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            if (transcript) {
              onResponses([
                'Could you repeat that?',
                "I didn’t catch that",
                'Let me think about that',
                "That’s interesting",
                'Tell me more',
                "Let’s change the subject",
              ]);
            }
          }}
          disabled={!transcript}
          sx={{ fontWeight: 'bold', px: 3, py: 1.5, minWidth: 200 }}
        >
          Regenerate Responses
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
            fontFamily: 'monospace',
          }}
        >
          {transcript}
        </Typography>
      )}
    </Box>
  );
}
