'use client';

import * as React from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { SectionGrid } from '@/app/forms/components/SectionGrid';
import { SelectCard } from '@/app/forms/components/SelectCard';
import { CARD_HEIGHT, VOICE_MIN_COL, TONE_MIN_COL, GRID_GAP, VOICES, TONES } from '@/app/forms/constants/voiceToneOptions';

// Reuse your existing UI bits + constants (paths match your current RegisterForm setup)

export type VoiceTonePickerProps = {
  /** Currently selected tone key (e.g. 'calm') */
  tone: string;
  /** Currently selected voice id (e.g. 'en-GB-Neural2-A') */
  voice: string;
  /** Called when a tone is selected */
  onToneChange: (toneKey: string) => void;
  /** Called when a voice is selected */
  onVoiceChange: (voiceId: string) => void;

  /** Optional person name to include in TTS (e.g. firstName) */
  name?: string;

  /** Disable all interactions */
  disabled?: boolean;

  /** Form error strings (optional; shown under each section) */
  toneError?: string;
  voiceError?: string;

  /** Optional preview text, defaults to a helpful phrase */
  defaultPreviewText?: string;

  /** Layout overrides (optional) */
  cardHeight?: number;
  voiceMinCol?: number;
  toneMinCol?: number;
  gridGap?: number;
  /** Fixed column count for voices (overrides minCol logic when provided) */
  voiceCols?: number;
  /** Limit voices to a number of rows (only applies if voiceCols provided) */
  voiceRows?: number;
  /** Fixed column count for tones */
  toneCols?: number;
  /** Limit tones to a number of rows (only applies if toneCols provided) */
  toneRows?: number;
};

