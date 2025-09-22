export const CARD_HEIGHT = { xs: 84, sm: 96, md: 100 };
export const GRID_GAP = 2;
export const VOICE_MIN_COL = 160;
export const TONE_MIN_COL  = 140;

export const TONES: { key: string; label: string; hint: string }[] = [
  { key: 'friendly',     label: 'Friendly',     hint: 'warm & upbeat' },
  { key: 'confident',    label: 'Confident',    hint: 'clear & steady' },
  { key: 'cheerful',     label: 'Cheerful',     hint: 'bright & lively' },
  { key: 'calm',         label: 'Calm',         hint: 'slow & relaxed' },
  { key: 'enthusiastic', label: 'Enthusiastic', hint: 'energetic' },
  { key: 'serious',      label: 'Serious',      hint: 'formal' },
  { key: 'sad',          label: 'Sad',          hint: 'soft & low' },
  { key: 'angry',        label: 'Angry',        hint: 'firm & fast' },
];

export const VOICES: { id: string; label: string; hint?: string }[] = [
  { id: 'en-GB-Standard-A', label: 'Standard A', hint: 'Female' },
  { id: 'en-GB-Standard-B', label: 'Standard B', hint: 'Male' },
  { id: 'en-GB-Standard-C', label: 'Standard C', hint: 'Female' },
  { id: 'en-GB-Standard-D', label: 'Standard D', hint: 'Male' },
  { id: 'en-GB-Neural2-A',  label: 'Neural2 A',  hint: 'Female (neural)' },
  { id: 'en-GB-Neural2-B',  label: 'Neural2 B',  hint: 'Male (neural)' },
];