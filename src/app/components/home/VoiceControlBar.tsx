// src/app/components/home/VoiceControlBar.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import MicOffIcon from '@mui/icons-material/MicOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import VoiceWaveform from './VoiceWaveform';
import { useVoiceControl } from '@/app/hooks/useVoiceControl';
import { GenerateResponse } from '@/services/graniteClient';
import { REFRESH_BUTTON_SX, START_NEW_BUTTON_SX, STOP_BUTTON_SX } from '@/app/styles/buttonStyles';

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

type AutoStartPayload = { mode: 'new' | 'resume'; seed?: string } | null;

interface VoiceControlBarProps {
  onResponses: (responses: GenerateResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
  modelContext?: string[];
  canResume?: boolean;
  autoStart?: AutoStartPayload;           // <-- NEW
}

export default function VoiceControlBar({
  onResponses,
  onLoadingChange,
  modelContext,
  canResume = false,
  autoStart = null,                        // <-- NEW
}: VoiceControlBarProps) {
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

  // consume autoStart prop exactly once (no new event listeners)
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || consumedRef.current || !browserSupportsSpeechRecognition) return;

    // 1) Flip UI into active mode & start STT
    if (!isConversationActive) {
      if (autoStart.mode === 'resume') {
        resumeConversation();
      } else {
        startNewConversation();
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation:start'));
      }
    }

    // 2) Send the opener AS USER through existing pipeline (saves to Firestore + context)
    if (autoStart.seed) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ui:voicegrid:click', { detail: { index: -1, label: autoStart.seed } })
        );
      }
    }

    consumedRef.current = true;
  }, [
    autoStart,
    isConversationActive,
    startNewConversation,
    resumeConversation,
    browserSupportsSpeechRecognition,
  ]);

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
          startIcon={<PlayArrowIcon />}
          disabled={!canResume}
          onClick={() => {
            // explicit RESUME
            resumeConversation();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('conversation:start'));
            }
          }}
          sx={[
            START_NEW_BUTTON_SX,
            (theme) => ({
              '&.Mui-disabled': {
                opacity: 1,
                background: `linear-gradient(135deg, ${theme.palette.grey[300]} 0%, ${theme.palette.grey[500]} 65%)`,
                color: theme.palette.getContrastText(theme.palette.grey[400]),
              },
            }),
          ]}
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
        variant="contained"
        startIcon={<RefreshIcon />}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ui:regenerate'));
          }
        }}
        disabled={!transcript}
        sx={[
          REFRESH_BUTTON_SX,
          (theme) => ({
            '&.Mui-disabled': {
                opacity: 1,
                background: `linear-gradient(135deg, ${theme.palette.grey[300]} 0%, ${theme.palette.grey[500]} 65%)`,
                color: theme.palette.getContrastText(theme.palette.grey[400]),
                // border: 'none'
            },
          }),
        ]}
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
