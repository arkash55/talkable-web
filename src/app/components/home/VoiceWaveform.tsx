'use client';

import { Box } from '@mui/material';

interface VoiceWaveformProps {
  listening: boolean;
  speaking: boolean;
  hasSound: boolean;
}

export default function VoiceWaveform({ listening, speaking, hasSound }: VoiceWaveformProps) {
  if (!listening && !speaking) return null;

  // Animate if TTS is speaking or there is mic input
  const animate = speaking || (listening && hasSound);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: 28 }}>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            width: 4,
            height: '16px',
            backgroundColor: 'primary.main',
            marginX: 0.5,
            borderRadius: 2,
            animation: animate
              ? 'wave 1.2s infinite ease-in-out'
              : undefined,
            animationDelay: animate ? `${i * 0.15}s` : undefined,
          }}
        />
      ))}
      {animate && (
        <style jsx global>{`
          @keyframes wave {
            0%,
            100% {
              transform: scaleY(0.4);
            }
            50% {
              transform: scaleY(1.2);
            }
          }
        `}</style>
      )}
    </Box>
  );
}
