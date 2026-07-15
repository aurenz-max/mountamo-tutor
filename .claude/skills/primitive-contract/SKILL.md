# Primitive Contract — What Must This Primitive Keep True, and For Whom?

One primitive serves many curriculum skills (the manifest routes emergently — that's
the point). But an edit made to satisfy skill N routinely ablates behavior that
skills 1..N−1 depend on, and nobody notices until the next QA pass burns tokens
rediscovering it. This skill inverts the observed dependency graph at **edit time**:
it derives each primitive's de facto requirements from its actual consumers, records
them as a versioned contract doc, and guards edits against that contract.

**Outcome:** a per-primitive contract at
`my-tutoring-app/src/components/lumina/docs/contracts/<primitive-id>.md` listing every
requirement with the consumer that demands it and the probe that re-verifies it — so
any session editing that primitive knows the blast radius BEFORE authoring the edit,
and any conflicting demand forks (new eval mode / band gate) instead of mutating in
place. Second-order outcome: the contract's **Catalog projection** section drives the
`description`/`constraints`/`evalModes[].description` fields toward what the primitive
is *actually* best at, which is what the manifest curator routes on.

**Position in the skill family:** `/topic-trace` samples what the manifest routes for
ONE topic; `/topic-fidelity` verdicts ONE generator against ONE topic+intent;
`/reader-fit` audits ONE band. Each produces evidence and then the session forgets it.
`/primitive-contract` is the **cross-consumer memory**: it aggregates what all of those
learned about one primitive into a single requirements doc, and is the doc every
fix skill (`/eval-fix`, `/reader-fit --fix`, `/topic-fidelity`, `/add-*`) reads before
touching that primitive. Runtime routing is untouched — this is edit-time discipline
only, fed by data the other skills already generate.

**Arguments:** `/primitive-contract <primitive-id> [--check | --census <grade>]`

- `/primitive-contract sorting-station` — derive (or refresh) the contract from all
  evidence channels; write/update the contract doc + catalog projection diff.
- `/primitive-contract sorting-station --check` — edit guard. BEFORE an edit: load the
  contract + blast radius into context. AFTER the edit: run the scoped regression
  probes for every requirement whose consumer isn't the one you're editing for, and
  emit a verdict.
- `/primitive-contract sorting-station --census 1` — refresh consumer evidence with a
  fresh manifest census at that grade (batched `/topic-trace` POSTs, `manifestOnly`),
  then re-derive. Use when the consumer set may have changed (new curriculum, new
  eval modes, catalog description edits).

## The core inversion

Runtime stays emergent: skill → curriculum service → manifest → primitive, no
hand-maintained forward map ([[no-prebaked-primitive-mapping]] still holds — contracts
are DERIVED observations, never routing hints fed back into curriculum data). The
contract is the **reverse** edge, maintained at edit time only:

```
RUNTIME (unchanged)   topic/skill ──► manifest ──► primitive ──► content
                                          │
EDIT TIME (this skill)                    ▼ evidence channels
  [1] census: batched /topic-trace, manifestOnly, fixed objectives   (live routing)
  [2] QA registers: qa/topic-fidelity/, qa/reader-fit/, EVAL_TRACKER (judged demands)
  [3] authored map: GET /api/curriculum/primitive-mappings/{subject} (dormant/long-tail)
  [4] student data: GET /api/calibration/items?primitive_type=<id>   (real usage)
  [5] git log of the component+generator                             (ablation history)
                                          │
                                          ▼
              docs/contracts/<id>.md  (requirements ▸ demanded_by ▸ evidence ▸ probe)
                                          │
                        ┌─────────────────┼──────────────────┐
                        ▼                 ▼                  ▼
                  edit guard        conflict → fork     catalog projection
                  (--check)         (eval mode/band     (description/constraints/
                                     gate/variant)       evalModes[].description)
```

**Requirement strength:**

| Strength | Meaning | Trust |
|---|---|---|
| OBSERVED | seen directly in a trace, QA report, or student data | probe must pass before any edit ships |
| INFERRED | implied by catalog prose, eval-mode description, or code structure | verify by probe when first challenged; upgrade or delete |

**Edit-guard verdicts:**

| Verdict | What it means | Action |
|---|---|---|
| COMPATIBLE | all other-consumer probes still pass post-edit | merge in place; update contract changelog |
| REGRESSION | edit breaks an OBSERVED requirement of another consumer | fix or revert before "done"; never ship + queue |
| CONFLICT | the NEW demand contradicts an existing requirement (both are right for their consumers) | do NOT edit in place — fork down the ladder below |
| NO-CONTRACT | primitive has no contract yet | derive first (even a 10-minute static derivation beats zero) |

**The fork ladder** (cheapest first — a "variant" in this codebase is almost never a
new component):

1. **Eval-mode split** — the two demands are different task identities → `/add-eval-modes`
   (precedent: knowledge-check `picture_mcq` @ PRE; decodable-reader `read_along`).
2. **Band/grade gate** — same task, different presentation by reading band or grade →
   gate inside generator + component (precedent: EMERGING band-gate, `clampGradeToK2`).
