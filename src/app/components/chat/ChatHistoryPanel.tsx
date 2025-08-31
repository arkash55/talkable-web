// src/app/components/chat/ChatHistoryPanel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { onMessages } from '@/services/firestoreService';
import { getAuth } from 'firebase/auth';

type Props = { cid: string };

type Row = {
  id: string;
  text: string;
  senderId: string;
  sentAt?: Date;
};

function formatWhen(d?: Date) {
  if (!d || Number.isNaN(d.getTime?.())) return 'Sending…';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function ChatHistoryPanel({ cid }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const myUid = useMemo(() => getAuth().currentUser?.uid ?? null, []);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to messages (ascending by sentAt per your service)
  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(
      cid,
      (msgs) => {
        const norm: Row[] = msgs.map((m) => ({
          id: m.id,
          text: m.text,
          senderId: m.senderId,
          sentAt: (m.sentAt as any)?.toDate ? (m.sentAt as any).toDate() : undefined,
        }));
        setRows(norm);
      },
      200
    );
    return () => unsub?.();
  }, [cid]);

  // Always scroll to the latest message when rows change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rows.length, cid]);

  return (
    <Box
      sx={{
        width: 380,
        maxWidth: '38vw',
        height: '100%',                   // ensure the panel can contain an inner scroller
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sticky header that stays visible */}
      <Box
        sx={(theme) => ({
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          px: 2,
          py: 1.25,
        })}
      >
        <Typography variant="h6" fontWeight={700}>
          Conversation
        </Typography>
      </Box>

      {/* Scrollable messages area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
        }}
      >
        <Stack spacing={1.5}>
          {rows.map((m) => {
            const mine = m.senderId === myUid;
            return (
              <Box
                key={m.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                }}
              >
                <Paper
                  elevation={0}
                  sx={(theme) => {
                    if (mine) {
                      return {
                        maxWidth: '80%',
                        p: 1.25,
                        borderRadius: 2,
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      };
                    }
                    // OTHER USER bubble — high-contrast (your green)
                    const bg = '#2e7d32';
                    return {
                      maxWidth: '80%',
                      p: 1.25,
                      borderRadius: 2,
                      backgroundColor: bg,
                      color: 'white',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    };
                  }}
                >
                  <Typography variant="body2">{m.text}</Typography>
                </Paper>

                {/* timestamp under the bubble, right/left aligned */}
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.5,
                    opacity: 0.7,
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  {formatWhen(m.sentAt)}
                </Typography>
              </Box>
            );
          })}
          <div ref={endRef} />
        </Stack>
      </Box>
    </Box>
  );
}
