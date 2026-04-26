# Personal Data Breach — Notification Runbook

> **TEMPLATE for self-hosted deployments.** When you deploy Nagi, this
> becomes *your* breach-response procedure. Fill in the
> `{{PLACEHOLDERS}}` for your incident channel, lead supervisory
> authority, internal docs, and DPO contact. Even if you're "just" a
> family-scale deployer, run one tabletop drill before going live —
> the runbook is what saves you when stress is high and clock is
> ticking.
>
> Cross-reference: [SELF_HOST_COMPLIANCE.md](./SELF_HOST_COMPLIANCE.md)

**Last updated:** {{DATE_TO_FILL}}
**Owner:** {{NAME}} ({{ROLE}})
**On-call:** {{ON_CALL_CHANNEL_OR_PHONE}}

---

## 1. What counts as a personal data breach

A "personal data breach" is any security incident that leads to:

- **Confidentiality breach** — unauthorized disclosure of personal data
  (e.g. an RLS misfire that lets one org's caregiver read another's
  elder profile).
- **Integrity breach** — unauthorized alteration (e.g. a moment whose
  body was overwritten by an attacker).
- **Availability breach** — accidental or unlawful destruction or loss
  of access (e.g. a database wipe that loses elder history).

Bug, attack, lost laptop, leaked secret, and accidental email all
qualify if personal data is in scope.

## 2. First 60 minutes — Detection & contain

1. **Acknowledge.** Anyone (engineer, caregiver report, monitoring
   alert) who notices a possible breach posts to {{INTERNAL_CHANNEL}}
   with as much detail as they have. Time-stamp the post.
2. **Assemble the response team.** At minimum: engineering on-call,
   {{LEGAL_OR_FOUNDER}}, the DPO if appointed.
3. **Contain.** Stop ongoing exposure first, before investigating.
   Examples:
   - Rotate compromised secrets (Supabase service-role, Anthropic key,
     Whisper shared secret).
   - Disable affected edge functions.
   - Revoke the offending JWT or API key.
   - Apply temporary RLS lockdown if in doubt.
4. **Preserve evidence.** Snapshot Supabase logs, Cloudflare logs,
   relevant DB rows. Do NOT delete the offending data.

## 3. Hours 1–24 — Assess

Decide three things in writing (kept in {{INCIDENT_DOC}}):

- **Scope.** Which tables, which orgs, how many data subjects, what
  categories of data (regular vs special — health data of elders raises
  the stakes).
- **Cause.** Root cause (with file:line if a code bug, with timestamps
  if an external action).
- **Risk to data subjects.** Use the {{RISK_MATRIX}} worksheet:
  - Low risk (e.g. internal logs leaked operational metadata only):
    Art. 33 notification only.
  - Medium / high risk (substance of conversations leaked,
    cross-org elder profile exposed): Art. 33 + Art. 34 notification
    of affected data subjects.

## 4. Hours 24–72 — Notify

If the supervisory authority must be notified (Art. 33):

1. **Where:** the supervisory authority of the lead establishment.
   Default for {{LEGAL_ENTITY_NAME}}: {{LEAD_DPA}}.
2. **When:** within 72 hours of awareness, even if the assessment is
   incomplete. Send a partial report and update later.
3. **What:** prepare from the {{NOTIFICATION_TEMPLATE_DOC}}:
   - Nature of the breach
   - Categories and approximate number of data subjects
   - Categories and approximate number of records
   - Likely consequences
   - Measures taken or proposed
   - DPO / contact point
4. **Cc:** {{LEGAL_COUNSEL_EMAIL}} on every authority communication.

If data subjects must be notified (Art. 34):

- Plain-language email or in-app notice from privacy@nagi.kas.vu.
- What happened, what data, what we're doing, what they should do.
- Avoid technical jargon; the recipient may be an elder or a
  non-technical caregiver.
- Include the DPO contact and the local supervisory authority's
  complaint URL.

## 5. After notification — Remediate

- Land the code or process fix that prevents recurrence.
- Add a regression test or runtime alert.
- Hold a no-blame post-mortem within 7 days.
- Update RoPA if the incident reveals new processing or new sub-processors.
- Record the incident in {{INCIDENT_LEDGER}} with closure date.

## 6. Sub-processor breach

If a sub-processor (Supabase, Anthropic, Cloudflare, Whisper host)
notifies us of a breach affecting our data:

1. Treat their notice as our awareness clock starting.
2. Re-run the entire procedure above with the sub-processor as the
   "external action" cause.
3. Coordinate notifications — don't assume the sub-processor handles
   our notification obligations.

## 7. Drill cadence

A tabletop exercise of this runbook runs every 6 months. Owner rotates;
results recorded in {{DRILL_LOG}}. The first drill is due
{{FIRST_DRILL_DATE}}.

## 8. Templates referenced

- `templates/breach-notification-authority.md`
- `templates/breach-notification-data-subject.md`
- `templates/incident-postmortem.md`

(These template files are TBD — fill on first real or simulated
incident.)
