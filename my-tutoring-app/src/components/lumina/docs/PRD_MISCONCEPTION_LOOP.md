# PRD: The Misconception Loop

**Point-of-primitive diagnosis → targeted regeneration → verified resolution**

Status: SPEC — approved direction, not yet implemented
Date: 2026-07-05

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
> misconception. When the student clears one of those problems strongly, the
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
5. **v1 store is the existing store, unchanged.** One free-text active slot per
   subskill, overwritten on re-detection. No error taxonomy until the loop
   proves out. Honest abstain: weak evidence writes nothing.
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

## 4. Architecture — six stations

```
  PRIMITIVE (failure)                             NEXT LESSON
  │                                                    ▲
  │ S1 evidence packet                                 │ S5 remediationFocus on
  ▼                                                    │    GenerationContext
  S2 shared distiller ──────┐                          │    (registry boundary)
  (frontend, Gemini flash,  │                          │
   schema-constrained,      │ S3 POST misconception    │ S4 generation-context
   abstains on weak         ├────────► Cosmos store ───┘    objectives[].
   evidence)                │          (existing)           activeMisconception
                            │
  S6 resolution: remediation-tagged submit scores ≥80 → status: resolved
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
- At most one diagnosis per (subskill, session) — the store is one slot per
  subskill anyway; re-diagnosing every failure is cost without information
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
  "subskill_id": "...",
  "misconception_text": "The student thinks 'fewer' means the smaller number...",
  "confidence": "high",
  "evidence_tier": "judge",
  "source_attempt_id": "<attemptId>"
}
```

Handler is ~15 lines: auth-resolve student → `add_or_update_misconception`
(existing, `user_profiles.py:399`). No new collection, no schema change to the
frozen `/api/problems/submit` request. Sent fire-and-forget from S2; a dropped
write costs one diagnosis, never a submission.

Why a separate endpoint instead of riding `/api/problems/submit`: diagnosis is
async (fires after submit returns) and must not add LLM latency to the XP path;
and the submit schema stays untouched.

### S4 — Exposure (generation-context)

`student_profile.py` per-objective payload gains one optional field, read from
the existing store during objective-state assembly:

```json
{
  "objectiveId": "...",
  "theta": 0.4, "pCorrect": 0.62, "masteryGate": 2,
  "activeMisconception": {
    "text": "The student thinks 'fewer' means the smaller number, not the difference",
    "detectedAt": "2026-07-05T...",
    "sourceAttemptId": "..."
  }
}
```

Null when none active. The `overallSummary` and persona blocks are untouched —
persona still feeds framing only.

### S5 — Consumption (registry boundary, opt-in per generator)

1. `useExhibitSession` already holds the generation-context response per
   objective. Build `objectiveId → activeMisconception` and pass it into the
   registry dispatch alongside the existing grade/topic threading.
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

1. When `remediationFocus` is set for a component, the manifest item is tagged;
   the tag rides `PrimitiveEvaluationResult.lessonContext` and lands in the
   submit payload as `remediation_for_subskill_id` (the legacy resolve path's
   exact key).
