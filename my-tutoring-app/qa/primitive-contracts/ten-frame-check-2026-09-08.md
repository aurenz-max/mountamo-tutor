# `/primitive-contract ten-frame --check` — 2026-09-08

**Verdict: CONFLICT → forked at rung 1 (eval-mode split). Post-fork re-run: COMPATIBLE.**

The edit under guard: give K.NBT.1 ("compose and decompose numbers 11-19 into ten
ones and some further ones") a working home. Pulled as K Math atlas P0
`teen-numbers-ten-plus`, which recorded seven rows — COUNT001-05-A..F and
COUNT001-03-G — with no primitive that could serve them.

## Pre-edit: blast radius

The planned edit's zone is frame capacity and grade band, which is **R2**, and
R2 is OBSERVED with live consumers:

| Consumer in the zone | What it demands of R2 |
|---|---|
| K PRE — `build` / count-all | a single 10-cell frame; ten is the ceiling |
| K PRE — `subitize` 1–5 | a single frame; a scattered 20-cell board is a different perceptual task |
| K PRE — `make_ten` | pinned single, post-config, because make-20 is a different skill (TF-3) |
| K PRE — `split` / K.OA.3 | pinned single, because a double frame is twenty empty boxes around a group of five |
| Grades 1–2 | may use double for values through 20 |

## The conflict, and why the obvious edit was refused

The atlas's own next action was *"allow the double frame at K when the objective
names 11-19"* — an in-place widening of R2. Both demands are right for their
consumers and they cannot both hold on one frame: ten is the CEILING for
counting, subitizing and make-ten, and a UNIT with room beside it for K.NBT.1.
Widening R2 would leave every K counting lesson one manifest misroute away from
a twenty-cell board — ablating exactly the consumers R2 exists to protect.

Rung 1 instead. Two new eval modes, pinned to a **double** frame at every band;
every existing single-frame pin untouched and enforced after config overrides in
both directions. `build_teen` (β 2.0) gives the ten and asks for the ones;
`decompose_teen` (β 3.0) hands over a scattered teen group and asks the child to
find the ten inside it. Number-bond took the same fork in the same slice:
`ten_and_ones` (β 2.0), whose accepted pair is a full ten and the rest, so a
sum-correct split like 6 and 8 for fourteen is corrected rather than affirmed.

Full requirement text, the scatter's reasoning and the recorded nineteen limit:
`docs/contracts/ten-frame.md` R10 and C1.

## Post-edit: probes for every OBSERVED requirement of another consumer

| Requirement | Consumer | Probe | Result |
|---|---|---|---|
| R1 — type follows eval mode | manifest routing, IRT | pack cases + pinned live draws | PASS — extends by two rows; no existing mode's enum changed |
| R2 — capacity/band coherent | K counting, subitize, make-ten, split | `itemFromChallenge` at capacity 10; pinned-mode draws | PASS — `make_ten`/`split` still force single; teen items DROP on a single frame rather than truncating |
| R3 — build is construction | K number sense | build stage + pack cases | PASS — untouched |
| R4 — subitize flashes then hides | perceptual fluency | flash lifecycle stage cases | PASS — untouched |
| R5 — make-ten from one numeric source | TF-3/SP-17 | make-ten instruction vs shown vs complement | PASS — untouched |
| R6 — answer surface forks by band | reader-fit item 12, DI item 18 | make-ten K auto-judge; no stepper/Check at any band | PASS — the `commitAt ?? capacity` fallback became an explicit `commitAt` read so `build_teen` cannot inherit make-ten's frame-full commit; make-ten's own auto-judge is byte-for-byte the same |
| R7 — tiers alter scaffolding only | support-tier axis | pinned-mode tier draws | PASS — teen tiers move which teen numbers are favoured and whether the trace shows, never the window |
| R8 — one submission, tutor advances | mastery, IRT | runner progression + `onFinished` | PASS — untouched |
| R9 — split partitions a given group | K.OA.3 | 15 split cases + 10 split stage cases | PASS — `decompose_teen` reuses the flip machinery without touching split's ledger, verdicts or ordinals |

Machine evidence: `typecheck:lumina` 0 · tsc 770 = baseline · 60/60
`TenFrame.di-script` · 35/35 `TenFrame.reader-fit` · 45/45
`NumberBond.di-script` · 550/550 across the math suite.

Runtime evidence: six live `eval-test` draws on the atlas's own objective text —
`build_teen` 18/18 and 18/18, `ten_and_ones` 18/18 and 18/18, `decompose_teen`
16/16 and 16/16 content checks.

## What the live draws found that the machine gates did not

1. **The model drifted below the objective's window.** A `decompose_teen` draw
   against "Break apart numbers 16-19" returned 13, 14, 14, 15, 15, 16 — one
   item of six inside the named range, the same shape as the cap-below-objective
   defect the atlas filed in the first place. Fixed, not queued: `teenWindow.ts`
   reads the window from the lesson's own words and sweeps it, shared by both
   generators.
2. **The model's `hint` and `narration` stated the ones outright** ("Add 1 more
   counter to the bottom row to make 11"). Inert today — the judged loop renders
   neither and speaks only scripted cues — which is exactly how a leak survives
   until something starts rendering it. Both fields are now code-owned on the
   teen modes, like `instruction` already was.

## Owed

A live tutor drive and a real-browser sitting. The jsdom stage tests exercise
the seeding, the flip, the stillness commit and the reveal, but not paint, hit
targets on a twenty-cell board, or the tutor's voice — HUMAN-CHECKS.
