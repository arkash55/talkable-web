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
}: VoiceTonePickerProps) {
  const [previewText, setPreviewText] = React.useState(defaultPreviewText);

  const handleListen = React.useCallback(() => {
    if (!tone || !voice) return;
    speakWithGoogleTTSClient(previewText || 'Hello!', tone, voice, name);
  }, [previewText, tone, voice, name]);

  return (
    <Stack spacing={2} sx={{ overflow: 'hidden', width: '100%' }}>
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
          gap: 7,
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        {/* Voice section */}
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" textAlign="center">
            Voice Selection
          </Typography>

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

          {!!voiceError && (
            <Typography color="error" variant="caption" textAlign="center">
              {voiceError}
            </Typography>
          )}
        </Stack>

        {/* Tone section */}
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" textAlign="center">
            Preferred tone
          </Typography>

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
