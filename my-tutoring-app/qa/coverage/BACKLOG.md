# Coverage — Queue

**Queue of record for raising eval-mode / tutoring / judged-loop coverage across the whole
catalog.** Opened 2026-08-18 by user directive: *"agree we need full 10% to much higher
coverage for eval+tutor mode, clearly create a plan and execute on the 200."*

Evidence lives in `qa/eval-reports/`, `qa/tutor-reports/`, `qa/di/`. **This file is
authority for WHAT is queued and in what order.** Executors: `/add-eval-modes`,
`/add-tutoring-scaffold`, `/add-di-loop`, `/curriculum-fit`.

Top = next.

---

## The measurement (2026-08-18, whole catalog)

Parsed every entry in `service/manifest/catalog/*.ts` and cross-referenced `*Script.ts`
packs. **197 catalog entries.**

| Axis | Covered | Gap |
|---|---|---|
| `evalModes` (L1) | 139 / 197 — **70%** | 58 |
| `tutoring` block (L2) | 159 / 197 — **80%** | 38 |
| `supportsEvaluation` | 180 / 197 — 91% | 17 |
| **judged pack (L5 / DI)** | **36 / 197 — 18%** | **161** |

Per domain — the gaps are **domain-shaped, not scattered**, which is what makes them
batchable:

| domain | n | evalModes | tutoring | DI |
|---|---:|---:|---:|---:|
| math | 61 | 61 | 61 | 8 |
| literacy | 32 | 32 | 28 | 20 |
| engineering | 24 | 6 | 13 | **0** |
| core | 19 | 7 | 12 | 0 |
| biology | 17 | **1** | 6 | **0** |
| chemistry | 14 | 14 | 14 | **0** |
| astronomy | 11 | 4 | 10 | **0** |
| di | 6 | 6 | 6 | 6 |
| physics | 5 | 4 | 4 | 1 |
| media | 4 | 1 | 2 | 0 |
| assessment | 2 | 1 | 1 | 1 |
| calendar | 2 | 2 | 2 | 0 |

### ⭐ The finding that orders this queue

**103 primitives are DI-portable RIGHT NOW** — they carry eval modes and have no judged
pack. Math alone is 53; chemistry is 14 and is *fully* eval+tutor wired with zero DI.

So **the binding constraint on DI coverage is THROUGHPUT, not prerequisites.** An earlier
read of this data concluded the eval-mode gap was the ceiling; that is true only for
engineering / biology / astronomy (0% DI *because* they are at 25% / 6% / 36% eval modes).
For the other 103 there is nothing in the way but slices.

**Corollary — the lever is CLUSTERING, not speed.** A judged pack is hand-authored per
primitive on purpose (DISTAR discipline: *exact wording is the pedagogy*), so 103 bespoke
scripts is not a plan. But primitives that share a **response class + interaction shape**
can share a script *template*. Wave B is organised by shape for exactly this reason.

---

## Queue

### A. 🔝 **L1 — the 41 that declare themselves evaluable and have no eval-mode ladder.** Executor: `/add-eval-modes` (after `/curriculum-fit`)

These carry `supportsEvaluation: true` and **no `evalModes`**. The adaptive engine cannot
discriminate difficulty on any of them, and none can take a DI port until this lands.

- **engineering (17):** airfoil-lab, blueprint-canvas, bridge-builder, dump-truck-loader,
  engine-explorer, excavator-arm-simulator, foundation-builder, gear-train-builder,
  lever-lab, paper-airplane-designer, propulsion-timeline, pulley-system-builder, ramp-lab,
  shape-strength-tester, tower-stacker, vehicle-design-studio, wheel-axle-explorer
- **biology (13):** adaptation-investigator, bio-compare-contrast, bio-process-animator,
  classification-sorter, dna-explorer, energy-cycle-engine, evolution-timeline,
  food-web-builder, habitat-diorama, inheritance-lab, life-cycle-sequencer,
  microscope-viewer, protein-folder
- **astronomy (6):** mission-planner, moon-phases-lab, orbit-mechanics-lab, rocket-builder,
  scale-comparator, telescope-simulator
- **core (3):** comparison-panel, fast-fact, feature-exhibit
- **physics (1):** motion-diagram · **media (1):** image-panel

⚠️ **`/curriculum-fit` FIRST, per primitive.** Do not author eval modes for a primitive
with no curriculum home — that is how a maintenance treadmill starts. A primitive that
fails curriculum-fit moves to §C (presentational) or gets a demand ruling, not a ladder.

