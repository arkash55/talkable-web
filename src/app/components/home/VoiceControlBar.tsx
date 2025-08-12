'use client';

import { Box, Button, Typography, useTheme, Stack, IconButton } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import VoiceWaveform from './VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';
import { GenerateResponse } from '@/services/graniteClient';

interface VoiceControlBarProps {
  onResponses: (responses: GenerateResponse) => void;
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
        {/* Rectangular listening control with pulse animation */}
        <Box
          sx={{
            position: 'relative',
            height: 56,
            borderRadius: 1.5, // 12px
            // Pulse glow behind the button when active
            ...(isConversationActive && hasSoundLeeway
              ? {
                  animation: 'pulseRect 2s infinite',
                  '@keyframes pulseRect': {
                    '0%': {
                      boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.35)',
                    },
                    '100%': {
                      boxShadow: '0 0 0 18px rgba(211, 47, 47, 0)',
                    },
                  },
                }
              : {}),
          }}
        >
          <Button
            variant={isConversationActive ? 'contained' : 'outlined'}
            color={isConversationActive ? 'error' : 'inherit'}
            disabled={!browserSupportsSpeechRecognition}
            onClick={toggleConversation}
            startIcon={isConversationActive ? <MicIcon /> : <MicOffIcon />}
            sx={{
              height: 56,
              borderRadius: 1.5, // keep same radius as wrapper
              px: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: theme =>
                isConversationActive ? theme.palette.error.main : undefined,
              borderColor: theme =>
                isConversationActive ? theme.palette.error.main : theme.palette.divider,
              color: theme =>
                isConversationActive ? theme.palette.error.contrastText : theme.palette.text.primary,
              '&:hover': {
                bgcolor: theme =>
                  isConversationActive ? theme.palette.error.dark : undefined,
                borderColor: theme =>
                  isConversationActive ? theme.palette.error.dark : theme.palette.text.secondary,
              },
            }}
          >
            {isConversationActive ? 'STOP CONVERSATION' : 'START CONVERSATION'}
          </Button>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            if (transcript) {
              // onResponses([
              //   'Could you repeat that?',
              //   "I didn’t catch that",
              //   'Let me think about that',
              //   "That’s interesting",
              //   'Tell me more',
              //   "Let’s change the subject",
              // ]);
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
