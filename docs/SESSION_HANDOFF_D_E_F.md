# Session handoff — D, E, F implementation

**Date:** 2026-04-26
**Branch:** `main` (no commits yet — all work is uncommitted)
**Plan file:** `C:\Users\SperLat\.claude\plans\ill-paste-as-much-peaceful-pancake.md`
**Status:** All three features written and `tsc --noEmit` passes. **Nothing tested yet.** User couldn't run the local stack — Docker became unresponsive when attempting `npx supabase migration up`. Postgres on 54322 was unreachable.

---

## What got built

### D — Pastimes home card *(done, untested)*
A fifth elder-home tile that opens chat with an invitation-shaped prime to propose activities from `topics_they_enjoy`.

- `apps/mobile/app/(elder)/index.tsx` — added `pastimes: '🌿'` to `CARD_EMOJIS`
- `apps/mobile/src/lib/i18n.ts` — `cards.pastimes` strings (es/pt/en)

### E — Pill reminders *(done, untested)*
Family CRUD + kiosk pill + digest stats. **No cron** — kiosk-side polling every 30s. Phase-2 (pg_cron + soft-chime push) documented in the plan but not built.

- `supabase/migrations/0020_pill_reminders.sql` — `pill_reminders` + `pill_reminder_events`, org-scoped RLS, unique `(reminder_id, fired_at)` for idempotent slot inserts
- `apps/mobile/src/features/reminders/` — `types.ts`, `api.ts`, `useDueReminder.ts`, `index.ts`
- `apps/mobile/app/(elder)/index.tsx` — `useDueReminder` hook + due-pill above unread-message pill
- `apps/mobile/app/(elder)/reminder/[eventId].tsx` — three-button event screen
- `apps/mobile/app/(intermediary)/elders/[id]/reminders.tsx` — family CRUD
- Card on elder management page (`apps/mobile/app/(intermediary)/elders/[id]/index.tsx`)
- `apps/mobile/src/lib/i18n.ts` — kiosk pill + event-screen strings (es/pt/en)
- `supabase/functions/generate-digest/index.ts` — pill stats + extra prompt line; mobile `digest/api.ts` types updated to match

### F — Proud moments (Kasvu growth thread) *(done, untested)*
Table + invitation-shaped chat tile + monthly printable + digest inclusion. **Used `[moment]{json}[/moment]` sentinel pattern** instead of Anthropic tool-use round-trips (substitution from the original plan — see "Scope substitution" below).

- `supabase/migrations/0021_elder_moments.sql` — `elder_moments` table; RLS rejects `source='nagi'` from regular auth (only service_role can write Nagi-noticed moments — prevents caregiver spoofing)
- `apps/mobile/src/features/moments/` — `types.ts`, `api.ts` (incl. `recordNagiMoment`), `index.ts`
- `apps/mobile/app/(elder)/index.tsx` — `proud_moments: '✨'` in CARD_EMOJIS
- `apps/mobile/src/lib/i18n.ts` — `cards.proud_moments` strings with non-interrogative prime
- `supabase/functions/_shared/anthropic.ts` — STATIC_SYSTEM extended with PROUD MOMENTS section + sentinel spec
- `supabase/functions/record-moment/index.ts` — **new edge function** (service-role insert of `source='nagi'`)
- `apps/mobile/src/features/ai-chat/api.ts` — streaming-aware marker filter (prevents JSON flash on screen / TTS read-aloud) + post-stream `stripMomentMarker` calling `recordNagiMoment`
- `apps/mobile/app/(intermediary)/elders/[id]/moments.tsx` — family list/CRUD
- `apps/mobile/app/(intermediary)/elders/[id]/monthly-summary.tsx` — printable monthly summary, copy-as-markdown
- Card on elder management page

---

## Scope substitution worth flagging

The plan called for the Anthropic tool-use protocol (`record_moment` tool definition with multi-trip stop_reason='tool_use' handling). I substituted a `[moment]{json}[/moment]` sentinel that mirrors the existing `[private]` precedent in `apps/mobile/src/features/ai-chat/api.ts`. Two reasons:

1. The streaming chat function uses `anthropic.messages.stream({...})` end-to-end. Adding tool-use would require pausing the stream on `tool_use` stop_reason, executing the tool, and starting a new streaming call with the assistant's tool_use block + our tool_result — a non-trivial refactor of working code right before the demo.
2. The codebase already trusts the sentinel pattern for `[private]` (see `apps/mobile/src/features/ai-chat/api.ts:59`). Reusing it is the brand-coherent and safer choice.

Functionally equivalent for the demo. If a future revision wants real tool-use, the upgrade path is documented at `apps/mobile/src/features/ai-chat/api.ts` near `stripMomentMarker`.

---

## What needs to happen on restart

### 0. Diagnose Docker
The blocker was Docker becoming unresponsive when trying `npx supabase migration up`. Likely culprits, in order:
- Docker Desktop ran out of WSL2 memory — restart Docker Desktop, or restart Windows.
- Supabase containers got into a wedged state — `docker ps` to see what's running, `docker stop` any zombie supabase_* containers.
- **NEVER** run `npx supabase stop` or `supabase db reset` to fix it — the project's CLAUDE.md flags those as data-loss commands. Use `pnpm db:safe-stop` for a backup-first stop, or `docker restart supabase_db_Cedar` to bounce just the DB container.

Once Docker is responsive:

```powershell
# From D:\server\cedar
npx supabase start                   # if not already running
npx supabase migration up            # applies 0020 + 0021
```

### 1. Local smoke test (in this order)

```powershell
# Terminal 2, from apps\mobile
pnpm start --clear
```

Then on the kiosk view of any seeded elder:
- **D verify:** Confirm a 5th tile `🌿 Para disfrutar` appears. Tap → chat opens → Nagi proposes activities from `topics_they_enjoy`.
- **E verify (family):** Open elder management → `💊 Pill reminders` card → create one with times matching the next ~30 minutes. Confirm row in `pill_reminders`.
- **E verify (kiosk):** Within 30s, the `💊 Hora de tu pastilla: ...` pill should appear above the unread-message pill on the elder home. Tap → event screen → "Sí, la tomé" → returns to home, pill gone, event row shows `status='taken'`.
- **F verify (kiosk):** Tap `✨ Cuéntame` tile → narrate a moment ("hoy paseé al perrito de la vecina"). Confirm a row appears in `elder_moments` with `source='nagi'`. **Watch the screen during streaming** — the `[moment]{...}[/moment]` JSON must NOT flash visibly. If it does, the streaming-aware filter in `sendChatMessage` has a bug; check `flushSafely` in `apps/mobile/src/features/ai-chat/api.ts`.
- **F verify (family):** Family side → `✨ Proud moments` card → see the moment from above + a "Log a moment" button. Open `📰 This month's summary` → confirm the moment appears under the right week.
- **Cross-tenant smoke:** Confirm the existing Eleanor↔Maggie message inbox still works (no migration broke RLS on neighboring tables).

### 2. Deploy to cloud (only after local works)

```powershell
npx supabase db push
npx supabase functions deploy generate-digest
npx supabase functions deploy record-moment
```

Then re-run the seed scripts in https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new (per the plan's seed order: pemberton → whitmore → connection-eleanor-maggie). The new tables are additive — no seed change strictly required for D/E/F to work, but the demo will look richer if you also pre-populate a couple of `pill_reminders` and `elder_moments` rows for Eleanor.

---

## Known risks / gotchas

1. **Time zones (E):** `useDueReminder` uses device-local time. The reminder `times` are stored as Postgres `time` (no TZ). If the elder's device is in a different TZ than the family that set the reminder, the slots fire on device-local time. Documented as v1 limitation in the plan; phase-2 should add `elders.preferred_timezone`.
2. **Streaming filter (F):** The `[moment]` filter holds back partial-prefix bytes at the buffer tail. If the model emits `[m` and then never emits more (rare — stream cut), those bytes are silently dropped. Acceptable trade-off vs flashing JSON.
3. **STATIC_SYSTEM cache invalidation:** The PROUD MOMENTS addition to STATIC_SYSTEM causes one cache miss across all elders on first deploy. Cost: ~one extra Claude call per elder, then cache rebuilds. Documented in the file's lead comment.
4. **Pending events in digest:** `pill_pending > 0` after the past 7 days could mean "missed" or "still in window." Digest copy says "unconfirmed" which is honest. Don't change it to "missed" — see plan F brand guardrails.
5. **All work is uncommitted.** No commits have been made. `git status` will show new files in `supabase/migrations/`, `supabase/functions/record-moment/`, `apps/mobile/src/features/reminders/`, `apps/mobile/src/features/moments/`, plus modified files. Recommend committing as **three separate commits** (D / E / F) for clean history once verified.

---

## Files inventory (to verify nothing was lost across restart)

**New files:**
```
supabase/migrations/0020_pill_reminders.sql
supabase/migrations/0021_elder_moments.sql
supabase/functions/record-moment/index.ts
apps/mobile/src/features/reminders/types.ts
apps/mobile/src/features/reminders/api.ts
apps/mobile/src/features/reminders/useDueReminder.ts
apps/mobile/src/features/reminders/index.ts
apps/mobile/src/features/moments/types.ts
apps/mobile/src/features/moments/api.ts
apps/mobile/src/features/moments/index.ts
apps/mobile/app/(elder)/reminder/[eventId].tsx
apps/mobile/app/(intermediary)/elders/[id]/reminders.tsx
apps/mobile/app/(intermediary)/elders/[id]/moments.tsx
apps/mobile/app/(intermediary)/elders/[id]/monthly-summary.tsx
docs/SESSION_HANDOFF_D_E_F.md   ← this file
```

**Modified files:**
```
apps/mobile/app/(elder)/index.tsx
apps/mobile/app/(intermediary)/elders/[id]/index.tsx
apps/mobile/src/lib/i18n.ts
apps/mobile/src/features/ai-chat/api.ts
apps/mobile/src/features/digest/api.ts
supabase/functions/_shared/anthropic.ts
supabase/functions/generate-digest/index.ts
```

Run `git status` on restart to confirm all 22 files are still present.

---

## Open scope question for next session

User's reaction to the plan's "kiosk-polling-v1, brand-aware cron in phase 2" recommendation was a question, not a selection: *"does full server-side scheduling defeat kasvu or adds pressure or does it make sense?"* — answered in the conversation as: scheduling itself is brand-coherent if delivery is engineered carefully (soft chime, no accumulation, caregiver-only escalation after 30+ min). For this round we shipped kiosk-polling. If the user wants to upgrade to pg_cron + Expo Push before the demo, the design is in the plan's "Phase-2 upgrades" section under E.
