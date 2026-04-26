# Self-host Compliance Kit

> **Read this if you're deploying Nagi for your own family or a small
> circle.** When you stand up your own Nagi, you become the data
> controller for the people whose data lives in it. This document is
> your starter kit for doing that responsibly.

This is engineering's hand-off to deployment. It is not legal advice.
For anything that touches a regulated jurisdiction (EU/EEA, UK,
California, Brazil, etc.), have a local counsel review the documents
referenced here before you publish them.

---

## What you are taking on

Running Nagi at your home server processes personal data — likely
including health-adjacent context about elders. In most data protection
regimes that makes you the **controller**:

- You decide *what* gets processed.
- You sign DPAs with the sub-processors you choose.
- You answer to data subjects (yourself, your family members, the elders
  in your care) when they exercise their rights.
- You notify the supervisory authority if there's a breach.

Nagi gives you the engineering primitives. The decisions and paperwork
are yours.

## The four documents in this folder

When you deploy, you'll customize these and publish them where your
users (family members) can find them.

| File | Audience | Purpose | What you do |
|---|---|---|---|
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) | end users (caregivers + elders) | Public privacy policy | Replace `{{PLACEHOLDERS}}`, publish at `/privacy` in the app and on your hosting page. The constant in `apps/mobile/src/features/privacy/policy-text.ts` is what the in-app `/privacy` route renders — edit it to match your published version. |
| [RECORDS_OF_PROCESSING.md](./RECORDS_OF_PROCESSING.md) | internal — auditors, counsel | Art. 30 record | Replace `{{PLACEHOLDERS}}`, keep updated whenever you add a sub-processor or processing activity. Not user-facing. |
| [BREACH_NOTIFICATION_RUNBOOK.md](./BREACH_NOTIFICATION_RUNBOOK.md) | engineering on-call + counsel | Art. 33/34 procedure | Replace `{{PLACEHOLDERS}}`, run a tabletop drill before going live with real users. |
| [SUB_PROCESSORS.md](./SUB_PROCESSORS.md) | end users (linked from policy) | Disclosure of who handles data | Mirrors your actual deployment choices — Anthropic vs self-hosted LLM, Cloudflare vs none, etc. |

## Choices you'll make at deploy time

The reference deployment (`nagi.kas.vu`) uses a specific stack. Your
deployment can match it or diverge. Each choice changes your privacy
policy + sub-processors list.

### LLM provider

- **Anthropic Claude (default).** US-based. Sign their DPA + SCCs. They
  do not train on inputs/outputs per their commercial terms. Document
  this in `SUB_PROCESSORS.md`.
- **Self-hosted alternative.** Llama / Qwen / Mistral on your own GPU.
  No external sub-processor; remove Anthropic from the list. Note that
  brand voice / quality differs from the reference deployment.

### Database + auth + storage

- **Supabase Cloud (default).** Choose the EU region (`eu-west-1`,
  `eu-central-1`, etc.) to keep data in-EEA. Sign Supabase DPA.
- **Self-hosted Supabase.** No transfer; you're the only host. Removes
  Supabase from the sub-processor list; you're directly responsible
  for backups, encryption-at-rest, and patching.

### Edge / TLS

- **Cloudflare (default).** US edge, global. SCCs apply. Keep in
  sub-processor list.
- **Direct exposure via Caddy.** No CDN sub-processor; you handle
  DDoS yourself.

### Voice transcription

- **Self-hosted Whisper (default reference).** EU-based per the demo's
  Netcup host. No sub-processor outside your control.
- **OpenAI Whisper API.** US-based, gets sent every voice clip. Add to
  sub-processor list. Note: brand stance suggests keeping voice on
  your own infra — the elder's voice is the warmth, not training data.

### Translation

- **Anthropic (default).** Same DPA as for chat.
- **LibreTranslate self-hosted.** No sub-processor outside your control.
  Quality is rougher on idiom and warmth.

## Deployment checklist

Before you let anyone outside your household near your Nagi instance:

- [ ] Filled `{{PLACEHOLDERS}}` in all four documents above.
- [ ] Edited `apps/mobile/src/features/privacy/policy-text.ts` to mirror
      your published privacy policy.
- [ ] Signed DPAs with each sub-processor you actually use.
- [ ] Configured Supabase region to match where your users live.
- [ ] Set the contact email in the privacy policy + on your hosting
      page (default `privacy@nagi.kas.vu` works only for the reference
      demo; you need your own).
- [ ] Tested the in-product **Download my data** button — confirm it
      returns a JSON bundle for your account.
- [ ] Tested the in-product **Delete my account** button on a throwaway
      account — confirm cascade-deletes the row tree.
- [ ] Added your own contact path (email or form) for restriction /
      objection requests, since those don't have a self-serve UI.
- [ ] Run one tabletop breach-response drill using the runbook, even
      if it's just you reading it aloud while sipping coffee.
- [ ] If you operate at any scale beyond your own household: appoint a
      DPO (or contract a fractional one) and conduct a DPIA. Health data
      of elders triggers Art. 35.

## Subject-rights handling, day-to-day

Each right + the engineering surface that handles it:

| Right | UI path | Code path |
|---|---|---|
| Access (Art. 15) | Settings → Download my data | `supabase/functions/export-my-data` |
| Rectification (Art. 16) | Configure / Settings | direct UPDATE via UI |
| Erasure (Art. 17) | Settings → Delete my account | `supabase/functions/delete-my-account` |
| Portability (Art. 20) | Settings → Download my data | same as Access |
| Restriction (Art. 18) | email | manual flag, no UI yet |
| Objection (Art. 21) | email | manual review, deletion if granted |

For requests that come in by email rather than self-serve, log them in
your incident/request ledger with date received, user identifier,
nature of request, action taken, and date closed. Plain markdown is fine.

## Retention

Today: indefinite. Cedar v1 doesn't ship a retention cron. If you want
to enforce a retention policy:

- Add a Supabase scheduled function (`pg_cron`) that prunes
  `activity_log` and `elder_messages` older than your chosen window
  (24 months is common; private turns might warrant shorter).
- Document the schedule in your `RECORDS_OF_PROCESSING.md`.
- Disclose the retention period in your privacy policy.

A reference implementation may ship in a future Cedar release. For now
it's deployer-discretion.

## When you change something

Any change to your processing — new sub-processor, different region,
new feature that captures a new category of data — should:

1. Update the four documents in this folder.
2. Update the in-app `policy-text.ts` if it's user-visible.
3. Notify your existing users (30 days for sub-processor changes is
   the conventional norm; consult counsel for your jurisdiction).
4. Update the privacy notice's "Last updated" date.

## When in doubt

The Cedar / Nagi philosophy: *honest beats theatrical*. If you're
uncertain whether a behavior is compliant, the answer is to be more
transparent about it, not less. The brand voice in `docs/BRAND.md`
applies to compliance text just as much as elder-facing copy.