⚠️ **Three of these are already spoken for.** `dna-explorer` (DNA-1/DNA-2),
`classification-sorter` (CS-1), `bio-process-animator` (PA-1) and `life-cycle-sequencer`
(LCS-1) carry open answer-leak rows in `qa/science-depth/BACKLOG.md`. **Fix the leak before
adding modes** — a ladder over a leak just multiplies the leak.

### B. 🔝 **L5 — the 103 that are DI-portable today.** Executor: `/add-di-loop`

**Do not pull these one-by-one off the top.** Cluster first, then port within cluster.

| Domain | Portable now | Note |
|---|---:|---|
| math | 53 | 8 already ported; item 18 has no named Class-A candidate — this roster IS the answer |
| chemistry | **14** | fully eval+tutor wired, **zero DI** — the single densest untouched block |
| literacy | 12 | phase-1 remainder |
| core | 7 | check presentational overlap first |
| engineering | 6 | the 6 that already have eval modes |
| astronomy | 4 · physics 3 · calendar 2 · biology 1 · media 1 | tail |

**Step B0 — ✅ EXECUTED 2026-08-18, see the cluster map below.** It produced **B1, an
18-primitive sweep roster whose every eval mode is portable with today's classes**, and
**B2, 21 primitives gated on `open_set_word`**. Pull from B1; do not re-derive the map.

**Gating:** several shapes want `open_set_word`, which is BLOCKED — see
`qa/HANDOFF-di-open-set-word-2026-08-18.md` (queued as di item 24). Cluster around what is
`benched` / `accepted-build-ahead` and let the open-set clusters wait on that item.

### C. **The 17 presentational-by-design — confirm and MARK, do not build.** Executor: none (a census pass)

`supportsEvaluation: false` **and** no eval modes. These are display surfaces and are
*correctly* unwired — but nothing in the catalog says so, so every future census
re-discovers them as a gap.

- **core (9):** annotated-example, concept-card-grid, curator-brief, custom-visual,
  formula-card, foundation-explorer, generative-table, graph-board, take-home-activity
- **biology (3):** body-system-explorer, organism-card, species-profile
- **media (2):** flashcard-deck, image-comparison
- **assessment (1):** scale-spectrum · **astronomy (1):** day-night-seasons ·
  **engineering (1):** machine-profile

**Deliverable:** a one-line `// PRESENTATIONAL — no eval modes by design (<reason>)` in
each catalog entry. Cheapest item in this queue and it permanently retires 17 false
positives from every future sweep.

### D. **L2 — the 38 missing a tutoring block.** Executor: `/add-tutoring-scaffold`

engineering 11 · biology 11 · core 7 · literacy 4 · media 2 · astronomy 1 · physics 1 ·
assessment 1. Lower priority than A and B: a scaffold on a primitive with no eval modes
has little to scaffold. **Sequence it after that primitive's §A entry**, not as its own
sweep. ⚠️ Probe for the orphaned-config trap — a block without `useLuminaAI` delivers an
EMPTY scaffold.

---

## ✅ B0 EXECUTED — the cluster map (2026-08-18)

**Method matters, and the first attempt was wrong.** Clustering on eval-mode *names* fails:
the 103 portable primitives carry **246 distinct mode verbs, nearly all singletons**
(`bme`, `oreo`, `cer`, `heros_journey`, `limiting`, `ppe`…). Mode ids are bespoke per
primitive. **Cluster on what the child DOES to answer** — the mode's `description` — not on
its id.

**384 eval modes across 100 portable primitives** (3 had no parseable modes), by response
shape:

| Shape | Modes | Response class | Status |
|---|---:|---|---|
| `do_it` — drag/place/build/adjust | 71 | `manipulation` | ✅ benched |
| `say_number` — count/calculate/measure | 54 | `number_word_to_20` / `_to_120` / `place_value_word` | ✅ benched + ahead |
| `name_it` — identify/label/recall | 44 | `closed_set_choice` / `short_spoken_word` | ✅ benched + ahead |
| `choose_it` — predict/compare/classify | 31 | `closed_set_choice` / `yes_no` | ✅ ahead |
| `order_it` — sequence/rank/timeline | 17 | `ordinal_word` | ✅ benched |
| `explain_it` — explain/justify/design | 23 | `open_set_word` | ⛔ **di item 24** |
| `explore` — observe/navigate, no answer | 9 | none | audit assessability |
| **unknown — needs a read** | **135 (35%)** | — | see caveat |

