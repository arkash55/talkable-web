'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/material';
import SettingsGrid, { SettingsKey } from '@/app/forms/components/settings/SettingsGrid';


export default function SettingsClient() {
  const handleSelect = (key: SettingsKey) => {
    // You said you'll wire actions yourself; for now just log.
    console.log('Clicked:', key);
    // e.g., if (key === 'about') openAboutDialog();
  };

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 5 }}>
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
        radius={16}      // <- adjust corner radius
      />
    </Box>
  );
}
