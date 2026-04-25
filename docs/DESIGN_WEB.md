# Nagi — Web Design Spec
**Status:** Single-page marketing site, implementation of [BRAND.md](./BRAND.md) via [BRAND_MANUAL.md](./BRAND_MANUAL.md) | **Date:** 2026-04-22
**Bound by:** BRAND.md (spine), BRAND_MANUAL.md (tokens), PRINCIPLES.md (constitution).
**Domain plan:**
- **Hackathon demo:** `nagi.kasvu.dev` (subdomain on Kasvu infra; signals the lineage to judges; zero registration cost).
- **Defensive registration:** `iamnagi.org` (acquired separately; the .org TLD signals non-commercial/community alignment with the Apache 2.0 + open-source posture).
- **Premium-if-affordable:** `nagi.care` (~$80–120/yr if available — the most semantically perfect TLD; redirect to `iamnagi.org` if acquired).
- **Not pursuing:** `nagi.com`, `nagi.app` — both taken or unavailable; no rebrand is worth losing the kokuji story for.

---

## 0. Audience and register

Per BRAND.md §3 and §10:
- **Primary visitor:** the **intermediary** evaluating whether Nagi is right for their family/parent/grandparent.
- **Secondary visitor:** the **technical/clinical evaluator** (developer, NGO ops, clinician) considering self-hosting or contribution.
- **Never the visitor:** the elder. The elder does not visit a marketing site. Therefore the entire register is BRAND.md §5 *intermediary*: second-person professional, declarative, time references specific, status factual.

The site does not pretend to address two audiences in parallel. The intermediary is the spine; the technical audience is served by one dedicated section + the README link, not by re-skinning the homepage.

---

## 1. Information architecture — 6 sections

Hard cap. Anything beyond is post-launch (§8 below). In order:

1. **Hero** — The §1 north-star sentence as the hero
2. **The two surfaces** — intermediary and elder, side-by-side
3. **How it works** — 3 beats, each one sentence
4. **Open-source posture** — MIT, self-host, hosted-tier model
5. **For developers and clinicians** — technical entry point
6. **Try it** — mock-mode quickstart, 4 lines of bash
7. **Footer** — links, license, principles

(The brief specified 5–7 sections; this is 6 plus the footer. The "Two surfaces" section is non-negotiable per BRAND.md §3 — without it the site does not represent the product.)

---

## 2. Section-by-section design

### Section 1 — Hero

**Purpose:** In one screen, the visitor knows whether Nagi addresses their problem. The §1 north-star sentence does the work; everything else is silent.

**Headline (verbatim):**
> A trusted human helped you set this up. The screen you are looking at was prepared for you by someone who knows you. Nothing here will surprise you.

Set in **Source Serif 4**, weight 400, size `clamp(2rem, 5vw, 3.5rem)`, line-height 1.25, max-width `42ch`. Color `neutral-800` on `surface-elder`. The sentence breaks into three lines on desktop, each a soft beat.

**Subhead (single line):**
> Nagi is the calm a family member leaves behind on the screen.

Inter weight 400, `text-xl`, `neutral-600`, max-width `48ch`, mt-8.

**Supporting copy:** none. The hero has one promise (BRAND.md §4).

**Visual element direction:** the hero has no image. A single 凪 mark (BRAND_MANUAL §1.2) in `accent-primary` at 80px sits above the headline, centered. No photograph. **Explicit ban:** no stock photo of an elder, no rendered phone-in-hand mockup, no abstract gradient. The white space is the visual.

**CTA:** none in the hero. Per BRAND.md §10 anti-marketing posture; the only "action" the visitor can take is to scroll or click *Try it* in the nav. *No "Get Started" button — the experience is Try it.*

---

### Section 2 — The two surfaces

**Purpose:** Make the §3 brand bifurcation visible. This is what makes Nagi unmistakable from any other "elder care app" — most competitors collapse both audiences into one screen.

**Headline:**
> Two screens, one promise.

Inter, `text-3xl` weight 700, `neutral-800`, centered.

