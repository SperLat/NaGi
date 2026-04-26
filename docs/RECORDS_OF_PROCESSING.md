# Records of Processing Activities (RoPA)

> **TEMPLATE for self-hosted deployments.** When you deploy Nagi, this
> becomes *your* Art. 30 record after you fill in the `{{PLACEHOLDERS}}`.
> Internal-only document — your auditors and counsel read it; users
> don't. Update whenever a new processing activity, sub-processor, or
> category of data is added.
>
> Cross-references: [SELF_HOST_COMPLIANCE.md](./SELF_HOST_COMPLIANCE.md)
> for the bigger picture, [SUB_PROCESSORS.md](./SUB_PROCESSORS.md) for
> the canonical list referenced here.

**Last updated:** {{DATE_TO_FILL}}
**Maintained by:** {{NAME}} ({{ROLE}})

---

## 1. Controller

| Field | Value |
|---|---|
| Legal entity | {{LEGAL_ENTITY_NAME}} |
| Registered address | {{REGISTERED_ADDRESS}} |
| Country of establishment | {{COUNTRY}} |
| Representative in EU (if non-EU) | {{NAME_OR_N/A}} |
| Data Protection Officer | {{DPO_NAME_OR_NOT_APPOINTED}} |
| Contact | privacy@nagi.kas.vu |

## 2. Processing activities

### 2.1 Caregiver account management

- **Purpose:** authenticate caregivers, restore sessions, recover
  forgotten credentials, attribute actions in the care circle.
- **Lawful basis:** Art. 6(1)(b) performance of contract.
- **Categories of data subjects:** caregivers (adult family members of
  elders).
- **Categories of personal data:** email, password hash, JWT, display
  name, preferred language, device PIN hash + salt, IP (transient log).
- **Recipients:** Supabase Auth, Cloudflare (TLS termination).
- **Storage location:** Supabase Postgres in {{REGION}}.
- **Retention:** until account deletion via Settings or written request.
- **Security:** TLS, password hashing via Supabase auth (bcrypt by
  default in GoTrue), RLS enforcement on every read.
- **Cross-border transfer:** if Supabase project is in us-east-1, US
  transfer; relies on SCCs in Supabase DPA.

### 2.2 Elder profile management

- **Purpose:** allow Nagi to address the elder warmly and respect their
  stated preferences and boundaries.
- **Lawful basis:** Art. 6(1)(b) for non-health data; Art. 9(2)(a)
  explicit consent for any health context entered by the caregiver.
- **Categories of data subjects:** elders.
- **Categories of personal data:** display name, preferred language,
  communication notes, topics enjoyed / avoided / kept private, optional
  medications and medical conditions, optional dietary notes, mood
  baseline, accessibility notes.
- **Recipients:** Supabase Postgres, Anthropic (the elder profile is
  embedded in Nagi's system prompt at chat time).
- **Storage location:** Supabase Postgres in {{REGION}}; transient
  through Anthropic API for inference.
- **Retention:** until elder is deleted by caregiver or admin request.
- **Security:** RLS scoped to org; profile JSONB is service-role-readable
  for prompt construction only via the `ai-chat` edge function.
- **Cross-border transfer:** Anthropic processes in US; SCCs in
  Anthropic Commercial Terms / Data Processing Addendum.

### 2.3 Elder conversations with Nagi

- **Purpose:** provide the AI companion experience, recall earlier
  conversations within the same elder's history, allow caregivers to
  review (non-private) chat for wellbeing.
- **Lawful basis:** Art. 6(1)(b); Art. 9(2)(a) for any health-substance
  the elder volunteers.
- **Categories of data subjects:** elders.
- **Categories of personal data:** every chat turn (text), with a
  private/non-private flag set by the elder via trigger phrases or
  profile-configured private topics.
- **Recipients:** Supabase, Anthropic.
- **Storage location:** Supabase `activity_log` in {{REGION}};
  transient through Anthropic.
- **Retention:** indefinite v1; planned policy: 24 months unless
  caregiver opts in to longer.
- **Security:** RLS, private/public flag enforced by digest pipeline
  (private substance never reaches caregiver-visible aggregates).
- **Cross-border transfer:** US (Anthropic).

### 2.4 Pill reminders + events

- **Purpose:** allow caregivers to set medication-time reminders the
  elder sees on the kiosk; track elder's response (taken / skipped /
  snoozed) for digest narrative.
