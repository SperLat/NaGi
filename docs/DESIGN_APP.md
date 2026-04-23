# Nagi — App Design Spec
**Status:** Implementation of [BRAND.md](./BRAND.md) via [BRAND_MANUAL.md](./BRAND_MANUAL.md) for the 12 mobile routes | **Date:** 2026-04-22
**Bound by:** BRAND.md (spine), BRAND_MANUAL.md (tokens), PRINCIPLES.md (constitution), [ARCHITECTURE.md](./ARCHITECTURE.md) (routes list), and Vigía QA gates (1A–1E).

---

## 0. Migration note — existing implementation vs. this spec

The 12 routes currently compile and run. They use `bg-nagi-600` (`#4f46e5`, indigo) as their accent. Per BRAND.md §7 ("warm accent") and BRAND_MANUAL.md §3.2, the accent is `#B8552B` (muted terracotta).

This spec is written as if the migration has landed. The required config change is a single diff in `apps/mobile/tailwind.config.js`:

```js
// BEFORE
colors: {
  nagi: {
    50:  '#f0f4ff',
    100: '#e0e9ff',
    500: '#4f6ef7',
    600: '#3b5bf6',
    700: '#2d49e0',
  },
}

// AFTER
colors: {
  surface: {
    elder:          '#FBF7F0',
    'elder-raised': '#FFFFFF',
    'elder-sunken': '#F4EFE6',
    intermediary:   '#F6F5F2',
    'intermediary-raised': '#FFFFFF',
    'intermediary-sunken': '#EDEAE3',
    dark:           '#1A1714',
    'dark-raised':  '#26221E',
  },
  accent: {
    50:  '#FBF2EC',
    100: '#F2D9C9',
    500: '#D06534',
    600: '#B8552B',   // primary — replaces nagi-600
    700: '#964521',
    ink: '#5A2810',
  },
  neutral: {
    50:  '#FAF8F5', 100: '#F0EDE7', 200: '#E2DDD3',
    300: '#C8C1B3', 400: '#9C9485', 500: '#736B5C',
    600: '#544D42', 700: '#3D372F', 800: '#2A2520', 900: '#1A1714',
  },
  safety: {
    critical:        '#C8392E',
    'critical-soft': '#FBE8E5',
    'critical-border': '#F4C4BE',
  },
  presence: { DEFAULT: '#7A8C4F', soft: '#EEF1E2' },
  info:     { DEFAULT: '#4A6B7A', soft: '#E0E8EC' },
  // Transitional alias — remove once all files migrated:
  nagi: { 50: '#FBF2EC', 100: '#F2D9C9', 500: '#D06534', 600: '#B8552B', 700: '#964521' },
}
```

This spec references the AFTER token names. The `nagi` alias exists only during migration; CI should flag any new `nagi-*` reference after step 10 of the BUILD sequence.

---

## 1. Navigation diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    app/index.tsx (entry redirect)                │
│                     ↓ (not authenticated)                        │
│                                                                  │
│  ┌─────────────── AUTH SURFACE ─────────────────┐               │
│  │  (auth)/sign-in  ←→  (auth)/sign-up          │               │
│  │         ↓ authenticated                       │               │
│  └───────────────────┬───────────────────────────┘               │
│                      │                                           │
│  ┌───────── INTERMEDIARY SURFACE ─────────────────┐              │
│  │                                                │              │
│  │  (intermediary)/index  ── list of elders       │              │
│  │    │  ├─→ elders/new   ── onboard elder        │              │
│  │    │  ├─→ organization ── org settings         │              │
│  │    │  └─→ elders/[id]/index  ── overview       │              │
│  │    │        ├─→ elders/[id]/configure          │              │
│  │    │        ├─→ elders/[id]/activity           │              │
│  │    │        └─→ (setActiveElder)               │              │
│  │    │            │                              │              │
│  └────┼────────────┼──────────────────────────────┘              │
│       │            ▼                                             │
│       │  ┌────── ELDER SURFACE ─────────────────────┐            │
│       │  │  (elder)/index  ── 4-card home           │            │
│       │  │    ↓ (any card press, emergency button)  │            │
│       │  │  (elder)/chat   ── AI conversation       │            │
│       │  │    ↑ (back arrow)                        │            │
│       │  └──────────────────────────────────────────┘            │
│       │                                                          │
│       └── (back) returns to (intermediary)/elders/[id]/index     │
│                                                                  │
│  +not-found  ── reachable from any unknown route                 │
└──────────────────────────────────────────────────────────────────┘
```

**Transitional surface:** `app/index.tsx` and `+not-found.tsx` — visually neutral, follow intermediary surface tokens. The elder is never shown either directly.

**Crossing rule (per BRAND.md §3):** the elder surface is only entered via `setActiveElder` from the intermediary flow. There is no sign-in path that lands directly in `(elder)/`. This is structural — the elder does not have auth.users rows in v0 (ARCHITECTURE.md §8 assumption 1).

---

## 2. Per-route specifications

### Route 1 — `app/index.tsx`

**Purpose:** Entry redirect. Not a visible surface.
**Audience:** Transitional (no render).
**Layout sketch:**
```
[no UI — <Redirect /> to (auth)/sign-in]
```
**Voice notes:** n/a — no visible copy.
**Component composition:** `<Redirect href="/(auth)/sign-in" />` only.
**Accessibility checks:** n/a (no render).
**Edge states:** none. If auth is added (Step 4 of ARCHITECTURE.md §7), decide destination via `useSession()` — unauth → `/(auth)/sign-in`, auth → `/(intermediary)/`.

---

### Route 2 — `app/(auth)/sign-in.tsx`

**Purpose:** Intermediary authenticates. First touchpoint.
**Audience:** Intermediary. Elder never sees this.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ SafeAreaView — surface-intermediary  │
│                                      │
│         凪   (5xl, neutral-900)      │
│         Nagi (3xl, bold)             │
│   Calm confidence with technology    │
│                                      │
│  [Demo mode banner — if mock]        │
│                                      │
│  [Email .................]           │
│  [Password .............]            │
│                                      │
│  [error line — if any]               │
│                                      │
│  [ ─── Sign in ─── ] (accent-600)    │
│                                      │
│  New here? Create account            │
└──────────────────────────────────────┘
```
**Voice notes:**
- Tagline: *"Calm confidence with technology."* (existing copy — keep; aligns with spine §1)
- Demo banner: *"Demo mode — tap Sign in to explore."* (existing; acceptable for contributor-facing mock)
- Primary action label: *"Sign in"* (never *"Log in"*, never *"Get started"*)
- Link: *"New here? Create account."* (warm, not *"Sign up"*)
- Error copy (per BRAND.md §5 intermediary errors): *"Couldn't sign in. Check the email and password, or create an account if this is your first time."* — replaces the existing bare error string from the auth module.

