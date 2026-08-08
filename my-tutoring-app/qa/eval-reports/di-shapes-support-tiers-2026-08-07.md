# di-shapes — L3 support tiers + L4 structural difficulty (DI item 14, rungs 3+4)

**Date:** 2026-08-07 · **Verdict: SHIPPED. di-shapes is L4.** One
`config.difficulty` enum now drives BOTH within-mode dials:

- **L3 — how much help.** How much of the DISTAR sequence precedes the answer.
  Fourth use of the family's script-composed fade (di-sentence-reading 07-25
  original · di-math-facts + di-letter-sounds 08-01).
- **L4 — how hard a problem.** How far the drawn instance sits from the
  prototype the child has memorised.

**Why both shipped together.** L3 alone left easy/medium/hard drawing
**byte-identical pictures** with only the spoken scaffold toggled — the exact
weak outcome `/add-support-tiers` warns about, and a ceiling a child who had
mastered the mode could not climb past. The L3 half is written up first below;
L4 follows.

## The ladder

Modality #2 (instruction-as-scaffold) end to end: a tier withdraws spoken
sub-steps and changes **nothing else** — same shapes, same rotations, same
counts, same item count, same judging contract.

| Mode | easy | medium | hard |
|---|---|---|---|
| `name_shape` / `shape_review` | *"Listen: this shape is a triangle."* + *"Together: …"* + ask | model + ask | **ask alone** — cold name |
| `count_sides` / `count_corners` | *"Listen: this shape has three sides."* + *"Together: …"* + ask | model + ask | **ask alone** — cold count |

Composed from **real generated data** through the live route:

```
easy      Listen: this shape is a square. Together: this shape is a square. Your turn. What shape is this?
medium    Listen: this shape is a hexagon. Your turn. What shape is this?
hard      Your turn. What shape is this?
count/hard Your turn. How many sides does this shape have?
control   Listen: this shape is a square. Together: this shape is a square. Your turn. What shape is this?   ← no difficulty → byte-identical to easy
```

## Two things that are pack-specific, not template copy

**(1) The fade needed NO per-mode carve-out, and that is a property rather than
luck.** di-letter-sounds had to keep *speaking* the stimulus at `hard` (an onset
ask has no printed grapheme) so its fade carries an inversion guard. Here the
stimulus is **drawn** — already on screen at every tier — and `ask()` is
answer-free by construction under all four identities, so `hard` reduces to
exactly `testLine(it)` on every mode. Pinned as a test rather than left implicit.

**(2) The counting inversion: a cold count must withhold TWO tokens.** Under a
counting mode the shape's NAME is not the answer but it *hands over* the answer
to any child who knows it (triangle → three). So the cold guard names both, plus
the describe-it-aloud route:

> *"before they answer, do NOT say the count, do NOT say the shape's name (it
> gives the count away), and do NOT describe or count the drawing aloud."*

Naming modes get the shorter form. This is the L1 answer-leak rule restated
where the tutor is most likely to improvise.

## What must NOT change — pinned

- **BOTH corrections re-model at every tier** (standing gate 3). This pack ships
  the contrastive line *and* the plain one — the near-name/near-count IS the
  error class — so gate 3 has two byte-pinned lines here, not one.
- The restating AFFIRM, the judging contract (byte-identical across tiers, else
  tiers stop being comparable evidence), the judged "diamond" alternate, the
  drawn shape itself, and rule #1 (counting items stay polygon-only at `hard`).
- Sentinel discipline re-scanned across the **whole tier grid** — the fade adds a
  new unquoted sentence (the cold guard) to every hard cue, and a guard line
  opening "Yes"/"My turn" would forge a verdict.

## Gotcha #2 — the tutor's second reveal channel

- `contextKeys: ['challengeType', 'supportTier']`; the component sends
  `supportTier` in `primitive_data` at connect and per item via `updateContext`,
  always with an `?? 'easy'` floor so the key is **never absent**.
- Catalog `LIVE-JUDGED DIRECT INSTRUCTION` gains the family's cold-item clause,
  adapted: *"never name the shape, state its count, or describe the drawing
  before they have answered."*
- **One catalog line went stale and was reworded:** `scaffoldingLevels.level2`
  said *"Say the answer once more **the way the script did**"* — at `hard` the
  script models nothing before the ask, so that back-reference pointed at
  silence. Now *"Model the answer once yourself, then ask for one retry."*
  Remediation is untouched in substance (gate 3: a tier never withdraws it).

## Gates

| Gate | Result |
|---|---|
| Focused Vitest (script + generator + component) | **55/55** |
| **Revert-bites** | **8/8 bit** (see below) |
| Full Vitest | **2349/2349**, 186 files |
| `typecheck:lumina` | **0 errors** |
| src-scoped `tsc --noEmit` | **803 = rung-2 baseline**, zero errors in any touched file |
| Real-pipeline probes | **6/6** — easy/medium/hard naming, `count_sides`@hard, `mixed`@hard (all four identities, all tiered), untiered control |
| `/tutor-test` Tier-2 | see the honest finding below |

