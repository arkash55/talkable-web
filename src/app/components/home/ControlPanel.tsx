'use client';

import {
  Box,
  Divider,
  Stack,
  Typography,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import HearingIcon from '@mui/icons-material/Hearing';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PowerOffIcon from '@mui/icons-material/PowerOff';
// NEW ICONS
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type ActionType =
  | 'conv_start'
  | 'conv_end'
  | 'user_final'
  | 'generating'
  | 'responses_ready'
  | 'TTS Start'
  | 'TTS End'
  | 'ai_message'       // CLICKABLE
  | 'rewind'
  | 'begun listening'
  | 'ended listening'
  | 'final transcript';

export type ActionLogEntry = {
  id: string;
  ts: number;
  type: ActionType;
  label: string;
  clickable?: boolean;
  payload?: unknown; // e.g., { index, text }
  backgroundColor?: string;
  textColor?: string;
};

function iconFor(type: ActionType) {
  switch (type) {
    case 'conv_start': return <PowerSettingsNewIcon fontSize="small" />;
    case 'conv_end': return <PowerOffIcon fontSize="small" />;
    case 'user_final': return <HearingIcon fontSize="small" />;
    case 'generating': return <TimerIcon fontSize="small" />;
    case 'responses_ready': return <CheckCircleOutlineIcon fontSize="small" />;
    case 'TTS Start': return <VolumeUpIcon fontSize="small" />;
    case 'TTS End': return <VolumeUpIcon fontSize="small" />;
    case 'ai_message': return <PlayArrowIcon fontSize="small" />;
    case 'rewind': return <UndoIcon fontSize="small" />;
    case 'begun listening': return <MicIcon fontSize="small" />;
    case 'ended listening': return <MicOffIcon fontSize="small" />;
    case 'final transcript': return <SubtitlesIcon fontSize="small" />;
    default: return null;
  }
}

interface ControlPanelProps {
  actions: ActionLogEntry[];
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function ControlPanel({ actions, collapsed = false, onToggle }: ControlPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on updates (chat-like behavior)
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [actions, collapsed]);

  // Collapsed rail content (compact)
  if (collapsed) {
    return (
      <Box
        sx={{
          width: 90,
          height: '100%',
          borderRight: theme => `1px solid ${theme.palette.divider}`,
          backgroundColor: 'background.paper',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Tooltip title="Expand Control Panel">
          <IconButton onClick={onToggle} size="large" >
            <ChevronRightIcon            sx={{
                width: 70,
                height: 70,
                fontSize: 70, 
            }}/>
          </IconButton>
        </Tooltip>
        <Chip
          size="small"
          label={actions.length}
          sx={{ mt: 'auto' }}
        />
      </Box>
    );
  }

  // Expanded full panel
  return (
    <Box
      sx={{
        width: 360,
        height: '100%',
        borderRight: theme => `1px solid ${theme.palette.divider}`,
        backgroundColor: 'background.paper',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          Control Panel · History
        </Typography>
        <Tooltip title="Collapse">
          <IconButton onClick={onToggle} size="small">
            <ChevronLeftIcon            sx={{
                width: 70,
                height: 70,
                fontSize: 70, 
            }}/>
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />

      <Box
        ref={scrollRef}
        sx={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          pr: 0.5,
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
          },
        }}
      >
        {actions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No actions yet. Start a conversation to populate this panel.
          </Typography>
        ) : (
          actions.map((a) => {
            const isClickable = a.type === 'ai_message' && a.clickable;
            const card = (
              <Box
                key={a.id}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  border: theme => `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  cursor: isClickable ? 'pointer' : 'default',
                  backgroundColor: a.backgroundColor || 'transparent',
                  color: a.textColor || 'inherit',
                  transition: 'background-color 0.15s ease',
                  '&:hover': isClickable ? { backgroundColor: theme => theme.palette.action.hover } : undefined,
                }}
                onClick={() => {
                  
                }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  {iconFor(a.type)}
                  <Typography variant="caption" color={a.textColor || 'text.secondary'}>
                    {new Date(a.ts).toLocaleTimeString()}
                  </Typography>
                  <Chip
                    size="small"
                    label={a.type.replace('_', ' ')}
                    variant="outlined"
                    sx={{ ml: 'auto', textTransform: 'capitalize', color: a.textColor || 'text.secondary' }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {a.label}
                </Typography>
              </Box>
            );
            return isClickable ? (
              <Tooltip key={a.id} title="Click to rewind to this AI message">
                {card}
              </Tooltip>
            ) : (
              card
            );
          })
        )}
      </Box>
    </Box>
  );
}