**Component composition:**
- `SafeAreaView className="flex-1 bg-surface-intermediary"` (replace `bg-white`)
- Kanji `<Text className="text-6xl mb-2 text-neutral-900">凪</Text>`
- Wordmark `<Text className="text-3xl font-bold text-neutral-900">Nagi</Text>`
- Inputs: per BRAND_MANUAL §6.3 — `bg-surface-intermediary-sunken border-neutral-200 rounded-xl px-4 py-3.5`
- Primary button: per BRAND_MANUAL §6.1 — `bg-accent-600 rounded-2xl py-4`
- `ActivityIndicator color="#FFFFFF"` inside button (spinner on solid accent, white reads)

**Accessibility checks:**
- Vigía 1C: tap target 48px on button (py-4 + text-lg = 52px). PASS.
- Vigía 1D: `KeyboardAvoidingView` present. PASS.
- WCAG: neutral-900 on surface-intermediary 14.8:1. PASS AAA.

**Edge states:**
- Loading: `ActivityIndicator` inside button, button disabled.
- Empty (email/password blank): no error shown until submit; on submit with empty fields, inline `text-safety-critical text-sm`: *"Enter your email and password."*
- Error (auth fails): *"Couldn't sign in. Check the email and password."* in `text-safety-critical text-sm mb-3`.
- Offline: auth library surfaces network error → show *"Can't reach the server. Check your connection and try again."*

---

### Route 3 — `app/(auth)/sign-up.tsx`

**Purpose:** Intermediary creates account and their family org (per ARCHITECTURE §7 step 4).
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ SafeAreaView (scroll) — surface-int  │
│                                      │
│  ← Back (accent-600)                 │
│                                      │
│  Create account (2xl, bold)          │
│  You'll set up elders after signing in. (sm, neutral-500) │
│                                      │
│  Family group name                   │
│  [e.g. Familia García]               │
│  Email                               │
│  [..................]                │
│  Password (8+ characters)            │
│  [..................]                │
│                                      │
│  [ ─── Create account ─── ]          │
│                                      │
│  Already have an account? Sign in    │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Create account"* (existing; keep)
- Subhead: *"You'll set up elders after signing in."* (existing; warm, declarative, specific — keeps §4 "one promise per sentence")
- Field hint: *"Family group name"* (existing)
- Placeholder: *"e.g. Familia García"* (existing; Spanish-first is correct for LATAM pilot)
- Primary action: *"Create account"*
- Link: *"Already have an account? Sign in"*
- Validation error for empty name (existing: *"Enter a name for your family group"*) — keep; matches intermediary register.

**Component composition:** same as sign-in; add field hints as `text-xs font-medium text-neutral-500 mb-1.5 ml-1` above each input (existing pattern preserved).

**Accessibility checks:**
- Vigía 1C: `ScrollView` handles keyboard overflow. PASS.
- All inputs have visible labels (field hints), not placeholder-only. PASS.

**Edge states:**
- Loading: `ActivityIndicator` in button, inputs `editable={!loading}` (existing pattern).
- Error (email exists): *"An account with this email already exists. Try signing in instead."* with a link to sign-in.
- Error (password too short): *"Password needs at least 8 characters."*
- Offline: *"Can't reach the server. Your details aren't saved yet — try again when you're back online."*

