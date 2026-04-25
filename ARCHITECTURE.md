# Nagi v0 — Technical Architecture

**Project:** Cedar (repo) / Nagi (product, 凪)
**Lane:** BUILD
**Author of packet:** Kronos (Opus 4.7)
**Date:** 2026-04-22
**Status:** v0 specification, hackathon scope

---

## 0. Stance

- **Route:** BUILD, single lane. No parallel tracks.
- **Effort:** medium on scaffolding, high on sync + AI edge function (the two surfaces where getting it wrong creates expensive rework).
- **Model allocation at runtime:** Haiku 4.5 for classification/intent; Sonnet 4.6 for conversation. Opus is governance only, never in product runtime.
- **Primary tension surfaced:** multi-tenant + offline-first. **Not irreconcilable.** Resolution: *one active organization context per device session.* Named in §3.
- **Primary tension surfaced:** Claude API + self-hostability. **Not irreconcilable.** Resolution: *BYOK edge function + mock mode as first-class path.* Named in §4, §5.

---

## 1. Directory Structure — `d:/server/cedar`

```
cedar/
├── apps/
│   └── mobile/                          # Expo Router app (primary)
│       ├── app/                         # Expo Router file-based routes
│       │   ├── (auth)/
│       │   │   ├── sign-in.tsx
│       │   │   └── sign-up.tsx
│       │   ├── (intermediary)/          # Intermediary-only flows
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx            # Dashboard: elders I support
│       │   │   ├── elders/[id]/
│       │   │   │   ├── index.tsx        # Elder overview
│       │   │   │   ├── configure.tsx    # Configure interface
│       │   │   │   └── activity.tsx     # Activity log review
│       │   │   └── organization.tsx
│       │   ├── (elder)/                 # Elder-facing configured UI
│       │   │   ├── _layout.tsx          # Large-text, simplified chrome
│       │   │   └── index.tsx            # Configured entry point
│       │   ├── _layout.tsx              # Root: session + org context
│       │   └── +not-found.tsx
│       ├── src/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── organizations/
│       │   │   ├── elders/
│       │   │   ├── activity-log/
│       │   │   └── ai-chat/
│       │   ├── lib/
│       │   │   ├── supabase/            # Client factory (real + mock)
│       │   │   ├── db/                  # expo-sqlite wrapper, migrations
│       │   │   ├── sync/                # Outbox + pull engine
│       │   │   ├── ai/                  # Edge function client
│       │   │   └── mock/                # Mock fixtures, seed data
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── state/                   # Zustand stores
│       │   └── config/
│       │       ├── env.ts               # Env var parsing (Zod)
│       │       └── mode.ts              # Mock vs real toggle
│       ├── global.css                   # NativeWind entry
│       ├── tailwind.config.js
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
├── supabase/
│   ├── migrations/                      # SQL migrations, numbered
│   │   ├── 0001_init_tenancy.sql
│   │   ├── 0002_elders.sql
│   │   ├── 0003_activity_log.sql
│   │   ├── 0004_ai_context.sql
│   │   └── 0005_rls_policies.sql
│   ├── functions/                       # Edge functions (Deno)
│   │   ├── ai-chat/
│   │   │   ├── index.ts
│   │   │   └── deno.json
│   │   ├── ai-classify/
│   │   │   └── index.ts
│   │   └── _shared/
│   │       ├── anthropic.ts             # Claude client, cache helpers
│   │       ├── auth.ts                  # JWT + org membership check
│   │       └── rate-limit.ts
│   ├── seed.sql
│   └── config.toml
├── deploy/
│   ├── docker-compose.yml               # Supabase self-host + edge runtime
│   ├── docker-compose.override.example.yml
│   ├── .env.example
│   └── README.md
├── docs/
│   ├── ARCHITECTURE.md                  # This file
│   ├── SELF_HOSTING.md
│   ├── SECURITY.md
│   └── PRINCIPLES.md                    # Kasvu → product principles
├── scripts/
│   ├── seed-mock.ts
│   └── verify-rls.ts                    # RLS smoke tests
├── .github/workflows/
│   ├── ci.yml                           # typecheck + test + lint
│   └── mobile-eas.yml                   # optional EAS build
├── LICENSE                              # MIT
├── README.md
├── package.json                         # pnpm workspace root
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Justification for shape:**
- `apps/` monorepo layout leaves room for `apps/web` without refactor, without committing to it in v0.
- Supabase assets live outside `apps/mobile` because edge functions + migrations are the self-host surface; self-hosters need them independent of the mobile app.
- `deploy/` separate from `supabase/` because `docker-compose.yml` composes more than Supabase (edge runtime, optional reverse proxy).

---

## 2. Supabase Schema

### 2.1 Tables

```sql
-- Tenancy root
organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('family','ngo','enterprise')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL REFERENCES auth.users(id)
)

