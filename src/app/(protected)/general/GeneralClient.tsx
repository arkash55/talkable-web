'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Divider,
  Tooltip,
  Paper,
  Stack,
  Avatar,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import BoltIcon from '@mui/icons-material/Bolt';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GavelIcon from '@mui/icons-material/Gavel';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onInbox, type InboxItem } from '@/services/firestoreService';

type TrendingTopic = {
  id: string;            // slug/id
  title: string;         // e.g., "Football"
  description: string;   // short blurb
  starter: string;       // suggested opener
  tag?: string;          // optional category label (sports/news/politics/etc)
};

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

function TopicIcon({ tag }: { tag?: string }) {
  if (!tag) return <WhatshotIcon fontSize="small" />;
  const t = tag.toLowerCase();
  if (t.includes('sport') || t.includes('football')) return <SportsSoccerIcon fontSize="small" />;
  if (t.includes('news')) return <NewspaperIcon fontSize="small" />;
  if (t.includes('politic')) return <GavelIcon fontSize="small" />;
  if (t.includes('trend')) return <BoltIcon fontSize="small" />;
  return <WhatshotIcon fontSize="small" />;
}

export default function GeneralClient() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string } & InboxItem>>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

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

  // fetch trending topics from Granite route
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingTrending(true);
      try {
        const res = await fetch('/api/granite/trending');
        const data = await res.json();
        if (alive && Array.isArray(data?.topics)) {
          setTrending(data.topics as TrendingTopic[]);
        }
      } catch (e) {
        console.error('Trending fetch error', e);
      } finally {
        setLoadingTrending(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: 2,
        p: 2,
      }}
    >
      {/* Left: Trending Topics */}
      <Box sx={{ overflow: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Trending topics
          </Typography>
          {loadingTrending ? (
            <Typography variant="body2" color="text.secondary">
              Refreshing…
            </Typography>
          ) : null}
        </Box>

        <Grid container spacing={2}>
          {trending.map((t) => (
            <Grid key={t.id} item xs={12} sm={6} md={4}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderRadius: 2,
                  transition: 'transform 120ms ease, box-shadow 120ms ease',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
              >
                <CardActionArea
                  onClick={() => {
                    const q = new URLSearchParams({
                      starter: t.starter,
                      topic: t.id,
                      autostart: '1',
                    }).toString();
                    router.push(`/home?${q}`);
                  }}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Avatar sx={{ width: 28, height: 28 }}>
                        <TopicIcon tag={t.tag} />
                      </Avatar>
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                        {t.title}
                      </Typography>
                      {t.tag ? <Chip size="small" label={t.tag} /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {t.description}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      “{t.starter}”
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Right: Conversation History (Live) */}
      <Box
        sx={{
          borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
          pl: 2,
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
          <Chip
            size="small"
            label={history.length}
            sx={{ ml: 'auto' }}
            variant="outlined"
          />
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
                    p: 1.25,
                    borderRadius: 2,
                    transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
                    '&:hover': { transform: 'translateY(-1px)', boxShadow: 3, backgroundColor: 'action.hover' },
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      const q = new URLSearchParams({ cid: item.id }).toString();
                      router.push(`/home?${q}`);
                    }}
                    sx={{ borderRadius: 2, p: 0.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 0.5, py: 0.5 }}>
                      {/* Unread dot */}
                      <Box sx={{ width: 12, display: 'flex', justifyContent: 'center' }}>
                        {unread ? (
                          <FiberManualRecordIcon color="primary" sx={{ fontSize: 10 }} />
                        ) : null}
                      </Box>

                      {/* Live chip */}
                      <Chip size="small" label="Live" variant="outlined" />

                      {/* When */}
                      <Stack sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <ScheduleIcon fontSize="inherit" />
                          <Tooltip title={primaryTime}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700 }}
                              noWrap
                            >
                              {primaryTime}
                            </Typography>
                          </Tooltip>
                        </Stack>

                        {/* Preview line */}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ mt: 0.25 }}
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
