'use client';

import { useEffect, useState, useMemo } from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { onMessages } from '@/services/firestoreService';
import { getAuth } from 'firebase/auth';

type Props = { cid: string };

export default function ChatHistoryPanel({ cid }: Props) {
  const [rows, setRows] = useState<Array<{ id: string; text: string; senderId: string; sentAt?: Date }>>([]);
  const myUid = useMemo(() => getAuth().currentUser?.uid ?? null, []);

  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(cid, (msgs) => {
      const norm = msgs.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
        sentAt: (m.sentAt as any)?.toDate ? (m.sentAt as any).toDate() : undefined,
      }));
      setRows(norm);
    }, 200);
    return () => unsub?.();
  }, [cid]);

  return (
    <Box
      sx={{
        width: 380,
        maxWidth: '38vw',
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 1,
        overflow: 'auto',
      }}
    >
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Conversation
      </Typography>

      <Stack spacing={1.5}>
        {rows.map((m) => {
          const mine = m.senderId === myUid;
          return (
            <Box
              key={m.id}
              sx={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                elevation={0}
                sx={(theme) => ({
                  maxWidth: '80%',
                  p: 1.25,
                  borderRadius: 2,
                  backgroundColor: mine ? theme.palette.primary.main : theme.palette.grey[100],
                  color: mine ? theme.palette.primary.contrastText : theme.palette.text.primary,
                })}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </Typography>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