---

### Route 4 — `app/(intermediary)/index.tsx`

**Purpose:** Intermediary dashboard — list of elders they support. Primary return screen.
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ SafeAreaView — surface-intermediary  │
│                                      │
│  My Elders                    [ + ]  │
│  People you support                  │
│  ──────────────────────────────────  │
│                                      │
│  ┌─ Rosa García ─────── [ES] [active] ›┐│
│  │                                   ││
│  ├─ Abuelo Miguel ───── [ES] [paused]›┤│
│  │                                   ││
│  └───────────────────────────────────┘│
│                                      │
│  [───── Add Elder ─────]             │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"My Elders"* (existing — keep; intermediary-register, concrete)
- Subtitle: *"People you support"* (existing)
- Empty state (current impl: *"No elders added yet. Tap + to add someone you support."*) → rewrite per BRAND.md §7 ("empty states are not failures") and §9 pattern: ***"You haven't added anyone yet. When you do, they'll appear here — you can set up their interface before they ever open the app."***
- Primary CTA: *"Add Elder"* (existing — intermediary surface English OK per §8)
- Status pill: *"active"* / *"paused"* — lowercase, `text-xs` (existing — keep, replace color tokens)

**Component composition:**
- Root: `bg-surface-intermediary`
- Header row: title `text-2xl font-bold text-neutral-800`, subtitle `text-sm text-neutral-500`, `+` button `w-11 h-11` (44px Vigía min) with Lucide `Plus` icon replacing `+` glyph
- List row card: per BRAND_MANUAL §6.2 — `bg-surface-intermediary-raised border-neutral-100 rounded-2xl p-5 mb-3`
- Lang pill: `bg-accent-100 text-accent-ink` (replaces `bg-nagi-100 text-nagi-700`)
- Status pill active: `bg-info-soft text-info` (replaces `bg-green-100 text-green-700`)
- Status pill paused: `bg-neutral-100 text-neutral-500`
- Empty-state container: `bg-white rounded-2xl p-6 border-neutral-100` — replace `👴` with Lucide `Users` icon at 32px in `text-neutral-400`, not `text-4xl` emoji
- Floating Add button: per BRAND_MANUAL §6.1 intermediary primary

**Accessibility checks:**
- Vigía 1A: `listElders(activeOrgId)` hits local SQLite mirror first (per ARCHITECTURE §3). Offline-safe.
- Vigía 1C: row tap target 44px+ via `p-5`. PASS.
- Contrast: `neutral-800` on `surface-intermediary-raised` → 13.9:1. PASS AAA.

**Edge states:**
- Loading: centered `ActivityIndicator color="#B8552B"` (replaces `#4f46e5`)
- Empty: copy above
- Error (sync fails): toast/banner at top — *"We're showing the version saved on this device. We'll refresh when the connection is back."* (mirrors BRAND.md §8 error pattern)
- Offline: same — local mirror serves, small `WifiOff` icon in header with text *"Offline"* in `text-info`

---

### Route 5 — `app/(intermediary)/organization.tsx`

**Purpose:** Org settings. Currently a placeholder.
**Audience:** Intermediary (owner/admin role).
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ Organization                         │
│                                      │
│  Family name  [Familia García]       │
│  Kind         [Family]               │
│  Members (3)                         │
│    ─ You (owner)                     │
│    ─ Carmen García (intermediary)    │
│    ─ Lucas (intermediary)            │
│  [+ Invite someone]                  │
│                                      │
│  ── Danger zone ──                   │
│  [Sign out]                          │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Organization"*
- Field hints: *"Family name"*, *"Kind"*, *"Members"*
- Invite CTA: *"Invite someone"* (never *"Add member"* — the relationship is human, not functional)
- Sign out: plain `text-neutral-600` link, no `safety-critical` color (sign-out is not dangerous data-loss)
- Current placeholder copy *"Step 4 wires org membership here."* is a contributor note and MUST be replaced before any external demo

**Component composition:**
- Root: `bg-surface-intermediary`
- Grouped list per BRAND_MANUAL §6.3 (field cards `divide-y divide-neutral-100 rounded-2xl bg-white`)
- Sign-out action: `py-4 text-neutral-600 text-base`, borderless row

**Accessibility checks:**
- Vigía 1C: all rows py-4. PASS.
- Role-gated actions (invite, rename) visible only to owner — non-owner sees member list read-only.

**Edge states:**
- Loading: skeleton list rows
- Empty (sole member): Members section shows *"Just you for now. Invite your co-intermediary when you're ready — you can keep working solo until then."*
- Error (save fails): inline *"Couldn't save. Your changes are on this device — try again when ready."*

---

### Route 6 — `app/(intermediary)/elders/new.tsx`

