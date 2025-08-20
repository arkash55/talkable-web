export const BIG_BUTTON_SX = {
  py: { xs: 1.75, sm: 2 },            // taller tap target
  px: { xs: 2.75, sm: 3.25 },         // wider surface
  minHeight: { xs: 56, sm: 64 },      // >= 48px is recommended; 56–64 feels big
  fontSize: { xs: '1rem', sm: '1.1rem' },
  borderRadius: 2.5,
  letterSpacing: 0.2,
};

// Optional: Add other button variants
export const MEDIUM_BUTTON_SX = {
  py: { xs: 1.25, sm: 1.5 },
  px: { xs: 2, sm: 2.5 },
  minHeight: { xs: 44, sm: 48 },
  fontSize: { xs: '0.9rem', sm: '1rem' },
  borderRadius: 2,
  letterSpacing: 0.1,
};



// src/app/settings/styles.ts
import { SxProps, Theme } from '@mui/material/styles';

export const CONTROL_BUTTON_SX: SxProps<Theme> = {
  borderRadius: 16,
  textTransform: 'none',
  fontWeight: 600,
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 1.5,
  minHeight: 88,
  px: 2,
};

// Extra styling just for the “Start New” button
export const START_NEW_BUTTON_SX = (theme: any) => ({
  ...CONTROL_BUTTON_SX,
  position: 'relative',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%)`,
  color: theme.palette.primary.contrastText,
  boxShadow: theme.shadows[4],
  overflow: 'hidden',
  borderRadius: 2,
  transition: 'box-shadow 200ms ease, transform 180ms ease',
  '&:hover': {
    boxShadow: theme.shadows[8],
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: theme.shadows[4],
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-40%',
    width: '40%',
    height: '100%',
    background:
      'linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 90%)',
    transform: 'skewX(-18deg)',
    opacity: 0,
  },
  '&:hover::after': {
    animation: 'startSheen 900ms ease forwards',
  },
  '@keyframes startSheen': {
    '0%': { left: '-40%', opacity: 0 },
    '20%': { opacity: 1 },
    '60%': { opacity: 0.6 },
    '100%': { left: '140%', opacity: 0 },
  },
});


// New: styling for “Stop Conversation” (same look, red theme)
export const STOP_BUTTON_SX = (theme: any) => ({
  ...START_NEW_BUTTON_SX(theme),
  background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 65%)`,
});

export const REFRESH_BUTTON_SX = (theme: any) => ({
  ...START_NEW_BUTTON_SX(theme),
  background: `linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.dark} 65%)`,
});

// Variant for ALL settings tiles – same look, small tweaks for states/selection
export const SETTINGS_TILE_SX = (theme: Theme, opts?: { selected?: boolean; danger?: boolean }) => {
  const isSelected = !!opts?.selected;
  const isDanger = !!opts?.danger;

  const baseGradient = isDanger
    ? `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 60%)`
    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%)`;

  return {
    ...START_NEW_BUTTON_SX(theme),
    // borderRadius: 2,
    width: 350,
    height: 120,
    background: baseGradient,
    border: isSelected ? `2px solid ${theme.palette.common.white}` : '2px solid transparent',
    outline: 'none',
    // Better focus ring for keyboard users
    '&:focus-visible': {
      boxShadow: `${theme.shadows[8]}, 0 0 0 3px rgba(255,255,255,0.35)`,
    },
    // Disabled look
    '&.Mui-disabled': {
      opacity: 0.7,
      filter: 'grayscale(14%)',
      transform: 'none',
      boxShadow: theme.shadows[1],
      cursor: 'not-allowed',
      '&::after': { display: 'none' },
    },
  } as SxProps<Theme>;
};


export const TRENDING_TILE_SX = (theme: Theme) => {


   return {
    ...SETTINGS_TILE_SX(theme),
    borderRadius: 2,
    width: 520,
    height: 210,
   
  } as SxProps<Theme>;
};