'use client';

import * as React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import SettingsGrid, { SettingsKey } from '@/app/forms/components/settings/SettingsGrid';


export default function SettingsClient() {
  const theme = useTheme();
  const router = useRouter();



  return (
    <Box sx={{ display: 'flex',flexDirection: 'column', alignItems: 'center',justifyContent: 'center',    
      maxWidth: '70%', mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Profile & Account</Typography>
        <Typography variant="body2" color="text.secondary">
          Update details, passwords, and preferences
        </Typography>
      </Box>
      
      <SettingsGrid/>
    </Box>
  );
}