**Purpose:** Intermediary onboards an elder.
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ ← Back                               │
│                                      │
│  Add someone you support             │
│  You can adjust their experience     │
│  at any time.                        │
│                                      │
│  Their name                          │
│  [e.g. Abuela Rosa]                  │
│                                      │
│  Preferred language                  │
│  [Español] [English] [Português]     │
│                                      │
│                                      │
│                                      │
│  [ ─── Add Rosa ─── ]                │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Add someone you support"* (existing — keep; note §9 "someone you support" is warmer than "an elder")
- Subhead: *"You can adjust their experience at any time."* (existing — keep; reduces commitment pressure per §4 "one promise per sentence")
- Field hint: *"Their name"* (not *"Name"* — relational) (existing — keep)
- Placeholder: *"e.g. Abuela Rosa"* (existing — keep)
- Lang selector: *"Preferred language"* (existing)
- Dynamic CTA: *"Add Rosa"* / *"Add them"* when blank (existing — keep; this is an excellent micro-detail of presence per §9)
- Validation: *"Tell us what to call them."* (replaces existing *"Enter a name for the person you support"* — tighter, warmer, still precise)

**Component composition:**
- Segmented language selector: `flex-row gap-2`, each option `flex-1 py-3 rounded-xl border`, selected `bg-accent-600 border-accent-600 text-white`, unselected `bg-surface-intermediary-raised border-neutral-200 text-neutral-700`

**Accessibility checks:**
- Vigía 1C: language pills py-3 + text-base = 46px. PASS (just barely — increase to py-3.5 for safety).
- Keyboard: no ScrollView wrapper in existing impl; screen is short enough on most phones. On smaller screens the CTA may be covered by keyboard — wrap in `KeyboardAvoidingView` + `ScrollView` (match sign-up pattern).

**Edge states:**
- Loading: `ActivityIndicator` in button
- Error (offline create): local SQLite accepts + outbox queues — show nothing, proceed optimistically per ARCHITECTURE §3.2
- Error (validation): single-line red below fields

---

### Route 7 — `app/(intermediary)/elders/[id]/index.tsx`

