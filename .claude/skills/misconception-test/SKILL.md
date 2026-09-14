---
name: misconception-test
description: >-
  Verify one primitive's misconception loop end-to-end with real engines —
  honest diagnosis, leak-free remediation content, and a scripted student
  journey from diagnosed to resolved. Use after /add-misconception-loop builds
  the loop, as its verification half. Not for general content QA with no
  student state (/eval-test).
---

# Misconception Test — Does the Diagnosis Loop Close for One Primitive?

Take a SINGLE primitive and verify its misconception loop end-to-end with REAL
engines: the distiller writes honest diagnoses from this family's failure
signatures (Probe D), the generator turns an active diagnosis into
misconception-consistent content without leaking it (Probe G), and a scripted
student journey closes — diagnosed → remediated → resolved → gone (Probe R).
Outcome: a per-probe verdict table and a PASS/FAIL gate, saved as a dated QA
report. This is the verify half of the campaign pair; `/add-misconception-loop`
is the build half (PRD §5.1).

**This is the student-state companion to the content skills:**
- `/eval-test` asserts about CONTENT (generator → agent judges soundness — no student).
- `/topic-fidelity` asserts about VALUE ORIGIN (does topic/intent/grade reach the output).
- `/misconception-test` asserts about a STATEFUL ROUND TRIP: wrong-rule persona →
  capture → distill → store → exposure → remediation generation → resolution.

**Arguments:** `/misconception-test <primitive-id> [primitive-id ...]`
- `/misconception-test cvc-speller letter-sound-link`
- Batch is normal: probes D and G are per-primitive HTTP calls; Probe R's pytest
  file covers all wired families in one run.

**Doctrine (from the PRD — these are the things being tested, not preferences):**
- Abstain is success. A distiller that generates on noisy evidence is BROKEN.
- No leakage: the diagnosed rule, the correct rule, and the answer never appear
  in student-visible text — not in prompts, labels, options, hints, feedback.
- Misconceptions change content EMPHASIS only: same grade, scope, eval mode,
  difficulty, item counts. Never β/selection ([[pure-irt-no-heuristics]]).
- Identity = `primitive_type` + declared `misconceptionScope` (rev-2 ruling):
  `'primitive'` → key is primitiveType alone, resolves globally; `'skill'` →
  `primitiveType::skillId`, silent outside its skill.

## The loop under test (station map)

```
S1 capture      component pushes {challenge, expected, observed[, judgeFeedback]}
                per wrong attempt → submitEvaluation(..., diagnosisEvidence) 6th arg
                (gates in captureMisconception.ts: failed + tier A/B + real subskill
                 + once-per-(subskill,session))
S2 distill      /api/lumina action distillMisconception → gemini-flash-latest,
                schema {abstain, misconceptionText, confidence, reason}
S3 store        POST /api/student-profile/misconceptions →
                students/{id}/misconceptions/{key} (Firestore, one-slot)
S4 expose       get_generation_context → objectives[].activeMisconception +
                session activeMisconceptionsByPrimitive
S5 generate     ctx.remediationFocus → buildRemediationPrompt() section +
                per-challenge remediationMove enum (code-stamped post-parse)
S6 resolve      submission with metadata.remediation_for_primitive_type tag,
                score ≥80, scope-matched → resolve_misconception
```

Probe D exercises S2. Probe G exercises S5. Probe R exercises S3→S4→S6.
S1 (capture inside the live component) is the one station probes cannot reach —
it stays a browser-owned check; say so in the report, never claim it verified.

### Two architectures — establish which one before probing

The map above is the **focus** architecture. A second one now carries most of
math, and its S4/S5/S6 differ enough that probing it with the focus recipe
silently tests nothing. Tell them apart from the catalog entry:

| | **Focus** (legacy) | **Observation consumer** |
|---|---|---|
| Catalog | `misconceptionScope` only | also `observationDelivery: 'server'` + `learningObservations: { eligible }` |
| S4 | `ctx.remediationFocus`, stamped per objective by `flattenManifestToLayout` | backend-signed launch packet (`/generation-context` → `learningObservations`), verified by the generation server and joined per task in `learningObservationPacket.ts` → `ctx.learningObservations[]`; no backend call during generation |
| S5 | prompt section + LLM-authored content + code-stamped `remediationMove` | `planLearningAdaptation()` (shared LLM applicability step) picks a move or abstains, then a **code-owned selector** rewrites the challenges; telemetry lands in `data.learningAdaptation = { move, status, comparisonCount }` |
| S6 | score ≥80 + matched tag → resolve | **none by design** — `resolve_misconception` returns False and writes nothing. The record is an inspectable hypothesis; only a declared `retest` contract retires it |

