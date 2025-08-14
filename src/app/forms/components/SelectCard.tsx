import { Paper, Box, Typography, IconButton } from '@mui/material';
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
        '&:hover': { boxShadow: 6 },
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