**Revert-bites** (each mechanism removed must break a test): `leadInFor` ignores
the tier → 7 fail · cold guard always empty → 3 · counting guard loses the
shape-name clause → 1 · absent tier ≠ easy → 1 · **application gated on a single
pinned mode (the classic no-op) → 1** · `normalizeSupportTier` loosened → 1 ·
`supportTier` dropped from the connect bag → 3 · dropped from `updateContext` → 1.

## The Tier-2 finding, stated honestly

The `/tutor-test` probe reports `supportTier: unresolved` and **one `(not set)`
in its prompt PREVIEW**. That reproduces di-math-facts' filed residual (iii) —
and the diagnosis is that **it is a family-wide analyzer blind spot, not a
di-shapes defect**: all five DI packs report `data-bag-unparsed`
(`dataBagKeys: null`), because `scaffoldAudit.analyzeHookSite` parses
`useLuminaAI({ primitiveData })` hook sites while the DI family passes its bag
through `ctx.connect({ primitive_data })`. The probe never sees the component's
key space at all, so its preview is not evidence about the shipped prompt.
Measured, not assumed — probed di-letter-sounds, di-math-facts and
di-sentence-reading for the comparison.

Rather than assert "works at runtime", the claim is closed by **executing the
component**: `DiShapes.support-tier-context.test.tsx` (jsdom) mounts the pack,
runs it, and reads what it actually sent — tier present in the connect bag,
tracked per item through `updateContext`, `'easy'` on an untiered session so
RUNTIME STATE can never read `(not set)`, and the bag **answer-free at every
tier** (no shape name, no count). Bites 7–8 prove it non-vacuous.

**Filed, not fixed (cross-queue):** `scaffoldAudit.analyzeHookSite` cannot parse
a `ctx.connect({ primitive_data })` bag, so every DI pack's contextKeys are
audited blind. That is the true root of residual (iii), and it belongs to the
tutor-test harness queue, not this rung.

## Residual

**No live audio on the `hard` tier.** That the tutor honours a cold ask — never
naming the shape, never counting the drawing aloud, never volunteering the count
before the child answers — is **unproven live**. It folds into the same mic
session as #63/#72 (see HUMAN-CHECKS). Everything above is machine-verified;
this one ear-check is not.

---

# L4 — structural difficulty (rung 4)

## The lever: exemplar typicality

Three sub-dials that are one lever — how far the drawn instance sits from the
prototype:

| | easy | medium | hard |
|---|---|---|---|
| **exemplar** | textbook picture | textbook picture | **non-prototypical** — scalene obtuse triangle, irregular hexagon/pentagon, portrait rectangle, right trapezoid, tall oval |
| **rotation** | ¼ of the shape's safe ceiling | 0.6 | **full ceiling** |
| **scale** | 100% | 85–100% | **62–100%** |
| **ordering** | confusables kept apart | natural | **confusables side by side** |

A child who only ever meets the prototype learns the **picture**, not the shape.
Separating defining attributes (three straight sides, three corners) from
non-defining ones (which way up, how regular, how big) IS the skill — it is the
literal wording of both curriculum homes `/curriculum-fit` measured for this
pack: K `GEOM001-01-A` *"…regardless of size, color, or orientation"* and G1
`GEOM001-01-c` *"defining versus non-defining attributes"*.

**Live across tiers (real generations):**

```
easy    hexagon@7° proto 100% | rectangle@22° proto 100% | pentagon@-7° proto 100%
medium  triangle@64° proto 90% | hexagon@11° proto 99%  | pentagon@18° proto 87%
hard    pentagon@-26° VARIANT 82% | hexagon@-5° VARIANT 63% | rectangle@61° VARIANT 69%
count   three@65° | four@7° | five@-28° | six@-3° | five@-26°   ← adjacent counts, deliberately
control rectangle@-6° (no exemplar, no scale stamped — pre-L4 path untouched)
```

## Three things worth carrying forward

**(1) The rotation cap was hiding the standard.** The menu's `maxRotationDeg`
capped a triangle at 25°, so a pack whose curriculum home is *"regardless of
orientation"* had **never once tested orientation**. `SAFE_ROTATION_DEG` splits
the two concepts: the gentle untiered default vs. the rule-#1 ceiling the tier
may climb toward. A hard triangle now reaches point-down (asserted: >90°). The
ceilings are per-shape and principled — square 15° (45° reads as a *diamond*,
a judged alternate for rhombus, so that drawing would have two right answers),
hexagon 30° and pentagon 36° (their rotational symmetry — beyond it you redraw
a picture the child has already seen), triangle/trapezoid the full 180°.

