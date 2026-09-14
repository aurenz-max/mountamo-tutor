# Misconception opportunity contract: backend ownership and evidence-based resolution

Status: HISTORICAL DESIGN HANDOFF — implementation has advanced. Start with [the current learning-observations handoff](HANDOFF-learning-observations-2026-09-12.md). Statements below about unimplemented work and a clean working tree describe the earlier session, not current repository state.

## Why this is the next slice

The user asked how misconceptions connect to primitives and curriculum skills/subskills without requiring a combinatorial mapping of every primitive × misconception × subskill × grade × tier. The discussion established a direction: separate the hypothesis, its observed evidence, the curriculum objective, and the primitive task's capability to test it. Store authoritative state in Firestore, but keep ownership and transition validation on the backend.

The immediate defect is narrower than a complete misconception taxonomy:

> A matching primitive/skill causes a remediation tag to be attached before generation. The generator may decline targeting or lose targeted items during compilation. A strong subsequent submission can still carry that tag and resolve the diagnosis, even though it did not test the wrong rule.

**First implementation target:** close that false-resolution path for `place-value-chart`, through a server-owned record of the diagnostic opportunities actually present in the compiled activity. Do not expand to all primitives or build a global ontology first.

## Read first and establish current ground truth

1. Read root `AGENTS.md`. Work and verify yourself by default; do not spawn agents unless the user requests them or an independent review is necessary under applicable instructions.
2. Read the complete `$student-data-loop` skill before changing shared submission, profile, attempt or state paths. Read `.agents/skills/add-misconception-loop/SKILL.md`, the complete `.claude/skills/misconception-test/SKILL.md`, and `my-tutoring-app/src/components/lumina/docs/PRD_MISCONCEPTION_LOOP.md`.
3. Read the [place-value pilot report](misconception/place-value-chart-2026-09-12.md), [original implementation handoff](HANDOFF-place-value-misconception-loop-2026-09-12.md), and [probe README](misconception/place-value-chart/README.md).
4. Recheck git status, revision, current implementations and queues. Preserve unrelated work.

At handoff preparation, HEAD was `34a88028121e0fddce55f6892f881fb7b36cd422`; `git status --short --untracked-files=no` showed no tracked changes. The earlier pilot's recorded revision was `2add48dac6c6220b8525f6bc6a1fc783deb951bf`. Do not assume the earlier dirty-tree snapshot is current.

## Decisions and recommendations from the conversation

The requested direction is **backend-owned state, persisted in Firestore, with a limited frontend read model**:

| Responsibility | Proposed owner |
|---|---|
| Hypotheses, evidence references and revisions | Backend services / Firestore |
| Capability definitions and verification policies | Versioned code |
| Certification that generated content contains eligible opportunities | Trusted generation server, validated/persisted through backend |
| Responses and interaction events | Frontend submits observations |
| Evidence validation and hypothesis transition | Backend canonical submission path |
| Student-facing status | Existing API or approved read projection |

The frontend must not author authoritative `resolved` state, change hypothesis revisions, or certify that remediation was delivered. An opaque opportunity-set reference can travel with the activity. Private diagnosis text and answer-bearing verification metadata must remain outside student/tutor-visible data.

Direct frontend Firestore reads are optional for approved status projections; they are not required for this slice. Prefer the existing generation-context and submission APIs. Do not introduce a second frontend-controlled state path.

**Not yet settled:** exact collection/schema names, how to authenticate the Next.js generation server to the backend, the precise independent-response threshold, legacy-policy migration, and the global taxonomy. Examples below are proposed contracts, not already-approved production schemas. Resolve ordinary implementation choices from existing architecture. Document any material learning-policy choice before enabling it.

## Current behavior to reproduce before fixing

Paths are repository-relative. `L` below means `my-tutoring-app/src/components/lumina`.