3. **Config axis** — same task, different structure → structural-difficulty tier or a
   new config field ([[support-tiers-natural-levers]]).
4. **True variant primitive** — demands diverge in interaction shape itself → `/primitive`
   births a sibling; both keep their own catalog entries and contracts. Last resort;
   record the conflict that forced it in both contracts.

## Workflow

### Phase 0 — Locate & inventory

Confirm the primitive exists: catalog entry (`service/manifest/catalog/*.ts` via
`getComponentById`), component, generator. If a contract doc already exists, read it
FIRST — this run is a refresh, and existing requirement IDs are stable (never renumber;
retire with a strikethrough + date).

### Phase 1 — Consumer census (blast radius)

Pull every evidence channel. Cheap/static ones always; the live census when `--census`
or when evidence smells stale (contract `derived_at` older than the latest catalog or
curriculum change touching this primitive):

```bash
# [1] live routing (dev server required) — per subskill, fixed objectives pin the manifest:
curl -s -X POST http://localhost:3000/api/lumina/topic-trace \
  -H 'Content-Type: application/json' \
  -d '{"topic":"<objective text>","gradeLevel":"elementary","manifestOnly":true,
       "objectives":[{"id":"<subskill_id>","text":"<objective>","verb":"<verb>"}]}'
# tally components[].id across the subskill batch; this primitive's hits = its consumers

# [3] authored long-tail (catches DORMANT consumers no recent trace shows):
curl -s http://localhost:8000/api/curriculum/primitive-mappings/<subject> | \
  # invert .mappings for subskill_ids whose target_primitive == <id>

# [4] real usage:
curl -s "http://localhost:8000/api/calibration/items?primitive_type=<id>"
```

Channel [2] is a read of `qa/topic-fidelity/<id>-*.md`, `qa/reader-fit/<id>-*.md`,
`qa/eval-reports/`, EVAL_TRACKER rows. Channel [5] is
`git log --oneline -- <component> <generator>` — every fix commit is a consumer
demand that was once violated.

### Phase 2 — Derive requirements + detect conflicts

