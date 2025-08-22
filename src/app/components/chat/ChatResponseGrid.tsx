// src/app/components/chat/ChatResponseGrid.tsx
'use client';

import { Box, Typography, Paper } from '@mui/material';
import { Candidate } from '@/services/graniteClient';

type Props = {
  responses: Candidate[];
  onSelect: (c: Candidate) => void;
};

export default function ChatResponseGrid({ responses, onSelect }: Props) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 2,
        p: 2,
      }}
    >
      {responses.map((r, i) => (
        <Paper
          key={i}
          onClick={() => onSelect(r)}
          sx={{
            p: 2,
            borderRadius: 2,
            cursor: 'pointer',
            '&:hover': { boxShadow: 4 },
          }}
        >
          <Typography variant="body1" sx={{ mb: 1 }}>
            {r.text}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            logProb: {r.avgLogProb.toFixed(2)} | prob: {(r.relativeProb * 100).toFixed(1)}%
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