| Station | Source | Current behavior |
|---|---|---|
| Match and flatten | `L/service/manifest/flattenManifest.ts` | `misconceptionMatchesComponent` checks primitive, declared scope and skill. `flattenManifestToLayout` stamps focus and remediation identity before generation. |
| Generator entry | `L/service/geminiService.ts` | `generateComponentContent` calls the registered generator. Follow its imports to the current registry/envelope implementation; do not assume a filename. |
| Generation context | `L/service/generation/generationContext.ts`, `resolveGenerationContext.ts` | Carries private focus, objective and canonical grade; raw config carries curriculum IDs. |
| Place-value selection | `L/service/math/gemini-place-value.ts`, `placeValueRemediation.ts` | Narrow compare/medium/Grade-3 preference; no-op or saturation is possible. Diagnostics currently stay in a safe trace/QA result. |
| Final DI items | `L/primitives/visual-primitives/math/placeValueScript.ts` | `itemsFromChallenges` owns roles, spent-value suppression and item caps. Raw challenge targeting does not prove surviving opportunities. |
| Component evidence | `L/primitives/visual-primitives/math/PlaceValueChart.tsx`, `placeValueEvidence.ts`; `L/hooks/useJudgedScriptRunner.ts` | Captures wrong responses and completion metrics; follow actual emitted item outcomes and assistance information. |
| Resolution tags | `L/evaluation/remediation/remediationTransport.ts` | Checks instance, primitive and skill. Contains a tape-diagram-specific mode exclusion, not a general proof of delivered targeting. |
| Submission construction | `L/evaluation/hooks/usePrimitiveEvaluation.ts`, `L/evaluation/contexts/EvaluationContext.tsx` | Threads remediation identity and sends canonical submissions. |
| Hypothesis capture | `L/evaluation/diagnosis/captureMisconception.ts`; `backend/app/api/endpoints/student_profile.py` | Client calls the server distiller, then posts diagnosis text to authenticated backend `/misconceptions`. Backend derives student from auth but currently accepts diagnosis/scope fields from the request. |
| Store | `backend/app/db/firestore_service.py` | One active slot keyed by primitive or `primitive::skill`; no hypothesis revision contract currently established. |
| Resolution | `backend/app/services/submission_service.py` | After canonical fan-out, score ≥80 plus matched primitive/skill tags calls `resolve_misconception`. |

Read the code, not just these summaries. Some historical comments refer to subskill scope even where implementation uses skill scope. The current identity is not a global misconception ID.

### Required reproducer

Create a focused regression that:

1. Has an active place-value diagnosis and a matching manifest identity.
2. Generates a no-op or genuinely saturated task with no qualifying verification opportunity.
3. Submits a strong result with the current remediation tag.
4. Demonstrates the existing unsafe resolution path, then passes only when the new contract prevents that transition.

Keep the ordinary attempt, score, competency/IRT/lifecycle fan-out and progress intact. Absence of valid remediation evidence should block only the hypothesis transition.

## Proposed bounded architecture

### 1. Separate the hypothesis from the evidence source

Introduce enough identity to bind a verification attempt to a specific active hypothesis revision. Suggested fields:

```text
hypothesisId
misconceptionType (initially one reviewed place-value type)
revision
canonical scope identity
status
source attempt/evidence references
```

Keep the existing same-primitive/same-skill boundary initially. A source observation retains primitive, mode, item and subskill provenance. It does not automatically authorize cross-primitive or cross-skill reuse.

Revision must change when new evidence replaces/re-diagnoses the hypothesis. A lesson generated for revision N must not resolve revision N+1. Design the comparison and update atomically; a read/check/write race is not sufficient.

Do not guess missing curriculum identities or infer a parent skill by string slicing when canonical resolution is available. Include subject/grade/version context as needed by the repository's actual identity guarantees.

### 2. Define one capability contract

Use a versioned code-owned capability for `digit_face_value_for_worth` (name proposed):

- Observes: reliable bare-digit responses when worth was asked in a non-ones place.
- Does not confuse this with value-for-place-name, shifted worth, dictation errors, slips or unavailable/contradictory ASR.
- Selects: at most two same-nonzero-digit/different-legal-place contrasts.
- Requires: objective-compatible whole-number range, tier-legal highlights, supported vocabulary.
- Preserves: number/challenge count, structural demand, uniqueness, analysis/dictation separation and existing scripts.
- Verifies: eligible later item responses with their assistance/exposure history.

Maintain sparse reviewed capabilities plus predicates, not the Cartesian product of all curriculum and primitive dimensions. A second primitive only gets an edge after its specific capability is verified. Keep capability mappings outside curriculum documents.

### 3. Distinguish requested, compiled and observed opportunities

These are three different facts:

```text
focus requested
    → compatible task generated and compiled
    → eligible item actually presented and answered
```

No-op, incompatible objective, unresolved scope, zero eligible items and saturation must be explicit outcomes. Never issue resolution eligibility just because `remediationFocus` is nonblank.

