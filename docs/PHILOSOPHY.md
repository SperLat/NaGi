# Nagi — Philosophy

> Open-source elder-companion software, built on the [Kasvu](https://kasvu.dev) philosophy of cultivation: greatness cannot be imposed from outside, it must grow from within.

**Status:** Upstream layer of the doc hierarchy. Bound by nothing; binds [PRINCIPLES.md](./PRINCIPLES.md) (the design constitution) and [BRAND.md](./BRAND.md) (the brand spine), which in turn bind [BRAND_MANUAL.md](./BRAND_MANUAL.md), [DESIGN_APP.md](./DESIGN_APP.md), and [DESIGN_WEB.md](./DESIGN_WEB.md).

```
PHILOSOPHY (why)
    ↓
PRINCIPLES (what to do)
    ↓
BRAND (how to express it)
    ↓
BRAND_MANUAL (concrete tokens)
    ↓
DESIGN_APP / DESIGN_WEB (specific application)
```

If a downstream document conflicts with this one, the downstream document is wrong.

---

## What Nagi serves today

Nagi today is a **home-care companion**: an AI an elder talks to, configured by the family member who knows them best. It is *not* (yet) institutional software for nursing homes or care facilities — those are adjacent products the open-source community is welcome to build. The philosophy below applies to any care-tech project built in this lineage; the scope of what we ship is narrower than the philosophy is broad.

---

## The core belief

Most care infrastructure is built like a statue. It starts with a fixed image of the correct care model, removes everything that does not conform, and optimizes for control and compliance. The result is precise but brittle — impressive in documentation, fragile in practice.

**Nagi is built like a garden.**

It begins not with a predetermined form, but with an honest understanding of what is already present in every elder–family relationship: the strengths, the tendencies, the natural direction of growth. It guides rather than forces. It reduces friction rather than adding procedure. It produces something resilient, alive, and capable of continuing to grow without constant intervention from above.

This is not a metaphor chosen for marketing. It is the operating philosophy behind every product decision.

---

## The name

**Nagi** (凪) is a Japanese word for the lull of the sea — the moment when wind stops and water goes mirror-flat. Mariners in Japan have always known to read this moment carefully: it is not permanent, it is a condition you earn through preparedness and patience. In family-led care, it names the environment that thoughtful, well-supported caregiving actually creates — not the absence of difficulty, but the presence of steadiness after it.

The kanji is a *kokuji* — a character born entirely in Japan — composed of:

- 風 (*kaze*) — wind, the forces that arrive and must be navigated
- 止 (*tomaru*) — to stop, to settle, to come to rest

For the elder, it is the feeling of being met without being managed. For the family, it is the experience of staying present without having to be physically there. For the open-source community building on this, it is what healthy care infrastructure feels like when it actually works.

---

## The parable behind the brand

The Kasvu philosophy is grounded in a parable of two artisans working in the foothills of the Danxia mountains. An Imperial Sculptor receives a decree to carve a perfect dragon from a flawless block of jade. He works with force, precision, and obedience to a fixed vision. The result is flawless and symmetrical. A Penjing Master works differently — she finds a small, gnarled Huangshan Pine struggling among rocks and spends years cultivating it: observing its spirit, guiding its branches, pruning for strength. When the Emperor visits both works, the jade dragon impresses him. The pine stops him. Its branches tell the story of struggle against wind. It is vibrant, resilient, and full of a character the jade dragon can never possess. The Master tells the Emperor:

> *"You asked the Sculptor to replicate greatness. I only cultivated resilience. Greatness was the consequence."*

That distinction is the heart of Kasvu, and the heart of Nagi. The people Nagi serves — both elders and the family members who care for them — are more pine than jade. They have been shaped by life, language, illness, distance, and love into unrepeatable forms. The software's job is to tend the conditions, not impose the shape.

---

## Voice principles

Before writing anything — documentation, interface copy, marketing, support messages — apply these four tests:

| Principle | What it means in practice |
|---|---|
| **Clarity over jargon** | Write so a tired family member at midnight can read it. If a term needs explanation, either define it once or replace it. |
| **Practice over abstraction** | Every feature has a real use case behind it. Name the use case, not the feature category. |
| **Resilience over performative perfection** | Be honest about limitations. Nagi is designed to improve through use, not to appear complete. |
| **Socratic and self-aware** | The software asks as much as it tells. Good care begins with good questions. |

### Tone

**Calm. Warm. Unhurried. Never clinical. Never cheerfully dishonest.**

Nagi does not speak like a compliance platform. It does not use the bureaucratic passivity of institutional care communication ("Wellness events are scheduled for...") nor the forced warmth of consumer wellness apps ("You're doing amazing! 🌟"). It speaks like a trusted colleague who has seen difficult moments and does not pretend otherwise.

**In practice:**

- Use plain declarative sentences. Subject, verb, object.
- Avoid nominalizations: "review" not "conduct a review of," "decide" not "make a decision about."
- Acknowledge difficulty without dramatizing it.
- Use active voice. Passive voice is a form of institutional evasion.
- End on the actionable, not the aspirational.

### Vocabulary

**Use these words:** cultivate, tend, notice, grow, steady, roots, honest, together, present, conditions, support, observe, care, resilience, stillness.

**Avoid these words:** optimize, streamline, leverage, synergy, seamless, best-in-class, revolutionary, disrupt, empower (when used vaguely), solutions, ecosystem (unless referencing Kasvu directly).

**On the word "care":** It is used deliberately and often. Do not replace it with "service delivery," "wellness management," or "client support." The people Nagi serves are *cared for*. The people using Nagi to do so are *caregivers*. These words carry moral weight. Use them.

### Two voice registers

Because Nagi has two surfaces, it has two voice registers:

**1. Family-facing (intermediary surface, English).** The voice principles above apply directly. The reader is a tired family member at their laptop after work. Examples:

- *"No conversations yet today. Worth checking in if that's unexpected."*
- *"Something didn't save. Your work is not lost — try once more."*
- *"This will remove the note permanently. Continue?"*

**2. Elder-facing (elder surface, multi-language).** A different register, for an 80-year-old who may be tired, alone, or under cognitive load. Codified in [`apps/mobile/src/lib/i18n.ts`](../apps/mobile/src/lib/i18n.ts):

- *"Hola, Margarita. Soy Nagi. Aquí estoy. ¿De qué te gustaría hablar?"*
- *"Listening… speak when you're ready."*
- *"I cannot respond right now. Call your family if you need help."*

Elder-facing voice rules:
- Shorter sentences than family-facing — under 12 words wherever possible.
- One question at a time. Never two requests in one breath.
- Address the elder by their preferred name as set in their profile.
- Never use loanwords ("link", "click", "scroll") — use natural language for their device.
- The full elder voice for the AI itself (Nagi's own warmth, when it talks back) lives in [`supabase/functions/_shared/anthropic.ts`](../supabase/functions/_shared/anthropic.ts) — that is the source of truth for AI tone.

---

## What Nagi is not

These distinctions are as important as the definitions above. Nagi should be actively distinguishable from:

**Not a compliance platform.** Compliance is a floor, not a ceiling. Nagi helps families exceed it through genuine presence, not documentation performance.

**Not a wellness app.** Nagi does not use gamification, streaks, badges, or motivational language. Care is serious work. The software treats it that way.

**Not a surveillance tool.** Data Nagi collects exists to support the elder and the family member, not to monitor, score, or discipline anyone. This is architecturally enforced (RLS, no admin override), not just promised.

**Not a hardware lock-in.** Run Nagi on the device you already own. There is no Nagi Tablet™ to buy. The hardware-lock-in incumbents (GrandPad, ElliQ, Aloe, Lively) own the device and the subscription. Nagi owns neither.

**Not a finished product.** Like the Penjing pine, Nagi grows through honest engagement with real conditions. Every version is an iteration, not a final form.

**Not Kasvu.** Nagi is *built on* Kasvu. Kasvu is the broader philosophy of cultivation; Nagi is one expression of it in software form. Kasvu is broader than any single product; Nagi should not claim to represent the whole philosophy.

---

## Open-source as a values commitment

Care infrastructure should not be proprietary, closed, or dependent on a single vendor's survival. Nagi is open source not as a distribution strategy, but as a values statement:

- Every design decision is documented with its reasoning, not just its outcome
- Every elder profile, every skill file, every UI string is editable, forkable, and improvable by the community
- The roadmap is public and informed by the people actually using the software
- Contributions are welcomed with the same criteria Kasvu uses: *Is it aligned with the spirit? Does it add something genuinely useful? Can a real family member use it without translation?*

The Nagi software is released under **Apache License 2.0** (see [LICENSE](../LICENSE)) — an OSI-approved permissive license that allows commercial reuse, adaptation, and self-hosting without restriction. The brand assets and documentation are released under **CC BY 4.0** so that organizations self-hosting Nagi for paying clients can use the materials freely with attribution.

The philosophy itself — Kasvu — is released by its maintainers under CC BY-NC-SA 4.0, with an explicit carve-out for software implementations in the elder-care, caregiving, and community-health domains. Nagi falls under that carve-out; downstream Nagi forks inherit the Apache 2.0 software license.

---

## Contribution voice

When communicating with contributors — developers, designers, family members, translators — use the same voice as the product. Honest, direct, warm.

**Opening line for contributor documentation:**

> Nagi is not finished. It is not meant to be. The best thing you can bring is not a perfect pull request — it is a real problem you encountered with an elder you love, and an honest idea about how to address it.

---

## Quick reference

| Question | Answer |
|---|---|
| What is Nagi? | Open-source AI companion for elders, configured by family. |
| What philosophy is it built on? | Kasvu — cultivation over imposition. |
| Who shapes the AI's behavior? | The family member, via the elder's profile. |
| Where does the elder use it? | Their own device — phone, tablet, or computer. |
| Where does the family member use it? | A web dashboard. |
| What does it cost? | Free to self-host. You pay your own AI costs (Anthropic API). |
| What is the tagline? | *Where care grows still.* |
| Voice in three words? | Calm. Honest. Unhurried. |
