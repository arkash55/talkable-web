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
import ConversationSidebar from '@/app/components/general/ConversationSidebar';

type Props = { initialTopics: TrendingTopic[] };


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

  
  const visibleTopics = useMemo(() => (trending || []).slice(0, 6), [trending]);

  
  useEffect(() => {
    setTrending(initialTopics || []);
  }, [initialTopics]);

  
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);

  
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

  
  async function refreshTrending() {
    setLoadingTrending(true);
    try {
  const r = Math.random();
  const variant = r < 0.55 ? 'sample' : r < 0.90 ? 'shuffle' : 'newest';
  const seed = Date.now();
  const res = await fetch(`/api/guardian/trending?force=1&limit=6&variant=${variant}&seed=${seed}`, { cache: 'no-store' });
      const data = await res.json();
      console.log('Trending refresh result:', data);

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
      {}
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

        {}
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

      {}
      <ConversationSidebar />
    </Box>
  );
}
