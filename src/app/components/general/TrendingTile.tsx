'use client';

import * as React from 'react';
import {
  Paper,
  CardActionArea,
  Box,
  Stack,
  Avatar,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import { TRENDING_TILE_SX } from '@/app/styles/buttonStyles';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import BoltIcon from '@mui/icons-material/Bolt';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GavelIcon from '@mui/icons-material/Gavel';

export type TrendingTopic = {
  id: string;
  title: string;
  description: string;
  starter: string;
  tag?: string;
};

function TopicIcon({ tag }: { tag?: string }) {
  if (!tag) return <WhatshotIcon fontSize="small" />;
  const t = tag.toLowerCase();
  if (t.includes('sport') || t.includes('football')) return <SportsSoccerIcon fontSize="small" />;
  if (t.includes('news')) return <NewspaperIcon fontSize="small" />;
  if (t.includes('politic')) return <GavelIcon fontSize="small" />;
  if (t.includes('trend')) return <BoltIcon fontSize="small" />;
  return <WhatshotIcon fontSize="small" />;
}

export function TrendingTile({
  topic,
  onClick,
}: {
  topic: TrendingTopic;
  onClick: () => void;
}) {
  return (
    <Paper elevation={0} sx={TRENDING_TILE_SX}>
      <CardActionArea onClick={onClick} sx={{ borderRadius: 2, height: '100%' }}>
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.2)' }}>
              <TopicIcon tag={topic.tag} />
            </Avatar>
            {topic.tag ? (
              <Chip
                size="small"
                label={topic.tag}
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }}
              />
            ) : null}
          </Stack>

            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
              {topic.title}
            </Typography>

          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {topic.description}
          </Typography>

          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.25)' }} />

          <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.95 }}>
            “{topic.starter}”
          </Typography>
        </Box>
      </CardActionArea>
    </Paper>
  );
}
