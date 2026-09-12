# Place-value misconception pilot: implement, test, and demonstrate

Status: IMPLEMENTED; end-to-end acceptance BLOCKED on curriculum/mode mismatch and unavailable browser. D/G, in-memory R, real-store S4, mounted component/capture seam and same-payload Live verified. Cap retains existing WARNs. See [dated evidence report](misconception/place-value-chart-2026-09-12.md); #113/#63 and the broader portfolio remain open.

The user explicitly selected `place-value-chart` as the first new misconception loop after the [math pedagogy review](../../artifacts/math-pedagogy-review/index.html). Target: **the learner treats a digit as having its face value regardless of its column**, e.g. says “four” when the highlighted 4 is worth forty. Complete one bounded implementation and demonstrate its behavior through the existing harnesses. Do not finish at catalog wiring, a prompt change, or passing mocked tests.

## Start here

1. Read repository `AGENTS.md`. Work yourself by default; preserve unrelated edits, especially the ongoing base-ten and fraction work.
2. Read `.agents/skills/add-misconception-loop/SKILL.md` from the repository root and the COMPLETE `.claude/skills/misconception-test/SKILL.md`. The latter exists locally even if it is missing from the session's skill catalog.
3. Read `my-tutoring-app/src/components/lumina/docs/PRD_MISCONCEPTION_LOOP.md` §5.1 and the source paths below. Use `$student-data-loop` before any shared submission/profile changes.
4. Recheck current source and working-tree state; this handoff describes the September 12 snapshot. Record the revision and relevant dirty files in the run report.
5. Implement and verify the pilot, make its results reviewable from the HTML review, then demonstrate it to the user. No new primitive or library-wide migration is requested.

All paths below are repository-relative unless a command states a working directory.

## What already exists

| Station | Current implementation | What the pilot must establish |
|---|---|---|
| Catalog | `.../service/manifest/catalog/math.ts`, `place-value-chart` entry | Currently no `misconceptionScope`. Declare and test a deliberate scope. |
| Student interaction | `.../primitives/visual-primitives/math/PlaceValueChart.tsx` | Already a live-judged DI port, not an MC chart. Preserve it. |
| Evidence | Component `diagnosisObservation`, `handleFinished`, shared `useJudgedScriptRunner` | Already builds task/expected/observed and submits `summary.diagnosisEvidence`. Prove capture on the actual failure path. |
| Generation | `.../service/math/gemini-place-value.ts` | Uses local number pools and code-owned challenges. No remediation consumption in the inspected file. |
| Script compiler | `.../primitives/visual-primitives/math/placeValueScript.ts` | Builds real `find_place`, `say_value`, `build_number` items with anti-recall gates. Remediation must survive these gates. |
| DI harness | `.../service/qa/di/diDrivePlan.ts`, `placeValueChartAdapter` | Already knows bare-digit, shifted-place, wrong-place-name and writing signatures. Reuse the adapter. |
| Distiller | `.../evaluation/diagnosis/scenarios.ts`, `distillMisconception.ts` | Add pilot golden scenarios and run the real distiller. |
| Stateful loop | `backend/tests/test_misconception_round_trip.py`, `test_misconception_generation_context.py` | Add primitive-specific scope and resolution coverage. |

Here `...` expands to `my-tutoring-app/src/components/lumina`.

Read the current oracle `service/qa/oracles/place-value-chart.ts` and its tests, plus `primitives/visual-primitives/math/__tests__/PlaceValueChart.di-script.test.ts`. Some generator/oracle comments still describe click-era choices: the live component and script compiler determine what the child actually encounters.

Historical evidence: `qa/tutor-reports/place-value-chart-live-di-{plain,signature}-2026-08-18.md` demonstrates prior text-driven judge behavior. It does **not** prove this new remediation loop, present-day microphone reliability, or live browser capture. Existing microphone acceptance is tracked under HUMAN-CHECKS #113 / #63; preserve those rows.

## Pedagogical and implementation contract

### One wrong rule, not all place-value errors

Implement a typed move such as `contrast_digit_worth` and a pure resolver that recognizes narrow evidence of **bare digit supplied when worth was asked**. Distinguish it from these other errors, which remain no-ops in this pilot:

- the digit's value supplied when its *place name* was asked;
- a place-shifted value, such as four hundred for forty;
- omitted zero or transposed columns in dictation;
- a random numerical slip, missing transcript, or uncertain speech recognition.

Use `misconceptionScope: 'skill'` for the initial design: this is a mathematical rule, not simply an interface convention. Verify both real `skillId` and `subskillId` reach capture. The key should be `place-value-chart::<skillId>`. Do not substitute a guessed skill ID to pass a probe. If inspection uncovers an existing reviewed scope ruling, document and reconcile it before changing that ruling.

### Start with a tractable pilot

