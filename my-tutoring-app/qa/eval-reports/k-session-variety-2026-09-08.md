# K session variety — NS-4, HC-4, CB-4 (atlas slice 4, `k-session-variety`)

2026-09-08 · `/add-number-pool-service` + `/eval-fix` · three generators, all live-probed.

One cause under three findings: a field the model was free to choose, chosen the same
way every run. Constrained decoding converges on a value, on a slot index, and on a
window; code now owns all three, and a repeat is rejected rather than shipped.

## What changed

| Generator | The free choice | Now owned by code |
|---|---|---|
| `comparison-builder` / compare_groups | the two group counts | pool of LEFT/RIGHT pairs rolled per call (`createNumberPool` anchors + the tier's gap + rolled orientation), one guaranteed equal case inside the served window, injected into the prompt; a repeated comparison is reassigned to an unused pair |
| `number-sequencer` / fill_missing, decade_fill | which slot is blank | `chooseBlankIndices` — least-used slot in the session, non-adjacent for multi-blank, decade-fill kept on the …9/…0 seam; the tier keeps the blank COUNT and loses its `pos = 1` stride; a duplicate number window is rejected and replaced |
| `hundreds-chart` / highlight_sequence | which intervals, and how many slots | the scope resolver returns the intervals the lesson NAMES alongside the ceiling (same call, no extra latency) and the pool narrows to them; the session is capped at the distinct (type, skipValue) problems that exist; a repeat is replaced from the unused pairs |

Two defects surfaced while probing and are fixed in the same pass:

- `comparison-builder` took its grade band from Gemini, so a `grade=K` run shipped band
  `1` and the pool rolled **19v15** for a Kindergarten comparison. The band now reads
  `config.gradeBand → ctx.grade → grade prose` and never the model.
- `hundreds-chart`'s deterministic fallback hint said *"Start at 5 and keep adding 5"* —
  which is the answer to `find_skip_value`. Both deterministic paths now use a
  leak-safe hint.

## Live evidence (`/api/lumina/eval-test`, dev server on :3000)

| Probe | Before (atlas) | After |
|---|---|---|
| `number-sequencer[fill_missing]` @ K, ×2 draws | blank in slot 2 on 10/10; `1,_,3,4` served 2-3× per session | 5/5 distinct windows **and** 5/5 distinct slots in each draw |
| `hundreds-chart[highlight_sequence]` @ "2s and 5s", ×2 | by-5s-from-5 five times; 1-2 by-10s items outside the objective | pool `[2,5]`, 2 challenges, no repeat, no by-10s |
| `comparison-builder[compare_groups]` @ K, ×5 | 5v1, 1v4, 3v3, 1v5 across 2 objectives × 2 draws | 5/5 distinct pairs per draw, mixed orientation, one equal case each, counts 1-10 |
| `comparison-builder[compare_groups]` @ G1 `hard` | — | every gap exactly 1, no equal case, counts inside 1-20 (R5 intact) |

The second CB draw caught the model copying one pooled pair three times
(`10v10 8v10 6v5 10v10 10v10`) — the pool alone is not enough, which is why the
reassignment gate exists. The five draws taken after it are clean.

## Gates

`typecheck:lumina` 0 · focused vitest **47/47** across the three generators' suites
(20 of them new) · full vitest 5356 passed / 1 failed — that failure is another lane's
uncommitted `story-ribbon` catalog row, not this slice.

## Ratio

411 lines of production code across three generators, under 204 lines of docblock and
560 lines of test. The comments carry the mechanism (why a slot index is a pooled
field, why derivability bounds the placement, which axis owns the gap); the tests are
property assertions because the placement is a real draw and a fixed index would only
pin the seed.

## Residual — queued as HC-5

A single-mode `highlight_sequence` lesson naming two intervals has exactly **2**
distinct problems — under the 3-item mastery floor. The cap is right (5 identical
screens is worse), so the generator logs a WARN naming the shortfall, but the fix is a
decision this slice cannot make: blend a second mode into that objective's block, or
give the mode a structural axis (a start offset changes the skill, so it is not free).
Filed as **HC-5** in `EVAL_TRACKER.md` with `/add-structural-difficulty` or a blend
ruling as executor. The row also carries the class: any generator whose problem
identity is a small enumerable product can cap below the floor, so check the product
before setting a per-mode count.