-- Membership: who can act on behalf of which org, with what role
organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','intermediary')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
)

-- Elder = beneficiary profile, configured by intermediaries
elders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  preferred_lang  text NOT NULL DEFAULT 'es',
  profile         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- AI context (stable)
  profile_version int  NOT NULL DEFAULT 1,              -- bumps on change; cache key
  ui_config       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- interface customization
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)

-- Caregiving assignment (many intermediaries per elder)
elder_intermediaries (
  elder_id        uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relation        text,                                 -- "daughter", "volunteer"
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (elder_id, user_id)
)

-- Append-only log of elder-side events, synced from device
activity_log (
  id              uuid PRIMARY KEY,                     -- UUIDv7 client-generated
  elder_id        uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL,                        -- 'ai_turn','ui_action','error'
  payload         jsonb NOT NULL,
  client_ts       timestamptz NOT NULL,                 -- device clock
  server_ts       timestamptz NOT NULL DEFAULT now(),
  device_id       text NOT NULL
)

-- AI interaction records (audit, analytics, cache observability)
ai_interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id        uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model           text NOT NULL,
  profile_version int NOT NULL,
  input_tokens    int,
  output_tokens   int,
  cache_read_tokens int,
  cache_write_tokens int,
  latency_ms      int,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
)

-- Outbox mirror is client-side only (SQLite); server has no outbox.
```

**Indexes:**
- `activity_log (elder_id, server_ts DESC)`
- `activity_log (organization_id, server_ts DESC)` (org-level dashboards)
- `ai_interactions (elder_id, created_at DESC)`
- `organization_members (user_id)` (fast membership lookup for RLS)

### 2.2 RLS policies — pattern

Every tenant table gets the same shape. Helper function first:

```sql
CREATE FUNCTION is_org_member(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org AND user_id = auth.uid()
  );
$$;
```

Then per-table policies (example for `elders`):

```sql
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;

CREATE POLICY elders_select ON elders
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY elders_insert ON elders
  FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY elders_update ON elders
  FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY elders_delete ON elders
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = elders.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner','admin'))
  );
