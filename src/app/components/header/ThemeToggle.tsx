'use client';

import { useState } from 'react';
import { IconButton } from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/system';
import { useThemeMode } from '@/app/context/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();

  
  const iconSize = 36;                 
  const buttonSize = 56;              

  const [clicked, setClicked] = useState(false);

  const bg = theme.palette.mode === 'light'
    ? alpha(theme.palette.grey[200], 0.9)
    : alpha('#ffffff', 0.08);

  const bgHover = theme.palette.mode === 'light'
    ? alpha(theme.palette.grey[300], 1)
    : alpha('#ffffff', 0.12);

  return (
    <IconButton
      onClick={() => {
        setClicked(true);
        toggleMode();
        setTimeout(() => setClicked(false), 250);
      }}
      disableRipple={false}
      sx={{
        position: 'relative',
        width: buttonSize,
        height: buttonSize,
        borderRadius: '50%',
        backgroundColor: bg,
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        boxShadow:
          theme.palette.mode === 'light'
            ? '0 4px 14px rgba(0,0,0,0.08)'
            : '0 4px 14px rgba(0,0,0,0.35)',
        color: theme.palette.text.primary,
        transition: 'background-color 180ms ease, box-shadow 180ms ease',
        
        '&:hover': {
          backgroundColor: bgHover,
          boxShadow:
            theme.palette.mode === 'light'
              ? '0 8px 22px rgba(0,0,0,0.12)'
              : '0 8px 22px rgba(0,0,0,0.5)',
        },
        
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: clicked
            ? `0 0 0 8px ${alpha(theme.palette.primary.main, 0.2)}`
            : '0 0 0 0 rgba(0,0,0,0)',
          opacity: clicked ? 1 : 0,
          transition: 'box-shadow 250ms ease, opacity 250ms ease',
          pointerEvents: 'none',
        },
      }}
    >
      {mode === 'light'
        ? <DarkModeRoundedIcon sx={{ fontSize: iconSize }} />
        : <WbSunnyRoundedIcon sx={{ fontSize: iconSize }} />}
    </IconButton>
  );
}
