---
name: add-misconception-loop
description: >-
  Add, migrate, or repair a Lumina primitive's observation-driven teaching
  adaptation using the shared LLM applicability planner — factual evidence
  capture, scoped delivery, an executable teaching capability, and real-engine
  verification. Use for one primitive or a requested batch, or a
  DEAD-FIELD/NOT-WIRED finding. Not for verification alone, which is the paired
  /misconception-test.
---

# Add Misconception Loop

Make a primitive record what a learner actually did, turn a consistent error
into a saved observation, and let the **next** activity on the same skill show
content built to contrast that error — so a learner who writes 30 × 40 as 120
gets a model where 20 × 30 = 600 sits beside 3 × 2 = 6, without the lesson's
objective, difficulty, mode, count or script changing.

This is the build half of the campaign pair; `/misconception-test` is the verify
half (PRD §5.1).

## How the loop works

```
 primitive (component)                       next activity (generator)
 ─────────────────────                       ─────────────────────────
 every checked response ──► <id>Evidence.ts   catalog learningObservations.eligible(config)
                            DiagnosisEvidence          │ (mode / tier / grade gate)
                            + firstResponseScore       ▼
        │                                    learningObservationServer.ts
        ▼  isDiagnosableFailure (< 60)         verified launch packet (no backend call):
 distillMisconception (LLM) ──► hypothesis     same published subject, grade, skill
        │                                              │ ctx.learningObservations
        ▼                                              ▼
 POST /misconceptions (delivery: 'server')   planLearningAdaptation(capability, task, obs)
 stored with published scope_context           → validated move id | abstain
                                                       │
                                                       ▼
                                             code-owned selector changes content
                                             → compiled recheck → learningAdaptation
                                               { move, status, comparisonCount, source }
```

**The division of labour.** The LLM interprets relevance and picks among moves the
primitive can execute. Code owns task eligibility, allowed outputs, content
constraints and answer correctness. No diagnosis regex, keyword lists,
source-primitive-to-destination mappings, or a second applicability LLM per
primitive ([[schema-over-regex-and-prompt]]). Pure gates may check grade, mode,
tier and explicit anchors — never the meaning of an observation.

**Where things live** (under `my-tutoring-app/src/components/lumina/` unless noted):

| Piece | File |
|---|---|
| Shared planner (prompt, validation, abstention) | `service/generation/planLearningAdaptation.ts` |
| Catalog-declared delivery, one generic branch | `service/generation/learningObservationServer.ts`, called from `service/geminiService.ts` |
| Evidence contract and failure gate | `evaluation/diagnosis/types.ts` (`DiagnosisEvidence`, `isDiagnosableFailure`) |
| Capture relay to the store | `evaluation/diagnosis/captureMisconception.ts` |
| Store and delivery limits | `backend/app/services/learning_observations.py` |
| Worked consumer to copy | `service/math/areaModelRemediation.ts`, `primitives/visual-primitives/math/areaModelEvidence.ts`, `service/math/gemini-area-model.ts` |
| Identity and resolution policy | `docs/PRD_MISCONCEPTION_LOOP.md` |
| Current status and residual work | `my-tutoring-app/qa/di/BACKLOG.md` item 18, `WORKSTREAMS.md` |

## When to use

- A primitive should adapt to saved observations, or should start producing them.
- A `/misconception-test` or `/eval-test` finding says a loop field is dead or not wired.
- A requested batch of primitives.

