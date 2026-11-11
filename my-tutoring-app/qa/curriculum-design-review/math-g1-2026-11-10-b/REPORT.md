# Math G1 panel B, 2026-11-10

A second seeded sample of 5 skills, 1 subskill each (`sample.json`; a new seed, so a new panel). Records and routes: `panel.json`.

**Score: 5 of 5 at level 2 or above. 3 played. 0 served.** Model spend: $0 (no model was called).

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| PTRN001-05-c adding zero | test numbers, find the hidden rule | canvas-new | `zero-machine` | 3 played |
| OPS001-08-b three addends, make a ten | choose the ten pair, add the third | canvas-existing | `ten-first` | 3 played |
| NBT001-02-a build tens and ones | place rods and cubes for a number | specialist | `base-ten-blocks` `build_number` | 2 checked |
| MEAS001-02-c same-sized units | repair an unfair row of units | canvas-new | `fair-measure` | 3 played |
| OPS001-09-b associative property | push two piles together first, twice | canvas-new | `two-ways` | 2 checked |

## The three new canvases

Each passed `canvas-check` with 4 problems played both ways, and the main session read the screenshots. The user played and approved `zero-machine` and `fair-measure`. The first `two-ways` (bond circles, + buttons, one keypad for four circles) was unintuitive and was rebuilt: the child taps two piles into a first box, counts it, adds the last pile, and the two ways are written as equations side by side.

| Canvas | Problems (what changes) | Open points from the screenshots |
|---|---|---|
| `zero-machine` | adds 1; adds 0; adds 0 with two-digit numbers; predict a number not on a card | Six add amounts means a child could guess after the three required tests |
| `fair-measure` | gap; overlap; mixed units that reach the end; empty ribbon with both units | Slides snap within 16 px, checked with a mouse only; the overlap problem takes five drags |
| `two-ways` | Way 1 given; both chosen; a ten pair that is not side by side; Way 2 total predicted first, numbers only | Way 2's total can be copied from Way 1, which is the idea but also an easy route |

## Gap in the specialist

- `base-ten-blocks` `build_number`: an ad-hoc Grade 1 lesson is capped at 1-20; the curriculum's 24-99 depends on the lesson supplying a range. Not confirmed by a generation.

## The user plays next

Dev panel "Canvas (agent)" saved list: `two-ways` (rebuilt). After a play that is approved, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/eval-test base-ten-blocks`: one generation on NBT001-02-a to confirm a 24-99 range arrives (metered).
