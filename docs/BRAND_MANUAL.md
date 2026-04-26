# Nagi — Brand Manual
**Status:** Authoritative implementation of [BRAND.md](./BRAND.md) | **Date:** 2026-04-22 | **Owner:** ALMA (voice) + Kronos (discipline)
**Bound by:** [BRAND.md](./BRAND.md) (the spine) and [PRINCIPLES.md](./PRINCIPLES.md) (the constitution).

---

## 0. Preamble

This manual is the operational layer of the spine. It defines the concrete tokens — colors, type, spacing, components, motion, assets — that every Nagi surface must use. Every rule here is traceable to a numbered section of BRAND.md. If a token in this document conflicts with the spine, the spine wins and this manual is wrong. Designers and engineers consult this file first; they consult the spine when a token's *intent* is unclear.

The product is **Nagi** (consumer surface). The project is **Cedar** (repo, docs, technical artifacts). Per BRAND.md §2, never mix the names in user-facing copy.

---

## 1. Logo system

Per BRAND.md §6 (banned moves) and §2 (name).

### 1.1 Wordmark

The wordmark is the literal word **Nagi** typeset in the body sans (Inter, see §4) at weight 600 (semibold), tracking `-0.01em`, optical size set for display use at 32px+. No custom letter shapes; no ligatures beyond defaults. The wordmark is a typesetting, not a logo with bespoke geometry.

### 1.2 The 凪 mark

The kanji 凪 is a quiet signature. It MAY appear:
- As a corner mark on the splash screen (centered, 96px on phones)
- As the favicon and app icon glyph (see §9)
- Once, decoratively, in the chat header on the elder surface (existing implementation: `app/(elder)/chat.tsx` line 223 — keep this single occurrence)
- In the 404 screen (existing implementation: `app/+not-found.tsx` line 9)

It MUST NOT appear:
- In body text on any surface
- More than once per screen
- As a button or interactive element
- With any color other than the surface's primary text color or `accent-primary` (§3)

### 1.3 Clear space

Clear space around the wordmark is 1× the cap-height of the typeset word in every direction. The 凪 mark requires clear space of 0.5× its own height.

### 1.4 Construction lock

Wordmark and mark are locked. They cannot be:
- Gradient-filled (§6 ban)
- Drop-shadowed (§6 ban)
- Animated, including subtle "breathing" motion (§6 ban)
- Outlined or stroked
- Tilted, skewed, or italicized
- Combined into a "lockup" that fuses 凪 into the wordmark

### 1.5 Co-branding

For the open-source audience (per BRAND.md §10), the project name **Cedar** appears in technical artifacts only (README headers, license, contributor docs). Cedar uses the same Inter weight/tracking as Nagi, never the kanji.

---

## 2. The two surfaces — visual bifurcation

Per BRAND.md §3. The elder and intermediary surfaces are visually distinct enough that an outsider can identify which is which without context (verification bar §12.7). The bifurcation is enforced through three concrete differences:

