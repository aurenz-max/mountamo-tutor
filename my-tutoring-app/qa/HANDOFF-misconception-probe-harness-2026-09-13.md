# Shared misconception probe harness: one runner, one fixture per primitive, no per-primitive login

Status: plan revised 2026-09-14 after a working pilot, then re-based the same day on the launch-packet
delivery (observations travel with the generate request; generation makes no backend call — see
`qa/misconception/launch-packet-delivery-2026-09-14.md`). The delivery-replay tier below is rewritten for
that path and ran for number-tracer; the generic authenticated smoke exists; the runner, fixtures and ports
do not exist yet. Executor:
`/add-misconception-loop` (its Phase 5 verification). Queue: `qa/di/BACKLOG.md` item 18.

## Why this exists

Each misconception-loop consumer currently verifies itself with two hand-written probes. One is a Node
script: real distiller → planner → generator, with fictional evidence. The other is a Python script:
disposable Firebase user → store → signed delivery → generation → verified cleanup. They differ only in
fixtures, but each slice copies about 400 lines, and the copies drift:

- Six of the seven Node probes still send the observation through the eval-test `?remediationFocus=`
  parameter. Declared consumers strip it, so a rerun reports every positive case unadapted.
- Each probe invents its own pass/fail; one counted a Gemini 503 and a legitimate capacity miss as failures.
- Fixture task text drifted from the mode it tested, producing abstentions that looked like capability defects.

The Python probe was the expensive half. Each run needed Firebase Admin credentials, a matching signing key,
the backend on :8000, a real user, a Cosmos mapping and a Firestore student. It also needs a cleanup block
that must not fail, and a `uvicorn --reload` from another session kills it mid-run. Most of what it checks
is shared code, not the primitive under test.

## What each check belongs to

| Check | Owner | Where it is verified |
|---|---|---|
| Packet signature, learner ownership, published-scope resolution at launch | shared backend | `backend/tests/test_learning_observation_packet.py` (pytest, no network) |
| Packet verification, per-task scope join, lineage, ordering, 10-row and 7000-char evidence bounds | shared frontend | `service/generation/learningObservationPacket.test.ts` |
| Capture relay body (`delivery: 'server'`, scope, packet) | shared frontend | `evaluation/diagnosis/captureLearningObservation.test.ts` |
| Catalog gate, generic branch, config stripping, `source` stamping | shared frontend + catalog entry | `service/generation/<id>ObservationServer.test.ts` (mocked models, packet from `learningObservationPacket.fixtures.ts`) and **the replay tier** (real models) |
| Evidence facts, first-response gate, phase cap | primitive | `<Component>.capture.test.tsx`, `<id>Evidence.test.ts` |
| Does the real distiller produce a usable hypothesis from this evidence? | primitive | runner stage D |
| Does the real planner pick the move, and abstain where it should? | primitive | runner stage P |
| Does the real generator execute the move within the mode's contract? | primitive | runner stage G (registry) and stage R (replay) |
| Does this subskill resolve in the published curriculum? | curriculum data | read-only `resolve_scope` check (no user) |
| The whole chain with a real account and Firestore | shared | **one generic authenticated smoke**, run when shared capture, store or delivery code changes — not per primitive |

So per primitive, nothing requires a login: the only per-primitive facts on the authenticated path are the
catalog gate and what the planner and generator do with a delivered observation, and the replay covers both.

## The delivery-replay tier (piloted)

Two pieces, both committed with the number-tracer slice:

1. **`backend/scripts/project_learning_observation.py <capture.json> <scope.json> [--check-published] [--key HEX]`**
   turns a capture payload into the launch packet the backend signs, running production `delivery_packet`
   against an in-memory record with no Firestore writes and no user. `--check-published` runs the real
   `resolve_scope` read-only against the published curriculum. `--key` also prints the packet signed exactly
   as `/generation-context` issues it.
2. **`my-tutoring-app/scripts/misconception-harness/replay-delivery.mjs <case.json> [--draws N] [--key HEX]`**
   calls production `generateComponentContent` inside `withGenerationRequest` with that packet, so the
   catalog branch, packet verification, config stripping, the real planner and the real generator all run
   unchanged; no stub server and no `LUMINA_BACKEND_URL`. With `--key` the Python-signed block is used, which
   also checks Python → TypeScript signature parity. Each draw runs a learner request; the first draw adds
   anonymous, forged-config, tampered-packet and foreign-key requests. Any backend call during generation is
   counted and reported. The report goes to `<case>.replay.json`.

It does not cover the backend's own packet issuance or Firestore reads and writes; those are the pytest rows
above plus the generic smoke (`backend/scripts/misconception_authenticated_smoke.py --case <case.json>`).

### Pilot (number-tracer, 2026-09-14)

Input: the real distiller's `after-run` hypothesis from
`artifacts/learning-applicability/number-tracer/run1/distill-after-run.json`, K `COUNT001-01-D`, sequence at medium.

| Check | Result |
|---|---|
| Offline projection with `--check-published` | available; one observation, production id hash and bounded evidence |
| Signed delivery calls reaching the stub / unsigned | 2 / 0; scope body matched `{MATHEMATICS, K, COUNT001-01, COUNT001-01-D}` |
| Learner draws | 2 of 2 `contrast_gap_positions_in_one_run`, `targeted`, `source: saved-observation` |
| Anonymous request, forged `learningObservations` + `remediationFocus` | both unadapted |
| Observation text or id in output | none |