```

`activity_log` is insert-only from intermediaries' devices; elders do not have auth.users rows in v0 (they act through a configured session on the intermediary's device, or via a signed elder-token flow deferred to v1 — named explicitly as a v0 scope cut below).

### 2.3 Edge Functions

| Function | Purpose | Model |
|---|---|---|
| `ai-chat` | Streaming conversation with elder. Accepts elder_id, turn payload; returns SSE. Applies prompt caching on `elders.profile`. | sonnet-4-6 |
| `ai-classify` | Short classification/intent calls (e.g., "is this a help request?"). Non-streaming. | haiku-4-5 |
| `_shared/*` | Auth JWT + org membership verification, Anthropic client, rate limiter. | — |

All edge functions:
- Validate JWT → derive `user_id`
- Verify `user_id ∈ organization_members` for the requested `elder_id`'s org
- Read Anthropic key from env (`ANTHROPIC_API_KEY`), never exposed to client
- Emit an `ai_interactions` row per call

---

## 3. Offline Sync Strategy

### 3.1 Local-first data flow

**Device storage:** `expo-sqlite` with a mirror of tenant-relevant rows for the **active organization only**.

**Active organization invariant:** a device session pins exactly one `organization_id`. This is how the multi-tenant + offline-first tension resolves. Rationale:
- An intermediary member of two orgs cannot operate on both simultaneously offline without introducing unbounded cache size and cross-tenant RLS leakage risk on device.
- Switching orgs requires connectivity (pull fresh slice) and clears the mirror.
- v0 assumption: most intermediaries belong to one org. Multi-org intermediaries are rare and can switch online.

**Tables mirrored on device:**
- `elders` (slice: where `organization_id = active_org`)
- `elder_intermediaries`
- `activity_log` (last 30 days, elders the user is linked to)
- `organization_members` (for the active org only)

**Outbox table (device-only):**
```sql
outbox (
  id              TEXT PRIMARY KEY,        -- UUIDv7
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL,           -- 'insert'|'update'|'delete'
  payload         TEXT NOT NULL,           -- JSON
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'  -- pending|sent|failed
)
```

### 3.2 Write path

1. Writer calls typed repo function (e.g., `elders.update(id, patch)`).
2. Repo applies change to local SQLite (optimistic).
3. Repo appends operation to `outbox`.
4. Sync worker (background + on-app-foreground + on-net-change) drains outbox in FIFO.
5. On 2xx: mark sent, delete after 24h (keep for debug).
6. On 4xx (RLS denial, validation): mark failed, surface to user as a recoverable error. Do not silently drop.
7. On 5xx / network: exponential backoff, bounded at 5 attempts, then `failed`.

### 3.3 Read path

Reads hit local SQLite first. A pull engine runs on app open and on pull-to-refresh:
- Fetches `elders` modified since `last_pull_at`.
- Fetches `activity_log` server_ts > `last_pull_at`, capped at 30-day window.
- Applies with server row winning on conflict (see §3.4).

### 3.4 Conflict resolution

| Table | Strategy |
|---|---|
| `activity_log` | Append-only, client UUIDv7 IDs, server assigns `server_ts`. No conflict possible. |
| `elders` (config writes) | Last-write-wins by `updated_at`; tiebreaker = lexicographic `user_id`. Conflicts are logged to `ai_interactions.error` channel for intermediary review. |
| `organization_members` | Server-authoritative; device never writes. |
| Elder-facing state (session, AI chat history) | Ephemeral in v0. Session history is AI-turn rows in `activity_log`, append-only, no conflict. |

### 3.5 Offline AI

When offline, the app cannot call `ai-chat`. UX response:
- Elder flow degrades to a scripted fallback configured by intermediary (a `ui_config.offline_message` field) and logs an `activity_log` row of kind `offline_ai_unavailable`.
- The intermediary sees offline incidents on next sync.

This is **named scope**: no on-device LLM in v0.

---

## 4. Claude API Integration

### 4.1 Model per feature

| Feature | Model | Reason |
|---|---|---|
| Elder conversation turn | `claude-opus-4-7` | 1M-context recall of months of activity_log, nuanced language, adaptive thinking only when the turn warrants it |
| Weekly digest narrative | `claude-opus-4-7` | Non-latency-sensitive; narrative quality of the family-facing summary matters more than speed |
| Intent classification, short yes/no, summary titles | `claude-haiku-4-5` | Cheap, fast, adequate |
| Any design/governance/architectural reasoning | off-runtime (Opus, Kronos only) | Not in product path |

### 4.2 Prompt caching — structure

The cacheable unit is the **stable elder profile context**, not the conversation. Structure for `ai-chat`:

```
System (static across all elders — cached at app deploy):
  - Nagi conversational policy
  - Kasvu-derived interaction principles
  - Safety + escalation rules

[cache_control: ephemeral]
System (per-elder, cached per profile_version):
  - Elder display_name, preferred_lang
  - Elder profile JSON (history, preferences, topics they care about)
  - Intermediary-authored instructions
[cache_control: ephemeral]

Messages (volatile):
  - Recent turns (last N)
  - Current user turn
```

**Cache key discipline:**
- Invalidation is driven by `elders.profile_version`. Any profile edit by an intermediary bumps the version. Cache is naturally abandoned after the 5-minute ephemeral TTL; a version bump mid-TTL causes a single cold read, acceptable.
- The edge function logs `cache_read_tokens` / `cache_write_tokens` into `ai_interactions` so hit rate is observable from day one.

### 4.3 Edge function shape (`ai-chat`)

```
POST /functions/v1/ai-chat
Headers: Authorization: Bearer <supabase_jwt>
Body: { elder_id, messages: [...] }

Flow:
  1. Validate JWT, extract user_id
  2. Confirm user is linked to elder via elder_intermediaries
     AND member of elder's organization
  3. Load elder.profile, elder.profile_version (1 query)
  4. Build prompt with cache_control markers
  5. Stream Anthropic call (SSE pass-through to client)
  6. On completion: insert ai_interactions row (async, non-blocking)
  7. On error: insert ai_interactions row with error, return 5xx
```

### 4.4 Self-hostability check

**Resolved:** core path stays MIT-pure. Anthropic SDK is the only non-MIT-governed dependency (Anthropic's Python/TS SDKs are MIT). Edge functions call Anthropic via HTTP, so self-hosters can:
- Provide their own `ANTHROPIC_API_KEY` (default).
- Or point `ANTHROPIC_BASE_URL` to an OpenAI-compatible proxy (LiteLLM, etc.) if they want a different provider. v0 tests only Anthropic, but the abstraction cost is one env var.
- Or run the app with `EXPO_PUBLIC_MOCK_MODE=true` and no AI at all (see §5).

This satisfies: "no proprietary SDKs in core path" — Anthropic SDK usage is gated at the edge function boundary, not bundled in the mobile app.

---

## 5. Mock Mode

### 5.1 Scope

| Concern | Real mode | Mock mode |
|---|---|---|
| Supabase client | `@supabase/supabase-js` to live URL | In-memory shim implementing the narrow subset we use |
| Auth | Real Supabase auth (email, magic link) | Auto-signed-in as `mock-intermediary@local` |
| Tables | Live Postgres | SQLite (same schema, seeded from `scripts/seed-mock.ts`) |
| Edge functions | Deployed functions | Local JS stub returning canned AI responses |
| AI | Claude via edge function | Canned responses keyed by message intent |
| Outbox + sync | Normal | Normal (against local shim) |

### 5.2 Toggle

```ts
// apps/mobile/src/config/mode.ts
export const MODE = process.env.EXPO_PUBLIC_MOCK_MODE === 'true'
  ? 'mock'
  : 'real';
```

The Supabase client factory branches on `MODE` once, at module init. No conditional logic leaks into feature code — features import a client interface, not the concrete class.

### 5.3 Purpose

- First-contact contributors clone, `pnpm install`, run, see the app work end-to-end without any cloud credentials.
- CI smoke tests run in mock mode; live-infra tests are a separate workflow gated on repo secrets.
- Named assumption: mock mode is a **demo surface**, not a fidelity replica. Sync edge cases are tested against real Supabase.

---

## 6. Self-Host Deployment Spec

### 6.1 `deploy/docker-compose.yml` — composition

- Supabase self-host stack (db, auth, rest, realtime, storage, studio, kong). Sourced from upstream `supabase/supabase` repo via a pinned submodule or documented clone step. **Do not vendor the full stack into this repo** — keep self-hosters on upstream.
- Supabase edge runtime container mounted on `supabase/functions/`.
- Optional Caddy reverse proxy for TLS.
- Mobile app is **not** in compose — it ships to app stores or EAS. Self-hosters wire `EXPO_PUBLIC_SUPABASE_URL` to their deployment.

### 6.2 Required env vars

```
# Supabase (self-host)
POSTGRES_PASSWORD
JWT_SECRET
ANON_KEY
SERVICE_ROLE_KEY
SITE_URL

# AI
ANTHROPIC_API_KEY                  # required unless EXPO_PUBLIC_MOCK_MODE=true
ANTHROPIC_BASE_URL                 # optional, for proxy

# Mobile build
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_MOCK_MODE              # 'true' disables real backend
```

### 6.3 Deployment tiers (Bitwarden model)

| Tier | What the user runs | Nagi provides |
|---|---|---|
| Self-hosted | Full `deploy/` stack on their VPS | Docs + compose + migrations |
| Hosted free (small NGOs) | Nothing | Managed instance with usage cap |
| Hosted paid (enterprise) | Nothing | Managed instance + SLA + org admin |

v0 ships only the self-hosted tier and a personal mock-mode build. Hosted tier is v1 infra work, out of scope here.

---

## 7. V0 Build Sequence

Strict dependency order. Do not start step N before N-1 is verifiable.

1. **Scaffold + licensing + CI skeleton.** `pnpm` workspace, Expo Router app boots, NativeWind renders one screen, MIT license, `tsc --noEmit` passes in CI.
2. **Mock mode foundation.** Mode toggle, client interface, in-memory Supabase shim, canned AI stub. One screen reads a mocked elder. This is built first so step 3+ can develop without live infra.
3. **Tenancy schema + RLS.** Migrations 0001, 0005. `scripts/verify-rls.ts` proves cross-org reads return empty.
4. **Auth + org membership.** Sign-up creates org of kind `family`. Org switcher deferred (single-org happy path v0).
5. **Elder schema + intermediary-side CRUD.** Intermediary can create elder, edit profile JSON, bump profile_version. Local SQLite mirror works.
6. **Offline outbox + pull engine.** Write while offline; reconnect; observe server state converges. Conflict path tested with two devices.
7. **Activity log.** Append-only insert path from both sides. 30-day window pull works.
8. **`ai-chat` edge function.** JWT validation, membership check, cache markers set, SSE stream to mobile. `ai_interactions` rows written. Verify cache hit on second turn.
9. **`ai-classify` edge function.** Haiku, non-streaming. Used for one feature only in v0 (intent detection on elder input).
10. **Elder-facing configured UI.** Large-text layout, reads `ui_config`, chats via `ai-chat`, logs turns.
11. **Self-host compose + docs.** `deploy/docker-compose.yml`, `SELF_HOSTING.md`, smoke-tested on a clean VPS.
12. **Seed + demo.** `scripts/seed-mock.ts` populates a reference family org with one elder and a sample profile. This is the hackathon demo path.

---

## 8. Assumptions (named, not hidden)

1. Elders do not have `auth.users` accounts in v0. They interact through a device configured by an intermediary. An elder-owned-device auth flow is v1.
2. One active organization per device session. Multi-org intermediaries switch online.
3. Supabase self-host is sourced upstream; we do not vendor the full stack.
4. Anthropic is the only AI provider tested in v0. Base URL override is present but not promised to work with every proxy.
5. Offline AI is unavailable in v0; fallback is a configured static message.
6. The profile JSON is the **stable** cacheable unit. Conversation history is **not** cached; it is passed as live messages.
7. All new-to-repo code starts 2026-04-22. Any pre-existing Cedar artifacts are excluded by deletion of prior `d:/server/Project`.
8. Low-connectivity LATAM is the primary constraint shape. Design favors sync robustness over feature count.
9. No realtime voice, no payments — both explicitly out.
10. The MIT-clean criterion applies to the mobile app core and self-host stack; Anthropic's own SDK (MIT) at the edge function layer is acceptable.

---

## 9. Residual Risks

| # | Risk | Severity | Mitigation present in v0 |
|---|---|---|---|
| R1 | Device clock skew corrupts last-write-wins on `elders.profile` | Medium | Server re-stamps `updated_at` on accept; client skew only used for conflict detection, not resolution |
| R2 | Outbox grows unbounded if server 4xxs repeatedly | Medium | Attempts capped at 5, status=`failed` surfaces to user; no silent drop |
| R3 | RLS policy omits a new table, leaks cross-tenant data | High | `scripts/verify-rls.ts` runs in CI on every migration; blocks merge if any table lacks RLS |
| R4 | Mock mode drifts from real behavior and hides real bugs | Medium | CI runs mock suite AND a live-Supabase suite on a branch-protected job |
| R5 | Prompt cache hit rate underperforms, AI cost spikes | Medium | `ai_interactions` captures cache_read/cache_write from day one; observable before it becomes a bill |
| R6 | Self-hoster misconfigures `ANTHROPIC_API_KEY`, app hard-fails | Low | Edge function returns a structured 503 with remediation hint; mobile shows "AI unavailable — contact admin" |
| R7 | Elder UI configuration edits by two intermediaries conflict | Low | Last-write-wins + conflict note in `ai_interactions` log; acceptable for v0 |
| R8 | Supabase self-host upstream changes break our compose | Medium | Pin a known-good upstream commit; document the pin in `SELF_HOSTING.md` |
| R9 | Multi-org intermediary discovers the one-active-org rule mid-pilot | Low | Documented in onboarding; v1 task opened to support seamless org switch |
| R10 | Hackathon schedule collapses step 8 (edge function + caching) | High | Step 8 is the single largest risk. Allocate a full dedicated pair-block. Do not defer. |

---

## 10. Verification Bar — what counts as "v0 done"

A reviewer must be able to check each line. No item is subjective.

- [ ] `pnpm install && pnpm -w typecheck` returns 0 on a clean clone.
- [ ] `EXPO_PUBLIC_MOCK_MODE=true pnpm --filter mobile start` boots the app with no secrets set; user can sign in, create elder, send 3 AI turns (mocked), view activity log.
- [ ] `scripts/verify-rls.ts` passes: cross-org SELECT returns 0 rows; cross-org INSERT is rejected.
- [ ] Offline scenario: airplane mode ON, edit elder profile, toggle OFF, observe server row updated within 10s.
- [ ] `ai-chat` returns SSE stream within 2s TTFB on sonnet-4-6 against live Anthropic.
- [ ] Second turn in same conversation shows `cache_read_tokens > 0` in `ai_interactions` row.
- [ ] `ai-classify` roundtrip under 800ms on haiku-4-5.
- [ ] `docker compose -f deploy/docker-compose.yml up` on a clean Linux host brings up Supabase + edge runtime; the mobile app configured against it can sign in and chat.
- [ ] LICENSE is MIT. No dependency in `apps/mobile/package.json` has a non-permissive license (script checks).
- [ ] `seed-mock.ts` produces a demo-ready state in under 5 seconds.
- [ ] Docs exist: `README.md` (≤1 page quickstart), `SELF_HOSTING.md`, `SECURITY.md`, `PRINCIPLES.md`.

Completion is not claimed until all boxes are checked. A box failed is a blocker, not a known issue.

---

## 11. Out of Scope (explicit, to prevent scope drift)

- WhatsApp Business API integration
- Volunteer network / external intermediary discovery
- Multi-org admin console
- Realtime voice
- On-device LLM
- Payments / billing / paid-tier provisioning
- Web app (reserved by directory layout, not built)
- Elder-owned device auth flow
- i18n beyond Spanish (v0 Spanish-first for Costa Rica pilot)

Any of these appearing in a PR is a scope violation. File an issue, do not merge.

---

## 12. Handback

This packet is `BUILD`-ready. Next action for the operator:

- Confirm the one-active-org invariant (§3.1). It is the sharpest product decision embedded here and the only one that could reshape the schema if reversed.
- Confirm Anthropic-only AI in v0 (§4.4). Reversal means adding a provider abstraction now, not later.
- On confirmation, step 1 of §7 may begin on the operator's default Sonnet 4.6 runtime. Opus 4.7 is not needed again until a design-level decision surfaces.

Runtime decision: **RETURN_TO_4_6** for execution of this plan.
