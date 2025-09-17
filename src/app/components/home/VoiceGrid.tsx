// src/app/components/home/VoiceGrid.tsx
'use client';

import { Box, Typography, Stack } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import MarkChatUnreadIcon from '@mui/icons-material/MarkChatUnread';
import { useAdvancedMode } from '@/app/context/AdvancedModeContext';

interface FlowDebug {
  prob?: number;               // 0..1
  utility?: number;
  meanLogProb?: number;
  simToLastUser?: number;      // 0..1
  lengthPenalty?: number;      // >= 0
  repetitionPenalty?: number;  // >= 0
  totalPenalty?: number;       // >= 0
  weights?: { a: number; b: number; g: number; tau: number };
}

interface VoiceGridBlock {
  label: string;
  onClick: () => void;
  /** optional: flow debug info to render bottom-right */
  debug?: FlowDebug;
}

type VoiceGridType = 'homePage' | 'chatPage';

interface ChatMeta {
  /** True if the thread already has at least one message */
  hasMessages: boolean;
  /** True if we’re waiting for the other user (i.e., last message was from me). */
  waitingForOther?: boolean;
  /** Optional display name for “waiting for X” copy. */
  otherName?: string;
}

interface VoiceGridProps {
  blocks: VoiceGridBlock[];
  disabled?: boolean;
  activeIndex?: number | null;
  type?: VoiceGridType;

  /** When false (and no chatMeta override), show the empty state. */
  activeConversation: boolean;

  /** NEW (optional): chat-specific state to refine empty-state rendering on chat pages. */
  chatMeta?: ChatMeta;
}

type Pos = { col: number; row: number; colSpan: number; rowSpan: number };

function layoutForCount(n: number): Pos[] {
  const original: Pos[] = [
    { col: 1, row: 1, colSpan: 4, rowSpan: 4 },
    { col: 5, row: 1, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 3, colSpan: 2, rowSpan: 2 },
    { col: 1, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 3, row: 5, colSpan: 2, rowSpan: 2 },
    { col: 5, row: 5, colSpan: 2, rowSpan: 2 },
  ];

  switch (n) {
    case 2:
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 6 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 6 },
      ];
    case 3:
      return [
        { col: 1, row: 1, colSpan: 3, rowSpan: 6 },
        { col: 4, row: 1, colSpan: 3, rowSpan: 3 },
        { col: 4, row: 4, colSpan: 3, rowSpan: 3 },
      ];
    case 4:
      return [
        { col: 1, row: 1, colSpan: 4, rowSpan: 4 },
        { col: 1, row: 5, colSpan: 6, rowSpan: 2 },
        { col: 5, row: 1, colSpan: 2, rowSpan: 2 },
        { col: 5, row: 3, colSpan: 2, rowSpan: 2 },
      ];
    case 5:
      return [
        { col: 1, row: 1, colSpan: 2, rowSpan: 6 },
        { col: 3, row: 1, colSpan: 2, rowSpan: 3 },
        { col: 3, row: 4, colSpan: 2, rowSpan: 3 },
        { col: 5, row: 1, colSpan: 2, rowSpan: 3 },
        { col: 5, row: 4, colSpan: 2, rowSpan: 3 },
      ];
    case 6:
    default:
      return original;
  }
}

function formatNum(n: number | undefined, digits = 3) {
  return typeof n === 'number' && isFinite(n) ? n.toFixed(digits) : undefined;
}

/**
 * Map a block's surface area to a dark-mode-friendly blue.
 * Larger area => brighter (higher lightness). Smaller => darker.
 * We keep saturation high so it stays vivid against dark surfaces.
 *
 * We also clamp lightness to keep white text (forced) readable.
 */
