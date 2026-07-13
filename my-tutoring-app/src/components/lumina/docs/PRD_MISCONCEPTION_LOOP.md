# PRD: The Misconception Loop

**Point-of-primitive diagnosis → targeted regeneration → verified resolution**

Status: AMENDED 2026-07-12 rev 2 — declared-scope identity approved; the shipped
subskill-only Phase 1–3 implementation requires alignment (§3 ruling 5, §5)
Date: 2026-07-05

> **2026-07-12 identity amendment (rev 2 — declared scope):** A misconception is
> an interaction-specific failure model owned by the primitive that observed it;
> `primitive_type` is always the hard authorization boundary. But which dimension
> carries the *concept* varies by primitive. For narrow manipulatives
> (TapeDiagram, ComparisonBuilder) the interaction model itself is the concept —
> the misconception applies wherever that primitive is selected, across
> subskills and in explore mode. For content-generic primitives (KnowledgeCheck,
> MultipleChoice) the primitive carries zero concept identity and a curriculum
> anchor is required. Each primitive therefore **declares a misconception scope**
> in its catalog entry: `'primitive'` (identity = `primitive_type` alone) or
> `'skill'` (identity = `primitive_type` + canonical `skill_id`). The rev-1
> composite (subskill_id, primitive_type) is superseded: subskill is provenance,
> never identity. No cross-primitive transfer occurs in v1 under either scope.

---

## 1. Outcome

A student who repeatedly makes the same conceptual mistake sees the next generated
content respond to it — not just "more practice on this subskill," but content that
stresses the specific distinction they're confusing.

**The acceptance test (the one that fails today):**

> A student answers comparison problems wrong three times because they think
> "fewer" means "the smaller number" instead of "the difference." The next lesson
> on that subskill generates problems that deliberately stress the
> smaller-number-vs-difference distinction, with a distractor that exposes the
> misconception. Whenever the same comparison primitive is selected again —
> the next lesson on that subskill, an adjacent subskill, or an explore-mode
> session — it receives the targeted focus. When the student clears one of those
> primitive-specific remediation problems strongly, the
> misconception is marked resolved and content returns to normal.

Personalization today is real at *selection* (pure-IRT: θ, Fisher information,
mastery gates pick the subskill) and absent at *generation* (all ~150 generators
are student-blind; the only knob is a curator-LLM-interpreted `config.difficulty`).
This PRD closes that gap.

## 2. Current state — the three breaks and the orphaned engine

The loop is broken in three places on the live Lumina path:

| Break | Where | What happens today |
|---|---|---|
| **Capture** | `backend/app/services/submission_service.py:359` (`_handle_lumina_primitive`) | Wrong answer stores `success=false`, score, generic prose. Stored answer is literally `"primitive_interaction"` (line 608). Review docs in `students/{id}/reviews` are write-only (history display is the only reader). |
| **Context** | `backend/app/api/endpoints/student_profile.py:349` (generation-context) | Per-objective payload is IRT aggregates only (θ, pCorrect, gate, competency, credibility, attempts). Zero error data, by design. |
| **Consumption** | `manifest/gemini-manifest.ts:320` → `registry/contentRegistry.ts:134` | Student context's last hop is the manifest prompt. `GenerationContext` has no student fields. Fossil at `flattenManifest.ts:20`: the retired `studentTheta` stamp, pulled because "it changed which in-scope numbers got picked, not difficulty." |

**The orphaned engine (backend, legacy path only):** a complete diagnose → target
→ resolve loop already exists:

- **Diagnose:** `review_service.analyze_misconception` (`backend/app/services/review.py:434`)
  — Gemini root-cause diagnosis of a wrong answer, one sentence of student-model
  text (e.g. *"The student thinks 'fewer' means the smaller number, not the difference"*).
- **Store:** `user_profiles.add_or_update_misconception` (`backend/app/services/user_profiles.py:399`)
  — Cosmos user-profile `misconceptions[]`, one free-text slot per subskill,
  status active/resolved, overwritten on re-detection.
- **Target:** legacy `problems.py:1163-1188` injects `misconception_to_address`
  into generation ("CRITICAL: This problem must address the misconception…").
- **Resolve:** `submission_service.py:145-153` — a `remediation_for_subskill_id`-tagged
  problem answered at score ≥ 8 (0–10 scale) flips status to resolved.

It runs only on the deprecated standard-problem path; `_handle_lumina_primitive`
returns before any of it. The engine is orphaned, not missing.

**The frontend chokepoint (why this plan is cheap):** every primitive already
submits through ONE funnel — `usePrimitiveEvaluation.submitResult(success, score,
metrics, studentWork)` → `EvaluationContext.submitEvaluation` →
`evaluationApi.convertToProblemSubmission` → `POST /api/problems/submit`
(`evaluation/hooks/usePrimitiveEvaluation.ts`, `evaluation/api/evaluationApi.ts`).
The payload already carries `metrics` (incl. `evalMode`), `studentWork`,
`duration_ms`, and full lesson context. Diagnosis hooks into this funnel once.

## 3. Design rulings (locked)

1. **Diagnose at the point of primitive, frontend-side.** The richest error
   evidence exists in the browser at the moment of failure: the challenge
   content, the student's actual interaction, and — for judge-driven primitives
   (blueprint canvas, spoken judges, revision workshop) — a Gemini judgment that
   already explains *why* the work fell short. The backend never parses
   primitive payloads or grows per-primitive logic. Backend's role: store,
   expose, resolve.
