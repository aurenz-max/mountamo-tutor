# Lesson journeys

From `my-tutoring-app`:

```powershell
# Frozen packages → personas → real in-memory mastery/profile/selector → evidence report.
node scripts/lesson-journey.mjs --production

# After a targeted fix, regenerate through the real pipeline and compare the same contracts.
node scripts/lesson-journey.mjs --generate --production --against <previous-report.json>

# Explicit CI readiness gate for a chosen profile (execution alone otherwise exits zero).
node scripts/lesson-journey.mjs --profile fast --require-advance
```

Generation needs the existing Next server on :3000 (`--base` overrides it).
Production replay uses `backend/venv/Scripts/python.exe` on Windows, `venv/bin/python`
elsewhere (`--python` overrides it). No cloud client is constructed in replay: every
persona/seed gets a separate `InMemoryFirestoreService`. `curriculum-k.json` is a
one-time snapshot of the published K Language Arts curriculum and graph.

Other flags: `--scenario path.json`, `--out directory`, `--curriculum snapshot.json`.
Reports are timestamped JSON, Markdown and a standalone interactive HTML viewer
(`scripts/lib/lesson-journey-report.{mjs,html}`): readiness matrix, per-letter coverage
with a gap class (no surface · not asked · echo only · thin · covered), the storyboard of
what the child hears and does per block, knowledge tiles with cold/delayed probes, and
the production mastery record beside the evidence verdict. Every lesson's exposure record
is extracted from its package even when no learner reached it. Publish the `.html` as an
Artifact to share a run.
Generated packages are archived by ID; the campaign's named package copy points to
the latest generation. Replay never changes a package. Scenario, package and source
hashes survive dirty Git trees. Comparisons flag model/contract changes as non-comparable.

## How content earns a label

1. Freeze curriculum IDs, cumulative scope, prerequisites, targets and exit probes
   before generation. The starter campaign uses published Letter-Sound Groups 1–3.
   Its prerequisite chain follows their cumulative-set requirement. It is an audit
   contract, not another production planner; the existing selector sees the full graph.
2. Generate a normal Lesson Package. Fixed objectives can now carry an identical frozen
   `curatorBrief`, preserving the objective contract in a full-package run. The package
   records its generation request, including learner context when supplied.
3. Extract events from generated payloads and the components' **production cue builders**,
   in manifest order. Each event cites its item ID and JSON pointer. Only the spoken
   opening reaches the learner; private judging instructions and answer keys do not.
4. Execute a learner whose echo success is separate from knowledge. Durable gains require
   accessible, in-scope modeled relationships or corrective/retrieval feedback. Repeated
   examples have diminishing gains. Recognition, sound production, onset, keyword naming
   and decoding use separate knowledge keys. Decoding also requires known graphemes.
5. Probe before, after and after virtual retention time. Probes never teach. Word-transfer
   probes that occurred in instruction are excluded and invalidate certification. Sound
   probes check cold retrieval of the same correspondence, not novel-word transfer.
6. Emit `ADVANCE`, `REMEDIATE`, `REVIEW`, `INSUFFICIENT_EVIDENCE`, or `BLOCKED`. Every target
   needs enough independent in-lesson attempts plus passing cold and delayed evidence.
   Unknown blocks prevent advancement. Failed prerequisites block dependent lessons.
7. Replay block completions through `CompetencyService`, calibration, mastery lifecycle,
   the canonical profile and session-target selector. One block is one lifecycle submit;
   actual primitive/mode identities and validated published lineage are retained. Private
   oracle probes are never submitted. Reports identify supported success, unsupported
   confirmation recommendations, false gate-4 mastery if observed, and backfill parity.

## Implemented scope and assumptions

Adapters: `di-letter-sounds`, `letter-sound-link`, short CVC `phonics-blender`, and CVC
`di-word-reading`. Unknown components earn no inferred learning credit from their
catalog roles. Unsupported/ambiguous sound encodings abstain. Reader fit describes the
interface demand; the learner's sound inventory is separate.

`content-opportunity-v1` is an engineering model, **not a fitted human learning model**.
Explicit persona parameters are copied into reports: learning rate, forgetting, echo,
slip and access. It assumes a two-item recency buffer and at most one corrective retry.
The bridge models aggregate completion using the family's 100/67 correction weighting.
It executes backend fan-out, not frontend transport, microphone, live judge or DOM.
An inaccessible activity produces no observed backend submission.

This campaign compares personas on frozen packages. It does not yet regenerate a
different manifest from the updated planner on every virtual day. Production next
targets are recorded and audited; the campaign's readiness decision is not installed
in the student product. The default campaign certifies neither letter naming nor word
decoding. Its one generated variant per lesson and three seeds per persona are a pilot.

Human calibration must use the same cited item/cue and observed learner responses.
Review support/access classification against a replay or live sitting, then independently
label production, transfer and retention. A holistic attractiveness rating cannot fit a
learning-rate parameter. Unlabeled checks are not agreements. Real learner evidence is
required before making efficacy claims.

## Repair loop

Work on the earliest failed lesson. Route out-of-scope items to `/topic-fidelity` for
the owning generator; echoed assessments to manifest/support configuration or the
component contract; unverified blocks to `journey/extract.ts`; incorrect scope to the
published curriculum contract. Preserve package IDs and source pointers. Regenerate
with `--against` after the targeted fix. Repeat across generated variants and frozen
persona seeds before advancing the campaign's release status. Keep echo-only and
no-audio controls unable to advance; never tune the model to rescue a failing lesson.

Adversarial tests cover exposure without learning, echo success without knowledge,
audio access, missing payloads, unverified components, scope violations, hard-tier
answer modeling, keyword repetition masquerading as sound production, untaught
graphemes, contaminated probes, retention failure and blocked prerequisites. A positive
case teaches an initially unprepared learner and then verifies cold retrieval.

Validation:

```powershell
node node_modules/vitest/vitest.mjs run src/components/lumina/service/qa/lessonBench src/components/lumina/service/manifest/catalog/affordances.test.ts src/components/lumina/service/exhibitAssembly.test.ts
node scripts/typecheck-lumina.js
# From backend:
.\venv\Scripts\python.exe -m unittest tests.pulse_agent.test_lesson_journey -v
```

Bench reruns now inherit `keep` only when payload, objective, intent, title, grade and
configuration match. Both score-comparison sides use the current scorer/catalog.
Historical carried labels remain historical artifacts, not fresh human reviews.