First live target: `compare`, `medium`, an explicitly resolved Grade 3 place-value objective within the current four-digit mode. Here “compare” is the existing eval-mode name; its current interaction is place/value speech plus dictation, not a new comparison-choice task.

Desired content move: select **up to two surviving `say_value` opportunities contrasting the same nonzero digit at different legal non-ones places**. That makes the wrong rule predict the same bare-digit response while the correct worth differs. Preserve ordinary eligible items as transfer opportunities. Verify this contrast is legal under the current tier's highlight policy before implementing it.

- Selection precedence: eval mode → objective/grade/range and named anchors → structural tier → remediation preference → ordinary variety.
- Apply targeting in the code-owned number/highlight selection. Gemini currently supplies a title/description wrapper; do not send diagnosis prose to that wrapper.
- Do not increase magnitude, count, nonzero-column demand, or highlight difficulty to create a contrast. No decimals, zero highlighted digits or unsupported vocabulary.
- Keep all existing tutor asks, correction, affirmation, retry and completion templates unchanged. Targeted teaching comes from better selected examples and the existing correction sequence.
- Preserve challenge uniqueness, answer recomputation and analysis/dictation separation. A printed analysis number must not later become dictation; an already spoken value must not become a fake independent value probe.
- Compute target coverage **after `itemsFromChallenges`**, not just on raw challenges. That compiler alternates analyze/dictate roles, suppresses repeated place asks and already-spoken values, and has an item cap. A targeted challenge can otherwise disappear or become a writing item.
- If legal capacity is one or zero, return an honest saturation/skip result. Never relax the tier or anti-recall gates. Do not call a zero-target sample a successful targeted demonstration.
- Freeze the no-focus path, including random draw behavior under a controlled random source. Blank, unrelated, unsupported and mode-incompatible focus must behave like no focus.
- Return no private diagnosis or `remediationFocus` in student data. Keep any approved move/count/skip diagnostics in a separate QA result or existing safe server trace; never tutor-visible state.

Broaden positive targeting to other modes only after the pilot passes. Their unsupported/no-op behavior still needs regression coverage. A two-digit mode may not afford the same two-non-ones-place contrast; do not invent one to make a coverage table green.

### Evidence must describe an observed error

The shared capture gate currently requires `success === false` or score <60, plus usable evidence and catalog scope. The component submits `success = solvedCount === items.length`. A session that is eventually all correct may therefore never diagnose even if it had wrong first attempts. Build the diagnostic journey around an **actual qualifying failed completion**, using existing attempt caps; report its metrics. Do not fabricate failure status or lower scores for the demo.

Retain first-response errors, correction exposure and later independent success in the QA trace. Do not treat a correct answer repeated immediately after its correction as independent learning.

The component uses `lastHeard` and currently has a `(nothing heard)` fallback. The shared DI evidence helper already distinguishes missing transcription from silence; trace the actual runtime wiring before changing it. Missing or contradictory ASR is not evidence of a mathematical misconception. Add an abstention case where the correction is generic/scripted and no reliable wrong response exists. A canned correction naming a likely confusion is not independent proof that the child made that confusion. Repair pilot evidence quality if needed; do not redesign ASR across all ports.

## Harness plan: what exists and what must be added

The HTML at `artifacts/math-pedagogy-review/index.html` is an inventory/policy explorer, **not an executable assessment harness**. Use the existing engines below, and surface their real output in that review. Do not make a fake interactive success animation.

### A. Repeatable pilot runner and artifact

Create `my-tutoring-app/scripts/probe-place-value-misconception.mjs` (proposed new file). It should orchestrate/save the real distiller and eval-test calls, enforce content invariants, and emit a timestamped JSON + readable report under `qa/misconception/place-value-chart/<run-id>/`. Persist sanitized inputs, outputs, seeds where controlled, content hashes, per-gate assertions and blockers. Use request bodies or local input files for sensitive diagnostic text rather than logging it in broadly shared URLs. Synthetic diagnosis text may be stored in private QA artifacts; never include credentials, user identifiers or real student transcripts in exported demos.

Add a small results viewer/link for the place-value card in the HTML review. Prefer loading the exported synthetic JSON with a local file picker so the report remains usable offline, without authenticated browser calls or CORS assumptions. Show actual run ID/time and separate states: NOT RUN / PASS / FAIL / BLOCKED. Show baseline and targeted examples, the compiled item predicate, diagnosis/abstention verdicts, state transitions and links to the transcript/report. Make an old imported run visibly an old run.

The HTML is generated: edit `artifacts/math-pedagogy-review/review.template.html` and rebuild with `node artifacts/math-pedagogy-review/build-review.cjs`; do not edit only generated `index.html`. Preserve all inventory entries and filters. Keep synthetic fixture reports visibly labeled; fixtures may test the viewer but cannot supply a live PASS.

