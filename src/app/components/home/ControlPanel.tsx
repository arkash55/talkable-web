'use client';

import {
  Box,
  Divider,
  Stack,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import HearingIcon from '@mui/icons-material/Hearing';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UndoIcon from '@mui/icons-material/Undo';

export type ActionType =
  | 'user_final'      // (optional, if you later log user transcript)
  | 'generating'
  | 'responses_ready'
  | 'tts_start'
  | 'tts_end'
  | 'ai_message'      // CLICKABLE
  | 'rewind';

export type ActionLogEntry = {
  id: string;
  ts: number;
  type: ActionType;
  label: string;
  clickable?: boolean;
  payload?: unknown; // e.g., { index, text }
};

function iconFor(type: ActionType) {
  switch (type) {
    case 'user_final': return <HearingIcon fontSize="small" />;
    case 'generating': return <TimerIcon fontSize="small" />;
    case 'responses_ready': return <CheckCircleOutlineIcon fontSize="small" />;
    case 'tts_start': return <VolumeUpIcon fontSize="small" />;
    case 'tts_end': return <VolumeUpIcon fontSize="small" />;
    case 'ai_message': return <PlayArrowIcon fontSize="small" />;
    case 'rewind': return <UndoIcon fontSize="small" />;
    default: return null;
  }
}

interface ControlPanelProps {
  actions: ActionLogEntry[];
  onRewind: (actionId: string) => void; // Only reacts to ai_message
}

export default function ControlPanel({ actions, onRewind }: ControlPanelProps) {
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
        overflowY: 'auto',
      }}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        Control Panel · History
      </Typography>
      <Divider />

      {actions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No actions yet. Start a conversation to populate this panel.
        </Typography>
      ) : (
        <Stack gap={1.25}>
          {actions.map((a) => {
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
                  transition: 'background-color 0.15s ease',
                  '&:hover': isClickable ? { backgroundColor: theme => theme.palette.action.hover } : undefined,
                }}
                onClick={() => {
                  if (isClickable) onRewind(a.id);
                }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  {iconFor(a.type)}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(a.ts).toLocaleTimeString()}
                  </Typography>
                  <Chip
                    size="small"
                    label={a.type.replace('_', ' ')}
                    variant="outlined"
                    sx={{ ml: 'auto', textTransform: 'capitalize' }}
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
          })}
        </Stack>
      )}
    </Box>
  );
}
