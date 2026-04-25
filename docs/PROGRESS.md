# Build log

A dated record of what we tried, what worked, what we discarded.
Light touch — bullets, not paragraphs. Public evidence of the build.

The format is borrowed from CrossBeam's `progress.md` — the one piece
of their playbook we copied wholesale.

---

## 2026-04-25 — Intermediary dashboard, eight packets

The intermediary surface used to be a sidebar of elders, an alert
banner, and three sub-screens that mostly held settings. A family
member opened it and saw almost nothing about *what was actually
happening with their parent*. This push rebuilt it as a window into
care.

### Shipped (in build order)

- **P10 — Dashboard cards + handled-today history.** Per-elder cards
  now show today's question count, the count that "got stuck" (errors
  + `offline_ai_unavailable`), recent snippet previews, and a separate
  "Handled today" section so acknowledged help requests don't vanish
  from view the moment they're acknowledged.
- **P11 — About-this-person profile + AI grounding + runtime skills.**
  The previously-unused `elders.profile` JSONB became the most
  important field in the product. Structured fields (preferred name,
  spoken languages, topics they enjoy / avoid, communication notes,
  accessibility notes, emergency contact) render into the AI's system
  prompt. Added a `.claude/skills/` directory of plain-markdown runtime
  skills — Spanish/English communication, cognitive-accessibility,
  low-vision, tech-support reference, dementia-aware redirection —
  selectively loaded by profile.
- **P16 — Weekly digest.** "Generate this week's summary" button on
  the elder overview. Edge function aggregates 7d of `activity_log`,
  `ai_interactions`, and `help_requests`, then asks Sonnet for a
  markdown narrative a family member can copy and forward to a sibling.
  Stateless v1 — no `elder_digests` table yet.
- **P14 — Conversation transcript view.** Read-only screen showing the
  full elder ↔ Nagi history. The data was already in `activity_log` —
  the intermediary just never saw it. Range picker (today / 7d / 30d /
  all), keyset pagination, expand-on-tap for long messages.
- **P12 — Sidebar status indicators.** Pending-request red dot + count
  per elder; "active 14m ago" subtitle when the most recent activity
  is within the last hour, hidden otherwise. The 1-hour cutoff is
  deliberate — "active yesterday" is noise, not signal.
- **P15 — Shared notes journal.** Timestamped events, distinct from
  the static About profile. Author email shown, author-only delete,
  no UPDATE policy at all (RLS as audit trail).
- **P13 — Care-team chat per elder.** Inline panel on the elder
  overview, realtime over `elder_team_messages`. Same realtime
  channel-name-cache trap from the help-requests dashboard reappeared
  and the same fix applied — random suffix on the channel name to
  dodge supabase-js's by-name cache that bites in React 19 strict mode.
- **Meta — README rewrite + this log.** README now leads with the
  1.4-billion-people-by-2030 stat and a comparison table against the
  hardware-lock-in (GrandPad, ElliQ, Aloe, Lively) and facility-B2B
  (PointClickCare, MatrixCare, AlayaCare) incumbents. New "Roadmap &
  open-source vision" section names the things we *won't* build but
  want others to.

### Caveats to revisit

- Digest is stateless. It re-generates on every click. Worth caching
  once someone runs out of patience.
- Skill resolution is keyword-matched against `communication_notes`
  and `accessibility_notes`. Fine for now; will get noisy as the
  skill library grows.
- Transcript pagination uses keyset on `client_ts`. Assumes no two
  rows share a timestamp. They almost certainly will eventually.
- Three-layer prompt cache (persona → skills → per-elder) is set up
  correctly but uncached prompts haven't been measured against cached
  ones yet. Should validate before claiming the savings.

### Discarded

- **Long-running async digest agent** (CrossBeam's pattern). Overkill
  for a 7-day aggregate — Sonnet returns in seconds.
- **Live web search per chat turn.** The Anthropic web tool exists,
  but the elder questions we serve mostly don't need fresh internet
  info. Kept latency low instead.
- **Photo stream / video calling / proactive AI check-ins / push
  notifications.** Each is a meaningful feature on its own; bolting
  any of them onto this push would have blown the dashboard scope.
  Listed in the README roadmap as community invitations.
- **Persisting digests to a table.** Considered an `elder_digests`
  table; decided stateless was simpler and the markdown is trivially
  copy-pasteable. Will revisit if anyone asks for "show me last
  week's digest."

---

## Format

- Reverse-chronological. Newest entry on top.
- Dates in ISO. One section per build day.
- "Shipped" / "Caveats" / "Discarded" — keep the discarded list
  honest. It's the most useful part for the next reader.
- `git log --oneline` is the source of truth for what landed; this
  file explains *why* and *what we walked away from*.
