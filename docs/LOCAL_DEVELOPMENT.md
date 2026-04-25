# Local development with the real backend

This guide gets a fresh clone running end-to-end on a single laptop, with the
full Supabase stack (Postgres + Auth + Realtime + Edge Functions) and the
mobile app. Use this if you want to evaluate Nagi as a working product —
sign up, create elders, invite intermediaries, see help requests flow in
real time — without provisioning any cloud infrastructure.

If you only want to poke around the UI without a backend, see the
**Mock mode quickstart** in the main [README](../README.md). Mock mode
fakes auth, AI responses, and persistence — useful for screen-reading
the code, useless for evaluating the product.

For *production* deployment to a VPS, see [SELF_HOSTING.md](SELF_HOSTING.md).

---

## Prerequisites

| Tool | Minimum | Why |
|---|---|---|
| Node.js | 20+ | Runs Expo and the Supabase CLI |
| pnpm | 9+ | Workspace package manager (`npm i -g pnpm`) |
| Docker Desktop | running | Hosts the local Supabase stack |
| Anthropic API key | — | For AI chat. [console.anthropic.com](https://console.anthropic.com) |

The Supabase CLI is invoked via `npx supabase` — no global install needed.
Avoid the global `supabase` binary; it can drift out of sync with the version
the project pins.

---

## 1. Clone and install

```bash
git clone https://github.com/SperLat/NaGi.git
cd NaGi
pnpm install
```

`pnpm install` installs every workspace at once (root, `apps/mobile`, etc.).

---

## 2. Start the local Supabase stack

From the **repo root**:

```bash
npx supabase start
```

First run pulls Docker images (~2 GB) and takes 1–3 minutes. Subsequent
runs come up in ~10 seconds.

When it's ready, the CLI prints a block like:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
        Inbucket URL: http://127.0.0.1:54324
          anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
```

**Save the `API URL` and `anon key`** — you'll wire them into the mobile
app in step 4. Studio (`54323`) is the database admin UI; Inbucket
(`54324`) catches all auth emails (sign-up confirmations, etc.) so you
can grab the magic links without a real SMTP server.

---

## 3. Apply database migrations

```bash
npx supabase migration up
```

This applies every file in `supabase/migrations/` in order (10 migrations
as of this writing — auth, tenancy, elders, RLS, intermediary membership,
invitation acceptance, etc.).

If you ever need to start over from a clean DB:

```bash
npx supabase db reset
```

This is destructive — it drops the entire local DB and re-applies all
migrations from scratch. Safe in local development, never run it against
a remote.

---

## 4. Wire the mobile app to the local stack

```bash
cd apps/mobile
cp .env.example .env
```

Edit `apps/mobile/.env` and fill in **two values from step 2**:

```dotenv
EXPO_PUBLIC_MOCK_MODE=false
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste the "anon key" from step 2 here>
```

The other values in `.env.example` can stay at their defaults.

> The `anon key` is a long JWT signed by your local Supabase instance.
> It changes every time you run `supabase start` against a fresh stack —
> if you ever blow away your local Supabase volumes, re-grab the new key
> from `npx supabase status`.

---

## 5. Wire the Anthropic API key for edge functions

The `ai-chat` and `ai-classify` Edge Functions need an Anthropic API key
to call Claude. The Supabase CLI looks for these in `supabase/functions/.env`:

```bash
# From the repo root
mkdir -p supabase/functions
cat > supabase/functions/.env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
EOF
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
by the CLI — you don't need to set them.

> This file is gitignored. Never commit your API key.

The Edge Functions are served automatically by `supabase start` from
`supabase/functions/`. No separate deploy step is needed in local dev —
edits hit the running container on the next request.

---

## 6. Start the mobile app

From `apps/mobile/`:

```bash
pnpm start
```

Expo prints a QR code and several URLs:

- **Web**: open <http://localhost:8081> in your browser. This is the
  primary target for hackathon evaluation. Caregivers see a desktop
  layout (sidebar + main pane) at >= 1024px wide; elders always get
  the mobile shell.
- **iOS / Android**: scan the QR code with Expo Go (note: Expo Go has
  some New Architecture compatibility issues we haven't chased — web is
  the recommended evaluation target for this hackathon).

---

## 7. Try the full flow

Open <http://localhost:8081> in two different browsers (or one regular +
one incognito — they need separate localStorage to hold separate auth
sessions).

