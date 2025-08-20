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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { START_NEW_BUTTON_SX, STOP_BUTTON_SX } from '@/app/styles/buttonStyles';

// Shared size/style so all control buttons match
const CONTROL_BUTTON_SX = {
  fontWeight: 700,
  px: 3,
  py: 1.5,
  height: 56,
  minWidth: 200,
  borderRadius: 2,
  textTransform: 'none' as const,
  lineHeight: 1.1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};





interface VoiceControlBarProps {
  onResponses: (responses: GenerateResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
  modelContext?: string[];
  canResume?: boolean;
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
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => {
                startNewConversation();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('conversation:start'));
                }
              }}
              sx={START_NEW_BUTTON_SX}
            >
              Start New Conversation
            </Button>

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
              sx={CONTROL_BUTTON_SX}
            >
              Resume Conversation
            </Button>
          </Stack>
        ) : (
          <Button
            startIcon={<MicOffIcon />}
            onClick={() => {
              stopConversation();
            }}
            sx={STOP_BUTTON_SX}
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
          sx={CONTROL_BUTTON_SX}
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
