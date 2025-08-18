'use client';

import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import VoiceWaveform from './VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';
import { GenerateResponse } from '@/services/graniteClient';

interface VoiceControlBarProps {
  onResponses: (responses: GenerateResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
  modelContext?: string[]; // NEW: compact context lines
}

export default function VoiceControlBar({ onResponses, onLoadingChange, modelContext }: VoiceControlBarProps) {
  const theme = useTheme();

  const {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    isConversationActive,
    toggleConversation,
    browserSupportsSpeechRecognition,
  } = useVoiceControl(onResponses, onLoadingChange, modelContext); // <- pass through

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
    if (typeof window !== 'undefined') {
      if (isConversationActive) {
        window.dispatchEvent(new CustomEvent('conversation:end'));
      } else {
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
        <Box
          sx={{
            position: 'relative',
            height: 56,
            borderRadius: 1.5,
            ...(isConversationActive && hasSoundLeeway
              ? {
                  animation: 'pulseRect 2s infinite',
                  '@keyframes pulseRect': {
                    '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.35)' },
                    '100%': { boxShadow: '0 0 0 18px rgba(211, 47, 47, 0)' },
                  },
                }
              : {}),
          }}
        >
          <Button
            variant={isConversationActive ? 'contained' : 'outlined'}
            color={isConversationActive ? 'error' : 'inherit'}
            onClick={handleToggle}
            startIcon={isConversationActive ? <MicIcon /> : <MicOffIcon />}
            sx={{
              height: 56,
              borderRadius: 1.5,
              px: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: t => (isConversationActive ? t.palette.error.main : undefined),
              borderColor: t => (isConversationActive ? t.palette.error.main : t.palette.divider),
              color: t => (isConversationActive ? t.palette.error.contrastText : t.palette.text.primary),
              '&:hover': {
                bgcolor: t => (isConversationActive ? t.palette.error.dark : undefined),
                borderColor: t => (isConversationActive ? t.palette.error.dark : t.palette.text.secondary),
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
            // You can decide to trigger a re-gen using the last transcript if desired.
            if (transcript) {
              window.dispatchEvent(new CustomEvent('stt:finalTranscript', { detail: transcript }));
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
