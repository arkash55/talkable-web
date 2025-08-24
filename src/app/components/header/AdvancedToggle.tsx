// src/app/components/header/AdvancedToggle.tsx
'use client';

import { FormControlLabel, Switch, Tooltip, Typography, useTheme } from '@mui/material';
import { useAdvancedMode } from '@/app/context/AdvancedModeContext';

export default function AdvancedToggle() {
  const { advanced, setAdvanced } = useAdvancedMode();
  const theme = useTheme();

  return (
    <Tooltip title={advanced ? 'Advanced mode: show math details' : 'Basic mode'} arrow>
      <FormControlLabel
        control={
          <Switch
            checked={advanced}
            onChange={(_, v) => setAdvanced(v)}
            color="primary"
            inputProps={{ 'aria-label': 'Advanced mode' }}
            size="medium"
          />
        }
        // Force a high-contrast label in light mode
        label={
          <Typography
            variant="body2"
            sx={{
              color:
                theme.palette.mode === 'light'
                  ? theme.palette.text.primary
                  : theme.palette.text.secondary,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            Advanced
          </Typography>
        }
        sx={{
          m: 0,
          '& .MuiFormControlLabel-label': {
            // fallback if someone removes the Typography wrapper later
            color:
              theme.palette.mode === 'light'
                ? theme.palette.text.primary
                : theme.palette.text.secondary,
          },
        }}
      />
    </Tooltip>
  );
}
