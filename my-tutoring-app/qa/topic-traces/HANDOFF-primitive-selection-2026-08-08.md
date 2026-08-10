# HANDOFF — Lesson ordering & primitive selection (2026-08-08)

**State: SOLVED, at a layer this document spent most of its length looking past.**
The reported defect — a K counting lesson opening on a grid of written numerals — was
the **objective order**, produced by the Bloom rule in the curator brief. Fixed by
ranking prerequisite → concrete-before-symbol → Bloom. Origin lesson went from
**1/5, 1/5, 1/5 to 5/5, 5/5, 4/5**; math from 2.67/5 to 3.93/5; the engineering control
improved to 4.67/5 with a 0% wrong-opener rate. **Read `order-audit-2026-08-08.md`
first — it supersedes §3.2 through §6 of this file.**

Everything Layer B proposed was aimed one layer too low and is dead: B′ killed by
inspection; arm B built, A/B'd, rejected (`order-ab-2026-08-08.md`). Neither could see
the real defect, because **both arms shared the same wrong objective order.**
**Everything below is UNCOMMITTED in the working tree.**

Read §1 for why this began, §3 for what was measured and what the measurement
cannot see, §4 for the real mechanism, §5 for what NOT to rebuild, §6 for the
open work.

---

## 1. Origin — the reported defect

A Kindergarten "counting to 10" lesson opened with `hundreds-chart` rendering the
full 1-100 board and instructing: *"Count by 5s and tap every number you land on,
all the way to 100."* The card's own title said "First Steps on the Grid! …
highlighting the first ten numbers in order" — the LLM prose honored the lesson,
the deterministic builder underneath did not.

**Cause:** three hardcoded `100`s in `gemini-hundreds-chart.ts` (sequence bound,
instruction prose, returned `gridMax`) plus a skip pool containing no `1`, so
"count in order" was inexpressible at any grade. The generator's entire output
space was skip-counting to 100.

**Fixed** — see §2. But chasing it surfaced the larger question: *was
hundreds-chart even the right first activity, and is the lesson ordered sensibly?*

---

## 2. Shipped this session (uncommitted)

| File | Change |
|---|---|
| `service/math/gemini-hundreds-chart.ts` | `resolveChartWindow` (temp-0 Flash Lite, explicit-bounds-only) + `resolveLegalSkips`; `gridMax` threaded through sequence/instruction/data; by-1s legal at windows ≤20 |
| `service/math/gemini-hundreds-chart.window.test.ts` | 10 tests — window, by-1s language, code-enforced skips, legacy 1-100 byte-compat |
| `service/manifest/catalog/math.ts` | hundreds-chart `description`/`constraints` — deleted the false "Grid always 1-100", named K as in-range |
| `service/curator-brief/gemini-curator-brief.ts` | Bloom ordering rule (§3.1) |
| `service/manifest/resolveLessonEvalModes.ts` | **arm B** — position-aware prompt variant (§6). Arm A is byte-identical HEAD |
| `service/manifest/gemini-manifest.ts` | `ManifestExperiment` threaded to the resolver; absent = HEAD |
| `app/api/lumina/topic-trace/route.ts` | `componentConfigs[]` emits `beta` + `scaffoldingMode` + `evalModeSkills`; POST accepts `experiment.evalModeArm` and echoes the resolved arm |
| `scripts/bloom-order-harness.mjs` + `package.json` | `npm run audit:bloom-order` |
| `scripts/block-ramp-harness.mjs` + `package.json` | `npm run audit:block-ramp` — **descriptive only, see §3.3** |
| `scripts/order-ab-harness.mjs` + `package.json` | `npm run audit:order-ab` — paired, blind-judged A/B (§7.3) |

Verification: `npm run typecheck:lumina` 0 errors; `tsc --noEmit` 0 errors in every
touched file; full vitest 195 files / 2483 tests pass; live end-to-end trace confirms
`gridMax: 10` and all 10 components in scope. Report: `counting-to-10-2026-08-08.md`.

---

## 3. Measurements

