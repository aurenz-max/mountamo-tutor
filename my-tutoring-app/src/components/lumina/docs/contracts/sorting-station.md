# Contract: sorting-station

- **Derived:** 2026-07-15 · evidence window: K topic-trace census 2026-07-14 + QA reports through 2026-07-15 + git history to 2026-03
- **Component:** `primitives/visual-primitives/math/SortingStation.tsx` · **Generator:** `service/math/gemini-sorting-station.ts` · **Catalog:** `service/manifest/catalog/math.ts:2988`
- **Status:** ACTIVE (no open conflicts; 3 resolved on record; 4 gap requirements OPEN, G3 LANDED 2026-07-21)
- 2026-07-15 (later same day): the PRE presentation layer (R4–R7) LANDED — reader-fit 1e
  committed in `7cb5e5f`, jsdom 6/6 + live `--lesson` 3/3
  (`qa/reader-fit/sorting-station-PRE-2026-07-15.md`). The former in-flight caveat is
  resolved; residual is pixel-look only (HUMAN-CHECKS #12).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE band — picture-primary sorting | census 4/6 + reader-fit | `qa/reader-fit/BACKLOG.md` 1e; HANDOFF-PRE-2026-07-15 | 2026-07-15 |
| Grade 1+ (reader) — full-chrome modes | catalog + component G1 branch | catalog mode descriptions (Grade 1+ ONLY ×4) | 2026-07-14 |
| 2D-shapes / geometry topics | census trace | `qa/topic-traces/k-2d-shapes-2026-07-14.md` | 2026-07-14 |
| Needs-vs-wants (semantic classification) | census ×2 draws | `qa/topic-traces/k-needs-vs-wants-2026-07-14.md` | 2026-07-14 |
| Community-helpers / roles | census trace | `qa/topic-traces/k-community-helpers-2026-07-14.md` | 2026-07-14 |
| Compare-groups-≤5 (count_compare) | census trace | `qa/topic-traces/k-compare-groups-to-5-2026-07-14.md` | 2026-07-14 |
| Support-tier / structural-difficulty engine | git + generator | commit 1c3e774; `resolveProblemShape`/`resolveSupportStructure` | 2026-06-14 |
| Eval-test / IRT calibration (6 modes) | EVAL_TRACKER | 6/6 pass row (2026-06-14); SS-1..SS-4 fix rows | 2026-06-14 |

## Requirements

### R1 — taught-rule stability · OBSERVED
- **Property:** the objective's classification rule stays THE sort axis across all challenges in a session; variety comes from different on-objective objects, never from switching to color/size/shape (those are distractor features unless the objective teaches them).
- **EXEMPTION:** `sort_variety` (challengeType `sort-variety`, added 2026-07-21 per G3) is the ONE mode where rule-rotation is the DECLARED task — it intentionally switches `sortingAttribute` each round on a shared object set. R1 stands for every other mode. The probe below is scoped `evalMode !== 'sort_variety'`.
- **Demanded by:** shapes, needs-vs-wants, community-helpers families (all three were broken by the same drift).
- **Evidence:** `qa/topic-fidelity/sorting-station-2026-07-14.md` (FIDELITY BUG → fixed); 3/4 census traces showed the drift (shapes→color/size, needs→color, helpers→color).
- **Probe:** (modes OTHER than `sort_variety`) eval-test route, topic "Match 2D shapes" + intent "sort by shape category" ×3 → `sortingAttribute` = shape every challenge; topic "Needs vs Wants" → `category` every challenge; no cross-challenge axis switch. For `sort_variety` the probe INVERTS: `sortingAttribute` must DIFFER across rounds while the object set stays constant (see G3).

### R2 — intent binding · OBSERVED
- **Property:** `ctx.intent` (fallback topic) is consumed as the specific objective via `buildSortingObjectiveSection`; changing intent under a fixed broad topic changes the sort rule.
- **Demanded by:** every topic family; topic-fidelity contract (193/193 sweep).
- **Evidence:** topic-fidelity report intent-discrimination rows ("gear by helper owner" → category ×4).
- **Probe:** fixed broad topic, vary intent ×2 → sort rule tracks intent, not topic prose.

### R3 — K band floor on modes · OBSERVED
- **Property:** at Kindergarten only `sort_one` and `odd_one_out` route (picture-primary tap tasks); `sort_attribute`, `count_compare`, `two_attributes`, `tally_record` are Grade 1+ (reading / numeric entry / metacognitive choice). K quantity-comparison routes to comparison-builder.
- **Demanded by:** PRE band; comparison-builder's own contract (routing boundary).
- **Evidence:** catalog constraints (math.ts:2991) + per-mode "Grade 1+ ONLY (never Kindergarten…)" descriptions.
- **Probe:** manifest + eval-mode resolver at a K objective never pins a Grade-1+ mode; generator with `gradeBand: 'K'` never emits those challenge types.

### R4 — PRE picture-primary presentation · OBSERVED (live 3/3, committed 7cb5e5f)
- **Property:** at K, bins render `bucketEmoji` (LLM `categoryEmojis`, never reusing an object's own emoji; fallback color-coded circle) with the word as small caption; objects emoji-primary and enlarged; adult chrome hidden (progress badges, count badges, instruction panel, quantitative feedback prose, grade badge, empty-bin prompts). Grade 1 keeps full chrome — the gate is `gradeBand === 'K'`, nothing leaks across.
- **Demanded by:** PRE band. **Grade 1+ demands the inverse** (full chrome) — see C2.
- **Evidence:** uncommitted diffs (generator `categoryEmojis`/`buildEmojiByValue`; component `isK` gate + `FALLBACK_BIN_EMOJI`); HANDOFF expected-findings 1/3/6.
- **Probe:** reader-fit Audits A–C at PRE (jsdom render, `gradeBand:'K'` vs `'1'`); bucketEmoji present on every bin; no load-bearing text at K.

### R5 — read-aloud STIMULUS beat · OBSERVED (live, committed 7cb5e5f)
- **Property:** the tutor voices the sort and names EVERY bin before interaction (ORIENT+STIMULUS+DISAMBIGUATE), overriding the lesson one-sentence cap; answer-free (never says which bin an object belongs in). Component must forward `instruction` and `categories` so `{{instruction}}`/`{{categories}}` resolve — a broken key renders SILENT.
- **Demanded by:** PRE band (a pre-reader cannot read the instruction panel R4 just hid).
- **Evidence:** catalog aiDirectives (math.ts:3064–3079, "SAY THE SORT OUT LOUD AND NAME EVERY BIN FIRST"); component `aiPrimitiveData.instruction` forwarding; STIMULUS-drop failure class (comparison-builder/word-sorter precedent).
- **Probe:** `/tutor-test sorting-station` — scaffold audit: all contextKeys resolve, no silent `{{…}}`.

### R6 — odd-one-out selection integrity · OBSERVED
- **Property:** a wrong odd-one-out answer clears the selection (no latched wrong state); at K, tap auto-submits exactly once per selection (ref-latched — re-renders cannot double-submit), and the latch resets with the challenge.
- **Demanded by:** eval-test (SS-4 incident) + PRE tap-=-choose rule.
- **Evidence:** EVAL_TRACKER SS-4 (2026-03-18, `setSelectedOddOne(null)`); uncommitted `autoCheckedOddRef` + reset effect ([[spoken-primitive-autoadvance-footguns]] pattern).
- **Probe:** drive `odd_one_out` with a wrong tap → selection clears, second tap re-judges; one submission per selection at K.

### R7 — Check retained for multi-item construction · OBSERVED
- **Property:** auto-submit applies ONLY to atomic single-tap tasks (odd-one-out @ K). Sort-family challenges are multi-part construction and keep the explicit Check even at K — decluttering must not remove the commit-your-work step.
- **Demanded by:** pedagogy (multi-part evaluation semantics); PRE declutter pressure is the counter-party — see C3 near-miss.
- **Evidence:** HANDOFF rule 2 exemption; component condition `!(isK && type === 'odd-one-out')`.
- **Probe:** K sort_one render still shows Check; K odd_one_out does not.

### R8 — grade-capped structure, structural difficulty · OBSERVED
- **Property:** object window K 4–6 / G1 5–8; bins K ≤3 / G1 ≤4. **Enforcement split (precision, 2026-07-15 baseline check):** the bin cap is a hard code clamp (`maxCategories`); the object window is **tier-conditioned prompt guidance** — `normalizeSupportTier` is a strict lookup, so a draw with no valid `config.difficulty` gets NO window prompt line and the LLM may undershoot the floor (observed: one untiered G1 draw at 4 objects). The demanding consumer always passes a tier, and tiered draws honor the window. Difficulty moves STRUCTURE — bin ramp 2→3→4, `compareGap` 3→1, `oddSharedAttrs` 0→2, near-miss ratio — never raw magnitude past the grade cap. Support tiers withdraw `showCounts` badges and the `showModelExample` worked item across easy→hard.
- **Demanded by:** support-tier/structural-difficulty engine (commit 1c3e774); PRE ≤~5-interactive-elements ceiling.
- **Evidence:** generator lines 112–118, 221–265, 1050; [[trust-intent-over-hardcoded-caps]] applies — these caps ARE band contracts, not arbitrary ceilings.
- **Probe:** generate at K easy vs G1 hard ×2 — counts inside windows; structural levers (not magnitudes) differ.

### R9 — mode purity under pinned targetEvalMode · OBSERVED
- **Property:** a pinned `config.targetEvalMode` yields ONLY that challenge type — per-mode sub-generators, never one omnibus prompt describing all types (the SS-1/SS-2 cross-contamination class).
- **Demanded by:** eval-test / IRT calibration (β anchors are per-mode).
- **Evidence:** EVAL_TRACKER struck row "sorting-station (sort_one)" cross-contamination → Fixed via orchestrator; 6/6 modes pass 2026-06-14.
- **Probe:** pin each mode ×2 → challenge types homogeneous.

### R10 — count_compare numeric scope tracks the topic · OBSERVED
- **Property:** quantity-comparison topics with an explicit bound keep group counts inside it (compare-groups-to-5 stayed ≤5).
- **Demanded by:** compare-groups topic family.
- **Evidence:** `k-compare-groups-to-5-2026-07-14.md` (the one clean census pass).
- **Probe:** topic-fidelity numeric battery on `count_compare` (honored ≤5 / discrimination ≤10 / no-regression).

## Conflicts

### C1 — content variety vs R1 rule stability — RESOLVED 2026-07-14 (generator fix, no fork needed)
The variety instinct ("keep challenges fresh") was satisfied by switching sort axes, which broke every semantic topic family. Ruling: variety through on-objective OBJECTS, never through the rule. This was the ablation that motivated this contract.

### C2 — PRE declutter vs Grade-1 full chrome — RESOLVED 2026-07-15 via fork rung 2 (band gate)
Both demands are right for their consumers. Resolved with the `isK` presentation gate — one component, two presentations, zero leakage. (In-flight, uncommitted.)

### C3 — PRE tap-simplicity vs multi-item evaluation semantics — RESOLVED 2026-07-15 via scoping (near-miss)
Blanket auto-submit at K would have ablated the sort family's commit-step pedagogy. Resolved by scoping auto-submit to atomic odd-one-out only (R7). Recorded because the tempting over-general edit is exactly what a future declutter pass would reach for.

## Gap requirements (close matches — the improvement queue)

Source: `curriculum_fit_probe.py --primitive sorting-station --domain math --grades K,1`
run 2026-07-15 — verdict MATCH at both grades. K cluster `PTRN001-02 Sorting by
Attributes` (5/5 coherent, best 0.683); G1 cluster `MEAS001-05/06 Organizing/
Interpreting Data` (4/5 coherent, best 0.673). Only the top match (single-attribute
sort, 0.683) is fully served today — the other close matches are gaps:

### G1 — explain the sort ("because…") · OPEN
- **Near-consumer:** K `PTRN001-02` "Explain complex sorting rules using 'because'" (probe 0.668).
- **Shortfall:** no production/justification mode — the student places objects but never articulates the rule. At K this must be SPOKEN (a pre-reader can't type a reason).
- **Path:** eval-mode split (`explain_sort`) → `/add-eval-modes` + `/add-spoken-judge` (clip-judge ladder; [[production-modality-roadmap]] — this is exactly the judge-driven student-production direction).
- **Relation to R-series:** none — additive.

### G2 — two-attribute sorting reachable at K · OPEN
- **Near-consumer:** K `PTRN001-02` "Sort objects by two attributes simultaneously" (probe 0.662).
- **Shortfall:** `two_attributes` exists but is floored to Grade 1+ **because the compound instruction is written**. The K curriculum demands the task; what exceeds a pre-reader is the medium, not the cognition.
- **Path:** band gate on the instruction channel — voiced compound instruction (aiDirectives STIMULUS beat, per R5) + pictorial criterion cues (bucketEmoji pairs), THEN a reader-fit re-audit of the mode at PRE. **Not** a simple unflooring — the floor stays until the audit passes.
- **Relation to R-series:** touches R3 (band floor). The floor is the protection; this gap is the sanctioned way to move it — re-audit, never delete.

### G3 — re-sort the same set by a different rule · LANDED 2026-07-21 (fork rung 1, per the recorded ruling)
- **Near-consumer:** K `PTRN001-02` "Sort the same set of objects using a different rule" (probe 0.653).
- **Shortfall (was):** flexible re-sorting is a taught concept, but R1 (taught-rule stability) deliberately forbids axis-switching across challenges — because switching was the 2026-07-14 drift bug.
- **Resolution:** new eval mode `sort_variety` (challengeType `sort-variety`, β 3.0, Grade 1+ floor), added via `/add-eval-modes`. Its sub-generator produces ONE shared object set (type/size/category required) and CODE derives 2-3 rounds, each sorting that set by a different axis that splits it into 2..binCap groups (LLM never owns the axis choice or bin count). R1's generator guard was NOT edited; instead a `buildVarietyObjectiveSection` INSTRUCTS the rotation only for this mode, and the R1 requirement now carries the `sort_variety` exemption + inverted probe. Renders via the existing `sort-by-one` interaction (component branches added). Runtime: eval-test 5/5 fully-valid (3 rounds, distinct rules, constant object set, bins ≤ cap); no regression on sort_one/sort_attribute/odd_one_out/tally_record.
- **Follow-ups:** (a) K voiced-rule variant (unfloor via reader-fit re-audit, mirroring G2 — NOT a simple floor removal); (b) extend the R1 exemption to the `/topic-fidelity` automated probe.
- **Relation to R-series:** pre-detected CONFLICT with R1 — resolved by fork rung 1. R1's guard untouched; exemption recorded in R1.

### G4 — student-created categories · OPEN
- **Near-consumer:** K `PTRN001-02` "Create and label sorting categories before given objects" (probe 0.636).
- **Shortfall:** categories are always generator-given; there is no "you decide the bins" mode.
- **Path:** eval-mode split (production modality); at K, category "labeling" would be spoken or emoji-picked. Larger lift — sequence after G1/G3 which build the mode plumbing it needs.
- **Relation to R-series:** none — additive.

### G5 — post-sort data interpretation · OPEN (needs a routing ruling first)
- **Near-consumer:** G1 `MEAS001-06` "After sorting objects into up to three categories, interpret data" (probe 0.673 — the TOP G1 match); sibling `MEAS001-05` organizing-data subskills (0.617–0.625).
- **Shortfall:** `tally_record` records counts and `count_compare` compares two groups, but nothing asks interpretation questions across ≥3 sorted groups (most/least/how-many-more).
- **Path:** FIRST a `/topic-fidelity`-style fit ruling: is this sorting-station's job (extend `tally_record` with an interpret phase) or a graphing primitive's (WRONG-PRIMITIVE, route there)? Only build here if the ruling says so.
- **Relation to R-series:** touches R8 (structure caps) if built — interpret questions must not push K element counts.

## Catalog projection

- **description:** faithful as of the 2026-07-14 rewrite (objective-relevant semantic classification leads; perceptual axes only when taught). No change.
- **constraints:** ~~**DIVERGENT — "Max 10 objects per challenge" is looser than enforced reality**~~ **APPLIED 2026-07-15** (`math.ts:2991`): the loose "Max 4 sorting categories. Max 10 objects per challenge." now reads the enforced band reality — "Objects per challenge: 4–6 at Kindergarten, 5–8 at Grade 1. Bins: max 3 at Kindergarten, max 4 at Grade 1." (Everything else in the constraints string — objective-rule-stability, perceptual-axis, BAND FLOOR — unchanged.)
- **evalModes:** per-mode Grade-1+ band notes are accurate and load-bearing for the resolver. No change.

## Changelog

- 2026-07-15 — derived (initial, pilot for `/primitive-contract`). 10 requirements, 3 conflicts (all RESOLVED), 1 catalog divergence flagged (constraints object-count). Evidence: K census 2026-07-14, topic-fidelity + reader-fit reports, EVAL_TRACKER SS-1..4, git to 2026-03.
- 2026-07-15 (later) — reader-fit 1e landed (`7cb5e5f`, live 3/3): R4/R5 caveat cleared; constraints projection unblocked. Added G-series from `curriculum_fit_probe` (MATCH @ K + G1): 5 gap requirements, incl. one pre-detected R1 conflict (G3, ruling recorded) and one band-floor pathway (G2, re-audit not unfloor).
- 2026-07-15 (rider, during phonics-blender derivation) — **constraints projection APPLIED** (`math.ts:2991`): "Max 4 sorting categories / Max 10 objects per challenge" → enforced band reality (K 4–6 objects/≤3 bins, G1 5–8/≤4 bins). tsc 0-new + `typecheck:lumina` clean. Projection bullet flipped to APPLIED.
- 2026-07-21 — **G3 LANDED**: added eval mode `sort_variety` (flexible re-sorting) via `/add-eval-modes` — the sanctioned fork rung 1 for the G3/R1 conflict. New challengeType `sort-variety` (renders as sort-by-one; component branches added), catalog mode (β 3.0, G1+ floor), backend prior, code-derived rotation (LLM supplies object window with required type/size/category; code picks the splittable axes + caps bins), R1 exemption + inverted probe recorded. Origin: user report that a single sorting station replays "the same comparison 5×" — variety-in-objects (my first read, SST-1) was the wrong axis; the real gap was variety-in-RULE, which R1/C1 route to a new mode, not an in-place edit. tsc 0-new; eval-test 5/5 valid; sort_one/sort_attribute/odd_one_out/tally_record no regression. Report: `qa/eval-reports/sorting-station-sort-variety-2026-07-21.md`.
- 2026-07-15 (baseline `--check`, first guard exercise) — **COMPATIBLE, 10/10 requirements hold at runtime**: 24 eval-test draws + jsdom 15/15 + scaffold probe (0 findings, bin-naming directive present) + live K topic-trace (resolver pinned `sort_one` @ K). R8 property amended for precision — object window is tier-conditioned prompt guidance, bin cap is the hard clamp (one untiered G1 draw undershot to 4 objects; no consumer-visible violation, no code change). Report: `qa/primitive-contracts/sorting-station-check-2026-07-15.md`.
