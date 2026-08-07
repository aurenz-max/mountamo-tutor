# di-shapes — L1 `/add-eval-modes` (2026-08-07)

**Queue:** `qa/di/BACKLOG.md` item 14, ladder rung (2). **Lifecycle:** L0 → **L1**.
**Rung (1) closed the same day** — `qa/curriculum-fit/di-shapes-2026-08-07.md`.

L0 shipped one identity (`name_shape`). This adds the three the birth certificate
queued, closing the second half of the founding modality call — *"this is a
triangle, what is this, **how many sides does it have**"*.

## Modes

| evalMode | β | sm | challengeTypes | What it is |
|---|---|---|---|---|
| `name_shape` | 1.5 | 1 | `name_shape` | (L0, unchanged) name the drawn shape |
| `shape_review` | 2.5 | 2 | `shape_review` | the same naming act over a WIDE cumulative draw |
| `count_sides` | 3.0 | 3 | `count_sides` | say how many SIDES, as a number word |
| `count_corners` | 3.5 | 3 | `count_corners` | say how many CORNERS (vertices) |

β mirrored into `backend/app/services/calibration/problem_type_registry.py`.
No `discrimination` values — the DI family omits them family-wide (backend default 1.4).

**Ordering rationale.** One recall (name) < the same act over an unpredictable
pool (review, the β both sibling packs' review modes use) < a NEW act: attend to
an attribute, enumerate, speak a number (sides) < the same act on point-percepts,
which are easier to skip or double-count than a whole traceable edge (corners).

**Standing gate 1 (bench-first) is satisfied without a sitting, and this is load-bearing
rather than a convenience claim.** Both response classes are already benched: naming is
the single-spoken-word class, and a count here is a number word in **3..6** — the #46
class. The menu tops out at a hexagon, so **no multi-word numeral can arise**, which is
precisely what blocked item 10 behind HUMAN-CHECKS #63. That gate does not reach this rung.

## Curriculum homes — measured, not assumed

Rung 1 probed the modes into real subskills before they were built:

- counting → **G1 `GEOM001-01-b`** @ 0.785, *"Count the number of sides and vertices of
  various 2D shapes to confirm their classification"* — its own example list enumerates
  triangle (3,3), square (4,4), rectangle (4,4), trapezoid (4,4), hexagon (6,6),
  pentagon (5,5), rhombus (4,4): **eight of the nine Fork A shapes, with the same counts
  this pack judges** — and **K `GEOM001-02-A`** @ 0.786, *"…based on their attributes
  (sides and vertices)"*. So counting is not a G1-only extension.
- naming → K `GEOM001-01-A` @ 0.795.

## Two pedagogical rulings taken in this slice

**1. Counting items are POLYGON-ONLY (rule #1).** A curved shape carries `sides: null`
in the menu — not-applicable, not zero — and *"how many sides does a circle have?"* has
**two arguable answers** for a five-year-old: 0 (no straight sides) or 1 (one continuous
curved edge). The pack's birth discipline is *one drawing, one defensible answer* (the
same duty that forces rectangles to ≥1.6:1), so the generator draws counting items from
polygons only, and a curves-only scope **widens rather than emitting an unanswerable item**.
This is a deliberate coverage gap against `GEOM001-01-b`, which does list circle as (0,0):
a zero/none contrast is a real DISTAR teaching move, but it is a different item shape and a
different response class. **Queued, not smuggled in** — see Follow-ups.

**2. Under a counting mode the shape's NAME is withheld too.** It is not the answer, but
it hands the count to any child who already knows it (triangle → three). Test-locked:
`itemCue(count_sides on a triangle)` contains no occurrence of "triangle".

## Defect found while wiring, and fixed

**`shape_review`'s wide draw would have overridden shapes the objective NAMED.** The
family review convention widens the pool (the `fact_review` precedent). Applied naively,
an objective reading *"review triangles and hexagons"* would have returned a rectangle,
breaking the pack's own standing doctrine (*"shapes NAMED in the text win outright"*) and
the trust-intent ruling. Review now widens the **default** only; named shapes still win.
Caught by revert-bite, not by inspection — the bite failed the pre-existing L0 test
*"serves the shapes the objective names, and only those"*.

## Defect found by a live probe, and fixed

The curves-only probe (`count_sides` on *"Count the sides of circles and ovals"*) shipped
chrome reading **"Curve Safari! … look at some smooth outlines"** over five polygons. The
wrapper is written from the objective *before* the pools are built, so a widened counting
session describes shapes the child never sees. Now reverts to the neutral defaults on the
widen path — the same shape as the answer-leak guard. **Verified live post-fix** (below),
with a non-widening control proving the guard is scoped and not a blanket reset.

## The catalog fence rung 1 flagged — lifted

`constraints` said *"no side/corner counting tasks yet… use a geometry primitive with
those modes when counting IS the objective."* That is manifest-visible steering: shipping
the modes under it would have left them **born unreachable**. Lifted. The `description`
now names the counting ask as well, so retrieval and the manifest can both see it.

**Kept, because rung 1 proved they are load-bearing:** the 3D-solids and composing
exclusions. At G1 the 4th and 5th nearest subskills are 3D solids (0.770) and pattern-block
composing (0.769) — both above τ, both things this primitive cannot do.

## Gates

| Gate | Result |
|---|---|
| Focused suites (generator + script) | **28/28** (17 + 11) |
| **Revert-bites** | **6, all bit** — polygon filter (3 fail) · review scope guard (2) · SP-21 spread (2) · counting ASR aliases (1) · script counting branch (2) · wrapper-coherence guard (1) |
| Full Vitest | **2169/2169** (176 files) |
| `typecheck:lumina` | **0** |
| Whole-tree `tsc`, src-scoped | **803 = baseline exactly**, and zero errors in any file this slice touched |
| Backend `py_compile` | clean |
| `/tutor-test` Tier 1 | `warn` — `data-bag-unparsed` + `no-sendtext-moments`, **identical on all three untouched sibling packs**, so a family baseline (DI cues via `queueCue`, never `sendText`), not a regression |
| `/tutor-test` Tier 2 (`count_sides`) | `challengeType` → `count_sides`, **zero `(not set)`** — cleaner than di-math-facts, which has one |

**Real-pipeline probes — 7/7** (dev server :3000, real Gemini, real registry path):

| Probe | Result |
|---|---|
| `name_shape` @ K | core five only, no chrome leak |
| `count_sides` @ G1 | polygons only; counts derived from the menu; aliases switched to `[four, 4]` |
| `count_corners` @ G1 | corners derived correctly |
| **`mixed` @ K** | **all four identities in one 5-item session** — name_shape / shape_review / count_sides / count_corners. SP-21 holds live; a Fork A "mixed" that emits one identity is a lie in the label |
| **`count_sides` on "circles and ovals"** | **zero curved shapes.** Rule #1 held against an adversarial ask |
| same, post wrapper fix | chrome now neutral ("Shape Time"), items still polygons |
| control: "sides of triangles and hexagons" | named shapes honoured exactly; the model's wrapper **kept** — the guard is scoped to the widen path |

Answer-leak scan of the assembled Tier-2 prompt: **zero count words**. The new
`SIDE AND CORNER COUNTS` directive teaches the judging rule without naming a single
number. (Shape names do appear — in `commonStruggles` patterns and the `SHAPE NAMES`
directive, naming the near-name contrast pairs. That is L0 behaviour, by design, and is
a general rule rather than the current item's answer, which arrives only inside `[DI_ITEM]`.)

## Not covered — stated honestly

**No Tier-3 live audio run on the counting modes.** Every gate above is deterministic or
code-judged. Whether the Live tutor actually holds the counting judging contract — waits
out a child counting aloud and judges only the number they land on, refuses an off-by-one,
and never counts the sides aloud itself — is **unproven**. Folded into the existing mic
session, which already carries #63 + #72.

## Follow-ups filed

1. **Tier-3 counting-contract drive** → HUMAN-CHECKS (rides the #63/#72 session).
2. **The zero/none contrast** ("a circle has no straight sides") — a real DISTAR move and
   the one part of `GEOM001-01-b` this rung deliberately does not cover. It needs its own
   item shape and a bench check on "zero"/"none" as a spoken answer.
3. **Cross-queue, filed not fixed:** di-math-facts' Tier-2 probe resolves
   `supportTier: unresolved` and renders **one `(not set)`** into the assembled prompt.
   That is the L3 support-tier contextKey, a different primitive and a different rung.
4. L2 contextKeys stay minimal by design; L3 support tiers, L4 structural
   (rotation magnitude, size, non-prototypical exemplars), L5 sound — unchanged.

## Files

`primitives/visual-primitives/direct-instruction/diShapesScript.ts` (+ test) ·
`DiShapes.tsx` · `service/direct-instruction/gemini-di-shapes.ts` (+ test) ·
`service/manifest/catalog/di.ts` · `evaluation/types.ts` ·
`components/DirectInstructionPrimitivesTester.tsx` ·
`backend/app/services/calibration/problem_type_registry.py`

Generator registration needed no change — `diGenerators.ts` already spreads `ctx.raw`
(carrying `targetEvalMode` + `objectiveText`) and passes `intent`.
