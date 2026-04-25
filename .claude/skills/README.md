# Nagi runtime skills

These markdown files are the canonical, human-editable source of the
skills the elder-facing AI loads at runtime.

The actual file the edge function consumes is
[`supabase/functions/_shared/skills.ts`](../../supabase/functions/_shared/skills.ts) — a
single TypeScript module with each skill as an exported template
literal. We keep the `.ts` version because Supabase edge function
deployments only bundle files inside `supabase/functions/`, and runtime
filesystem reads in edge runtime are fragile.

**To edit a skill**: edit the `.md` file here for clarity and review,
then copy the new text into the matching constant in `skills.ts`. The
two stay in sync by convention.

## Why skills?

Inspired by the CrossBeam "skills-first" pattern (Anthropic
"Built with Opus 4.6" winner — 28 reference files for ADU permit law
loaded selectively into context). We borrow the shape: short reference
cards, loaded based on the elder's profile, kept in a stable order so
they share a prompt cache hit.

## Resolution rules

`resolveSkills(profile, preferredLang)` in `skills.ts`:

- Always: `cognitive-accessibility`, `tech-support-common-tasks`
- One language card based on `preferred_lang` (Spanish or English; English doubles as the fallback for Portuguese)
- `low-vision` if `accessibility_notes` mentions vision keywords
- `dementia-aware` if `communication_notes` or `accessibility_notes` mentions memory/confusion keywords

## Files in this directory

- [elder-communication-spanish.md](elder-communication-spanish.md)
- [elder-communication-english.md](elder-communication-english.md)
- [cognitive-accessibility.md](cognitive-accessibility.md)
- [low-vision.md](low-vision.md)
- [tech-support-common-tasks.md](tech-support-common-tasks.md)
- [dementia-aware.md](dementia-aware.md)

## Contributing a new skill

1. Add a new `.md` file with a clear single-purpose title.
2. Add a matching constant + an entry in `resolveSkills` in `skills.ts`.
3. Keep skills under ~600 words. Long skills break cache budgets and
   dilute the model's attention. If a skill is bigger than that, it
   should probably be two skills.
