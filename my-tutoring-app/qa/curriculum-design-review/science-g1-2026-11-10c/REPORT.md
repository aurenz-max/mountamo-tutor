# Science G1 panel C, 2026-11-10

Third seeded sample of the day: 5 skills, 1 subskill each (`sample.json`, seed 11327097825725923499). Records and routes: `panel.json`. Two subskills (SCI002-07-b, SCI003-03-d) were also drawn by the first panel.

**Score: 4 of 5 at level 2 or above. 0 played. 0 served.** Model spend: none.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI001-03-b materials carry sound | drag a bridge into the gap | canvas-new | `sound-bridge` | 2 checked |
| SCI005-01-d wheel size and effort | drag a wheel onto the axle | canvas-new | `well-crank` | 2 checked |
| SCI005-04-d backhoe parts and jobs | drag job cards onto parts | canvas-new | `backhoe-jobs` | 2 checked |
| SCI002-07-b inherited plant traits | tap parent, seedling or both | specialist | `bio-compare-contrast` venn-interactive (first panel) | 2 checked (code read) |
| SCI003-03-d predict the Moon | set the Moon for nights later | add-mode | `moon-phases-lab` (first panel; still no mode) | 1 routed |

## The three new canvases

Each passed `canvas-check` with every problem played both ways, and the main session read the screenshots.

| Canvas | Author | Problems (what changes) | Open points |
|---|---|---|---|
| `sound-bridge` | main session | bunny wants to hear, short gap; sleeping cat must not hear; long gap (wood no longer reaches); thick sponge against thin wire; two lanes, one of each | Nothing in the world lets the child find out which material carries sound: it is a prediction from what the child already knows, and only Check answers. An empty gap (air) cannot be chosen as an answer; the cat's lane requires a bridge so that the empty gap does not pass. The cat emoji looks awake. The bunny's ear is not on the post. |
| `well-crank` | subagent, Opus 5.5 medium, 6.9 min | mouse, three wheels, a test turn; bear and mouse share a knob and a big wheel; rocks, no test turn, thick metal wheel as decoy; two mice, half bucket and rocks, wheels shared | In problem 1 the child can tap through the wheels until the bucket rises, and only the ask says a tap is possible. "Pick the biggest wheel" passes problems 1 and 3. Problem 3 changes three things at once. That rocks weigh more than water is shown only by the drawing. The big wheel overlaps the well post. |
| `backhoe-jobs` | subagent, Opus 5.5 medium, 4.5 min | carry and dig (two buckets); adds hold still and drive; adds reach; result pictures with no words | Problem 4 changes two things (result pictures, and the words are gone) and tests only legs against wheels. The cab is never asked for. The hold-still card shows a box on legs, which resembles the machine's legs. A placed card covers most of its part. Drop zones are rectangles, so empty space above the legs counts as the boom. |

## Not confirmed

- `bio-compare-contrast`: still no generation (queued by the first panel).
- `wheel-axle-explorer`: the catalog says `supportsEvaluation: true` and the component submits no evaluation; its challenge is "turn N times" beside a ratio readout.

## The user plays next

Dev panel "Canvas (agent)" saved list: `sound-bridge`, `well-crank`, `backhoe-jobs`. After an approved play, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/add-eval-modes moon-phases-lab`: predict-next-phase (SCI003-03-d). Drawn by two of today's three Science G1 panels and still level 1.
- `/eval-fix wheel-axle-explorer`: catalog claims evaluation, component has none.
