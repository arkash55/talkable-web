'use client';

import * as React from 'react';
import Link from 'next/link';
import { AppBar, Toolbar, IconButton, Typography, Box, Container, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSelectedLayoutSegments } from 'next/navigation';

const TITLE_MAP: Record<string, string> = {
  'profile': 'Profile',
  'tone-voice': 'Voice & Tone',
  'privacy': 'Privacy',
  'terms': 'Terms of Service',
  'delete': 'Delete Account',
  'logout': 'Log Out',
  'about-me': 'About Me',
};

// Adjustable sizes
const BACK_ICON_SIZE = 80;            // change this to resize icon
const TITLE_FONT_RATIO = 0.38;        // fraction of icon size for title
const TITLE_FONT_SIZE = Math.round(BACK_ICON_SIZE * TITLE_FONT_RATIO);

function CurrentTitle() {
  const segments = useSelectedLayoutSegments();
  const last = segments[segments.length - 1];
  const title = (last && TITLE_MAP[last]) || 'Settings';
  return (
    <Typography
      component="h1"
      sx={{
        fontWeight: 700,
        ml: 1,
        lineHeight: 1,
        letterSpacing: 0.2,
        fontSize: {
          xs: `${Math.max(20, TITLE_FONT_SIZE - 8)}px`,
          sm: `${TITLE_FONT_SIZE}px`,
        },
      }}
    >
      {title}
    </Typography>
  );
}

function SettingsTabsNavBar() {
  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{
        borderBottom: theme => `1px solid ${theme.palette.divider}`,
        backgroundImage: 'none',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Toolbar
        variant="regular"
        sx={{
          minHeight: Math.max(64, BACK_ICON_SIZE + 24),
          alignItems: 'center',
        }}
      >
        <IconButton
          edge="start"
          component={Link}
          href="/settings"
          aria-label="Back to settings"
          sx={{
            color: 'text.primary',
            mr: 0.5,
            width: BACK_ICON_SIZE + 16,
            height: BACK_ICON_SIZE + 16,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: BACK_ICON_SIZE }} />
        </IconButton>
        <CurrentTitle />
        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
}

export default function SettingsTabsLayout({ children }: {
   children: React.ReactNode
   params: any
   }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh'}}>
      <SettingsTabsNavBar />
      <Container
        maxWidth={false}
        sx={{ width: '100%',
          flex: 1,
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3, }}
      >
        {children}
      </Container>
      <Divider sx={{ mt: 'auto' }} />
    </Box>
  );
}