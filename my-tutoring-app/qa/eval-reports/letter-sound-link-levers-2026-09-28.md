# letter-sound-link hear_see levers — 2026-09-28

Handoff 22 L1, primitive 2 of 5. Executor `/add-support-tiers`. Contract: `docs/contracts/letter-sound-link.md` (derived this slice, R12 added).

## Failure inventory

No real-learner evidence exists for this primitive. All three misses come from `letterSoundMiss` (miss-function evidence).

| Miss | Lever |
|---|---|
| `other_short_vowel`, `other_letter` | `keyword_under_both`, then `far_letter_pair` |
| `voicing_partner` | `voice_feel_model`, then `far_letter_pair` |

The spoken modes (`see_hear`, `keyword_match`) are left for L2.

## Built

~190 production lines: `letterSoundLinkLevers.ts` (new), plus the lever state, render and pull wiring in `LetterSoundLinkTeaching.tsx`. ~190 test lines.

The user approved two changes from the draft:
- **`voice_feel_model`** uses pictures of another pair (snake "sss" / bee "zzz", or wind / race car for an s/z item), not letters. Printed letters would teach a later item's letter-sound link.
- **`far_letter_pair`** is a new sound whose letters the session never uses, against a foil of the other kind. The draft's same sound with a far foil would hand over the answer when the full item returns.

`keyword_under_both` is declared only when:
- both pictures read as their word (never `i`, whose picture is "itch"), and
- neither letter nor keyword comes up later in the session (R4).

It relaxes the rule "the anchor picture only after credit" (R3), with the user's approval. It is symmetric, and the scene never says which picture is under which card.

Neither help lever fits every session. In a group-1 session all six letters are in use, so no practice pair can be built. For the same reason `keyword_under_both` is declared only on the last item of the saved payload.

## Measured

| Gate | Result |
|---|---|
| `letterSoundLinkLevers.test.ts` + `LetterSoundLink.levers.workspace.test.tsx` | 22 pass |
| All literacy tests | 83 files, 1771 pass. One existing assertion updated: hear_see operations now include `pull_lever` (demonstrate is still refused). |
| Dry journey, all payloads | 338/338. New payload `letter-sound-link.hear_see-voicing.json` (hand-authored, group 3), because J9 found no lever answering `voicing_partner` on the saved group-1 payload. This file is under `runtime/testing/w1-payloads/`. It is additive data, not shared code. |
| `typecheck:lumina` | 0 |
| Tutor replay, 5 samples (`qa/tutor-reports/replay/letter-sound-link-2026-09-28.json`) | Voicing payload: the tutor pulled `voice_feel_model` itself in 10/10 samples at "miss" and at "stuck", and described the pictures after the call. `lever` moment: 0 misses. |

## Found, queued in `SUPPORT_LEVERS_BRIEF.md`

- **Answer hint where no lever exists.** At "stuck" on the group-1 payload the tutor says "find the letter that looks like a snake" in 3 of 5 samples. That points at S. The executor is `/add-live-tutor-tools`: its guidance should say that a letter's shape is the answer.
- **Checker false positive.** `replay_checks` flags "/sss/" (the question sound) as the key `s`, 2 of 15 samples.
- **Dead generator flags.** `showKeywordAnchor` and `showSharedSoundHint` are stamped by the generator and read by nothing.