- **Lawful basis:** Art. 6(1)(b); Art. 9(2)(a) for medication labels.
- **Data subjects:** elders.
- **Categories:** medication label (free text), schedule, day-of-week
  rules, response status, snooze timestamps.
- **Recipients:** Supabase only.
- **Storage location:** Supabase in {{REGION}}.
- **Retention:** indefinite v1.
- **Security:** RLS scoped to org.

### 2.5 Proud moments

- **Purpose:** surface a positive growth log of small things the elder
  did, noticed, or shared. Powers the digest's narrative texture and
  the monthly summary.
- **Lawful basis:** Art. 6(1)(b); explicit elder consent (the elder
  shares the moment to Nagi knowingly).
- **Data subjects:** elders.
- **Categories:** body text, kind tag, occurred-on date, source
  (elder / caregiver / Nagi), private flag.
- **Recipients:** Supabase, Anthropic (for digest generation).
- **Storage location:** Supabase, transient Anthropic.
- **Retention:** indefinite v1.

### 2.6 Cross-tenant elder messaging

- **Purpose:** allow elders in different families to exchange short
  messages, optionally voice, with automatic translation.
- **Lawful basis:** Art. 6(1)(a) consent — both orgs' caregivers
  accepted the connection on behalf of their elder.
- **Data subjects:** both elders + the caregivers who proposed and
  accepted.
- **Categories:** text body, optional original-audio file, source
  language, cached translations per language code.
- **Recipients:** Supabase, Anthropic (translation), self-hosted Whisper
  (transcription).
- **Storage:** Supabase + private storage bucket.
- **Retention:** indefinite v1; deletion of the connection cascades.
- **Cross-border transfer:** US for Anthropic; self-hosted Whisper
  region depends on Coolify host (currently EU per Netcup).

### 2.7 Care-circle messaging

- **Purpose:** caregivers coordinate about a specific elder via text
  and voice notes (not seen by the elder).
- **Lawful basis:** Art. 6(1)(b).
- **Data subjects:** caregivers (text), elder mentioned by context.
- **Recipients:** Supabase only (no LLM, no translation).
- **Storage:** Supabase + private team-voice-notes bucket.
- **Retention:** indefinite v1.

### 2.8 Help requests

- **Purpose:** elder taps "Need help" → caregivers receive a real-time
  alert and acknowledge.
- **Lawful basis:** Art. 6(1)(b).
- **Data subjects:** elder, acknowledging caregiver.
- **Categories:** elder id, status, timestamps, acknowledger user id.
- **Recipients:** Supabase only.
- **Retention:** indefinite v1.

### 2.9 Operational telemetry

- **Purpose:** debug, capacity planning, error monitoring.
- **Lawful basis:** Art. 6(1)(f) legitimate interest.
- **Categories:** edge-function execution metadata (boot time, CPU,
  memory, errors), without payload contents. Standard HTTP access logs
  at the Supabase + Cloudflare layer.
- **Retention:** Supabase logs are retained per Supabase's policy
  (consult their docs); we do not separately persist them.

## 3. Data subjects' rights — operational procedures

| Right | How exercised | Engineering path | SLA |
|---|---|---|---|
| Access (Art. 15) | "Download my data" in Settings, or email | edge function `export-my-data` returns full JSON bundle | self-serve immediate |
| Rectification (Art. 16) | Edit fields in Configure / Settings | direct UPDATE via dashboard | self-serve immediate |
| Erasure (Art. 17) | "Delete my account" in Settings, or email | edge function `delete-my-account`; cascade rules propagate | self-serve immediate |
| Restriction (Art. 18) | Email privacy@ | manual flag on user row (TODO: not yet built) | within 14 days |
| Portability (Art. 20) | "Download my data" | same export edge function, JSON format | self-serve immediate |
| Objection (Art. 21) | Email privacy@ | manual review and (if granted) deletion | within 30 days |

## 4. Sub-processors

See [SUB_PROCESSORS.md](./SUB_PROCESSORS.md) for the canonical list,
contracts, and transfer mechanisms.

## 5. Breach response

See [BREACH_NOTIFICATION_RUNBOOK.md](./BREACH_NOTIFICATION_RUNBOOK.md).

## 6. Risk assessment summary

A Data Protection Impact Assessment (DPIA) is recommended given the
processing of health data of vulnerable adults (elders) at a scale that
is "regular and systematic." Status: **not yet conducted.** Owner:
{{NAME}} — target completion: {{DATE}}.
