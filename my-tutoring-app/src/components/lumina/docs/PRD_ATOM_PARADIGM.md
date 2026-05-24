# PRD — Atom Paradigm: Next Steps (Rev 2)

**Status:** Draft (2026-05-20)
**Owner:** Curriculum + Lumina platform
**Supersedes:** Rev 1 (same date)
**Related:** `PRD_EVAL_MODES_ROLLOUT.md`, `PRD_WITHIN_MODE_INSTANCE_DENSITY.md`

---

## 0. Why this rewrite

Rev 1 proposed inverting which graph is foundational — atom becomes the primary node, curriculum becomes a thin tagging overlay on top. That framing breaks for **universal atoms** (`deep-dive`, `knowledge-check`, `passage-studio`). A student doesn't master "deep-dive." They master *the American Revolution as probed by deep-dive*. The semantic identity lives on the subskill; the atom is a delivery vehicle. For specialized math atoms it looks like atom = mastery unit, but only because subskill↔atom is ~1:1 there — the underlying primitive is still subskill.

Rev 1 also had no answer for: **what happens when a new primitive ships and changes what an existing subskill can probe?** If subskill is the calibration unit, the new primitive silently invalidates `b` and prior mastery. If atom is the calibration unit (Rev 1), the question is dodged but mastery loses semantic anchoring.

Rev 2 resolves both: the foundational unit is **`(subskill × atom)`**. Atoms own modality-IRT params (`a`, `c`). The (subskill × atom) cell owns content-IRT (`b`) and per-student mastery state. Curriculum subskills remain the semantic anchor and the rollup point. The curriculum-authoring-service, curriculum-designer-app, and curriculum graph service stay as-is — the atom registry is enrichment, not replacement.

---

## 1. The lattice

| Layer                  | Owns                                                                       | Calibrated / derived by                                                |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Atom**               | Interaction shape, answer modality, `a` (discrimination), `c` (guess floor)| Pooled across all (subskill × atom) cells for that atom                |
| **(subskill × atom)**  | `b` (difficulty), per-student mastery state, attempts log                  | Pooled per cell                                                        |
| **Subskill**           | Concept identity, prereq edges to other subskills, standard alignment      | Stable; carried by curriculum graph                                    |
| **Subskill mastery**   | Student-facing rollup (mastered / evaluating / not yet)                    | Derived from the subskill's row of cells per the §4 rollup policy      |

Two flavors of cell:

- **Specialized math** — subskill `add-within-10-missing-addend` × atom `ten-frame::missing-addend`. The subskill row has one or two cells (specialized primary + maybe `knowledge-check::recall` fallback). The (subskill × atom) view collapses toward atom-level — Rev 1's framing looked right here because of this collapse.
- **Universal content** — subskill `civics-3-branches-separation` × atom `deep-dive::dialogue`, also × `passage-studio::primary-source-analysis`, also × `knowledge-check::recall`. Many cells per subskill row. The atom carries modality calibration; the cell carries content calibration; the subskill carries what the student is actually mastering.

The lattice is what's invariant under system evolution. New primitives add new cells. They never alter existing cells.

---

## 2. Atom kinds

Unchanged from Rev 1. Two classes, both first-class in the catalog:

| Kind            | Examples                                                              | Selection driver        | Content source                       |
| --------------- | --------------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| **Specialized** | `ten-frame::missing-addend`, `number-line::jump-fractions`            | Concept fit             | Primitive UI encodes the cognitive task |
| **Universal**   | `knowledge-check::recall`, `passage-studio::primary-source-analysis`  | Cognitive demand        | Gemini fills subject matter at runtime |

Implication for the lattice: specialized atoms tend to live in narrow rows (few cells per subskill, often 1:1). Universal atoms appear in wide columns (one atom serves many subskills as a column of cells). Coverage analysis looks at both.

---

## 3. What shipped (2026-05-20)

- **`AtomRegistry.tsx`** — frontend-only flatten of `UNIVERSAL_CATALOG`. Filters by subject / kind / primitive / search. Stats: 452 atoms, 27 universal, 425 specialized, 117 primitives w/ modes, 67 without. Useful as-is, keep.
- **Edge authoring MVP (localStorage)** — click "Edges" on any atom to author edges to other atoms. Stored under `lumina:atom-graph:v1`. Hook signature is the swap-point for Firestore. **Re-framing in §5.A**: these are *modality scaffolding* edges, not concept prerequisites — the latter remain in the curriculum graph.
- **Wired into IdleScreen Developer Tools** as "Atom Registry" (🔬).

---

## 4. Mastery rollup policy (the new-primitive contract)

When a new primitive ships and is registered as a candidate for an existing subskill, the lattice gains a new column of empty cells. **Existing cells are never rewritten.** What does change is the subskill-level rollup — and that's where the policy lives.