For each consumer, state WHAT it demands as a testable property, not a feature name
("PRE band: items render emoji-primary, category labels read aloud" — not "supports
pre-readers"). Attribute every requirement to ≥1 consumer with an evidence pointer.
Classify OBSERVED vs INFERRED. Then scan pairwise for contradictions — **conflict
detection is a first-class output**, not a failure of the derivation. A contract
carrying an open conflict means the next edit in that zone MUST fork.

Attach to every OBSERVED requirement a **probe** — a concrete re-verification recipe,
usually an eval-test route call (the same battery `/topic-fidelity` uses:
honored + discrimination + no-regression) or a saved topic-trace `replay` body.
A requirement without a probe is an opinion.

### Phase 2b — Derive GAP requirements (close matches)

The R-series protects existing consumers; the **G-series** is the improvement half:
what would this primitive need so its NEAR-consumers could route to it well? Sources,
all evidence-bearing (a gap without a named near-consumer is a wish — those go to
`/lumina-portfolio`, not here):

```bash
# THE close-match detector — subskills whose demand embedding almost matches this
# primitive's catalog identity:
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe \
  scripts/curriculum_fit_probe.py --primitive <id> --domain <domain> --grades K,1
```

plus: WRONG-PRIMITIVE verdicts in `qa/topic-fidelity/` naming this primitive as the
near-fit; band-audit open findings (a mode floored out of a band is a gap if the
curriculum demands the task IN that band); census lessons where it was routed but
only partially served the objective.

Each gap records: the near-consumer + evidence (probe score / verdict / trace), the
**shortfall** (what's missing, as a property), the **fork rung + executor skill** that
would implement it, and its **relation to the R-series** — a gap that contradicts an
existing requirement is a pre-detected CONFLICT: the resolution ruling gets written
NOW (usually "new eval mode where X is the objective"), so the future implementer
forks instead of relaxing the requirement. Gaps are the contract's queue-feeding
surface: pulling one into an ACTIVE stream's queue (with its executor skill) is how
contracts turn into build work.

### Phase 3 — Write the contract + catalog projection

Write/update `docs/contracts/<primitive-id>.md` (template below). Then diff the
contract against the live catalog entry: does `description` claim what the evidence
supports? Does `constraints` warn what consumers learned the hard way? Do
`evalModes[].description` strings match the task identities the resolver needs to
discriminate? Propose the projection as explicit before/after — **the curator prompt
only sees `id`/`description`/`constraints` (`gemini-manifest.ts` catalogContext), and
its cognitive-load budget is deliberately tight, so projections sharpen prose, never
append essays.** Apply projection edits only when the contract run's purpose includes
it or the user approves; catalog edits re-route lessons.

### Phase 4 — Edit guard (`--check`)

**Pre-edit:** print the blast radius (consumer table) + the requirements whose zone the
planned edit touches. The editing session reads this BEFORE authoring the change —
this alone kills most ablations.

**Post-edit:** run the probes of every OBSERVED requirement demanded by consumers
*other than* the one the edit serves (the edit's own consumer is verified by the
normal Verification Doctrine). Judge on the requirement's dimension, not exact-match —
this is an emergent system; content varies, properties must hold. Emit verdict:

- COMPATIBLE → done; append a changelog line to the contract.
- REGRESSION → the edit is not "done" regardless of how the target consumer looks.
- CONFLICT → stop; record the conflict in the contract; take the fork ladder.

Write the check report to `qa/primitive-contracts/<id>-check-<YYYY-MM-DD>.md`.

### Phase 5 — Register & close the loop

New/updated contract → row in `qa/primitive-contracts/BACKLOG.md` moves to Done with
date + evidence. Whoever closes a `--check` also updates the contract changelog. `/pm`
treats `derived_at` older than the newest census as staleness. Consolidation (merging
band-gates back together, retiring variants with no consumers in the authored map or
calibration data) is a deliberate scheduled pass proposed through `/pm`, never a
side effect of an edit.

## Contract doc template

```markdown
# Contract: <primitive-id>

- **Derived:** <YYYY-MM-DD> · evidence window: <census date(s) / report range>
- **Component:** <path> · **Generator:** <path> · **Catalog:** <file>:<line>
- **Status:** ACTIVE | CONFLICTED (open conflict → edits in that zone must fork)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE band — sorting by attribute | census 4/6 + reader-fit | qa/reader-fit/... | 2026-07-15 |

## Requirements

### R1 — <short handle> · OBSERVED
- **Property:** <testable natural-language property>
- **Demanded by:** <consumer(s)>
- **Evidence:** <file/report/commit pointers>
- **Probe:** <exact recipe — curl line or replay pointer + what must hold>

## Conflicts

### C1 — R<i> vs R<j> — <status: OPEN | RESOLVED via <fork rung> on <date>>
<one paragraph: which consumers, why both are right, the ruling>

## Gap requirements (close matches — the improvement queue)

### G1 — <short handle> · <status: OPEN | QUEUED in <stream> | BUILT <date>>
- **Near-consumer:** <subskill/band/topic + evidence: probe score, verdict, trace>
- **Shortfall:** <the property the primitive lacks, stated testably>
- **Path:** <fork rung + executor skill, e.g. "eval-mode split → /add-eval-modes">
- **Relation to R-series:** <none | pre-detected conflict with R<i>: ruling here>

## Catalog projection

- **description:** <current → proposed, or "faithful as of <date>">
- **constraints:** <...>
- **evalModes:** <per-mode description deltas>

## Changelog

- <YYYY-MM-DD> — derived (initial). <n> requirements, <n> conflicts.
```

## Gotchas

- **[[value-origin-not-code-touch]]** — classify a requirement by where the behavior
  ORIGINATES, and verify by probe, never by grepping for a field name. A `ctx.intent`
  that's read but dropped in the prompt is a dead field, not a satisfied requirement.
- **Dormant consumers are the silent casualty.** A skill with no trace in the window
  still resolves here via the authored map (channel [3]) — the census alone under-counts.
  Keep channel [3] rows even at zero recent runs.
- **Contracts are derived, not authored wishes.** Never write an R-requirement no
  consumer demands, and never write a G-gap no NEAR-consumer demands (a gap needs a
  probe score, a WRONG-PRIMITIVE verdict, or a band-audit finding behind it). Pure
  "would be nice" is `/lumina-portfolio` material; letting it in rots the doc's
  authority. Every line traces to evidence.
- **Never feed contracts forward into curriculum data.** The reverse index is edit-time
  tooling. Writing primitive hints into subskills recreates the maintenance treadmill
  the manifest exists to avoid.
- **Curator prompt budget:** the projection sharpens `description`/`constraints`; it
  never adds new catalog fields to the manifest prompt without an explicit decision —
  eval-mode lists were deliberately excluded from catalogContext for load reasons.
- **BigQuery can't do this yet:** the attempts ETL omits `primitive_type`
  (`bigquery_etl.py` ~line 688), so cross-student usage comes from the calibration
  collection, not the warehouse. Adding it is a queued enhancement, not a blocker.
- **tsc is never a probe.** Every probe exercises the runtime flow (Verification
  Doctrine); a contract "verified" by typecheck is unverified.
- **Renumbering requirement IDs breaks changelogs and check reports.** Retire, don't
  reuse.

## Key Files

| File | Purpose |
|---|---|
| `my-tutoring-app/src/components/lumina/docs/contracts/<id>.md` | the contract (this skill's product) |
| `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | derivation queue + Done log |
| `my-tutoring-app/qa/primitive-contracts/<id>-check-<date>.md` | edit-guard run reports |
| `src/app/api/lumina/topic-trace/route.ts` | census engine (POST, fixed objectives) |
| `src/app/api/lumina/eval-test/route.ts` | probe engine (topic/intent/grade params) |
| `service/manifest/catalog/*.ts` + `types.ts` `ComponentDefinition` | projection target |
| `service/manifest/gemini-manifest.ts` (catalogContext) | what the curator actually sees |
| `backend: /api/curriculum/primitive-mappings/{subject}` | authored long-tail consumers |
| `backend: /api/calibration/items?primitive_type=` | real-usage consumers |