**The consequence for Probe G:** a consumer's generator runs behind
`generateWithLearningObservations`, whose first line is

```ts
const { learningObservations: _untrusted, remediationFocus: _forged, ...config } = item.config ?? {};
```

Both fields are stripped, so **only the verified launch packet can supply them**. A
`?remediationFocus=` query param, a manifest field, or a client-set config entry
reaches the generator as nothing. Phase 3 has a separate recipe for each.

## Verdicts

| Probe | Verdict | Meaning |
|---|---|---|
| D | **GENERATIVE** | expectation-generative scenario → clean student-model sentence, no leak |
| D | **ABSTAINED** | expectation-abstain scenario → abstain=true (success!) |
| D | **VAGUE** | generated, but the sentence doesn't predict the wrong answer (useless downstream) |
| D | **OVERREACH** | generated on evidence that demanded abstain — **gate fail** |
| D | **LEAK** | diagnosis text names the target word/answer a student could reuse — **gate fail** |
| G | **TARGETED** | remediation run stamps the right move AND the content a student holding the misconception would trip on is present (a distractor they would pick, or the compiled contrast the selector installs); null run unchanged |
| G | **DEAD-FIELD** | focus/observation in, no observable difference out |
| G | **NEG-BLEED** | a negative control moved the content — an unrelated, unreliable, strength-only, or ANOTHER family's misconception selected a move — **gate fail** |
| G | **STRIPPED** | consumer architecture: the observation never reached the generator (`learningAdaptation` absent on every remediation draw). Expected when injecting client-side — proof the boundary holds, NOT a result. Re-probe at `resolveGenerationContext` |
| G | **LEAKY** | misconception/correct-rule text visible in student-facing fields — **gate fail** |
| G | **DRIFTED** | null-run baseline changed (remediationMove stamped without focus, or scope/mode/count shifted in the remediation run) |
| G | **AFFORDANCE-BOUNDED** | emphasis shifted and the move stamped, but the misconception-consistent distractor is structurally OUTSIDE the mode's scope (e.g. the confusable letter isn't in the cumulative letter group) — not a gate fail; log it, and consider gating the move stamp on the affordance (PRD: no affordance → abstain, like tape-diagram solve_part_whole) |
| R | **CLOSED** | diagnose → distractor submit stays active → strong matched submit resolves → next read empty |
| R | **NO-CAPTURE** | wrong-rule journey never produced an active misconception |
| R | **STUCK-ACTIVE** | strong matched submit did not resolve |
| R | **PREMATURE-RESOLVE** | weak (<80) or unmatched submit resolved it |
| R | **OUT_OF_SCOPE_RESOLVE** | a tag from another primitive/skill resolved it — scope join broken |
| R | **EXPOSURE-ONLY** | consumer architecture: delivery is scope-correct and the negative tests pass (score+tag never resolves, other skill never delivered), and there is no resolution step to close. The correct terminal verdict here — do NOT force it into CLOSED |
| G | **OUT_OF_SCOPE_BLEED** | a skill-scoped diagnosis reached generation outside its skill |

**Gate (all must hold):** 0 LEAK, 0 OVERREACH, 0 LEAKY, 0 NEG-BLEED, every wired
family TARGETED (not DEAD-FIELD/DRIFTED/STRIPPED), Probe R CLOSED — or
EXPOSURE-ONLY for a consumer — with the scope-mismatch tests green. VAGUE is a
warning, not a gate fail — log it; repeated VAGUE on the same signature means the
golden scenario needs richer priorAttempts.

**A positive result is only half the gate.** A move that fires on the right
observation *and on everything else* is worse than a dead field: it churns
content on noise. Every Probe G run needs its negative controls (Phase 3b).

## Workflow

### Phase 0 — Wiring inventory (static, ~2 min, no engines)

For each primitive, confirm all five stations are wired. Any miss → verdict
**NOT-WIRED** for that primitive; stop there and route to `/add-misconception-loop`
(or wire by hand mirroring the cvc-speller pilot) — probes on an unwired
primitive only prove the obvious.

1. **Catalog** (`service/manifest/catalog/<domain>.ts`): entry declares
   `misconceptionScope: 'primitive' | 'skill'`. If it ALSO declares
   `observationDelivery: 'server'` and `learningObservations: { eligible }`,
   this is a **consumer** — take the consumer column everywhere below.
