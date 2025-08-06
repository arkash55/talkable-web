'use client';

import { Box, Typography } from '@mui/material';

interface VoiceGridProps {
  topLeft: {
    label: string;
    onClick: () => void;
  };
  blocks: {
    label: string;
    onClick: () => void;
  }[];
}

export default function VoiceGrid({ topLeft, blocks }: VoiceGridProps) {
  // Predefined positions for 5 smaller blocks (high to low priority)
  const positions = [
    { col: 5, row: 1 }, // highest
    { col: 5, row: 3 },
    { col: 5, row: 5 },
    { col: 3, row: 5 },
    { col: 1, row: 5 }, // lowest
  ];

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: 0,
      }}
    >
      {/* Top Left 4x4 response */}
      <Box
        sx={{
          gridColumn: '1 / span 4',
          gridRow: '1 / span 4',
          backgroundColor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1px solid white',
        }}
        onClick={topLeft.onClick}
      >
        <Typography
          variant="h4"
          sx={{ color: 'primary.contrastText', p: 2, textAlign: 'center' }}
        >
          {topLeft.label}
        </Typography>
      </Box>

      {/* Smaller 2x2 blocks */}
      {blocks.slice(0, 5).map((block, index) => {
        const pos = positions[index];
        return (
          <Box
            key={index}
            sx={{
              gridColumn: `${pos.col} / span 2`,
              gridRow: `${pos.row} / span 2`,
              backgroundColor: 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid white',
            }}
            onClick={block.onClick}
          >
            <Typography
              variant="h6"
              sx={{ color: 'secondary.contrastText', p: 2, textAlign: 'center' }}
            >
              {block.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