**Subhead:**
> The person setting up sees what they need to set up well. The person using sees one card and one moment.

`text-lg`, `neutral-600`, max-width `52ch`, centered.

**Supporting copy:** below, two side-by-side panels. Each is a real product UI screenshot (per visual moodboard §4 below) plus a 3-line caption.

| Left panel — Intermediary | Right panel — Elder |
|---|---|
| Screenshot: `(intermediary)/elders/[id]/index.tsx` (Rosa overview) | Screenshot: `(elder)/index.tsx` (4-card home, Hola Rosa) |
| Caption headline: *"You configure once."* | Caption headline: *"They use freely."* |
| Body: *"Choose the language. Pick the four cards that matter. Set the text size. Adjust whenever you want — they won't notice the change mid-session."* | Body: *"No menus, no settings, no surprises. Their grandmother's name at the top, four familiar choices, one button if anything goes wrong."* |

Background: left panel `surface-intermediary` (#F6F5F2), right panel `surface-elder` (#FBF7F0). The visual contrast IS the point.

**Visual element:** real product UI. No mockups, no Figma frames pretending to be screenshots, no device-frame chrome. Pixel-accurate captures from mock-mode-running app.

**CTA:** none.

---

### Section 3 — How it works

**Purpose:** Three beats. Anyone reading this section in 12 seconds can explain Nagi to someone else.

**Headline:**
> How it works.

`text-3xl` weight 700, `neutral-800`, left-aligned at section start.

**Three beats** (numbered, vertical stack on mobile, horizontal three-column on desktop):

**1. You set up.**
*Add the person you support. Pick their language. Choose their starting cards. Takes about three minutes.*

**2. They use.**
*They open the app. Their name is at the top. They tap a card and Nagi handles the rest — calling family, asking a question, finishing one task.*

**3. You stay close.**
*You see what they did, where they got stuck, and when they reached out. Adjust their interface from your phone. They never see the changes until next time they open it.*

Each beat: a numbered glyph (Inter `text-5xl` weight 200, `accent-primary`, just the number in tabular numerals), then a `text-xl` weight 600 headline, then a `text-base` body in `neutral-600`. No icon, no illustration — the number is the visual.

**Visual element:** none beyond typography.

**CTA:** none.

---

### Section 4 — Open-source posture

**Purpose:** Address the trust-and-control question that an evaluating intermediary or clinician will ask before recommending to their family/team.

**Headline:**
> MIT-licensed. Self-host or run hosted. Either is first-class.

`text-3xl` weight 700, `neutral-800`.

**Subhead:**
> We borrowed this model from Bitwarden. The code is on GitHub. Run it on your own infrastructure if you want full control. Use the hosted tier when you want someone else to keep it running.

`text-lg`, `neutral-600`, max-width `60ch`.

**Three-column body:**

| Self-hosted | Hosted (free, small NGOs) | Hosted (paid, enterprise) |
|---|---|---|
| Run the full stack on your own VPS. We provide docs, Docker compose, and migrations. | We run it for small organizations under a usage cap. Coming soon. | Managed instance with SLA and admin tools. Coming soon. |
| `Available now` | `v1` | `v1` |

(Per ARCHITECTURE §6.3, only self-hosted ships in v0. Honest labeling.)

**Visual element:** none. Plain three-column text on `surface-intermediary`.

**CTA:** *"Read the self-hosting guide"* — links to `docs/SELF_HOSTING.md` on GitHub. Inline `accent-primary-ink` link, not a button.

---

### Section 5 — For developers and clinicians

**Purpose:** Technical entry point. Per BRAND.md §10 — invitational, specific, no marketing varnish.

**Headline:**
> For the people who'll deploy this.

`text-3xl` weight 700, `neutral-800`.

**Subhead:**
> The architecture, principles, and trade-offs are in the docs. Issues labeled `good-first-issue` are scoped for an afternoon.

`text-lg`, `neutral-600`.

**Three link cards** (no graphics, just typography in `surface-intermediary-raised` cards):

- **Architecture** — *"How sync, AI caching, and tenancy fit together."* → `docs/ARCHITECTURE.md`
- **Principles** — *"The product constitution. Where every design decision starts."* → `docs/PRINCIPLES.md`
- **Brand spine** — *"What we will not do, and why."* → `docs/BRAND.md`

Cards: `bg-surface-intermediary-raised border border-neutral-100 rounded-2xl p-6`, hover state `border-accent-primary` (web only — no hover on mobile per BRAND_MANUAL §8.4).

**Visual element:** none.

**CTA:** *"View the repository on GitHub"* — single inline link, `accent-primary-ink`.

---

### Section 6 — Try it

**Purpose:** The site's only conversion. Replaces a "Get Started" button with the actual command.

**Headline:**
> Try it now. No backend, no account, no signup.

`text-3xl` weight 700, `neutral-800`.

**Subhead:**
> Mock mode runs the entire app on your machine with seeded data. You'll see both surfaces in about five minutes.

`text-lg`, `neutral-600`.

**Code block** — the only code on the site, exactly four lines (matches README quickstart):

```bash
git clone https://github.com/cedar-project/cedar
cd cedar/apps/mobile
cp .env.example .env
pnpm install && pnpm start
```

Code block styling: `bg-surface-dark` `#1A1714`, `text-accent-primary-soft`, monospace (`ui-monospace, 'SF Mono', Menlo, monospace`), `text-base`, padding `p-6`, `rounded-2xl`, `font-variant-numeric: tabular-nums`. A single small "copy" affordance in the upper right (Lucide `Copy` icon, 16px, `accent-primary-soft`, no label). No syntax highlighting beyond the foreground color.

Below the block, a single line in `text-sm neutral-500`:
> *Requires Node 20, pnpm. Expo Go on your phone if you want to see it on a real device.*

**Visual element:** the code block IS the visual.

**CTA:** the code (copy command). No button.

---

### Section 7 — Footer

**Purpose:** Links and the dignifying close.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  凪  Nagi          GitHub  Docs  Principles  Self-host    │
│                                                          │
│  Cedar — open-source infrastructure for elder digital    │
│  inclusion. Licensed MIT.                                │
│  Brand and docs licensed CC BY 4.0 — share freely,       │
│  attribute Cedar.                                        │
│                                                          │
│  Built in Costa Rica.                                    │
└──────────────────────────────────────────────────────────┘
```

`bg-surface-dark`, `text-neutral-300` body, `text-accent-primary-soft` for nav links. The 凪 mark in `accent-primary`.

No newsletter capture. No social icons. No "made with love" closer.

---

## 3. Navigation

Per the brief: minimal. No "Get Started" button.

```
┌──────────────────────────────────────────────────────────┐
│ 凪 Nagi    Two surfaces  How it works  Open source  Try it    GitHub │
└──────────────────────────────────────────────────────────┘
```

- Logo left: 凪 in `accent-primary` 24px + Nagi wordmark Inter weight 600 18px in `neutral-800`. Logo links to `/`.
- Anchor links centered (or right on narrower viewports): `text-base text-neutral-600`, hover `accent-primary-ink`. Links to `#two-surfaces`, `#how-it-works`, `#open-source`, `#try-it`.
- GitHub right: text link *"GitHub"* with Lucide `Github` icon 16px.
- Sticky on scroll, `bg-surface-elder/95 backdrop-blur` (web supports backdrop-filter; mobile site does not need backdrop, falls back to solid).
- Height: 64px desktop, 56px mobile.

**No hamburger menu.** On mobile, the nav links collapse into a single anchor list below the logo — visible, not hidden behind a tap. This is BRAND.md §7 ("no metaphors that require cultural fluency") applied to the marketing site.

---

## 4. Visual moodboard direction

### 4.1 Photography (post-launch only — NOT in v0 site)

If photography is added in a future iteration, the photographer brief is:

> Document a person in their home, doing one task with calm attention. The phone is incidental — present, not centered. The person is the subject, framed at eye-level. Natural light, no styling, no scripted smile. The image should read as a portrait of dignity, not a product demonstration.

**Banned:** smiling-grandmother-with-tablet (BRAND.md §6 single most banned visual). Hands-only shots. Stock images of any kind. Studio lighting. Phones held up at the camera.

For v0, **no photography**. The site has no photographic asset.

### 4.2 Illustration

Optional alternative for v0 if the site reads too austere in QA review: editorial illustrations in a single muted palette derived from the brand tokens (`accent-primary`, `neutral-500`, `surface-elder-sunken` only). Subject restricted to objects: a window, a teapot, a hand resting on a table. Never a face. Never a device. One illustration per page maximum.

If illustration is not commissioned in time for launch, the site ships without it. Typography and white space carry the visual load.

### 4.3 UI screenshots

Real product UI, captured from mock mode. Both surfaces shown in pairs (Section 2). Captures must include the full screen including SafeArea — no cropping that hides the help button, no faked status bars.

### 4.4 Color application across sections

| Section | Background | Notes |
|---|---|---|
| Hero | `surface-elder` `#FBF7F0` | Warm dominant — sets the calm |
| Two surfaces | Split: left `surface-intermediary`, right `surface-elder` | The contrast IS the message |
| How it works | `surface-elder` | Continuity from hero |
| Open source | `surface-intermediary` | Cooler, denser-tolerant — matches the audience shifting toward evaluative |
| For devs | `surface-intermediary` | Same |
| Try it | `surface-elder` with `surface-dark` code block inset | Returns to warmth, code is the dark moment |
| Footer | `surface-dark` `#1A1714` | The settled close |

This deliberate alternation lets the visitor *feel* the two surfaces without needing the side-by-side panels to do all the work.

---

## 5. Responsive behavior

**Mobile-first.** The site is designed at 375px wide and scales up.

| Breakpoint | Layout shifts |
|---|---|
| ≤640px (mobile) | Single column. Two-surfaces panels stack vertically, intermediary above elder. How-it-works beats stack vertically. Three-column tables in §4 and §5 stack to single column. Nav anchors visible below logo. |
| 641–1024px (tablet) | Two-surfaces panels go side-by-side. How-it-works stays vertical. Nav inline. |
| ≥1025px (desktop) | How-it-works goes three-column. All other sections unchanged. Max content width 1120px, centered. |

Padding: section vertical `py-16` mobile, `py-24` tablet, `py-32` desktop. Horizontal `px-6` mobile, `px-12` tablet, `px-16` desktop.

No horizontal scroll. No fixed-position elements other than the nav. No carousels (BRAND.md §6: "decorative motion banned" applies — a carousel is decorative motion masquerading as content).

---

## 6. Performance and accessibility constraints

**Stack:** **Astro** (static site generator).

Justification (2 sentences as required): Astro produces zero-JS-by-default output, which is the only way to hit the LCP target on 3G with a self-hostable build artifact. Next.js static export is an alternative, but it ships React runtime by default for any island of interactivity, which we don't need on a six-section static page.

**Performance budget:**
- LCP ≤ 1.5s on simulated Slow 4G (3G is the brief's target; Astro can hit 1.5s on Slow 4G with the asset budget below — 3G LCP target ≤ 2.5s)
- Total page weight ≤ 250KB gzipped (HTML + CSS + Inter subset + Source Serif subset + 2 PNG screenshots optimized)
- 0 JavaScript on initial load (the copy-code-block button is the only JS, deferred and ≤2KB)
- No web fonts via blocking link — both fonts subset and self-hosted, `font-display: swap`, woff2 only
- Two screenshot PNGs (Section 2): max 80KB each, served as `<img loading="lazy" srcset>` with AVIF first

**Accessibility (WCAG AA throughout, AAA where the spine §7 demands):**
- All color pairs match BRAND_MANUAL §3.5 measured ratios
- `prefers-reduced-motion` honored: no smooth-scroll on anchor click, no hover transitions
- Focus rings: 2px `accent-primary` outline-offset 2px on all interactive elements
- Skip-to-content link (visible on focus) in nav
- Headings semantically nested: one `h1` (Hero subhead), `h2` per section, `h3` for nested
- `lang="en"` root with `lang="es"` overrides on any Spanish phrases (none in v0 site copy)
- Tap targets ≥44px on mobile per BRAND_MANUAL §5.2

---

## 7. Copy register — explicit binding

Per BRAND.md §5 intermediary register, **the entire site is in English** (Spanish is the elder-product language; the marketing site addresses intermediaries who are evaluating in their working language, English-default for the open-source/clinical audience).

- Person: second person, professional. *"You configure once. They use freely."*
- Verb mood: declarative + invitational. *"Try it now."* not *"Get started today!"*
- No exclamation points anywhere. (Search the final copy for `!` — must return zero.)
- Time references: specific. *"Takes about three minutes."* not *"Quick and easy!"*
- Errors / 404 page: *"This page doesn't exist. Go to the homepage or browse the docs."* — never *"Oops!"*, never *"We can't find that page!"*

**The word "user" does not appear** anywhere on the site (BRAND.md §12.5). Verified by grep.

---

## 8. Post-launch — what NOT to build for v0

Explicit cuts. Anything in this list appearing in the v0 site is a scope violation per BRAND.md §10's frugality posture.

- **No Spanish translation of the marketing site.** v0 is English-only. The intermediary in LATAM evaluating Nagi is bilingual; the elder never visits the site. Translating splits maintenance for zero new audience reached. Defer to v1.
- **No blog.** A blog implies a content cadence the team cannot honor in v0 and dilutes the spine.
- **No multiple landing pages per audience.** The brief specified 5–7 sections; one page is correct. *"For families"* / *"For NGOs"* / *"For clinicians"* split-pages are a v1+ consideration once we have any deployment data.
- **No newsletter signup.** Per BRAND.md §10 anti-marketing posture and §6 ban on persuasive UI. The audience reaches us via GitHub, not a mailing list.
- **No testimonials or quotes.** We do not have deployments yet. Fabricating or staging quotes violates §4 (precise) and §6 (achievement theater adjacent).
- **No press / "as featured in" strip.** Same reason.
- **No comparison table** ("Nagi vs. competitors"). Off-tone, off-brand, off-spine.
- **No interactive product demo embedded in the page.** *Try it* is the demo — the actual app, not a sandboxed iframe. An embedded demo is decorative; the real one is honest.
- **No animation on scroll.** Decorative motion ban (§6) applies to web. Sections appear. They do not fade in.
- **No dark mode toggle.** The site has one mode. The footer is dark; the rest is warm. That is the entire light/dark story.
- **No cookies, no analytics, no third-party scripts in v0.** A static site needs none of these. If usage signal is needed in v1, server-log analytics (no JS, no client-side tracking) only.

---

## 9. Verification bar — site-specific

Mirrors BRAND.md §12 with web-specific items added:

1. Every section copy block matches the voice notes in §2 of this spec.
2. The site has six sections plus a footer. Adding a seventh requires this doc to be revised.
3. No "Get Started" or equivalent persuasive button exists. The only CTA is the *Try it* code block.
4. No image of an elder appears anywhere on the site.
5. Static-site output: no JavaScript on initial load except the copy-button (≤2KB, deferred).
6. LCP measured on Lighthouse mobile Slow 4G profile is ≤2.5s. (3G target per brief; Slow 4G is the practical Lighthouse equivalent.)
7. WCAG AA passes on every section, AAA on the hero and any elder-related body text.
8. The word *"user"* does not appear in any section.
9. The kanji 凪 appears exactly four times: nav logo, hero, footer logo, favicon. Not more.
10. No exclamation points in the rendered copy.
11. Build artifact is portable: a self-hoster can serve `dist/` from any static host (Cloudflare Pages, Netlify, S3, nginx).
12. Privacy: no third-party requests in network panel on first paint.

---

*Authored under Kronos discipline. Bound to BRAND.md, BRAND_MANUAL.md, PRINCIPLES.md. Licensed CC BY 4.0 — share freely, attribute Cedar.*
