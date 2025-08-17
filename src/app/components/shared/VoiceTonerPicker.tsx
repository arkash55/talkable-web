'use client';

import * as React from 'react';
import { Box, Stack, Typography, TextField, Button } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { SectionGrid } from '@/app/forms/components/SectionGrid';
import { SelectCard } from '@/app/forms/components/SelectCard';
import {
  CARD_HEIGHT, VOICE_MIN_COL, TONE_MIN_COL, GRID_GAP, VOICES, TONES
} from '@/app/forms/constants/voiceToneOptions';

const CONTROL_HEIGHT = 80;
const CONTROL_RADIUS = 3;     // matches MUI default-ish rounded look
const CONTROL_BORDER = 1;     // make both use the same border thickness

export type VoiceTonePickerProps = {
  tone: string;
  voice: string;
  onToneChange: (toneKey: string) => void;
  onVoiceChange: (voiceId: string) => void;
  name?: string;
  disabled?: boolean;
  toneError?: string;
  voiceError?: string;
  defaultPreviewText?: string;
  cardHeight?: number;
  voiceMinCol?: number;
  toneMinCol?: number;
  gridGap?: number;
  voiceCols?: number;
  voiceRows?: number;
  toneCols?: number;
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
  defaultPreviewText = `Hi ${name ?? ''}, I’m testing different tones to hear the contrast.`,
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

  React.useEffect(() => {
    setPreviewText(prev => (prev === defaultPreviewText ? defaultPreviewText : prev));
  }, [defaultPreviewText]);

  const buildSpeakText = React.useCallback(() => {
    let text = (previewText || '').trim();
    if (!text) return '';
    if (name && /\{\{?\s*name\s*\}?\}/i.test(text)) {
      text = text.replace(/\{\{?\s*name\s*\}?\}/gi, name);
    }
    return text;
  }, [previewText, name]);

  const handleListen = React.useCallback(() => {
    if (!tone || !voice) return;
    const speakText = buildSpeakText();
    if (!speakText) return;
    speakWithGoogleTTSClient(speakText, tone, voice, name);
  }, [buildSpeakText, tone, voice, name]);

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
    <Stack spacing={2} sx={{ width: '100%', overflow: 'visible', px: { xs: 0, sm: 1 } }}>
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
            placeholder="Preview phrase"
            fullWidth
            disabled={disabled}
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            variant="outlined"
            InputProps={{
              sx: {
                height: CONTROL_HEIGHT,
                boxSizing: 'border-box',
                borderRadius: CONTROL_RADIUS,
                display: 'flex',
                alignItems: 'center',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: CONTROL_BORDER,
                },
                '& .MuiOutlinedInput-input': {
                  height: '100%',
                  boxSizing: 'border-box',
                  p: 0,
                  px: 2,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1rem',
                  lineHeight: 1,
                },
              },
            }}
          />

          {/* IMPORTANT: no BIG_BUTTON_SX here to avoid padding overrides */}
          <Button
            variant="outlined"
            onClick={handleListen}
            disabled={!voice || !tone || disabled}
            startIcon={<VolumeUpIcon />}
            sx={{
              height: CONTROL_HEIGHT,
              minHeight: CONTROL_HEIGHT,
              borderRadius: CONTROL_RADIUS,
              width: 190,
              lineHeight: 1,
              px: 2,                 // make padding match input’s px
              py: 0,                 // kill vertical padding
              fontSize: '1rem',
              borderWidth: CONTROL_BORDER,
              borderStyle: 'solid',
              borderColor: 'divider', // visually closer to TextField outline
              textTransform: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              '& .MuiButton-startIcon': { m: 0, mr: 1 },
            }}
          >
            Listen
          </Button>
        </Stack>
      </Box>

      {/* Voice & Tone sections */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: { xs: 4, md: 7 },
          alignItems: 'stretch',
          width: '100%',
          overflowX: { xs: 'auto', md: 'visible' },
          pb: 0.5,
        }}
      >
        {/* Voice */}
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0, '@media (max-width:600px)': { minWidth: '100%' } }}>
          <Typography variant="subtitle1" textAlign="center">Voice Selection</Typography>
          {voiceCols ? (
            <Box sx={(t) => ({ display: 'grid', gridTemplateColumns: `repeat(${voiceCols}, minmax(0, 1fr))`, gap: t.spacing(gridGap) })}>
              {limitedVoices.map((v) => (
                <SelectCard
                  key={v.id}
                  title={v.label}
                  subtitle={v.hint || v.id}
                  selected={voice === v.id}
                  disabled={disabled}
                  onClick={() => onVoiceChange(v.id)}
                  onPreview={() => speakWithGoogleTTSClient(buildSpeakText(), tone || 'calm', v.id, name)}
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
                    onPreview={() => speakWithGoogleTTSClient(buildSpeakText(), tone || 'calm', v.id, name)}
                    height={cardHeight}
                  />
                </Box>
              ))}
            </SectionGrid>
          )}
          {!!voiceError && <Typography color="error" variant="caption" textAlign="center">{voiceError}</Typography>}
        </Stack>

        {/* Tone */}
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0, '@media (max-width:600px)': { minWidth: '100%' } }}>
          <Typography variant="subtitle1" textAlign="center">Preferred tone</Typography>
          {toneCols ? (
            <Box sx={(t) => ({ display: 'grid', gridTemplateColumns: `repeat(${toneCols}, minmax(0, 1fr))`, gap: t.spacing(gridGap) })}>
              {limitedTones.map((t) => (
                <SelectCard
                  key={t.key}
                  title={t.label}
                  subtitle={t.hint}
                  selected={tone === t.key}
                  disabled={disabled}
                  onClick={() => onToneChange(t.key)}
                  onPreview={() => speakWithGoogleTTSClient(buildSpeakText(), t.key, voice || 'en-GB-Neural2-A', name)}
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
                    onPreview={() => speakWithGoogleTTSClient(buildSpeakText(), t.key, voice || 'en-GB-Neural2-A', name)}
                    height={cardHeight}
                  />
                </Box>
              ))}
            </SectionGrid>
          )}
          {!!toneError && <Typography color="error" variant="caption" textAlign="center">{toneError}</Typography>}
        </Stack>
      </Box>
    </Stack>
  );
}
