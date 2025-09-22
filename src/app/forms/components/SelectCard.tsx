import { Paper, Box, Typography, IconButton, useTheme } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React from 'react';
import { CARD_HEIGHT } from '../constants/voiceToneOptions';

export function SelectCard({
  selected,
  onClick,
  onPreview,
  title,
  subtitle,
  height = CARD_HEIGHT,
}: {
  selected: boolean;
  onClick: () => void;
  onPreview?: () => void;
  title: string;
  subtitle?: string;
  height?: { xs: number; sm: number; md: number };
}) {

  const theme = useTheme();
  return (
    <Paper
      onClick={onClick}
      elevation={selected ? 6 : 1}
      sx={{
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        border: (t) => `2px solid ${selected ? t.palette.primary.main : 'transparent'}`,
        height,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 0.5,
        transition: 'box-shadow .15s ease',
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
              
              boxShadow: theme.shadows[8],
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
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} fontSize={15} noWrap>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>
        {onPreview && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            aria-label={`Preview ${title}`}
          >
            <VolumeUpIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box
        sx={{
          height: 4,
            borderRadius: 10,
            bgcolor: selected ? 'primary.main' : 'action.hover',
            opacity: selected ? 1 : 0.6,
        }}
      />
    </Paper>
  );
}