**Default: additive.** A student is master of subskill X if mastered via *any* atom currently in X's manifest-eligible set. New primitives become available for next sessions and start accumulating their own (subskill × atom) calibration, but adding them does not demote students who already mastered X via prior atoms.

**Curated override: required probe.** A curriculum author can mark a specific (subskill, atom) as a **required probe** via a lineage record. This locally promotes the rollup for that subskill to strict — students who were mastered via other atoms re-enter `evaluating` state until sampled on the required probe.

Why additive by default:

- The harsh demotion would be invisible to the student ("you used to be done with this topic; now you owe more work") and isn't justified by the system merely gaining a new modality.
- Manifest selection will naturally route students into new atoms during fresh sessions, building lattice density without retroactive penalties.
- Calibration of the new (subskill × atom) cell happens organically as students encounter it.

Why a curated override exists:

- Some primitives probe a cognitive demand the prior set couldn't. Example: a `primary-source-analysis` primitive for a civics subskill previously served only by `deep-dive::dialogue`. Conversational fluency doesn't certify document analysis. In that case, an author intentionally promotes the new atom to required, and re-evaluation is the correct behavior.
- Promotion goes through `curriculum_lineage` (same audit trail as subskill ID changes) — never silent.

This policy is what dissolves "new primitives invalidate existing subskills." They don't. They widen the probing surface, and the rollup policy makes the widening explicit and auditable.

---

## 5. Sequencing

### A — Storage migration + edge taxonomy narrowing (low cost, high value)

**Goal:** Move edge persistence from localStorage to Firestore. Narrow edge relations from 4 to 2 and label them honestly.

**Scope:**

- New Firestore collection `atom_edges/{edgeId}`:

  ```
  {
    source: string,             // atom id "primitive_id::eval_mode"
    target: string,             // atom id
    relation: 'scaffold-of' | 'lateral',
    rationale?: string,
    strength?: number,          // 0..1 — LLM confidence or human override
    source_kind: 'llm' | 'human' | 'human_edit',
    created_at, updated_at, created_by
  }
  ```

- Relation taxonomy is **modality only**:
  - `scaffold-of`: A scaffolds the interaction pattern needed for B (e.g., `ten-frame::add-within-10` scaffolds `ten-frame::missing-addend`).
  - `lateral`: A and B are interchangeable modality experiences for similar cognitive tasks.
- Concept prerequisites (`subskill → subskill`) remain in the curriculum graph. Atom edges do NOT replace them and should not be authored as if they did.
- Replace `useAtomGraph` storage layer with Firestore listener (`onSnapshot`). Dialog code unchanged.
- One-time per-author migration from localStorage to Firestore.

**Cost:** ~120 LOC frontend + security rules. No backend endpoint changes.

**Why first:** Removes the "won't sync across devices" caveat and locks in the correct semantic scope before edges accumulate under the wrong taxonomy.

### B — Lattice diagnostics (replaces Rev 1's `atom_tags`)

**Goal:** Make the (subskill × atom) lattice queryable for coverage and breadth analysis. **No new tagging collection.**

The Rev 1 plan introduced an `atom_tags` Firestore collection mapping atoms to subskill/skill/unit/standard. That would have been a second source of truth for atom→subskill resolution, duplicating what the manifest already does at runtime and re-creating the pre-baked-primitive-mapping failure mode (memory: `feedback_no-prebaked-primitive-mapping.md`).

**Scope instead:**

- Derive the lattice from existing data:
  - Manifest-eligible (subskill, atom) pairs come from running the manifest against the subskill index (or equivalently: simulating selection per subskill).
  - Populated cells come from the attempts log (any cell with ≥1 attempt is populated; cells with enough attempts are calibrated).
- AtomRegistry gains a **lattice view** mode:
  - Per-subskill: list manifest-eligible atoms, mark populated / calibrated / unattempted.
  - Per-atom: list subskills it serves, with cell health.
- **Coverage gap report**: subskills where the manifest returns *zero* eligible atoms. This is the primary diagnostic — what we cannot teach yet.
- **Modality breadth report**: subskills served by only one atom (no probing redundancy — fragile if that primitive has issues).

**Cost:** ~250 LOC frontend (view modes + derived queries). Backend query helper to scan manifest×subskill if performance demands it.

**Why second:** Diagnostics are the payoff of the abstraction. Without them, the atom registry is just a catalog browser.

### C — Gemini suggestion for modality scaffolding edges

**Goal:** Replace manual edge authoring with LLM-assisted suggestions, scoped to modality scaffolding only.

**Scope:**

- `POST /api/atom-graph/suggest-edges`
  - Input: `{ atom_id, max_suggestions?: number, relation?: 'scaffold-of' | 'lateral' }`
  - Backend pulls the atom + its primitive description + eval mode, plus catalog. Does NOT pull curriculum context — these are modality edges, not concept edges.
  - 1-2 Gemini calls, scoped prompt (<5s).
  - Output: `[{ target_atom_id, relation, rationale, confidence }, ...]`
  - Does not persist. Frontend renders accept/reject; on accept, writes to Firestore.
