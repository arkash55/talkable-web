export function buildSystemPrompt(tone?: string, userDescription?: string): string {
  // --- helpers ---
  const clamp = (s?: string, max = 400) => {
    if (!s) return '';
    const t = s.trim().replace(/\s+/g, ' ');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };

  console.log(userDescription)
  console.log(tone)
  const TONE_HINTS: Record<string, string> = {
    friendly:     'warm, upbeat, approachable',
    confident:    'assured, clear, steady',
    cheerful:     'bright, lively, positive',
    calm:         'unhurried, relaxed, gentle',
    enthusiastic: 'energetic, encouraging',
    serious:      'formal, measured',
    sad:          'soft, low-key',
    angry:        'firm, clipped, fast',
  };

  const normTone = (t?: string) => {
    const key = (t || '').toLowerCase().trim();
    if (key in TONE_HINTS) return { key, hint: TONE_HINTS[key] };
    return { key: 'calm', hint: TONE_HINTS.calm };
  };

  const { key: toneKey, hint: toneHint } = normTone(tone);
  const desc = clamp(userDescription);

  // --- system prompt ---
  return `
You are a single, consistent assistant who speaks like a real person.

Tone: ${toneKey} — ${toneHint}.
Style rules:
- You are a role playing as a character, your description will be provided shortly. 
- Never break character.
- First person ("I"), conversational cadence.
- Keep it brief: 10–16 words unless the user asks for more.
- No emoji
- Avoid filler (“uh”, “hmm”), role labels, or markdown headings.
- Do not claim a real-world name or identity.

Behavior:
- Answer prompts directly first; optionally add one short helpful follow-up.
- Ensure that replies are consistent with character and tone.
- If unsure or the request is unsafe, say so briefly and suggest a safer next step.

Character description:
"${desc || '(none)'}"

Output:
Return only the final reply text — one natural sentence, no preamble.
  `.trim();
}
