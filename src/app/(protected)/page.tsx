import { Typography } from '@mui/material';

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <Typography variant="h3">Inter + Roboto Font Test</Typography>
      <p>This paragraph should render with Inter. If Inter is not available, it falls back to Roboto.</p>
    </main>
  );
}