### 3.1 Layer A — objective ordering (load-bearing, and its FIRST version was wrong)

> ⚠️ **Superseded — read this section as history.** The 83% → 100% result below is
> real, but 100% Bloom-monotone was the wrong target: it is what forced the numeral
> grid to the front of the origin lesson. `identify`(1) outranks `apply`(3), so
> "recognize the numerals" was pinned ahead of "count objects" in every counting
> lesson, and hardening the rule removed the model's remaining room to deviate.
> Bloom ranks the cognitive operation, not whether the child is holding a thing or the
> symbol for it. Current rule and its measurement: `order-audit-2026-08-08.md`.

Objectives are **taught in emitted order**, so an inversion means the lesson
applies a skill before teaching the concept it rests on.

| | Bloom-ordered | inversions |
|---|---|---|
| baseline | 20/24 (83%) | 4 |
| after | 24/24 (100%) | 0 |

All 4 baseline inversions were one shape — a conceptual `explain` objective
appended after `apply`. Cause: the prompt asked to "progress from lower to higher
Bloom's levels *when appropriate*" then listed verbs in non-Bloom order with no
level numbers (`create`(6) third, `apply`(3) sixth). The model was told to rank by
a scale the prompt never gave it.

Fix: verbs re-listed lowest→highest with explicit `(n)`, rule hardened, the
trailing-`explain` trap named, PREREQUISITE OVERRIDE added for same-level pairs.

Confirmed on the origin lesson — cardinality moved from 3rd to 2nd, ahead of the
counting objective that depends on it. Detail: `bloom-ordering-2026-08-08.md`.

**This is the layer that makes engineering lessons ("how an excavator digs",
"how a dump truck carries a load") sequence well.** There, the primitive identity
itself carries the role — explorer → simulator → planner → challenge — so
Bloom-ordered objectives plus the curator's primitive choice is the whole
mechanism. Keep it; it is the positive control everything else is judged against.

### 3.2 Layer B — within-block ramp + selection (symptoms real, cause misread)

32 manifests, 81 objective blocks, 4 trials × 8 K-2 topics.

**Ordering: 19/72 scorable blocks inverted (26%);** against the 37 blocks with any
tier variation at all, **19/37 = 51%**. Concentrated, not diffuse:

```
counting to 10   [identify]  hundreds-chart(t1) → number-sequencer(t4) → di-math-facts(t1)
counting to 20   [identify]  hundreds-chart(t1) → number-sequencer(t5) → di-math-facts(t1)
shapes           [explain]   shape-tracer(t1)   → di-shapes(t3)        → sorting-station(t1)
place value      [explain]   foundation-explorer → base-ten-blocks(t2) → place-value-chart(t1)
```

**Selection: a primitive resolves to the same mode regardless of objective verb.**

```
6x  explain → ten-frame/build      7x  identify → sorting-station/sort_one
6x  apply   → ten-frame/build      2x  explain  → sorting-station/sort_one
5x  identify→ ten-frame/build      2x  apply    → sorting-station/sort_one
2x  compare → ten-frame/build
```

⚠️ **This table aggregates ACROSS lessons, not within a block** — it was originally
read as "every slot in a block collapses onto one mode", and that reading is wrong.
Measured on a valid instrument: **0 of 86 objective blocks resolve every slot to the
same skill, and 0 duplicate-skill pairs within a block** — under HEAD *and* under the
variant built to fix it (`order-ab-2026-08-08.md`). What the table actually says is
that whenever `ten-frame` appears *anywhere*, it tends to get `build`. That is
primitive-level dominance, and it may be correct: `build` may genuinely be what a K
ten-frame objective asks for. It is a **content** question about those primitives —
`/topic-fidelity` or `/primitive-contract`, one primitive at a time — not an
ordering or manifest-stage question.

### 3.3 What the §3.2 numbers cannot see — read before trusting them

1. **Math only.** All 8 harness topics are math. Zero phonics, zero science, zero
   engineering — i.e. the measurement never covered the lessons that work, nor
   two of the four domains the ordering question was asked about.