2. **One shared "eval-like" engine, not 100 custom logics.** Primitives opt in
   by supplying a standardized evidence packet (a data contract, exactly like
   eval modes) — never by implementing diagnosis themselves. The engine lives at
   the EvaluationContext boundary.
3. **Reuse judge output where a judge exists.** For judge-driven primitives the
   judge call is extended with an optional misconception field — diagnosis at
   zero marginal LLM cost. The standalone distiller call is only for
   mechanical/structured primitives.
4. **Misconceptions stay out of the IRT lane.** They change content *emphasis*
   (which distinction is stressed, which distractor appears, what context frames
   the problem) — never β, θ updates, or selection urgency. Pure-IRT ruling holds.
5. **v1 store is Firestore-native — one free-text slot per misconception
   identity, overwritten on re-detection. Identity = `primitive_type` + the
   primitive's declared misconception scope.**
   *(Amended 2026-07-09 for Firestore; 2026-07-12 rev 2 for declared scope.)*
   Each primitive declares `misconceptionScope` in its catalog entry:
   - **`'primitive'`** — the interaction model is itself the concept (narrow
     manipulatives: the misconception is about how the student reads the
     manipulative, true across subskills). Identity = `primitive_type` alone;
     fires wherever that primitive is selected, including explore mode.
   - **`'skill'`** — the primitive is a content-generic delivery vehicle
     (KnowledgeCheck, MultipleChoice). Identity =
     `(primitive_type, canonical skill_id)`; requires a curriculum anchor at
     delivery. Skill, not subskill: subskills ("compare within 10" vs
     "within 20") are finer-grained than any real misconception. The source
     `subskill_id` is stored as provenance (lineage, ribbon label), never as
     identity.
   The store ruling itself is unchanged: the legacy store
   (`user_profiles.add_or_update_misconception` / `resolve_misconception`) is
   **Cosmos-only**, and Cosmos is deprecated (ruling 2026-07-08: Firestore is the
   exclusive store; NullCosmos exists only to pass gates). Firestore holds NO
   misconception data today. Phase 1 therefore ports the store's field contract
   onto Firestore (see S3). Primitive type remains the hard boundary under
   either scope: a TapeDiagram diagnosis cannot target or be resolved by
   ComparisonBuilder, even when both serve the same subskill. No error taxonomy
   until the loop proves out. Honest abstain: weak evidence writes nothing.
6. **Consume at the registry boundary, not the manifest.** The manifest-prompt
   route is how personalization got laundered into a 3-level tier last time.
   `remediationFocus` becomes a typed `GenerationContext` field resolved at the
   registry boundary — the same shape as `intentFocus` in the topic-fidelity
   work, and the shape the GenerationContext harmonization PRD proposes.
7. **Remediation composes with supportTier; it never becomes a tier.** Support
   tiers are ordered, ability-driven, and withdraw scaffolds globally.
   Remediation is unordered, diagnosis-driven, and re-introduces exactly ONE
   lever — the one that isolates the confused distinction. A hard-tier student
   with an active misconception gets hard problems WITH the targeted move.
   Rule: `remediationFocus` may pin individual scaffolding levers the tier
   would have withdrawn; it never changes tier, β, or eval mode.
8. **Primitive ownership is exact; no cross-primitive transfer in v1.** A
   misconception captured by primitive `P` is offered only to `P`, within `P`'s
   declared scope: anywhere `P` is selected (primitive-scoped), or when `P` is
   selected for an objective on the same skill (skill-scoped). Selecting a
   different primitive for the same objective generates normally. This avoids
   assuming that an error evidenced through one interaction model is valid or
   expressible in another. Cross-primitive generalization would require an
   explicit, future taxonomy and compatibility mapping; free-text similarity is
   not sufficient authority.

### 3.1 One-to-many semantics

Curriculum remains one-to-many: one subskill may be taught by many primitives,
and one primitive serves many subskills. Misconception state never collapses
across the primitive fan-out, and it widens across the content fan-out exactly
as far as the declared scope allows:

| Active store entry | Manifest selection | Result |
|---|---|---|
| `TapeDiagram` (primitive-scoped) | TapeDiagram, any subskill on any skill | Deliver — if the selected eval mode has an affordance (see S5) |
| `TapeDiagram` (primitive-scoped) | TapeDiagram in explore mode (no subskill) | Deliver — primitive scope needs no curriculum anchor |
| `TapeDiagram` (primitive-scoped) | ComparisonBuilder, same subskill | Baseline; no signal |
| `(KnowledgeCheck, skill S)` | KnowledgeCheck, another subskill under skill S | Deliver |
| `(KnowledgeCheck, skill S)` | KnowledgeCheck, subskill under a different skill | Baseline |
| `(KnowledgeCheck, skill S)` | KnowledgeCheck in explore mode (no anchor) | Baseline — no anchor, no signal (correct) |
| `TapeDiagram` + `(KnowledgeCheck, S)` both active | ComparisonBuilder anywhere | Baseline; neither applies |
| `TapeDiagram` resolved | `(KnowledgeCheck, S)` still active | KnowledgeCheck entry remains active |

