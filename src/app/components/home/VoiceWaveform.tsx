'use client';

import { Box } from '@mui/material';

export default function VoiceWaveform() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: 28 }}>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            width: 4,
            height: 16,
            backgroundColor: 'primary.main',
            marginX: 0.5,
            animation: 'wave 1.2s infinite ease-in-out',
            animationDelay: `${i * 0.15}s`,
            borderRadius: 2,
          }}
        />
      ))}

      <style jsx global>{`
        @keyframes wave {
          0%, 100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1.2);
          }
        }
      `}</style>
    </Box>
  );
}
