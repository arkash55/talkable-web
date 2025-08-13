// src/app/components/home/VoiceGrid.tsx
'use client';

import { Box, Typography } from '@mui/material';

interface VoiceGridBlock {
  label: string;
  onClick: () => void;
}

interface VoiceGridProps {
  blocks: VoiceGridBlock[];     // length = 6
  disabled?: boolean;           // disable all clicks while TTS plays
  activeIndex?: number | null;  // keep selected cell highlighted
}

export default function VoiceGrid({
  blocks,
  disabled = false,
  activeIndex = null,
}: VoiceGridProps) {
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
        const isActive = activeIndex === index;

        // When disabled: dim all non-active cells; keep active full opacity
        const dimmed = disabled && !isActive;

        return (
          <Box
            key={index}
            onClick={ !disabled ? () => {
              block.onClick();
              window.dispatchEvent(
                new CustomEvent('ui:voicegrid:click', {
                  detail: { index, label: block.label },
                })
              );
            }
          : undefined
}
            sx={{
              gridColumn: `${pos.col} / span ${pos.colSpan}`,
              gridRow: `${pos.row} / span ${pos.rowSpan}`,
              backgroundColor: isPriority1 ? 'primary.main' : 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white',
              userSelect: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: dimmed ? 0.5 : 1,
              transition: 'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
              // Highlight the selected cell during playback
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isActive ? '0 0 0 3px rgba(255,255,255,0.6) inset, 0 8px 24px rgba(0,0,0,0.2)' : 'none',
              outline: isActive ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: isActive ? '-3px' : 0,
            }}
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
