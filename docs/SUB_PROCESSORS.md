# Sub-processors

> **TEMPLATE for self-hosted deployments.** When you deploy Nagi, this
> becomes *your* sub-processor disclosure — public, mirrored in your
> privacy policy, kept honest with what your deployment actually uses.
>
> The first section below documents the **reference deployment** at
> nagi.kas.vu. The second documents what changes if you self-host with
> different stack choices. Pick the entries that match your reality
> and delete the rest before publishing.
>
> Cross-reference: [SELF_HOST_COMPLIANCE.md](./SELF_HOST_COMPLIANCE.md)
> for the deployment-choice menu that drives this list.

**Last updated:** {{DATE_TO_FILL}}
**Notice channel:** caregivers signed up to {{NOTIFICATION_LIST_OR_EMAIL_LIST}}
get email notice at least 30 days before a new sub-processor is engaged.

---

## Reference deployment (nagi.kas.vu)

This section describes what the public reference deployment uses. If
you self-host, your real list lives in the next section — adjust there
and delete what doesn't apply to you.

### Supabase (Inc.)

- **What:** managed Postgres + auth + storage + edge functions runtime.
- **Personal data they hold:** all of it. Caregiver accounts, elder
  profiles, conversations, moments, voice clips, care-circle messages.
- **Region:** {{SUPABASE_REGION — e.g. us-east-1}}.
- **Sub-processor's own sub-processors:** AWS for infrastructure.
- **DPA:** signed via Supabase Trust Center: https://supabase.com/legal/dpa
- **Transfer mechanism:** if region is outside the EEA, Standard
  Contractual Clauses included in Supabase's DPA.
- **Security certifications:** SOC 2 Type II.

### Anthropic, PBC

- **What:** Claude AI model that powers Nagi's chat responses,
  digest narrative, and elder-to-elder voice translation.
- **Personal data they hold:** the contents of each chat turn (text)
  and the elder profile that's included in Nagi's system prompt for
  that turn. Voice messages reach Anthropic only as already-transcribed
  text. **Inputs and outputs are not used for model training**, per
  Anthropic's commercial terms.
- **Region:** US.
- **DPA:** signed via Anthropic Commercial Agreement +
  https://www.anthropic.com/legal/dpa
- **Transfer mechanism:** Standard Contractual Clauses.
- **Security certifications:** SOC 2 Type II.

### Cloudflare, Inc.

- **What:** TLS termination + DDoS protection + edge caching for
  nagi.kas.vu.
- **Personal data they handle:** transient — request metadata
  (IP, headers, URL) for routing. Bodies are decrypted at the edge for
  TLS but not retained.
- **Region:** global edge; primary processing US.
- **DPA:** Cloudflare standard DPA — https://www.cloudflare.com/cloudflare-customer-dpa/
- **Transfer mechanism:** Standard Contractual Clauses.
- **Security certifications:** SOC 2, ISO 27001.

### Self-hosted Whisper (via {{HOST_PROVIDER — e.g. Netcup / Coolify}})

- **What:** speech-to-text for elder-to-elder voice messages. The audio
  bytes are POSTed to a private endpoint on this host; the transcribed
  text returns and the audio file is stored in our own Supabase bucket.
- **Personal data they handle:** audio bytes during the transcription
  request. The container does not log or persist audio after the
  request returns.
- **Region:** {{NETCUP_REGION — e.g. Germany}}.
- **DPA:** {{HOST_PROVIDER_DPA_LINK}}.
- **Transfer mechanism:** within the EEA — no SCCs needed.
- **Security:** the `/asr` endpoint is gated behind the
  `X-Whisper-Auth` shared-secret header; only the Cedar edge functions
  hold the secret. The container itself is the Apache-2.0
  openai-whisper-asr-webservice image; we control the deployment.

### {{ADDITIONAL_PROCESSORS — fill if any}}

For example: email delivery (if Postmark / Resend is added),
analytics (if PostHog is added), error monitoring (if Sentry is added).

---

## Self-hosted deployment — your choices

If you're running your own Nagi instance, your sub-processor list
depends on which stack pieces you outsource vs run yourself. Each
choice in [SELF_HOST_COMPLIANCE.md → "Choices you'll make at deploy
time"](./SELF_HOST_COMPLIANCE.md) drives an entry here.

**Common paths:**

- **All-in-EEA, mostly-self-hosted.** You run Supabase yourself,
  Anthropic stays on the list (or you swap for self-hosted LLM and
  remove it), Cloudflare optional, Whisper self-hosted. Result: 0–2
  external sub-processors.
- **Hosted-Supabase EU + Anthropic.** Quickest deploy, two
  sub-processors (Supabase EU region + Anthropic US). Both have SCCs
  in their DPAs.
- **Local-only.** No external network. Useful for testing or single-
  family deployment with full data sovereignty. Empty sub-processor
  list. The privacy policy still applies, just with no transfer
  section.

For each entry you keep:

- Confirm the region.
- Sign the DPA + ensure SCCs are included if data leaves your
  jurisdiction.
- Document any sub-sub-processors (e.g. AWS underneath Supabase) if
  your jurisdiction's regulator expects that level of detail.
- Note the retention practices the sub-processor enforces (Anthropic's
  no-training-on-inputs commitment, Supabase log retention windows,
  etc.).

When you change a sub-processor, your existing users get 30 days'
notice via the channel established in your privacy policy.

---

## Sub-processors we have considered and explicitly NOT engaged

This section establishes negative facts that may matter to a privacy-
conscious caregiver:

- **No advertising or marketing trackers.**
- **No social-network pixels.**
- **No third-party LLM other than Anthropic.** Specifically: no OpenAI,
  no Google, no Meta.
- **No public Whisper API.** All voice transcription stays on the
  self-hosted endpoint listed above.
- **No third-party analytics product** (Mixpanel, Amplitude, Segment,
  PostHog, etc.) at the time of this document.

If any of these change, the change is announced 30 days in advance via
the notice channel above.

---

## Internal sub-processor change procedure

Engineering must:

1. Open a PR titled `chore(privacy): add sub-processor {{name}}`.
2. Update this file + the Privacy Policy in the same commit.
3. Tag {{LEGAL_OR_FOUNDER}} for sign-off.
4. Send the 30-day notice email before the sub-processor is configured
   in production.

A sub-processor configured before this procedure completes is a
process violation — block the deploy.
