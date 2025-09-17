// src/app/components/chat/ChatHistoryPanel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { onMessages } from '@/services/firestoreService';
import { getAuth } from 'firebase/auth';

type Props = { cid: string; advanced?: boolean };

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

export default function ChatHistoryPanel({ cid, advanced = false }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const myUid = useMemo(() => getAuth().currentUser?.uid ?? null, []);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to messages
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

  // Scroll to latest
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rows.length, cid]);

  return (
    <Box
      sx={{
        width: 380,
        maxWidth: '38vw',
        height: '100%',
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
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
          Conversation History
        </Typography>
      </Box>

      {/* Scrollable area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {rows.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
            }}
          >
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
                maxWidth: 420,
                width: '100%',
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
                  ? 'Start a conversation to populate this timeline.'
                  : 'Start a conversation to populate the chat history.'}
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                justifyContent="center"
                useFlexGap
                flexWrap="wrap"
                sx={{ mt: 0.5 }}
              >
            
                <Chip size="small" label="Message history will appear here" variant="outlined" />
              </Stack>
            </Paper>
          </Box>
        ) : (
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
                      const bg = '#2e7d32'; // other user bubble
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
        )}
      </Box>
    </Box>
  );
}
