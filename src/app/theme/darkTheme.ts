import { createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9', 
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ce93d8', 
      light: '#f3e5f5',
      dark: '#ab47bc',
      contrastText: '#000000',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      disabled: '#777777',
    },
    divider: '#333333',
    success: {
      main: '#66bb6a',
    },
    error: {
      main: '#ef5350',
    },
    warning: {
      main: '#ffa726',
    },
    info: {
      main: '#29b6f6',
    },
    grey: {
      100: '#2a2a2a',
      300: '#444444',
      500: '#666666',
      700: '#888888',
      900: '#aaaaaa',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});
export default darkTheme;
