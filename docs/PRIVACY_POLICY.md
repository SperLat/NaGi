# Privacy Policy — Nagi

> **TEMPLATE for self-hosted deployments.** When you deploy Nagi for
> your own family or a small circle, this becomes *your* privacy policy
> after you fill in the `{{PLACEHOLDERS}}` and have local counsel
> review it. The reference text describes what Nagi as a system does
> with personal data — your customizations describe what you, the
> deployer, do with it.
>
> Cross-references:
> - [SELF_HOST_COMPLIANCE.md](./SELF_HOST_COMPLIANCE.md) — overall
>   deployment compliance kit.
> - `apps/mobile/src/features/privacy/policy-text.ts` — the constant
>   the in-app `/privacy` route renders. Edit to match your published
>   policy here.

**Last updated:** {{DATE_TO_FILL}}
**Effective date:** {{DATE_TO_FILL}}
**Data controller:** {{LEGAL_ENTITY_NAME}}, {{REGISTERED_ADDRESS}}
**Contact:** privacy@nagi.kas.vu

---

## What Nagi is

Nagi is an AI companion for elders, used together with the family members
who care for them. The product holds two surfaces:

- The **elder kiosk**, where the elder talks with Nagi about their day.
- The **family dashboard**, where caregivers see what they're allowed to
  see — never the substance of what the elder asked to keep private.

This policy describes the personal data Nagi processes about both
audiences and what choices each has.

## Who is the data subject

- The **caregiver** (you, when you sign in to the family dashboard).
- The **elder** (the loved one in your care). The elder is a separate
  data subject; the caregiver acts on their behalf. Where local law
  requires it, written authority from the elder is the caregiver's
  responsibility to obtain.

## What we collect

| Category | What | Where it goes |
|---|---|---|
| Caregiver account | email, password (hashed), display name | Supabase auth |
| Caregiver settings | device PIN (hashed), language, UI preferences | Supabase + browser local storage |
| Elder profile | display name, preferred language, communication notes, topics they enjoy / avoid / want kept private, optional medical context (medications, conditions, dietary notes) — all written by the caregiver | Supabase `elders.profile` |
| Elder conversations | every chat turn between elder and Nagi, with a private/non-private flag | Supabase `activity_log` |
| Pill reminders | label, schedule, and the elder's response (taken / skipped / pending) | Supabase `pill_reminders`, `pill_reminder_events` |
| Proud moments | small things the elder did, noticed, or shared. Source-tagged: from Nagi, from the caregiver, or from the elder. | Supabase `elder_moments` |
| Voice messages | original audio + transcribed text + automatic translation | Supabase `elder_messages` + `elder-voice-messages` storage bucket |
| Care-circle messages | text and voice notes between caregivers about a specific elder | Supabase `elder_team_messages` + `team-voice-notes` storage bucket |

## What we do NOT collect

- Payment information (the demo is free; and software is open source. We encourage you to build it at your own home/server to keep full control of data. if a paid tier ever launches, this list updates).
- Location, beyond what an IP address implies for routing.
- Social-network identifiers.
- Audio/video that wasn't deliberately recorded by the elder or caregiver.

## Why we process it (lawful basis)

- **Performance of contract** (GDPR Art. 6(1)(b)): the caregiver signs up
  and asks Nagi to act as an AI companion for their elder. We can't do
  that without the data above.
- **Legitimate interest** (Art. 6(1)(f)): security logging, abuse
  prevention, fraud detection, and the minimum operational telemetry
  (latency, error counts) we need to keep the service usable.
- **Consent** (Art. 6(1)(a)): voice recordings of the elder are processed
  on the basis of consent — given by either the elder directly or, where
  the elder cannot consent, by their authorized caregiver.

Special-category health data (medications, medical conditions when
provided in the profile) is processed on the basis of explicit consent
(Art. 9(2)(a)). Caregivers are responsible for not entering health data
beyond what the elder has agreed to share.

## How long we keep it

Today: **indefinitely**, until the caregiver requests deletion via the
"Delete my account" flow in Settings, or contacts privacy@nagi.kas.vu
for an elder-only deletion.

A retention schedule (e.g. chat history kept N years, voice clips kept
M months) is on the engineering roadmap. When implemented, this policy
will reflect concrete numbers.

## Who else sees the data (sub-processors)

See [SUB_PROCESSORS.md](./SUB_PROCESSORS.md) for the full list with
contracts, locations, and lawful-transfer mechanisms. This applies for ongoing demo
but could serve as guidelines for non self hosted builds. In summary:

- **Supabase** (US, EU options) — database + auth + storage + edge functions.
- **Anthropic** (US) — the Claude model that powers Nagi's responses.
- **Cloudflare** (US, global edge) — TLS termination + DDoS protection.
- **Self-hosted Whisper** (EU, Netcup via Coolify) — transcription of
  voice messages.

International transfers to US-based sub-processors rely on the Standard
Contractual Clauses (SCCs) in each provider's Data Processing Addendum.

## Your rights

You can exercise any of these rights at any time, via the Settings
screen or by emailing privacy@nagi.kas.vu:

- **Access** (Art. 15) — see what we hold about you. Click "Download my
  data" in Settings.
- **Rectification** (Art. 16) — correct inaccurate data. Edit any field
  in Configure / Settings.
- **Erasure** (Art. 17) — delete your account and all your personal
  data. Click "Delete my account" in Settings.
- **Restriction** (Art. 18) — pause processing while you challenge it.
  Email us.
- **Portability** (Art. 20) — get your data in a machine-readable
  format. The "Download my data" export is a single JSON bundle.
- **Objection** (Art. 21) — object to processing based on legitimate
  interest. Email us.
- **Lodge a complaint** with your local supervisory authority. If you're
  in the EU/EEA, that's your country's data protection authority.

## Children

Nagi is for adults. Caregivers are 18+. The elder is, by the nature of
the product, also an adult. We do not knowingly collect data about
people under 16.

## How we secure it

- HTTPS everywhere (TLS 1.2+).
- Supabase Postgres with row-level security: every row carries an
  organization id, every read/write is filtered by it. Cross-org reads
  are blocked at the database layer.
- Encryption at rest (Supabase default).
- Hashed PINs (SHA-256 with per-record salt) for kiosk and device locks.
- Private storage buckets for voice clips. Playback URLs are signed for
  5 minutes and minted by a function that re-checks org membership.
- Voice-transcription requests are gated behind a shared secret header
  on the Whisper proxy.

We will tell you about a personal-data breach affecting your account
without undue delay, and within 72 hours where the law requires it.

## Changes to this policy

We update this document as the product changes. The "Last updated" date
at the top reflects the most recent change. Material changes will be
surfaced in the Settings screen.

## Contact

privacy@nagi.kas.vu — any of the rights above, complaints, or general
questions. We aim to respond within 14 days.

For the data protection officer (where appointed):
{{DPO_NAME_OR_PROVIDER}} — {{DPO_EMAIL}}.
