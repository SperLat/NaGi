# Self-Hosting Nagi

Nagi is fully self-hostable. You own your data: the Supabase stack (Postgres + Auth + Storage + Edge Runtime) runs entirely on your infrastructure.

---

## What you need

| Requirement | Minimum | Notes |
|---|---|---|
| Linux VPS | 2 vCPU, 4 GB RAM | Debian 12 / Ubuntu 22.04 recommended |
| Docker | 24+ | With Compose plugin (`docker compose`) |
| Domain | Any | Required for TLS; optional for local/intranet |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) — BYOK, stays on your server |
| Node.js | 20+ | Only needed to run `pnpm` migration commands |

---

## 1. Clone the repo

```bash
git clone https://github.com/your-org/cedar.git
cd cedar
```

---

## 2. Set up Supabase self-host

Nagi's backend is the upstream [Supabase Docker stack](https://supabase.com/docs/guides/self-hosting/docker). You need to clone it alongside the deploy directory:

```bash
# From the repo root
git clone --depth 1 https://github.com/supabase/supabase.git /tmp/supabase-docker
cp -r /tmp/supabase-docker/docker deploy/supabase
```

This places the upstream Supabase `docker-compose.yml` and config at `deploy/supabase/`. Nagi's `deploy/docker-compose.yml` is an extension layer on top — it does not vendor the Supabase stack.

---

## 3. Configure environment

```bash
cp deploy/.env.example deploy/.env
```

Open `deploy/.env` and fill in every required value:

```dotenv
# Required — Supabase internal auth
POSTGRES_PASSWORD=<strong random password>
JWT_SECRET=<strong random secret, 32+ chars>

# Required — generate these from the JWT_SECRET
# Use: https://supabase.com/docs/guides/self-hosting#api-keys
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>

# Required — your public URL (no trailing slash)
SITE_URL=https://nagi.yourdomain.com
SUPABASE_URL=http://kong:8000

# Required — AI
ANTHROPIC_API_KEY=sk-ant-...

# Optional — proxy override (LiteLLM, etc.)
# ANTHROPIC_BASE_URL=https://your-proxy.com
```

### Generating JWT keys

The Supabase docs provide a [key generation guide](https://supabase.com/docs/guides/self-hosting#api-keys). You need `ANON_KEY` and `SERVICE_ROLE_KEY` derived from your `JWT_SECRET`.

---

## 4. Start the stack

```bash
# From the deploy/ directory
cd deploy

# Start Supabase stack first
docker compose -f supabase/docker-compose.yml --env-file .env up -d

# Start Nagi edge runtime (and optional Caddy TLS proxy)
docker compose --env-file .env up -d

# With TLS (Caddy):
docker compose --env-file .env --profile tls up -d
```

Wait ~60 seconds for Postgres and Kong to be ready before proceeding.

---

## 5. Apply database migrations

From the repo root:

```bash
npm install -g pnpm
pnpm install

# Point the CLI at your self-hosted instance
export SUPABASE_DB_URL=postgresql://postgres:<POSTGRES_PASSWORD>@<your-server-ip>:5432/postgres

pnpm --filter @cedar/supabase db push
```

Or use the Supabase CLI directly:

```bash
supabase db push --db-url postgresql://postgres:<POSTGRES_PASSWORD>@<your-server-ip>:5432/postgres
```

This applies all migrations in `supabase/migrations/` in order.

---

## 6. Deploy edge functions

```bash
supabase functions deploy ai-chat \
  --project-ref <your-project-ref> \
  --no-verify-jwt

supabase functions deploy ai-classify \
  --project-ref <your-project-ref> \
  --no-verify-jwt
```

For self-hosted deployments, edge functions are served directly by the `edge-runtime` container which mounts `supabase/functions/` from the repo. No separate deploy step is required — the functions are live as soon as the container starts.

---

## 7. Verify the stack

```bash
# Kong API gateway (Supabase)
curl http://localhost:8000/rest/v1/ \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
# Expected: {"hint":"...","message":"..."}

# Nagi edge runtime
curl http://localhost:9000/functions/v1/ai-chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"ping": true}'
# Expected: 401 (auth required — means the function is running)
```

If you enabled Caddy (`--profile tls`), verify TLS:

```bash
curl https://nagi.yourdomain.com/rest/v1/ \
  -H "apikey: <ANON_KEY>"
```

---

## 8. Build the mobile app

In `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://nagi.yourdomain.com
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your ANON_KEY>
EXPO_PUBLIC_MOCK_MODE=false
```

Then build:

```bash
pnpm --filter @cedar/mobile build:android
# or
pnpm --filter @cedar/mobile build:ios
```

For development / demo without a built app:

```bash
pnpm --filter @cedar/mobile start
```

---

## TLS with Caddy

Edit `deploy/Caddyfile` to match your domain:

```
nagi.yourdomain.com {
    reverse_proxy kong:8000
}
```

Caddy automatically provisions a Let's Encrypt certificate. Your DNS must point to the server before starting.

---

## Updating

```bash
cd cedar
git pull

# Re-apply any new migrations
supabase db push --db-url postgresql://postgres:<POSTGRES_PASSWORD>@<host>:5432/postgres

# Restart containers to pick up new edge function code
cd deploy
docker compose restart edge-runtime
```

---

## Proxy override (LiteLLM / OpenRouter)

If you want to route AI calls through a proxy instead of Anthropic directly, set in `deploy/.env`:

```dotenv
ANTHROPIC_BASE_URL=https://your-litellm-instance.com
```

The edge functions respect this override. Any OpenAI-compatible proxy that accepts Anthropic-format requests will work.

---

## Security checklist

- [ ] `POSTGRES_PASSWORD` and `JWT_SECRET` are strong random strings (not the examples)
- [ ] `ANTHROPIC_API_KEY` is not committed to git
- [ ] Supabase Studio port (5555) is firewalled — not exposed to the public internet
- [ ] Postgres port (5432) is firewalled
- [ ] `SERVICE_ROLE_KEY` is never sent to the mobile client

---

## Troubleshooting

**Edge runtime not starting**: Check that `supabase/functions/` is mounted correctly and that `SUPABASE_URL=http://kong:8000` (not your public URL) in `.env`.

**Migrations fail**: Ensure Postgres is fully up (`docker compose logs db | tail -20`). The first boot can take 30–60 seconds.

**`ANON_KEY` / `SERVICE_ROLE_KEY` mismatch**: Re-derive both keys from the same `JWT_SECRET`. A mismatch here will cause all API calls to return 401.

**TLS certificate not provisioning**: Caddy requires port 80 to be reachable from the internet for the ACME challenge. Check firewall rules.

---

For questions and community support: [GitHub Discussions](https://github.com/your-org/cedar/discussions)