### B. Tier 0: deterministic contracts before quota

Add focused tests for:

1. Resolver positive and negative cases; all four eval modes and easy/medium/hard boundaries.
2. Legal target contrast in the **compiled items**, exact count/role allocation preservation for controlled comparable fixtures, scope, tier, uniqueness, supported word forms and derived answers.
3. Saturation and no leakage. A short or constrained pool must terminate honestly.
4. Null/blank/unrelated focus parity with controlled randomness.
5. Evidence from repeated bare-digit errors; missing/conflicting transcription; qualification of failed completion; correct task identity in prior observations.
6. Skill scope from capture through generation exposure, flattening and remediation transport; another skill or primitive must neither consume nor resolve it.
7. Revert non-vacuity: removing the content-selection change must fail the targeting assertions. A changed title or a safe enum alone is not proof.

Use the existing place-value oracle plus DI script and runner tests. Run the focused suites first, then `npm run typecheck:lumina` and the full unit suite required by the implementation skill. Record reproduced unrelated failures separately; never relabel new failures as baseline.

### C. Probe D: real diagnosis

Add at least two generative scenarios and at least one abstain scenario to `evaluation/diagnosis/scenarios.ts`; for this spoken pilot include judge-backed evidence plus noisy/missing-transcript abstention.

Suggested positive scenarios use different legal numbers and digits, but the same rule: the learner repeatedly says the bare digit on `say_value` tasks in two non-ones places. Include reliable observed responses and relevant task-specific judge text. Do not prewrite the conclusion into the evidence.

POST each scenario through `/api/lumina`, action `distillMisconception`. Run borderline/noisy cases 2–3 times. Save actual diagnoses. Probe G must consume Probe D's **actual output**, not merely a hand-authored phrase the resolver was written to match. A valid diagnosis that the resolver cannot recognize is a real handoff failure to fix narrowly.

### D. Probe G: real content plus causal targeting

Existing GET route:

```text
/api/lumina/eval-test?componentId=place-value-chart&evalMode=compare&gradeLevel=Grade%203&difficulty=medium&topic=Place%20value%20in%20four-digit%20whole%20numbers
```

The route already accepts `remediationFocus` and returns `fullData`. Use `URLSearchParams`, not hand-built escaping. Check how the route carries the objective's grade; `gradeLevel` is framing, not proof of exact curriculum attribution. The production-path demonstration must use a real resolved curriculum anchor.

Compare no-focus and actual-D-focus runs through the real registry. Compile each returned payload with the same `itemsFromChallenges` used by the component/harness. Save two or three actual targeted draws for the pilot and all failures. Assert the target predicate, count/mode/tier/range invariants, clean student-visible strings and anti-recall rules. Random baseline/target differences alone are not causal proof: pair this with Tier 0 replay over controlled legal candidates, where removing targeting changes the outcome.

The verifier skill's older examples expect an MC distractor or a serialized `remediationMove`. This port has no MC row and code-owned DI content. Follow the newer add-misconception-loop DI contract: prove a **spoken wrong-rule contrast in surviving items**, with private QA instrumentation, rather than adding choices or diagnosis fields to child data. Post-attempt scripted correction and necessary dictation audio are allowed; scan leakage against the actual phase, not all answer strings indiscriminately.

### E. Probe R: scope-correct state transitions

Extend the existing backend tests for this primitive with:

```text
qualifying failure evidence → diagnosis stored with composite key
→ generation context exposes correct identity
→ manifest stamps focus only on matching primitive/skill
→ tagged weak result stays active
→ wrong primitive or skill stays active
→ matched strong result resolves
→ next active-context read no longer returns that record
```

Use an isolated synthetic student/in-memory store for automated journeys. The existing real-store exposure probe supports `--primitive` and `--scope skill`, but its body still uses a tape-comparison diagnosis/objective and a fixed default student 999904. It is transport evidence only. Adapt it or add a bounded place-value fixture, reject pre-existing probe-key collisions, and clean up only records created by this run. Never overwrite/delete an existing learner record or assume the default probe ID is vacant.

The production resolution rule is currently one matched tagged score ≥80 after the canonical fan-out. **Do not silently redesign it in this pilot.** Demonstrate that rule honestly, and separately show which correct responses were independent. Record the residual limitation: existing resolution is not durable mastery or proven delayed transfer. A generic mock-seeded R test does not prove S1 captured live evidence; label the boundary.

### F. DI live harness and browser capture

Current harness route: `/api/lumina/tutor-test?componentId=place-value-chart&probe=1&live=1&di=1&evalMode=compare...`. Current runner: `backend/tests/tutor_live/run_tutor_live.py`. It already supports `--component`, `--di`, `--di-wrong plain|signature`, `--di-cap`, `--eval-mode`, `--grade`, `--topic`, `--runs`.

