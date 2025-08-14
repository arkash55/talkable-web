// src/app/components/home/VoiceGrid.tsx
'use client';

import { Box, Typography } from '@mui/material';

interface VoiceGridBlock {
  label: string;
  onClick: () => void;
}

interface VoiceGridProps {
  blocks: VoiceGridBlock[];     // supports length 2–6
  disabled?: boolean;           // disable all clicks while TTS plays
  activeIndex?: number | null;  // keep selected cell highlighted
}

type Pos = { col: number; row: number; colSpan: number; rowSpan: number };

function layoutForCount(n: number): Pos[] {
  // Default (your original 6-tile layout)
  const original: Pos[] = [
    // Priority 1 (big top-left block)
    { col: 1, row: 1, colSpan: 4, rowSpan: 4 },
    // Priority 2–6 (smaller blocks)
    { col: 5, row: 1, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 3, colSpan: 2, rowSpan: 2 },
    { col: 1, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 3, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 5, colSpan: 2, rowSpan: 2 },
  ];

  switch (n) {
    case 2:
      // Two 3x6 columns (50/50)
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 6 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 6 },
      ];
    case 3:
      // Two 3x4 on top, one 2x6 full-width bottom
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 4 }, // top-left
        { col: 4, row: 1, colSpan: 3, rowSpan: 4 }, // top-right
        { col: 1, row: 5, colSpan: 6, rowSpan: 2 }, // bottom 2x6
      ];
    case 4:
      // Left: 3x4 then 3x2 under it; Right: two 3x3 stacked
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 4 }, // left tall
        { col: 1, row: 5, colSpan: 3, rowSpan: 2 }, // left short
        { col: 4, row: 1, colSpan: 3, rowSpan: 3 }, // right top
        { col: 4, row: 4, colSpan: 3, rowSpan: 3 }, // right bottom
      ];
    case 5:
      // Not specified — use original, first 5
      return original.slice(0, 5);
    case 6:
    default:
      return original;
  }
}

export default function VoiceGrid({
  blocks,
  disabled = false,
  activeIndex = null,
}: VoiceGridProps) {
  console.log('VoiceGrid blocks:', blocks);
  const count = Math.max(0, Math.min(blocks.length, 6));
  const positions = layoutForCount(count);

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
      {blocks.slice(0, count).map((block, index) => {
        const pos = positions[index];
        const isActive = activeIndex === index;

        // When disabled: dim all non-active cells; keep active full opacity
        const dimmed = disabled && !isActive;

        // Make big tiles use larger typography (area ≥ 12 cells)
        const isLarge = pos.colSpan * pos.rowSpan >= 12;

        return (
          <Box
            key={index}
            onClick={
              !disabled
                ? () => {
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
              backgroundColor: index === 0 ? 'primary.main' : 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white',
              userSelect: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: dimmed ? 0.5 : 1,
              transition:
                'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isActive
                ? '0 0 0 3px rgba(255,255,255,0.6) inset, 0 8px 24px rgba(0,0,0,0.2)'
                : 'none',
              outline: isActive ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: isActive ? '-3px' : 0,
              // Optional: keep labels readable when tiles get small
              p: 1,
              textAlign: 'center',
            }}
          >
            <Typography
              variant={isLarge ? 'h4' : 'h6'}
              sx={{
                color: index === 0 ? 'primary.contrastText' : 'secondary.contrastText',
                px: 2,
                textAlign: 'center',
                wordBreak: 'break-word',
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