export default function VoiceTonePicker({
  tone,
  voice,
  onToneChange,
  onVoiceChange,
  name,
  disabled = false,
  toneError,
  voiceError,
  defaultPreviewText = 'Hi! I’m testing different tones to hear the contrast.',
  cardHeight = CARD_HEIGHT,
  voiceMinCol = VOICE_MIN_COL,
  toneMinCol = TONE_MIN_COL,
  gridGap = GRID_GAP,
  voiceCols,
  voiceRows,
  toneCols,
  toneRows,
}: VoiceTonePickerProps) {
  const [previewText, setPreviewText] = React.useState(defaultPreviewText);

  const handleListen = React.useCallback(() => {
    if (!tone || !voice) return;
    speakWithGoogleTTSClient(previewText || 'Hello!', tone, voice, name);
  }, [previewText, tone, voice, name]);

  // Slice arrays if rows * cols is specified
  const limitedVoices = React.useMemo(() => {
    if (!voiceCols || !voiceRows) return VOICES;
    const max = voiceCols * voiceRows;
    return VOICES.slice(0, max);
  }, [voiceCols, voiceRows]);

  const limitedTones = React.useMemo(() => {
    if (!toneCols || !toneRows) return TONES;
    const max = toneCols * toneRows;
    return TONES.slice(0, max);
  }, [toneCols, toneRows]);

  return (
    <Stack
      spacing={2}
      sx={{
        width: '100%',
        overflow: 'visible',              // let cards & ripples render fully
        px: { xs: 0, sm: 1 },             // light breathing room
        boxSizing: 'border-box',
      }}
    >
      {/* Preview row */}
      <Box sx={{ width: '100%', mt: 1 }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="center"
          sx={{ width: '100%' }}
        >
          <TextField
            size="small"
            fullWidth
            disabled={disabled}
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Preview phrase"
          />
          <Button
            size="medium"
            variant="outlined"
            startIcon={<VolumeUpIcon />}
            onClick={handleListen}
            disabled={!voice || !tone || disabled}
            sx={{ px: 3, minWidth: { md: 160 }, flexShrink: 0 }}
          >
            Listen
          </Button>
        </Stack>
      </Box>

      {/* Two side-by-side sections */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          flexWrap: { xs: 'wrap', md: 'nowrap' }, // wrap on small screens
          gap: { xs: 4, md: 7 },
          alignItems: 'stretch',
          width: '100%',
          // Optional: allow horizontal scroll instead of clipping if extremely narrow
          overflowX: { xs: 'auto', md: 'visible' },
          pb: 0.5,
        }}
      >
        {/* Voice section */}
        <Stack
          spacing={1.25}
          sx={{
            flex: 1,
            minWidth: 0,              // allow proper shrink in flex
            // Ensure some minimum so cards don't collapse too narrow
            '@media (max-width:600px)': { minWidth: '100%' },
          }}
        >
          <Typography variant="subtitle1" textAlign="center">
            Voice Selection
          </Typography>

          {/* If voiceCols provided use fixed grid, else responsive SectionGrid */}
          {voiceCols ? (
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: `repeat(${voiceCols}, minmax(0, 1fr))`,
                gap: theme.spacing(gridGap),
              })}
            >
              {limitedVoices.map((v) => (
                <SelectCard
                  key={v.id}
                  title={v.label}
                  subtitle={v.hint || v.id}
                  selected={voice === v.id}
                  disabled={disabled}
                  onClick={() => onVoiceChange(v.id)}
                  onPreview={() =>
                    speakWithGoogleTTSClient(
                      previewText || 'Hello!',
                      tone || 'calm',
                      v.id,
                      name
                    )
                  }
                  height={cardHeight}
                />
              ))}
            </Box>
          ) : (
            <SectionGrid minColWidth={voiceMinCol} gap={gridGap}>
              {VOICES.map((v) => (
                <Box key={v.id}>
                  <SelectCard
                    title={v.label}
                    subtitle={v.hint || v.id}
                    selected={voice === v.id}
                    disabled={disabled}
                    onClick={() => onVoiceChange(v.id)}
                    onPreview={() =>
                      speakWithGoogleTTSClient(
                        previewText || 'Hello!',
                        tone || 'calm',
                        v.id,
                        name
                      )
                    }
                    height={cardHeight}
                  />
                </Box>
              ))}
            </SectionGrid>
          )}

          {!!voiceError && (
            <Typography color="error" variant="caption" textAlign="center">
              {voiceError}
            </Typography>
          )}
        </Stack>

        {/* Tone section */}
        <Stack
          spacing={1.25}
          sx={{
            flex: 1,
            minWidth: 0,
            '@media (max-width:600px)': { minWidth: '100%' },
          }}
        >
          <Typography variant="subtitle1" textAlign="center">
            Preferred tone
          </Typography>

          {toneCols ? (
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: `repeat(${toneCols}, minmax(0, 1fr))`,
                gap: theme.spacing(gridGap),
              })}
            >
              {limitedTones.map((t) => (
                <SelectCard
                  key={t.key}
                  title={t.label}
                  subtitle={t.hint}
                  selected={tone === t.key}
                  disabled={disabled}
                  onClick={() => onToneChange(t.key)}
                  onPreview={() =>
                    speakWithGoogleTTSClient(
                      previewText || 'Hello!',
                      t.key,
                      voice || 'en-GB-Neural2-A',
                      name
                    )
                  }
                  height={cardHeight}
                />
              ))}
            </Box>
          ) : (
            <SectionGrid minColWidth={toneMinCol} gap={gridGap}>
              {TONES.map((t) => (
                <Box key={t.key}>
                  <SelectCard
                    title={t.label}
                    subtitle={t.hint}
                    selected={tone === t.key}
                    disabled={disabled}
                    onClick={() => onToneChange(t.key)}
                    onPreview={() =>
                      speakWithGoogleTTSClient(
                        previewText || 'Hello!',
                        t.key,
                        voice || 'en-GB-Neural2-A',
                        name
                      )
                    }
                    height={cardHeight}
                  />
                </Box>
              ))}
            </SectionGrid>
          )}

          {!!toneError && (
            <Typography color="error" variant="caption" textAlign="center">
              {toneError}
            </Typography>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
