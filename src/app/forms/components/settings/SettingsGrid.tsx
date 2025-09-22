
'use client';

import * as React from 'react';
import {
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useRouter } from 'next/navigation';
import SettingsTile from './SettingsGridTiles';
import { logoutUser } from '@/services/firestoreService'; 
import { deleteAccount, reauthWithPassword } from '@/services/authService'; 
import { User, Volume2, ShieldCheck, Info, LogOut, Trash2 } from 'lucide-react';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';

type Item = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string; 
  'data-testid'?: string;
  danger?: boolean;
};

const ITEMS: Item[] = [
  { key: 'account',          title: 'Account',         subtitle: 'Profile & security',     icon: <User size={22} />,        href: '/settings/profile' },
  { key: 'audio',            title: 'Voice & Tone',    subtitle: 'TTS settings',           icon: <Volume2 size={22} />,     href: '/settings/tone-voice' },
  { key: 'change-password',  title: 'Change Password', subtitle: 'Create a new password',  icon: <ShieldCheck size={22} />, href: '/settings/change-password' },
  { key: 'about-privacy',    title: 'About', subtitle: 'Version & credits',      icon: <Info size={22} />,        href: '/settings/about' },
  { key: 'delete',           title: 'Delete Account',  subtitle: 'Permanently remove your data', icon: <Trash2 size={22} />, danger: true, href: '/settings/delete' },
  { key: 'logout',           title: 'Log Out',         subtitle: 'End your session safely',     icon: <LogOut size={22} />,   danger: true, href: '/logout' },
];

type Props = {
  onOpenSection?: (key: string) => void;
  selectedKey?: string;
  spacing?: number;
  cols?: { xs?: number; sm?: number; md?: number };
};

export default function SettingsGrid({
  onOpenSection,
  selectedKey,
  spacing = 2,
  cols = { xs: 12, sm: 6, md: 4 },
}: Props) {
  const router = useRouter();

  
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<null | 'logout' | 'delete'>(null);
  const [working, setWorking] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  
  const [needReauth, setNeedReauth] = React.useState(false);
  const [reauthPwd, setReauthPwd] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);

  
  const [tbdOpen, setTbdOpen] = React.useState(false);

  const openConfirm = (action: 'logout' | 'delete') => {
    setConfirmAction(action);
    setDialogError(null);
    setNeedReauth(false);
    setReauthPwd('');
    setShowPwd(false);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (working) return; 
    setConfirmOpen(false);
  };

  const handleDialogExited = () => {
  setConfirmAction(null);
  setDialogError(null);
  setNeedReauth(false);
  setReauthPwd('');
  setShowPwd(false);
};

  const tryDelete = async () => {
    
    const res = await deleteAccount();
    if (!res.ok) {
      if (res.code === 'requires-recent-login') {
        setNeedReauth(true);
        setDialogError('For your security, please confirm your password to continue.');
        return false; 
      }
      setDialogError('Something went wrong. Please try again later.');
      return false;
    }
    return true;
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setWorking(true);
    setDialogError(null);

    try {
      if (confirmAction === 'logout') {
        await logoutUser();
        router.replace('/login');
        return;
      }

      
      if (needReauth) {
        if (!reauthPwd) {
          setDialogError('Please enter your password.');
          return;
        }
        const rr = await reauthWithPassword(reauthPwd);
        if (!rr.ok) {
          setDialogError(
            rr.code === 'wrong-old-password' ? 'Password is incorrect.' : 'Could not verify your session. Try again.'
          );
          return;
        }
      }

      const ok = await tryDelete();
      if (ok) {
        router.replace('/login');
      }
    } catch {
      setDialogError('Something went wrong. Please try again later.');
    } finally {
      setWorking(false);
    }
  };

  const handleClick = (item: Item) => async () => {
    onOpenSection?.(item.key);

    
    if (item.key === 'logout') {
      openConfirm('logout');
      return;
    }
    if (item.key === 'delete') {
      openConfirm('delete');
      return;
    }

    
    if (item.key === 'about-privacy') {
      setTbdOpen(true);
      return;
    }

    
    if (item.href) router.push(item.href);
  };

  const isDelete = confirmAction === 'delete';

  return (
    <>
      {}
      <Grid container spacing={spacing} display="flex" justifyContent="center">
        {ITEMS.map((item) => (
          <Grid item key={item.key} xs={cols.xs} sm={cols.sm} md={cols.md}>
            <SettingsTile
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              onClick={handleClick(item)}
              selected={selectedKey === item.key}
              data-testid={item['data-testid'] ?? `tile-${item.key}`}
            />
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={confirmOpen}
        onClose={closeConfirm}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        keepMounted
        TransitionProps={{ onExited: handleDialogExited }}
        PaperProps={{
          sx: {
            width: 480,
            borderRadius: 3,
            p: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
          },
        }}
      >
        <DialogTitle id="confirm-title" sx={{ pb: 1 }}>
          <Stack alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => (isDelete ? t.palette.error.main : t.palette.primary.main),
                color: (t) => t.palette.common.white, 
              }}
            >
              {isDelete ? <Trash2 size={28} /> : <LogOut size={28} />}
            </Box>

            <Typography variant="h6" align="center" sx={{ fontWeight: 700 }}>
              {isDelete ? 'Delete your account?' : 'Log out of your account?'}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent id="confirm-desc" dividers sx={{ borderTop: 'none', borderBottom: 'none' }}>
          <Typography align="center" color="text.secondary">
            {isDelete
              ? 'This will permanently delete your account and associated data.'
              : 'You will be signed out of your current session.'}
          </Typography>

          {dialogError && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'center' }} onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}

          {isDelete && needReauth && (
            <Stack sx={{ mt: 2 }}>
              <TextField
                label="Confirm your password"
                type={showPwd ? 'text' : 'password'}
                value={reauthPwd}
                onChange={(e) => setReauthPwd(e.target.value)}
                autoFocus
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPwd((s) => !s)} edge="end" aria-label="toggle password visibility">
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            width="100%"
          >
            <Button variant="outlined" sx={BIG_BUTTON_SX} onClick={closeConfirm} disabled={working}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              sx={BIG_BUTTON_SX}
              color={isDelete ? 'error' : 'primary'}
              disabled={working || (isDelete && needReauth && !reauthPwd)}
            >
              {working ? <CircularProgress size={22} /> : isDelete ? (needReauth ? 'Confirm & Delete' : 'Delete') : 'Log Out'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={tbdOpen}
        onClose={() => setTbdOpen(false)}
        aria-labelledby="tbd-title"
        PaperProps={{
          sx: {
            width: 380,
            borderRadius: 3,
            p: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
          },
        }}
      >
        <DialogTitle id="tbd-title" sx={{ fontWeight: 700, pb: 1 }}>
          About
        </DialogTitle>
        <DialogContent dividers sx={{ borderTop: 'none', borderBottom: 'none' }}>
          <Typography variant="body2" color="text.secondary">
            This section is TBD. Check back soon!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setTbdOpen(false)} sx={BIG_BUTTON_SX}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