2. **`scaffoldingMode` does not exist across most of the catalog.** Multi-mode
   primitives by domain: math 61/61, literacy 31/32, chemistry 14/14, core 7/19,
   **engineering 5/24, astronomy 4/11, biology 0/17**, media 1/4. 61 of 196
   primitives have no eval modes at all. Any tier-based ordering metric — or fix —
   is a math+literacy instrument wearing a general-purpose label.
3. **Untiered components are dropped before adjacency is checked**
   (`block-ramp-harness.mjs:72-74`). A block of
   `annotated-example → ten-frame(t4) → number-line(t2)` scores `[4,2]` = inverted,
   with the intro invisible and two non-neighbours compared as neighbours. The
   26%/51% figures are computed on a compressed sequence.

`audit:block-ramp` stays as a **descriptive** instrument — the selection-frequency
table is genuinely useful. It is not a success criterion.

---

## 4. The hypothesised mechanism — three stages disagree (TESTED, DID NOT HOLD)

This was the diagnosis arm B was built from. The *description* of the three stages
below is accurate — the code says what it says. The **inference** that this conflict
is what produces bad lessons was tested and did not survive: reconciling the stages
(arm B) changed nothing on 26 of 48 lessons and lost 9-13 where it acted, and the
within-block collapse attributed to rule 2 does not occur at all (§3.2). Recorded in
full because the next person will re-derive it from the same three files.

1. `gemini-manifest.ts:239` tells the curator the component order carries a
   teaching arc: *"Order matters: start with introduction/explanation, then
   practice/application."* But the curator no longer sees eval modes at all —
   they were deliberately stripped to reclaim its cognitive-load budget
   (`gemini-manifest.ts:356`). So it orders by primitive identity and intent.
2. `resolveLessonEvalModes.ts` then assigns the skills and is **explicitly
   forbidden** from reading that arc — arm A rule 1: *"Never pick by lesson
   position, phase, or 'introducing the tool'."* Stage 2 encodes an arc; stage 3
   is instructed to ignore it.
3. Arm A rule 2 — *"choose the simplest mode that fully covers the objective's
   skill"* — is a global simplest-mode bias with no per-slot differentiator.
   ~~Every slot under one objective therefore lands on the same mode.~~ **Wrong:
   0/86 blocks do this.** And the bias is load-bearing in the other direction —
   removing it (arm B) produced 6× the overreach-past-objective flags. It is the
   guard that keeps a first activity reachable.

**The objective verb was never missing.** It is already in the resolver prompt
(`resolveLessonEvalModes.ts:193`, `objective (${objectiveVerb})`). The old "Layer C
— thread the verb into mode resolution" would have threaded something already
threaded. The verb is present and outranked.

---

## 5. Rejected — do not rebuild these

**B′ — deterministic within-block sort by `scaffoldingMode`.** Killed. §5's own
argument against β applies to it unchanged: `scaffoldingMode` and `beta` are
assigned from the *same* PRD table (`ADDING_EVAL_MODES.md:121-128` — mode 1 ↔ β 1.5,
mode 2 ↔ β 2.5 … mode 6 ↔ β 8.0). Measured over the live catalog: **886
within-primitive mode pairs, zero where `scaffoldingMode` order disagrees with β
order** (47 sm-ties, all broken by β). It is β-sort quantized into six buckets.
`scaffoldingMode` does have a second, legitimate reading — concrete → pictorial →
symbolic — but the PRD binds it 1:1 to a difficulty prior, so neither the sort nor
the harness can tell you which axis you ordered by. It also cannot act on
engineering, biology, astronomy or most of core (§3.3.2), and it *moves components
the curator deliberately placed* rather than fixing what made them wrong.

