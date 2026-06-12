# Persona Voice A/B: "Counting to 10" (kindergarten) — 2026-06-11

First verification of the persona slice: the generation-context endpoint now
returns a `studentProfile` voice persona (firstName, interests, learning
goals/styles, streak, lastSession from the durable attempt log), and the
manifest prompt gains a STUDENT VOICE block (`buildStudentVoiceBlock`) that is
deliberately separate from the IRT STUDENT PROFILE block.

**Contract:** voice = WORDS ONLY (greeting, theming, continuity). Structure
(component selection, phases, difficulty, counts, ranges, scope) stays with the
IRT calibration block and the pedagogical scope. This is the proven
words-vs-numbers division — prompt-level voice is reliable precisely because
there is no numeric constraint for the LLM to trade off against.

## Method

`POST /api/lumina/topic-trace` with fixed objectives (brief skipped, so both
runs build the same lesson), `manifestOnly: true`, ± a fabricated
`studentContext.studentProfile` (Chris; dinosaurs + soccer; 4-day streak; last
session 2026-06-10: 7 activities on ten-frame/counting-board, 6/7).

## Results

### Run A (no persona) — baseline
Generic titles/intents ("Filling the Ten Frame", "Counting Picnic Snacks").
`personalization.applied: false`, no voice block. Unchanged behavior. PASS

### Run B, first attempt — over-theming caught
Persona applied, but interests were woven into ~6 of 7 component intents
("1-2 components at most" lived in the soft HOW-TO section and was ignored).
**Fix:** moved the cap into VOICE RULES as a hard constraint with explicit
counting language ("Theme AT MOST 2... count your themed intents before
finalizing").

### Run B, re-run — PASS on all criteria
- **curatorBrief greeting**: "Let's Count to 10, Chris!" — greets by name,
  celebrates the streak, references last session's ten-frame work, previews
  today. (Trace route now echoes `curatorBrief` for exactly this assessment.)
- **Theming restraint**: exactly 2 themed intents (Soccer Ball Count
  counting-board, Dinosaur Ten-Frame); number-line, subitizing components, and
  finalAssessment stayed interest-neutral.
- **Structure untouched by voice**: same objective coverage and phase
  progression shape as baseline; no difficulty/count/range language introduced
  by the persona.
- **No mechanics leakage**: no mention of profiles, data, or personalization in
  student-facing text.

Note: minor LLM inference — a 4-day streak was rendered as "your 5th day in a
row" (4 days + today). Acceptable framing, not a fabrication class to chase.

## Verification

- `tsc --noEmit`: 1441 global errors (baseline 1444) — none in touched files.
- Backend helpers unit-checked (py311env): `_first_name` (email rejection,
  empty), `_last_session_from_attempts` (day grouping, legacy score>=8
  fallback, empty/unparseable → None).
- Persona is fail-soft end to end: any error → `studentProfile: null`; persona
  alone flips `available: true` so voice works even when no objective resolves.

## Files

- `backend/app/api/endpoints/student_profile.py` — persona builder + response
- `lumina/service/studentContext/types.ts` — StudentPersona/StudentLastSession
- `lumina/service/manifest/gemini-manifest.ts` — buildStudentVoiceBlock + wiring
- `app/api/lumina/topic-trace/route.ts` — voiceBlock + curatorBrief echo

## Known gaps (deliberate, next slices)

- `interests` has no collection UI yet — honored from
  `preferences.interests` the moment something writes it (onboarding extension).
- Persona reads the AUTHENTICATED user's profile while IRT state is keyed by
  `request.student_id` — same student in prod, divergent in dev (1004). The
  auth resolver swap closes this.
- Generator-level theming depth (counters drawn as dinosaurs, not just word
  theming) is a primitive-side feature, out of scope for the voice slice.
