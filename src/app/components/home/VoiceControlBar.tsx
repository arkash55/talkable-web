'use client';

import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import VoiceWaveform from './VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';
import { GenerateResponse } from '@/services/graniteClient';

interface VoiceControlBarProps {
  onResponses: (responses: GenerateResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
  modelContext?: string[];
  canResume?: boolean; // NEW: HomeClient tells us if a resume target exists (URL ?cid or last-created)
}

export default function VoiceControlBar({ onResponses, onLoadingChange, modelContext, canResume = false }: VoiceControlBarProps) {
  const theme = useTheme();

  const {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    isConversationActive,
    startNewConversation,
    resumeConversation,
    stopConversation,
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
        {/* Control buttons */}
        {!isConversationActive ? (
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              disabled={!canResume}
              onClick={() => {
                // explicit RESUME
                resumeConversation();
                // also broadcast a generic start for panels that listen to conversation:start (optional)
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('conversation:start'));
                }
              }}
            >
              Resume Conversation
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              startIcon={<MicIcon />}
              onClick={() => {
                // explicit NEW
                startNewConversation();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('conversation:start'));
                }
              }}
              sx={{ fontWeight: 700 }}
            >
              Start New
            </Button>
          </Stack>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={<MicOffIcon />}
            onClick={() => {
              stopConversation();
            }}
          >
            Stop Conversation
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
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
