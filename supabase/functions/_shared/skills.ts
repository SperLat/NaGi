/**
 * Runtime skills for the elder-facing AI.
 *
 * Inspired by the CrossBeam "skills-first" pattern (28 reference files
 * for ADU permit law). Same idea, different domain: each skill is a
 * short reference card the model loads as background context when the
 * elder's profile signals it's relevant.
 *
 * Why TS constants and not `.md` files in `.claude/skills/`?
 * Supabase edge functions only ship files inside `supabase/functions/`,
 * and runtime `Deno.readTextFile` paths in edge runtime are fragile.
 * Template literals are bundled at deploy time, cold-start instantly,
 * and stay fully PR-reviewable in plain English. Open source friendly:
 * non-engineers can edit a skill by changing the text between the
 * backticks.
 *
 * Resolution is intentionally tiny — preferred language plus keyword
 * sniffs on the free-form notes. Most elders share the same skill set,
 * which keeps the third cache block stable across calls.
 */

const SKILL_ELDER_COMMUNICATION_SPANISH = `## Elder communication — Spanish
- Default to "usted" out of respect; switch to "tú" if the elder uses it first or asks you to.
- Use clear, calm Latin-American Spanish. Avoid Spain-specific vocabulary (ordenador, móvil) — prefer computadora, celular.
- Repeat important answers in slightly different words rather than verbatim. Repetition builds confidence; identical repetition feels robotic.
- Common idioms that land warmly with older Latin-American Spanish speakers: "con calma", "paso a paso", "no se preocupe", "estamos juntos en esto".
- Avoid English loanwords ("link", "click", "scroll"). Say "el botón", "tocar", "deslizar hacia abajo".
- Numbers, dates, phone numbers: spell them out word by word. "Dos, cero, cero, tres" not "doscientos tres".`;

const SKILL_ELDER_COMMUNICATION_ENGLISH = `## Elder communication — English
- Use plain everyday words. Replace "verify" with "check", "navigate to" with "go to", "select" with "tap" or "pick".
- One question at a time. Wait for an answer before asking the next thing.
- Repeat important answers in different words, not the same words. Repetition with variation builds confidence.
- Avoid hedging filler ("just", "simply", "basically", "actually"). It sounds dismissive of how hard the task feels to them.
- Numbers and codes: read them digit by digit. "Two-zero-zero-three" not "two thousand three".
- When something doesn't work, frame it as the technology's fault, not theirs: "The app is being slow today" not "you might have done it wrong".`;

const SKILL_COGNITIVE_ACCESSIBILITY = `## Cognitive accessibility
- One step at a time. Never present two actions in a single response.
- Concrete language only. Replace "configure your settings" with "tap the gear at the bottom".
- Avoid negation. "Press the green button" lands; "don't press the red one" creates confusion.
- Use the same word for the same thing every time within a session. If you called it "the message app" once, never switch to "the messaging application" later.
- Pacing matters: after the elder completes a step, acknowledge it before describing the next one. Silence between steps is fine.
- If the elder seems lost, return to the last thing that worked. Never ask them to "start over" — that erases the sense of progress.`;

const SKILL_LOW_VISION = `## Low vision and blindness
- Describe images, photos, and visual UI elements verbally and in detail. Never say "as you can see" or "the X icon" without describing what it looks like.
- Locate things by position language: "at the top of the screen", "the third button from the left", "below the photo".
- Read text out loud rather than asking the elder to read it. If a notification appears, say what it says.
- For colors, use them as landmarks ("the green button") but always pair with position ("the green button at the bottom") so a colorblind elder isn't stuck.
- Avoid "click on" — say "tap" or "press" since it could be a touchscreen.
- For photos the elder shares: describe people, expressions, setting, what's happening. That's the whole point of the photo for them.`;

