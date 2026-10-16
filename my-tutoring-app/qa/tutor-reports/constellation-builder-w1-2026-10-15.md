# constellation-builder W1 binding (ROLLOUT C23), 2026-10-15

**Shape P, four modes, all bound.** Levers in `../eval-reports/constellation-builder-levers-2026-10-15.md`. Not committed.

## What is checked by code
- `guided_trace`: taps in `starOrder`; the pulsing ring marks the next star (the mode's design). A tap on another star
  commits a miss: `later_star`, `traced_star`, `other_star`. Try again keeps the lines already drawn (every drawn line
  is a right one).
- `free_connect`: tap a star, then the star it joins to; a pair the pattern does not join (`wrong_pair`) or a dim star
  (`background_star`, medium/hard tiers only, where dim stars are tappable) commits a miss. The finished pattern is the
  right answer.
- `identify`, `seasonal`: one name, tapped (seasonal: tapped and Check Answer) or said aloud. Speech items with
  `acceptsGesture` (J14) and `expectedAnswer` = the name; misses `wrong_name`; `other_name`, `several_names`; spoken
  known misses list the other names on screen.

The tutor gets the task, the progress (lines drawn of total), the tier's star styling and, on name modes, the choices.
Never a star id, which star is next, or which stars join. The scripted path (no tutor) keeps its cues, Next and scoring.

## Pedagogy leaks fixed (both paths)
- The generator's identify and seasonal instructions described the answer: 4/4 saved identify items ("What legendary
  hunter", "a powerful beast ruling over the spring sky") and 3/5 seasonal ("its bright belt", "five-star pattern",
  "flying down the Milky Way"), past the existing shape-word filter. `shownInstruction` now asks the plain question for
  both modes, in the component, the assignment and the generator output.
- Title and description are masked while an identify or seasonal item whose name they contain is open (`maskAnswer`).
- Seasonal choices no longer include another seasonal item's name from the same season (both would be right; the
  saved payload has Big Dipper and Leo both "spring").
- Choice order is `stableShuffle` (was `Math.random` per render).

## Gates
- typecheck:lumina 0. Full tsc 770 (baseline 770).
- `ConstellationBuilder.workspace.test.tsx` 10/10, `constellationLevers.test.ts` 20/20, existing reader-fit, support-tier
  and generator tests 65/65, ScienceWorkspaces surface, `workspaceContract`, `activityContract`, `misses.test.ts` pass.
  `lessonWorkspacePlan` gains the id (its remaining diff is `planetary-explorer`, the sibling binding).
- Sweep on the 4 payloads (guided K, free 2, identify 3, seasonal 4): 0 findings J1-J14, misses named 16/16, J10 100,
  J11 67 on each. Advisory on identify/seasonal: the key is in the scene facts as one of the listed choices (the
  buttons on screen); kept so the tutor can read the choices aloud.

## Replay (5 samples per moment, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| first guidance (`replay/constellation-builder-2026-10-15.json`) | 0/20 | 0/20 | 2/20 | 0/20 | 0/10 |
| guidance without "only a pulled lever changes the picture", plus "after a wrong name, do not say its season or shape" (`-r2`) | 0/20 | 0/20 | 0/20 | 0/20 | 0/10 |

Read by hand: run 1's two misses said "I pulled a lever" on identify; one seasonal miss reply said "Pegasus is best
seen in autumn", a claim not on screen that rules out choices. Both gone in r2. No reply names a key or a star; credit
replies read the star story, as guidance allows.

## Undriven modes
None. Spoken identify/seasonal answers are driven only in the workspace test (`say` + tutor verdict); the sweep drives
the taps, so the spoken-miss probe had no requests to run.

## Open findings
- Browser check on the workspace path (star taps in the field, spotlight ring, shape card, practice field): JSDOM only.
- The generator draws one star field for every challenge, though challenges name different constellations (guided K
  payload: 3 patterns over 11 member stars, so stars are shared and positions cannot all be real). Executor `/eval-fix`.
- No `docs/contracts/constellation-builder.md`. Executor `/primitive-contract`.
