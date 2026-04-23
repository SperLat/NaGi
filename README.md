# Cedar / Nagi (凪)

Open-source infrastructure for elder digital inclusion.

**Cedar** is the project. **Nagi** (Japanese 凪 — the calm after the storm) is the product.

Nagi helps trusted intermediaries — family members, caregivers, volunteers — support elders in adopting technology, without making that support a full-time job. The intermediary configures; the elder interacts; Nagi amplifies what already works.

---

## Quickstart (mock mode — no backend needed)

```bash
git clone https://github.com/SperLat/NaGi
cd NaGi
pnpm install
cd apps/mobile
cp .env.example .env          # defaults to EXPO_PUBLIC_MOCK_MODE=true
pnpm start
```

## Stack

- Expo Router + React Native + TypeScript
- Supabase (Auth, Postgres, Edge Functions) — self-hostable
- NativeWind (Tailwind CSS for React Native)
- Claude API (claude-haiku-4-5 + claude-sonnet-4-6)

## Self-hosting

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
