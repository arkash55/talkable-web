'use client';

import * as React from 'react';
import { Typography, useTheme, styled } from '@mui/material';

type TripleValue = 'left' | 'center' | 'right';

type TripleToggleProps = {
  labels: { left: string; center: string; right: string };
  value: TripleValue;
  onChange: (v: TripleValue) => void;
  height?: number;   // default 56
  minWidth?: number; // default 260
};

const Wrap = styled('div')<{ h: number; mw: number }>(({ theme, h, mw }) => ({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  alignItems: 'center',
  borderRadius: h / 2,
  height: h,
  minWidth: mw,
  padding: 4,
  userSelect: 'none',
  cursor: 'pointer',
  background:
    theme.palette.mode === 'light'
      ? theme.palette.grey[200]
      : theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}));

const Slider = styled('div')<{ index: 0 | 1 | 2; h: number }>(
  ({ theme, index, h }) => ({
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: `calc((100% - 8px) / 3)`,
    left:
      index === 0
        ? 4
        : index === 1
        ? `calc(4px + (100% - 8px) / 3)`
        : `calc(4px + 2 * ((100% - 8px) / 3))`,
    borderRadius: h / 2 - 4,
    transition: 'left 220ms ease, box-shadow 220ms ease, background 220ms ease',
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%)`,
    color: theme.palette.primary.contrastText,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  })
);

const Cell = styled('button')<{ active?: boolean; h: number }>(
  ({ theme, active, h }) => ({
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    height: h - 8,
    borderRadius: (h - 8) / 2,
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    color: active
      ? theme.palette.primary.contrastText
      : theme.palette.text.secondary,
    fontWeight: active ? 700 : 600,
    fontSize: 15,
    letterSpacing: 0.3,
    cursor: 'pointer',
    '&:hover': {
      transform: active ? 'none' : 'translateY(-1px)',
    },
  })
);

export default function TripleToggle({
  labels,
  value,
  onChange,
  height = 56,
  minWidth = 260,
}: TripleToggleProps) {
  const currentIndex: 0 | 1 | 2 =
    value === 'left' ? 0 : value === 'center' ? 1 : 2;

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(currentIndex === 0 ? 'left' : currentIndex === 1 ? 'left' : 'center');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(currentIndex === 2 ? 'right' : currentIndex === 1 ? 'right' : 'center');
    }
  };

  return (
    <Wrap
      h={height}
      mw={minWidth}
      role="tablist"
      aria-label="Conversation filter"
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <Slider index={currentIndex} h={height} />

      <Cell
        h={height}
        active={currentIndex === 0}
        role="tab"
        aria-selected={currentIndex === 0}
        onClick={() => onChange('left')}
      >
        <Typography variant="body2" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
          {labels.left}
        </Typography>
      </Cell>

      <Cell
        h={height}
        active={currentIndex === 1}
        role="tab"
        aria-selected={currentIndex === 1}
        onClick={() => onChange('center')}
      >
        <Typography variant="body2" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
          {labels.center}
        </Typography>
      </Cell>

      <Cell
        h={height}
        active={currentIndex === 2}
        role="tab"
        aria-selected={currentIndex === 2}
        onClick={() => onChange('right')}
      >
        <Typography variant="body2" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
          {labels.right}
        </Typography>
      </Cell>
    </Wrap>
  );
}
