# Science K panel, 2026-11-10

Seeded sample: 5 skills, 1 subskill each (`sample.json`, seed 1912467838073090750). Records and routes: `panel.json`.

**Score: 4 of 5 at level 2 or above. 0 played. 0 served.** Model spend: none.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI001-01-F move things without touching | place magnet, fan or squirter | canvas-new | `no-touch` | 2 checked |
| SCI003-02-A sort rocks and soil | look closer, drag into trays | canvas-new | `rock-table` | 2 checked |
| SCI004-02-D use classroom tools | drop the tool on the paper | canvas-new | `tool-table` | 2 checked |
| SCI004-01-D models for design ideas | stack blocks to do a job | specialist | `open-builder` build_to_goal | 2 checked (code read) |
| SCI002-03-E heart, lungs, stomach | build air/food path, then heart | add-mode | `body-workshop` (no heart at K) | 1 routed |

## The three new canvases

Each passed `canvas-check` with every problem played both ways, and the main session read the screenshots.

| Canvas | Author | Problems (what changes) | Open points |
|---|---|---|---|
| `no-touch` | main session | steel car with a Try it button; feather (fan, not magnet); steel ball with the star on the other side (magnet goes in front); plastic boat on water (squirter); two lanes, key and leaf, one magnet and one fan to share | Only problem 1 lets the child see the result before Check; the rest are predictions. The magnet's slot sits just past the star, so "put it by the star" passes the magnet problems (it fails the fan and squirter ones). Problem 5 changes the lane count and the things together. |
| `rock-table` | subagent, Opus 5.5 medium, 8.5 min | color; size with colors mixed; texture where size and color disagree (a magnifier appears); sand and clay at crossing shades, told apart only through the lens; no rule picture, one example per tray | A sample under the lens cannot be dragged until the lens moves off. Problem 1's miss is a tray swap, not a misconception (nothing competes with color there). The ask for problem 4 names the magnifier. "By feel" became "by close look": the screen shows grains against smooth, not sticky. |
| `tool-table` | subagent, Opus 5.5 medium, 11.8 min | cut a card; cut a star out and stick it on a card (crayon beside the glue); name tag with a punched hole and a string; crown from the finished picture only | Cutting is dropping the scissors on the line, not drawing along it. The ruler is only ever a decoy. In problem 4 nothing shows that the strip's ends can be grabbed, and the miss (a snip where tape should be) looks almost finished. The program is at 23,955 of the 24,000-character limit. |

## Not confirmed

- `open-builder`: no generation was run on a Science K design objective; the judge is a picture judge, not a code key. The "drawings" half of SCI004-01-D (blueprint-canvas) is an unjudged drawing surface.
- `classification-sorter` shows text labels only (`imagePrompt` is not rendered): any observable-property sort on it is a reading task. This is the class reason `rock-table` exists.

## The user plays next

Dev panel "Canvas (agent)" saved list: `no-touch`, `rock-table` (does a K child find the lens in problem 4?), `tool-table` (does a child find the crown's grab-an-end in problem 4?). After an approved play, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/add-eval-modes body-workshop`: a K `to_muscle` goal (a person only, short bench) when the objective names the heart (SCI002-03-E). Today `goalFor()` gives that goal to grades 4-5 only. Run `/primitive-contract body-workshop` first.
- `/eval-test open-builder` on SCI004-01-D, one generation.
