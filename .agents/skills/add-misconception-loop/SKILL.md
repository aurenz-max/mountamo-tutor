---
name: add-misconception-loop
description: Add, migrate, or repair Lumina primitives' observation-driven teaching adaptations using the shared LLM applicability planner. Use for one primitive or a requested batch, missing observation consumption, or DEAD-FIELD/NOT-WIRED findings. Includes scoped evidence delivery, executable teaching capabilities, and real-engine verification.
---

# Add Misconception Loop

Connect saved learning observations to an activity's supported teaching moves through the shared LLM applicability planner. Implement the requested primitive or batch without changing its learning objective, difficulty, evaluation-mode identity, or student-facing script unless the task explicitly includes those changes.

## Architecture and source of truth

From the repository root, start with:

- `my-tutoring-app/qa/HANDOFF-learning-observations-2026-09-12.md` and the owning queue item.
- `my-tutoring-app/qa/misconception/shared-learning-applicability-2026-09-12.md` for the verified Place Value / Base-Ten pilot and its limits.
- Under `my-tutoring-app/src/components/lumina/`: `service/generation/planLearningAdaptation.ts`, `service/math/placeValueTeachingCapabilities.ts`, and the target generator/component/catalog/tests.
- `service/generation/learningObservationServer.ts` for catalog-declared delivery (`ComponentDefinition.learningObservations: { eligible, retest? }`; the generation service has one generic branch, never a `componentId ===` case) and retest receipts; `docs/PRD_MISCONCEPTION_LOOP.md` for identity and resolution policy.

The contract is:

**Scoped observations + current task + eligible teaching capabilities -> shared LLM applicability -> validated move or abstention -> content execution and verification.**

The LLM interprets relevance and chooses among supported moves. Code owns task eligibility, allowed outputs, content constraints and answer correctness. Do not introduce diagnosis regex, keyword lists, hand-authored source-primitive-to-destination semantic mappings, or a second applicability LLM per primitive. Pure resolvers may gate grade, mode, tier and explicit anchors; they must not interpret the diagnosis.

The shared planner is implemented; library-wide observation retrieval is not. Current callers supply tentative misconception text. Do not claim strengths/support or arbitrary profile observations drive generation until their delivery and consumption are implemented and tested. The old Place Value regex remains only in its legacy immediate-retest certification policy. Do not copy that recognizer into new generation consumers or silently broaden its resolution policy.

## Scope a primitive or batch

Inventory each requested primitive's scope, evidence producer, observation delivery, task/mode, executable content levers, and existing verification. Classify the work as a consumer-only connection, capture repair, or missing teaching capability. A primitive may honestly consume an observation without producing a new diagnosis or owning a resolution contract.

For a batch, keep a compact matrix: primitive/mode, observed concept, available move, delivery path, implementation status, real-probe status, and residual work. Start with a representative primitive when extending into a new interaction family; verify that pattern before repeating it. Existing Place Value/Blocks evidence supports reuse of the planner, not automatic approval of every capability. Continue independent ready items when one consumer lacks a legal move or delivery path. Batch scope does not authorize subagents; follow the user's delegation instructions and AGENTS.md.

Prefer primitives with existing factual evidence and usable content levers. Missing evidence or a missing teaching action is additional work, not a reason to manufacture a nominal adaptation. Preserve the requested scope and unrelated working-tree changes.

## Implement the consumer contract