2. `_handle_lumina_primitive` gains one small branch (the only live-path backend
   change on submit): tag present + score ≥ 80 (0–100 → legacy's ≥8 on 0–10) →
   `resolve_misconception(subskill_id)`. Resolved misconceptions vanish from S4
   on the next generation-context fetch; content returns to normal.

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

### Phase 0 — Contracts + Diagnosis Lab (frontend only)
- `DiagnosisEvidence`, `MisconceptionDiagnosis` types; `distillMisconception.ts`
  with schema + gating + abstain.
- Diagnosis Lab bench: ~8 canned evidence packets (tier A and B, including
  2–3 that SHOULD abstain), rendered with distiller verdicts.
- **Verify:** bench review — diagnoses are student-model sentences, abstains are
  honest, no answer leakage. `tsc --noEmit` clean vs baseline.

### Phase 1 — Capture on the live path
- Evidence packets from the pilot family: 3–4 math comparison/word-problem
  primitives (tier B) + one judge-driven primitive (tier A, judge schema gains
  `misconception`). Wire S2 into `EvaluationContext.submitEvaluation`
  post-submit hook.
- Backend: `POST /api/student-profile/misconceptions` → existing store.
- **Verify:** scripted wrong session on the pilot primitives → misconception doc
  visible in the Cosmos profile with correct subskill_id, tier, attempt link.
  Correct sessions and tier-C primitives write nothing.

### Phase 2 — Exposure + consumption
- S4 field in generation-context; S5 threading (`studentSignals` →
  `remediationFocus`); prompt-inject in the pilot generators (same 3–4 math gens).
- Tape-diagram additionally pilots the structural form: `remediationMove` enum
  in its response schema (affordance table in S5), code-enforced.
- **Verify:** topic-fidelity-style probe — seed a misconception on student 1004,
  run `/eval-test`-pattern generation for the pilot generators, assert the output
  (a) stresses the seeded distinction, (b) includes the diagnostic distractor,
  (c) leaks nothing in student-visible text, (d) is byte-identical to baseline
  when no misconception is active.

### Phase 3 — Resolution + ribbon trace
- Remediation tag through manifest → lessonContext → submit;
  `_handle_lumina_primitive` resolve branch; ribbon "Working on:" line.
- **Verify:** full-loop pulse-agent journey — synthetic student makes the same
  error 3×, next session generates remediation content, strong performance
  resolves it, following session generates normal content. This journey is the
  loop's permanent regression test.

### Phase 4 — Scale-out
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
Mechanical pass (parallel subagents): `remediationMove` enum in the response
schema, conditional prompt block, evidence wiring at submit, `misconception`
field on judge schemas where a judge exists. Ends by invoking the test skill —
the layer isn't raised until it closes.

**`/misconception-test <primitive-family>`** — verify skill; real Gemini, no
mocks (`/eval-test` + `/topic-fidelity` DNA). Three probes:

| Probe | Input | Checks | Verdicts | Ship gate |
|---|---|---|---|---|
| **D — Distiller honesty** | Golden evidence set: 8–12 scripted packets/family — clear signatures, must-abstain slips, noise, tier-A judge cases | Real flash distill; code checks (one sentence, banned phrases, no answer text) + LLM judge on the four criteria | GENERATIVE / VAGUE / OVERREACH / LEAK | 0 OVERREACH, 0 LEAK; ≥80% GENERATIVE on clear signatures |
| **G — Generation fidelity** | Canned misconception seeded per eval mode → real generator call with `remediationFocus` | Diagnostic distractor equals the misconception-consistent answer (code-computable for math, e.g. `min(a,b)`); leakage scan of student-visible strings; null run byte-identical to baseline; structural drift guard (IRT lane untouched) | TARGETED / DEAD-FIELD / LEAKY / DRIFTED | All TARGETED per generator × eval mode |
| **R — Round-trip** | Pulse-agent synthetic student playing a scripted mental model, headless, real pipeline | wrong ×3 → store write; next gen TARGETED; answers distractor → stays active; answers ≥80 → resolved; next gen baseline | CLOSED / NO-CAPTURE / STUCK-ACTIVE / PREMATURE-RESOLVE | CLOSED; runs on every family rollout (permanent regression) |

Phase gates: Phase 0 closes on bench review of the golden set; Phase 1 on
Probe D; Phase 2 on Probe G; Phase 3 on the first CLOSED Probe R; Phase 4
families each close on a full `/misconception-test`. The golden evidence set
is the campaign's compounding asset — every family adds its failure signatures
and must-abstain cases, and every distiller/prompt change re-runs against all
of it (diagnosis quality gets a regression baseline like tsc).

### Explicitly deferred (do not build yet)
- Misconception taxonomy / structured error codes — free text until the loop
  proves out.
- Misconception history (multiple per subskill, trend) — one slot, overwrite.
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
- **Session dedup lives frontend-side.** The once-per-(subskill, session) gate
  is in S2 state; the store's overwrite semantics are the backstop, not the gate.
- **Judge schema additions are optional fields.** Gemini schema complexity
  ruling applies (malformed JSON past 6+ types) — `misconception` is one
  optional string on existing judge schemas, not a nested object.
- **Abstain is success.** A distiller that writes fewer, truer misconceptions
  beats one that always produces something. Bench scenarios must include
  evidence that deserves abstention, and regressions there block rollout.
- **The retrieval matcher is not concurrency-safe** (known issue) — S4 reads
  happen inside the existing generation-context request, adding no new
  concurrency; keep it that way (no parallel per-objective misconception fetches).
