'use client';

import * as React from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
  Grid,
} from '@mui/material';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { updateUser, type UserProfile } from '@/services/firestoreService';
import { db } from '../../../../../../lib/fireBaseConfig';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';


type AboutProfile = Pick<UserProfile, 'firstName' | 'lastName' | 'description'>;

const EMPTY: AboutProfile = {
  firstName: '',
  lastName: '',
  description: '',
};

function diffAbout(before: AboutProfile, after: AboutProfile): Partial<AboutProfile> {
  const out: Partial<AboutProfile> = {};
  (Object.keys(EMPTY) as (keyof AboutProfile)[]).forEach((k) => {
    if ((before[k] ?? '') !== (after[k] ?? '')) out[k] = after[k];
  });
  return out;
}

const INPUT_SX = {
  '& .MuiInputBase-input': {
    fontSize: { xs: '1rem', md: '1.05rem' },
    py: 2,
  },
  '& .MuiInputLabel-root': {
    fontSize: { xs: '0.95rem', md: '1rem' },
  },
};

const READONLY_INPUT_SX = {
  ...INPUT_SX,
  '& .MuiInputBase-root': {
    backgroundColor: (theme: any) => theme.palette.action.hover,
    '&.Mui-disabled': {
      backgroundColor: (theme: any) => theme.palette.action.disabledBackground,
    },
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: (theme: any) => theme.palette.text.secondary,
    opacity: 1,
  },
  '& .MuiInputLabel-root.Mui-disabled': {
    color: (theme: any) => theme.palette.text.secondary,
  },
};

export default function AboutPage() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string>(''); 
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [initial, setInitial] = React.useState<AboutProfile>(EMPTY);
  const [form, setForm] = React.useState<AboutProfile>(EMPTY);

  const [banner, setBanner] = React.useState<{
    open: boolean;
    msg: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  
  React.useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setEmail('');
        setLoading(false);
        setInitial(EMPTY);
        setForm(EMPTY);
        setBanner({ open: true, msg: 'You must be signed in to edit About me.', severity: 'error' });
        return;
      }
      setUid(user.uid);
      setEmail(user.email || '');
      setLoading(true);

      const ref = doc(db, 'users', user.uid);
      const unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const data = (snap.exists() ? (snap.data() as UserProfile) : undefined);
          const base: AboutProfile = {
            firstName: data?.firstName ?? '',
            lastName: data?.lastName ?? '',
            description: data?.description ?? '',
          };
          setInitial(base);
          setForm(base);
          setLoading(false);
        },
        (err) => {
          console.error('About doc subscribe error', err);
          setLoading(false);
          setBanner({ open: true, msg: 'Failed to load your profile.', severity: 'error' });
        }
      );

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  const isDirty = React.useMemo(() => Object.keys(diffAbout(initial, form)).length > 0, [initial, form]);

  const onChange =
    (key: keyof AboutProfile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
    };

  const handleReset = () => setForm(initial);

  const handleSave = async () => {
    if (!uid) return;
    const changes = diffAbout(initial, form);
    if (Object.keys(changes).length === 0) return;

    try {
      setSaving(true);
      await updateUser(uid, changes); 
      setInitial((prev) => ({ ...prev, ...changes }));
      setBanner({ open: true, msg: 'About me updated.', severity: 'success' });
    } catch (e: any) {
      console.error('updateUser failed', e);
      setBanner({ open: true, msg: e?.message || 'Update failed.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    // OUTER SCROLL CONTAINER
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',          // fill viewport
        overflow: 'hidden',           // prevent double scroll on root
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',          // enable vertical scrolling
          WebkitOverflowScrolling: 'touch',
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          mx: 'auto',
          width: '100%',
          maxWidth: 1200,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            width: '100%',
            mb: 4,
          }}
        >
          {loading ? (
            <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={4}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  My Details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View & Update your basic information.
                </Typography>
              </Box>

              {}
              <Stack spacing={3}>
                {}
                <Box sx={{ display: 'flex', gap: 4, width: '100%' }}>
                  <TextField
                    label="First name"
                    fullWidth
                    value={form.firstName}
                    onChange={onChange('firstName')}
                    autoComplete="given-name"
                    sx={INPUT_SX}
                  />
                  <TextField
                    label="Last name"
                    fullWidth
                    value={form.lastName}
                    onChange={onChange('lastName')}
                    autoComplete="family-name"
                    sx={INPUT_SX}
                  />
                </Box>

                {}
                <TextField
                  label="Email (cannot be changed)"
                  fullWidth
                  value={email}
                  disabled
                  InputProps={{ readOnly: true, sx: { cursor: 'not-allowed' } }}
                  autoComplete="email"
                  helperText="Contact support to change your email address"
                  sx={READONLY_INPUT_SX}
                />

                {}
                <TextField
                  label="Self description"
                  placeholder="Tell us about yourself..."
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={12}
                  value={form.description}
                  onChange={onChange('description')}
                  sx={INPUT_SX}
                />
              </Stack>

              <Divider />

              {}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleReset}
                  disabled={!isDirty || saving}
                  size="large"
                  sx={BIG_BUTTON_SX}
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  size="large"
                  sx={BIG_BUTTON_SX}
                >
                  {saving ? <CircularProgress size={22} /> : 'Save changes'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>

        <Snackbar
          open={banner.open}
          autoHideDuration={2600}
          onClose={() => setBanner((b) => ({ ...b, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{
            mb: { xs: 2, sm: 3 },
            '& .MuiAlert-root': {
              width: { xs: 'calc(100vw - 32px)', sm: 560, md: 640 },
              maxWidth: '100%',
            },
          }}
        >
          <Alert
            onClose={() => setBanner((b) => ({ ...b, open: false }))}
            severity={banner.severity}
            sx={{ width: '100%' }}
          >
            {banner.msg}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
