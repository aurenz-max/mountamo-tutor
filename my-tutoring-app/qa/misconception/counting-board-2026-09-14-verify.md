# Misconception Test: counting-board — 2026-09-14

`/misconception-test counting-board`, the verify half of the `/add-misconception-loop counting-board` build
(same-day report: `counting-board-2026-09-14.md`). Real engines throughout — no mocks.

**Architecture: consumer.** Catalog declares `misconceptionScope: 'skill'`, `observationDelivery: 'server'`,
`learningObservations: { eligible: countingBoardDeliveryEligible }`. Delivery runs through
`generateWithLearningObservations` (one generic branch in `geminiService.ts`, dispatched off the catalog
declaration) → `resolveGenerationContext` → `ctx.learningObservations` → `generateCountingBoard`, which runs
`planLearningAdaptation` against two `TeachingCapability`s (`countingBoardChangeTeaching` for take_away/add_more,
`countingBoardCountOnTeaching` for count_on) and applies a code-owned selector. No `retest` is declared, so there
is no resolution step — S6 does not exist for this primitive by design.

Gate: **PASS**

| Probe | Case | Verdict | Evidence (one line) |
|-------|------|---------|---------------------|
| D | take-away states start (matches move) | GENERATIVE | 3/3 draws predict "reports the starting amount", no numbers named |
| D | take-away states change (off-target) | GENERATIVE | 3/3 draws predict "reports the amount removed" — a different, real signature |
| D | count-on says start back (matches move) | GENERATIVE | 3/3 draws predict "repeats the hidden start" |
| D | recount-moved conservation | GENERATIVE | 3/3 draws predict "continues the count sequence" (mode has no capability) |
| D | add-more inconsistent (tier-A, judgeFeedback) | ABSTAINED | 3/3 draws — no stable rule across boards, one unreliable transcript |
| G | take_away, remediation run | TARGETED | 4/4 draws: `contrast_same_start_different_change`, oracle count=2, distractor = same-start pair |
| G | take_away, null run | clean | 2/2 draws: no move stamped, oracle count=0 |
| G | count_on, remediation run | TARGETED | 5/6 draws targeted (oracle count=1 each); 1 planner-abstain draw, LLM variance |
| G | count_on, null run | clean | 2/2 draws: no move stamped, oracle count=0 |
| G | negative controls | 14/14 abstain | see matrix — includes a same-primitive off-target signature |
| R | shared scope + delivery tests | pass (EXPOSURE-ONLY) | 8/8 pytest — see below |
| Tier 0 | vitest (5 suites) | pass | 50/50; +2 confirmatory suites (capture, observation-server): 7/7 |

## Probe D — distiller honesty

Scenarios built by driving the shipped evidence builder (`countingBoardDiagnosisEvidence`, `countingObservation`
in `countingBoardEvidence.ts`) with synthetic wrong-rule journeys — not hand-typed prose — via the Vite module
runner. All five now live in `scenarios.ts` as the compounding golden set (`counting-board-*`).

Five personas, 3 draws each (15 distiller calls total):

1. **take-away states start** — every board, the child echoes the pre-change count instead of what's left. 3/3
   `abstain:false`, clean sentences ("interprets the question... as asking for the initial total... states the
   starting amount instead of counting the items that remain"). No target numbers, no answer named.
2. **take-away states change** — a different reliable rule: echoes the amount *removed*. 3/3 generative, distinct
   wording from #1 each time. Kept as a same-primitive semantic negative control for Probe G (below).
3. **count-on says start back** — repeats the hidden starting quantity instead of counting on the visible extras.
   3/3 generative, correctly names the hidden-start behavior without stating any number.
4. **recount-moved conservation** — after the objects move, gives a number one higher than the true count, every
   time. 3/3 generative ("treats the prompt... as an instruction to continue counting"). This mode has no
   `TeachingCapability` (capture-only per the build report), so this scenario tests distiller honesty in isolation
   from remediation — the distiller still produces a correct, leak-free student-model sentence with no
   remediation vocabulary in scope.
5. **add-more inconsistent** — one over, one under, one transcript-free slip; no shared rule. 3/3 `abstain:true`
   with reasons naming the inconsistency and the unreliable transcript. Includes a `judgeFeedback` line (tier-A
   packet) to exercise the DI sentinel-script path — did not push the distiller toward false generation.

**0 LEAK, 0 OVERREACH.** All five verdicts held stable across all 15 draws.

## Probe G — generation fidelity (3a-consumer)

`generateWithLearningObservations` strips `learningObservations`/`remediationFocus` from client config (verified
statically at `learningObservationServer.ts:32`), so the eval-test tap cannot reach this generator. Entered one
layer in — `resolveGenerationContext` → `generateCountingBoard` — via `scripts/misconception-test-counting-board-probeg.mjs`.

**take_away** (Kindergarten, `difficulty: medium`): fed scenario #1's actual distiller output as the observation.
4/4 remediation draws stamped `learningAdaptation: { move: 'contrast_same_start_different_change', status: 'targeted' }`;
the compiled oracle (`compiledSameStartContrast`) independently found the same-start/different-change pair the
selector installed each time. 2/2 null-run draws carried no move and oracle count 0 — no drift. Instructions,
hints and narrations scanned for leakage: none state the diagnosis or a target answer (`removed`/`start` language
is legitimate take_away task framing — the ask always names the change).

**count_on** (Grade 1, `difficulty: medium`): fed scenario #3's distiller output. 5/6 remediation draws (across two
runs) stamped `count_on_exactly_one_more` with the compiled oracle (`compiledOneMoreCountOn`) agreeing; one draw
abstained (planner variance — same clean observation both times, `gemini-flash-latest` at `temperature: 0` still
shows ~1-in-6 non-determinism here). 2/2 null-run draws clean. Judged as TARGETED on the distribution, not the
miss.

