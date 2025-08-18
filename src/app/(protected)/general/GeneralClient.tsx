'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActionArea, Chip, Divider, List, ListItemButton, ListItemText } from '@mui/material';
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
    const unsub = onInbox(uid, (items) => {
      const liveOnly = items.filter(i => i.mode === 'live');
      setHistory(liveOnly);
    }, { mode: 'live', pageSize: 100 });
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
    return () => { alive = false; };
  }, []);

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 2, p: 2 }}>
      {/* Left: Trending Topics */}
      <Box sx={{ overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h5" fontWeight={700}>Trending topics</Typography>
          {loadingTrending ? <Typography variant="body2" color="text.secondary">Refreshing…</Typography> : null}
        </Box>

        <Grid container spacing={2}>
          {trending.map((t) => (
            <Grid key={t.id} item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea
                  onClick={() => {
                    // Navigate to /home with starter + topic params and auto-start
                    const q = new URLSearchParams({ starter: t.starter, topic: t.id, autostart: '1' }).toString();
                    router.push(`/home?${q}`);
                  }}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>{t.title}</Typography>
                      {t.tag ? <Chip size="small" label={t.tag} /> : null}
                    </Box>
                    <Typography variant="body2" color="text.secondary">{t.description}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{t.starter}"</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Right: Conversation History (Live) */}
      <Box sx={{ borderLeft: theme => `1px solid ${theme.palette.divider}`, pl: 2, overflow: 'auto' }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Past live conversations</Typography>
        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No live conversations yet.</Typography>
        ) : (
          <List dense disablePadding>
            {history.map(item => (
              <ListItemButton
                key={item.id}
                onClick={() => {
                  // go to /home with cid (loads conversation)
                  const q = new URLSearchParams({ cid: item.id }).toString();
                  router.push(`/home?${q}`);
                }}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText
                  primary={item.title || 'Untitled conversation'}
                  secondary={
                    item.lastMessagePreview
                      ? item.lastMessagePreview
                      : 'No messages yet'
                  }
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
