# poetry-lab W1 (plain shape), 2026-10-09, batch C22

## Modes bound
| Mode | Items | Checked by code | Misses |
|---|---|---|---|
| rhyme_hunt (K-1) | one per round (3-4) | the two tapped cards are the pair (`isRhymePair`); the second tap is the check | `same_start`, `one_of_pair`, `neither_of_pair` |
| analysis (G2-6) | `mood`, `figurative`, `rhyme` (those the poem supports) | mood = key; every figurative phrase has a tapped word and no tapped word is outside one; scheme = key | `other_mood`, `literal_picked`, `missed_some`, `aabb_abab`, `other_scheme` |
| composition (G3-6) | `compose` | FORM only: every line written with 2+ words, no repeat, acrostic initials, syllables within 1 of target | `line_missing`, `line_too_short`, `line_repeated`, `wrong_first_letter`, `syllables_off` |

Files: `poetryLabWorkspace.ts` (new), `PoetryLab.tsx` (rewritten: `RhymeHunt` swaps controller; `PoetryWorkspaceBoard` is the
workspace path for analysis/composition; `LegacyPoetryLab` unchanged for the scripted path), `adapters/poetryLabLive.ts`,
`activityContract.ts`, catalog `teachingWorkspace` (guidance within the cap per `activityContract.test.ts`, + misses), `liveJourneySpec.ts` row,
`lessonWorkspacePlan.test.ts`, `PoetryLab.workspace.test.tsx`, `docs/contracts/poetry-lab.md`, 3 payloads.

Fixed on both paths (pedagogy): rhyme cards drew in line order with the pair always on lines 2 and 4 (the right-hand
column of the 2x2 grid every round); now a seeded shuffle. Mood and scheme options shuffled (generator often lists the
key first). Workspace figurative item: every word is a button (scripted path still makes only the phrases tappable, G1).

## Gates
- `typecheck:lumina` 0.
- `PoetryLab.workspace.test.tsx` 7/7; `PoetryLab.support-tiers.test.tsx`, `LiteracyWorkspaces.surface.test.tsx`, oracles: 254/254.
- `workspaceContract`, `journeySweep` (3 payloads, J1-J8, 0 findings after a harness fix: the wrong poem shared a line
  with the right one, J3), `misses.test.ts`, `lessonWorkspacePlan`, `activityContract`: pass.
- Tutor replay 3 payloads x 4 moments x 5 samples: 0 misses (`replay/poetry-lab-2026-10-09.json`). Read by hand: on
  mood `stuck` 1/5 said "pick the one that feels calm" (narrows to the key). Guidance now says never say the mood or a
  word that means it, never narrow the moods; re-run (`-r2`) 0 misses, stuck replies ask which words give a clue.

## Undriven
None. Every mode drives through real controls (choose, touch `poem-word-N`, write `Line N`).

## Open findings
- G2 composition free-verse / sonnet-intro draws have no form beyond line count: credit = every line written. Needs a
  judged evidence contract (the shared writing judge) or a ruling. Executor `/add-eval-modes`.
- G3 generator ships near rhymes as the pair (saved payload round 2: grass/fast). `/oracle-test`.
- G1 scripted analysis still marks the figurative phrases as the only tappable text. `/eval-fix`.
- Saved analysis payload: the figurative phrase is a whole line. Generator content, `/eval-test`.
- Needs a browser check on all three workspace renders.
