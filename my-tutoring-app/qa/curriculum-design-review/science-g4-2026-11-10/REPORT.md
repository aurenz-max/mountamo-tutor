# Science G4 panel, 2026-11-10

Seeded sample of 5 skills, 1 subskill each (`sample.json`). Records and routes: `panel.json`.

**Score: 3 of 5 at level 2 or above. 1 played. 1 served (`contour-map`).** Model spend: two flash-lite selection calls for the serve check, under $0.01.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI002-04-b signals as code | decode and send two-signal messages | canvas-new | `signal-code` | 2 checked |
| SCI004-05-a contour lines | place a marker by reading lines | canvas-new | `contour-map` | 4 served (user played 11-10, promoted) |
| SCI004-02-c deposition | slow the stream, run, see settling | canvas-new | `sediment-settling` | 2 checked |
| SCI003-01-b plant parts by function | sort parts into function groups | specialist | `classification-sorter`, `life-lab` | 1 routed (catalog text only) |
| SCI002-05-a comparing amplitude | compare two waves on one grid | add-mode | `wave-tank` (no such mode yet) | 1 routed |

## The three canvases

Each passed `canvas-check` with 4 problems played both ways, and the main session read the screenshots.

| Canvas | Author | Check runs | Problems (what changes) | Open points from the screenshots |
|---|---|---|---|---|
| `contour-map` | main session | 2, both pass | top of one hill; steepest side; flat shelf above 40 m with index labels only; two hills where the lower one is steeper | Problem 4's steep side was too subtle at first (fixed in `polish`) |
| `signal-code` | subagent, Opus 5.5 medium, 3.8 min | 4, all pass | decode; decode with mirror pairs; encode; decode a binary code | Decode is tapping letters on a 9-letter key, the weakest "hands in the world" of the three. Problem 4 repeated problem 3's word; the record caused that and it is fixed |
| `sediment-settling` | subagent, Opus 5.5 medium, 7.2 min | 2, both pass | one grain size; two at labelled flags; three at unlabelled flags; layers from flow over three days | A child can re-run until the pile lands on the flag; nothing stops trial and error |

## What the pilot showed about the pipeline

- The objective record was enough of a brief: both subagents built from it without a question, and every miss is one of the record's misconceptions.
- The gate did not block anything. Every fix in all three canvases came from reading screenshots, so the screenshot read is where quality is decided, and it is still done by hand.
- A flaw in a record becomes a flaw in the canvas (the repeated word). Review the record before the build.
- Two of five subskills did not need a canvas. Both are level 1 until someone reads the generator or runs a generation.

## The user plays next

Dev panel "Canvas (agent)" saved list: `contour-map`, `signal-code`, `sediment-settling`. After a play that is approved, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/add-eval-modes wave-tank`: a two-wave amplitude comparison mode (SCI002-05-a).
- Confirm SCI003-01-b on `classification-sorter` with one generation (`/eval-test`, metered).
