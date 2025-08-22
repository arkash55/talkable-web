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
import { createOnlineConversation } from '@/services/firestoreService';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/fireBaseConfig';

type UserRecord = {
  uid: string;
  email: string;
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
    `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`.trim().toLowerCase(),
  limit: 50,
});

export default function NewOnlineChatDialog({ open, onClose }: Props) {
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState<UserRecord[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const currentUid = getAuth().currentUser?.uid ?? null;

  // Load users when modal opens
  React.useEffect(() => {
    if (!open) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users: UserRecord[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          // Expecting fields: firstName, lastName, email, pronouns, description
          // (email should be stored in user doc during sign‑up/profile save)
          if (doc.id !== currentUid && data?.email) {
            users.push({
              uid: doc.id,
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              pronouns: data.pronouns,
              description: data.description,
            });
          }
        });
        if (mounted) setAllUsers(users);
        console.log(allUsers);
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
          getOptionLabel={(u) =>
            u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email : ''
          }
          // ensure we show *all* relevant info in the dropdown
          renderOption={(props, u) => {
            const name =
              `${u.firstName ?? ''} ${u.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
            const initials =
              (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
            return (
              <li {...props} key={u.uid}>
                <ListItemAvatar>
                  <Avatar>{initials || (u.email?.[0]?.toUpperCase() ?? '?')}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    name ? `${name}${u.pronouns ? ` (${u.pronouns})` : ''}` : u.email
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'block' }}>
                      <Box component="span" sx={{ fontFamily: 'monospace' }}>
                        {u.email}
                      </Box>
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
              // Chrome speech input; other browsers ignore it harmlessly
              inputProps={{
                ...params.inputProps,
                'x-webkit-speech': 'x-webkit-speech',
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
