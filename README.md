# Cedar / Nagi (凪)

> By 2030, over **1.4 billion people** will be 65 or older — three out of every ten adults in many countries. Most of the apps their families take for granted weren't built for them. The result is a quiet exclusion: from grandchildren's photos, from medical portals, from the ordinary digital fabric of a family's life.

**Nagi** is open-source infrastructure for closing that gap. Not a locked-down launcher, not a panic-button device — an AI-native companion the elder talks to, configured by the people who love them.

**Cedar** is the project. **Nagi** (Japanese 凪 — the calm after the storm) is the product.

---

## What's different

Other senior-care software falls in two camps:

1. **Hardware lock-in** — GrandPad, ElliQ, Aloe, Lively. $99–$500 device + $30–$70/month, on the vendor's stack.
2. **Facility B2B SaaS** — PointClickCare, MatrixCare, AlayaCare. Per-bed contracts for nursing homes.

Nagi is neither.

| Axis | Incumbents | Nagi |
|---|---|---|
| **Distribution** | Hardware lock-in or facility contracts | Open source, BYO-device, self-hostable |
| **Pricing** | Device + subscription | Free to self-host (you pay your own AI costs) |
| **Elder surface** | Locked-down launcher, telephone-style UI | AI chat + voice as the *primary* interaction |
| **Intermediary surface** | Activity feed for families | First-class configurator: shapes how the elder's AI behaves |
| **Data ownership** | Vendor cloud | Your own Postgres |

The differentiator the rest of the market can't follow without rebuilding from scratch: **AI-native + open-source + intermediary-as-configurator**. Nobody else is treating the family member as the person who *teaches the AI how to be present* with their parent.

---

## How it works

Two surfaces, one database.

**Elder surface** (mobile/tablet, voice-first):
- Big-text, calm, one-thing-at-a-time AI chat
- "I need help" button that pages a real person
- Offline-tolerant — never tells the elder something failed

**Intermediary surface** (web, configurator):
- Per-elder dashboard: today's questions, where they got stuck, last words they said to Nagi
- About profile (preferred name, languages, topics, accessibility, trusted contact) — feeds straight into the AI's system prompt
- Conversations transcript, shared notes journal, care-team chat
- Weekly digest you can forward to a sibling

The AI learns the elder through **runtime skills** (`.claude/skills/`) selectively loaded based on the profile — Spanish or English communication, cognitive accessibility, low-vision description, dementia-aware redirection, common-tasks reference. Skill files are plain markdown, PR-able by anyone.

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
- Supabase (Auth, Postgres, Edge Functions, Realtime) — self-hostable
- NativeWind (Tailwind CSS for React Native)
- Claude API (claude-haiku-4-5 for classification, claude-sonnet-4-6 for chat + digest)
- `.claude/skills/` — runtime AI skill files in plain markdown

## Self-hosting

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

---

## Roadmap & open-source vision

Nagi is built to be a *platform*, not a single app. The pieces below are
out of scope for what we ship — they're invitations for the community.

**Adjacent surfaces we'd love to see**
- Clinic / agency adoption — non-profit Area Agencies on Aging running their own Nagi instance for client elders
- Mexico / LATAM-specific persona packs — culturally-grounded skills for *abuela* registers, *novelas*, regional Spanish, Catholic liturgical calendar
- Family-organization templates — "extended family", "nursing home staff", "neighborhood mutual aid" presets

**Hardware bridges**
- Matter / IoT integration — pill dispensers, motion sensors, smart-home automations triggered by elder voice intent
- Fall detection sensor packs (Apple Watch, smartphone accelerometer, dedicated wearables)
- E-ink companion device for ambient digest delivery

**AI layer extensions**
- Multimodal: intermediary uploads a doctor's letter or med list, Nagi extracts structured data (Anthropic vision API)
- Long-running async agents for "research my mom's pharmacy hours and refill options"
- Live web search per chat turn (currently we keep latency low by skipping this)

**Community needs we won't build but want**
- Spanish-language mental-health crisis training data for the safety layer
- Open evaluation set for elder-AI conversation quality (right now this is vibes)
- Translations of the elder UI into more languages

If any of these resonate, open an issue or PR. The code is intentionally
small enough to read in an afternoon.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