⚠️ **The 35% unknown is honest, not a rounding error.** Keyword matching on descriptions
resolves 65% of modes; the rest need a per-primitive read. **Do not treat this table as a
census** — it is a routing aid. Any primitive pulled for a port still gets its modes read
individually.

### 🔝 B1 — THE SWEEP ROSTER: 18 primitives, 62 eval modes, every mode portable TODAY

Every one of these maps entirely to a benched / build-ahead class. **No new capability, no
bench sitting, no blocked mode.** This is the roster that turns 18% DI coverage into
meaningfully more.

| Domain | Primitive | Modes | Shapes |
|---|---|---:|---|
| chemistry | `periodic-table` | 3 | choose_it, name_it |
| chemistry | `states-of-matter` | 3 | choose_it, do_it, name_it |
| chemistry | `matter-explorer` | 3 | choose_it, do_it, name_it |
| chemistry | `gas-laws-simulator` | 3 | choose_it, name_it, say_number |
| chemistry | `ph-explorer` | 3 | choose_it, do_it |
| math | `dot-plot` | 6 | do_it |
| math | `skip-counting-runner` | 5 | order_it, say_number |
| math | `measurement-tools` | 4 | say_number |
| math | `percent-bar` | 4 | do_it, say_number |
| math | `shape-tracer` | 4 | do_it, order_it |
| math | `two-way-table` | 4 | say_number |
| math | `slope-triangle` | 3 | choose_it, do_it |
| math | `systems-equations-visualizer` | 3 | do_it, say_number |
| math | `shape-composer` | 1 | name_it |
| math | `equation-workspace` | 1 | choose_it |
| astronomy | `constellation-builder` | 4 | do_it, name_it, order_it |
| physics | `gravity-drop-tower` | 5 | do_it, order_it, say_number |
| core | `timeline-explorer` | 3 | do_it, order_it |

**Pull order — chemistry first, and the pilot is `periodic-table`.** Chemistry contributes 5
of the 18, is fully eval+tutor wired, has **zero** prior DI work, and sits in no other queue
([[feedback_worked-primitives-self-select]]). `periodic-table` is the cleanest shape in the
block: `choose_it` + `name_it` only, no gesture, no number words — one template, two classes.

**After the `periodic-table` pilot is exercised at runtime** (not type-checked — pilot-then-
sweep, July retrospective antipattern #2), the other four chemistry entries reuse its
template. Then math, which is the volume.

### B2 — 21 primitives gated on `open_set_word`

`light-shadow-lab`, `planetary-explorer`, `cell-builder`, `mixing-and-dissolving`,
`molecule-constructor`, `molecule-viewer`, `reaction-lab`, `deep-dive`, `how-it-works`,
`flight-forces-explorer`, `hydraulics-lab`, `propulsion-lab`, `vehicle-comparison-lab`,
`evidence-finder`, `opinion-builder`, `array-grid`, `comparison-builder`, `function-machine`,
`number-tracer`, `transformation-lab`, `sound-wave-explorer`.

These have ≥1 `explain_it` mode. **They are not fully blocked** — their other modes are
portable — but porting them piecemeal creates the letter-spotter hybrid the DI doctrine
strikes at (some modes spoken, one tapping). **Wait for di item 24**, then port whole.

### B3 — the 135 unclassified modes

Resolve per primitive as it is pulled. **Do not run a separate classification sweep** — the
read happens anyway during `/add-di-loop` phase 0, so a standalone pass is duplicated work.

---

## Execution discipline (binding)

1. **Pilot-then-sweep.** Never roll a pattern across a cluster until the pilot has been
   exercised **at runtime**, not type-checked. This is antipattern #2 in the July
   retrospective.
2. **Serial by default.** Fan-out is opt-in per user ruling. One primitive at a time unless
   the user asks for parallel.
3. **Contract-first.** `/primitive-contract <id> --check` before editing any primitive that
   has a contract. Fork on conflict; never edit in place over one.
4. **Verification doctrine.** `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc
   --noEmit` (project-local binary, absolute path) + `npm run typecheck:lumina` → 0 + a
   runtime drive. A type check is never verification of behavior.
5. **Close in the same slice.** Whoever finishes an item strikes it here AND updates
   `WORKSTREAMS.md`.
6. **Demand over convenience.** Pick within a wave by demand
   ([[feedback_worked-primitives-self-select]]), not by what is cheapest. Measured
   2026-08-16: 30 primitives sit in ZERO queue, 37 in four or more. Check a roster against
   the zero-queue list before ordering it.

---

## Done

*(nothing yet — opened 2026-08-18)*
