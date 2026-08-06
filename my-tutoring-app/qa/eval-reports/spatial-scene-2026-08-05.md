# Eval Report: spatial-scene — 2026-08-05

Run closes the **R12 / C3 exclusivity** slice (`qa/la-k2-grammar/spatial-scene-c3-exclusivity-2026-08-05.md`).
All four modes, kindergarten, `grade=K`, topic "Where things are". Judged by code
(recomputing every option's grid truth from the shipped scene), not by eye.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify | **PASS** | 1 (HIGH, pre-existing) |
| place | **PASS** | — |
| describe | **PASS** | — |
| follow_directions | **PASS** | — |

11 challenges. Every structural gate held: 4 scene objects on every non-`follow_directions`
challenge (R5), no off-grid or duplicated cells (R10), target and reference both resolvable
(R6), no empty grids (R4), 2 steps per `follow_directions` challenge.

**R12 verified on all 6 `identify`/`describe` challenges** — exactly one option true of the
arrangement, and it is `correctPosition` every time. Answer slots landed at 2, 3, 1, 3, 2, 3
(pre-fix: always 0). Zero out-of-K-band words with no lesson request, so **R1 held**.

**R11 upgraded INFERRED → OBSERVED.** The contract asked for this on first contact: all 3
`place` challenges targeted a cell no scene object occupies (`(1,1)`, `(1,2)`, `(1,2)`).

Two `identify`/`describe` challenges came back with **3** options rather than 4. Expected and
legal (R7: ≥2, answer present) — the K window is only four words, so when the true word has a
synonym in-window, R12 removes it and there is nothing false left to backfill.

## Issues

### identify — hint hands the student the answer word

- **Severity:** HIGH
- **What's broken:** `hint` poses the key as a leading yes/no question, so the child who
  reaches the hint no longer has to read the grid. c1: key `above`, hint *"Look at the tree.
  Is the flower right above it?"* — the answer word verbatim. c3: key `beside`, hint *"Is the
  dog right next to it?"* — points straight at the key (and names the synonym R12 just
  removed from the options, so the hint and the option list now disagree in wording). c2 is
  the correct shape for contrast: *"Is the cat lower down in the same column?"* — it directs
  attention without naming a position word.
- **Data:** `challenges[0].hint = "Look at the tree. Is the flower right above it?"`,
  `correctPosition = "above"`; 2 of 3 identify hints leak, 0 of 3 describe hints leak.
- **Pre-existing:** yes — the hint path is untouched by the R12 slice, and the shared prompt
  already asks for *"hints that guide without giving the answer"* (`buildSharedContext`).
  The instruction prose is clean in all 6 challenges; only `hint` leaks.
- **Fix in:** GENERATOR — the `identify`/`describe` prompt needs the hint rule stated as a
  hard constraint (never name a position word; direct attention to the row/column comparison
  instead, the way the support-tier `hard` line already does), with a post-process check that
  a hint containing the key word is rewritten or dropped. Note the tier lines already carry
  the right language at `hard` — the leak is at the default/medium tier.
- **Queued:** `qa/la-k2-grammar/BACKLOG.md` item 2b, executor `/eval-fix`.

## Visual check

Open MathPrimitivesTester, select **spatial-scene**, run **identify** and **describe**, and
confirm the option buttons behave with the answer at a non-zero index — tracked as
`qa/HUMAN-CHECKS.md` #66.
