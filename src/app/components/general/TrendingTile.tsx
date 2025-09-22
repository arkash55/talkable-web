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
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const [descClamp, setDescClamp] = React.useState<number>(2);
  const [isClamped, setIsClamped] = React.useState<boolean>(false);

  
  const getLineCount = (el: Element | null) => {
    if (!el) return 1;
    const style = window.getComputedStyle(el);
    const lineHeightStr = style.lineHeight;
    let lineHeight = parseFloat(lineHeightStr);
    if (Number.isNaN(lineHeight)) {
      
      const fontSize = parseFloat(style.fontSize) || 16;
      lineHeight = 1.2 * fontSize;
    }
    const h = (el as HTMLElement).scrollHeight;
    return Math.max(1, Math.round(h / lineHeight));
  };

  
  
  
  
  const recomputeLayout = React.useCallback(() => {
    const titleLines = getLineCount(titleRef.current);
    const nextClamp = titleLines >= 2 ? 1 : 2;
    setDescClamp(nextClamp);

    
    requestAnimationFrame(() => {
      if (descRef.current) {
        const el = descRef.current;
        const overflowing = el.scrollHeight > el.clientHeight + 1;
        setIsClamped(overflowing);
      }
    });
  }, []);

  React.useEffect(() => {
    recomputeLayout();
  }, [topic.title, topic.description, recomputeLayout]);

  
  React.useEffect(() => {
    if (!titleRef.current && !descRef.current) return;
    const ro = new ResizeObserver(() => recomputeLayout());
    if (titleRef.current) ro.observe(titleRef.current);
    if (descRef.current) ro.observe(descRef.current);
    return () => ro.disconnect();
  }, [recomputeLayout]);

  
  const appendPeriodIfNeeded = (s: string) =>
    /[.!?…]$/.test(s.trim()) ? s : s.trim().length ? `${s}.` : s;

  const displayedDesc = !isClamped ? appendPeriodIfNeeded(topic.description) : topic.description;

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

          {}
          <Typography
            variant="h6"
            fontWeight={800}
            sx={{ lineHeight: 1.1 }}
            component="span"
            ref={titleRef}
          >
            {topic.title}
          </Typography>

          {}
          <Typography
            ref={descRef}
            variant="body2"
            sx={{
              opacity: 0.9,
              display: '-webkit-box',
              WebkitLineClamp: descClamp,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayedDesc}
          </Typography>

          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.25)' }} />
        </Box>
      </CardActionArea>
    </Paper>
  );
}
