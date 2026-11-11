# Science G1 panel D, 2026-11-10

Fourth seeded sample of the day: 5 skills, 1 subskill each (`sample.json`, seed 17528517039967668276). Records and routes: `panel.json`. No subskill repeats an earlier panel.

**Score: 3 of 5 at level 2 or above. 0 played. 0 served.** Model spend: none.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI002-06-b animal parent-baby traits | drag trait cards into regions | specialist | `bio-compare-contrast` venn-interactive | 2 checked (component read in panel A, generator read) |
| SCI005-02-d estimate truck loads | commit trip count, then haul | add-mode | `dump-truck-loader` (plan_trips is density arithmetic, grade 3-5) | 1 routed |
| SCI002-09-a animal survival needs | place pieces until needs met | specialist | `habitat-diorama` build_habitat | 2 checked (code read) |
| SCI003-01-d Sun position by time | drag the Sun for a time | add-mode | `light-shadow-lab` (scores shadows only) | 1 routed |
| SCI001-03-a sound through air, water, solids | drag an ear to a spot | canvas-new | `listen-spot` | 2 checked |

## The new canvas

`listen-spot` (main session) passed `canvas-check` 4/4, every problem played both ways, and the screenshots were read.

| Problem | Params | What changes | Proof | Miss |
|---|---|---|---|---|
| 1 | soft tap, metal rail | a solid carries | ear on the rail | ear in the air |
| 2 | soft clicks, under the pond | water carries | ear under the water | ear in the air above |
| 3 | soft tap, wooden rail and hay bales | hard against soft solid | ear on the wood | ear on the hay |
| 4 | loud call in the air, pond | air carries | ear in the air | ear under the water |

Polish after the first screenshots: hay sat floating above the rail (now on the ground, with the wooden rail as a fence on legs), the friend under water was only a mask, the calling friend stood over the water (the pond now starts after them), the ear covered the "your side" label, and the pond's ripple line ran past its edge.

Open points:

- Nothing in the world lets the child find out where the sound arrives; it is a prediction and only Check answers (as in `sound-bridge`).
- Problem 4 changes two things (the material and a loud call instead of a soft tap). A soft sound in the air from that far is not heard in this model, so the air problem needs the loud call.
- In problems 1 and 3 the air never carries a soft tap, wherever the ear goes on the child's side. Problem 4 is there so the canvas does not teach that sound cannot travel through air.
- Distance does not change the answer: every spot on a carrying rail or in the water passes. The curriculum's wall example (a knock through a wooden wall) is not drawn.

## Not confirmed

- `bio-compare-contrast`: still no generation on any parent-offspring objective (plant or animal).
- `habitat-diorama` build_habitat asks food, water and shelter at K-2; this objective also names air, which is never a piece.

## The user plays next

`listen-spot` in the dev panel "Canvas (agent)" saved list. If it holds up, `node scripts/canvas-check.mjs --spec=listen-spot --promote` after adding `serves`.

## Queued

- `/add-eval-modes dump-truck-loader`: estimate_loads (G1, fixed load size, commit a count before hauling).
- `/add-eval-modes light-shadow-lab`: place_sun (drag the Sun for a named time; hide the clock and time marks in that mode).
- `/eval-test habitat-diorama` build_habitat at grade 1; `/eval-test bio-compare-contrast` venn-interactive on an animal parent-baby objective.
