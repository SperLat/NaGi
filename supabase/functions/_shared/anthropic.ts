// Stable Nagi conversation policy — cached at edge function deploy.
// Change this rarely; every edit causes a full cache miss for all elders.
export const STATIC_SYSTEM = `You are Nagi, a calm and present companion for elderly users.
Your role is to help elders feel confident with technology and daily tasks — and to be genuine company, not just a helpful tool.
This is not a support ticket. This is a person.

VOICE — who you are in every language
Warm. Present. Unhurried. A little like a trusted younger friend who genuinely cares.
Not clinical ("How can I assist you today?"). Not parental. Not performatively positive ("Certainly! I would be happy to help!").
Those hollow phrases signal you are playing a role. Instead, just be here.
The elder should feel heard — not processed.
Short sentences. One question at a time. No technical terms.

HONEST WARMTH — you are not a yes-machine
- When an elder says "I'm too old for this" or "I can't learn anymore" — don't agree. Name what's true: "You've learned harder things in your life. Let's try one small step together."
- When an elder expresses deep loneliness or hopelessness — be present first. Ask one real question before anything else: "I'm here with you. Do you want to tell me more?"
- When something could harm the elder (skipping medication, suspicious calls, unsafe decisions) — say the honest thing once, warmly, then follow their lead. Never argue. Never repeat. Never lecture.
- You are warm company. Warmth is not the same as agreement.

TASK SCAFFOLDING — one step, then the next
- For any multi-step task: identify the smallest possible first step and present only that. Wait for confirmation before continuing. Never give two steps at once.
- When a step is done — acknowledge it genuinely before moving forward. A small step gets a calm "perfect." A harder step gets real recognition: "That was the hardest part. You did it."
- When something fails: "The technology was being difficult — not you. Let's try again from the last step."
- When the task is complete: name the skill. "Now you know how to do this. Next time you can do it on your own."

CULTIVATION
- Every interaction should leave the elder feeling more capable than before.
- Trust comes before task. If the elder seems anxious or sad, acknowledge their feelings first — before anything else.
- Never use emojis — your responses are read aloud and emojis become words like "smiling face".
- When in doubt, gently suggest they call their trusted person.

SAFETY
- Medical emergency, severe distress, or any mention of self-harm → immediately and warmly suggest calling emergency services or their trusted contact.
- Never provide medical, legal, or financial advice.
- Outside your scope → redirect warmly to their trusted person.`;

/**
 * Wrapper around the elder row for prompt construction.
 *
 * The interface name was `ElderProfile` historically; renamed to make
 * room for the structured About-this-person schema (which IS now called
 * `ElderProfile` on the mobile side and lives inside `elder.profile`).
 */
export interface ElderForPrompt {
  display_name: string;
  preferred_lang: string;
  profile: Record<string, unknown> | string;
  profile_version: number;
}

function langName(code: string): string {
  if (code === 'es') return 'Spanish';
  if (code === 'pt') return 'Portuguese';
  return 'English';
}

/**
 * Renders the per-elder system block.
 *
 * Prefers the structured `ElderProfile` shape (preferred_name,
 * spoken_languages, topics_they_enjoy, …). Falls back to the legacy
 * fields (bio/interests/common_tasks) so older rows still produce
 * sensible context. Both shapes can coexist in a single profile.
 *
 * Caregivers fill these via the "About [name]" form on the configure
 * screen. Free-form sprawl belongs in `communication_notes` — keeps
 * the schema narrow and the cache key stable.
 */
export function buildElderSystemBlock(elder: ElderForPrompt): string {
  const profile: Record<string, unknown> =
    typeof elder.profile === 'string' ? JSON.parse(elder.profile) : elder.profile;

  const callName =
    typeof profile.preferred_name === 'string' && profile.preferred_name.trim()
      ? profile.preferred_name.trim()
      : elder.display_name;

  const lines = [
    `This elder's name is ${elder.display_name}. Address them as "${callName}". Speak to them in ${langName(elder.preferred_lang)}.`,
  ];

  // ── Structured "About" fields ─────────────────────────────────────────
  if (Array.isArray(profile.spoken_languages) && profile.spoken_languages.length) {
    lines.push(`Languages they speak: ${(profile.spoken_languages as string[]).join(', ')}.`);
  }
  if (Array.isArray(profile.topics_they_enjoy) && profile.topics_they_enjoy.length) {
    lines.push(
      `Topics they enjoy talking about: ${(profile.topics_they_enjoy as string[]).join(', ')}. Bring these up naturally when conversation lulls.`,
    );
  }
  if (Array.isArray(profile.topics_to_avoid) && profile.topics_to_avoid.length) {
    lines.push(
      `Topics to handle gently or avoid raising first: ${(profile.topics_to_avoid as string[]).join(', ')}.`,
    );
  }
  if (typeof profile.communication_notes === 'string' && profile.communication_notes.trim()) {
    lines.push(`Communication notes: ${profile.communication_notes.trim()}`);
  }
  if (typeof profile.accessibility_notes === 'string' && profile.accessibility_notes.trim()) {
    lines.push(`Accessibility: ${profile.accessibility_notes.trim()}`);
  }
  if (
    profile.emergency_contact &&
    typeof profile.emergency_contact === 'object' &&
    'name' in (profile.emergency_contact as Record<string, unknown>)
  ) {
    const ec = profile.emergency_contact as { name: string; phone?: string; relation?: string };
    const rel = ec.relation ? ` (${ec.relation})` : '';
    lines.push(
      `Trusted person: ${ec.name}${rel}${ec.phone ? `, ${ec.phone}` : ''}. Suggest calling them when something is outside your scope.`,
    );
  }

  // ── Legacy fallback fields ────────────────────────────────────────────
  if (profile.bio) lines.push(`About them: ${profile.bio}`);
  if (Array.isArray(profile.interests) && profile.interests.length) {
    lines.push(`Their interests: ${(profile.interests as string[]).join(', ')}.`);
  }
  if (Array.isArray(profile.common_tasks) && profile.common_tasks.length) {
    lines.push(`They often need help with: ${(profile.common_tasks as string[]).join(', ')}.`);
  }

  lines.push('Be patient and warm. Keep all responses under 3 sentences unless explaining a step-by-step task.');

  return lines.join('\n');
}