Before generation, establish compatibility with the actual objective and tier. After compilation, verify the diagnostic predicate using the production compiler. Use typed scope constraints where available; do not expand the present regex guards into a pretend universal curriculum parser. Unknown compatibility must fail closed for resolution eligibility.

### 4. Persist a private opportunity-set record

Proposed record, to adapt to the actual persistence architecture:

```text
opportunitySetId
student / lesson / component-instance binding
hypothesisId + revision
capabilityId + version
verificationPolicyVersion
canonical objective/scope identity
generated-content hash + compiler/contract version
compiled eligible item IDs and verification metadata
createdAt
```

The Next.js generation server should send trusted generation evidence to the backend using an existing appropriate server authentication mechanism. The backend validates and persists it. The client receives only an opaque reference and permitted activity data.

**Trust boundary:** a logged-in student's token authenticates the student; it does not make a client-authored receipt or diagnosis trusted. Do not expose a public endpoint that accepts arbitrary eligible item IDs and calls them certified. Inspect existing service authentication, credential handling and deployed Firestore rules first. No Firestore rules file was located by the initial filename search; locate the actual deployment source before claiming rules are verified.

A content hash binds the stored plan to a payload for audit; it does not prove that the browser mounted it or that the learner answered unaided. Those require runtime observations, and their trust limits must be documented.

### 5. Validate item evidence in the existing submission path

The frontend submits the opaque reference plus relevant per-item observations through the canonical attempt route. Preserve:

- First response, judgment and reliable transcription status.
- Whether correction, hint, model or answer exposure preceded the response.
- Item presentation/completion and correspondence to the compiled eligible item.
- Attempt identity, response ordering and the existing evidence provenance.

Backend validation loads the authoritative record and checks ownership, instance, objective, current hypothesis revision, eligible items, and policy. Unknown IDs, stale revisions, substituted items, incomplete runs, duplicate submissions or missing evidence cannot earn a transition.

Do not treat a correct repetition immediately following its correction as independent success. Do not let a high session average outweigh a failed diagnostic item. Derive/reconcile assistance from available ordered events where possible; do not trust a standalone client boolean named `independent` as proof.

Keep resolution after canonical fan-out. Make transition idempotent with the canonical attempt ID. An evidence-validation/storage failure must not erase a normal learning attempt or cause duplicate fan-out on retry.

### 6. Make the policy change explicit and bounded

The pilot deliberately preserved the existing one-matched-score-≥80 rule. This new slice proposes changing resolution semantics, so version and document that change explicitly.

At minimum, the new place-value policy must require actual eligible diagnostic item evidence and must reject no-op/saturation-only sessions, corrected copies, and targeted-item failures regardless of average score. The exact positive threshold (number of independent responses, distinct contexts and possible cross-session accumulation) is a learning-policy decision still to settle. Do not invent a universal number for every primitive or label one successful retest durable mastery.

Roll out by capability/family. Legacy records need a documented conservative behavior; they must not silently bypass the new gate for this pilot. Avoid a library-wide change to unrelated primitives in the first slice.

## Existing pilot evidence and unresolved boundaries

- D: two real generative diagnoses, noisy/missing-transcript abstention 3/3; actual output feeds G.
- Latest G: three real targeted draws; controlled non-vacuity and random-draw parity tests.
- R: in-memory scope/weak/strong tests. S4: manually seeded real Firestore exposure with verified cleanup.
- Mounted component + real runner to capture seam: speech emissions and HTTP mocked, correctly labeled.
- Same-payload Live: plain, signature and independent drives PASS; cap PASS with existing warnings, zero HIGH.
- Full frontend run: 5,965 passed, 10 skipped, one reproduced unrelated fraction-circles affordance failure. Recheck current state; do not assume that failure still exists after subsequent commits.
- Backend state/harness suites: 34 passed. Lumina typecheck clean at the prior run.
- Importable bundle: `qa/misconception/place-value-chart/2026-09-12T18-53-12-730Z/run.json` under `my-tutoring-app`.

**Curriculum blocker remains real:** published Grade 3 `NBT003-02-a` describes three-digit worth; compare mode uses four-digit numbers. Do not relabel it as a valid objective for the existing contrast. This receipt/transition work can be tested independently, but an honest production lesson still needs a reviewed compatible objective or explicitly authorized scope/mode revision.

