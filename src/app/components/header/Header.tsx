'use client';

import {
  AppBar,
  Box,
  Tabs,
  Tab,
  Toolbar,
  Typography,
  useTheme,
  Slide,
  alpha,
} from '@mui/material';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ThemeToggle from './ThemeToggle';
import AdvancedToggle from './AdvancedToggle';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';

const routes = ['/home', '/general', '/chat', '/settings'];
const labels = ['Home', 'General', 'Chat', 'Settings'];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();

  const currentTab = routes.findIndex((r) => pathname === r);
  const [value, setValue] = useState(currentTab === -1 ? 0 : currentTab);

  useEffect(() => {
    setValue(currentTab === -1 ? 0 : currentTab);
  }, [pathname, currentTab]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    router.push(routes[newValue]);
  };

  const isLight = theme.palette.mode === 'light';
  const background = isLight ? theme.palette.grey[200] : theme.palette.background.paper;

  return (
    <Slide in={true} direction="down" timeout={400}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backdropFilter: 'blur(12px)',
          backgroundColor: background,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            minHeight: 96,
            px: 4,
          }}
        >
          {/* Logo & Title */}
          <Box display="flex" alignItems="center" gap={2}>
            <RecordVoiceOverIcon
              fontSize="large"
              sx={{ fontSize: 40, color: theme.palette.text.primary }}
            />
            <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
              Talkable
            </Typography>
          </Box>

          {/* Tabs */}
          {user && (
            <Tabs
              value={value}
              onChange={handleTabChange}
              textColor="primary"
              indicatorColor="primary"
              sx={{
                minHeight: 96,
                '& .MuiTab-root': {
                  minHeight: 96,
                  minWidth: 120,
                  fontSize: '1.1rem',
                  fontWeight: 'SemiBold',
                  borderRadius: 2,
                  mx: 1,
                  px: 3,
                  py: 1,
                  transition: 'background 0.3s ease',
                  color: theme.palette.text.primary,
                  fontFamily: 'var(--font-family)',
                },
                '& .MuiTab-root:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
                '& .MuiTabs-indicator': {
                  height: '4px',
                },
              }}
            >
              {labels.map((label) => (
                <Tab key={label} label={label} disableRipple />
              ))}
            </Tabs>
          )}

          {/* Right controls */}
          <Box display="flex" alignItems="center" gap={2}>
            <AdvancedToggle />
            <ThemeToggle />
          </Box>
        </Toolbar>
      </AppBar>
    </Slide>
  );
}
