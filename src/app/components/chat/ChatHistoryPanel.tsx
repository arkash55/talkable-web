// src/app/components/chat/ChatHistoryPanel.tsx
'use client';

import { Box, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { onMessages } from '@/services/firestoreService';
import { Message } from '@/services/firestoreService';

type Props = { cid: string };

export default function ChatHistoryPanel({ cid }: Props) {
  const [messages, setMessages] = useState<Array<{ id: string } & Message>>([]);

  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(cid, setMessages, 200);
    return () => unsub();
  }, [cid]);

  return (
    <Box
      sx={{
        width: 320,
        borderLeft: (t) => `1px solid ${t.palette.divider}`,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 1,
      }}
    >
      {messages.map((m) => (
        <Paper key={m.id} sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {m.senderId}
          </Typography>
          <Typography variant="body2">{m.text}</Typography>
        </Paper>
      ))}
    </Box>
  );
}
