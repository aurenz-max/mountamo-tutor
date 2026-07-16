# Primitive Contracts — Derivation Queue

Seeded 2026-07-15 from the K topic-trace census tallies (`qa/reader-fit/BACKLOG.md`)
plus catalog traffic claims. Top = next. Executor: `/primitive-contract <id>`.
Priority = observed routing frequency × recent ablation history (a primitive that
already suffered a cross-consumer break outranks a merely busy one).

## Queue

### 2. knowledge-check
"Closes EVERY K lesson the manifest builds" (K census top finding). Largest blast
radius in the portfolio; picture_mcq @ PRE + K type-floor are already de facto
requirements with no contract doc. true_false @ PRE is queued work that MUST go
through `--check` when it lands.

### 3. foundation-explorer
4/6 census routing; head of the reader-fit explainer tail (BACKLOG #9) — derive the
contract BEFORE that fix pass so the shared-PRE-pattern extraction doesn't ablate
non-K consumers.

### 4. concept-card-grid
3/6 census routing.

### 5. number-line
Catalog calls it "ESSENTIAL for K-5 math"; 5 eval modes across K-5 = widest
band spread of any math primitive; multiple historical fidelity fixes
(resolveTopicNumberRange is the Tier-2 reference implementation).

## Systemic items

- **BigQuery attempts ETL omits `primitive_type`** (`bigquery_etl.py` ~688) — blocks a
  warehouse-grade usage channel. Enhancement, not blocker; fix when analytics work is
  next open anyway.
- **Executor-skill cross-references** — once ≥3 contracts exist, sweep the fix skills'
  SKILL.md files (`/eval-fix`, `/topic-fidelity`, `/reader-fit`, `/add-*`) to add a
  "read the contract first" phase-0 line. Until then the CLAUDE.md rule covers all
  sessions.

## Done

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
