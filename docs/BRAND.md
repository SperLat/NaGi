# Nagi — Brand Spine
**Status:** Authoritative | **Date:** 2026-04-22 | **Owner:** ALMA (voice) + Kronos (discipline)
**Bound by:** [PRINCIPLES.md](./PRINCIPLES.md) — every brand decision must trace back.

This is the **spine**. The full manual, app design, and web design must all reference this file and never contradict it. If a downstream choice conflicts with this document, the downstream choice is wrong.

---

## 1. North Star

A trusted human helped you set this up. The screen you are looking at was prepared for you by someone who knows you. Nothing here will surprise you.

That sentence is the entire brand. Every visual, every word, every motion exists to make it feel true.

### 1.1 Tagline

> **Where care grows still.**

This is the public-facing distillation — used as the signature on marketing surfaces, beneath the wordmark in lockup, and as the close of the demo video. It joins Kasvu's growth language with Nagi's earned stillness. Use it in full lockup with the wordmark, in brand advertising, and as the signature of official communications. **Do not use it inside product UI** — the product earns its calm through the experience itself, not through a slogan repeated on screens.

---

## 2. Name

**Nagi** — Japanese 凪. The calm that arrives after the storm at sea. Not absence of weather — the moment the wind drops and the surface goes still.

Pronounced: *NAH-ghee*. Two syllables. Soft g.

Use the kanji 凪 sparingly — only as a mark, never as body text. It is a quiet signature, not a logo system.

Project name (repository, technical artifacts, contributor docs): **Cedar**. Consumer product (anywhere a user sees it): **Nagi**. Never mix.

---

## 3. The Two Audiences

Every surface speaks to exactly one of these two people. Mixing them is the most common failure mode.

| | **The Intermediary** | **The Elder** |
|---|---|---|
| Who | Adult child, caregiver, volunteer | Someone's grandmother, father, neighbor |
| State of mind | Trying to help without becoming tech support | Wants to feel capable, not corrected |
| What they need | Confidence the setup is right | Confidence the next tap will work |
| Density tolerance | Medium (lists, status, configuration) | Very low (one card, one action) |
| Reading speed | Skimming | Slow, deliberate |
| Failure cost | Frustration | Withdrawal |

**Rule:** if a screen serves both audiences at once, it serves neither. Split the surface.

---

## 4. Voice

Three notes, in order of priority:

**Warm.** Speak like a thoughtful family member, not a product. Use first names where possible ("Rosa, your message is on its way"). Never "the user."

**Calm.** Short sentences. No exclamation points. No urgency unless someone's safety is involved. The product has nowhere else to be.

**Precise.** Say exactly what happened or what will happen. Vague reassurance ("Almost there!") is dishonest and reads as condescension. Honest specificity ("Saved. Your daughter will see this.") builds trust.

**One promise per sentence.** Two promises in one sentence read as marketing.

---

## 5. Tone Scales

The voice is constant. The register shifts.

### Elder surface
- **Person:** second person, named when possible. *"Rosa, ¿quieres llamar a Carmen?"*
- **Verb mood:** invitation, never command. *"Si quieres, toca aquí."* Not *"Toca aquí para continuar."*
- **Time references:** human time. *"hace un momento"*, *"esta tarde"*. Never *"hace 14 minutos"*.
- **Errors:** never say *error*. Say *un momento*, *vamos a intentar de nuevo*, *Carmen va a saber que estás esperando*.
- **Confirmation:** confirm with presence, not with a checkmark. *"Tu mensaje llegó. Carmen lo va a ver pronto."*

### Intermediary surface
- **Person:** second person, professional. *"You configured Rosa's home screen 2 days ago."*
- **Verb mood:** declarative + invitational for actions. *"Add a card"*, *"Update language"*.
- **Time references:** specific. *"Last activity: 2h ago"*, *"Configured Mon Apr 20"*.
- **Errors:** named, with cause and recovery. *"Couldn't reach the server. Your changes are saved locally and will sync when reconnected."*
- **Status:** factual, no emoji decoration. *"3 messages today"*, not *"🎉 3 messages today!"*.