**Important missing connection:** the inspected runner fetches newly generated tutor-test content and does not expose a remediation-focus or frozen-payload input. Verify the current route too. Add the narrow QA transport needed to drive the **same saved targeted payload** verified in G, preferably a validated local input artifact. Preserve production `placeValueChartAdapter` and `buildDiDrivePlan`; do not author an alternate set of script items in Python. Assert/report the content hash so a successful unrelated generated session cannot stand in for remediation proof. Suggested new CLI flag: `--di-input <saved-payload.json>`; this flag does not exist yet.

Run the pilot on real Live with plain, signature and cap behavior, including refusal of a bare digit for non-ones worth and affirmation of correct worth. Keep scripts and sentinel behavior unchanged. Existing signature mode tests several error kinds; add a narrowly scoped synthetic persona/selection only if needed to isolate the pilot wrong rule without altering shared behavior.

These drives inject student text and replay gesture evidence. They do not mount the React component, perform a real drag/type action, test microphone recognition or persist a real browser submission. Therefore also complete a component-to-capture integration check and an authenticated browser demonstration with the exact generated artifact or a proven matching production lesson:

1. With a disposable test student and resolved curriculum IDs, produce repeated qualifying wrong-rule evidence through the real component/runner path.
2. Observe the actual emitted evidence, successful diagnosis write and composite identity. Verify no raw diagnostic text is displayed to the child.
3. Generate the next lesson through generation context and flattening; show the targeted examples. A manually supplied focus alone does not satisfy this step.
4. Show correction after a wrong response, then a later unseen value answered correctly before correction. Record assistance state and avoid answers already spoken in dictation.
5. Show the actual matched submission and following active-context result. Label resolution as the current product rule.

If no browser is available, complete all independent work but mark **S1/browser demo BLOCKED**, provide the exact launch/fixture and remaining actions, and keep the overall end-to-end claim open. Do not ask for an extra general permission step to do already requested local implementation/testing. Use existing credentials without exposing them; report missing access if it blocks real probes.

## Verified command entry points

PowerShell, from `my-tutoring-app`:

```powershell
npm run dev
# In a separate terminal once ready:
npm run typecheck:lumina
npm test -- --run
```

PowerShell, from `backend` (use this interpreter if still present):

```powershell
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' -m pytest tests/test_misconception_round_trip.py tests/test_misconception_generation_context.py -q

# Existing plain/signature harness; without the new artifact transport this regenerates content.
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' tests/tutor_live/run_tutor_live.py --component place-value-chart --di --di-wrong signature --eval-mode compare --grade 'Grade 3' --topic 'Place value in four-digit whole numbers' --runs 1
```

The Live runner defaults to frontend `http://localhost:3000` and backend websocket `ws://localhost:8000/api/lumina-tutor`. Reuse or start the repository's configured local services; verify readiness and current flags before quota calls. Do not kill an unrelated running server. Record missing keys, websocket auth or quota errors as blockers, not pedagogical failures. Use at most necessary follow-up draws after a clear failure is diagnosed.

## Required final deliverables

- Working pilot, focused regression tests, scenarios and stateful coverage.
- One reproducible probe command after implementing the new runner; its README must give exact arguments and prerequisites.
- D/G/R verdict table, raw sanitized probe artifacts, controlled non-vacuity evidence and content hashes.
- Same-content Live transcript showing wrong-rule refusal, correction, later independent response and no pre-attempt answer leak.
- Browser/component capture evidence, or a precisely bounded BLOCKED item; headless Live alone cannot close it.
- HTML review showing real imported run results for `place-value-chart`, with existing search/filter controls preserved.
- A short demonstration narrative: **what the student did → what was inferred → what changed in the next content → what the student did next → what the system stored**. Distinguish scripted system behavior from evidence of a real learner's improvement.
- Dated report in `qa/misconception/`; update only the relevant owning queue/WORKSTREAMS entry and HUMAN-CHECKS residuals, preserving concurrent work. Do not close the broader scaffolding/misconception portfolio.

Completion requires actual content targeting, honest abstention, preserved instructional constraints, scope-correct state behavior and the requested demonstration. A static marker, isolated API PASS or narrated mockup is not sufficient.

## Paste into the new session

> Implement the place-value-chart misconception pilot in `my-tutoring-app/qa/HANDOFF-place-value-misconception-loop-2026-09-12.md`. Start with the confirmed bare-digit-for-worth error. Use the existing diagnosis/eval/state/DI harnesses, add the missing same-payload test transport and review-result viewer, and demonstrate the full sequence with real engine evidence. Preserve the current DI script, grade/mode/support contracts and unrelated working-tree changes. Complete the work and verification yourself; keep any unavailable browser or microphone proof explicitly open.
