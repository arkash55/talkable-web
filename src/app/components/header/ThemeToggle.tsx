'use client';


import { IconButton } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '@/app/context/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();

  return (
    <IconButton
      onClick={toggleMode}
      sx={{
        color: theme.palette.text.primary,
        transition: 'color 0.3s ease',
        fontSize: 28,
      }}
    >
      {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
}
