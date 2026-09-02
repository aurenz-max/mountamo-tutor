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
| engineering | 24 | 7 | 13 | **0** |
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

**104 primitives are DI-portable RIGHT NOW** — they carry eval modes and have no judged
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

### A. 🔝 **L1 — the 38 that declare themselves evaluable and have no eval-mode ladder.** Executor: `/add-eval-modes` — ✅ **curriculum-fit gate CLEARED 2026-08-21**

These carry `supportsEvaluation: true` and **no `evalModes`**. The adaptive engine cannot
discriminate difficulty on any of them, and none can take a DI port until this lands.

- **engineering (15):** airfoil-lab, blueprint-canvas, bridge-builder,
  engine-explorer, excavator-arm-simulator, foundation-builder, gear-train-builder,
  lever-lab, paper-airplane-designer, propulsion-timeline, pulley-system-builder,
  shape-strength-tester, tower-stacker, vehicle-design-studio, wheel-axle-explorer
- **biology (12):** adaptation-investigator, bio-compare-contrast, bio-process-animator,
  classification-sorter, dna-explorer, energy-cycle-engine, evolution-timeline,
  food-web-builder, inheritance-lab, life-cycle-sequencer, microscope-viewer,
  protein-folder
- **astronomy (6):** mission-planner, moon-phases-lab, orbit-mechanics-lab, rocket-builder,
  scale-comparator, telescope-simulator
- **physics (1):** motion-diagram
- **core (3):** comparison-panel, fast-fact, feature-exhibit · **media (1):** image-panel
  — ✅ **USER RULING 2026-08-21: ladder these anyway.** They are not gateable by
  `/curriculum-fit` (core/media have no curriculum subject, so retrieval declines by
  design) and the treadmill risk was raised and overruled. **Do not re-probe them and do
  not re-open the question** — write the ladders from the catalog `constraints`, as task
  identities. They stay in queue A; they are simply ungated.

✅ **The `/curriculum-fit` gate is CLOSED — run 2026-08-21, all 36 probeable primitives
MATCH.** Report + per-grade top-5 JSON:
`qa/curriculum-fit/_sweep-coverage-queueA-2026-08-21.md`. **`/add-eval-modes` is
unblocked; read the anchor tables in that report before writing a ladder.** Three things
it changed:

