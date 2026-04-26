/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ───────────────────────────────────────────────────
        // Fog White (#F7F5F2) replaces the prior warm cream as the
        // dominant surface for both elder and intermediary. Elder and
        // intermediary share the surface family — the difference between
        // surfaces is structure and density, not hue.
        surface: {
          elder:                 '#F7F5F2',  // Fog White — main background
          'elder-raised':        '#FAF5EC',  // Paper — raised cards, chat bubbles, inputs
          'elder-sunken':        '#EDEAE3',  // Fog White deep — pressed/sunken
          intermediary:          '#F7F5F2',
          'intermediary-raised': '#FAF5EC',
          'intermediary-sunken': '#EDEAE3',
          dark:                  '#1E1E1E',  // Charcoal Root — HC mode background
          'dark-raised':         '#2A2A2A',  // Charcoal lifted — cards on dark
          'dark-deep':           '#0F0F0F',  // Charcoal Root deep — true-deep canvas, max-emphasis
        },

        // ── Paper — the palette's "whitest" tool ──────────────────────
        // Aliased to surface-*-raised but exposed as a top-level
        // shortcut so `text-paper` / `bg-paper` reads naturally for
        // labels on Pine Deep buttons and any context that would
        // otherwise reach for pure #FFFFFF. Pure white never appears in
        // the brand — when the eye wants "whitest", this is whitest.
        paper: '#FAF5EC',

        // ── Charcoal — the palette's "deepest" tool ───────────────────
        // For backgrounds and ink that would otherwise reach for
        // pure #000000. Two stops:
        //   charcoal       (= surface-dark)       Charcoal Root
        //   charcoal-deep  (= surface-dark-deep)  near-pure black, palette-grounded
        charcoal: {
          DEFAULT: '#1E1E1E',
          deep:    '#0F0F0F',
        },

        // ── Pine Deep — primary structural accent ─────────────────────
        // The Penjing pine of PHILOSOPHY.md, made visible. Replaces the
        // prior terracotta. #34503E is #2D4A3E warmed five degrees toward
        // olive so the palette doesn't read as cold against Spanish copy
        // or LATAM-aesthetic skin tones in product photography.
        accent: {
          50:  '#EFF3EE',  // Pine breath — softest hover/highlight
          100: '#DDE5DF',  // Pine wash — tag backgrounds, soft pills
          500: '#3F5E48',  // Pine medium — secondary buttons
          600: '#34503E',  // Pine Deep — the primary
          700: '#26392F',  // Pine Deeper — pressed state
          ink: '#1A2E25',  // Pine ink — text on Pine wash backgrounds
        },

        // ── Sea Lull — secondary, calm, the still water of 凪 ──────────
        // #5C7A85 (Sea Lull Deep) is text-safe at large sizes (≥18px)
        // and for UI components. #8BA7B0 (Sea Lull) is decoration-only
        // — too light for body text. Use neutral-700 for inline body
        // copy when you need a sober tone instead.
        secondary: {
          DEFAULT: '#5C7A85',
          tint:    '#8BA7B0',
          soft:    '#DDE5DF',
        },

        // ── Aged Cream — warm signal for calm callouts ────────────────
        // Used for input field backgrounds, pull-quotes on web, and
        // any "this is a notable moment" callout that's NOT an alert.
        // Pairs with Charcoal Root for AAA contrast.
        cream: {
          DEFAULT: '#F0E8D8',
          deep:    '#E5D9C2',
        },

        // ── Neutrals — Charcoal Root family ───────────────────────────
        // Shifted from the prior warm-biased scale (HSL hue ≈ 30°) to
        // a true near-neutral. The new surfaces are cooler than before,
        // so warm-biased neutrals would dissonance against them.
        neutral: {
          50:  '#FAFAFA',
          100: '#F0F0EE',
          200: '#E0DFDC',
          300: '#C2C0BC',
          400: '#9A9A95',
          500: '#727270',
          600: '#545454',
          700: '#3D3D3C',
          800: '#2A2A2A',
          900: '#1E1E1E',  // Charcoal Root
        },

        // ── Safety — the named exception ──────────────────────────────
        // Red is forbidden everywhere except the elder emergency button.
        // See BRAND_MANUAL.md §3.4 for the carve-out rationale: the one
        // place red earns its keep is the "Necesito ayuda / I Need Help"
        // surface, where universal arousal value matters more than
        // brand-voice purity. Do NOT use safety-critical for anything
        // else — not for cancel buttons, not for delete confirms, not
        // for inline error text.
        safety: {
          critical:        '#C8392E',
          'critical-soft': '#FBE8E5',
          'critical-border':'#F4C4BE',
        },

        // ── Alert — Warm Ochre, for non-emergency signal ──────────────
        // Toast banners, deadline reminders, "this thing needs attention
        // but isn't urgent." DEFAULT for backgrounds + large UI; deep
        // for icons and inline text where AA-normal contrast matters.
        alert: {
          DEFAULT: '#C8874A', // Warm Ochre — backgrounds, ≥18px UI
          deep:    '#8B5C24', // text-safe for inline labels
          soft:    '#F2DDC4',
        },

        // ── Status tokens — kept ──────────────────────────────────────
        // Olive carries over from the prior palette: presence-of-arrival
        // (received, saved) without checkmark theater. The new info
        // routes through Sea Lull Deep so "neutral status" reads as
        // calm-water rather than cool-corporate.
        presence: { DEFAULT: '#7A8C4F', soft: '#EEF1E2' },
        info:     { DEFAULT: '#5C7A85', soft: '#DDE5DF' },
      },
    },
  },
  plugins: [],
};
