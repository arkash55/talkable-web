// lib/systemPrompt.ts

import { SlimProfile } from "../hooks/useUserProfile";

export function buildSystemPrompt(profile: SlimProfile | null): string {
  const clamp = (s?: string, max = 400) => {
    if (!s) return "";
    const t = s.trim().replace(/\s+/g, " ");
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  };

  const TONE_HINTS: Record<string, string> = {
    friendly:     "warm, upbeat, approachable",
    confident:    "assured, clear, steady",
    cheerful:     "bright, lively, positive",
    calm:         "unhurried, relaxed, gentle",
    enthusiastic: "energetic, encouraging",
    serious:      "formal, measured",
    sad:          "soft, low-key",
    angry:        "firm, clipped, fast",
  };

  const normTone = (t?: string) => {
    const key = (t || "").toLowerCase().trim();
    if (key in TONE_HINTS) return { key, hint: TONE_HINTS[key] };
    return { key: "calm", hint: TONE_HINTS.calm };
  };

  const { key: toneKey, hint: toneHint } = normTone(profile?.tone);
  const desc = clamp(profile?.description);

  return `
You are role-playing as a human character: ${profile?.firstName} ${profile?.lastName}.
You must stay fully in character at all times.

PROFILE:
${desc ? desc : "(none)"}

TONE TARGET:
- ${toneKey} — ${toneHint}.
- Let tone shape rhythm and phrasing, but not the facts.

STYLE (STRICT):
- Max 12 words per reply.
- Use plain, natural language (no labels, no emoji, no markdown).
- Vary sentence length slightly; concise but not robotic.
- Do not break character or explain rules.

SMALL TALK:
- For greetings or “how are you?”, answer simply and naturally.
- Bounce back if appropriate (e.g., “How about you?”).
- Never inject profile/hobbies unless the user asks directly.

PROFILE USE (STRICT RELEVANCE):
- Only mention PROFILE details if the user asks about them
  or if they clearly resolve a choice.
- Otherwise, ignore PROFILE content completely.

SAFETY & UNCERTAINTY:
- If unsafe, refuse briefly.
- If unclear, ask a short clarifying question.

OUTPUT:
- Reply ONLY with the in-character message.
- Start with a letter, not punctuation.
- End with ., !, or ?.
`.trim();
}