1. **Describe the affordance.** Define a typed move union and `TeachingCapability<M>` using the shared types. State what the learner actually does, what each move changes or holds constant, and what it cannot teach. Describe the conceptual relationship when using another representation. A capability describes executable teaching, not recognizable diagnosis wording. Use the component, compiler, content model and tutoring metadata as evidence.
2. **Establish delivery.** Reuse authenticated, owner- and curriculum-scoped observation delivery. A producer joins by declaring `observationDelivery: 'server'` beside `misconceptionScope: 'skill'` in its catalog entry; capture relays it and the backend keeps no primitive table (2026-09-13 ruling: production backend code is primitive-agnostic; only tests and scripts may name a primitive). Check grade, skill/subskill lineage and publication boundaries where applicable. If the current pilot endpoint cannot serve the new consumer honestly, extend shared delivery within the task rather than copying the Place Value source lookup to every primitive. Read the student-data-loop skill before changing these paths. Preserve source observation identity; do not copy a hypothesis into each consuming primitive.
3. **Plan once.** Resolve the current objective, mode and support tier; offer only eligible moves to `planLearningAdaptation` before content generation. Supply the available observation IDs, summaries and evidence without inventing support or canonical attempt joins. No observations means no model call. Reuse the shared validation and failure behavior instead of implementing another prompt or parser. Keep general planner instructions free of primitive-specific exceptions.
4. **Execute the validated move.** For code-owned pools/DI content, apply a deterministic selector within the existing eligibility pipeline. For model-authored content, pass only the validated teaching directive to the content model and validate the result. Private observations belong in the applicability call, not wrapper/title prompts or student-visible output.
5. **Preserve the task.** Maintain count, mode allocation, objective scope, support tier, structural bands, magnitude/length caps, uniqueness constraints, answer recomputation and scripts. Named lesson anchors outrank adaptation. Bound dosage by the available affordance; report already-targeted or insufficient capacity honestly. Recompile final items before claiming the contrast survives.
6. **Keep claims separate.** Safe output metadata may report move, actual targeting status/count and verified source origin. Planner selection is not proof of delivered teaching. Delivered teaching is not evidence of learning, transfer, mastery or resolution. Preserve existing receipt and retest boundaries; a new consumer does not inherit resolution authority.

Reuse shared factual response capture, distillation, storage and profile display when a producer needs wiring. Keep expected/observed responses, phase, verdict and partial assistance factual. Do not infer independence from absent corrections. Never add a parallel learning-progress writer as part of adaptation wiring.

## Verify each connection

Run focused deterministic tests before spending real-model quota:

- Blank/no observation and ineligible tasks preserve baseline behavior; malformed decisions, unknown moves/citations and model failures abstain safely.
- The actual generator consumes a validated move. Seed or otherwise hold the baseline constant to prove a causal change; assertions must fail if the adapter is removed.
- The production compiler retains the intended contrast and correct answers, with count, scope, structure, support, anchors and scripts intact. Insufficient capacity remains a valid bounded outcome, not fabricated targeting.
- Private text stays out of wrapper prompts and serialized content. Source origin cannot be forged by client/generated metadata.
- Delivery tests cover owner/scope mismatches and the real registry path; mocked planner decisions alone do not establish semantic relevance.

Then test the real shared planner and real generator with a saved or freshly distilled synthetic observation, meaning-preserving paraphrases, unrelated observations, uncertain/contradictory evidence, and a nearby concept the activity cannot teach. For a cross-representation demonstration, use the same observation across consumers and assert distinct appropriate moves or abstention. Define expected outcomes before running; repeat informative borderline cases to assess variability rather than accepting one lucky draw.

Save all draws and inspect compiled outputs, not only metadata. Distinguish model abstention, invalid/failed planner output, wrong applicability, insufficient content capacity and execution drift. Never retry semantic failures until one passes; investigate the contract and preserve the failed evidence. Bounded capacity retries may demonstrate legal targeting, but report their frequency and retain saturated draws.

Use existing probes as starting points: `my-tutoring-app/scripts/probe-learning-applicability.mjs`, `probe-applicability-planner.cjs`, and `backend/scripts/probe_place_value_authenticated.py`. Their fixtures and scope are pilot-specific; adapt them to the requested target instead of treating their PASS as coverage for another primitive. Verify the saved-observation-to-generation path with disposable authenticated records when that path changes; verify cleanup. Synthetic responses must not update live canonical learning/calibration records.

Run the relevant typecheck and the full unit suite required by the owning queue, plus affected backend scope/roundtrip tests. Reproduce suspected baseline failures before labelling them pre-existing.

## Close and report

Use the repository verifier at `.claude/skills/misconception-test/SKILL.md` for station inventory and applicable D/G/R probes. Its older regex-resolver and diagnosis-in-content-prompt instructions are superseded by the shared planner contract above. Consumer-only exposure needs generation and delivery evidence; do not require a new diagnosis writer or resolution policy merely to make every station look complete. Run full diagnosis/roundtrip probes when changing those stations, and label untouched or browser-only stations explicitly.

Save a dated QA report and update the owning queue and `WORKSTREAMS.md`. For a requested batch, report per-primitive outcomes rather than a blanket PASS. Update `artifacts/math-pedagogy-review/index.html` through its source/build/check workflow when the work changes that review's progress claims. Leave live microphone acceptance and teaching effectiveness in `qa/HUMAN-CHECKS.md` for the user.

Report missing delivery, unsupported affordances or unavailable live probes as specific residual work. Do not call a consumer complete when only its standalone planner test passes. Do not present content targeting as demonstrated learner transfer.
