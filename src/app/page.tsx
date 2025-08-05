
import { Typography } from '@mui/material';
import ThemeToggle from './components/header/ThemeToggle';

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <ThemeToggle />
      <Typography variant="h4">Hello, MUI Theming!</Typography>
      <Typography>
        Toggle the theme using the icon above.
      </Typography>
    </main>
  );
}