**Browser blocker was session-specific:** prior inventory returned zero browsers. Recheck in the new session. HUMAN-CHECKS #113/#63 remain open; only actual user verification closes human-owned rows. Headless Live cannot substitute for component→capture→next lesson→submission proof.

## Verification matrix

Use focused deterministic tests first, then the relevant typechecks/backend suites, then real-engine and browser checks. Include:

| Case | Required result |
|---|---|
| Matching skill, incompatible mode/objective | No resolution-eligible opportunity set |
| Generator no-op / unrelated focus | No resolution eligibility |
| Target disappears in compilation | No eligibility for the missing item |
| Saturation provides fewer than policy requires | Honest partial/skip state, no false success |
| Valid contract and sufficient qualifying responses | Exactly one correct revision-specific transition |
| Session score high, diagnostic item wrong | Remains active |
| Correct answer follows correction/model/answer exposure | Assisted evidence, not independent verification |
| Missing/conflicting transcription or scripted correction alone | Abstain from mathematical inference |
| Wrong student, instance, skill, primitive or item IDs | Reject transition |
| Receipt for prior hypothesis revision | Cannot resolve current hypothesis |
| Duplicate attempt/retry | No duplicate evidence or transition |
| Concurrent re-diagnosis and resolution | Current revision cannot be accidentally cleared |
| Missing receipt / backend issuance unavailable | Ordinary lesson can continue; no invented remediation credit |
| Client writes private hypothesis/receipt/resolution fields | Denied by the actual authorization boundary |
| Student-visible payload and tutor context | No diagnosis or private verification data leakage |

Add a revert-non-vacuity test for the original false-resolution path. Use generated boundary cases for finite constraints and targeted integration tests for joins; do not claim pairwise coverage proves every higher-order interaction. Test one real production issuance→submission path, not just manually seeded receipts.

Useful existing entry points:

```powershell
# my-tutoring-app
npm.cmd run typecheck:lumina
npm.cmd test -- --run
node scripts/probe-place-value-misconception.mjs --store --live

# backend
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' -W ignore -m pytest tests/test_misconception_round_trip.py tests/test_misconception_generation_context.py tests/test_place_value_misconception.py tests/tutor_live/test_run_tutor_live.py -q
```

Inspect flags before running. Real D/G/Live uses quota; do not rerun it before deterministic gates pass. Use existing services/credentials without exposing secrets. Preserve failed artifacts and distinguish service/auth/quota failures from pedagogical failures.

Real-store probes must atomically reserve a unique synthetic parent, reject collisions, and clean up only their own records. The store adds parent activity metadata: compare the ownership marker rather than requiring the parent to remain byte-identical. Verify cleanup before reporting PASS. Never delete or overwrite an existing learner record.

## Deliverables and non-goals

Deliver:

1. A short design/ADR naming the trust boundary, identity/revision model, verification policy and rollout/legacy behavior.
2. A failing-then-fixed reproduction of tag-without-opportunity resolution.
3. Backend-owned opportunity issuance/storage and validation integrated with the existing generator and canonical submission path for place value.
4. Item-level evidence binding and stale/duplicate/concurrency coverage.
5. Real runtime evidence, or exact remaining blockers; no full-loop claim based solely on mocks or synthetic seeded receipts.
6. A dated report and relevant owning-queue/WORKSTREAMS update. Preserve the curriculum and human-check residuals.

Do not build a new lesson launcher, change IRT selection, rewrite the tutor script, edit published curriculum directly, migrate every primitive, create a global misconception ontology, grant new frontend write access, or claim delayed transfer/mastery from the pilot.

## Paste into a new session

> Implement the bounded backend-owned misconception opportunity contract in `my-tutoring-app/qa/HANDOFF-misconception-opportunity-contract-2026-09-12.md`. Start by reproducing the case where a matching remediation tag can resolve a diagnosis even though generation delivered no eligible diagnostic opportunity. Use place-value-chart as the first capability. Bind server-certified compiled opportunities to a specific student hypothesis revision, submit item-level response/assistance evidence through the existing canonical path, and validate transitions on the backend. Firestore is persistence, not frontend authority. Preserve normal attempt/IRT/mastery fan-out, existing tutor scripts and unrelated work. Explicitly document the positive verification policy and legacy behavior; do not silently retain or reinterpret the old ≥80 shortcut. Keep the three-digit Grade 3/four-digit compare mismatch and browser acceptance open until actually resolved. Work and verify yourself, save evidence, and avoid a library-wide taxonomy migration.