**Browser A — caregiver:**

1. Sign up with any email + password. The local Supabase stack does not
   send real emails; sign-up auto-confirms in development. (If the auth
   gate ever asks for email verification, check
   <http://localhost:54324> — Inbucket — for the confirmation link.)
2. You land on **My Elders**. Tap **Add Elder** → name them → save.
3. Tap the elder → **Invite intermediary** → enter `browser-b@example.com`.
   You'll get *"That person hasn't joined Nagi yet."* That's expected.

**Browser B — co-caregiver:**

4. Sign up as `browser-b@example.com`.
5. You land on **My Elders** with no elders, but no invitation either —
   because at the time the invite was sent, that account didn't exist
   yet. Have **Browser A** re-send the invite now.
6. Reload **Browser B**. The dashboard now shows an **Invitations** card.
   Click **Accept** → you're routed to the elder's detail page.

**Browser A — open the elder shell:**

7. From the elder detail page, tap **🧓 Open elder interface**.
8. Type or speak to Nagi. Watch the streaming response. The chat
   history persists across reloads (local SQLite + outbox sync).
9. Tap the red **I need urgent help** button.

**Browser B — see the alert:**

10. Within a couple of seconds (Realtime subscription) a red banner
    appears at the top of the dashboard. Tap **Handled** to acknowledge.

Activity log entries (taps, AI turns, help requests) show up under
the elder's **Activity log** screen — pull-to-refresh on mobile,
or the native pull gesture on web.

---

## Common issues

**`supabase start` complains about Docker not running.** Open Docker
Desktop, wait for it to finish starting, retry.

**`supabase start` says ports are already in use.** Another local
Supabase or Postgres is bound to 54321–54324 / 54322. Stop it
(`npx supabase stop` if it's a previous Supabase, or quit your other
Postgres) and retry.

**Mobile app loads but every API call returns 401.** Your
`EXPO_PUBLIC_SUPABASE_ANON_KEY` doesn't match the JWT_SECRET that
your local Supabase is currently running with. Re-fetch it:

```bash
npx supabase status
```

Copy the `anon key` value into `apps/mobile/.env`, restart the Expo
dev server.

**AI chat says "I cannot respond right now."** Either the Anthropic
API key is missing/invalid, or rate-limited. Check the Edge Function
logs:

```bash
npx supabase functions logs ai-chat
```

**Help request alerts don't appear in real-time.** Realtime is enabled
by default in local Supabase but is a separate WebSocket connection.
Check the browser DevTools Network tab → WS for `realtime/v1/websocket`.
If it's red, the local stack may not have started cleanly — try
`npx supabase stop && npx supabase start`.

**"Could not add them just now. Try again in a moment."** When inviting,
this means the RPC raised an error. In `__DEV__` builds, the actual
error message is shown. The most common cause is forgetting to run
`npx supabase migration up` after pulling new migrations.

**Back button does nothing on a deep-linked page.** Fixed in commit
`687acc5` — `safeBack()` falls back to a sensible parent route when
no nav history exists. If you still see this, you're on an older
branch.

---

## Stopping the stack

```bash
# From the repo root
npx supabase stop
```

This stops Docker containers but **preserves your local data** (signed-up
users, created elders, message history). Next `supabase start` brings
everything back.

To wipe the local DB clean:

```bash
npx supabase db reset
```

---

## What's actually running

When `supabase start` is up, you have:

- **Postgres 15** on `:54322` — application data, RLS-enforced
- **PostgREST** on `:54321/rest/v1/` — auto-generated REST API
- **GoTrue Auth** on `:54321/auth/v1/` — sign-up, sign-in, JWT issuance
- **Realtime** on `:54321/realtime/v1/` — WebSocket pub/sub for help_requests, etc.
- **Edge Runtime** on `:54321/functions/v1/` — runs `ai-chat` and `ai-classify` Deno functions
- **Studio** on `:54323` — schema/data admin UI
- **Inbucket** on `:54324` — captures outbound emails (auth confirmations, etc.)

All of this is also what `SELF_HOSTING.md` provisions on a real VPS — the
stack is identical. The only difference is the local CLI uses Docker
Compose under the hood and pre-wires all the secrets, while the production
path requires you to generate them yourself.
