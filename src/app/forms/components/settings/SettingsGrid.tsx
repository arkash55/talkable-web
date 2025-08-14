'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Typography,
  useTheme,
} from '@mui/material';

import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import PolicyIcon from '@mui/icons-material/Policy';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import MicIcon from '@mui/icons-material/Mic';

export type SettingsKey =
  | 'about-me'
  | 'tone-voice'
  | 'terms'
  | 'privacy'
  | 'delete'
  | 'logout'

export type SettingsGridProps = {
  /** Called when a card is clicked */
  onSelect?: (key: SettingsKey) => void;
  cardHeight?: number;
  gap?: number;
  radius?: number;
  columns?: number;
  elevation?: number;
  hoverElevation?: number;
};

const DEFAULT_ITEMS: { key: SettingsKey; title: string; Icon: React.ElementType }[] = [
  { key: 'about-me',   title: 'About me',         Icon: PersonIcon },
  { key: 'tone-voice', title: 'Voice & Tone',    Icon: MicIcon },
  { key: 'terms',   title: 'Terms of service', Icon: ArticleIcon },
  { key: 'privacy', title: 'Privacy notice',   Icon: PolicyIcon },
  { key: 'delete',  title: 'Delete user',      Icon: DeleteForeverIcon },
  { key: 'logout',  title: 'Log out',          Icon: LogoutIcon },
];

export default function SettingsGrid({
  onSelect,
  cardHeight = 120,
  gap = 2.5,
  radius = 16,
  columns = 3,
  elevation = 10,
  hoverElevation = 8,
}: SettingsGridProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {DEFAULT_ITEMS.map(({ key, title, Icon }) => (
        <Card
          key={key}
          elevation={elevation}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: radius,
            border: '1px solid',
            borderColor: 'divider',
            transition: 'box-shadow 180ms ease, transform 140ms ease, opacity 140ms ease',
            bgcolor: 'background.paper',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(120deg, rgba(33,150,243,0) 0%, rgba(33,150,243,0.12) 40%, rgba(33,150,243,0.40) 50%, rgba(33,150,243,0.12) 60%, rgba(33,150,243,0) 100%)',
              transform: 'translateX(-130%)',
              opacity: 0,
              pointerEvents: 'none',
            },
            '&:hover': {
              // borderColor removed to keep original divider color
              boxShadow: theme.shadows[hoverElevation],
              transform: 'translateY(-2px)',
            },
            '&:hover::before': {
              opacity: 1,
              animation: 'waveSlide 1.25s ease-out forwards',
            },
            '@keyframes waveSlide': {
              '0%':   { transform: 'translateX(-130%)' },
              '60%':  { transform: 'translateX(10%)' },
              '100%': { transform: 'translateX(130%)', opacity: 0 },
            },
          }}
        >
          <CardActionArea
            onClick={() => onSelect?.(key)}
            sx={{
              height: cardHeight,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1.75,
              position: 'relative',
              // Make the ripple (outward burst) the same blue as the wave
              '& .MuiTouchRipple-root .MuiTouchRipple-child': {
                backgroundColor: 'primary.main',
              },
              // (Optional) soften ripple opacity
              '& .MuiTouchRipple-rippleVisible': {
                opacity: 0.35,
              },
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',             // circular shape
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: theme => `2px solid ${theme.palette.primary.light}`, // circular border
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 3px 10px rgba(0,0,0,0.45)'
                    : '0 3px 10px rgba(0,0,0,0.25)',
                flexShrink: 0,
                transition: 'background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                '&:hover': {
                  transform: 'scale(1.04)',
                },
              }}
            >
              <Icon fontSize="medium" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                {title}
              </Typography>
            </Box>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
