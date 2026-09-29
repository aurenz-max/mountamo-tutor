# cvc-speller spell_word levers — 2026-09-28

Handoff 22 L1, primitive 1 of 5. Executor `/add-support-tiers`. Contract: `docs/contracts/cvc-speller.md` (derived this slice, R12 added).

## Failure inventory

No real-learner evidence exists for this primitive. Evidence classes: miss-function (the `cvcMiss` patterns), catalog (`commonStruggles`), inferred.

| Miss (`cvcMiss`) | Class | Lever |
|---|---|---|
| `middle_letter` | miss-fn | `vowel_keywords` |
| `first_letter`, `last_letter` | miss-fn | `consonant_keywords` |
| `letters_out_of_order` | miss-fn | `sound_tokens` |
| `two_or_more_letters` | miss-fn | `sound_tokens`, then `small_word` |

The spoken modes (`fill_vowel`, `word_sort`) get no levers yet. Their misses are `proposed:*` ids that wait on `spoken_miss` (handoff 22 L2).

## Built

~260 production lines: `cvcSpellerLevers.ts` (new, the declarations, leak rules and builder), plus the lever state, render and pull wiring in `CvcSpeller.tsx` and `cvcSpellerWorkspace.ts`. ~230 test lines.

- **help `vowel_keywords`:** a strip of every vowel in the letter group, each with its keyword picture. At least two vowels are shown, all alike.
- **help `consonant_keywords`:** a keyword picture under every consonant in the bank, distractors included. A keyword that pictures a session word falls back to another one (`c` on a "cat" item shows a car).
- **help `sound_tokens`:** three blank tokens. The learner taps them left to right, one per sound said. They never feed the check.
- **simplify `small_word`:** an ungraded practice word from a 32-word picturable pool, filtered to the letter group. It never repeats a session word or rime, shares at most one box with the item, and has a 4-letter bank (its 3 letters plus 1 far consonant). Hear It says the practice word. The practice word stays out of the metrics. The full item comes back blank.
- **Starting position:** at easy, `vowel_keywords` starts on screen. This is not recorded as a pull.

## Measured

| Gate | Result |
|---|---|
| `cvcSpellerLevers.test.ts` (leak rules over the whole pool × 4 groups, builder, miss → lever table) | pass |
| `CvcSpeller.levers.workspace.test.tsx` (6 mounted: same-commit change, refusal, lever on the attempt, practice ungraded and retry-safe, metrics exclude practice, easy start) | pass |
| All literacy tests | 81 files, 1749 pass |
| Dry journey (`journeySweep -t cvc-speller`) | 2/2 |
| `typecheck:lumina` / full tsc | 0 / 773 (baseline 773) |
| Tutor replay, 5 samples (`qa/tutor-reports/replay/cvc-speller-2026-09-28.json`) | spell_word 0 misses on every check. At "stuck" the tutor pulled `consonant_keywords` itself in 5/5 samples, and described the pictures only after the call. |

No Live run was made. Per handoff 22, Live runs once per class after all five L1 primitives pass.

## Still open

- `fill_vowel` "stuck": the tutor stretched "c-aaa-t" in 1 of 10 samples, which states the answer. This is a spoken mode, queued for L2.
- The catalog `description` and `aiDirectives` are stale (retired DI loop). Queued in `SUPPORT_LEVERS_BRIEF.md`.
- No browser sitting yet. The class HUMAN-CHECKS row is filed at the end of L1.
