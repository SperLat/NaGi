// In-app privacy policy text. Sourced from docs/PRIVACY_POLICY.md but
// hardcoded here so the route can render without a network fetch and
// without a markdown parser dependency. When the canonical doc changes,
// update this string in the same commit.
//
// Headings use # markers so the renderer can split on '\n# ' and style
// the leading line per section. This keeps formatting on web AND native
// without pulling in a markdown library.

export const PRIVACY_POLICY_TEXT = `# Privacy at Nagi
This is the short version. The full text — including legal basis,
sub-processor list, and your rights — is in our public docs at
docs/PRIVACY_POLICY.md.

# What Nagi holds about you
- Caregiver account: email, password (hashed), display name.
- Settings: device PIN (hashed), language, UI preferences.
- Elder profile: name, language, notes, optional medical context — all
  written by the caregiver.
- Conversations: every chat turn, with a private flag the elder
  controls.
- Pill reminders, proud moments, voice messages, care-circle posts,
  help requests.

# What Nagi does NOT hold
- No payment data.
- No advertising or analytics trackers.
- No social-network pixels.
- No third-party LLM beyond Anthropic.

# Where it goes
- Supabase: database, auth, storage.
- Anthropic: the Claude model that powers Nagi's responses. Inputs and
  outputs are not used for model training.
- Cloudflare: TLS termination at the edge.
- Self-hosted Whisper: voice-message transcription.

# Your rights
You can do all of these from Settings or by emailing
privacy@nagi.kas.vu:
- Download everything Nagi holds about you (right to portability).
- Delete your account (right to erasure).
- Edit any field (right to rectification).
- Object, restrict, lodge a complaint with your supervisory authority.

# Storage on your device
Nagi stores essential session data on your device:
- Your auth session token (so you stay signed in).
- Your device PIN hash (so the kiosk lock works).
- The walkthrough-seen flag (so the tour doesn't fire every visit).
That's it. No advertising cookies. No tracking pixels.

# Children
Nagi is for adults caring for adult elders. We do not knowingly collect
data about people under 16.

# Contact
privacy@nagi.kas.vu — we aim to respond within 14 days.

# Last updated
2026-04-26 — DRAFT pending legal review.`;
