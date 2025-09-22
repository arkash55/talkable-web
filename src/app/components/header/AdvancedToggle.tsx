'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  FormControlLabel,
  Tooltip,
  Typography,
  useTheme,
  styled,
  Switch,
} from '@mui/material';
import { useAdvancedMode } from '@/app/context/AdvancedModeContext';

const CoolSwitch = styled(Switch)(({ theme }) => ({
  width: 80,
  height: 44,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    top: 6,
    left: 6,
    padding: 0,
    transition: theme.transitions.create(['transform'], {
      duration: 300,
      easing: theme.transitions.easing.easeInOut,
    }),
    
    '&.Mui-focusVisible': {
      outline: 'none',
      boxShadow: 'none',
    },
    '&.Mui-checked': {
      transform: 'translateX(36px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%)`,
        opacity: 1,
        boxShadow: '0 0 0 0 rgba(0,0,0,0)', 
      },
    },
  },
  '& .MuiSwitch-thumb': {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
    transition: theme.transitions.create(['box-shadow', 'transform', 'background-color'], {
      duration: 300,
    }),
  },
  '& .MuiSwitch-track': {
    borderRadius: 30,
    backgroundColor:
      theme.palette.mode === 'light'
        ? theme.palette.grey[400]
        : theme.palette.grey[800],
    opacity: 1,
    
    boxShadow: 'inset 0 0 12px rgba(0,0,0,0.15)',
    transition: theme.transitions.create(['background-color', 'box-shadow'], {
      duration: 400,
    }),
  },
  '&:hover .MuiSwitch-thumb': {
    transform: 'scale(1.08)',
    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
  },
}));

export default function AdvancedToggle() {
  const { advanced, setAdvanced } = useAdvancedMode();
  const theme = useTheme();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => setSignedIn(!!user));
    return () => unsub();
  }, []);

  if (!signedIn) return null; 

  return (
    <Tooltip
      title={advanced ? 'Advanced mode: show underlying details' : 'Basic mode: For the normal user'}
      arrow
    >
      <FormControlLabel
        control={
          <CoolSwitch
            checked={advanced}
            onChange={(_, v) => setAdvanced(v)}
            inputProps={{ 'aria-label': 'Advanced mode' }}
            disableRipple
            focusVisibleClassName="" 
          />
        }
  
        label={
          <Typography
            variant="body1"
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              ml: 1,
              color:
                theme.palette.mode === 'light'
                  ? theme.palette.text.primary
                  : theme.palette.text.secondary,
            }}
          >
            {advanced ? 'Advanced mode' : 'Basic mode'}
          </Typography>
        }
        sx={{
          m: 0,
          
          outline: 'none',
          '&:focus-within': { outline: 'none' },
          '& .MuiFormControlLabel-label': { cursor: 'pointer' },
        }}
      />
    </Tooltip>
  );
}