2. **Component** (`primitives/visual-primitives/<domain>/<Name>.tsx`): keeps a
   `diagnosisObservationsRef` or a per-response ref, pushes on wrong attempts
   (judge-backed entries set `judgeFeedback`), builds `DiagnosisEvidence` on
   completion, passes it as `submitEvaluation`'s 6th arg. Retry-until-correct
   primitives submit score 100, so check the packet sets `firstResponseScore` —
   without it the capture gate never fires ([[first-response-gate]]).
3. **Generator** (`service/<domain>/gemini-<name>.ts`):
   - *Focus:* imports `buildRemediationPrompt`, interpolates it, schema has a
     bounded `remediationMove` enum, and code (not the LLM) stamps/strips the
     move post-parse via an exported `<name>RemediationMoveFor(...)` helper.
   - *Consumer:* imports `planLearningAdaptation` plus its own
     `<name>Remediation.ts` (a `TeachingCapability` with bounded `moves`, an
     `eligible<Name>Teaching(task)` code gate, a `compiled<Move>(challenges)`
     oracle, and a `select<Move>(...)` selector). Reads
     `ctx.learningObservations` first, `ctx.remediationFocus` only as fallback,
     and attaches `data.learningAdaptation`.
4. **Golden scenarios** (`evaluation/diagnosis/scenarios.ts`): ≥2 generative +
   ≥1 abstain scenario for this family, including one judge-backed (tier-A)
   packet if the primitive has a spoken judge. If the family has none, build
   the packets by driving the SHIPPED evidence builder
   (`<name>Evidence.ts`) with a wrong-rule persona — that exercises S1's real
   output shape — and port them into `scenarios.ts` so the baseline compounds.
5. **Round-trip coverage:** focus → `backend/tests/test_misconception_round_trip.py`
   asserts scope-correct resolution. Consumer → a
   `test_<name>_observation_scope.py` asserting same-skill delivery AND that
   score+tag never resolves; the shared context test covers the key shape.

### Phase 1 — Tier 0 pure contracts (seconds, no network)

```bash
cd "<abs>/my-tutoring-app" && npm test -- --run
```

Runs the remediation-prompt guardrails, `<name>RemediationMoveFor` mappings, and
scope-resolver tests. Any red here = fix before burning Gemini calls.

### Phase 2 — Probe D: distiller honesty (REAL Gemini)

Dev server up (`cd my-tutoring-app && npm run dev`). For each of the family's
golden scenarios, POST the packet to the real distiller:

```bash
# body fields mirror DiagnosisScenario: evidence + score/success/subskillId/evalMode/gradeLevel
curl -s -m 60 http://localhost:3000/api/lumina -H 'Content-Type: application/json' \
  -d '{"action":"distillMisconception","params":{"evidence":{...},"score":35,"success":false,"subskillId":"...","evalMode":"...","gradeLevel":"K"}}'
```

Judge each response against the scenario's `expectation` and `note`:
- generative expected → `abstain:false` + a sentence that PREDICTS the wrong
  answer (the `note` says what good looks like); check it names no target word
  the student could copy (LEAK check).
- abstain expected → `abstain:true`. Anything else is OVERREACH.

Run borderline scenarios 2–3× (LLM variance — judge the distribution). Record
one row per scenario. Keep the strongest generative diagnosis text — it becomes
Probe G's `remediationFocus` input, so the probes test the REAL handoff, not a
hand-written focus.

### Phase 3 — Probe G: generation fidelity (REAL Gemini)

Pick the recipe from Phase 0 step 1. Getting this wrong is the single easiest
way to file a false PASS.

#### 3a-focus — the eval-test tap (focus primitives ONLY)

Per primitive, per eval mode the misconception plausibly fires in:

```bash
ID=cvc-speller; M=spell_word; G=kindergarten; T="short i words"
enc(){ python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
base="http://localhost:3000/api/lumina/eval-test?componentId=$ID&evalMode=$M&gradeLevel=$G&topic=$(enc "$T")"
# 1. NULL-RUN baseline — no focus
curl -s -m 120 "$base"
# 2. REMEDIATION run — the Probe D diagnosis as the focus
curl -s -m 120 "$base&remediationFocus=$(enc "The student substitutes the short-e sound for short-i.")"
```