**(2) Geometry became data, and the oracle immediately earned it.** Drawings
moved out of JSX into `diShapesGeometry.ts` so the pedagogy guards are
*assertable*: every polygon's point count must equal the menu's `corners`
(a five-point "irregular hexagon" would ask a child how many sides and then
mark their correct answer wrong), rectangles ≥1.6:1 in **both** exemplars, ovals
clearly non-circular, a rhombus with four equal sides, the triangle variant
provably scalene AND obtuse. Revert-bites 14 and 15 confirm those bite.

**(3) Fork A makes this axis purely code-enforced.** The reference
implementations split the lever between a prompt that *describes* the harder
shape and a post-process that *enforces* it, because the LLM authors item
content and drifts. Here the LLM authors **none** — menu, geometry, rotations,
counts and ordering are all code-owned, and Gemini writes only the title and
description. So there is no prompt half to keep in sync: one dial, one place,
no drift possible.

## Two bugs this rung produced and caught

**A real one, in code I had just written.** The greedy adjacency walk could
strand two of the same shape side by side, breaking the pack's pre-existing
back-to-back variance rule — a tier silently costing an invariant it had no
business touching. Fixed with a repair pass (`repairBackToBack`); revert-bite 13
proves it bites.

**A flaky test, which is worse than no test.** The first confusable-adjacency
assertion used `easyRate < 0.5` over 10 samples — sitting exactly on easy's own
measured mean of 0.42, so it failed about a third of the time. A flaky gate
trains the next session to re-run until green. Rewritten against a **measured**
distribution (300 sessions per tier) at ≥3σ on 60 samples, then hammered 12
consecutive times, all green:

```
easy   mean 0.42  min 0  hist {0:226, 1:36, 2:23, 3:15}
medium mean 0.85  min 0   (natural order — no reordering at all)
hard   mean 1.46  min 1  hist {1:210, 2:43, 3:47}
```

**One change reverted on measurement.** Seeding the greedy walk from an item
that already has a confusable partner sounded obviously right; measured it moved
the mean 1.54 → 1.46, i.e. nothing (the binding constraint is pool composition,
not the starting item). Reverted rather than kept on a plausible argument.

## L4 gates

| Gate | Result |
|---|---|
| di-shapes suites (13 files) | **173/173** |
| Revert-bites | **17/17 bit** across both rungs (7 new for L4 + 2 component) |
| Flake hammer on the rewritten statistical test | **12/12 consecutive** |
| Full Vitest | 2417 passing; the only red is the **concurrent session's** untracked astronomy/biology files (`gemini-planetary-explorer.reader-fit.test.ts`, `gemini-dna-explorer.answer-leak.test.ts`) — verified zero references to anything in this slice |
| `typecheck:lumina` / src-scoped tsc | **zero errors in any di-shapes file**; the 4 reported are in those same two untracked concurrent files |
| Real-pipeline probes | **11/11** across both rungs |

## L4 residual

The `hard` tier's drawings have **not been seen by a human on screen**. The
geometry is asserted (point counts, aspect ratios, scalene/obtuse, in-bounds)
and the render path is asserted in jsdom (the variant's exact `points` string
reaches the SVG, `scale(0.7)` reaches the transform) — but nobody has confirmed
a 62%-scale irregular hexagon at 30° still *reads* clearly to a five-year-old.
Folds into HUMAN-CHECKS #72 alongside the `hard` cold-ask ear.

## Files

- `primitives/visual-primitives/direct-instruction/diShapesGeometry.ts` — **new.** Drawings as data, two exemplars per shape, `SAFE_ROTATION_DEG`, geometry helpers
- `primitives/visual-primitives/direct-instruction/diShapesScript.ts` — `DiShapesSupportTier`, `ShapeExemplar`, `supportTier`/`exemplar`/`scalePct` on the challenge, `leadInFor`, `coldAnswerGuard`, cue rewire
- `service/direct-instruction/gemini-di-shapes.ts` — tier harness, `resolveSupportStructure` (L3), `TIER_GUARDRAIL` + `resolveProblemShape` + `applyAdjacency` + `repairBackToBack` (L4), `difficulty?: string`, per-challenge application at the END
- `primitives/visual-primitives/direct-instruction/DiShapes.tsx` — renders from geometry data with exemplar + scale (stage, reward beat, and recap all replay the same drawing); tier into the connect bag, `updateContext`, run log
- `service/manifest/catalog/di.ts` — `supportTier` contextKey, cold-item directive clause, level2 reword
- tests: `diShapesGeometry.test.ts` (new, 17) · `diShapesScript.support-tiers.test.ts` (new, 18) · `DiShapes.support-tier-context.test.tsx` (new, 8) · `gemini-di-shapes.test.ts` (+13)

## Honest size of the slice

~350 lines of non-comment production code (geometry module 84, generator +161,
component +79, script +21, catalog +6) against ~750 lines of tests. The L3 half
alone was 66 lines — a fair criticism when the prose around it ran longer than
the change; L4 is where the child-visible capability actually landed.