**Purpose:** Elder overview card. Primary branching hub for the intermediary's work on this elder.
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ ← Back                               │
│                                      │
│  Rosa García                         │
│  [ES] [active]                       │
│                                      │
│  [── Open Rosa's interface ──]       │
│                                      │
│  ┌─ [⚙] Configure interface    › ──┐ │
│  │     Language, text size, cards   │ │
│  └──────────────────────────────────┘ │
│  ┌─ [📊] Activity log           › ──┐ │
│  │     Where they succeed and get  │ │
│  │     stuck                       │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
**Voice notes:**
- CTA to elder surface: existing is *"🧓 Open elder interface"*. Rewrite: ***"Open Rosa's interface"*** (name inclusion is §9 pattern; drop the emoji per iconography discipline).
- Section copy: *"Configure interface"* / *"Language, text size, cards"* (existing — keep).
- *"Activity log"* / *"Where they succeed and get stuck"* (existing — keep; latter half is exemplary §4 precise-plus-warm).
- Status pill: lowercase *"active"* (existing — keep).

**Component composition:**
- Entry into elder surface via the primary CTA calls `setActiveElder(id); router.push('/(elder)/')`. This is the only path that transitions between surfaces — preserve it exactly (existing impl lines 45-48).
- Navigation rows use Lucide `Settings`, `Activity` icons (24px, `text-neutral-600`) — replace emojis `⚙️` and `📊`.

**Accessibility checks:**
- Vigía 1C: all buttons ≥48px height via `py-4`/`p-4`.
- Vigía 1E: this route is step 2 of onboarding path.

**Edge states:**
- Loading (elder not yet loaded): centered `ActivityIndicator` (existing pattern)
- Not found (invalid id): redirect to `(intermediary)/` with a transient toast *"We couldn't find that person."*
- Offline: all data from local mirror — route works fully offline

---

### Route 8 — `app/(intermediary)/elders/[id]/configure.tsx`

**Purpose:** Intermediary configures elder's interface (language, text size, contrast, voice, offline message).
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ ← Back                               │
│ Configure interface                  │
│ Rosa García                          │
│                                      │
│  Display name                        │
│  [Rosa García]                       │
│                                      │
│  Language                            │
│  [Español] [English] [Português]     │
│                                      │
│  Text size                           │
│  [Normal] [Large] [X-Large]          │
│                                      │
│  ┌ High contrast         [ ON/OFF ] ┐│
│  │ Stronger borders and text        ││
│  ├ Voice input           [ ON/OFF ] ┤│
│  │ Microphone as primary input      ││
│  └──────────────────────────────────┘│
│                                      │
│  Offline fallback message            │
│  Shown when the AI is unavailable    │
│  [e.g. Estoy aquí contigo...]        │
│                                      │
│ ──────────────────────────────────── │
│  [ ─── Save changes ─── ]            │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Configure interface"* (existing)
- Subtitle: elder's display name (existing)
- Section headers: *"Display name"*, *"Language"*, *"Text size"*, *"Offline fallback message"*
- Toggle labels: *"High contrast"* / *"Voice input"* (existing)
- Toggle hints: *"Stronger borders and text"* / *"Microphone as primary input"* (existing — keep)
- Offline-message hint: *"Shown when the AI is unavailable"* (existing)
- Offline-message placeholder: *"e.g. Estoy aquí contigo. Llama a tu hija si necesitas ayuda."* (existing — this is exemplary elder-voice presence; keep)
- Save: *"Save changes"* (existing)

**Component composition:**
- Scroll container with bottom-fixed save bar (existing pattern — keep)
- `Switch trackColor={{ true: '#B8552B' }}` (replaces `#4f46e5`)
- Segmented selectors use the same styling as the new-elder route

**Accessibility checks:**
- Vigía 1C: all selectors py-3+ = ≥44px.
- Offline-message TextInput `multiline numberOfLines={3}` — keep.

**Edge states:**
- Loading: centered indicator (existing)
- Saving: indicator in Save button, button disabled
- Error (offline save fails): mirrors ARCHITECTURE §3.2 — local write succeeds, outbox queues; UX shows nothing different until retry cap hit, then a banner *"Your changes are saved on this device. They'll sync when Rosa's device reconnects."* (note: the save is on the intermediary's device, but the copy is about the data destination — clearer than talking about "the server")
- Conflict (two intermediaries edited): on pull, surface a non-blocking banner *"Carmen also edited Rosa's settings — we kept the latest. Review your changes below."* and highlight the diff row. Per ARCHITECTURE §3.4 last-write-wins.

---

### Route 9 — `app/(intermediary)/elders/[id]/activity.tsx`

**Purpose:** Review elder's recent activity — AI turns, UI actions, errors, offline incidents.
**Audience:** Intermediary.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ ← Activity log                       │
│ ──────────────────────────────────── │
│                                      │
│ [▶] "Hola, ¿dónde está Carmen ho..." │
│     5m ago                           │
│ [☰] call_family                      │
│     12m ago                          │
│ [⚠] AI unavailable — offline         │
│     2h ago                           │
│ [▶] "Gracias por la ayuda"           │
│     3h ago                           │
│                                      │
│ (pull to refresh)                    │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Activity log"* (existing)
- Row summary copy (existing helper `summaryText`) — acceptable; refine:
  - `ai_turn` → first 60 chars of message (existing — keep)
  - `ui_action` → human phrase. Map `{call_family: "Opened 'Call family'", get_help: "Opened help", my_day: "Opened 'My day'", one_task: "Opened 'One task'", emergency_help: "Pressed the help button"}`. Replace the raw `action` key display.
  - `error` → humanized message
  - `offline_ai_unavailable` → *"The AI was offline for a moment"* (replaces *"AI unavailable — offline"* — §5 intermediary is specific but not alarming)
- Timestamps: `relativeTime` (existing — keep; *"5m ago"*, *"2h ago"* matches §5 intermediary "specific").
- Empty state rewrite: ***"When Rosa uses the app, everything she does will show up here — taps, messages, and any moments she got stuck."*** Replaces *"No activity yet. Pull to refresh after they use the app."* — longer but warmer and specific to the named person.

**Component composition:**
- `FlatList` with `RefreshControl` (existing)
- Row: `bg-surface-intermediary-raised rounded-2xl px-4 py-3 border-neutral-100 flex-row items-start`
- Icons: replace emojis per BRAND_MANUAL §7.3. Map: `ai_turn` → Lucide `MessageCircle`, `ui_action` → Lucide `MousePointer`, `error` → Lucide `AlertTriangle`, `offline_ai_unavailable` → Lucide `WifiOff`. Size 24px, `text-neutral-500`.
- Primary text: `text-sm text-neutral-800 leading-snug`
- Timestamp: `text-xs text-neutral-400 mt-1` with `fontVariant: ['tabular-nums']`

**Accessibility checks:**
- Vigía 1C: rows are read-only — tap target less critical, but row height ≥48px maintained via py-3 + text content.
- Pull-to-refresh gesture: alternative explicit refresh button in the header for motor-accessibility (add a `RefreshCw` icon button).

**Edge states:**
- Loading: centered indicator
- Empty: copy above
- Offline: rows render from local mirror; header shows *"Offline — showing last synced activity"* banner in `bg-info-soft text-info`
- Pull-failed: `RefreshControl` finishes; small toast *"Couldn't refresh — showing last synced activity."*

---

### Route 10 — `app/(elder)/index.tsx`  *(THE ELDER HOME — THE PRODUCT'S THESIS)*

**Purpose:** The 4-card home per PRINCIPLES §4. Elder's single, calm starting surface.
**Audience:** Elder.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│  surface-elder (or dark in HC)       │
│                                      │
│           Hola, Rosa                 │  (text-4xl, neutral-800, centered)
│        ¿Qué necesitas hoy?           │  (text-base, accent-500, centered)
│                                      │
│  ┌─ 📞 ──────┐  ┌─ 🙋 ──────┐        │
│  │  Llamar  │  │ Necesito  │         │
│  │  familia │  │  ayuda    │         │
│  └──────────┘  └───────────┘         │
│                                      │
│  ┌─ ☀ ───────┐  ┌─ ✅ ──────┐        │
│  │  Mi día   │  │ Una tarea │        │
│  └───────────┘  └───────────┘        │
│                                      │
│                                      │
│  ┌────── Necesito Ayuda ──────┐      │  (safety-critical, 64px+)
│  └────────────────────────────┘      │
└──────────────────────────────────────┘
```
**Voice notes (THIS IS THE VOICE EXEMPLAR — match §5 elder exactly):**
- Greeting: *"Hola, Rosa"* (first name, existing via `display_name.split(' ')[0]`) — keep.
- Invitation: *"¿Qué necesitas hoy?"* (existing) — keep. Note this is an invitation, not a command (§5).
- Card labels (existing `CARD_DEFS`):
  - `call_family` → *"Llamar familia"*
  - `get_help` → *"Necesito ayuda"* (NOTE: this string also appears here and is different from the safety button — fine, they lead to different prime strings per the existing impl)
  - `my_day` → *"Mi día"*
  - `one_task` → *"Una tarea"*
- Help button: exactly *"Necesito Ayuda"* (BRAND.md §8 — exact phrase, never abbreviated). Existing impl: correct.
- No instruction text ("Tap a card…") anywhere — the cards are the instruction (BRAND.md §9).

**Component composition:**
- Root: `bg-surface-elder` (or `bg-surface-dark` when `highContrast`)
- Greeting: `TEXT_CLASS[textSize].heading` is `text-3xl/4xl/5xl` per size setting — matches BRAND_MANUAL §4.2
- Card container: existing `width: '47%', aspectRatio: 1` — passes 56px tap target massively (aspect-ratio square on a phone = ~180px)
- Card styling (replace):
  - Light: `bg-surface-elder-raised border-neutral-100 rounded-3xl`
  - High-contrast: `bg-surface-dark-raised border-neutral-700` (warmer than current `bg-gray-900 border-gray-600`)
- Card emoji: `text-5xl` (existing — keep; emoji is the familiar-object icon per BRAND_MANUAL §7.2)
- Help button (replace):
  - `bg-safety-critical-soft border-2 border-safety-critical-border rounded-2xl py-5`
  - Label: `text-safety-critical font-bold text-3xl` (tc.btn matches BRAND_MANUAL §4.2)
- Remove the `text-nagi-500` on subtitle line 56 — replace with `text-accent-500`

**Accessibility checks (Vigía 1C, 1B):**
- Text sizes: `TEXT_CLASS` covers lg/xl/2xl — `TEXT_CLASS.lg.heading = text-3xl = 32px`, far above 20px floor. PASS.
- Tap target: cards are ~180px square, help button py-5 + text-3xl ≈ 68px. PASS (§5.2 requires 56px elder, 64px help).
- High contrast: `bg-black` / `bg-white` correctly applied from `ElderCtx`. Replace with `surface-dark` / `surface-elder` tokens for warm fidelity.
- Offline (Vigía 1B): `useElderCtx` loads from local SQLite — no network required. PASS.
- No hidden gestures: every navigation is an explicit visible tap target. PASS.

**Edge states:**
- Loading (elder context not ready): centered `ActivityIndicator color="#B8552B"` on `bg-surface-elder` — existing pattern.
- Empty (`elder.ui_config.home_cards` empty): currently falls back to all four card keys. If an intermediary explicitly configures zero cards, show a single card containing only the *"Necesito Ayuda"* text at full width — the help button is the irreducible minimum (never fewer than one action on screen, never elder stranded).
- Error: unreachable — this screen does not make network calls. Any failure is loading-state only.
- Offline: same as loaded state — no offline-specific copy needed.

---

### Route 11 — `app/(elder)/chat.tsx`

**Purpose:** Elder speaks or types to Nagi (AI); receives streamed reply; TTS plays it back.
**Audience:** Elder.
**Layout sketch:**
```
┌──────────────────────────────────────┐
│  ←  凪 Nagi               [Voz ON]  │
│ ──────────────────────────────────── │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ Quiero llamar a Carmen.       │   │
│  └───────────────────────────────┘   │  (user, accent-600 bubble)
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Hola Rosa. Voy a ayudarte a    │  │
│  │ llamar a Carmen ahora mismo.   │  │
│  └────────────────────────────────┘  │
│   [▶ Repetir]                        │  (assistant, white bubble + replay)
│                                      │
│    ||||||||  Escuchando…             │  (listening waveform, centered)
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  (●)  Hablar                    │ │  (mic, 80px circle)
│  └─────────────────────────────────┘ │
│  [O escribe aquí…            ] [→]   │
│  [ ─── Necesito Ayuda ─── ]          │
└──────────────────────────────────────┘
```
**Voice notes (elder register — §5):**
- Header wordmark: *"凪 Nagi"* (existing) — keep.
- Voice toggle: *"Voz ON"* / *"Voz OFF"* (existing) — keep.
- Listening indicator: *"Escuchando…"* / *"Esperando voz…"* (existing) — keep; present-tense, invitation.
- Speaking indicator: *"Nagi está hablando…"* (existing) — keep.
- Placeholder: *"O escribe aquí…"* (voice on) / *"Escribe aquí…"* (voice off) — keep.
- Replay button: *"▶ Repetir"* (existing) — keep; verb form (not "Replay" English loanword).
- Help button: *"Necesito Ayuda"* (exact) — keep.
- **Fallback when AI unavailable** (per existing impl fallback line 184): ensure `elder.ui_config.offline_message` has a default. If intermediary left it blank, fallback is the second line *"Ahora mismo no puedo responder. Llama a tu familia si necesitas ayuda."* This fallback is the elder-voice presence-keeper (never *"Error"*, never *"AI down"*).

**Component composition:**
- Root: `bg-surface-elder` (or `bg-surface-dark` in HC) — replace `bg-gray-50` / `bg-black`
- Header border: `border-neutral-100` (replace `border-gray-100`)
- Messages FlatList: contentContainerStyle unchanged
- User bubble: `bg-accent-600` with `text-white` (replaces `bg-nagi-600`)
- Assistant bubble: `bg-surface-elder-raised border-neutral-100` with `text-neutral-800`
- Mic button:
  - Idle: `bg-accent-600`, size 80×80, `rounded-full`
  - Listening: `bg-safety-critical` (existing uses `bg-red-500` — migrate to token)
  - Label inside button white
- Send button: `bg-accent-600 rounded-xl px-4 py-3`
- Help button (replace existing):
  - `bg-safety-critical-soft border border-safety-critical-border rounded-xl py-4` (increase from py-3.5 to hit 64px floor per BRAND_MANUAL §5.2)
  - Label `text-safety-critical font-bold text-2xl`
- Waveform bars: color `#B8552B` when active (replaces `#4f46e5`), `accent-100` when idle (replaces `#c7d2fe`)

**Accessibility checks (Vigía 1B, 1C):**
- Text sizes: `TEXT_CLASS` maps cover lg/xl/2xl across body/input/btn. PASS.
- High contrast: applied via `textColor` = `text-white` on `bg-surface-dark`. PASS.
- Tap targets:
  - Mic: 80×80. PASS.
  - Send: py-3 + text-base ≈ 44px. PASS (at intermediary floor).
  - Help: needs py-4 bump to reach 64px. FLAG — adjust in implementation.
  - Voice toggle header: py-1.5 ≈ 32px. FAIL (below 44px). Bump to py-2.5 or wrap in `hitSlop={{top:8,bottom:8,left:8,right:8}}`.
  - Back arrow: p-1. Similar — add `hitSlop` or bump padding.
- Offline behavior (Vigía 1B): existing try/catch at line 168-194 handles SSE failure — surfaces fallback text. PASS.

**Edge states:**
- Loading (first render, elder ctx): centered `ActivityIndicator` (existing).
- Streaming: `role: 'streaming'` bubble shows running content + ellipsis (existing).
- Empty (no messages yet): FlatList has no `ListEmptyComponent`. Add one: full-panel greeting *"Hola, Rosa. Cuéntame qué necesitas — puedes hablar o escribir."* in `text-2xl text-neutral-600 text-center px-8`. This converts first-open from blank scroll to welcoming invitation.
- Offline: fallback copy auto-served via catch block. Show small banner at top *"Estoy aquí contigo. Vamos a intentarlo en un momento."* in `bg-accent-50 text-accent-ink`.
- Error other (cancelled, bad response): same fallback pattern — never surface the word *error* (§5 elder).
- **Prime message delivery:** `router.push` from the home passes `prime` param; chat auto-sends on mount. Existing impl does not appear to pick up `params.prime` in this file — verify in implementation and ensure prime auto-submits on screen-enter without elder action. This is the onboarding path's §4 "one action per moment" contract.

---

### Route 12 — `app/+not-found.tsx`

**Purpose:** Fallback for unknown routes.
**Audience:** Transitional — could be either. Default to intermediary surface since elders never get here (elder surface has no URL entry).
**Layout sketch:**
```
┌──────────────────────────────────────┐
│ surface-intermediary, centered       │
│                                      │
│          凪   (text-6xl)             │
│                                      │
│     Page not found                   │
│                                      │
│     Go home                          │
└──────────────────────────────────────┘
```
**Voice notes:**
- Title: *"Page not found"* (existing) — keep. Intermediary register.
- Link: *"Go home"* (existing) — keep.
- NOT to rewrite to elder register — this page is reached by intermediaries clicking broken deep-links, never by elders.

**Component composition:**
- `bg-surface-intermediary` (replace `bg-white`)
- Kanji `text-6xl mb-4 text-neutral-800` (replace default black)
- Title `text-xl font-semibold text-neutral-800`
- Link `text-accent-600 font-medium` (replaces `text-nagi-600`)

**Accessibility checks:** standard — PASS.

**Edge states:** n/a (this IS an edge state).

---

## 3. Gap analysis — screens missing for v0

The 12 routes compile and cover the technical happy path. For the product story (BRAND.md §1 north star) to *feel* complete, these screens are missing:

### 3.1 Elder first-run state
- **Missing:** when an intermediary opens `/(elder)/` for the first time on a device handed to an elder, there is no "handoff moment." The elder simply arrives at the home.
- **Proposed addition:** `app/(elder)/welcome.tsx` (new route). Shows only: *"Hola, Rosa. Carmen preparó esto para ti."* and a single button *"Empezar"*. First-open only (tracked in local SQLite). This is the UI embodiment of BRAND.md §1 — "a trusted human prepared this."
- **Priority:** HIGH. Without it, the product does not narrate its own thesis on first contact.

### 3.2 Intermediary "zero elders" first-run
- **Current:** `/(intermediary)/index.tsx` empty state handles this with one card + *"No elders added yet"* copy.
- **Proposed upgrade:** on true first sign-in (no elders ever created), show a one-screen pre-step: *"Welcome, Carmen. Who will you be setting up for?"* + single name input → creates elder + lands in configure. Collapses 3 screens into 1 for the first-time moment.
- **Priority:** MEDIUM. Nice-to-have; doesn't block hackathon demo.

### 3.3 Org invite / accept flow
- **Missing:** `/(intermediary)/organization.tsx` is a placeholder. Inviting a second intermediary to an org has no UI path.
- **Proposed:** `elders/[id]/share.tsx` for elder-scoped invitation ("invite Carmen to co-support Rosa"), plus email-based acceptance flow.
- **Priority:** LOW for v0 (assumption §8 in ARCHITECTURE: most intermediaries solo). Named as v1.

### 3.4 Elder side — "my intermediary" identity
- **Missing:** the elder never sees who configured this device. Per PRINCIPLES §5 ("presence is designed in"), the identity of the intermediary should be visible — a small footer on elder home: *"Preparado por Carmen."*
- **Proposed:** footer line on `/(elder)/index.tsx`, `text-base text-neutral-500 text-center mb-2`, conditional on `ui_config.show_intermediary = true`.
- **Priority:** HIGH. Cheap to add; directly realizes the north-star sentence.

### 3.5 Elder post-completion state
- **Missing:** after a chat exchange, the elder is stuck in the chat thread with no calm exit other than the back arrow. There is no "the moment ended well" signal.
- **Proposed:** after TTS completes the assistant turn, show a soft floating return-home button *"Volver"* above the input area for 8 seconds, fading in per §8 motion.
- **Priority:** MEDIUM. Improves dignity of exit.

### 3.6 Intermediary sync status
- **Missing:** intermediary has no global view of "are Rosa's changes synced?" Activity log shows events, not sync state.
- **Proposed:** thin status bar at top of `/(intermediary)/index.tsx`: green dot + *"Synced 2m ago"* or amber + *"3 changes saved on this device, will sync when online."*
- **Priority:** MEDIUM. Matters more once multiple elders accumulate.

### 3.7 Organization screen completion
- **Missing:** sign-out, account deletion, org rename, leave-org are all absent.
- **Priority:** MEDIUM before any public release; LOW for hackathon demo.

---

## 4. Verification bar — per-route

For the design-to-implementation handoff, each route ships only when:

- [ ] Uses tokens from BRAND_MANUAL.md, no inline hex values
- [ ] Surface dominance matches the surface table in BRAND_MANUAL §2
- [ ] All copy strings match the voice notes in §2 of this spec
- [ ] Vigía gates 1A–1E are satisfied (see per-route checklists)
- [ ] Tap targets meet BRAND_MANUAL §5.2
- [ ] No banned move from BRAND.md §6 appears
- [ ] Empty / loading / error / offline states are implemented, not stubbed
- [ ] The word *"user"* does not appear in any visible string
- [ ] On a dark-skinned tester and a silver-haired tester in side-by-side screenshots, the elder vs intermediary surfaces are visually distinguishable without labels

---

## 5. Stop-condition surfacing

Per the build packet's stop conditions, reviewed against the 12 routes:

- **Stop 1 (voice vs WCAG):** NOT TRIGGERED. All elder body-text pairings pass AAA (`neutral-800` on `surface-elder` = 12.41:1). The accent/intermediary constraint (§3.5) is an intra-intermediary concern resolved by reserving `accent-primary` for ≥18px targets.
- **Stop 2 (NativeWind config):** TRIGGERED but resolved. The existing `nagi: { indigo }` tokens must be replaced. Required additions specified in §0 of this file — a single `tailwind.config.js` diff. Does not require a custom Tailwind plugin; all additions are standard `theme.extend.colors` entries. Not a build blocker.
- **Stop 3 (route serves both audiences):** NOT TRIGGERED. Every route was audited. The transition from intermediary to elder surface is explicitly gated by `setActiveElder` in `elders/[id]/index.tsx` line 46 — no route renders both audiences simultaneously.

---

*Authored under Kronos discipline. Bound to BRAND.md, BRAND_MANUAL.md, PRINCIPLES.md, ARCHITECTURE.md. Licensed CC BY 4.0.*
