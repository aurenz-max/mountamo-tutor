# rhyme-studio levers — 2026-09-28

Handoff 22 L2, primitive 1 (the spoken-lever pilot). All four modes now have help and simplify levers. Every
answer stays spoken; help acts on code-owned model words outside the session; simplify opens an ungraded item
of the same mode on a family the session does not use.

## Steps

1. **Stale directives removed.** The catalog `aiDirectives` ordered `[RS_ITEM]` turns and "Yes," / "My turn:" openers for the retired runner. Bound sessions send `tutoring: null` (`lessonWorkspacePlan.ts:65`, `adapterContract.ts:158`), so no workspace tutor received them; only an unbound mount did, and it shows the needs-the-tutor card. The bracketed-message sentence in `taskDescription` went with them.
2. **Shared model pool** (`rhymeModels.ts`): 9 model sets with emoji and an onset foil (bee/tree + bus), 4 of them able to model a first-sound swap (sock, rock, lock). Excluded by word and by ending sound, spelling variants folded (whale excludes mail). It never falls back to a used family; `pickModelRhymePair` now delegates to it (the retired runner keeps a fixed pair for its cue lines). The K word menu moved here from the generator, plus 5 practice-only families, because the saved K recognition payload uses all 12 K families.
3. **Levers** (`rhymeStudioLevers.ts`), all `carrier: both`:

| Mode | Help | Simplify |
|---|---|---|
| recognition | `contrast_model` | `far_pair` (clean rhyme or clean non-rhyme, verdict chosen by the id) |
| identification | `contrast_model`, `name_choices` (only where the tier withdrew the read-aloud) | `far_foil_item` (new target, the rhyme and a far foil) |
| production, collection | `onset_swap_model`, `onset_strip` (6 single-sound picture cards, never the target's; collection greys used ones) | `dense_family_item` (open production on a dense free family) |

## Change from the draft

- **`hear_pair_again` dropped.** It changes nothing on screen, and tapping the word card already asks the tutor to repeat the question.

## Misses

Spoken misses are not emitted yet (handoff 20 Part B). The ids are declared per mode in the catalog, carried in each lever's `answers`, and listed as unanswered for J9. `nextLever` goes help-first until they land.

## Gates

| Gate | Result |
|---|---|
| `rhymeStudioLevers.test.ts` | 23 pass: model and practice leak rules on both saved payloads, carriers, miss ids match the catalog, ladder order |
| `RhymeStudio.levers.workspace.test.tsx` | 6 pass: a pull changes the DOM and the scene in one commit and leaves the item's cards untouched; practice is ungraded, judged from speech, survives a wrong answer, returns the full item; the credit carries `assisted` + `levers` |
| Literacy + live-activity suites | all pass except `TesterLeverBench.test.tsx` (number-line, handoff 21's uncommitted work, not touched here) |
| `typecheck:lumina` | 0 |
| Tutor replay, 5 samples (`qa/tutor-reports/replay/rhyme-studio-2026-09-28.json`) | The tutor pulled `contrast_model` itself in 20/20 samples at "miss" and "stuck" and spoke only the model words. Recognition: 0 flags. Identification: 19 `no_key_before_try` flags, every one the tutor reading the two choices at K, which `namingChoices` allows (checker false positive, queued). |

Production and collection are vitest-only: there is no saved payload and no code-owned answer to drive.