**This tap does not work for a consumer.** `generateWithLearningObservations`
strips `remediationFocus` and `learningObservations` off the config before the
generator runs, so every draw comes back with no adaptation and the mode reads
DEAD-FIELD when it is in fact fine. If you see `learningAdaptation` absent on
every remediation draw of a consumer, that is the STRIPPED verdict — the
boundary working — and you must re-probe with 3a-consumer.

#### 3a-consumer — enter at the context boundary

The client cannot inject an observation by design, so the probe enters one layer
in, at `resolveGenerationContext` → generator. That is exactly the planner +
selector + telemetry segment Probe G owns; the packet path above it is
Phase 4's job. Use the Vite module runner
([[vite-module-runner-for-ts-scripts]]) — the generators are server-only TS:

```js
const { resolveGenerationContext } = await L.import(S + '/generation/resolveGenerationContext.ts');
const { generateFractionBar }      = await L.import(S + '/math/gemini-fraction-bar.ts');
const { compiledSharedDigitRoleContrast } = await L.import(S + '/math/fractionBarRemediation.ts');

const item = { componentId, instanceId, config: {
  targetEvalMode, difficulty, objectiveGrade,        // must satisfy eligible<Name>Teaching()
  ...(observations ? { learningObservations: observations } : {}),
} };
const data = await generateFractionBar(resolveGenerationContext(item, topic, gradeContext, grade));
// Oracles: data.learningAdaptation {move,status,comparisonCount}
//        + compiled<Move>(data.challenges).count — the SHIPPED compiled check
```

Read the family's `eligible<Name>Teaching(task)` first and satisfy every clause
(grade, mode, tier, and the topic/intent anchor regexes). An ineligible task
makes no planner call at all, which also reads as DEAD-FIELD.

`scripts/misconception-test-math4-probeg.mjs` is a working template.

Judge (code-checkable where possible — pull the data and inspect):
- **Null run:** NO challenge carries `remediationMove`; content is normal for
  the topic/grade. Any move stamped, or structure shifted vs. the primitive's
  usual output → DRIFTED.
