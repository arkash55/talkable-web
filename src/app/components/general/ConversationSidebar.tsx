// src/app/components/general/LiveConversationsSidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Stack, Tooltip, Chip, CardActionArea } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useRouter } from 'next/navigation';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onInbox, type InboxItem } from '@/services/firestoreService';

// ---- helpers ----
function formatWhen(ts: any): string {
  try {
    const d: Date =
      ts?.toDate?.() instanceof Date
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : new Date(ts);

    if (Number.isNaN(d.getTime())) return 'Unknown time';

    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      return `Today, ${new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)}`;
    }

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Unknown time';
  }
}

function isUnread(item: InboxItem): boolean {
  const last = item.lastMessageAt as any;
  const read = item.lastReadAt as any;
  try {
    const lastDate =
      last?.toDate?.() instanceof Date ? last.toDate() : new Date(last);
    const readDate =
      read?.toDate?.() instanceof Date ? read.toDate() : read ? new Date(read) : null;
    if (!lastDate || Number.isNaN(lastDate.getTime())) return false;
    if (!readDate || Number.isNaN(readDate.getTime())) return true;
    return lastDate > readDate;
  } catch {
    return false;
  }
}

export default function ConversationsSidebar() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string } & InboxItem>>([]);

  // auth -> uid
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);

  // live inbox for LIVE conversations only
  useEffect(() => {
    if (!uid) return;
    const unsub = onInbox(
      uid,
      (items) => {
        const liveOnly = items.filter((i) => i.mode === 'live');
        setHistory(liveOnly);
      },
      { mode: 'live', pageSize: 100 }
    );
    return () => unsub?.();
  }, [uid]);

  return (
    <Box
      sx={{
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        pl: { xs: 0, md: 2 },
        pt: { xs: 2, md: 0 },
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <ChatBubbleOutlineIcon fontSize="small" />
        <Typography variant="h6" fontWeight={700}>
          Past live conversations
        </Typography>
        <Chip size="small" label={history.length} sx={{ ml: 'auto' }} variant="outlined" />
      </Stack>

      {history.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 2,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">
            No live conversations yet. Start one from the topics on the left.
          </Typography>
        </Paper>
      ) : (
        <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {history.map((item) => {
            const primaryTime = formatWhen(item.lastMessageAt);
            const secondary =
              item.lastMessagePreview && item.lastMessagePreview.trim().length
                ? item.lastMessagePreview
                : 'No messages yet';
            const unread = isUnread(item);
            const lastSender =
              item.lastMessageSenderId === 'guest'
                ? 'Guest'
                : item.lastMessageSenderId
                ? 'You'
                : '';

            return (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  minHeight: 96,
                  p: 1.75,
                  borderRadius: 2,
                  transition:
                    'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 3,
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <CardActionArea
                  onClick={() => {
                    router.push(`/home?cid=${item.id}`);
                  }}
                  sx={{ borderRadius: 2, p: 0.5, height: '100%' }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.75}
                    sx={{ px: 0.5, py: 0.5, minHeight: 72 }}
                  >
                    <Box sx={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                      {unread ? (
                        <FiberManualRecordIcon color="primary" sx={{ fontSize: 11 }} />
                      ) : null}
                    </Box>

                    <Chip size="small" label="Live" variant="outlined" />

                    <Stack sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <ScheduleIcon fontSize="small" />
                        <Tooltip title={primaryTime}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700 }}
                            noWrap
                          >
                            {primaryTime}
                          </Typography>
                        </Tooltip>
                      </Stack>

                      <Typography
                        variant="body1"
                        color="text.secondary"
                        noWrap
                        sx={{ mt: 0.5 }}
                      >
                        {lastSender ? `${lastSender}: ` : ''}
                        {secondary}
                      </Typography>
                    </Stack>

                    <ArrowForwardIosIcon fontSize="small" sx={{ opacity: 0.6 }} />
                  </Stack>
                </CardActionArea>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