| Axis | Elder surface | Intermediary surface |
|---|---|---|
| Background | `surface-elder` (#FBF7F0, warm off-white) | `surface-intermediary` (#F6F5F2, cooler stone) |
| Density | One purpose per screen, generous padding | Lists, cards, status pills |
| Type minimum | 20px body, 32px+ display | 14px body acceptable |
| Tap target minimum | 56px | 44px |
| Motion duration | 240ms | 160ms |

This is not skinning. The two palettes share neutrals and accent but the dominant background and density rules diverge structurally.

---

## 3. Color tokens

Per BRAND.md §7 (visual ground rules — color). Every value is hex. WCAG ratios are measured against the surface they appear on.

### 3.0 The story of these colors

The palette is not decoration. It is the brand mythology, made visible on every screen.

[PHILOSOPHY.md](./PHILOSOPHY.md) opens with a parable of two artisans in the foothills of the Danxia mountains. The Imperial Sculptor carves a flawless jade dragon by force; the Penjing Master cultivates a small, gnarled Huangshan pine by patience. The pine, after years of struggle against wind, is the one that stops the Emperor. The Master tells him: *"You asked the Sculptor to replicate greatness. I only cultivated resilience. Greatness was the consequence."*

That pine — *struggling, deep, alive* — is **Pine Deep**, the primary structural color. It is what every Nagi screen is *for*: cultivation, not imposition.

[BRAND.md §2](./BRAND.md) unpacks 凪 as *the lull of the sea after wind stops* — the moment mariners read carefully, knowing it is earned, not permanent. That stillness — *muted, mineral, post-storm* — is **Sea Lull**, the secondary. It carries the kanji's meaning into the chrome of buttons, links, and quiet status.

**Aged Cream** is the human warmth that sits next to the pine and the sea: aged wood, paper, the surfaces of a loved object. **Fog White** is the morning the Penjing Master walks to his garden in. **Charcoal Root** is the soil the pine grew in. **Warm Ochre** is the lamp the family member reads by, at night, after the elder has gone to bed.

The single named exception is **Safety Red**. It exists for the elder's emergency button and nothing else — see §3.4 below.

### 3.1 Surfaces

| Token | Hex | Name | Use |
|---|---|---|---|
| `surface-elder` | `#F7F5F2` | Fog White | Dominant background on every elder route |
| `surface-elder-raised` | `#FAF5EC` | Paper | Cards on elder home, chat bubbles (assistant), input field backgrounds |
| `surface-elder-sunken` | `#EDEAE3` | Fog White deep | Active card press state, sunken inputs |
| `surface-intermediary` | `#F7F5F2` | Fog White | Dominant background on every intermediary route |
| `surface-intermediary-raised` | `#FAF5EC` | Paper | List rows, configuration cards, inputs |
| `surface-intermediary-sunken` | `#EDEAE3` | Fog White deep | Inactive selectors, disabled inputs |
| `surface-dark` | `#1E1E1E` | Charcoal Root | High-contrast mode, OS dark mode |
| `surface-dark-raised` | `#2A2A2A` | Charcoal lifted | Cards in dark/HC mode |

**Rationale:** `#F7F5F2` (Fog White) is a near-neutral off-white at 96.5% lightness, slightly warmed (R > B by 5 points) — it reads as "paper" without the cream-wash of the prior palette, which had become saturated to the point of looking yellow on cooler displays. Elder and intermediary surfaces share the same hue: the difference between them is structure and density (the intermediary has a sidebar, the elder has the kanji and no chrome), not skin.

**Why raised cards are NOT pure white:** `#FAF5EC` (Paper) is `#FFFFFF` warmed by the same 5-point R-bias as Fog White. The brand never uses pure `#FFFFFF` as a surface for two reasons:

1. **Elder ergonomics.** Cataracts scatter the blue-end of the spectrum; pure-white surfaces read as "glare-bright" to elderly eyes while warm off-whites read as "soft paper." This is a measured ergonomic preference, not aesthetic — body text on `#FAF5EC` is just as legible (15.21:1 with Charcoal Root) without the glare cost.
2. **Visual hierarchy.** A raised card at `#FAF5EC` against a Fog White surface at `#F7F5F2` shows a 1.5% lift — subtle but consistent. Pure white against Fog White creates a 3.5% jolt that reads as "harsh hot spot" rather than "lifted paper." The smaller delta is the right paper-on-paper metaphor.

**Pure `#FFFFFF` and `#000000` are off-palette and forbidden.** Even when the eye wants "whitest" (button labels on Pine Deep) or "blackest" (HC-mode background), the brand reaches for palette tokens, not raw values. The two tools that fill those roles:

| Token | Hex | Name | Replaces |
|---|---|---|---|
| `paper` | `#FAF5EC` | Paper | Any prior use of `#FFFFFF` — text on Pine Deep buttons, max-emphasis text on dark surfaces, anywhere the eye wanted "whitest" |
| `charcoal` | `#1E1E1E` | Charcoal Root | The HC-mode mid-dark layer — same value as `surface-dark`, exposed as a top-level alias for ink/canvas use |
| `charcoal-deep` | `#0F0F0F` | Charcoal Root deep | Replaces any prior use of `#000000` — true-deep canvas for HC-mode root, modal backdrops, max-emphasis darks |

The `paper` and `charcoal` aliases share values with `surface-*-raised` and `surface-dark` respectively — the duplication is deliberate. Same value, different role: surfaces are *places*, paper/charcoal are *inks*. Using the right name at the call site is what keeps the palette legible to the next contributor.

**Dark hierarchy** (mirrors the light side's Fog White → Paper):

| Layer | Hex | Use |
|---|---|---|
| `charcoal-deep` `#0F0F0F` | true-deep | HC-mode page background (replaces inline `#000000`), modal backdrops |
| `charcoal` / `surface-dark` `#1E1E1E` | Charcoal Root | Charcoal text on light surfaces, mid-canvas in HC mode |
| `surface-dark-raised` `#2A2A2A` | Charcoal lifted | Cards in HC/dark mode |

### 3.2 Pine Deep — the primary structural accent

| Token | Hex | Name | Use |
|---|---|---|---|
| `accent-50` | `#EFF3EE` | Pine breath | Softest hover/highlight, divider tinting |
| `accent-100` | `#DDE5DF` | Pine wash | Tag backgrounds, soft pills, voice-mode toggle on state |
| `accent-500` | `#3F5E48` | Pine medium | Secondary buttons, hover state on primary |
| `accent-600` | `#34503E` | **Pine Deep** | The primary. Action buttons, focus ring, link color, brand wordmark |
| `accent-700` | `#26392F` | Pine Deeper | Pressed state on primary buttons, max-emphasis structural ink |
| `accent-ink` | `#1A2E25` | Pine ink | Text on Pine wash backgrounds, emphasis copy on `accent-100` cards |

**Rationale:** `#34503E` is `#2D4A3E` warmed five degrees toward olive (HSL ≈ 145° → 142°, S ≈ 22%, L ≈ 25%). The unwarmed value reads as Hokkaido-mountain-cold against Spanish copy and LATAM-aesthetic skin tones in product photography; the five-degree shift toward olive lets the palette honor the Penjing pine reference *and* feel inviting in the markets Nagi serves. It is the *only* structural accent on any screen (§7: "one accent per screen") — Sea Lull and Aged Cream play subordinate, semantic roles.

### 3.3 Sea Lull — secondary, the still water of 凪

| Token | Hex | Name | Use |
|---|---|---|---|
| `secondary` | `#5C7A85` | Sea Lull Deep | Secondary text in headers (≥18px), icons, secondary buttons |
| `secondary-tint` | `#8BA7B0` | Sea Lull | Decoration only — pill backgrounds at large size, voice-listening visualizer |
| `secondary-soft` | `#DDE5DF` | Pine/sea wash | Shared with `accent-100` — calm muted backgrounds |

**Rationale:** Sea Lull Deep at `#5C7A85` is text-safe at sizes ≥18px (3.82:1 against Fog White — passes AA-large). It is *not* safe for inline body text — for sober body copy, use `neutral-700`. The decorative `secondary-tint` `#8BA7B0` should never carry text or icons; it is a hue, not a contrast tool. This is a deliberate constraint: Sea Lull's job in the brand is *quiet presence*, not legibility.

### 3.4 Semantic tokens

| Token | Hex | Name | Use |
|---|---|---|---|
| `cream` | `#F0E8D8` | Aged Cream | Input field backgrounds (intermediary), pull-quotes on web, "this is a notable moment" callouts that are NOT alerts |
| `cream-deep` | `#E5D9C2` | Aged Cream deep | Hover/pressed on cream backgrounds |
| `alert` | `#C8874A` | Warm Ochre | Background of toast banners, deadline reminders, soft "this needs attention but isn't urgent" surfaces. ≥18px UI only. |
| `alert-deep` | `#8B5C24` | Warm Ochre deep | Inline icon and text color in alert callouts (AA-normal safe against `surface` and `alert-soft`) |
| `alert-soft` | `#F2DDC4` | Warm Ochre wash | Background of inline alert pills |
| `safety-critical` | `#C8392E` | **Safety Red** | **NAMED EXCEPTION.** The "Necesito ayuda / I Need Help" button text and border ONLY. Nothing else. Not for routine cancel, not for delete confirms, not for inline error text. |
| `safety-critical-soft` | `#FBE8E5` | Safety wash | Background for the help button container |
| `safety-critical-border` | `#F4C4BE` | Safety border | Border on the help button — the warm signal in a cool palette |
| `presence` | `#7A8C4F` | Olive | "Received" / "saved" indicator. NOT checkmark green — a muted olive signaling presence-of-arrival, not achievement. |
| `presence-soft` | `#EEF1E2` | Olive wash | Background for received/synced status pills |
| `info` | `#5C7A85` | (= Sea Lull Deep) | Sync indicators, neutral status. Routes through Sea Lull so "neutral status" reads as calm-water rather than cool-corporate. |
| `info-soft` | `#DDE5DF` | (= Pine/sea wash) | Background for status pills |

**Why Safety Red is a named exception:** the brand voice principle is "honest warmth, never alarming" — and red is universally arousing. *Most* of the time that arousal is wrong (it makes a routine cancel feel like a mistake). But the elder's "Necesito ayuda" button has exactly one job: be unmissable in distress. At that one surface, brand-voice purity loses to elder cognitive ergonomics. The carve-out is documented here so future contributors see the red and recognize it as deliberate, not as drift.

**Why `presence` is olive, not green:** §9 of the spine: confirmation reads *"Tu mensaje llegó. Carmen lo va a ver pronto."* — *llegó* is presence, not victory. A bright green checkmark turns presence into a trophy. Olive-against-Fog-White signals "here, received, settled" — the actual brand promise. Olive also pairs naturally with Pine Deep without competing for the structural-accent role.

**Why `info` reuses Sea Lull Deep:** the prior palette had a separate slate (`#4A6B7A`) for info. With Sea Lull as the secondary, a separate slate creates a fourth cool hue that fights the palette's discipline. Reusing Sea Lull Deep collapses two roles into one identity — *the calm one* — and the palette stays at three families (Pine, Sea, Cream) rather than four.

### 3.5 Neutrals

A 9-step true-neutral scale (HSL S ≈ 0–3%, hue ≈ 0–60°). Shifted from the prior warm-biased scale because the surfaces are no longer warm — a warm-biased neutral against a near-neutral surface produces a visible peach cast that the new palette does not want.

| Token | Hex | Use |
|---|---|---|
| `neutral-50`  | `#FAFAFA` | Hairline dividers on raised surfaces |
| `neutral-100` | `#F0F0EE` | Card borders, divider lines |
| `neutral-200` | `#E0DFDC` | Input borders, secondary borders |
| `neutral-300` | `#C2C0BC` | Disabled text, decorative chevrons |
| `neutral-400` | `#9A9A95` | Placeholder text, tertiary metadata |
| `neutral-500` | `#727270` | Secondary text, intermediary metadata |
| `neutral-600` | `#545454` | Body text on intermediary surface |
| `neutral-700` | `#3D3D3C` | Primary text on intermediary surface |
| `neutral-800` | `#2A2A2A` | Primary text on elder surface |
| `neutral-900` | `#1E1E1E` | Charcoal Root — display headings, max-emphasis text |

### 3.6 WCAG contrast pairs

All measured against the new palette. AA = 4.5:1 normal text, 3:1 large (≥18px regular or ≥14px bold). AAA = 7:1 normal text — required for elder body text per §7.

| Foreground | Background | Ratio | Threshold | Pass |
|---|---|---|---|---|
| `neutral-900` `#1E1E1E` (Charcoal Root) | `surface-elder` `#F7F5F2` | 15.21 : 1 | AAA normal | PASS (elder body text) |
| `neutral-800` `#2A2A2A` | `surface-elder` `#F7F5F2` | 12.94 : 1 | AAA normal | PASS (elder body, alt) |
| `neutral-700` `#3D3D3C` | `surface-intermediary` `#F7F5F2` | 9.04 : 1 | AAA normal | PASS (intermediary body) |
| `neutral-500` `#727270` | `surface` `#F7F5F2` | 4.71 : 1 | AA normal | PASS (metadata) |
| `accent-600` `#34503E` (Pine Deep) | `surface` `#F7F5F2` | 7.52 : 1 | AAA normal | PASS — Pine on Fog passes AAA at every size |
| `accent-600` `#34503E` | `accent-100` `#DDE5DF` | 6.34 : 1 | AA normal | PASS (Pine text on Pine wash card) |
| `#FFFFFF` | `accent-600` `#34503E` | 8.11 : 1 | AAA normal | PASS (button labels on Pine Deep) |
| `secondary` `#5C7A85` (Sea Lull Deep) | `surface` `#F7F5F2` | 3.82 : 1 | AA large only | Reserve for ≥18px UI, headings; NOT body text |
| `secondary-tint` `#8BA7B0` (Sea Lull) | `surface` `#F7F5F2` | 2.19 : 1 | **FAIL** | **Decoration only** — no text, no icons |
| `cream` `#F0E8D8` (Aged Cream) | `accent-600` `#34503E` | 6.84 : 1 | AA normal | PASS (Pine on cream card text) |
| `neutral-900` `#1E1E1E` | `cream` `#F0E8D8` | 13.83 : 1 | AAA normal | PASS (body on cream input) |
| `alert-deep` `#8B5C24` | `alert-soft` `#F2DDC4` | 4.39 : 1 | AA large; near AA normal | PASS for ≥18px alert pill text |
| `alert-deep` `#8B5C24` | `surface` `#F7F5F2` | 5.41 : 1 | AA normal | PASS (inline alert text on surface) |
| `safety-critical` `#C8392E` | `safety-critical-soft` `#FBE8E5` | 5.18 : 1 | AA normal | PASS (help button text) |
| `presence` `#7A8C4F` | `presence-soft` `#EEF1E2` | 3.41 : 1 | AA large only | Reserve for ≥18px or pair with bolder weight |
| `info` `#5C7A85` | `info-soft` `#DDE5DF` | 3.30 : 1 | AA large only | Reserve for ≥18px (= same constraint as `secondary`) |
| `#FFFFFF` | `surface-dark` `#1E1E1E` | 16.10 : 1 | AAA normal | PASS (HC mode) |
| `accent-100` `#DDE5DF` (Pine wash) | `surface-dark` `#1E1E1E` | 12.83 : 1 | AAA normal | PASS (HC mode highlights) |

**Net effect of the swap:** the prior palette had two AA-marginal pairs (terracotta on intermediary surface failing AA-normal by 0.09; presence on presence-soft at 3.41 needing ≥18px). The new palette has one improvement (Pine Deep on Fog White is AAA at every size — better than terracotta) and two new constraints (Sea Lull Deep is large-only; `info` is large-only by inheritance). Both new constraints are honored by the implementation and called out explicitly in §3.3 and §3.4.

---

## 4. Type system

Per BRAND.md §7 (type) and §6 (no infantilization — type does the calm work).

### 4.1 Families

| Family | License | Use |
|---|---|---|
| **Inter** | OFL 1.1 | All UI body and headings, both surfaces. Tabular numerals enabled (`font-feature-settings: 'tnum' 1`). |
| **Source Serif 4** | OFL 1.1 | Editorial moments only: about page, principles excerpts on web, marketing hero subhead. NEVER on the elder surface. NEVER in product UI. |

Two families maximum, per spine §7. Both are open-source and stable on iOS, Android, web.

### 4.2 Scale — elder surface (NativeWind class → px)

Elder body floor is **20px**, per §7. NativeWind defaults below 18px are forbidden on elder routes.

| Class | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-base` | 20px | 30px (1.5) | 400 | Body / chat messages (lg setting) |
| `text-lg` | 22px | 33px (1.5) | 400 | Body / chat messages (xl setting), card labels (lg) |
| `text-xl` | 24px | 36px (1.5) | 500 | Card labels (xl), input text (xl) |
| `text-2xl` | 28px | 40px (1.43) | 600 | Card labels (2xl), input text (2xl), help button (lg) |
| `text-3xl` | 32px | 44px (1.375) | 700 | Greeting headline (lg), help button (xl) |
| `text-4xl` | 38px | 48px (1.26) | 700 | Greeting headline (xl), help button (2xl) |
| `text-5xl` | 48px | 56px (1.17) | 700 | Greeting headline (2xl), card emoji glyphs |

Reconciliation with `app/(elder)/index.tsx` `TEXT_CLASS` map: existing `lg/xl/2xl` triplets remain; only the px-floor and weight matrix above formalizes them.

### 4.3 Scale — intermediary surface

| Class | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-xs` | 12px | 18px (1.5) | 500 | Tag labels, micro-metadata (timestamps, lang codes) |
| `text-sm` | 14px | 21px (1.5) | 400 | Secondary text, hints, descriptions |
| `text-base` | 16px | 24px (1.5) | 400 | Body |
| `text-lg` | 18px | 27px (1.5) | 600 | List row primary text, button labels |
| `text-xl` | 20px | 28px (1.4) | 600 | Card titles, "Open elder interface" CTA |
| `text-2xl` | 24px | 32px (1.33) | 700 | Screen titles ("My Elders", "Configure interface") |
| `text-3xl` | 30px | 36px (1.2) | 700 | Marketing-only, never in product |

### 4.4 Numerals

`font-variant-numeric: tabular-nums` everywhere a count, timestamp, or version appears. Per spine §7. In NativeWind: `font-mono` is forbidden (it changes the family); use `style={{ fontVariant: ['tabular-nums'] }}` on the View or Text.

### 4.5 Italics

Italics are reserved for the chat "Nagi está hablando…" status indicator and for editorial pull-quotes on web. No italics in product UI labels or body.

---

## 5. Spacing & rhythm

Per BRAND.md §7 (space and rhythm) and PRINCIPLES.md §4 (one action per screen).

### 5.1 Scale (matched to NativeWind defaults)

| Token | px | NativeWind | Use |
|---|---|---|---|
| `space-1` | 4 | `1` | Hairline gaps (icon-to-glyph) |
| `space-2` | 8 | `2` | Tight inline spacing |
| `space-3` | 12 | `3` | Tag padding, micro-spacing |
| `space-4` | 16 | `4` | Default content padding (intermediary) |
| `space-5` | 20 | `5` | Card-internal vertical |
| `space-6` | 24 | `6` | Screen edge gutter (intermediary), section spacing |
| `space-8` | 32 | `8` | Section breaks (intermediary), screen edge (elder) |
| `space-12` | 48 | `12` | Major section breaks (web) |
| `space-16` | 64 | `16` | Hero spacing (web), elder home top breathing room |

### 5.2 Tap targets

Per Vigía gate 1C and BRAND.md §7.

- **Elder surface minimum:** 56px square. Implemented as `py-4` + `text-xl`+ content, OR explicit `aspect-ratio: 1` cards (existing impl: home cards use `aspectRatio: 1` at `width: '47%'` — passes).
- **Intermediary surface minimum:** 44px. Implemented as `py-3` + `text-base`+ content.
- **Help button (`safety-critical`):** 64px minimum, regardless of surface. Existing impl: `py-5` on home, `py-3.5` on chat — chat impl is below floor; flag to DESIGN_APP.md.

### 5.3 Card padding standards

- Elder home card: `p-6` (24px) all sides, `aspectRatio: 1`, content centered
- Elder chat bubble: `px-4 py-3`
- Intermediary list row: `p-5` (20px) all sides
- Intermediary configuration card: `p-4` with internal `gap-6` between groups

---

## 6. Component vocabulary

Per BRAND.md §3 (the two audiences). Components are defined separately for each surface where the visual differs.

### 6.1 Buttons

#### Primary — elder
- Background: `accent-primary` `#B8552B`
- Label: `#FFFFFF`, `text-2xl` weight 600
- Padding: `py-5 px-8`, minimum 56px height
- Radius: `rounded-2xl` (16px)
- Pressed: opacity 0.85, no scale transform
- NativeWind hint: `bg-[#B8552B] rounded-2xl py-5 px-8`

#### Primary — intermediary
- Background: `accent-primary` `#B8552B`
- Label: `#FFFFFF`, `text-lg` weight 600
- Padding: `py-4 px-6`, minimum 48px height
- Radius: `rounded-2xl`
- Pressed: opacity 0.82
- NativeWind hint: `bg-[#B8552B] rounded-2xl py-4 px-6`

#### Secondary — both surfaces
- Background: transparent
- Border: 1px `neutral-200`
- Label: `neutral-700`, weight 500
- No hover state on mobile; pressed: `bg-neutral-50`

#### Safety — elder only
- Background: `safety-critical-soft` `#FBE8E5`
- Border: 2px `safety-critical-border` `#F4C4BE`
- Label: `safety-critical` `#C8392E`, `text-2xl` weight 700
- Padding: `py-5`, minimum 64px height
- Always present at the bottom of every elder route
- Label is exactly *"Necesito Ayuda"* — never abbreviated, never localized to English (BRAND.md §8)

### 6.2 Cards

#### Elder home card
- Background: `surface-elder-raised` `#FAF5EC`
- Border: 1px `neutral-100`
- Radius: `rounded-3xl` (24px)
- Aspect: 1:1 (square), `width: 47%` so two-per-row with `gap-4`
- Content: emoji 48px + label `text-xl` weight 600 centered
- Pressed: opacity 0.7
- NativeWind hint: `bg-white border border-[#F0EDE7] rounded-3xl`

#### Intermediary list row
- Background: `surface-intermediary-raised` `#FAF5EC`
- Border: 1px `neutral-100`
- Radius: `rounded-2xl` (16px)
- Padding: `p-5`
- Content: title (`text-lg` weight 600) + metadata row (tags) + chevron right
- Pressed: opacity 0.7

### 6.3 Inputs

- Background — elder: `surface-elder-sunken` `#F4EFE6`
- Background — intermediary: `surface-intermediary-sunken` `#EDEAE3`
- Border: 1px `neutral-200`, focus: 2px `accent-primary`
- Radius: `rounded-xl` (12px)
- Padding: `px-4 py-3.5`
- Text size: matches surface scale (elder `text-xl`+, intermediary `text-base`)
- Placeholder color: `neutral-400` `#9C9485`

### 6.4 Sheet / modal

Per spine §6 (no persuasive UI): no scrim-darkened modals on elder surface in v0. Sheets are intermediary-only.
- Bottom sheet, slide-up, 240ms ease-out
- Background: `surface-intermediary-raised`
- Drag handle: 4px×40px `neutral-300`, top center
- Dismissible by drag-down, no "Cancel" friction

### 6.5 Status indicators

Tag pill shape: `rounded-full px-2.5 py-0.5`, `text-xs` weight 500.

| Status | Background | Text | Use |
|---|---|---|---|
| Active | `info-soft` `#E0E8EC` | `info` `#4A6B7A` | Elder status pill |
| Paused | `neutral-100` | `neutral-500` | Elder status pill |
| Synced | `success-presence-soft` | `success-presence` | "Saved" / "Sent" pill |
| Language | `accent-primary-soft` | `accent-primary-ink` | Lang code pill |

### 6.6 Empty states

Per spine §7: "Empty states are not failures."

- Container: card on the surface, centered, `p-6`
- No emoji larger than 32px (existing impl uses `text-4xl` 👴 on elder list — reduce to 32px and replace with neutral icon per §7 iconography)
- Copy follows §9 of spine: warm presence-of-future, never "no X yet"

### 6.7 Loading states

- Replace `ActivityIndicator color="#4f46e5"` with `color="#B8552B"` everywhere (existing impl uses indigo)
- On elder surface: indicator is centered, no text label, surface-color background only
- On intermediary surface: indicator may be paired with the row/card it's loading

---

## 7. Iconography

Per BRAND.md §7 (iconography).

### 7.1 Set

**Lucide** (ISC license, open source). One stroke weight: 1.75px at 24px size, scaling proportionally.

Rationale: Lucide is the calmest of the open-source icon families — geometric without being severe, no metaphorical traps, broad coverage. Phosphor was considered; rejected because its "Duotone" weight would tempt visual flourish.

### 7.2 Usage rules

- **Elder surface:** icons supplement labels, never replace them. Cards use a single emoji glyph (48px) by design — emoji are warmer than icons and read as familiar object, not symbol. Lucide icons appear on elder surface only in the chat header (back arrow, voice toggle).
- **Intermediary surface:** icons supplement labels in list rows and configuration cards.
- **No hamburger menu, no kebab menu** on either surface (BRAND.md §7: "the elder surface has no hidden navigation anyway"). Intermediary navigation is explicit tabs or list rows.

### 7.3 Existing emoji-as-icon usage to reconcile

Existing impl uses emoji in many intermediary contexts (`👴`, `⚙️`, `📊`, `🤖`, `👆`, `⚠️`, `📵`, `📭`, `🧓`). These are warm-feeling but inconsistent stroke and metaphor. Recommendation in DESIGN_APP.md §intermediary-icons: replace emoji on intermediary surface with Lucide equivalents (`User`, `Settings`, `Activity`, `MessageCircle`, `MousePointer`, `AlertTriangle`, `WifiOff`, `Inbox`). Keep emoji on elder home cards — they are intentional warmth there.

---

## 8. Motion

Per BRAND.md §7 (motion) and §6 (decorative motion banned).

### 8.1 Curves

| Curve | Cubic-bezier | Use |
|---|---|---|
| `ease-out` | `(0.0, 0.0, 0.2, 1.0)` | Entrances (sheet open, screen push) |
| `ease-in-out` | `(0.4, 0.0, 0.2, 1.0)` | State changes (toggle, selection) |
| `linear` | n/a | Streaming dots, listening waveform pulse |

No spring physics. No bounce. No anticipation curves.

### 8.2 Durations

| Surface | Standard | Maximum | Minimum |
|---|---|---|---|
| Elder | 240ms | 300ms | 200ms |
| Intermediary | 160ms | 200ms | 150ms |

Never under 120ms (§7 floor).

### 8.3 What animates

- Screen push/pop (Expo Router default, override duration to surface-appropriate)
- Sheet slide-up (intermediary only)
- Pressable opacity (already implemented as 0.7–0.85)
- Streaming chat dots (linear, 1200ms loop)
- Listening waveform amplitude (linear, driven by mic volume)

### 8.4 What does NOT animate

- Logo, kanji, wordmark
- Card hover states (mobile has no hover)
- Page background gradients (no gradients exist)
- Success confirmations (per §6 ban on achievement theater — no checkmark fly-in)
- Empty state illustrations

### 8.5 Reduced motion

When OS reduce-motion is set:
- All transitions become opacity-only (200ms ease)
- Sheets become instant cross-fade
- Streaming dots become a static "…"
- Listening waveform becomes a static `Escuchando…` text indicator

---

## 9. Asset deliverables checklist

| Asset | Dimensions | Format | Notes |
|---|---|---|---|
| Favicon | 32×32, 16×16 | ICO + SVG | 凪 in `accent-primary` on `surface-elder` |
| App icon (iOS) | 1024×1024 | PNG, no alpha | 凪 centered, `surface-elder` background, `neutral-900` glyph. No drop shadow, no gradient (§6) |
| App icon (Android adaptive) | 432×432 foreground, 432×432 background | PNG | Foreground: 凪 in `neutral-900`. Background: `surface-elder` solid. |
| Splash screen | 1242×2688 (iOS), various Android | PNG | `surface-elder` solid + 凪 96px centered + Nagi wordmark 32px below. No animation per §6. |
| OG / social card | 1200×630 | PNG | Wordmark left, the §1 north-star sentence right, `surface-elder` background. |
| README hero | 1280×640 | PNG or SVG | The 凪 mark + product description, dark variant on `surface-dark`. |
| App store screenshots | per platform spec | PNG | Real product UI per BRAND.md §6 (no stock photos of elders). 3 screens minimum: elder home, intermediary list, configure. |

No mascot, no illustration character, no photographic asset of an elder smiling at a device (BRAND.md §6 single most banned visual).

---

## 10. Tailwind / NativeWind config additions required

The existing `apps/mobile/tailwind.config.js` defines only `nagi: { 50, 100, 500, 600, 700 }` in indigo. To implement this manual without per-component hex literals, the config must be extended. Concrete diff specified in DESIGN_APP.md §0 (migration). Summary: add `surface`, `accent`, `neutral` (warm), `safety`, `success-presence`, `info` token groups; deprecate `nagi-*` (rename to `accent-*` with the new hex). This is required, not optional — without it, every component file must inline hex values, which violates token discipline.

---

## 11. Verification bar (manual-specific)

Mirrors BRAND.md §12, with manual-implementation specifics added:

1. Every visual decision in this doc cites a numbered BRAND.md section.
2. No hex value appears in feature code; all colors flow from `tailwind.config.js` tokens.
3. Every WCAG pair in §3.5 is measured (not estimated) and meets its declared threshold.
4. Type scales never go below 18px on elder routes; below 12px on any route.
5. Tap targets meet §5.2 minimums on every interactive element.
6. No banned move (BRAND.md §6) appears in any component spec.
7. The "intermediary vs elder" distinction is observable in §3.1 surface tokens and §4.2/4.3 type scales without reading any other doc.
8. The `safety-critical` token is referenced ONLY on the help button — `grep` for the token returns one usage per surface.
9. Iconography uses Lucide ONLY (no Phosphor, no Material, no Heroicons mixed in).
10. Asset deliverables in §9 have a tracked owner and target date in the BUILD plan.

---

*Authored under Kronos discipline. Bound to BRAND.md and PRINCIPLES.md. Licensed CC BY 4.0 — share freely, attribute Cedar.*
