
'use client';

import * as React from 'react';
import { Button, Box, Typography } from '@mui/material';
import { SETTINGS_TILE_SX } from '@/app/styles/buttonStyles';


type SettingsTileProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
};

export default function SettingsTile(props: SettingsTileProps) {
  const { title, subtitle, icon, onClick, selected, danger, disabled, ...rest } = props;

  return (
    <Button
      fullWidth
      disableElevation
      onClick={onClick}
      disabled={disabled}
      sx={(theme) => SETTINGS_TILE_SX(theme, { selected, danger })}
      {...rest}
    >
      {icon && (
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ textAlign: 'left' }}>
        <Typography variant="subtitle1" sx={{ lineHeight: 1.1 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Button>
  );
}
