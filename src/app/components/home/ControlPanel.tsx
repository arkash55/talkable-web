// src/app/components/home/ControlPanel.tsx
'use client';

import {
  Box,
  Divider,
  Stack,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Paper,
  alpha,
} from '@mui/material';
import { useEffect, useMemo, useRef } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import HearingIcon from '@mui/icons-material/Hearing';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import HistoryIcon from '@mui/icons-material/History';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import RestoreIcon from '@mui/icons-material/Restore';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import TuneIcon from '@mui/icons-material/Tune';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import InputIcon from '@mui/icons-material/Input';
import ChatIcon from '@mui/icons-material/Chat';
import { useAdvancedMode } from '@/app/context/AdvancedModeContext';

export type ActionType =
  | 'conv_start'
  | 'conv_end'
  | 'conv_created'        // new: from conversation:created
  | 'conv_resume'         // new: when resuming a session
  | 'trending_start'      // new: starting via trending tile
  | 'seed'                // new: seeded starter injected
  | 'history_reset'       // new: history cleared/loaded
  | 'history_updated'    // new: messages appended
  | 'context_update'      // new: context window recomputed
  | 'user_final'
  | 'generating'
  | 'responses_ready'
  | 'TTS Start'
  | 'TTS End'
  | 'ai_message'       // CLICKABLE
  | 'rewind'
  | 'begun listening'
  | 'ended listening'
  | 'final transcript'
  | 'Chat Message';     // chat-only timeline

function iconFor(type: ActionType) {
  switch (type) {
    case 'conv_start': return <PowerSettingsNewIcon fontSize="small" />;
    case 'conv_end': return <PowerOffIcon fontSize="small" />;
    case 'conv_created': return <NewReleasesIcon fontSize="small" />;
    case 'conv_resume': return <PlayCircleOutlineIcon fontSize="small" />;
    case 'trending_start': return <WhatshotIcon fontSize="small" />;
    case 'seed': return <InputIcon fontSize="small" />;
    case 'history_reset': return <RestoreIcon fontSize="small" />;
    case 'history_updated': return <PlaylistAddIcon fontSize="small" />;
    case 'context_update': return <TuneIcon fontSize="small" />;

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
    case 'Chat Message': return <ChatIcon fontSize="small" />; // changed
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
  const { advanced } = useAdvancedMode();

  // Filter based on mode:
  // - Advanced: show everything
  // - Basic: only "Chat Message"
  const visibleActions = useMemo(
    () => (advanced ? actions : actions.filter(a => a.type === 'Chat Message')),
    [actions, advanced]
  );

  // Auto-scroll to bottom on updates (chat-like behavior)
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visibleActions, collapsed]);

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
          <IconButton onClick={onToggle} size="large">
            <ChevronRightIcon sx={{ width: 70, height: 70, fontSize: 70 }} />
          </IconButton>
        </Tooltip>
        <Chip size="small" label={visibleActions.length} sx={{ mt: 'auto' }} />
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
          {!advanced ? 'Chat History' : 'Control Panel'}
        </Typography>
        <Tooltip title="Collapse">
          <IconButton onClick={onToggle} size="small">
            <ChevronLeftIcon sx={{ width: 70, height: 70, fontSize: 70 }} />
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
        {visibleActions.length === 0 ? (
          <Paper
            variant="outlined"
            sx={(theme) => ({
              p: 3,
              borderRadius: 3,
              textAlign: 'center',
              borderStyle: 'dashed',
              borderColor: alpha(theme.palette.text.primary, 0.18),
              background: `linear-gradient(180deg,
                ${alpha(theme.palette.primary.main, 0.08)} 0%,
                ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
            })}
          >
            <Box
              sx={(theme) => ({
                width: 72,
                height: 72,
                borderRadius: '50%',
                mx: 'auto',
                display: 'grid',
                placeItems: 'center',
                mb: 1.5,
                background: alpha(theme.palette.primary.main, 0.12),
                boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.18)}`,
              })}
            >
              <ChatBubbleOutlineIcon sx={{ fontSize: 36, opacity: 0.9 }} />
            </Box>

            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.75 }}>
              {advanced ? 'No actions yet' : 'No messages yet'}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
              {advanced
                ? 'Start speaking or send a message to populate this timeline.'
                : 'Say something or type to start your conversation.'}
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              <Chip size="small" label="Press the mic to start" variant="outlined" />
              <Chip size="small" label="Your replies will appear here" variant="outlined" />
            </Stack>
          </Paper>
        ) : (
          visibleActions.map((a) => {
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
                  // reserved for future “rewind” behaviors
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
              {a.type === 'Chat Message' ? (
                <>
                  <span style={{ fontWeight: 600 }}>
                    {a.label.split(' ')[0].charAt(0).toUpperCase() +
                      a.label.split(' ')[0].slice(1)}
                  </span>
                  {a.label.includes(' ')
                    ? ' ' + a.label.split(' ').slice(1).join(' ')
                    : ''}
                </>
              ) : (
                a.label
              )}
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