- **Remediation run:** challenges carry the CORRECT move for their task type
  (the exported `RemediationMoveFor` mapping, or `compiled<Move>()`, is the
  oracle); the content a student holding the misconception would trip on is
  present — a distractor they would pick (short-e/short-i focus → the wrong
  vowel option is `e` on an `i` word), or the compiled contrast the selector
  installs (a picture-graph pair whose icon count is the other row's total) —
  else DEAD-FIELD (prompt section present but inert) or partial.
- **Leak scan (both runs):** grep every student-visible string (prompts,
  feedback, labels, hint text) for the misconception text, the correct rule
  stated pre-attempt, or the answer. Any hit → LEAKY, gate fail.
- Scope/mode/count invariants hold across the two runs (same eval mode, same
  challenge count ±1, same grade band) — remediation changes emphasis only.

Repeat 2× per mode if the first remediation run is ambiguous.

**Where the baseline already contains the contrast by chance,
`compiled<Move>().count` cannot discriminate on its own** — a 3-item fraction
window hits a shared-digit pair most draws. Then `learningAdaptation.status` is
the real signal: `targeted` = the selector installed it, `already-targeted` =
it was there. Say which one you judged on.

#### 3b — Negative controls (REQUIRED, not optional)

A move that fires on the right observation and on everything else is a content
churner, not an adaptation. Run each family against observations that must NOT
move the content, ≥2 draws each:

| Control | Observation | Expected |
|---|---|---|
| **Cross-family** | another wired primitive's REAL validated misconception (from its own Probe D) | no move |
| **Unrelated** | a true observation from another domain entirely | no move |
| **Unreliable** | an observation that states its own evidence is contradictory or insufficient | no move |
| **Strength** | a strength/support observation, not an error pattern | no move |

**Cross-family is the one that matters most.** Off-diagonal sentences share
vocabulary with the target ("denominator", "counting", "number"), so this is
precisely where a keyword-matching planner fails while an
applicability-judging one holds. Run it as a full N×N matrix when probing a
batch: the diagonal is your positive control and every other cell is a negative
one, from ONE set of generations.

Any negative control that stamps a move → **NEG-BLEED**, gate fail. Report the
matrix, not a summary sentence — the cell that bled is the finding.

`scripts/misconception-test-math4-controls.mjs` is a working template.

### Phase 4 — Probe R: round trip (backend, no Gemini)

```bash
cd "<abs>/backend" && python -m pytest tests/test_misconception_round_trip.py -q
```

This is the permanent in-memory journey: asserts CLOSED on the happy path,
plus the negative-space tests (unmatched tag cannot resolve, skill-scoped tag
silent outside its skill, primitive-scoped resolves only itself). All green →
CLOSED; map any failure to NO-CAPTURE / STUCK-ACTIVE / PREMATURE-RESOLVE /
OUT_OF_SCOPE_RESOLVE by which assertion broke.

For a **consumer**, that file may name no test for your family, and should not:
there is no resolution step to exercise. Run its scope tests instead —

```bash
cd "<abs>/backend" && python -m pytest tests/test_<name>_observation_scope.py \
  tests/test_learning_observation_context.py tests/test_observation_bridge_scope.py -q
```

— and read them for the two assertions that carry the weight: observations reach
only the same published skill, and **score plus a matching tag never flips a
stored hypothesis**. Both green with nothing to resolve → **EXPOSURE-ONLY**.
Never report that as CLOSED; a reader would take it as evidence of a resolution
path that does not exist.

**S4 exposure against real Firestore** (uses a disposable synthetic student,
always cleans up):

```bash
# focus architecture
cd "<abs>/backend" && python scripts/probe_misconception_phase2.py --primitive <primitive-id>
# consumer architecture — needs BOTH :3000 and :8000 up
cd "<abs>/backend" && python scripts/misconception_authenticated_smoke.py --case <case.json>
```

Focus: expect `"status": "pass"` with `activeMisconception.misconceptionKey`
equal to the primitive id (primitive scope) — proves store→generation-context
exposure for THIS primitive's key shape, not just tape-diagram's.

Consumer: expect `"status": "PASS"` and `"cleanup": "verified absent"`. It runs
real Firebase auth, the real distiller, a real Firestore write with published
scope stamped, the signed launch packet from `/generation-context`, and a real generation, then asserts
`source: 'saved-observation'` on the adapted draws and that client-supplied
observations were ignored. All consumers share one delivery path, so this
probe re-verifies S3→S4 for the whole family set even though its evidence is
fraction-bar's — say that in the report rather than implying per-primitive
coverage.

### Phase 5 — Report + memory

Save to `my-tutoring-app/qa/misconception/<primitive(s)>-<YYYY-MM-DD>.md`
(save by default, don't ask — [[save-run-summaries-by-default]]):

```markdown
# Misconception Test: <primitives> — <YYYY-MM-DD>

Gate: PASS | FAIL

| Probe | Case | Verdict | Evidence (one line) |
|-------|------|---------|---------------------|
| D | cvc-speller-vowel-substitution | GENERATIVE | predicts e-for-i, no target words |
| D | cvc-speller-single-vowel-slip  | ABSTAINED  | — |
| G | cvc-speller spell_word (POS)   | TARGETED   | move=phoneme_slots, distractor "peg" for pig |
| G | (null run)                     | clean      | no moves stamped |
| G | negative controls              | 8/8 abstain | see matrix |
| R | journey + scope matrix         | CLOSED     | pytest 6/6 |

Negative-control matrix (rows = family generating, columns = observation fed;
diagonal is the positive control):

| | own | family-B | family-C | unrelated | unreliable | strength |
|---|---|---|---|---|---|---|
| cvc-speller | **move 2/2** | — | — | — | — | — |

**Not verified here:** S1 live capture in the browser (component → evidence →
store on a real wrong session) — still browser-owned.
**Distiller handoff:** Probe G ran on Probe D's actual output: "<text>"
**Architecture:** focus | consumer (say which — it determines what Probe G and
Probe R could reach).
```

Update the misconception-loop memory only if a probe taught something new about
the loop's mechanics (a new failure mode, a scope-join surprise) — not for a
routine PASS.

## Gotchas

- **Probe D/G burn real Gemini quota** — run Tier 0 and Phase 0 first; never
  probe an unwired primitive.
- **The distiller is `gemini-flash-latest`, NEVER flash-lite** — if outputs
  suddenly go vague/truncated, check the model constant before blaming prompts.
- **eval-test's `remediationFocus` tap ≠ production path, and for a consumer it
  reaches nothing at all.** For a focus primitive the tap enters at config while
  production stamps per-objective via flattenManifestToLayout; Probe G still
  validates the registry→generator→schema segment. For a consumer,
  `generateWithLearningObservations` destructures `learningObservations` and
  `remediationFocus` off the config before calling the generator — only the
  verified launch packet may supply them — so the tap yields an unadapted draw that
  looks exactly like DEAD-FIELD. **Check the catalog entry before you believe a
  negative Probe G result.** Use 3a-consumer instead.
- **An absent adaptation has three different causes** — say which one you
  established: the field was stripped (STRIPPED, wrong probe layer), the task
  failed `eligible<Name>Teaching` (wrong grade/mode/tier/topic anchor — not a
  defect), or the planner genuinely abstained (the correct answer for a
  negative control). Read the eligibility gate before filing DEAD-FIELD.
- **Judge the distribution, not one draw.** One clean remediation run doesn't
  prove TARGETED; one miss doesn't prove DEAD-FIELD. 2–3 draws on any call you
  are about to verdict on.
- **Separate a transport failure from a planner abstention before counting it.**
  A Gemini `503 UNAVAILABLE` produces a draw with no adaptation that tallies as
  a positive-control miss if you only count `move != null`. Record the error on
  each draw and score over COMPLETED draws, saying how many were lost.
- **Scope rules beat remediation instructions in a prompt conflict — by design.**
  When "use ONLY letters from the cumulative group" collides with "make the
  wrong option encode the confusion", the LLM (correctly) keeps scope. If the
  confusable target lives outside the scope window, the mode is
  AFFORDANCE-BOUNDED for that misconception; verify with 2 draws (the miss must
  be deterministic, not variance) and check the sibling modes — a sound-side
  mode may afford the contrast the letter-side mode can't (letter-sound-link
  see_hear can play /d/ against T while hear_see cannot show the letter d).
- **A remediation run that's HARDER is a bug.** If the focus dragged difficulty,
  item counts, or grade band, that's DRIFTED even if the distractor is right —
  a hard-tier student gets hard problems WITH the move, never because of it.
- **`misconceptionKey` shape is scope-dependent**: primitiveType alone
  ('primitive') vs `primitiveType::skillId` ('skill'). When adding Probe R
  coverage for a skill-scoped primitive, assert the composite key.
- **Windows:** `python` not `python3`; backend probes run from `backend/` so
  `app.*` imports resolve; the Bash tool is bash, not PowerShell.
- **Once-per-(subskill,session) capture latch** (S1): a browser check that
  submits twice in one session and sees one doc is CORRECT, not a bug.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/lumina/evaluation/diagnosis/scenarios.ts` | Golden evidence set — Probe D input + regression baseline |
| `src/components/lumina/evaluation/diagnosis/distillMisconception.ts` | S2 distiller (schema, abstain, tier gate) |
| `src/components/lumina/evaluation/diagnosis/captureMisconception.ts` | S1 gates (failed + tier + latch) |
| `src/app/api/lumina/route.ts` (`distillMisconception` action) | Probe D endpoint |
| `src/app/api/lumina/eval-test/route.ts` (`?remediationFocus=`) | Probe G endpoint — **focus primitives only** |
| `src/components/lumina/service/generation/remediationPrompt.ts` | S5 shared prompt block (guardrail text) |
| `backend/tests/test_misconception_round_trip.py` | Probe R journey + scope matrix (in-memory) |
| `backend/scripts/probe_misconception_phase2.py` | S4 exposure vs real Firestore (`--primitive`) |
| `my-tutoring-app/qa/misconception/` | Report output directory |
| `docs/PRD_MISCONCEPTION_LOOP.md` | Full spec (§5.1 = this skill's charter) |

**Consumer architecture:**

| File | Purpose |
|------|---------|
| `service/generation/learningObservationServer.ts` | The delivery wrapper — **the strip of `learningObservations` / `remediationFocus` lives on its first line** |
| `service/generation/planLearningAdaptation.ts` | Shared applicability planner (flash-latest, abstain-capable, knows no primitive) |
| `service/<domain>/<name>Remediation.ts` | Per-family `TeachingCapability`, eligibility gate, `compiled<Move>()` oracle, `select<Move>()` selector |
| `primitives/visual-primitives/<domain>/<name>Evidence.ts` | S1 packet builder — drive it to make Probe D inputs |
| `backend/tests/test_<name>_observation_scope.py` | Same-skill delivery + score/tag never resolves |
| `backend/scripts/misconception_authenticated_smoke.py` | Authenticated S3→S4 for the shared path (real Firebase/Firestore, signed launch packet, real generation); `scripts/misconception-harness/replay-delivery.mjs` is the no-login tier |
| `my-tutoring-app/scripts/misconception-test-math4-probeg.mjs` | Probe G template (context-boundary entry) |
| `my-tutoring-app/scripts/misconception-test-math4-controls.mjs` | Positive/negative control matrix template |