**Not for:** verifying an existing loop (`/misconception-test`); changing a
primitive's grading or score (`/eval-fix`); strength/support observations driving
generation (not implemented — don't claim it); expanding a resolution or retest
policy without a user ruling.

## Phase 1 — Scope

For each primitive, inventory: curriculum homes (subject, grade, skill,
subskill), evidence producer, delivery, modes and tiers, executable content
levers, existing tests. Classify each as **consumer only**, **capture repair**,
or **missing teaching capability**. A primitive may consume observations
without producing them, and never inherits resolution authority.

For a batch, keep a matrix: primitive/mode, observed concept, move, delivery,
implementation status, real-probe status, residual. Build one representative
per new interaction family and verify it before repeating the pattern
([[worked-primitives-self-select]]). Continue independent items when one lacks a
legal move. Do not spawn subagents unless the user asks; route unfinished
items to the owning queue with this skill named (`/pm`). Missing evidence or a
missing move is additional work, never a reason to ship a nominal adaptation.
Preserve unrelated working-tree changes.

**A real-baseline census per candidate mode decides scope; simulation only
brackets the risk.** Draw 3 to 11 registry generations per mode before any code
and count how often the candidate contrast is already there. On ten-frame that
ruled out make_ten, subitize and a second operate move, while one simulated
distribution put the Grade 1 chance rate at 50% against 0 of 10 real sessions.
Record a "no move" verdict with one reason from this list, with the measured
rate where it applies: contrast already present (x of n real baselines); no
content lever; answer judged in code; blocked by a named defect.

## Phase 2 — Capture (skip for a consumer-only connection)

1. **Record every checked response** in the component, including tries later
   corrected: what was asked, expected, what the learner entered or chose, try
   number, the scaffold on screen, hints opened. Keep it in `student_work` and
   never infer independence from an absent correction. Grading and the submitted
   score stay unchanged.
2. **Can the submitted outcome see the error?** Mount the component, make one
   wrong first response, finish, and read `success` and `score`. Retry-until-correct
   loops and rounded per-item scores often report 100 anyway (number-line,
   fraction-circles, bar-model and area-model all did). If the error is invisible,
   set `firstResponseScore` in the evidence (percent of items with no wrong
   response); the shared gate applies its `< 60` threshold to it. The judged
   runner sets it for every pack (`hooks/judgedRunEvidence.ts`); only a
   non-judged primitive sets it itself. Queue the
   scoring defect to `/eval-fix` — do not change the score in this slice.
3. **Judged-runner primitives build no evidence.** The runner assembles it in
   `hooks/judgedRunEvidence.ts`: `firstResponseScore`, every item's first wrong
   attempt ahead of later ones under the 12-phase cap, the pack's session
   statement, the latest judge line. The pack supplies ONE `observation(item,
   { heard, verdict })` callback (facts from the item's own fields and the
   committed board, read before the verdict resets it; the runner calls it on
   every verdict, keeps all of them as `learningResponses` and the corrected
   ones as diagnosis observations, so the text must state what was heard or
   done, never the verdict) and `evidenceSummary(items)` (what a session of
   these kinds is, and what a right answer on it is, per kind). The component
   submits `summary.diagnosisEvidence`. `diagnosisObservation` is a deprecated
   corrections-only alias for packs not yet migrated.
   Do not write an `<id>Evidence.ts` builder or a `firstResponseScore` patch for a
   judged primitive; counting-board, ten-frame and base-ten-blocks had three
   copies before the runner owned it.

   **Non-judged primitives build `<id>Evidence.ts`**: a pure function returning
   `DiagnosisEvidence` or `undefined` when nothing was wrong. Facts only; no error
   type named in code. Stay inside the store's limits, because capture trims silently:

   | Field | Limit |
   |---|---|
   | `phases` | **12** — capture keeps `slice(-12)`. Emit ≤ 12 yourself with every item's first wrong attempt ahead of any later one, in the order they happened (the judged runner does this). |
   | `challenge`, `expected`, `observed`, `problem` | 2000 chars |
   | `support` | 600; `itemId`, `phase` 200 |
   | distilled `misconception_text` | 600 |
   | delivered to the planner | ≤ 10 observations, summary 4000, evidence 7000 (planner rejects > 8000) |

4. **Pass it as the sixth argument** of `submitResult(success, score, metrics, studentWork, partialCredit, diagnosisEvidence)`.
   The submitted `metrics.evalMode` is normalised to a catalog eval-mode key at
   the evaluation boundary (`evaluation/evalModeKey.ts`, in `submitResult`): a
   single-key manifest pin wins, a catalog mode is kept, a challenge type listed
   under one mode becomes that mode, anything else is kept and warned about once
   in development. Report a catalog mode from the component anyway; a challenge
   type that several modes share (knowledge-check's `multiple_choice`) cannot be
   resolved and keys IRT on the type.
5. **Declare the source** in the catalog entry: `misconceptionScope: 'skill'`,
   `observationDelivery: 'server'`. Production backend code names no primitive
   (2026-09-13 ruling); capture relays the declaration.

## Phase 3 — Capability

In `service/<domain>/<id>Remediation.ts`, define a typed move union and one
`TeachingCapability<M>` per task family (a primitive may need two — area-model
has a grid capability and a perimeter capability; the pinned mode picks one).

- **`task`** states what the learner does in every mode the capability is offered for.
- **Each move's `description`** states what it changes, what it holds, and what it
  cannot teach, with a concrete example **for every eligible mode shape**. The
  planner reads only this text: a move described with two-digit factors was
  declined 4 of 4 times in a one-digit × two-digit mode until the description
  said how a one-digit factor behaves.
- Describe executable teaching, not diagnosis wording. Use the component,
  compiler and content model as the evidence for what is executable.
- **Choose a contrast that rarely occurs by chance.** Estimate the chance rate
  (simulate the code-owned picker, or count unadapted draws). A contrast present
  in most baselines only relabels them `already-targeted` (fraction-bar: 6 of 10).

Also in that module:

| Export | Purpose |
|---|---|
| `eligible<Id>Teaching(task)` | Generator gate: grade, mode, tier, named anchors. Anchors outrank adaptation ([[trust-intent-over-hardcoded-caps]]). |
| `<id>DeliveryEligible(config)` | Catalog gate: cheap mode/tier/objective check before the packet is read. |
| `select<Contrast>(baseline, move, legal…, random)` | Deterministic selector: returns `{ challenges, status, targets, count }`; status `targeted` \| `already-targeted` \| `insufficient-capacity` \| `no-focus`. |
| `compiled<Contrast>(challenges)` | Recomputes the contrast from the final rendered fields, independent of the selector. |

Before the full probe, **run one positive planner case per eligible mode**
directly through `planLearningAdaptation`, with task text that matches that
mode's real objective. A mismatched fixture objective produces abstentions
that look like a capability failure.

## Phase 4 — Delivery and execution

1. **Catalog:** `learningObservations: { eligible: <id>DeliveryEligible }` on the
   entry. No service edit — there is one generic branch; never add a
   `componentId ===` case. Scope subject comes from `config.objectiveSubject`. A
   certified retest is a catalog `retest` declaration (`placeValueRetest`), not a
   new server module. Read `/student-data-loop` before changing delivery itself.
2. **Generator:** use the shared step in `service/generation/adaptationStep.ts`,
   never a hand-rolled copy: `plannedMode(resolution)` (the resolved catalog eval
   mode when exactly one; a blend or `mixed` is undefined), `adaptationTaskFor(ctx,
   topic, { mode, tier })`, `planAdaptation(ctx, { task, capability, eligible })`
   (no capability, no observations or an ineligible task means no planner call)
   and `stampAdaptation(move, selected)` (the one status rule: a selector's
   `no-focus` is reported as `insufficient-capacity`, never omitted). Type the
   data field as `LearningAdaptation<Move>` from `learningAdaptation.ts`. The
   planned mode is never the first allowed challenge type: ten-frame's pinned
   type for `operate` is `add`, and a capability described for `operate`
   abstains on it. Call `planLearningAdaptation` in
   parallel with any wrapper call, and never put observation text in a wrapper
   prompt or output.
3. **Execute:** for code-owned content, run the selector over the mode's full
   legal operand list, sharing the bounds constants with the random picker so a
   selected item can never leave the window; apply the move before support-tier
   flags and text are written. For model-authored content, pass only the
   validated move to the content model and validate the result. Only apply the
   move when the final mode equals the mode it was planned for.
4. **Preserve:** count, mode allocation, objective scope, support tier,
   structural bands, magnitude caps, uniqueness, answer recomputation, scripts.
   Report `already-targeted` and `insufficient-capacity` honestly; never widen a
   move silently to hit a rate.
5. **Metadata:** `learningAdaptation = { move, status, comparisonCount }`. Only the
   delivery server stamps `source: 'saved-observation'`. Planner selection is not
   delivered teaching; delivered teaching is not learning, transfer or resolution.

## Phase 5 — Verify

**Deterministic tests** (name them after the worked consumer):

| File | Must show |
|---|---|
| `<id>Remediation.test.ts` | gates per mode/grade; compiled recheck positives and negatives; selector keeps count, ids, flags, uniqueness; capacity miss returns the baseline |
| `gemini-<id>.adaptation.test.ts` | seeded baseline without the contrast gains it; **fails with the selector removed (check it)**; abstain and unknown move leave a byte-identical baseline; no planner call without observations or when ineligible; private text absent from wrapper and output; oracle clean |
| `<Component>.capture.test.tsx` | mounted: wrong first responses recorded factually, submitted outcome unchanged, gate fires; all-correct attaches no evidence |
| `<id>Evidence.test.ts` | non-judged builders: phase cap and ordering. Judged packs: the `evidenceSummary` text per kind; cap and ordering are the runner's (`hooks/judgedRunEvidence.test.ts`) |
| `service/generation/<id>ObservationServer.test.ts` | real registry path with a packet from `learningObservationPacket.fixtures.ts` (`signedObservation`): the delivered id reaches the planner, private text stays out, ineligible tasks and requests without a packet never plan, abstention claims no origin |

**Real engines.** Copy `my-tutoring-app/scripts/probe-area-model-applicability.mjs`
(real distiller → planner → registry generator) and run the delivery replay,
which needs no login and no backend: `backend/scripts/project_learning_observation.py
<capture.json> <scope.json> --key <hex>` projects the capture into the launch packet
with the production packet code and signs it as the backend would;
`my-tutoring-app/scripts/misconception-harness/replay-delivery.mjs <case.json>
--draws N --key <hex>` runs production `generateComponentContent` with that packet
(plus anonymous, forged, tampered and foreign-key controls) and writes
`<case>.replay.json`. Do NOT write a per-primitive authenticated probe; the one
`backend/scripts/misconception_authenticated_smoke.py --case <case.json>` covers
login → capture → signed packet → generation for the shared path and runs only
when shared capture, store, packet or delivery code changes.

- **Generate through the registry, not the eval-test URL.** Through the Vite
  module runner, import `service/geminiService.ts` (registers every generator and
  exports `normalizeGradeLevel`) and `service/registry/contentRegistry.ts`, then call
  `getGenerator(id)(item, topic, gradeContext, normalizeGradeLevel(gradeLevel))`
  with `config.learningObservations` set — what the consumer branch passes after
  reading the verified packet. The eval-test `?remediationFocus=` parameter and client
  `learningObservations` are stripped from every declared consumer, so a probe
  through them reports every draw unadapted.
- **Build evidence with the shipped evidence module**, not hand-written packets.
  For a judged primitive that is `judgedRunEvidence` over the mounted pack's
  `diagnosisObservation`. `scripts/misconception-harness/judged-evidence-census.mjs`
  does this for every declared judged source (real generation → mounted pack →
  real distiller, report under `artifacts/learning-applicability/judged-census/`)
  and is the rerun after any runner, capture or observation-text change.
- **Cases, with expected outcomes written in the script before running:**
  distilled text; two meaning-preserving paraphrases; each eligible mode and the
  hard tier; unrelated; a nearby concept the move cannot teach; contradictory
  evidence; an ineligible mode; a single slip that the gate must stop; and a
  cross-representation case marked exploratory. Repeat borderline cases (≥ 4
  draws) before judging.
- **Classify every draw** — never a bare pass/fail:

  | Outcome | Meaning | Action |
  |---|---|---|
  | `pass` | expected decision, compiled contrast present (count `already-targeted` separately) | — |
  | `wrong-move` | selected where abstention or another move was expected | investigate the capability text; keep the draw |
  | `unexpected-abstain` | abstained where a move was expected | repeat; if consistent, check the description covers this mode and the fixture objective matches it |
  | `insufficient-capacity` | right move, no legal content | not a failure; report the rate |
  | `content-drift` | right decision, but structure, oracle, uniqueness or leak check fails | fix execution |
  | `service-error` | model or API error, no content | rerun that draw once; report it |

- **Report two rates:** chance rate (how often unadapted content already carries
  the contrast) and capacity-miss rate (simulate the selector over the picker for
  code-owned pools, e.g. 20,000 sessions).
- Read compiled outputs, not only metadata. For a judged primitive also read the
  item cue (`itemCue`) for rewritten and baseline items: the ten-frame contract on
  8 take away 4 refused the right answer (TF-5), and no rendered field showed it.
  Never retry a semantic failure until
  it passes: find the cause, repair the contract, keep the failed run, then rerun
  every case the repair could affect.

**Gates:** `npm run typecheck:lumina` = 0 and full `./node_modules/.bin/tsc --noEmit`
unchanged against baseline (commands in root `CLAUDE.md`); the full vitest suite;
affected backend scope/roundtrip tests. Reproduce a suspected pre-existing
failure before labelling it so. Synthetic responses never touch canonical
attempts, competencies or calibration.

## Phase 6 — Close

1. Dated report in `my-tutoring-app/qa/misconception/<id>-<date>.md`: what was broken,
   what was built, verification tables, failed runs and what each showed, rates,
   limits, residual, and the production/test/probe line ratio.
2. `qa/di/BACKLOG.md` item 18 entry and the `WORKSTREAMS.md` row, same slice
   ([[pm-function]]); findings outside this skill go to `qa/EVAL_TRACKER.md` with
   their executor.
3. `qa/HUMAN-CHECKS.md` row for browser/microphone acceptance and teaching
   effectiveness — the user closes it.
4. `artifacts/math-pedagogy-review/plans.json` entry, then
   `node artifacts/math-pedagogy-review/build-review.cjs` and `check-review.cjs`.
   If the build fails on another plan's deleted file, repair the path, not that
   plan's claims.
5. Hand off to `/misconception-test <id>` for the station inventory. For a batch,
   report per primitive, never a blanket PASS.

Do not call a consumer complete when only its planner test passes, and do not
present targeted content as learner transfer.

## Getting it wrong

- **Probe through the eval-test tap** → every draw unadapted, and the run looks
  like a planner failure.
- **Describe a move for one mode shape only** → the planner abstains in the others
  while tests (which mock the planner) stay green.
- **Emit more than 12 phases** → live capture stores only the last 12; the first
  errors disappear without an error.
- **Skip the score-visibility check** → the gate never fires in production, while
  the probe (which sends evidence directly) passes.
- **Pick a common contrast** → most adapted draws are `already-targeted` and the
  learner sees no change.
- **Copy the Place Value regex** → it survives only inside that primitive's legacy
  retest certification; never reuse it in a generation consumer.

Known gap: every consumer still copies its own probe scripts; a shared fixture-driven
harness is queued in `my-tutoring-app/qa/HANDOFF-misconception-probe-harness-2026-09-13.md`.
