'use client';

import {
  Box,
  IconButton,
  Typography,
  Divider,
  useTheme,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useState } from 'react';

const mockMessages = [
  'Hi, how can I help you today?',
  'Can you repeat that?',
  'Would you like me to call someone?',
  'That sounds great!',
  'Okay, I’ll remember that.',
  'Goodbye!',
];

export default function ConversationSidebar() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const width = open ? 300 : 56;

  return (
    <Box
      sx={{
        width,
        transition: 'width 0.3s ease',
        backgroundColor: theme.palette.background.default,
        borderLeft: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Toggle button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: open ? 'flex-end' : 'center',
          alignItems: 'center',
          height: 56,
          px: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <IconButton onClick={() => setOpen(!open)} size="small">
          {open ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      {/* Content */}
      {open && (
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Conversation History
          </Typography>
          <Divider />
          {mockMessages.map((msg, i) => (
            <Box key={i} sx={{ my: 2 }}>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {msg}
              </Typography>
              <Divider sx={{ my: 1 }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
