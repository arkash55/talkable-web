
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tooltip,
  Chip,
  CardActionArea,
  CircularProgress,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useRouter } from 'next/navigation';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { onInbox, type InboxItem } from '@/services/firestoreService';
import { db } from '../../../../lib/fireBaseConfig';
import { REFRESH_BUTTON_SX, TOGGLE_BUTTON_SX } from '@/app/styles/buttonStyles';
import NewOnlineChatDialogue from './NewOnlineChatDialogue';
import TripleToggle from '../shared/TripleToggle';


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

type OtherDetails = {
  otherUid: string;
  name: string;       
  email?: string;
};

type FilterMode = 'all' | 'online' | 'live';

export default function ConversationsSidebar() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string } & InboxItem>>([]);

  
  const [filter, setFilter] = useState<FilterMode>('all');

  
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const currentUid = getAuth().currentUser?.uid ?? null;

  
  const [otherByCid, setOtherByCid] = useState<Record<string, OtherDetails>>({});

  
  const convUnsubsRef = useRef<Record<string, Unsubscribe>>({});
  const userUnsubsRef = useRef<Record<string, Unsubscribe>>({});

  
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);

  
  useEffect(() => {
    if (!uid) return;
    const unsub = onInbox(uid, (items) => setHistory(items), { pageSize: 100 });
    return () => unsub?.();
  }, [uid]);

  
  useEffect(() => {
    const me = getAuth().currentUser?.uid ?? null;
    if (!me) return;

    const onlineCids = new Set(history.filter(h => h.mode === 'online').map(h => h.id));

    
    for (const cid of Object.keys(convUnsubsRef.current)) {
      if (!onlineCids.has(cid)) {
        convUnsubsRef.current[cid]?.();
        delete convUnsubsRef.current[cid];
      }
    }
    
    for (const key of Object.keys(userUnsubsRef.current)) {
      const [cidFromKey] = key.split(':');
      if (!onlineCids.has(cidFromKey)) {
        userUnsubsRef.current[key]?.();
        delete userUnsubsRef.current[key];
      }
    }

    
    
    onlineCids.forEach((cid) => {
      if (convUnsubsRef.current[cid]) return; 

      const cRef = doc(db, 'conversations', cid);
      convUnsubsRef.current[cid] = onSnapshot(cRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const memberIds: string[] = Array.isArray(data?.memberIds) ? data.memberIds : [];
        const otherUid = memberIds.find((m) => m !== me);
        if (!otherUid) return;

        const userKey = `${cid}:${otherUid}`;
        if (userUnsubsRef.current[userKey]) return; 

        const uRef = doc(db, 'users', otherUid);
        userUnsubsRef.current[userKey] = onSnapshot(uRef, (uSnap) => {
          const u = uSnap.data() as any;
          const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
          const display = full || u?.email || 'Unknown user';
          setOtherByCid((prev) => {
            const existing = prev[cid];
            const next: OtherDetails = { otherUid, name: display, email: u?.email };
            if (
              existing &&
              existing.otherUid === next.otherUid &&
              existing.name === next.name &&
              existing.email === next.email
            ) {
              return prev;
            }
            return { ...prev, [cid]: next };
          });
        });
      });
    });

    
    return () => {
      Object.values(convUnsubsRef.current).forEach((u) => u?.());
      convUnsubsRef.current = {};
      Object.values(userUnsubsRef.current).forEach((u) => u?.());
      userUnsubsRef.current = {};
    };
  }, [history]);

  
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      await getDocs(collection(db, 'users'));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };



  
  useEffect(() => {
    if (filter === 'online') {
      
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [filter]);

  
  const filteredByMode = useMemo(() => {
    if (filter === 'online') return history.filter(h => h.mode === 'online');
    if (filter === 'live') return history.filter(h => h.mode !== 'online'); 
    return history; 
  }, [history, filter]);

  
  const visibleHistory = useMemo(() => {
    if (filter !== 'online') return filteredByMode;

    const q = search.trim().toLowerCase();
    if (!q) return filteredByMode;

    return filteredByMode.filter(item => {
      if (item.mode !== 'online') return false;
      const other = otherByCid[item.id];
      const hay = `${other?.name || ''} ${other?.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [filteredByMode, filter, search, otherByCid]);

  return (
    <>
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
        {}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
          <ChatBubbleOutlineIcon fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            Conversations
          </Typography>

        </Stack>

 {}
<Stack
  direction="row"
  alignItems="center"
  spacing={2}
  sx={{ mt: -0.5, mb: 1, flexWrap: 'wrap' }}
>
<TripleToggle
    labels={{ left: 'All', center: 'Online', right: 'Live' }}
    value={filter === 'all' ? 'left' : filter === 'online' ? 'center' : 'right'}
    onChange={(pos) => {
      const next = pos === 'left' ? 'all' : pos === 'center' ? 'online' : 'live';
      setFilter(next as FilterMode);
      if (next !== 'online') setSearch('');
    }}
    height={65}      
    minWidth={300}   
  />

  <Chip
    size="medium"
    label={
      filter === 'all'
        ? `${visibleHistory.length} / ${history.length}`
        : `${visibleHistory.length}`
    }
    variant="outlined"
    sx={{ fontSize: '0.9rem', fontWeight: 600 }}
  />

  {}
  <Box sx={{ flexGrow: 1 }} />

  <Button
    sx={REFRESH_BUTTON_SX}
    onClick={() => {
      fetchUsers();
      setOpenDialog(true);
    }}
  >
    {loadingUsers ? (
      <Stack direction="row" alignItems="center" spacing={1}>
        <CircularProgress size={16} />
        <span>Loading…</span>
      </Stack>
    ) : (
      'Create New Online Chat'
    )}
  </Button>
</Stack>


        {}
        {filter === 'online' && (
          <TextField
            inputRef={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            size="small"
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              mb: 1,
              
              '& .MuiOutlinedInput-input': { py: 3.5 }, 
              
              
            }}
          />
        )}

        {visibleHistory.length === 0 ? (
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
              {filter === 'all'
                ? 'No conversations yet. Start one from the button above.'
                : filter === 'online'
                ? (search
                    ? 'No matching online conversations.'
                    : 'No online conversations.')
                : 'No live conversations.'}
            </Typography>
          </Paper>
        ) : (
          <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {visibleHistory.map((item) => {
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

              const other = item.mode === 'online' ? otherByCid[item.id] : undefined;

              const go = () => {
                if (item.mode === 'online') {
                  
                  const params = new URLSearchParams();
                  if (other?.otherUid) params.set('otherUid', other.otherUid);
                  if (other?.name) params.set('otherName', other.name);
                  if (other?.email) params.set('otherEmail', other.email);
                  router.push(`/chat/${item.id}${params.toString() ? `?${params.toString()}` : ''}`);
                } else {
                  router.push(`/home?cid=${item.id}`);
                }
              };

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
                  <CardActionArea onClick={go} sx={{ borderRadius: 2, p: 0.5, height: '100%' }}>
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

                      <Chip
                        size="small"
                        label={item.mode === 'online' ? 'Online' : 'Live'}
                        variant="outlined"
                        color={item.mode === 'online' ? 'success' : 'default'}
                      />

                      <Stack sx={{ minWidth: 0, flex: 1 }}>
                        {}
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <ScheduleIcon fontSize="small" />
                          <Tooltip title={primaryTime}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                              {primaryTime}
                            </Typography>
                          </Tooltip>
                        </Stack>

                        {}
                        {item.mode === 'online' && other?.name ? (
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, mt: 0.25 }}
                            noWrap
                          >
                            {other.name}
                          </Typography>
                        ) : null}

                        {}
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

      <NewOnlineChatDialogue open={openDialog} onClose={() => setOpenDialog(false)} />
    </>
  );
}