**Sorting components by IRT `beta`.** β is a psychometric difficulty prior; Bloom is
a cognitive-demand class. `decompose` and `compare_groups` are both β 1.5 —
identical difficulty, different cognitive acts. Sorting by β yields an easy→hard
lesson, not a pedagogically ordered one. (User ruling: *"learning objective should
drive this."*)

**Tagging 192 primitives / 541 eval modes with named Bloom levels.** Killed by
measurement. It would not have fixed the observed misfits (`number-bond/decompose`
under a cardinality objective is a *content* error, not a cognitive-level one;
both sit at roughly Understand), it partly re-encodes what the parent block's
`objectiveVerb` already declares, and both §3.2 findings turn out to be prompt
conflicts (§4) that no amount of tagging touches.

**Content-fit `serves:` clause in the catalog.** Deferred, not rejected — validate
with §7 before anyone authors 541 rows. The cheap version of this channel is
already proven: a 2-line edit to hundreds-chart's `description` measurably moved
the curator (it began emitting "small 1-10 grid"). Fix named offenders empirically
before generalizing.

---

## 6. Arm B — built, measured, REJECTED

Full numbers: `order-ab-2026-08-08.md`. Headline: identical to HEAD on **26 of 48**
same-manifest pairs (and 11 of 12 phonics pairs); on the 22 that differed, **A 13 –
B 9**, p = 0.52; flagged for reaching past the objective on **6 pairs vs A's 1**.
Controls held 2-2. It is kept in the tree, gated off and labelled, because
`compareArms` needs a counterfactual — **do not promote it to default.**

What it does, for the next person who considers reviving the idea. It reconciles
§4's three stages instead of adding a fourth — a prompt change inside the stage that
already exists, no new stage, no schema field, no per-primitive authoring, and
nothing that reorders what the curator placed.

`resolveLessonEvalModes.ts`, gated on `experiment.evalModeArm === 'B'`:

- Each slot is shown **`position: N of M` in the objective's teaching sequence**,
  and each sibling is marked `[earlier]` / `[later]` — "already anchored upstream"
  is only actionable if the model knows which siblings came first.
- Rule 1 no longer forbids position. It forbids picking *by* easiness — the actual
  hazard the old wording was reaching for.
- Rule 3 (new) makes position a **tiebreak among modes that all fit**: earliest
  slot takes the most supported fitting mode, later slots take the ones asking the
  student to carry more. Explicitly never licenses a mode the objective did not ask
  for, and never reorders components.
- Rule 4 makes duplication the exception: if an *earlier* sibling already anchors
  the mode, take the next one that still serves the objective.

Skill fit still outranks all of it, and the stage stays non-regressing — an
unresolved or all-invalid slot keeps the curator's pin, and a failed call leaves
the manifest untouched.

**Why it failed:** rule 3 is an escalator, and escalation is wrong about as often
as it is right. It buys a more reachable first activity (19 vs 15) and pays for it
with overreach (6 vs 1). Arm A's simplest-mode bias was already holding that line.

### What is actually left in this lane

One question, and it is **not** an ordering question: is `sorting-station → sort_one`
in 11 of 12 appearances, or `counting-board → count` in 6 of 6, the right call? That
is a per-primitive content check — `/topic-fidelity` or `/primitive-contract`, one
primitive at a time. File it there or drop it; do not reopen ordering to chase it.

### Arm C — the eval-mode stage also REORDERS each block. Built, measured, NOT promoted.

Added after the above: `resolveLessonEvalModes` arm C asks the same call that assigns the
skills to also return each block's teaching order. The argument for it is real — the manifest
fixes order while choosing from 100+ primitives and before any skill exists — but the
measurement does not support promoting it. **66 blocks over two passes, 10 ordering actions:
5 right, 3 defensible, 2 wrong**, with directly contradictory calls on the same topic and verb
across passes, and 4 of 7 post-fix actions landing on the engineering CONTROL. Four defects
were found and fixed in the same slice (no catalog description in the ordering listing;
`blockOrders` emitted before `picks`; rule 3 silent on drills; ordering skipped whenever a
lesson had no multi-mode slot — which is every all-expository biology lesson). Gate before any
promotion: `npm run audit:order -- <port> N A,C`, not yet run.
Full detail: `armC-block-ordering-2026-08-08.md`.

### Smaller residuals

- Curator emits 2-3 objectives though the schema asks for "3-4"
  (`gemini-curator-brief.ts` objectives description). Unexamined.
- `place value to 100` produced a `create`(6) objective for Grade 2. Ordered, so
  the harness passes it, but worth a look.
- The `analyze` and `compare` verb categories had overlapping synonym lists
  ("Compare, contrast" appeared under `analyze`). Partially disambiguated in the
  Layer A edit; not verified.

---

## 7. Instruments

### 7.1 Objective Bloom order

```
npm run dev                                     # note the port
npm run audit:bloom-order -- <port> baseline 3
```
8 topics × N repeats, `manifestOnly=true` (~5-10s each, no generators). Repeats
matter — objective COUNT varies run to run (2-3 for K-2) and the inversion only
appears on the 3-objective shape, so one pass under-samples.

### 7.2 Within-block ramp + selection frequency (descriptive)

```
npm run audit:block-ramp -- <port> 4
```
Reports inverted scaffolding ramps plus a `verb → primitive/mode` frequency table.
**Read §3.3 before quoting its numbers.** The selection table is the trustworthy
half — it is what made the mode-collapse visible by name and frequency.

### 7.3 Paired blind-judged ordering A/B — the success criterion

```
npm run audit:order-ab -- <port> 4
```
12 topics × N pairs across math / phonics / science / engineering. Per topic:

- **Paired ON THE MANIFEST.** `experiment.compareArms` generates ONE curator
  blueprint with resolution skipped, then resolves a clone of it under each arm.
  Objectives are generated once and FIXED too. **Both levels of pairing are
  required:** the first version froze only the objectives, the manifest re-sampled
  per arm, the component sets diverged on 35 of 36 pairs, and the run measured
  nothing but noise (20-16, p=0.62).
- **Identical pairs are counted, not judged.** An arm that changes nothing scores
  50% if you average over all pairs — report over the pairs that differed, and
  report the identical count as a finding in its own right.
- **Blind.** Arm labels stripped; presentation order flips on alternating pairs, so
  a judge that favours "Lesson 1" cancels out. The harness verifies the echoed
  `experiment.evalModeArm` rather than trusting the request field.
- **Judged on demands, not tiers.** Rubric: (1) can a student meeting this for the
  first time succeed at each block's *first* activity, (2) does the block build,
  (3) does anything overreach the objective. `gemini-flash-latest`, temp 0 — never
  flash-lite for judging.
- **Controls.** The two engineering topics are the lessons that already order well.
  An overall win bought with a control regression is a loss.

Reports win/loss/tie with a two-sided sign test, a per-domain and control-only
breakdown, rubric-flag counts, and — as secondary descriptors only — flat-block and
duplicate-skill counts per arm. Writes `order-ab.json` beside the script.

---

## 8. Gotchas

- **Dev server port drift.** Ports 3000-3004 were occupied; each `npm run dev`
  climbs. Always read `Local:` from the server log before pointing a harness at it.
- **Warm the route first.** A `manifestOnly` trace fired while Next is recompiling
  returns HTML 404, which the harness records as an error and silently shrinks the
  sample. One warmup request before a run avoids an 8-sample hole.
- **`generatorInput.config` does not exist** — the path is
  `generatorInput.item.config`. Cost an hour and a false bug report.
- **`npm run typecheck:lumina` only covers `components/lumina/`.** The trace
  endpoint lives in `src/app/api/` and is not gated by it — run
  `./node_modules/.bin/tsc --noEmit` and grep for the file, then exercise it at
  runtime. (Four `implicitly any` errors sat in `route.ts` unnoticed for exactly
  this reason; fixed.)
- **Arms are request-scoped on purpose.** `experiment.evalModeArm` travels in the
  POST body and is POST-only — never an env var, so an arm cannot survive the run
  that armed it. A GET always runs production HEAD.
- **`fileURLToPath`, never `new URL(import.meta.url).pathname`.** The repo path
  contains a space; `pathname` leaves it percent-encoded (`claude%20web%20tutor`),
  so every `fs` call in a harness misses by one directory. All three harnesses had
  this — `block-ramp.json` and the bloom-order label file were never actually
  written. Fixed in all three.
