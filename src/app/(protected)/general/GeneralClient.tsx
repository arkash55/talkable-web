'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  CardActionArea,
  Chip,
  Tooltip,
  Paper,
  Stack,
  Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useRouter } from 'next/navigation';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onInbox, type InboxItem } from '@/services/firestoreService';
import { TrendingTile, TrendingTopic } from '@/app/components/general/TrendingTile';
import { REFRESH_BUTTON_SX } from '@/app/styles/buttonStyles';

type Props = { initialTopics: TrendingTopic[] };

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

export default function GeneralClient({ initialTopics }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string } & InboxItem>>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>(initialTopics || []);
  const [loadingTrending, setLoadingTrending] = useState(false);

  // Always display only the top 6 in UI
  const visibleTopics = useMemo(() => (trending || []).slice(0, 6), [trending]);

  // hydrate trending from server props if they change (e.g., RSC nav)
  useEffect(() => {
    setTrending(initialTopics || []);
  }, [initialTopics]);

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

  // refresh trending via API route (bypasses service cache)
  async function refreshTrending() {
    setLoadingTrending(true);
    try {
      const res = await fetch('/api/granite/trending?force=1&min=6&limit=6', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data?.topics)) {
        setTrending((data.topics as TrendingTopic[]).slice(0, 6));
      }
    } catch (e) {
      console.error('Trending refresh error', e);
    } finally {
      setLoadingTrending(false);
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
        gap: 2,
        p: 2,
      }}
    >
      {/* Left: Trending Topics (2 columns × 3 rows) */}
      <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Trending topics
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
       

            <Button
              variant="contained"
              startIcon={
                <RefreshIcon
                  sx={{
                    animation: loadingTrending ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              }
              onClick={refreshTrending}
              disabled={loadingTrending}
              aria-busy={loadingTrending ? 'true' : 'false'}
              sx={REFRESH_BUTTON_SX}
            >
              {loadingTrending ? 'Refreshing…' : 'Refresh Topics'}
            </Button>
          </Stack>
        </Box>

        {/* 2 columns on sm+; 3 rows since we show 6 items */}
        <Grid container spacing={2}>
          {visibleTopics.map((t) => (
            <Grid key={t.id} item xs={12} sm={6}>
              <TrendingTile
                topic={t}
                onClick={() => {
                  const q = new URLSearchParams({
                    starter: t.starter,
                    topic: t.id,
                    autostart: '1',
                  }).toString();
                  router.push(`/home?${q}`);
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Right: Past live conversations (≈40%) */}
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
                      const q = new URLSearchParams({ cid: item.id }).toString();
                      router.push(`/home?${q}`);
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
    </Box>
  );
}
