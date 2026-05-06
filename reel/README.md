# Nagi — Demo Reel Workflow

A 75-second demo reel for the Claude 4.7 hackathon submission.
**Recording-first, not pipeline-first** — the polish comes from good narration and good app captures, not from rendering tooling.

## What lives here

```
reel/
├─ script.json          ← single source of truth: timing, voice, captions
├─ cards/               ← brand stills (open in browser, screenshot once)
│  ├─ _shared.css
│  ├─ brand.html        ← 凪 ink-reveal still — for the philosophy beat (52–65s)
│  └─ outro.html        ← QR + creds + footer credit — for the invitation (65–75s)
├─ scripts/
│  └─ render-srt.ts     ← regenerates captions.srt from script.json
├─ captions.srt         ← gitignored — drop this onto your CapCut timeline
└─ README.md
```

That's it. No Node server, no Playwright, no ffmpeg. The reel is assembled in CapCut from the captures + narration + two PNG stills + the SRT file.

## Tools you'll use

| Stage | Tool | Why |
|---|---|---|
| App captures | **Tella.tv** (free, web, Windows-friendly) | Auto-zoom on clicks, smooth cursor, gradient bgs — the polish you'd otherwise hand-craft |
| Narration | **Your voice** on a phone or USB mic | Real human voice on a care product > any TTS. If unavoidable, use ElevenLabs free tier (10k chars/mo) |
| Stills | **Browser screenshot** of `cards/brand.html` and `cards/outro.html` | One-time export, no build step |
| Final cut | **CapCut** (free, Windows) | Timeline editor, drops the SRT as captions, auto-loudness, exports MP4 |

## Step-by-step (target: 3–4 hours total)

### 1 — Generate the captions file (10 sec)

```bash
pnpm reel:srt
```

Writes `reel/captions.srt`. Re-run any time you edit `script.json`'s `subtitle_en`.

### 2 — Export the two brand stills (5 min each)

For both `cards/brand.html` and `cards/outro.html`:

1. Open the file in Chrome at exactly **1920×1080** (DevTools → Toggle device toolbar → Responsive → set to 1920×1080).
2. Wait for fonts to load and animations to settle (`brand.html`: wait ~5s for the ink-reveal to complete; `outro.html`: instant, no animation).
3. **Cmd/Ctrl+Shift+P** → "Capture full size screenshot" (or use a screenshot tool of your choice).
4. Save as `reel/assets/brand.png` and `reel/assets/outro.png`.

### 3 — Record app captures in Tella.tv (60–90 min, the actual work)

Sign in to Tella.tv (free tier covers this). For each `tella://*` shot in `script.json`:

| Shot | Recording target | What to show |
|---|---|---|
| `app-pin` (≥9s) | Caregiver flow start | Open Nagi → enter PIN for Pemberton family → land on home |
| `app-digest` (≥14s) | The daily digest | Open Eleanor Pemberton's digest → scroll showing AI-written summary |
| `app-reply` (≥14s) | Care-circle reply | Family member sends voice/photo/text → cut to elder receiving it |

Tella adds the polish (auto-zoom, gradient bg, smooth cursor) automatically — you just have to perform the flows cleanly. Take 2–3 takes per shot.

### 4 — Record narration in Spanish (30 min)

Read each `voice_es` line from `script.json` aloud. Record on your phone or a USB mic, one continuous take per shot is easiest. Save as `reel/audio/<shot-id>.m4a` (or whatever your phone produces).

If you don't want to record yourself: paste each `voice_es` line into **ElevenLabs** (free tier, generate a Spanish voice clone or pick `Mateo`/`Valentina`), download MP3 per shot.

### 5 — Assemble in CapCut (30–45 min)

1. New 1080p / 30fps project.
2. Drag the Tella exports onto the timeline at the times specified in `script.json` (`t` field).
3. For the still beats (problem-1, problem-2, philosophy, invitation): drop the brand stills as image clips for the listed `dur`. For the two `problem-*` beats — there's no still file, just use a solid charcoal background (CapCut → Color → `#0F0F0F`) with the `subtitle_en` rendered as on-screen text in a serif font.
4. Drag your narration audio under each shot.
5. **File → Import → captions.srt** to drop the English captions as a subtitle track.
6. (Optional) add a soft pad of music — Pixabay/Uppbeat free tracks work; keep it under -22dB so it doesn't fight the voice.
7. Export 1080p MP4, normalize loudness on export.

## Iterating

| You changed | Re-run |
|---|---|
| `subtitle_en` in `script.json` | `pnpm reel:srt`, re-import SRT into CapCut |
| `voice_es` | Re-record / re-generate that one shot, replace audio in CapCut |
| Brand still | Re-screenshot `cards/*.html`, swap PNG in CapCut |
| Tella capture | Re-record, swap clip in CapCut |

`script.json` stays the truth-of-record for what's said, in what order, for how long. Everything downstream is replaceable from it.

## Why this approach

The original draft of this pipeline was a Playwright + Edge TTS + Docker ffmpeg stack that would have eaten a full day to debug for a 75-second video. For a hackathon, that's the wrong trade. **Tella.tv already does the visual polish; CapCut already does the cuts; your voice already does emotional weight.** The only piece worth automating is `captions.srt` so the script and the captions can never drift.