- Same shape as `/curriculum-graph/suggest-edges`. Distinct endpoint to keep the modality-vs-concept distinction enforceable at the prompt level.

**Cost:** ~200 LOC backend (~80% copy from `/curriculum-graph`) + accept/reject UI.

**Why third:** Manual is acceptable for a few dozen edges; doesn't scale to 452 atoms.

### D — IRT at the right layer

Split Rev 1's Workstream D into two pieces; both are real wins, neither requires routing changes.

**D1 — Atom-level `a`, `c` pooling.** Discrimination and guess-floor are modality constants — the same `ten-frame::missing-addend` interaction has the same discrimination regardless of which specific numbers are in the problem. Pool calibration data across all (subskill × atom) cells for an atom to estimate `a`, `c`. This is the 30-50× data pooling win Rev 1 claimed, properly scoped.

**D2 — Per (subskill × atom) `b`.** Content difficulty lives at the cell. Existing per-problem `b` estimates aggregate up to the cell. Migration: backfill cell-level `b` from existing per-problem data; recalibrate going forward at the cell level.

**Cost:** medium. CalibrationEngine changes + data migration. CalibrationSimulator validates against held-out data before cutover.

**Why fourth:** D1 is the load-bearing modality calibration win — required before any future routing change has the data it needs. D2 formalizes what's already half-true.

### E — Direct Firestore reads from frontend

Unchanged from Rev 1. Orthogonal to the atom paradigm; opportunistic migration.

### F — DEFERRED. (subskill × atom)-keyed mastery routing

**Out of scope for this PRD.** Do not start until:

1. Lattice density is sufficient (most subskills have ≥2 populated atoms — measurable via §5.B diagnostics).
2. D2 demonstrates that cell-level `b` improves mastery gate fairness vs. the prior subskill-only `b` (validated via CalibrationSimulator).
3. Rollup policy (§4) has been exercised in authoring tooling — at least one curated `required probe` has been used in production.

When it's time, the unit is `(subskill_id, atom_id)`, not `atom_id` alone (Rev 1's mistake). Mastery is tracked per cell; subskill rollup follows §4. PlanningService selects the next *cell* by Fisher information, with manifest-eligibility as a hard filter.

---

## 6. Open questions

| #  | Question                                                                              | Owner       | Resolve before |
| -- | ------------------------------------------------------------------------------------- | ----------- | -------------- |
| 1  | When does a new primitive trigger a `required probe` promotion vs. default additive?  | Curriculum  | A              |
| 2  | Strength field on edges — keep `0..1` or drop until we have a use case?               | Platform    | A              |
| 3  | Gemini prompt structure for modality scaffolding suggestions                          | AI          | C              |
| 4  | D2 backfill — recompute `b` per cell from per-problem data, or recalibrate cold?      | IRT         | D2             |
| 5  | Lattice diagnostic performance — derive on-demand vs. materialize a daily snapshot?   | Platform    | B              |

---

## 7. Non-goals

- **Do not** replace, duplicate, or refactor the curriculum-authoring-service, curriculum-designer-app, or curriculum graph service. The atom registry is enrichment.
- **Do not** build a static `atom_tags` Firestore collection. The lattice is sufficient and the static schema would re-create the pre-baked-mapping failure mode.
- **Do not** conflate atom edges (modality scaffolding) with curriculum subskill prereqs (concept prerequisites). Separate authoring tools, separate persistence, separate purpose.
- **Do not** change PlanningService or MasteryLifecycleEngine routing today. Deferred to F, gated on lattice density + D2 validation + rollup-policy exercise.
- **Do not** pre-map atoms into curriculum data (`primitive_affinity`, `eval_mode_hint`). The manifest resolves at runtime.
- **Do not** build a force-directed graph visualization. Lattice view (table) + per-atom edge dialog is enough until edge density justifies more.

---

## 8. Decision checkpoints

After each workstream, evaluate:

1. **Did this surface a coverage or breadth gap the curriculum graph alone couldn't show?** (If yes, the abstraction is paying off.)
2. **Did this require changes to PlanningService, MasteryLifecycleEngine, or the manifest pipeline?** (If yes, scope crept.)
3. **Did the rollup policy in §4 hold up against real authoring cases?** (If no, revisit before F.)
4. **Is the next workstream still worth doing?** (If not, pause and rethink.)

After D2: does cell-level `b` measurably improve mastery gate fairness over subskill-only `b`? If no, the lattice abstraction has limited value beyond D1 + diagnostics, and F should be permanently deferred.

The pattern: build alongside what we already have, prove value at each step, never cut over until the lattice is denser than the curriculum graph could be alone.