The primitive answers **which interaction model produced—and can validly
retest—the misconception**. The declared scope answers **how far the concept
travels**: for narrow manipulatives the interaction model *is* the concept; for
content-generic vehicles the skill is.

## 4. Architecture — six stations

```
  PRIMITIVE (failure)                             NEXT LESSON
  │                                                    ▲
  │ S1 evidence packet                                 │ S5 remediationFocus on
  ▼                                                    │    GenerationContext
  S2 shared distiller ──────┐                          │    (registry boundary)
  (frontend, Gemini flash,  │                          │
   schema-constrained,      │ S3 POST misconception    │ S4 generation-context
   abstains on weak         ├────────► Firestore store ┘    session block +
   evidence)                │          (Phase 1, new)       per-objective map
                            │
  S6 resolution: scope-matched same-primitive remediation scores ≥80 → resolved
```

### S1 — Evidence contract (per primitive, data only)

New optional field on `PrimitiveEvaluationResult` (populated via `submitResult`'s
metrics or a dedicated argument):

```ts
/** What the diagnosis engine needs to reason about a failure.
 *  Primitives supply DATA; they never diagnose. */
export interface DiagnosisEvidence {
  /** What the challenge asked, in one or two sentences. */
  challengeSummary: string;
  /** The pedagogically correct outcome, described (never shown to student). */
  expected: string;
  /** What the student actually did — the concrete interaction, selection,
   *  construction, or (for spoken) transcript. */
  observed: string;
  /** For judge-driven primitives: the judge's evaluation text/fields. */
  judgeFeedback?: string;
  /** Wrong-answer history within this session for the same subskill, if the
   *  primitive tracks challenges (challenge index → observed). */
  priorAttempts?: Array<{ challenge: string; observed: string }>;
}
```

Evidence quality tiers (decided by presence, not by primitive type flags):

- **Tier A — judge-backed:** `judgeFeedback` present. Highest fidelity; the
  judge already explained the failure.
- **Tier B — structured:** `expected` + `observed` present. Mechanical
  primitives (counting board, comparison, number line) can state both precisely.