---

## 6. Banned Moves

These are non-negotiable. Catching one is grounds to revise.

- **Infantilization.** No baby-talk, no "easy mode" framing, no "for seniors" anywhere visible. The product is *for them*; it does not announce that fact.
- **Tech jargon on the elder surface.** No *sync*, *cache*, *offline*, *AI*, *server*, *account*. If a concept must surface, translate it. *Sync error* → *un momento, ya casi*.
- **Achievement theater.** No badges, no streaks, no "Great job!" celebrations. Confidence is not a reward; it is a side effect of things working.
- **Persuasive UI.** No "Are you sure?" friction designed to retain. If the elder wants to leave a screen, they leave.
- **Decorative motion.** Animation must serve recognition or continuity. Motion that exists to delight is removed.
- **Logo flourish.** No gradients on the wordmark. No drop shadows. No animated logo. Nagi is a quiet word.
- **Stock imagery of elders smiling at tablets.** This is the single most banned visual category. It is the symbol of every product that failed this audience.

---

## 7. Visual Ground Rules

The full manual will define tokens. This section defines **intent**, which the tokens must serve.

### Color
- **Background dominance.** The dominant color on every surface is a soft, warm off-white or a deep, warm near-black. Saturated color is a guest.
- **One accent per screen.** Pick one warm accent for the primary action. Everything else is neutral.
- **Never red for "no" on the elder surface.** Red is reserved for safety-critical signals (e.g., "Necesito ayuda" — the help button). Routine "cancel" is gray, not red.
- **High-contrast mode is not optional.** Every color pair must pass WCAG AA at minimum, AAA for body text on the elder surface.

### Type
- **Two families maximum.** A humanist sans-serif for UI, optionally one serif for editorial moments (about page, principles).
- **Elder surface starts at 20px.** No text smaller than 18px on any elder screen, ever. Text scales `lg`, `xl`, `2xl` from NativeWind must remain legible at the user's chosen system size.
- **Line height generous.** Body text at 1.5–1.6. Tight typography is for marketing, not for use.
- **Numerals tabular** in any data context (activity logs, timestamps, balances).

### Space and rhythm
- **Calm is geometric.** Generous padding, consistent spacing scale, large tap targets (≥44px, prefer 56px on the elder surface).
- **One card, one purpose.** No card combines a primary action with secondary metadata in a way that creates ambiguity about what tapping does.
- **Empty states are not failures.** An empty list says *"Cuando Carmen te escriba, va a aparecer aquí."* — not *"No messages yet."*

### Motion
- **Purpose-driven.** Motion confirms an action happened, signals where attention should go, or maintains spatial continuity. Nothing else.
- **Slow.** 200–300ms on the elder surface, 150–200ms on the intermediary surface. Never under 120ms.
- **Reduced motion respected.** If the OS reduce-motion flag is set, transitions become opacity-only.

### Iconography
- **Sparing.** Icons supplement labels, never replace them on the elder surface.
- **One stroke weight.** Consistency is recognition.
- **No metaphors that require cultural fluency.** A folder is fine. A "hamburger" is not (the elder surface has no hidden navigation anyway).

---

## 8. Naming Patterns

### Product surfaces
- *Inicio* (elder home) — never *Dashboard*, never *Home*
- *Mensajes* (chat with intermediary or AI) — never *Conversations*, never *Threads*
- *Necesito ayuda* (help button) — exact phrase, never abbreviated, never translated to *Help*
- *Configurar* (intermediary action) — never *Settings*, never *Preferences*

### System actions (intermediary surface, English okay)
- *Add elder*, *Configure*, *Activity*, *Organization*. Verbs first.
- Never *Manage*. Manage hides what the action actually does.

### Error and empty states
Pattern: **what happened → what we are doing → what they can do**.

> Couldn't reach the server. Your changes are saved on this device. They will sync when you're connected again. *(intermediary)*

