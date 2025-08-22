// src/app/components/general/ConversationsSidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tooltip,
  Chip,
  CardActionArea,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Button,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AddIcon from '@mui/icons-material/Add';
import { useRouter } from 'next/navigation';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

import { onInbox, type InboxItem, createOnlineConversation } from '@/services/firestoreService';
import { db } from '../../../../lib/fireBaseConfig';
import { REFRESH_BUTTON_SX } from '@/app/styles/buttonStyles';
import NewOnlineChatDialogue from './NewOnlineChatDialogue';

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

  // dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<{ uid: string; email: string }[]>([]);
  const [search, setSearch] = useState('');

  const currentUid = getAuth().currentUser?.uid ?? null;

  // auth -> uid
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);

  // all inbox items (live + online)
  useEffect(() => {
    if (!uid) return;
    const unsub = onInbox(uid, (items) => setHistory(items), { pageSize: 100 });
    return () => unsub?.();
  }, [uid]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const allUsers: { uid: string; email: string }[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== currentUid && data?.email) {
          allUsers.push({ uid: doc.id, email: data.email });
        }
      });
      setUsers(allUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateConversation = async (otherUid: string) => {
    if (!currentUid) return;
    try {
      const cid = await createOnlineConversation({
        creatorUid: currentUid,
        otherUid,
        title: null,
      });
      setOpenDialog(false);
      router.push(`/chat/${cid}`);
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  };

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
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <ChatBubbleOutlineIcon fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            Conversations
          </Typography>
          <Chip size="small" label={history.length} sx={{ ml: 'auto' }} variant="outlined" />

          <Button sx={REFRESH_BUTTON_SX}
            onClick={() => {
              fetchUsers();
              setOpenDialog(true);
            }}
            
          >   
            Create New Online Chat
          </Button>
          {/* <IconButton
            onClick={() => {
              fetchUsers();
              setOpenDialog(true);
            }}
          >
            <AddIcon />
          </IconButton> */}
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
              No conversations yet. Start one from the button above.
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
                      if (item.mode === 'online') {
                        router.push(`/chat/${item.id}`);
                      } else {
                        router.push(`/home?cid=${item.id}`);
                      }
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

                      <Chip
                        size="small"
                        label={item.mode === 'online' ? 'Online' : 'Live'}
                        variant="outlined"
                        color={item.mode === 'online' ? 'success' : 'default'}
                      />

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

     <NewOnlineChatDialogue open={openDialog} onClose={() => setOpenDialog(false)} />
    </>
  );
}
