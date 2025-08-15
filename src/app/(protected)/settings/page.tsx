'use client';

import * as React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import SettingsGrid, { SettingsKey } from '@/app/forms/components/settings/SettingsGrid';


export default function SettingsClient() {
  const theme = useTheme();
  const router = useRouter();

  // Keys that have a dedicated page under (settings-tabs)
  const ROUTE_KEYS: SettingsKey[] = ['about-me','tone-voice','privacy','terms','delete','profile'];

  const handleSelect = (key: SettingsKey) => {
    if (ROUTE_KEYS.includes(key)) {
      router.push(`/settings/${key}`);
      return;
    }
    if (key === 'logout') {
      // TODO: trigger your sign-out flow
      console.log('Logout action');
    }
  };

  const contentLeftOffset = `calc(16px + 48px + ${theme.spacing(1.75)})`;

  return (
    <Box sx={{ maxWidth: '70%', mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 5, pl: contentLeftOffset }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Profile & Account</Typography>
        <Typography variant="body2" color="text.secondary">
          Update details, passwords, and preferences
        </Typography>
      </Box>

      {/* You can tweak size here */}
      <SettingsGrid
        onSelect={handleSelect}
        columns={3}     // <- 2 rows of 3 items
        cardHeight={150} // <- adjust card size
        gap={7}        // <- adjust spacing
        radius={3}      // <- adjust corner radius
      />
    </Box>
  );
}
