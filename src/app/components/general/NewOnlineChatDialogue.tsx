// src/app/components/general/NewOnlineChatDialog.tsx
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Avatar,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Box,
} from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import { collection, getDocs } from 'firebase/firestore';

import { getAuth } from 'firebase/auth';
import { createOnlineConversation, getUsers } from '@/services/firestoreService';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/fireBaseConfig';
import { useEffect } from 'react';

type UserRecord = {
  uid: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  pronouns?: string;
  description?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const filter = createFilterOptions<UserRecord>({
  stringify: (u) =>
    `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email ?? ''}`
      .toLowerCase()
      .trim(),
  limit: 50,
});

export default function NewOnlineChatDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState<UserRecord[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const currentUid = getAuth().currentUser?.uid ?? null;

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await getUsers({ excludeUid: currentUid || '' });
        if (mounted) setAllUsers(rows);
      } catch (e) {
        console.error('Failed to load users:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, currentUid]);

  
  const handleSelect = async (user: UserRecord | null) => {
    if (!user || !currentUid) return;
    try {
      const cid = await createOnlineConversation({
        creatorUid: currentUid,
        otherUid: user.uid,
        title: null,
      });
      onClose();
      router.push(`/chat/${cid}`);
    } catch (err) {
      console.error('Error creating online conversation:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Start New Online Chat</DialogTitle>
      <DialogContent>
        <Autocomplete
          autoHighlight
          blurOnSelect
          loading={loading}
          options={allUsers}
          filterOptions={filter}
          // ✅ stable identity so MUI can manage selection & keys
          isOptionEqualToValue={(a, b) => a.uid === b.uid}
          // ✅ stable, human label (dup labels are okay; identity is via uid)
          getOptionLabel={(u) =>
            (u
              ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
              : '') || u.email || ''
          }
          renderOption={(props, u) => {
            const name =
              `${u.firstName ?? ''} ${u.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
            const initials =
              (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
            // ⬇️ IMPORTANT: do NOT add your own key here; props already includes a key
            return (
              <li {...props}>
                <ListItemAvatar>
                  <Avatar>{initials || (u.email?.[0]?.toUpperCase() ?? '?')}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    name ? `${name}${u.pronouns ? ` (${u.pronouns})` : ''}` : (u.email ?? 'Unknown user')
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'block' }}>
                      {u.email ? (
                        <Box component="span" sx={{ fontFamily: 'monospace' }}>
                          {u.email}
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          No email on file
                        </Box>
                      )}
                      {u.description ? (
                        <Box
                          component="span"
                          sx={{ display: 'block', color: 'text.secondary' }}
                        >
                          {u.description}
                        </Box>
                      ) : null}
                    </Box>
                  }
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </li>
            );
          }}
          onChange={(_, val) => handleSelect(val)}
          inputValue={inputValue}
          onInputChange={(_, val) => setInputValue(val)}
          noOptionsText={loading ? 'Loading…' : 'No matching users'}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              placeholder="Search by name or email"
              inputProps={{
                ...params.inputProps,
                'x-webkit-speech': 'x-webkit-speech', // Chrome mic 🎤
                autoComplete: 'off',
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              sx={{ mt: 1, mb: 2 }}
            />
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
