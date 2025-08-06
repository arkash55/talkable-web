'use client';

import { Box, Typography } from '@mui/material';

interface VoiceGridBlock {
  label: string;
  onClick: () => void;
}

interface VoiceGridProps {
  blocks: VoiceGridBlock[]; // length = 6
}

export default function VoiceGrid({ blocks }: VoiceGridProps) {
  const positions = [
    // Priority 1 (big top-left block)
    { col: 1, row: 1, colSpan: 4, rowSpan: 4 },
    // Priority 2–6 (smaller blocks)
    { col: 5, row: 1, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 3, colSpan: 2, rowSpan: 2 },
    { col: 1, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 3, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 5, colSpan: 2, rowSpan: 2 },
  ];

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: 0,
      }}
    >
      {blocks.slice(0, 6).map((block, index) => {
        const pos = positions[index];
        const isPriority1 = index === 0;

        return (
          <Box
            key={index}
            sx={{
              gridColumn: `${pos.col} / span ${pos.colSpan}`,
              gridRow: `${pos.row} / span ${pos.rowSpan}`,
              backgroundColor: isPriority1 ? 'primary.main' : 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid white',
            }}
            onClick={block.onClick}
          >
            <Typography
              variant={isPriority1 ? 'h4' : 'h6'}
              sx={{
                color: isPriority1 ? 'primary.contrastText' : 'secondary.contrastText',
                p: 2,
                textAlign: 'center',
              }}
            >
              {block.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