> Un momento. Estamos guardando tu mensaje. Carmen lo va a ver pronto. *(elder, even if technically the network is down)*

---

## 9. Copy Spine — Paired Examples

| Context | Banned | Required |
|---|---|---|
| Elder home greeting | "Welcome back, User!" | "Hola, Rosa." |
| Elder action prompt | "Tap a card to begin." | (no instruction — the cards are the instruction) |
| Elder error | "Network error. Please retry." | "Un momento. Ya casi." |
| Elder confirmation | "Message sent successfully ✓" | "Listo. Carmen lo va a ver pronto." |
| Elder empty state | "No activity yet." | "Cuando Carmen te escriba, va a aparecer aquí." |
| Intermediary status | "🎉 Rosa logged in 3 times today!" | "Rosa opened the app 3 times today." |
| Intermediary error | "Failed to save." | "Couldn't save. Your draft is on this device — try again when ready." |
| Intermediary CTA | "Get started for free!" | "Set up your first elder." |
| Marketing headline | "AI-powered elder care companion." | "A trusted human helped set this up." |
| Marketing subhead | "Empowering seniors with technology." | "Nagi is the calm a family member leaves behind on the screen." |

---

## 10. Posture for the Open-Source Audience

Nagi software is **Apache License 2.0** (see [LICENSE](../LICENSE)). Brand assets and documentation are **CC BY 4.0**. The Kasvu philosophy (the upstream lineage) is CC BY-NC-SA 4.0 with a specific carve-out for software implementations in the elder-care, caregiving, and community-health domains — Nagi falls under that carve-out. See [PHILOSOPHY.md](./PHILOSOPHY.md) for the full lineage.

The codebase will be read by developers, NGOs, and clinicians evaluating it for their own deployments. The brand for that audience has the same voice but a different surface: technical, complete, not ashamed of the seriousness of the problem.

- **README and docs:** plain English, no marketing varnish. Show the architecture, name the trade-offs, link the principles.
- **Hosted version vs self-host:** named clearly, no upsell pressure. The hosted version exists because someone has to run it; the self-host path is first-class.
- **Contributor voice:** invitational, specific. *"Issues labeled `good-first-issue` are scoped for an afternoon."* Not *"Join our community!"*

---

## 11. What This Spine Hands Off

The full **Brand Manual** must define, not redefine:
- Color tokens (hex + WCAG-pair table)
- Type stack (font families, weights, scale, line height)
- Spacing scale (matched to NativeWind defaults where possible)
- Component vocabulary (cards, buttons, inputs, sheets) for both surfaces
- Iconography rules and starter set
- Motion timing curves
- Logo construction and clear-space rules
- Asset deliverables list (favicon, social cards, app icon, splash)

The **App Design** spec must apply this spine to the 12 existing routes in `apps/mobile/app/`, route by route, with NativeWind class hints and component composition notes.

The **Web Design** spec must apply this spine to a single-page marketing site at `nagi.app` (or chosen domain), 5–7 sections, optimized for the intermediary as primary visitor and the technical/clinical evaluator as secondary.

---

## 12. Verification Bar for Downstream Work

A brand artifact is ready when:
1. Every visual decision can be traced to a numbered section above
2. No banned move (§6) appears anywhere
3. Every elder-surface example passes the §9 paired-example test
4. Every color pair passes WCAG AA, AAA where §7 requires
5. The word "user" does not appear in any user-facing copy
6. No stock image of an elder smiling at a device exists in the asset set
7. The intermediary and elder surfaces are visually distinct enough that an outsider can identify which is which without context

If any item fails, the artifact returns for revision.

---

*Authored under Kronos discipline. Voice principles by ALMA. Bound to [PHILOSOPHY.md](./PHILOSOPHY.md) (upstream lineage) and [PRINCIPLES.md](./PRINCIPLES.md) (design constitution). Licensed CC BY 4.0 — share freely, attribute Cedar.*