**Verdict: TARGETED for both wired modes.**

### Negative-control matrix (all draws fed to the take_away/count_on generator; diagonal = positive control)

| Observation | Mode fed | Draws | Move fired? |
|---|---|---|---|
| take-away states start (own, matches move) | take_away | 2 | **2/2 yes** |
| take-away states change (same primitive, off-target signature) | take_away | 2 | 0/2 |
| recount-moved conservation (same primitive, no capability) | take_away | 2 | 0/2 |
| fraction-bar's own misconception (cross-family) | take_away | 2 | 0/2 |
| unrelated domain (reading short vowels) | take_away | 2 | 0/2 |
| unreliable/contradictory evidence | take_away | 2 | 0/2 |
| strength observation | take_away | 2 | 0/2 |
| count-on says extras only (same primitive, off-target signature) | count_on | 2 | 0/2 |

**14/14 negative draws abstained. 0 NEG-BLEED.** The most useful cell is "same-primitive, off-target signature":
scenario #2's diagnosis is a real, GENERATIVE, take_away-mode wrong rule — and the planner still declined to fire
the take_away move, because `contrast_same_start_different_change` targets "reports the start," not "reports the
change." This is the applicability judgment discriminating within one primitive and one mode, not keyword-matching
on componentId or evalMode.

## Probe R — round trip

No `retest` capability is declared on either `TeachingCapability`, so there is no resolution step to close —
**EXPOSURE-ONLY** is the correct terminal verdict here, not CLOSED.

```
backend: pytest tests/test_observation_bridge_scope.py tests/test_learning_observation_packet.py tests/test_response_observations.py -q
8 passed
```

These are the shared (not per-primitive) delivery tests: `test_learning_observation_packet.py` +
`test_observation_bridge_scope.py` assert the signed packet carries only scope-resolved, deliverable records with
no attempt-id leakage, and that a hypothesis stamped under a stale curriculum version is excluded from a live
comparison. `test_response_observations.py::test_writer_keeps_distinct_attempts_and_first_inference_on_retry`
asserts the shared response-submission writer touches `learning_observations` only — **no misconception/progress
writer fires on a graded submission** — which is the generic form of "score + tag never resolves" the doctrine
asks for. All consumers (counting-board included) share this one delivery path; this re-verifies S3→S4 for the
whole family, not counting-board specifically. S4 against real Firestore with authenticated smoke
(`backend/scripts/misconception_authenticated_smoke.py`) was not re-run today — the shared path was already
verified 2026-09-13/14 (`four-math-consumers-verify-2026-09-13.md`, `launch-packet-delivery-2026-09-14.md`);
re-running it today would confirm the same shared path again, not add counting-board-specific coverage.

## S1 — capture (stronger than the usual "not verified" note)

`CountingBoard.capture.test.tsx` mounts the real `useJudgedScriptRunner` + `CountingBoard` component and drives
three pre-change wrong answers: produces per-board facts, submits `true/80`, sets `firstResponseScore: 40`, and
calls the distiller/store with skill scope (5/5 tests pass). `countingBoardObservationServer.test.ts` confirms the
registry path strips a forged client-side observation and an abstention carries no origin stamp (2/2 pass). This
is a jsdom-mounted component test, not a live-browser drive with a real microphone — **a true live-browser S1
check is still not verified here.**

## Tier 0

```
vitest run countingBoardRemediation.test.ts gemini-counting-board.adaptation.test.ts countingBoardEvidence.test.ts
  learningObservationPacket.test.ts resolveGenerationContext.test.ts
50 passed (50)
```

`typecheck:lumina`: 0 errors (unchanged after porting 5 scenarios into `scenarios.ts`).

## Distiller handoff (real, not simulated)

Probe G ran on Probe D's actual output, verbatim:
- take_away: *"The student interprets the question about how many are left as asking for the initial total
  quantity on the board, so they state the starting amount instead of counting the items that remain."*
- count_on: *"The student treats the stated hidden starting quantity as the total amount rather than counting on
  the additional visible objects."*

## Not verified here

- S1 live capture in a real browser with a real microphone — jsdom-mounted equivalent verified instead (above).
- S4 against real Firestore for counting-board specifically — shared-path authenticated smoke already covers this
  family generically (2026-09-13/14 reports); not re-run today.
- The other seven eval modes named in the build report as capture-only (count, give_me_n, compare, group_count,
  subitize, subitize_perceptual) have no `TeachingCapability` and were out of this probe's scope by design.

## Residual

None new. The build report's residual stands: CNB-2 (compare's larger group always drawn first, blocks a compare
move), CNB-3 (metrics `evalMode` naming mismatch), no legal move for count/recount_moved/give_me_n/subitize/group.
