# Literacy levers, class L1 (phonics taps) — 2026-09-28

Handoff 22 L1. All five gesture-mode primitives now have help and simplify levers, and each passes its vitest gate plus tutor replay. Each primitive's inventory and lever table are in its own report. This file covers the class.

## Primitives

| Primitive · mode | Help | Simplify | Report |
|---|---|---|---|
| cvc-speller spell_word | `vowel_keywords`, `consonant_keywords`, `sound_tokens` | `small_word` | [cvc-speller](cvc-speller-levers-2026-09-28.md) |
| letter-sound-link hear_see | `keyword_under_both`, `voice_feel_model` | `far_letter_pair` | [letter-sound-link](letter-sound-link-levers-2026-09-28.md) |
| letter-spotter find_it | `other_case_reference`, `row_scan` | `small_far_grid` | [letter-spotter](letter-spotter-levers-2026-09-28.md) |
| letter-spotter match_it | `wrong_choice_partner` | `two_far_choices` | same |
| word-workout picture_match | `sound_dots` | `two_far_pictures` | [word-workout](word-workout-levers-2026-09-28.md) |
| interactive-book find-feature | `model_page` | `two_part_page` (inner pages) | this file |

Every lever is `shown` or `both`, so all of them count at K. Every simplify item is ungraded, built in code, and uses no word or letter the session answers.

Each primitive got a new contract doc. None of the five had one; handoff 22 B1 had said two did, but neither exists.

## Design changes from the draft (each approved by the user)

- **letter-sound-link.** `voice_feel_model` shows pictures, not letters: printed letters would teach a later item's letter-sound link. `far_letter_pair` asks a new sound, not the item's own sound with a far foil.
- **letter-spotter.** `formation_start` and `mirror_model` are replaced by `wrong_choice_partner`.
- **interactive-book.** `outline_parts` is dropped: it outlined the item page's own parts, which the handoff forbids.
- **word-workout.** During the slice the contract caught a scope violation: the practice word must stay in the lesson's vowels.

## interactive-book (primitive 5)

- **Misses:** the five `tapped_*` misses from `interactiveBookMiss` (miss-function evidence).
- **`model_page`:** a code-owned model beside the book, "Big Bear / by Sam Lee" or a model page. If the book already uses a model's text, the second model is drawn instead.
- **`two_part_page`:** a code-owned practice page with two tappable parts: the asked part, and the caption against the top row. Not offered on the cover, which already has only two parts.
- **Tests:** 5, including a book whose page 1 heading is the first model's heading, which checks the fallback.
- **Replay:** at "stuck" the tutor pulled `model_page` itself in 5/5 samples. 0 misses on every check.

## Gates, class totals

| Gate | Result |
|---|---|
| All literacy tests | 88 files, 1812 pass (was 81 / 1749 at the start) |
| Dry journey, all payloads | 340/340. Two new hand-authored payloads: `letter-sound-link.hear_see-voicing`, `letter-spotter.match_it`. |
| `typecheck:lumina` | 0. Mid-slice it briefly showed 1 error in `runtime/journeySweep.test.tsx`, from another session's uncommitted edit, since fixed. |
| Full tsc | 775 vs baseline 773. The 2 extra errors are in no file this handoff touched; the handoff 21 commits landed the same day. |
| Tutor replay (5 samples per moment) | At "stuck", after a wrong answer, the tutor pulled a lever itself in **25 of 25** samples across the five lever families, and never described a change before the call returned. |

## Live pair: not run, ruling owed

Handoff 22 asks for 2 paid Live runs per class. `LIVE_TESTING.md` (handoff 20 Part D, user ruling 09-27) says a lever-set gate needs no Live runs. What replay cannot see (the tutor voicing its own tool call, timing) is read off the weekly Live sample. The runs were not made; this needs a ruling.

## Findings queued (`SUPPORT_LEVERS_BRIEF.md`)

Spoken modes, not lever-caused (L2, `/add-live-tutor-tools`):
- **cvc-speller fill_vowel:** the tutor stretches the middle sound at "stuck" (1/10).
- **letter-spotter name_it:** the tutor says the onset sound (4/5).
- **letter-sound-link hear_see, no-lever session:** the tutor hints "the letter that looks like a snake" (3/5).

Checker:
- **`replay_checks` false positives:** "/sss/" read as the key `s`; "one line" read as cell index 1.

Dead or stale:
- **letter-sound-link:** `showKeywordAnchor` and `showSharedSoundHint` are generation flags that nothing renders.
- **cvc-speller:** the catalog description and `aiDirectives` are stale.
- **letter-spotter:** the same-case reference is still open as contract C1.
