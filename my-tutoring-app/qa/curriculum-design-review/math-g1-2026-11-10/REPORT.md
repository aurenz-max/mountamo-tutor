# Math G1 panel, 2026-11-10

Seeded sample of 5 skills, 1 subskill each (`sample.json`). Records and routes: `panel.json`.

**Score: 4 of 5 at level 2 or above. 1 played (`ten-first`). 0 served.** Model spend: $0 (no model was called).

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| PTRN001-02-b translate a pattern | rebuild a pattern with no key | add-mode | `pattern-builder` (keyless mode owed) | 1 routed |
| OPS001-08-b three addends, make a ten | choose the ten pair, add the third | canvas-new | `ten-first` | 3 played |
| OPS001-01-a add within 10 | place both addends, say the total | specialist | `ten-frame` `operate` | 2 checked |
| MEAS001-07-c count like coins | tag each coin, give the total | specialist | `coin-counter` `count-like` | 2 checked |
| NBT001-01-d count objects to 120 | ring tens, write the numeral | canvas-new | `ring-the-tens` | 2 checked |

## The two canvases

Each passed `canvas-check` with 4 problems played both ways, and the main session read the screenshots.

| Canvas | Problems (what changes) | Open points from the screenshots |
|---|---|---|
| `ten-first` | ten pair side by side; split by the other number; at the end beside a 9 with no dots; no counters | A correct total reached in the wrong order fails, so the ask has to name the strategy |
| `ring-the-tens` | rows of ten; rows of six; 104 crossing a hundred; rows with gaps (group counts withdrawn on the last two) | Making tens is required, so a child who counts correctly by ones does not pass. Rectangle rings were replaced by free strokes after the user's first play |

## Gaps in the specialists

- `ten-frame` `operate`: the credited evidence is the spoken sum; placing the counters is not scored.
- `coin-counter` `count-like`: with a tier, Grade 1 caps at 50 cents, so the curriculum's 3 quarters (75 cents) cannot be drawn.
- Both specialists were confirmed by reading code. No generation was run on these objectives.

## The user plays next

Dev panel "Canvas (agent)" saved list: `ten-first`, `ring-the-tens`. After a play that is approved, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/add-eval-modes pattern-builder`: a keyless translate mode scored on structure, and Grade 1 in its catalog constraints (PTRN001-02-b).
- `/eval-fix coin-counter`: the Grade 1 ceiling on `count-like` against the curriculum's 75-cent example (MEAS001-07-c).
