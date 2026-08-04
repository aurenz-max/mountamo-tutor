# Primitive Contracts — Derivation Queue

Seeded 2026-07-15 from the K topic-trace census tallies (`qa/reader-fit/BACKLOG.md`)
plus catalog traffic claims. Top = next. Executor: `/primitive-contract <id>`.
Priority = observed routing frequency × recent ablation history (a primitive that
already suffered a cross-consumer break outranks a merely busy one).

## Queue

### 3. foundation-explorer
4/6 census routing; head of the reader-fit explainer tail (BACKLOG #9) — derive the
contract BEFORE that fix pass so the shared-PRE-pattern extraction doesn't ablate
non-K consumers.

### 4. concept-card-grid
3/6 census routing.

## Systemic items

- **BigQuery attempts ETL omits `primitive_type`** (`bigquery_etl.py` ~688) — blocks a
  warehouse-grade usage channel. Enhancement, not blocker; fix when analytics work is
  next open anyway.
- **Executor-skill cross-references** — once ≥3 contracts exist, sweep the fix skills'
  SKILL.md files (`/eval-fix`, `/topic-fidelity`, `/reader-fit`, `/add-*`) to add a
  "read the contract first" phase-0 line. Until then the CLAUDE.md rule covers all
  sessions.

## Done

- **number-line — derived 2026-08-03** → `docs/contracts/number-line.md`. Pulled out of queue
  order as the mandatory contract-first step of reader-fit **14m** (systemic grade-resolver
  pilot). **12 requirements** (10 OBSERVED, 2 INFERRED), **1 OPEN conflict** (C1: authored G1
  ≤120 magnitude demand vs the K-2 ≤30 legibility clamp → status CONFLICTED; resolution owned by
  reader-fit 14k, fork required). Decisive census fact: **all 8 authored consumers are Grade 1**
  (OPS001-03-a/-04-a, NBT001-01-a/-b/-04-b/-05-d/-07-b, PTRN001-05-b) — no authored K or 3-5
  consumer exists; 3-5 demand is catalog+synthetic only. Code-map finding: every production
  grade-context prose sentence matched the old K-2 substring test, so the 3-5 band was
  UNREACHABLE in production until the same-slice R2 fix. `--check` on the finished edit:
  **COMPATIBLE** (`qa/primitive-contracts/number-line-check-2026-08-03.md`) — R1/R3-R9 probed
  live, 14k replay measured (stays open, mechanism pinned into C1). Channel [4] again
  `Not authenticated` (third consecutive run; still worth fixing before a contract run that
  needs item history). Report: `qa/reader-fit/number-line-14m-2026-08-03.md`.
- **knowledge-check — derived 2026-08-02** → `docs/contracts/knowledge-check.md`. Pulled as the
  mandatory contract-first step of reader-fit **14f**. **9 requirements**, **2 conflicts resolved**
  up front (K picture primacy vs Grade-1 independent reading → precise-grade + visual-task gate;
  mixed diversity vs visual evidence → per-problem gate), **3 gaps**: G1 precise Grade-1 reading
  load and G2 schema-backed visual support are the 14f implementation; G3 true/false PRE parity
  remains separately queued. Derived from the saved six-topic Grade-1 census (knowledge-check
  **6/42, every lesson**), PRE reader-fit/live-tutor reports, KC-1/KC-2, oracle/component paths,
  and git history. Post-edit live channels added three eval-test probes and both failing Grade-1
  topic replays; `knowledge-check-check-2026-08-02.md` records **COMPATIBLE**. Catalog projection
  report-only; no routing prose changed.

- **coin-counter — derived 2026-07-25 (`--census`)** → `docs/contracts/coin-counter.md`. Pulled out
  of queue order as the contract-first step of reader-fit **Task 3** (K `count-like` enacted count).
  **10 requirements**, **1 conflict RESOLVED in the same run** (C1: K count-like enacted vs G2
  count-mixed typed → fork rung 1 eval-mode split + rung 2 band gate, via a generator-stamped
  `countMode`), **6 gaps**. `--check` on the finished edit: **COMPATIBLE**
  (`qa/primitive-contracts/coin-counter-check-2026-07-25.md`) — probes re-run for every OBSERVED
  requirement of a consumer other than the edit's own, plus `git diff` showing **0 deletions**.
  **What the census changed:** the primitive has **7** eval modes (not 6 — `fewest-coins` too), and
  its only authored consumer is **`MEAS001-07-c` @ GRADE 1**, not K — there is no K money subskill
  in the curriculum at all (`PRIMITIVE_GAPS.md` GAP-007's "MATHEMATICS (K)" label is stale; the K
  `MEAS001-07-A…F` sharing that ID stem is "Time Durations"). Channel [4] (calibration) was
  **unavailable** — `/api/calibration/items` returns `Not authenticated`, so real-usage counts are
  unknown rather than zero; worth fixing before the next contract run that needs item history.
  Highest-value gap: **G1** — the Grade-1 `count-like` consumer still has the proxy this task fixed
  at K. Report: `qa/reader-fit/coin-counter-task3-2026-07-25.md`.
- **counting-board — derived 2026-07-20** → `docs/contracts/counting-board.md`. Pulled out of queue
  order as the contract-first step of reader-fit BACKLOG **#13** (K `subitize` flash-then-hide display
  fork). **8 requirements** (7 OBSERVED, R4 REQUIRED — the item-13 K subitize flash lifecycle), **0
  open conflicts** (item 13 is COMPATIBLE / fork-by-band+mode — changes only R4's K subitize display),
  **2 gaps**: G1 `count_on` @ EMERGING (same visible-scene defect one band up — deferred to the
  EMERGING re-audit, NOT pre-ruled), G2 `subitize_perceptual` flash @ Pre-K (catalog promises "Flash
  1–3 objects" but the component shows them persistently — reuse the K flash lifecycle). Static
  derivation (no live census — the 07-16 sibling census is declared complete). Strongest evidence =
  the counting-board oracle (answer-key-desync/scope/reachability rules) + eval report + topic-fidelity
  2026-06-27. Catalog projection: faithful, no change. Report: `qa/reader-fit/counting-board-item13-2026-07-20.md`.
- **media-player — derived 2026-07-16 (3rd contract; first with an OPEN conflict)** →
  `docs/contracts/media-player.md`. Pulled OUT of queue order as Step 1 of reader-fit BACKLOG
  **#9a** (user-pivoted REIMAGINING — contract-first mandatory). **8 requirements** (7 OBSERVED;
  R8 grade-banding INFERRED-fragile: `inferGradeLevel(ctx.gradeContext)` prose parsing, G1/G2
  indistinguishable, no `gradeLevel` stamped), **3 standing defects carried live** (MP-1 title
  echo CRITICAL / MP-2 CTA below fold / MP-3 no evalModes — all still in code), **1 OPEN conflict**
  (C1: K/PRE + G1 EMERGING demand vs grades-3+ text-MCQ presentation — resolution pre-ruled by the
  user 2026-07-16: band-by-band reimagining, fork not edit → contract status **CONFLICTED**),
  **5 gaps**: G1 PRE band (census-routed K), **G2 EMERGING — LA007-01-a/LA007-06-a are authored to
  the PHANTOM `listen-and-respond` (no such primitive exists) = unserved Grade-1 listening demand**,
  G3 ESTABLISHED (curriculum-fit **MATCH 0.774**, LA003 recount family), G4 eval-mode existence
  (SP-13), G5 boundary ruling (production→read-aloud-studio, decoding→decodable-reader,
  text-reading→interactive-passage). Catalog projection flagged NOT applied (description's
  "voiceover"/"play" fiction — audio is Gemini Live auto-narration; "grades 3+" contradicted by
  every observed consumer). Fresh evidence: 9-lesson manifest census 2026-07-16
  (`qa/topic-traces/media-player-census-2026-07-16.md`: K 1/6, authored-G1 2/2, G3 0/1),
  curriculum-fit probe K/1/2, authored map inversion (SS001-05-c, SS004-05-c), Firestore
  `item_calibration` (1 doc, 2 obs, β 2.9).
- **BASELINE `--check` ×2 — 2026-07-15 (first guard exercise)** → both **COMPATIBLE**, 20/20
  requirements hold at runtime. sorting-station: 24 eval-test draws + jsdom 15/15 + scaffold probe
  + live K topic-trace (resolver pinned `sort_one` @ K); R8 amended for precision (object window =
  tier-conditioned prompt guidance, bin cap = the hard clamp; one untiered G1 draw undershot — no
  consumer-visible violation). phonics-blender: 13 draws (grade ladder exact, purity 8/8,
  concat+emoji 63/63) + jsdom 7/7 + scaffold probe; R2 live-tap caveat stays QUEUED. Reports:
  `sorting-station-check-2026-07-15.md`, `phonics-blender-check-2026-07-15.md`. Tree carried the
  reader-fit #9 lane (foundation-explorer + shared PreReaderSelfCheck) — contracted files
  untouched, baseline valid.
- **phonics-blender — derived 2026-07-15 (2nd contract)** → `docs/contracts/phonics-blender.md`.
  **10 requirements** (all OBSERVED; R2 carries a queued live-tap caveat, R6 a prompt-vs-code
  note), **2 conflicts** (both RESOLVED via the same band-gate + scoping forks as sorting-station
  C2/C3 — the structural parallel is deliberate), **4 gap requirements** from the
  `curriculum_fit_probe` run (subject `LANGUAGE_ARTS`; K/G1 **ABSTAIN-diffuse** best-cosine
  0.813/0.809, G2 **MATCH** 0.830): G1 CVC-segmentation, G2 onset-rime, **G3 vowel-teams
  (strongest — the G2 curriculum subskill names phonics-blender in its authored constraint;
  no vowel_team eval mode exists → `/add-eval-modes`)**, G4 decode↔encode boundary ruling
  (encoding = cvc-speller, don't build here). **2 catalog divergences flagged** (description says
  "TTS" but audio is Gemini Live; "AI-generated word images" is really one emoji/word) —
  projection **NOT applied** (derive-only). **1 queued follow-up:** `[PRONOUNCE_SOUND]` tag vs
  the catalog `[PRONOUNCE]` directive trigger — jsdom-verified emit, runtime tap-pronunciation
  unverified → queued to reader-fit BACKLOG (executor `/tutor-test`). Evidence: curriculum-fit
  probe 2026-07-15, reader-fit PRE + live 3/3, grade-fidelity close-out (clampGradeToK2),
  EVAL_TRACKER RF-1/RF-2 + PB2 + SP-7, git to 2026-03. Rider taken: sorting-station catalog
  constraints projection **APPLIED** (`math.ts:2991`, tsc 0-new + typecheck:lumina clean).
- **sorting-station — PILOT derived 2026-07-15** → `docs/contracts/sorting-station.md`.
  10 requirements (8 verified-live, 2 in-flight with the delegated reader-fit 1e lane),
  3 resolved conflicts recorded (variety-vs-fidelity, PRE-vs-G1 chrome via band gate,
  auto-submit near-miss), 1 catalog divergence flagged ("Max 10 objects" looser than
  the enforced K 4–6/≤3-bin, G1 5–8/≤4-bin reality — projection HELD until 1e lands,
  math.ts is uncommitted in that lane). Derived from static evidence (census 07-14,
  QA reports, EVAL_TRACKER, git); first live `--census` refresh due when the K queue
  drains and the grade-1 census runs (WORKSTREAMS reader-fit milestone).
