import { createTheme } from '@mui/material/styles';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2', // Blue
      light: '#63a4ff',
      dark: '#004ba0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0', // Purple
      light: '#d05ce3',
      dark: '#6a0080',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#444444',
      disabled: '#888888',
    },
    divider: '#e0e0e0',
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    grey: {
      100: '#f5f5f5',
      300: '#e0e0e0',
      500: '#9e9e9e',
      700: '#616161',
      900: '#212121',
    },
  },
  typography: {
    fontFamily: 'var(--font-family)',
  },
  
});
export default lightTheme;
