# poetry-lab levers, 2026-10-09 (batch C22, phase 2)

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for poetry-lab). Classes:
documented = catalog `commonStruggles` ("taps words that share a beginning sound", "waits without choosing");
synthetic = the sweep's wrong programs; inferred = from the task.

| Mode / item | Miss (`poetryMiss`) | Class |
|---|---|---|
| rhyme_hunt | `same_start` | documented |
| rhyme_hunt | `one_of_pair`, `neither_of_pair` | synthetic |
| analysis mood | `other_mood` | synthetic |
| analysis figurative | `literal_picked`, `missed_some` | synthetic, inferred |
| analysis rhyme | `aabb_abab`, `other_scheme` | inferred, synthetic |
| composition | `line_missing`, `line_too_short`, `line_repeated`, `wrong_first_letter`, `syllables_off` | synthetic, inferred |

## Lever table
| Item | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| rhyme_hunt | `rhyme_model` pictured model pair + onset foil (both: shown, voiced) | help | all 3 | family unused by any round, word or rime (`pickModelRhymeSet`) |
| rhyme_hunt | `fewer_cards` 3-line "I see a ..." round, 3 pictured cards | simplify | all 3 | free families only; pair rhymes, foil does not |
| mood | `mood_faces` face on every choice | help | other_mood | offered only if every mood has a face (`moodFacesLeak`) |
| mood | `easier_mood` 2-line pool poem, 2 moods | simplify | other_mood | no line of the session poem (`practiceLeaks`) |
| figurative | `figure_models` one example per kind | help | both | no 4+ letter word shared with the poem |
| figurative | `phrase_count` "N to find" (only when the tier hides it) | help | missed_some | how many, never where |
| figurative | `easier_figures` 2-line pool poem, 1 figure | simplify | both | `practiceLeaks` |
| rhyme | `end_words` last word of every line, unmarked | help | both | no letter, no color |
| rhyme | `easier_scheme` 4-line pool poem, 2 schemes | simplify | both | `practiceLeaks` |
| composition | `model_poem` same form, other subject | help | all 5 | no 4+ letter word shared with the prompt; a copied model line fails as `line_repeated` |
| composition | `syllable_beats` dots per syllable under the learner's words (counted forms) | help | syllables_off | learner's own words only |
| composition | `first_letters` each typed line's first letter (acrostic) | help | wrong_first_letter | learner's own lines only |
| composition | `one_line` one line of the form, pool subject | simplify | all 5 | different subject and prompt |

Every miss on every item has a lever; `unanswered` is empty. Starting positions: none added. analysis/composition
keep their existing tier display gates (L1-L3) as starting positions; rhyme_hunt never reads the tier (band contract).

## Built
`poetryLabLevers.ts` (new), lever state + practice in `PoetryLab.tsx` (`RhymeHunt` and `PoetryWorkspaceBoard`,
workspace path only), catalog `levers: true`, journey row rebuilds `<id>~simpler` with the same builder,
contract R6. Tests: `poetryLabLevers.test.ts` (46), `PoetryLab.levers.workspace.test.tsx` (5).

## Gates
- `typecheck:lumina` 0.
- Lever + workspace tests 58/58.
- journeySweep (J1-J13 on 3 payloads), workspaceContract, misses, activityContract, lessonWorkspacePlan,
  sourceControlBytes, support-tiers, Pip surface: 8 files, 3616 passed, 0 failed.
- Tutor replay with lever moments, 3 x 5 x 5 (`replay/poetry-lab-2026-10-09-r3.json`): 0 misses, incl.
  `no_change_before_receipt` 0/15. Read by hand: lever and stuck replies describe the pulled change after it, name no
  key; rhyme model replies stretch bee/tree, not the round's words.

## Failures with no lever
None. Open: composition free-verse has no form beyond line count (W1 report G2); generator near-rhyme pairs (G3).
