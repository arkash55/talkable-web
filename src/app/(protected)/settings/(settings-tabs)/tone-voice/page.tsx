'use client';

import * as React from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Divider,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { updateUser, type UserProfile } from '@/services/firestoreService';
import { db } from '../../../../../../lib/fireBaseConfig';
import VoiceTonePicker from '@/app/components/shared/VoiceTonerPicker';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';



type FormState = Pick<UserProfile, 'tone' | 'voice' | 'firstName'>;

const EMPTY: FormState = { tone: '', voice: '', firstName: '' };

function diff(before: FormState, after: FormState): Partial<FormState> {
  const out: Partial<FormState> = {};
  (['tone', 'voice'] as const).forEach((k) => {
    if ((before[k] ?? '') !== (after[k] ?? '')) out[k] = after[k];
  });
  return out;
}

const VoiceTonePage = () => {
  const [uid, setUid] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [initial, setInitial] = React.useState<FormState>(EMPTY);
  const [form, setForm] = React.useState<FormState>(EMPTY);

  const [banner, setBanner] = React.useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  // Auth + live user profile subscribe
  React.useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setLoading(false);
        setInitial(EMPTY);
        setForm(EMPTY);
        setBanner({ open: true, msg: 'You must be signed in to edit Voice & Tone.', severity: 'error' });
        return;
      }
      setUid(user.uid);
      setLoading(true);

      const ref = doc(db, 'users', user.uid);
      const unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const data = snap.exists() ? (snap.data() as UserProfile) : undefined;
          const base: FormState = {
            tone: data?.tone ?? '',
            voice: data?.voice ?? '',
            firstName: data?.firstName ?? '',
          };
          setInitial(base);
          setForm(base);
          setLoading(false);
        },
        (err) => {
          console.error('VoiceTone subscribe error', err);
          setLoading(false);
          setBanner({ open: true, msg: 'Failed to load your preferences.', severity: 'error' });
        }
      );

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  const isDirty = React.useMemo(() => Object.keys(diff(initial, form)).length > 0, [initial, form]);
  const canSave = !!form.tone && !!form.voice && isDirty && !!uid;

  const handleSave = async () => {
    if (!uid) return;
    const changes = diff(initial, form);
    if (!Object.keys(changes).length) return;

    try {
      setSaving(true);
      await updateUser(uid, changes); // persists { tone, voice }
      setInitial((prev) => ({ ...prev, ...changes }));
      setBanner({ open: true, msg: 'Voice & tone updated.', severity: 'success' });
    } catch (e: any) {
      console.error('updateUser failed', e);
      setBanner({ open: true, msg: e?.message || 'Update failed.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setForm(initial);

  return (
    <Box sx={{minWidth: '80%', px: { xs: 2, md: 3 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        {loading ? (
          <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Voice & Tone
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose your default speaking voice and preferred tone.
              </Typography>
            </Box>
        
            <VoiceTonePicker
              tone={form.tone}
              voice={form.voice}
              onToneChange={(t: any) => setForm((f) => ({ ...f, tone: t }))}
              onVoiceChange={(v: any) => setForm((f) => ({ ...f, voice: v }))}
              name={form.firstName}
              disabled={!uid}
              toneError={!form.tone ? 'Select a tone' : undefined}
              voiceError={!form.voice ? 'Select a voice' : undefined}
              voiceCols={3}
              voiceRows={2}
              toneCols={4}
              toneRows={2}
            />

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'flex-end',  }}>
              <Button variant="outlined" color="inherit" onClick={handleReset} disabled={!isDirty || saving} sx={BIG_BUTTON_SX}>
                Reset
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={!canSave || saving}  sx={BIG_BUTTON_SX}>
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
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
  );
};

export default VoiceTonePage;