The authenticated number-tracer probe (`backend/scripts/probe_number_tracer_authenticated.py`, run
`nt-http-qa-e9c1f11e…`, PASS, cleanup verified) ran the same afternoon and agrees; it should be the last
per-primitive authenticated probe.

## Plan

**1. Node runner** — `scripts/misconception-harness/run.mjs --fixture <id> [--run <name>] [--stages R,D,P,G,replay] [--repeat <case,...> --draws N]`.

- Boots the Vite module runner once; imports `service/geminiService.ts` and `service/registry/contentRegistry.ts`.
- **R** (rates, no model): runs the fixture's `simulate()` over 20,000 sessions for the chance rate and the capacity-miss rate.
- **D**: builds each packet with the primitive's shipped evidence module from the fixture's ledgers, posts
  `distillMisconception` to the Next app on :3000, and records the hypothesis or abstention.
- **P**: `planLearningAdaptation` with delivered-shape observations. It first runs one positive case per
  eligible mode using that mode's real objective text (a mismatched fixture objective looks like a capability failure).
- **G**: `getGenerator(id)(item, topic, gradeContext, normalizeGradeLevel(grade))` with `config.learningObservations`.
- **replay**: for the fixture's replay packet, writes `capture.json` + `scope.json`, shells out to the projection
  script, then runs `replay-delivery.mjs` in-process.
- Classifies every draw as `pass | wrong-move | unexpected-abstain | insufficient-capacity | content-drift |
  service-error` (definitions in `/add-misconception-loop` Phase 5). A `service-error` draw is rerun once.
- Writes one `report.json` per run into `artifacts/learning-applicability/<id>/<run>/<stage>/`. Stages write
  to separate files: the number-tracer probe lost its rates when a second invocation rewrote `report.json`.

**2. Fixture file** — `scripts/misconception-harness/fixtures/<id>.mjs`:

| Export | Content |
|---|---|
| `componentId`, `modes` | per mode: grade, tier, topic, intent, objectiveText, published scope, expected count |
| `evidence` | module path + response ledgers per packet, each with its expected distiller outcome |
| `plannerCases`, `generationCases` | observation, mode, tier, expected move / `null` / `exploratory`, draws |
| `recheck(data)` | independent recompute of the contrast from rendered fields (not the remediation module's function) |
| `structural(data, mode)` | shape, window and uniqueness checks; the runner adds leak and schema checks |
| `simulate(random)` | one unadapted session through the code-owned picker and the selector |
| `replay` | which packet to project, the scope, the eligible config, draws |

Fixture validation fails fast when a mode's objective text contradicts its mode or grade, or a case names a
move the capability does not offer. `scripts/probe-number-tracer-applicability.mjs` is the closest existing
shape (stages R, P0, D, P, G with pre-declared expectations and outcome classes) and should become the first fixture.

**3. Generic authenticated smoke** — EXISTS (2026-09-14): `backend/scripts/misconception_authenticated_smoke.py
--case <case.json> [--draws N]` reads the replay case and runs login → capture → `/generation-context` signed
packet (verified locally) → Next generation with the packet, without it, forged and tampered → cleanup. Run it
when `learningObservationPacket.ts`, `learningObservationServer.ts`, `generationRequest.ts`,
`captureMisconception.ts`, `learning_observations.py`, `generation_auth.py` or the generation-context endpoint
change, or before a release. It is not part of a per-primitive slice. Place Value receipts and the
two-primitive bridge stay in `probe_place_value_authenticated.py` (now fetching the packet the way a lesson
does). The six per-primitive authenticated probes were deleted with the endpoint they called.

## Order and acceptance

1. Build the runner and port **number-tracer** (code-owned runs, one capability) and **area-model** (two
   capabilities). Acceptance: each reproduces its report's final results. Number-tracer run1: distiller 5/5,
   planner 12/12, generation 24/24 + exploratory 3/3 abstain, rates as reported. Area-model final2: distiller
   4/4, planner 10/10, generation 30/31 with the miss a service error. The replay stage passes for both.
2. Port number-line (LLM-written text over code tuples), fraction-bar, bar-model, fraction-circles and
   base-ten-blocks origin. Any case that newly fails is a finding, not something to tune away.
3. Delete the per-primitive Node and Python probes once their fixture passes; saved artifacts stay.
4. Update `/add-misconception-loop` Phase 5 and `/misconception-test` Probe G. The per-primitive real-engine
   requirement becomes: runner stages R, D, P, G, replay. Drop the authenticated probe from the per-primitive
   list, and remove the skill's "Known gap" line.
5. Report in `qa/misconception/probe-harness-<date>.md`; close the item in BACKLOG item 18 and `WORKSTREAMS.md`.

## Limits and hazards

- No production code changes. A harness that needs one is reporting a finding — queue it.
- Stages D, G and replay need the running Next app on :3000 (D only) and a Gemini key; replay and G do not
  need the backend. Never start a second `next dev` (root `CLAUDE.md`).
- The projection script must import the production functions, never reimplement them; if the delivered shape
  changes, the replay follows automatically.
- `replay-delivery.mjs` sets `LUMINA_BACKEND_URL` and the signing key only inside its own process; never write
  either to an `.env` file ([[no-persisted-fault-flags]]).
- Model quota: a full number-tracer run is about 60 model calls. The sequence-window call in that generator
  currently runs away in about a quarter of draws and stalls for minutes (EVAL_TRACKER NT-13), so expect long G stages until that is fixed.