- **41 → 40.** `habitat-diorama` gained `evalModes` with its DI port (#116); biology is 12.
- **40 → 38.** `dump-truck-loader` and `ramp-lab` gained focused ladders on 2026-08-21;
  engineering is 15.
- **The 4 core/media entries are NOT gateable** — their domains have no curriculum subject
  (`_DOMAIN_TO_SUBJECT` omits core/media/assessment/calendar), so retrieval declines by
  design. They declare `supportsEvaluation: true` so they are not §C either. **Ruling collected 08-21: ladder
  them (see the roster above).**
- ⚠️ **Never anchor a queue-A ladder at Grade 4.** G4 `SCI001-04 "Electric Circuits"` is a
  semantic attractor — **17 of 37 primitives rank it top-1 there and 6 clear MATCH**,
  because its subskills are written in generic systems language (*"identify the
  components… describe the role of each part"*, *"trace the transformation of energy into…
  motion"*). Sole legitimate G4 home is `evolution-timeline` → SCI004-06. The curriculum
  side of this is a `/curriculum-author` item, not a campaign item.
- **SCIENCE publishes K,1,2,3,4 — no G5.** Every science ladder is bounded K–4.

✅ **PILOT SHIPPED 2026-08-21 — `dump-truck-loader`** @ G1 `SCI005-02 Construction
Machines` (0.873, 5/5). 3 rungs `load` / `predict` / `plan_trips`, a 12-job code-owned
pool, catalog + backend β. Gates: `typecheck:lumina` 0 · 17/17 contract tests · **live
Gemini drive on all three paths incl. unpinned intent resolution**. Owes a browser check.
Report: `qa/eval-reports/dump-truck-loader-evalmodes-2026-08-21.md`.

✅ **`ramp-lab` SHIPPED 2026-08-21 — the first sandbox-to-assessment conversion.** Three
task identities (`compare_conditions` / `find_threshold` / `design_with_budget`), a
12-challenge code-owned physics pool, hidden-before-check force evidence, evaluation
submission, catalog + backend β. Gates: `typecheck:lumina` 0 · 7/7 contract tests · live
pinned/mixed/unpinned drives. Owes browser check #120. Report:
`qa/eval-reports/ramp-lab-2026-08-21.md`.

⚠️⚠️ **THE FINDING THAT RE-ORDERS THIS SECTION: much of the engineering block has nothing to
evaluate.** `ramp-lab` was the curriculum-fit pilot pick and originally had **1172 lines
with zero occurrences of challenge / answer / correct / submit**. Curriculum-fit measures
whether a *home* exists; it is silent on whether the primitive has an *assessable moment*.
**Triage before pulling any engineering entry:**

- **Ready to ladder (5):** ✅ `dump-truck-loader` · `paper-airplane-designer` ·
  `engine-explorer` · `vehicle-design-studio` · `airfoil-lab`
- **Solve surface, no challenge structure (6):** `bridge-builder`, `tower-stacker`,
  `shape-strength-tester`, `blueprint-canvas`, `excavator-arm-simulator`,
  `foundation-builder` — a ladder here needs a challenge structure authored with it.
- **⛔ Pure sandbox (5) — challenge surface FIRST:** `lever-lab`, `wheel-axle-explorer`,
  `pulley-system-builder`, `gear-train-builder`,
  `propulsion-timeline`. `/add-eval-modes` alone buys these a log line and nothing a
  student can see. **Do not pull one off the top expecting a 15-line slice.**

**➡️ Next: `paper-airplane-designer` or `engine-explorer`** (both ready, both queue A).
`dump-truck-loader`'s Fork A shape — code-owned pool tagged by task identity + a
mode-aware selector + a `selectMixed*` rotation — is the template for any primitive whose
correctness is arithmetic. Run the same assessability check on the biology 12 and
astronomy 6 before scoping them.

✅⭐ **BIOLOGY + ASTRONOMY ASSESSABILITY TRIAGE — RUN `/pm` 2026-08-23, as this section demanded.**
Probe (not grep-for-words — the ramp-lab lesson): does the component import `usePrimitiveEvaluation`
+ `onEvaluationSubmit`, **and** does it compute a correctness verdict? **The result inverts the
engineering picture: almost everything here is already wired to the evaluation pipeline.** 18 of 21
import the hook. The discriminator is whether a KEY exists.

**✅ TIER 1 — pipeline wired AND a correctness key exists. These need the LADDER ONLY** (≈ the
`dump-truck-loader` slice, minus building a solve surface). Correctness sites in the Key column:

| Primitive | Home (cos, votes) | Key | Note |
|---|---|---:|---|
| `adaptation-investigator` | G1 SCI002-03 Structures for Survival (0.851, 5/5) | 12 | ⭐ leak-free; matches ALL grades → task identities |
| `food-web-builder` | G3 SCI003-01 Food Chains (0.849, 5/5) | 9 | ⭐ leak-free; `isCorrectConnection` already written |
| `inheritance-lab` | G1 SCI002-06 Parent-Offspring Traits (0.794, 5/5) | 4 | ⭐ leak-free; thinner key |
| `microscope-viewer` | G1 SCI002-10 (0.752, 5/5 soft) | 11 | ladder classification-from-structure; the scope is the medium |
| `protein-folder` | G3 SCI002-04 (0.736, 5/5 **soft**) | 8 | ladder the observable, never "protein structure" |
| `classification-sorter` | G1 SCI002-10 (**0.876** — top score) | 21 | ⛔ **CS-1 leak open — fix first** |
| `life-cycle-sequencer` | G3 SCI002-01 (0.836, 5/5) | 14 | ⛔ **LCS-1 open** |
| `dna-explorer` | G3 SCI002-04 (0.724, 4/5 soft) | 16 | ⛔ **DNA-1/DNA-2 open** |
| `feature-exhibit` | core — ungated by design | 29 | user-ruled 08-21: ladder anyway |
| `image-panel` | media — ungated by design | 2 | weakest key of the tier |

**⚠️ TIER 2 — pipeline wired, NO correctness key (8).** Same bucket as engineering's "solve surface,
no challenge structure": a ladder here needs a challenge structure authored WITH it, so scope these
like the `ramp-lab` conversion, not like `dump-truck-loader`. `energy-cycle-engine` ·
`evolution-timeline` · `motion-diagram` · `mission-planner` · `moon-phases-lab` ·
`orbit-mechanics-lab` · `rocket-builder` · `telescope-simulator`.

**⛔ TIER 3 — NOTHING wired; do not ladder, DECLARE (2).** `scale-comparator` (804 lines, zero hook,
zero submit, zero key) and `comparison-panel` (106 lines, same). **Drop `supportsEvaluation` so the
manifest stops routing assessment at them.** ⚠️ `scale-comparator` is ALSO reader-fit item 17's #3 —
both queues now reach the same verdict, so close it once, in whichever lane pulls first.

⭐ **THE CHEAPEST WIN IN THE WHOLE 38 IS NOT IN THIS TRIAGE: `fast-fact`.** It is the one entry that
is already fully challenge-structured (66 `challenges`/`challengeType` sites, 8-12 challenges over
2-3 phases) and simply has no `evalModes` — **`EVAL_TRACKER.md` has carried FF-4 for exactly this.**
It scores itself rather than using `usePrimitiveEvaluation`, so the slice is the ladder plus a hook
decision, and nothing has to be designed first.

⭐⭐ **THE SHARPEST SUB-FINDING — `/pm` 2026-08-23, probing what Tier 1 actually GRADES: three of
them already carry a PHASE ENUM that IS an undeclared eval-mode ladder.** The task identities are
written, graded and shipping; they were simply never exposed as `evalModes`. This is the inverse of
periodic-table's eval-mode FICTION — there the modes were declared and not real; here they are real
and not declared. **It makes these a CLUSTER on one template, not three bespoke jobs.**

| Primitive | Phase enum in code | Graded moment |
|---|---|---|
| `adaptation-investigator` | `'explore' \| 'practice' \| 'apply'` (:115) | `apply` = What-If scenarios, `answer === adaptationStillUseful` |
| `feature-exhibit` | explore / practice / synthesis | `exploreCorrectAnswer`, `evidenceClaims[i].correctSectionIndex`, `synthesisCorrectId` — **three separate keys** |
| `protein-folder` | `'explore' \| 'fold' \| 'mutate'` (:110) | `foldingResults` per-fold `student === correct`, then mutate |

**The slice shape: expose each phase as a task identity, set βs, pin the mode in the generator.** No
solve surface to build and no content to design — the cheapest rungs in queue A after `fast-fact`.

**The other two leak-free Tier 1 have NO phase machine** and are single-identity, so they are ordinary
`/add-eval-modes` slices: `food-web-builder` (clean structural grader — `isCorrectConnection` +
`evaluateWeb().isComplete`) and `inheritance-lab` (Punnett cell-grid, `cellResults[key]`, thinnest).

⚠️ **`microscope-viewer` is NOT a clean handoff despite its 11 key sites.** It grades a FREE-TEXT
label by exact string equality — `studentLabel.trim().toLowerCase() === structure.name.toLowerCase()`
(:246). A child who types "membrane" for "cell membrane" is marked wrong, and the reveal prints the
answer. **Fix or narrow the grading before laddering** — either a closed-set label menu or the judge
([[feedback_schema-over-regex-and-prompt]]). Filed here rather than as its own row because it is
discovered-with and fixed-with the ladder.

⚠️ **PARALLEL-HANDOFF COLLISIONS — catalog files are shared.** `fast-fact` (`core.ts:347`) and
`feature-exhibit` (`core.ts:233`) are in the SAME file; the five biology entries are all in
`biology.ts:460-530`. **Hand off at most one per catalog file at a time**, or expect the merge.

**➡ PULL ORDER OUT OF THIS TRIAGE:** `fast-fact` → `adaptation-investigator` → `food-web-builder`
→ `inheritance-lab`. Then the leak four (`/eval-fix` first), then Tier 2 as conversions.

⚠️ **Six SOFT homes need the ladder written against the observable, not the primitive's
concept** — `protein-folder`, `dna-explorer`, `microscope-viewer`, `rocket-builder`,
`propulsion-timeline`, `energy-cycle-engine`. Per-primitive guidance is in the report's
diagnosis table. **Five are content-agnostic shells** (`adaptation-investigator`,
`bio-compare-contrast`, `food-web-builder`, `blueprint-canvas`, `bio-process-animator`)
that match at 4-5 grades — ladder them as task identities, never grade bands.

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
| engineering | 7 | the 7 that already have eval modes |
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

✅ **PILOT DONE + TWO SHIPPED (`/pm` 2026-08-22).** `periodic-table` shipped 2026-08-19 (mic
#115) and `states-of-matter` shipped 2026-08-20 (mic #117, all three modes spoken) — both
runtime-driven, not type-checked. **➡ The remaining chemistry three are the next pulls and they
reuse the pilot template: `matter-explorer` · `gas-laws-simulator` · `ph-explorer`.** Then math.
`habitat-diorama` (biology) also shipped 2026-08-21 off-roster on a user pull — di item 25.

**Pull order — chemistry first, and the pilot was `periodic-table`.** Chemistry contributes 5
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
strikes at (some modes spoken, one tapping). ~~**Wait for di item 24**, then port whole.~~

✅⚠ **THE GATE IS GONE — corrected by `/pm` 2026-08-22. `open_set_word` was BENCHED and di item
24 CLOSED on 2026-08-19** (`qa/di-bench/run-2026-08-19-open-set-word.md`; the rhyme-studio pilot
shipped with it, and `judgedScriptContract.ts` has no `blocked` class left). **These 21 have been
portable for three days and this line was still telling readers to wait** — the stale-doctrine
shape WORKSTREAMS names. Port whole, as originally intended; nothing is deferred.

⚠ **One real precondition remains, and it is the INSTRUMENT, not the class: di item 27.** Three
`--di-bench` defects corrupt open-set evidence — I2 silently overwrites a bench report with a later
plain drive, I1 scores every correctly-fired specific correction branch as embellishment, I3 prints
rhyme vocabulary into non-rhyme benches. **Fix item 27 before the next open-set bench**, then pull
from this list freely.

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

- **2026-08-21 — §A `/curriculum-fit` gate.** All 36 probeable queue-A primitives MATCH
  against the live retrieval path; no curriculum gap, no thin-description finding, no
  scoping failure. Roster corrected 41→40. `/add-eval-modes` unblocked.
  `qa/curriculum-fit/_sweep-coverage-queueA-2026-08-21.{md,json}`.
- **2026-08-21 — §A pilot `dump-truck-loader` L0→L1.** 3 rungs, 12-job code-owned pool,
  catalog + backend β, 17 contract tests, live Gemini drive on all three resolution paths.
  Produced the assessability triage above — the more valuable half of the slice.
  `qa/eval-reports/dump-truck-loader-evalmodes-2026-08-21.md`. **Owes a browser check.**
