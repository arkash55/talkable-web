'use client';

import {
  Box,
  IconButton,
  Typography,
  Divider,
  useTheme,
  Paper,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useState } from 'react';

const mockMessages = [
  { text: 'Hi, how can I help you today?', sender: 'user' },
  { text: 'Can you repeat that?', sender: 'ai' },
  { text: 'Would you like me to call someone?', sender: 'user' },
  { text: 'That sounds great!', sender: 'ai' },
  { text: 'Okay, I’ll remember that.', sender: 'user' },
  { text: 'Goodbye!', sender: 'ai' },
];

export default function ConversationSidebar() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const width = open ? '25%' : 56;

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
          <Divider sx={{ mb: 2 }} />
          {mockMessages.map((msg, i) => {
            const isUser = msg.sender === 'user';

            return (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  mb: 1.5,
                }}
              >
                <Paper
                  elevation={3}
                  sx={{
                    px: 2,
                    py: 1,
                    maxWidth: '75%',
                    bgcolor: isUser
                      ? theme.palette.primary.main
                      : theme.palette.grey[300],
                    color: isUser
                      ? theme.palette.primary.contrastText
                      : theme.palette.text.primary,
                  }}
                >
                  <Typography variant="body2">{msg.text}</Typography>
                </Paper>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