function blueForArea(area: number, minArea: number, maxArea: number) {
  const range = Math.max(1, maxArea - minArea);
  const t = (area - minArea) / range; // 0..1 (small..large)
  const hue = 215;          // deep blue
  const sat = 92;           // vivid
  const Lmin = 32;          // darkest for smallest area
  const Lmax = 54;          // brightest for largest area (still OK with white text)
  const light = Lmin + t * (Lmax - Lmin);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Slight hover lift on the same hue but a touch brighter */
function hoverBlue(color: string) {
  // crude lighten: rely on CSS color-mix if supported, fallback via filter-like effect
  return `color-mix(in oklab, ${color} 84%, white)`;
}

function EmptyCard({
  icon,
  title,
  subtitle,
  onClick,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  cta?: string;
}) {
  return (
    <Box
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={(theme) => ({
        maxWidth: 560,
        width: '100%',
        border: `2px dashed ${theme.palette.divider}`,
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease, transform 0.15s ease',
        '&:hover': onClick
          ? {
              backgroundColor: theme.palette.action.hover,
              transform: 'translateY(-1px)',
            }
          : undefined,
        outline: 'none',
      })}
    >
      <Stack spacing={1.25} alignItems="center">
        {icon}
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {cta && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {cta}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default function VoiceGrid({
  blocks,
  disabled = false,
  activeIndex = null,
  type = 'homePage',
  activeConversation,
  chatMeta,
}: VoiceGridProps) {
  // ---- Empty states routing -------------------------------------------------
  // HOME: if not activeConversation → show "Start a Conversation" CTA
  if (type === 'homePage' && !activeConversation) {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <EmptyCard
          icon={<GraphicEqIcon sx={{ fontSize: 56, opacity: 0.8 }} />}
          title="Start A Conversation"
          subtitle="Click the start new conversation button and we’ll surface options here."
          onClick={() => {
            const evtName = 'home:stt:requestStart';
            window.dispatchEvent(new CustomEvent(evtName));
          }}
          cta="You can then select a generated response"
        />
      </Box>
    );
  }

  // CHAT: refine empty states using chatMeta when provided
  if (type === 'chatPage' && (!blocks?.length || !activeConversation)) {
    // 1) No messages in this chat yet
    if (chatMeta && chatMeta.hasMessages === false) {
      return (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <EmptyCard
            icon={<MarkChatUnreadIcon sx={{ fontSize: 56, opacity: 0.8 }} />}
            title="No messages yet"
            subtitle="Send a custom message to kick things off."
          />
        </Box>
      );
    }

    // 2) Waiting for the other user’s reply (last message was from me)
    if (chatMeta && chatMeta.waitingForOther) {
      return (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <EmptyCard
            icon={<HourglassBottomIcon sx={{ fontSize: 56, opacity: 0.8 }} />}
            title={`Waiting for ${chatMeta.otherName ? chatMeta.otherName : 'a reply'}…`}
            subtitle="We’ll show smart suggestions when they respond."
          />
        </Box>
      );
    }

    // 3) If it's our turn (blocks should be present), fall through to grid;
    // if not, keep a neutral placeholder.
    if (!blocks?.length) {
      return (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <EmptyCard
            icon={<GraphicEqIcon sx={{ fontSize: 56, opacity: 0.8 }} />}
            title="Responses will appear here"
            subtitle="Send a custom message or wait for a message to get responses."
          />
        </Box>
      );
    }
  }

  // ---- Normal grid ----------------------------------------------------------
  const count = Math.max(0, Math.min(blocks.length, 6));
  const positions = layoutForCount(count);
  const { advanced } = useAdvancedMode();

  // Precompute areas → min/max for color scaling
  const areas = positions.map((p) => p.colSpan * p.rowSpan);
  const minArea = Math.min(...areas);
  const maxArea = Math.max(...areas);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: 0,
      }}
    >
      {blocks.slice(0, count).map((block, index) => {
        const pos = positions[index];
        const isActive = activeIndex === index;
        const dimmed = disabled && !isActive;

        const area = pos.colSpan * pos.rowSpan;
        const baseBg = blueForArea(area, minArea, maxArea);
        const baseColor = '#fff'; // force white text for visibility

        const d = block.debug;
        const hasDebug =
          d &&
          (d.prob !== undefined ||
            d.utility !== undefined ||
            d.meanLogProb !== undefined ||
            d.simToLastUser !== undefined ||
            d.lengthPenalty !== undefined ||
            d.repetitionPenalty !== undefined ||
            d.totalPenalty !== undefined ||
            d.weights !== undefined);

        const probPct =
          typeof d?.prob === 'number' && isFinite(d?.prob)
            ? `${Math.round(Math.max(0, Math.min(1, d.prob)) * 100)}%`
            : undefined;

        const isLarge = area >= 12;

        return (
          <Box
            key={index}
            onClick={
              !disabled
                ? () => {
                    block.onClick();
                    const evtName =
                      type === 'homePage' ? 'ui:voicegrid:click' : 'chat:ui:voicegrid:click';
                    window.dispatchEvent(
                      new CustomEvent(evtName, { detail: { index, label: block.label } })
                    );
                  }
                : undefined
            }
            sx={{
              gridColumn: `${pos.col} / span ${pos.colSpan}`,
              gridRow: `${pos.row} / span ${pos.rowSpan}`,
              backgroundColor: baseBg,
              color: baseColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.18)',
              userSelect: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: dimmed ? 0.5 : 1,
              transition:
                'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease, background-color 0.15s ease',
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isActive
                ? '0 0 0 3px rgba(255,255,255,0.6) inset, 0 8px 24px rgba(0,0,0,0.28)'
                : 'none',
              outline: isActive ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: isActive ? '-3px' : 0,
              p: 1,
              textAlign: 'center',
              position: 'relative',
              '&:hover': {
                backgroundColor: hoverBlue(baseBg),
              },
              // improve legibility if text wraps onto multiple lines
              textShadow: '0 1px 2px rgba(0,0,0,0.35)',
            }}
          >
            <Typography
              variant={isLarge ? 'h4' : 'h6'}
              sx={{
                color: baseColor,
                px: 2,
                textAlign: 'center',
                wordBreak: 'break-word',
              }}
            >
              {block.label}
            </Typography>

            {/* Bottom-right debug panel */}
            {advanced && hasDebug && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                  maxWidth: '92%',
                  bgcolor: 'rgba(0,0,0,0.38)',
                  color: 'white',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    lineHeight: 1.2,
                    opacity: 0.95,
                    whiteSpace: 'nowrap',
                  }}
                >
                  prob: {probPct ?? (formatNum(d?.prob) ?? '—')}
                  | utility: {formatNum(d?.utility) ?? '—'} | meanLogProb:{' '}
                  {formatNum(d?.meanLogProb) ?? '—'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    lineHeight: 1.2,
                    opacity: 0.95,
                    whiteSpace: 'nowrap',
                  }}
                >
                  simToLastUser: {formatNum(d?.simToLastUser) ?? '—'} | lengthPenalty:{' '}
                  {formatNum(d?.lengthPenalty) ?? '—'} | repetitionPenalty:{' '}
                  {formatNum(d?.repetitionPenalty) ?? '—'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    lineHeight: 1.2,
                    opacity: 0.9,
                    whiteSpace: 'nowrap',
                  }}
                >
                  totalPenalty: {formatNum(d?.totalPenalty) ?? '—'} | weights:{' '}
                  {d?.weights
                    ? `a=${formatNum(d.weights.a)} b=${formatNum(d.weights.b)} g=${formatNum(
                        d.weights.g
                      )} τ=${formatNum(d.weights.tau)}`
                    : '—'}
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
