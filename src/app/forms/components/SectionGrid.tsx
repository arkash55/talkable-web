import { Box } from '@mui/material';
import { GRID_GAP } from '../constants/voiceToneOptions';
import React from 'react';

export function SectionGrid({
  children,
  minColWidth,
  gap = GRID_GAP,
}: {
  children: React.ReactNode;
  minColWidth: number;
  gap?: number;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        justifyContent: 'center',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
        },
        gap,
        alignItems: 'stretch',
      }}
    >
      {children}
    </Box>
  );
}