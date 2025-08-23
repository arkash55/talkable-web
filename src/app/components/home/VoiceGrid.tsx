// src/app/components/home/VoiceGrid.tsx
'use client';

import { Box, Typography, Button, Stack } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';

interface VoiceGridBlock {
  label: string;
  onClick: () => void;
}

type VoiceGridType = 'homePage' | 'chatPage';

interface VoiceGridProps {
  blocks: VoiceGridBlock[];
  disabled?: boolean;
  activeIndex?: number | null;
  type?: VoiceGridType;

  /** NEW: when false, show the "Listen for more" empty state */
  activeConversation: boolean;
}

type Pos = { col: number; row: number; colSpan: number; rowSpan: number };

function layoutForCount(n: number): Pos[] {
  const original: Pos[] = [
    { col: 1, row: 1, colSpan: 4, rowSpan: 4 },
    { col: 5, row: 1, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 3, colSpan: 2, rowSpan: 2 },
    { col: 1, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 3, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 5, colSpan: 2, rowSpan: 2 },
  ];

  switch (n) {
    case 2:
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 6 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 6 },
      ];
    case 3:
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 4 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 4 },
        { col: 1, row: 5, colSpan: 6, rowSpan: 2 },
      ];
    case 4:
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 4 },
        { col: 1, row: 5, colSpan: 3, rowSpan: 2 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 3 },
        { col: 4, row: 4, colSpan: 3, rowSpan: 3 },
      ];
    case 5:
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
  type = 'homePage',
  activeConversation,
}: VoiceGridProps) {
  // Empty state if no active conversation
  if (!activeConversation) {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          onClick={() => {
            // Optional: emit a request to start listening on home page
            const evtName = type === 'homePage' ? 'home:stt:requestStart' : 'chat:stt:requestStart';
            window.dispatchEvent(new CustomEvent(evtName));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const evtName = type === 'homePage' ? 'home:stt:requestStart' : 'chat:stt:requestStart';
              window.dispatchEvent(new CustomEvent(evtName));
            }
          }}
          sx={(theme) => ({
            maxWidth: 560,
            width: '100%',
            border: `2px dashed ${theme.palette.divider}`,
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease, transform 0.15s ease',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              transform: 'translateY(-1px)',
            },
            outline: 'none',
          })}
        >
          <Stack spacing={1.25} alignItems="center">
            <GraphicEqIcon sx={{ fontSize: 56, opacity: 0.8 }} />
            <Typography variant="h6" fontWeight={700}>
              Start A Conversation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start speaking or click to begin listening and we’ll surface options here.
            </Typography>
          </Stack>
        </Box>
      </Box>
    );
  }

  // Normal grid
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
        const dimmed = disabled && !isActive;
        const isLarge = pos.colSpan * pos.rowSpan >= 12;

        return (
          <Box
            key={index}
            onClick={
              !disabled
                ? () => {
                    block.onClick();
                    const evtName =
                      type === 'homePage' ? 'ui:voicegrid:click' : 'chat:ui:voicegrid:click';
                    window.dispatchEvent(
                      new CustomEvent(evtName, { detail: { index, label: block.label } })
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
              transition: 'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isActive
                ? '0 0 0 3px rgba(255,255,255,0.6) inset, 0 8px 24px rgba(0,0,0,0.2)'
                : 'none',
              outline: isActive ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: isActive ? '-3px' : 0,
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
