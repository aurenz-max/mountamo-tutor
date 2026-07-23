# di-letter-sounds — L1 eval-modes (2026-07-22)

**Layer: L0 → L1 (eval-dense).** `/add-eval-modes` on the first DI-family primitive.
Birth-cert follow-up #1 struck. Ladder next = `/add-tutoring-scaffold` (L2).

## Modes added (task identities, not difficulty tiers)

All three stay inside the **benched continuant response class** — the audio the
child produces is a held sound in every mode, so no new bench sitting is needed
(standing gate 1 satisfied). Letter NAMES stay BLOCKED; blends/digraphs/stops
bench first.

| evalMode | β / scaffold | task | challengeType | set composition |
|---|---|---|---|---|
| `letter_sound` (base) | 1.5 / 1 | see a letter, produce its continuous sound | `letter_sound` | focused objective cluster, teaching order |
| `letter_sound_review` | 2.5 / 2 | cumulative/spaced review of taught sounds | `letter_sound_review` | anchors 1–2 focus letters, then **broadens** across the menu |
| `first_sound_in_word` | 3.5 / 3 | onset isolation from a spoken WORD (phonemic awareness) | `first_sound_in_word` | **continuant keywords only** (short-vowel onset distorts for K) |

β mirrored into `backend/app/services/calibration/problem_type_registry.py`.
Discrimination omitted → 1.4 default (matches backend fallback).

## Architecture — Fork A

Gemini emits only the wrapper (title + `targetLetters` from the curated menu);
**code** builds every challenge and stamps `challengeType`. So there is no Gemini
challenge-type enum to constrain (`constrainChallengeTypeEnum` N/A). Instead:

- `resolveEvalModes('di-letter-sounds', …)` routes intent→mode (explicit pin =
  no LLM call; unpinned = one flash-lite enum micro-call; broad = null/mixed).
- Code builds mode-appropriate letter pools (`lettersForType`) and stamps the type.
- **Mixed path (SP-21):** interleaves all three modes, each pool rotated by mode
  index so round 0 doesn't stack one keyword. Never a single Gemini-picked type.

## New pedagogy surface

- `diLetterSoundsScript.ts`: onset cue branch on `first_sound_in_word` for
  model/guide/test/verify/correction. Sentinels unchanged (`Yes` / `My turn`),
  collision-checked — model="Listen: …", guide="Together: …", test="Your turn.
  What is the first sound in …?".
- `DiLetterSounds.tsx`: onset items render the **picture + word** (not the lone
  grapheme) so the display can't leak the sound the child must hear out of the word.

## Verification

- **Real-Gemini eval-test (dev server, port 3001) — PASS ×4:**
  - `letter_sound` pinned → all `letter_sound`, focused m/s/f/a.
  - `letter_sound_review` pinned → all `letter_sound_review`; broadens to non-focus
    letters (m,s,r,i) after the review-anchor fix.
  - `first_sound_in_word` pinned → all onset; vowel `a` correctly excluded,
    backfilled with continuant `r`.
  - `mixed` → true 3-type interleave, staggered keywords (after the rotate fix).
- **Oracle spec** `gemini-di-letter-sounds.test.ts` (vitest, geminiClient mocked to
  force the deterministic fallback) — **4/4 PASS**. Keepable regression guard for
  the ladder contract (all-one-type per pin; review broadens; onset continuant-only;
  mixed = 3 types + staggered).
- **typecheck:lumina:** 0 errors from this work. (Pre-existing failures in
  `DiWordReading.tsx` are a concurrent `di-word-reading` WIP — unrelated.)

## Still open

- **HUMAN-CHECKS #42** — the NEW `first_sound_in_word` live-tutor wording has never
  been spoken by the Live tutor; needs one browser+mic glance (onset cues + judging
  + picture/word stage + review breadth).
- Intent-routing to the right single mode from a real objective (the path the
  tester's explicit pin can't exercise) — verify via `/topic-trace` on a
  phonemic-awareness objective when the lesson path is next driven.

## Files touched

- `service/direct-instruction/gemini-di-letter-sounds.ts` (mode building)
- `primitives/visual-primitives/direct-instruction/diLetterSoundsScript.ts` (onset cues + type)
- `primitives/visual-primitives/direct-instruction/DiLetterSounds.tsx` (display + metrics)
- `service/manifest/catalog/di.ts` (evalModes)
- `evaluation/types.ts` (metrics union)
- `app/api/lumina/eval-test/route.ts` (validator reads `challengeType`)
- `components/DirectInstructionPrimitivesTester.tsx` (mode selector; since extended by the di-word-reading build)
- `backend/app/services/calibration/problem_type_registry.py` (β priors)
- `service/direct-instruction/gemini-di-letter-sounds.test.ts` (new oracle)
