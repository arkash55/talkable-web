'use client';

import { Box, Typography, Button, Card, CardContent, Alert, Divider, Stack } from '@mui/material';

import { useTheme } from '@mui/material/styles';
import ThemeToggle from '../components/header/ThemeToggle';

export default function ThemeDemoPage() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        padding: 4,
      }}
    >
      {/* Top Bar */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">MUI Theme Showcase</Typography>
        <ThemeToggle />
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Typography */}
      <Stack spacing={2} mb={4}>
        <Typography variant="h1">h1 Heading</Typography>
        <Typography variant="h2">h2 Heading</Typography>
        <Typography variant="h4">h4 Heading</Typography>
        <Typography variant="body1">This is body1 text with the default font.</Typography>
        <Typography variant="body2" color="text.secondary">
          This is secondary body2 text.
        </Typography>
      </Stack>

      {/* Buttons */}
      <Stack direction="row" spacing={2} mb={4}>
        <Button variant="contained" color="primary">
          Primary
        </Button>
        <Button variant="contained" color="secondary">
          Secondary
        </Button>
        <Button variant="outlined" color="success">
          Success
        </Button>
        <Button variant="text" color="warning">
          Warning
        </Button>
        <Button variant="contained" disabled>
          Disabled
        </Button>
      </Stack>

      {/* Alerts */}
      <Stack spacing={2} mb={4}>
        <Alert severity="success">This is a success alert!</Alert>
        <Alert severity="info">This is an info alert!</Alert>
        <Alert severity="warning">This is a warning alert!</Alert>
        <Alert severity="error">This is an error alert!</Alert>
      </Stack>

      {/* Card */}
      <Card sx={{ maxWidth: 400, mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Demo Card
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This is a simple MUI card showing how the paper background looks in both light and dark
            modes.
          </Typography>
        </CardContent>
      </Card>

      {/* Theme info */}
      <Typography variant="body2" color="text.secondary">
        Current Theme: <strong>{theme.palette.mode}</strong>
      </Typography>
    </Box>
  );
}
