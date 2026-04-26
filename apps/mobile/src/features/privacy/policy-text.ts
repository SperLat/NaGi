// In-app privacy policy text. Sourced from docs/PRIVACY_POLICY.md but
// hardcoded here so the route can render without a network fetch and
// without a markdown parser dependency.
//
// ── SELF-HOSTERS: this is your customization point ──────────────────
// When you deploy your own Nagi, replace the string below with your
// deployment's own privacy policy. Keep the section-heading shape
// (lines starting with `# `) so the renderer can split + style; the
// content of every section is yours to rewrite. The published doc
// at docs/PRIVACY_POLICY.md is the long-form template you can adapt.
// ────────────────────────────────────────────────────────────────────
//
// Headings use # markers so the renderer can split on '\n# ' and style
// the leading line per section. This keeps formatting on web AND native
// without pulling in a markdown library.

export const PRIVACY_POLICY_TEXT = `# Privacy at Nagi (demo notice)
This is the public demo of Nagi at nagi.kas.vu. It exists to show what
the product does, not as a production SaaS. If you want to use Nagi
with real elder data, the brand-aligned move is to self-host: the code
is open source, deployment is documented, and full data sovereignty
stays with you. See docs/SELF_HOST_COMPLIANCE.md in the repo for the
deployment compliance kit.

That said, even for the demo, here's what's true.

# What this demo holds about you
- Caregiver account: email, password (hashed), display name.
- Settings: device PIN (hashed), language, UI preferences.
- Elder profile: name, language, notes, optional medical context — all
  written by the caregiver.
- Conversations: every chat turn, with a private flag the elder
  controls.
- Pill reminders, proud moments, voice messages, care-circle posts,
  help requests.

# What this demo does NOT hold
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

# A practical note for the demo
This is a small public service. We're transparent about the stack and
the sub-processors above. We are not a regulated SaaS — if your needs
include EU data residency, signed DPAs, a designated DPO, or formal
records of processing, the right path is to deploy your own Nagi at
home or on your own server. The repo's docs/SELF_HOST_COMPLIANCE.md
walks you through what becoming the controller for your own deployment
involves.

# Children
Nagi is for adults caring for adult elders. We do not knowingly collect
data about people under 16.

# Contact
privacy@nagi.kas.vu — we aim to respond within 14 days.

# Last updated
2026-04-26.`;
