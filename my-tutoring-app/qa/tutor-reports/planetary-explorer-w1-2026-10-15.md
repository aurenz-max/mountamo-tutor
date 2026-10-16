# planetary-explorer W1 binding (ROLLOUT C23), 2026-10-15

**Shape P, all four modes bound** (explore, identify, compare, apply). Not committed.

## What is checked by code
Every item is one generated question: each stop's questions in journey order, then identify's quiz
(`planetItems`, `planetaryExplorerWorkspace.ts`). The tap is checked against the question's own `correctIndex`
(`planetCorrect`); the choice is also sayable (J14, user ruling 10-13), so items are `speech` with `acceptsGesture` and
JEV judges speech against `planetExpectedAnswer`. Misses (`planetMiss`, tap and spoken alike): `true_false_flipped`,
quiz `neighbour_planet` / `same_family_planet` / `other_family_planet`, `other_planet`, `other_planet_fact` (a value
printed on another visited planet's card), `other_number`, `other_choice`.

On the workspace path the overview and transition screens are gone. A stop's card opens before its first question with
`readyForResponse: false` until the learner presses Ready for Questions; then the card is hidden, as on the scripted
path. A wrong tap stays marked until Try again; no explanation or right answer is shown until credited. Next, the
read-aloud buttons and the scripted cues are off; the scripted path (tester, no tutor) is unchanged apart from the
fixes below.

## Fixed on the way (both paths)
- The quiz map printed every planet's name in order from the Sun at easy, medium and no tier, which answers the
  distance and size clues. Names are now withheld in the quiz at every tier (support-tiers test re-based).
- The generator printed a unitless stat as "Red none" (unit "none"): such units are dropped (`reconstructStats`).
- The star field was random on every render; it is fixed.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770), none in planetary files.
- `PlanetaryExplorer.workspace.test.tsx` 9/9, `planetaryExplorerLevers.test.ts` 18/18, reader-fit + support-tiers +
  Pip surface + generator reader-fit 103/103. `live-activity` + `misses.test.ts`: 3939 passed.
- Sweep, 4 payloads (36 items): 0 findings J1-J14; J10 clean 100, J11 recover 67 on every mode.

## Replay (gemini-3.8-flash, 4 payloads x 5 samples, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| r1 (`replay/planetary-explorer-2026-10-15.json`) | 3/20 | 2/20 | 5/20 | 4/20 | 0/20 |
| r2, nickname rule (`-r2.json`) | 1/20 | 2/20 | 4/20 | 4/20 | 0/20 |

Read by hand. r1: 3/5 explore stuck replies said "Mars is known as the Red Planet, so which colour...". Guidance now
says a nickname answers a question about the planet and that a why question's reasons are not named. r2: every flagged
reply is a read of the remaining choices ("blue, yellow, or red") or the card read aloud while it is on screen (start);
none names the key. One identify stuck reply said "our blue planet" for "oceans of liquid water" (a hint, not the key).

## Undriven modes
None.

## Open findings
- The identify quiz is never Gemini's: 3 of 3 module-runner generations had 0 valid quiz questions and got the code
  fallback ("Which planet has a distance from sun of 150 million km?"); one of them also rejected every planet. Through
  `save_payload.py` (:3000) identify and compare fell back to the Earth+Mars lesson 5 of 5 times in about 7 s, while
  the same `generateComponentContent` call in the vite module runner generated real content; the identify and compare
  payloads come from the module runner (their `source` says so). → `/eval-fix`.
- Compare mode at grade 4 mixes recall questions in with the comparisons (2 of 8). → `/eval-fix`.
- The replay records only each payload's first item, so no quiz question was replayed. → next replay of this family.
- Needs a browser check on the workspace path: the card-then-question step, the greyed choice, the lever cards.
