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

### 6. phonics-blender
2/6 census routing + member of the clampGradeToK2 fix cohort (2026-07-15) — that
fix is exactly a contract requirement ("grades 1-2 must NOT get pinned-K content")
currently recorded nowhere a future editor will look.

## Systemic items

- **BigQuery attempts ETL omits `primitive_type`** (`bigquery_etl.py` ~688) — blocks a
  warehouse-grade usage channel. Enhancement, not blocker; fix when analytics work is
  next open anyway.
- **Executor-skill cross-references** — once ≥3 contracts exist, sweep the fix skills'
  SKILL.md files (`/eval-fix`, `/topic-fidelity`, `/reader-fit`, `/add-*`) to add a
  "read the contract first" phase-0 line. Until then the CLAUDE.md rule covers all
  sessions.

## Done

- **sorting-station — PILOT derived 2026-07-15** → `docs/contracts/sorting-station.md`.
  10 requirements (8 verified-live, 2 in-flight with the delegated reader-fit 1e lane),
  3 resolved conflicts recorded (variety-vs-fidelity, PRE-vs-G1 chrome via band gate,
  auto-submit near-miss), 1 catalog divergence flagged ("Max 10 objects" looser than
  the enforced K 4–6/≤3-bin, G1 5–8/≤4-bin reality — projection HELD until 1e lands,
  math.ts is uncommitted in that lane). Derived from static evidence (census 07-14,
  QA reports, EVAL_TRACKER, git); first live `--census` refresh due when the K queue
  drains and the grade-1 census runs (WORKSTREAMS reader-fit milestone).
