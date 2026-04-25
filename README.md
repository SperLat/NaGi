# Cedar / Nagi (凪)

Open-source infrastructure for elder digital inclusion.

**Cedar** is the project. **Nagi** (Japanese 凪 — the calm after the storm) is the product.

Nagi helps trusted intermediaries — family members, caregivers, volunteers — support elders in adopting technology, without making that support a full-time job. The intermediary configures; the elder interacts; Nagi amplifies what already works.

---

## Quickstart (mock mode — no backend needed)

Fakes auth, AI, and persistence — useful for poking at the UI, useless for
evaluating the product end-to-end.

```bash
git clone https://github.com/SperLat/NaGi
cd NaGi
pnpm install
cd apps/mobile
cp .env.example .env          # defaults to EXPO_PUBLIC_MOCK_MODE=true
pnpm start
```

## Run the real product locally (recommended for evaluation)

If you want to actually exercise Nagi — sign up, create elders, invite
intermediaries, see help requests stream in over Realtime — bring up the
full Supabase stack on your laptop. No cloud accounts needed; everything
runs in Docker.

**→ See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)** for the
end-to-end walkthrough (clone → migrations → Anthropic key → two-browser
smoke test).

## Stack

- Expo Router + React Native + TypeScript
- Supabase (Auth, Postgres, Edge Functions) — self-hostable
- NativeWind (Tailwind CSS for React Native)
- Claude API (claude-haiku-4-5 + claude-sonnet-4-6)

## Self-hosting

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