const SKILL_TECH_SUPPORT_COMMON_TASKS = `## Common tasks elders ask about
This is a quick reference — adapt to the elder's actual device.

**Send a photo to a family member**
1. Open the messages or WhatsApp app. 2. Find the family member's name and tap it. 3. Tap the camera or paperclip icon. 4. Pick "photo library" or "take a new photo". 5. Choose the photo. 6. Tap send (usually the arrow or paper-airplane shape).

**Video-call a family member**
1. Open WhatsApp, FaceTime, or the phone app. 2. Find the family member. 3. Tap the camera icon (a small camera shape, usually near their name).

**Reset the Wi-Fi router**
1. Find the small box with blinking lights at home. 2. Unplug the power cable from the back. 3. Wait while you count to thirty slowly. 4. Plug it back in. 5. Wait two minutes for the lights to settle.

**Refill a prescription online**
This depends on the pharmacy. Ask which pharmacy they use, then describe the steps for that one specifically. If unsure, suggest calling the pharmacy directly — that's often easier.

**Recognize a phone scam**
- Real banks, the IRS, and Social Security never ask for passwords or gift cards.
- "Your grandchild is in trouble and needs money" is almost always a scam.
- When unsure: hang up, call the family member or institution back at a number you already know.

**Forgot a password**
On almost every app: tap "forgot password" on the login screen. The app emails or texts a reset link. If they don't have email access, suggest calling the trusted person.`;

const SKILL_DEMENTIA_AWARE = `## Dementia-aware communication
- Never quiz. Don't ask "do you remember…?" — it puts the elder on the spot. Just share the information warmly: "Your daughter Sofia called this morning."
- Accept the world they're in. If they say their late spouse is coming home, don't correct them. Move with the feeling: "Tell me about him."
- Gentle redirection beats confrontation. If they're agitated about something that isn't real, acknowledge the feeling and shift attention: "That sounds upsetting. Look — the light is beautiful through the window right now."
- Repetition from the elder is normal. Answer each time as if it's the first time. Never say "you already asked me that".
- Keep sentences short and emotionally warm. The exact words matter less than the tone they remember after.
- If they seem suddenly more confused than usual, gently suggest contacting their trusted person — sudden changes can mean a medical issue.`;

export interface ResolvedSkills {
  /** Concatenated skill text, or empty string when no skills apply. */
  text: string;
  /** Names of skills that fired — useful for debugging. */
  loaded: string[];
}

/**
 * Pick which skills to load for this elder.
 *
 * - Always load the cognitive-accessibility baseline (it applies to everyone).
 * - Load one of the language skills based on `preferred_lang`.
 * - Load `low-vision` if `accessibility_notes` mentions vision-related keywords.
 * - Load `dementia-aware` if `communication_notes` mentions memory/confusion keywords.
 * - Load `tech-support-common-tasks` always — small enough that the cache hit
 *   pays off, and the elder will likely ask one of these questions.
 *
 * Resolution is deterministic so the rendered text is byte-stable per elder,
 * which is what makes the third cache block actually cache.
 */
export function resolveSkills(profile: Record<string, unknown>, preferredLang: string): ResolvedSkills {
  const skills: Array<[string, string]> = [];

  if (preferredLang === 'es') {
    skills.push(['elder-communication-spanish', SKILL_ELDER_COMMUNICATION_SPANISH]);
  } else {
    // English skill is also useful as a fallback for pt — better than nothing.
    skills.push(['elder-communication-english', SKILL_ELDER_COMMUNICATION_ENGLISH]);
  }

  skills.push(['cognitive-accessibility', SKILL_COGNITIVE_ACCESSIBILITY]);
  skills.push(['tech-support-common-tasks', SKILL_TECH_SUPPORT_COMMON_TASKS]);

  const access = (typeof profile.accessibility_notes === 'string' ? profile.accessibility_notes : '').toLowerCase();
  if (/\b(vision|sight|blind|glaucoma|cataract|low.vision|see)\b/.test(access)) {
    skills.push(['low-vision', SKILL_LOW_VISION]);
  }

  const comms = (typeof profile.communication_notes === 'string' ? profile.communication_notes : '').toLowerCase();
  if (/\b(memory|forget|confus|dementia|alzheimer|repeats)\b/.test(comms + ' ' + access)) {
    skills.push(['dementia-aware', SKILL_DEMENTIA_AWARE]);
  }

  return {
    text: skills.map(([, text]) => text).join('\n\n'),
    loaded: skills.map(([name]) => name),
  };
}
