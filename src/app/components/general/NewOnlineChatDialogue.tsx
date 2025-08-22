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
import SearchIcon from '@mui/icons-material/Search';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

// If you created listUsers in your firestore service (recommended)
import { getUsers, type UserDirectoryEntry } from '@/services/firestoreService';
// If you used a different name earlier (e.g., getUsers), you can import that instead.
// import { getUsers as listUsers } from '@/services/firestoreService';

import { createOnlineConversation } from '@/services/firestoreService';

type Props = {
  open: boolean;
  onClose: () => void;
};

type UserRecord = UserDirectoryEntry & {
  // ensure optional fields exist for rendering
  email?: string;
  firstName?: string;
  lastName?: string;
  pronouns?: string;
  description?: string;
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
  const currentUid = getAuth().currentUser?.uid ?? null;

  const [loading, setLoading] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState<UserRecord[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  // Load users when modal opens
  React.useEffect(() => {
    if (!open) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await getUsers({
          excludeUid: currentUid ?? undefined,
          limit: 500,
        });
        if (!canceled) setAllUsers(rows as UserRecord[]);
      } catch (e) {
        console.error('Failed to load users:', e);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open, currentUid]);

  // Only open dropdown when there is text
  React.useEffect(() => {
    const hasText = inputValue.trim().length > 0;
    setDropdownOpen(hasText);
  }, [inputValue]);

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
          isOptionEqualToValue={(a, b) => a.uid === b.uid}
          getOptionLabel={(u) =>
            (u
              ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
              : '') || u.email || ''
          }
          // 🔒 Control opening: only when typing
          open={dropdownOpen}
          onOpen={() => {
            // Block open-on-focus / icon if no text
            if (inputValue.trim().length === 0) {
              setDropdownOpen(false);
            }
          }}
          onClose={() => setDropdownOpen(false)}
          openOnFocus={false}
          forcePopupIcon // keep an icon on the right
          popupIcon={<SearchIcon />} // 🔄 replace chevron with search icon
          renderOption={(props, u) => {
            const name =
              `${u.firstName ?? ''} ${u.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
            const initials =
              (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
            // Do NOT add your own key; props contains a key
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