- **Tier C — absent:** no evidence packet → the engine abstains. No diagnosis,
  no write. Primitives that haven't opted in are simply invisible to the loop
  (today's behavior).

### S2 — Shared distiller (one module, "eval-like")

`evaluation/diagnosis/distillMisconception.ts` — a single schema-constrained
Gemini call, built like a judge (response schema, asymmetric outcomes, honest
abstain):

```ts
export interface MisconceptionDiagnosis {
  /** One sentence in student-model form: "The student thinks X when Y." */
  misconceptionText: string;
  /** Distiller's own confidence. Below threshold → treated as abstain. */
  confidence: 'high' | 'medium' | 'low';
  /** Echo of evidence tier used, for observability. */
  evidenceTier: 'judge' | 'structured';
}
// Schema also permits { abstain: true, reason } — abstain writes NOTHING.
```

**Gating (all must hold before the call fires):**
- `success === false` or `score < 60` (0–100 scale)
- Evidence tier A or B (tier C never calls)
- At most one diagnosis per (misconception identity, session) — i.e. per
  primitive for primitive-scoped, per (primitive, skill) for skill-scoped; the
  store is one slot per identity anyway; re-diagnosing every failure is cost
  without information
- Fires **after** `submitEvaluation` resolves (fire-and-forget, never blocks
  the XP/engagement round-trip or the challenge-advance flow)

**Model:** Gemini flash (never flash-lite — judge-quality ruling). Prompt frames
the task as root-cause diagnosis of the *student's mental model*, explicitly
instructed to abstain rather than guess. Tier A prompts lean on `judgeFeedback`;
Tier B prompts reason from expected-vs-observed. The legacy prompt at
`review.py:471-496` is the starting template.

**Judge fast path:** judge-driven primitives extend their existing judge schema
with an optional `misconception` field (one extra schema property, zero extra
calls). When the judge returns it with a failing evaluation, S2 skips its own
LLM call and forwards the judge's diagnosis directly. Rollout: blueprint-canvas
family and spoken judges first, since their judges already articulate failure
causes.

### S3 — Transport + storage (thin backend)

New endpoint: `POST /api/student-profile/misconceptions`

```json
{
  "primitive_type": "tape-diagram",
  "scope": "primitive",
  "subskill_id": "...",
  "misconception_text": "The student thinks 'fewer' means the smaller number...",
  "confidence": "high",
  "evidence_tier": "judge",
  "source_attempt_id": "<attemptId>"
}
```

`scope` comes from the primitive's catalog declaration — the frontend owns the
catalog, so the backend never grows per-primitive logic (ruling 1); it only
validates the value. `subskill_id` is provenance and may be null (explore mode).
For `scope: "skill"` the backend lineage-resolves the subskill and derives the
canonical `skill_id` from curriculum; a skill-scoped capture with no subskill
has no anchor and is dropped (fail-soft — matches delivery semantics, where
skill-scoped entries never fire in explore mode anyway).

Handler is ~15 lines: auth-resolve student → a NEW Firestore-native store method
(see below). No schema change to the frozen `/api/problems/submit` request. Sent
fire-and-forget from S2; a dropped write costs one diagnosis, never a submission.

Why a separate endpoint instead of riding `/api/problems/submit`: diagnosis is
async (fires after submit returns) and must not add LLM latency to the XP path;
and the submit schema stays untouched.

**Store: Firestore-native, new** *(amended 2026-07-09 and 2026-07-12 — see ruling 5).* The legacy
`user_profiles.add_or_update_misconception` / `resolve_misconception` /
`get_active_misconception_for_subskill` are Cosmos-only (`user_profiles.py:399/538/477`);
Firestore has no misconception data. Phase 1 adds three methods to
`FirestoreService`, mirroring `update_competency` (`firestore_service.py:768`) —
lineage-resolve the subskill, `datetime.now(timezone.utc).isoformat()` timestamps,
`_add_migration_metadata`:

- **Collection:** `students/{student_id}/misconceptions/{misconception_key}` — one
  flat doc per misconception identity. The deterministic key is
  `${primitiveType}` for primitive-scoped entries and
  `${primitiveType}::${canonicalSkillId}` for skill-scoped entries;
  `primitive_type` must be a registered Lumina `ComponentId` (no arbitrary path
  strings). A `.set()` gives one-slot overwrite semantics for that identity. The
  flat collection keeps one active read cheap while allowing several primitives
  to hold distinct misconceptions, and one generic primitive to hold distinct
  misconceptions across skills. Idempotent by construction.
- **Field contract** (preserve the legacy `StudentMisconception` shape so a later
  Cosmos→Firestore backfill is trivial): `primitive_type`, `scope`, `skill_id`
  (null for primitive-scoped), `subskill_id` (provenance; nullable),
  `misconception_key`, `misconception_text`,
  `source_attempt_id`, `last_detected_at`, `status` (`'active'` | `'resolved'`),
  `resolved_at`, plus the new `confidence` and `evidence_tier` echoes.
- **Methods:** `add_or_update_misconception(student_id, primitive_type, scope, text, source_attempt_id, confidence, evidence_tier, subskill_id=None)` → derives `skill_id` when skill-scoped, `.set()` with `status='active'`;
  `resolve_misconception(student_id, primitive_type, skill_id=None)` → `.update({status:'resolved', resolved_at})`;
  `get_active_misconceptions(student_id)` → ONE read of all active docs for the
  student (misconception counts per student are small), filtered in code into
  `{'primitive': {primitive_type: m}, 'skill': {skill_id: {primitive_type: m}}}`
  (single call inside the existing generation-context request — no per-objective
  fan-out; the retrieval matcher's non-concurrency-safety guardrail in §6 holds).

The upstream producers/consumers (`submission_service.py`, `assessment_service.py`,
`review.analyze_misconception`) are store-agnostic — the loop's live path calls
the FirestoreService methods, not the Cosmos service. The legacy Cosmos methods
stay untouched for the deprecated standard-problem path (see §6 deferred item).

### S4 — Exposure (generation-context)

`student_profile.py` exposes the store at two levels, both fed by the single
`get_active_misconceptions` read. Generation context runs before the manifest
chooses components, so it exposes candidates; it does not choose or broadcast
one misconception:

- **Session-level `activeMisconceptionsByPrimitive`** — all primitive-scoped
  entries, keyed by `primitive_type`. Lives beside (not inside) the objectives
  array, so flows with no curriculum anchor — explore mode — receive it too.
- **Per-objective `activeSkillMisconceptionsByPrimitive`** — skill-scoped
  entries whose `skill_id` matches the objective's resolved skill.

```json
{
  "activeMisconceptionsByPrimitive": {
    "tape-diagram": {
      "text": "The student thinks 'fewer' means the smaller number, not the difference",
      "scope": "primitive",
      "detectedAt": "2026-07-05T...",
      "sourceAttemptId": "..."
    }
  },
  "objectives": [{
    "objectiveId": "...",
    "theta": 0.4, "pCorrect": 0.62, "masteryGate": 2,
    "activeSkillMisconceptionsByPrimitive": {
      "knowledge-check": { "text": "...", "scope": "skill", "skillId": "..." }
    }
  }]
}
```

Empty/absent when none active. The `overallSummary` and persona blocks are
untouched — persona still feeds framing only. Raw misconception text remains
out of the manifest prompt.

### S5 — Consumption (registry boundary, opt-in per generator)

1. `useExhibitSession` already holds the generation-context response. After the
   curator chooses a component, manifest flatten performs the scope-matched
   join:
   - **Primitive-scoped:** `component.componentId` equals the entry's
     `primitive_type` — no objective required, so the join works identically in
     explore mode.
   - **Skill-scoped:** `componentId` matches AND the component's objective
     resolves to the entry's `skill_id`.
   Where the primitive declares an affordance inventory (point 4), stamping is
   additionally gated on it: an eval mode marked not-expressible (e.g.
   tape-diagram `solve_part_whole`) gets NO `remediationFocus` and NO
   remediation tag — structural abstention, so an irrelevant strong answer can
   never resolve the misconception. Non-matching components receive no signal
   and generate byte-identically to baseline.
2. `resolveGenerationContext` gains an optional `studentSignals` input; it sets
   a new typed field:

```ts
// generation/generationContext.ts
/** Active misconception for this component's objective, if any.
 *  Content EMPHASIS only: stress the confused distinction, surface the
 *  diagnostic distractor. NEVER changes difficulty, scope, or counts. */
remediationFocus?: string;
```

3. Generators opt in exactly like `intentFocus`: a conditional prompt block —

> REMEDIATION FOCUS: This student currently holds the misconception:
> "{remediationFocus}". Design the content so it directly stresses the
> distinction the student is confusing. Include at least one distractor or
> variation that a student holding this misconception would choose, so the
> content can distinguish holding it from having resolved it. Do NOT state the
> misconception or the correct rule in any student-visible text — the content
> tests it; the tutor and feedback address it.

4. **Prefer schema over prose — remediation moves are structural.** The prompt
   block above is the floor, not the ceiling. Where a primitive has structural
   levers, the generator translates `remediationFocus` into a schema-constrained
   move instead of hoping the LLM improvises one: the response schema gains an
   optional `remediationMove` enum (present only when `remediationFocus` is
   set), the LLM *picks* the move that matches the misconception, and code
   *enforces* it — the same LLM-picks-within-code-enforced-enum shape as the
   regrouping pilot and story-primitive structural tiers.

   **Remediation affordances** = each primitive's per-eval-mode inventory of
   such moves. Tape-diagram pilot inventory:

   | Eval mode | Affordances |
   |---|---|
   | `represent` | `force_gap_segment` (diagram can't be completed without creating a difference segment) |
   | `solve_part_whole` | — (misconception not expressible; generates normally) |
   | `solve_comparison` | `require_gap_identification`, `diagnostic_distractor`, `reversed_ask` |
   | `multi_step` | `explicit_intermediate` (comparison result must be produced before it's used) |

   Affordances are the same lever inventory `/add-support-tiers` withdraws —
   selected differently (see ruling 7). They're also the structural sibling of
   the catalog's `tutoring.commonStruggles`: same anticipated failure patterns,
   but consumed by the generator (what the content DOES) instead of the tutor
   (what the tutor SAYS). Going forward, `/add-support-tiers` should emit a
   failure-mode → lever map as a byproduct while its lever analysis is fresh;
   a later `/add-remediation-affordances` pass (Phase 4 here) wires the enums.
   Existing tiered primitives are NOT re-touched wholesale — pilot-first.
5. The manifest prompt does **not** consume misconception text in v1. (Possible
   later: curator sees a boolean "remediation pending" for phase weighting —
   only after the registry path proves out, to avoid re-laundering.)
6. Tutoring scaffold (where present) MAY receive the misconception so the
   Gemini Live tutor can address it verbally — this is the one place the
   misconception may be *spoken about*, never shown as text.

### S6 — Resolution (close the loop)

1. When the scope-matched join sets `remediationFocus`, the manifest item is
   tagged; the tag rides `PrimitiveEvaluationResult.lessonContext` and lands in
   the submit payload as `remediation_for_primitive_type` plus, for skill-scoped
   entries, `remediation_for_skill_id`. Tags are never inferred merely from
   sharing the objective — and never set when the affordance gate abstained.
2. `_handle_lumina_primitive` gains one small branch (the only live-path backend
   change on submit): tag present + score ≥ 80 (0–100 → legacy's ≥8 on 0–10) →
   require the tag to match the submission's actual `primitive_type` (and, for
   skill-scoped, the submission's resolved skill), then call
   `resolve_misconception(primitive_type, skill_id?)`. Primitive-scoped
   resolution clears the entry globally for that primitive — coherent, because
   demonstrating the distinction in the manipulative anywhere resolves a
   misconception about the manipulative. Skill-scoped resolution clears only
   that `(primitive_type, skill_id)` pair; all other entries remain active.

### Surface (backend-ships-with-surface)

The consuming surface is **the content itself** (S5). Two supporting surfaces:

- **Diagnosis Lab** (dev bench, Phase 0): scenario registry of canned evidence
  packets → distiller output side-by-side, same pattern as Voice Studio /
  Blend Judge Lab. This is the mock-first artifact that lets us tune the
  distiller before any backend exists.
- **Session ribbon trace** (Phase 3): one line — "Working on: comparing by
  difference" — phrased from the *subskill description*, never the raw
  misconception text (pedagogy: don't tell the student their wrong rule; test it).

## 5. Phased plan — committable slices

Each phase is one commit-able slice with its own verification; no phase ships a
producer without its consumer.

### Phase 0 — Contracts + Diagnosis Lab (frontend only) ✅ DONE 2026-07-09
- `DiagnosisEvidence`, `MisconceptionDiagnosis`/`Abstain` types + `classifyEvidenceTier`
  (`evaluation/diagnosis/types.ts`); `distillMisconception.ts` (flash-latest, schema,
  gate, low-conf→abstain, Tier-C short-circuit, never throws); golden set of 10
  packets (`scenarios.ts`); Diagnosis Lab (`components/DiagnosisLab.tsx`, wired into
  DevPanelRouter + IdleScreen); `/api/lumina` `distillMisconception` action; optional
  `diagnosisEvidence` handle on `PrimitiveEvaluationResult`.
- **Verified:** live bench 10/10 expectation match — 6/6 clean student-model
  diagnoses with 0 answer leakage, 4/4 honest abstains incl. the overreach trap;
  Tier-C never called the model. `tsc` clean vs baseline. Run summary:
  `my-tutoring-app/qa/diagnosis-lab-phase0-2026-07-09.md`.

### Phase 1 — Capture on the live path ✅ HISTORICAL 2026-07-10 / ⚠ PRIMITIVE-SCOPE ALIGNMENT OPEN
- Capture engine: `submitResult` gained an optional 6th arg `diagnosisEvidence`
  (rides `PrimitiveEvaluationResult`); `EvaluationContext.submitEvaluation` calls
  `evaluation/diagnosis/captureMisconception.ts` fire-and-forget AFTER the submit
  round-trip resolves (gates: failure, tier A/B, real subskill, once per
  (subskill, session) — latch set synchronously; subskill precedence: result's
  authoritative ID, else the submit response's resolved `demonstratedSkill`).
- Pilot family: **TapeDiagram** (all 4 modes, 5 wrong-answer sites),
  **ComparisonBuilder** (all 4 challenge types — the flagship fewer/difference
  surface), **CompareObjects** (all 4 types) as Tier B via a shared
  `wrongObservationsRef` + `noteWrongAnswer` pattern (latest wrong = headline,
  earlier = priorAttempts, bounded 8); **PhonicsBlender** as Tier A —
  `blendJudgeSchema` gained optional flat `misconception` string (both parse
  paths), failed verdicts logged and forwarded as `judgeFeedback`.
- Backend: `POST /api/student-profile/misconceptions` (auth-derived student_id,
  fail-soft) → three Firestore-native `FirestoreService` methods at
  `students/{id}/misconceptions/{subskill_id}` (lineage-resolved doc id,
  one-slot overwrite preserving created_at, resolve flip, batch active read).
  **Historical subskill-only shape; superseded by the 2026-07-12 amendment.**
- **Verified 2026-07-10** (`my-tutoring-app/qa/misconception-phase1-2026-07-10.md`):
  store + endpoint exercised against real Firestore (add/overwrite/resolve/
  re-detect/batch-read + 422 validation); real distiller call with the exact
  TapeDiagram-shaped comparison packet returned the acceptance-test diagnosis
  (high confidence, no leak); tsc = baseline (0 new). NOT yet browser-driven:
  the in-browser glue (primitive submit → capture fetch) needs one wrong-session
  check on a pilot primitive.

**2026-07-12 rev-2 alignment required:** include `primitive_type` and the
declared `scope` in capture transport; change the latch key to (misconception
identity, session); migrate the Firestore identity from `subskill_id` to the
declared-scope key (`primitiveType` or `primitiveType::skillId`). Existing
subskill-only docs must not be silently broadcast; migration may re-key a doc
when the source primitive is recoverable from `source_attempt_id` (deriving
skill from the stored subskill where the primitive is skill-scoped), or
quarantine/delete ambiguous docs via a dry-run-first script.

### Phase 2 — Exposure + consumption ✅ HISTORICAL 2026-07-10 / ⚠ PRIMITIVE-SCOPE ALIGNMENT OPEN
- S4 historically batch-read the Firestore store beside lifecycle state
  and exposed optional `activeMisconception` per objective (including lineage
  alias reads). S5: manifest flatten joins the signal by objective id, the registry
  boundary resolves typed `remediationFocus`, and the shared prompt block is
  consumed by TapeDiagram, ComparisonBuilder, CompareObjects, and PhonicsBlender.
- TapeDiagram pilots schema-constrained `remediationMove`; comparison moves are
  code-enforced (gap/distractor moves force `unknownPart='difference'`, reversed
  asks force a missing quantity, and an accidentally-correct smaller-value
  distractor degrades to gap identification). Part-whole deliberately abstains.
- **Verified 2026-07-10** (`my-tutoring-app/qa/misconception-phase2-2026-07-10.md`):
  disposable real-Firestore store→generation-context probe passed and cleaned up;
  real Gemini `/eval-test` probes passed for all four pilots with zero diagnosis
  leakage. The flagship tape run produced 4/4 targeted `diagnostic_distractor`
  comparisons, each asking for the difference with a distinct smaller quantity.
  Pure contracts: 32/32; backend assembly: 2/2; tsc: 0 touched-file errors.

**2026-07-12 rev-2 alignment required:** replace objective-level
`activeMisconception` with the session-level primitive-scoped block plus the
per-objective skill-scoped map; flatten joins per declared scope, gated on the
affordance inventory. Controls: (negative) a different primitive serving the
same subskill receives no `remediationFocus`; (negative) the same skill-scoped
primitive under a different skill receives none; (positive) a primitive-scoped
entry fires in explore mode with no subskill attached.

### Phase 3 — Resolution + ribbon trace ✅ HISTORICAL 2026-07-10 / ⚠ PRIMITIVE-SCOPE ALIGNMENT OPEN
- The historical evaluation funnel detects a remediating manifest component
  centrally and carries only `remediation_for_subskill_id` through lesson context into problem
  metadata. The private diagnosis never enters the submission payload.
- `_handle_lumina_primitive` resolves through the Firestore store only after the
  canonical submission fan-out succeeds, only at score ≥80, and only when the
  tag matches the submission's resolved subskill. Resolution is fail-soft.
- LessonScreen shows `Working on: <curriculum subskill description>` from the
  separately stamped safe label; the trace helper refuses to fall back to raw
  misconception text.
- **Verified 2026-07-10** (`my-tutoring-app/qa/misconception-phase3-2026-07-10.md`):
  permanent in-memory journey verdict `CLOSED` (wrong ×3 → active; distractor
  answer → still active; matched 85 → resolved; next read → baseline), including
  fan-out-before-resolve ordering and mismatch protection. The broader 10-day
  Steady Pulse loop also passed all 8 assertions: 306 items, L2 replay parity
  MATCH, 10/10 planned days. Ribbon rendering should work but still needs a
  browser check in an authenticated remediation lesson.

**2026-07-12 rev-2 alignment required:** replace the subskill tag with
`remediation_for_primitive_type` (+ `remediation_for_skill_id` for skill-scoped
entries). Resolution requires the tags to match the actual submission; a strong
result from any other primitive, from outside the declared scope, or from an
untagged (affordance-abstained) item must leave the misconception active.

### Phase 3A — Declared-scope alignment ✅ DONE 2026-07-12
- Catalog: `misconceptionScope: 'primitive' | 'skill'` on primitive catalog
  entries (beside `tutoring.commonStruggles`). Default for future opt-ins is
  `'skill'` — the safe scope; loosening to `'primitive'` later is a one-line
  change, while tightening after primitive-scoped state exists requires a
  migration.
- S1/S3: scope + primitive type in capture payload; declared-scope store keys;
  skill derivation from the canonical subskill; migration script for existing
  subskill-only docs (dry-run default; ambiguous docs never auto-assigned).
- S4/S5: session-level + per-objective exposure; scope-matched flatten join;
  structural affordance gate (no stamp → no tag → no resolve).
- S6: scope-matched resolution guard.
- **Open decision (decide at slice start):** do the pilot four (TapeDiagram,
  ComparisonBuilder, CompareObjects, PhonicsBlender — all narrow manipulatives)
  declare `'primitive'` immediately (bold; matches the original demo), or
  `'skill'` first, loosening after the first CLOSED Probe R (the reversible
  order)? The scope field makes either a one-line change per primitive.
- **Verify the scope matrix (§3.1):** seed a primitive-scoped TapeDiagram
  misconception; TapeDiagram is TARGETED on its source subskill AND on an
  adjacent subskill AND in explore mode; ComparisonBuilder is baseline
  everywhere; a strong ComparisonBuilder answer stays active; a strong
  affordance-abstained TapeDiagram answer (part-whole) stays active; a strong
  targeted TapeDiagram answer resolves; all surfaces return baseline afterward.
  Seed a skill-scoped entry on a generic primitive and prove it fires on a
  sibling subskill under the same skill, stays baseline under a different skill
  and in explore mode, and that resolving one entry leaves others active.

### Phase 4 — Scale-out
- **Foundational-literacy cohort — implementation complete / runtime gate open
  2026-07-12:** PhonicsBlender,
  RhymeStudio, SoundSwap, LetterSoundLink, CvcSpeller, and PhonemeExplorer now
  declare primitive scope, capture structured/judge evidence, consume
  `remediationFocus`, and stamp mode-specific private remediation moves.
  PhonemeExplorer covers isolate, blend, segment, and manipulate. LetterSoundLink
  `hear-see` now abstains from stamping when a diagnosed letter contrast falls
  outside the cumulative letter group. Pure suite: 670/670. Browser capture and
  real-Gemini D/G probes remain runtime verification, not implementation gaps.
- Judge-schema misconception field across remaining judge-driven primitives
  (spoken judges: the transcript is the highest-fidelity evidence in the
  product — every `/add-spoken-judge` primitive becomes a tier-A source).
- Evidence packets + prompt blocks for the next generator cohorts (reuse the
  support-tiers rollout ordering).
- Executed via the skill suite (§5.1), one family per run, spoken judges first.
  Amend `/add-support-tiers` to emit a failure-mode → lever map as a byproduct
  on future runs (capture only — no schema work in that skill).
- **Verify:** per-cohort Phase 2 probe; Diagnosis Lab scenarios grow with each
  new evidence shape.

### 5.1 The skill suite (how phases 1–4 execute without hand-work)

This is a campaign with the same shape as support tiers / structural
difficulty: a per-family build pass closed by a per-generator LIVE probe —
because a context field can be delivered and still dropped from the prompt
(the `ctx.intent` dead-field lesson; value-origin, never grep).

**`/add-misconception-loop <primitive-family>`** — build skill; raises the
family to the personalization layer. Creative pass (main agent): author the
per-eval-mode affordance inventory from the family's scaffolding levers +
`tutoring.commonStruggles`; map component state → evidence-packet fields.
The creative pass also rules on the family's `misconceptionScope` declaration
(`'skill'` unless the interaction model demonstrably IS the concept).
Mechanical pass (parallel subagents): `remediationMove` enum in the response
schema, conditional prompt block, evidence wiring at submit, `misconception`
field on judge schemas where a judge exists. Ends by invoking the test skill —
the layer isn't raised until it closes.

**`/misconception-test <primitive-family>`** — verify skill; real Gemini, no
mocks (`/eval-test` + `/topic-fidelity` DNA). Three probes:

| Probe | Input | Checks | Verdicts | Ship gate |
|---|---|---|---|---|
| **D — Distiller honesty** | Golden evidence set: 8–12 scripted packets/family — clear signatures, must-abstain slips, noise, tier-A judge cases | Real flash distill; code checks (one sentence, banned phrases, no answer text) + LLM judge on the four criteria | GENERATIVE / VAGUE / OVERREACH / LEAK | 0 OVERREACH, 0 LEAK; ≥80% GENERATIVE on clear signatures |
| **G — Generation fidelity** | Canned misconception seeded per identity (primitive-scoped or `(primitive, skill)`) + eval mode → real generator call with `remediationFocus` | Scope-matched runs are TARGETED (incl. adjacent-subskill and explore-mode runs for primitive-scoped); sibling primitive on the same subskill is byte-identical baseline; skill-scoped entry under a different skill is baseline; affordance-abstained eval modes are baseline and untagged; diagnostic distractor equals the misconception-consistent answer; leakage scan; structural drift guard (IRT lane untouched) | TARGETED / DEAD-FIELD / CROSS_PRIMITIVE_BLEED / OUT_OF_SCOPE_BLEED / LEAKY / DRIFTED | All matching runs TARGETED; 0 CROSS_PRIMITIVE_BLEED; 0 OUT_OF_SCOPE_BLEED |
| **R — Round-trip** | Pulse-agent synthetic student playing a scripted mental model, headless, real pipeline | primitive P wrong ×3 → scope-keyed store write; P next gen TARGETED (incl. across subskills for primitive-scoped); primitive Q on same subskill baseline and cannot resolve; out-of-scope or affordance-abstained P items cannot resolve; P distractor stays active; targeted P ≥80 resolves; P next gen baseline | CLOSED / NO-CAPTURE / STUCK-ACTIVE / PREMATURE-RESOLVE / WRONG_PRIMITIVE_RESOLVE / OUT_OF_SCOPE_RESOLVE | CLOSED; runs on every family rollout (permanent regression) |

Phase gates: Phase 0 closes on bench review of the golden set; Phase 1 on
Probe D; Phase 2 on Probe G; Phase 3 on the first CLOSED Probe R; Phase 4
families each close on a full `/misconception-test`. The golden evidence set
is the campaign's compounding asset — every family adds its failure signatures
and must-abstain cases, and every distiller/prompt change re-runs against all
of it (diagnosis quality gets a regression baseline like tsc).

### Explicitly deferred (do not build yet)
- Misconception taxonomy / structured error codes — free text until the loop
  proves out.
- Misconception history (multiple over time for one identity, trend) — one slot
  per identity, overwrite.
- Staleness TTL on primitive-scoped entries (`last_detected_at` cutoff) — only
  if Probe R shows drift.
- Revisiting the skill-level anchor granularity (subject-level? unit-level?) —
  skill is the v1 call; change only with evidence from the generic-primitive
  cohorts.
- Curator/manifest awareness of remediation state.
- Deterministic `pCorrect → supportTier` mapping (the "Bloom-tier entry point"
  named in `flattenManifest.ts:20`) — same theme (ability data deciding
  structure in code, not curator prose), **different wire**; spec separately.
- Deprecation of the legacy backend `analyze_misconception` path — leave it
  running for legacy pages; add a pointer comment to this PRD.

## 6. Gotchas & guardrails

- **Pedagogy — no leakage.** The misconception text is a prompt input and a
  tutor-speech input, never student-visible copy. The remediation prompt block
  must not cause generators to print the rule being tested ("remember, fewer
  means the difference!") in labels, placeholders, or feedback-before-attempt.
  Phase 2 verification checks this explicitly.
- **Don't re-launder through the manifest.** If remediation quality is weak, the
  fix is better distiller output or better generator prompt blocks — not moving
  consumption up into curator prose. That path produced the coarse-tier outcome
  this PRD exists to fix.
- **Score-scale mismatch.** Frontend scores are 0–100; the legacy resolve
  threshold is ≥8 on 0–10. The resolve branch converts explicitly; do not pass
  raw 0–100 into legacy helpers.
- **Fire-and-forget means idempotent.** The misconception POST may retry or
  double-fire (unmount auto-submit paths); `add_or_update_misconception` is an
  overwrite, so double-writes are safe — keep it that way.
- **Session dedup lives frontend-side.** The once-per-(misconception identity,
  session) gate lives in S2 state; the
  store's per-identity overwrite semantics are the backstop, not the gate.
- **Primitive isolation is an authorization boundary; scope is a delivery
  boundary.** Sharing a subskill or objective never authorizes delivery or
  resolution across primitive types. Skill-scoped entries additionally never
  fire outside their skill; affordance-abstained items never carry a
  remediation tag and so can never resolve. Flatten joins on the actual
  selected `componentId`; submit resolution checks the actual `primitive_type`
  (and skill, where scoped). Never infer compatibility from free-text
  misconception similarity.
- **Primitive-scope drift.** A primitive-scoped misconception can fire far from
  where it was captured (different grade, different skill, weeks later). v1
  mitigations: the structural eval-mode affordance gate and one-slot overwrite
  (latest diagnosis wins). If Probe R shows stale or off-topic firing, add a
  `last_detected_at` TTL — deferred, not built now.
- **Judge schema additions are optional fields.** Gemini schema complexity
  ruling applies (malformed JSON past 6+ types) — `misconception` is one
  optional string on existing judge schemas, not a nested object.
- **Abstain is success.** A distiller that writes fewer, truer misconceptions
  beats one that always produces something. Bench scenarios must include
  evidence that deserves abstention, and regressions there block rollout.
- **The retrieval matcher is not concurrency-safe** (known issue) — S4 reads
  happen inside the existing generation-context request, adding no new
  concurrency; keep it that way (no parallel per-objective misconception fetches).
