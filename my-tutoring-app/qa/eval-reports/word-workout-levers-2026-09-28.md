# word-workout picture_match levers — 2026-09-28

Handoff 22 L1, primitive 4 of 5. Executor `/add-support-tiers`. Contract: `docs/contracts/word-workout.md` (derived this slice, R11 added).

## Failure inventory

No real-learner evidence exists for this primitive. The misses come from `wordWorkoutMiss`: `same_start`, `same_end`, `same_vowel`, `other_word`. Every miss gets `sound_dots` first, then `two_far_pictures`. The spoken modes are left for L3 (the shared print overlay).

## Built

~120 production lines: `wordWorkoutLevers.ts` (new) plus the wiring in `WordWorkout.tsx`. ~150 test lines.

- **`sound_dots`** (help): one dot under each grapheme, with a digraph counted as one, and an arrow under the word. Nothing is voiced. `graphemes()` is the first piece of the L3 print overlay.
- **`two_far_pictures`** (simplify): a practice word drawn from the picturable CVC pool shared with cvc-speller, in the lesson's vowels, against one foil that starts and ends differently from it.

**Contract fix during the slice.** The first version picked "sun" for an a/i lesson, which breaks R1: every word must stay in the lesson's vowels. Both words now stay in scope. In a one-vowel lesson the foil necessarily shares the vowel, so "far" means a different first letter and a different last letter.

The same check led to a change in cvc-speller: its practice word now keeps the objective's `vowelFocus` when the objective names one.

## Measured

| Gate | Result |
|---|---|
| Lever unit + mounted tests | 15 pass |
| All literacy tests | 87 files, 1802 pass |
| Dry journey, all payloads | 340/340 |
| `typecheck:lumina` | 0 |
| Tutor replay, 5 samples (`qa/tutor-reports/replay/word-workout-2026-09-28.json`) | 0 misses on every check. The tutor pulled `sound_dots` itself in 5/5 samples at "stuck" and 3/5 at "miss". It never read the word. |
