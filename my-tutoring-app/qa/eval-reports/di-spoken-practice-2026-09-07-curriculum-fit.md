# DI spoken practice: K curriculum probes, 2026-09-07

`say_answer`, easy, canonical grade K, exact published topic + intent; two draws per
requirement via the production eval-test dispatcher. [Actual tasks and checks](../curriculum-coverage/index.html).

- **DSP-4 — HIGH, generator/fit:** LA004-06-E (subject-verb agreement) returns `items: []`
  in both draws. The component shows its no-practice state. The endpoint incorrectly
  labels these pass because its validation does not establish a nonempty usable DI set.
  This is a failed candidate, not permission to invent a fallback or weaken the objective.
- **DSP-5 — HIGH, scope/answer shortcut:** LA005-02-I (solve riddles from clues) returns
  four answer-depicting emoji stimuli per draw. Source renders them before the response;
  sun/fish/apple/dog can be named without solving the riddle. Repair generator stimulus
  selection for clue reasoning while preserving pictured naming tasks.

Evidence: `qa/curriculum-coverage/evidence/LA004-06-E-*` and `LA005-02-I-*`, with exact
requests and source hashes. `content-checks.json` executes nonempty checks and records
the source-based stimulus finding. No live mic run; no code repair claimed.

## DSP-4 fix and retest — 2026-09-09

**Status: resolved for LA004-06-E.** The original failures above remain the pre-fix
record. A current production-path reproduction also returned `items: []`: both item
generation attempts produced four complete subject/action asks, and the existing
answer-leak gate rejected all eight because the keyed verbs (`run`, `fly`, `sleep`,
`swim`, `barks`, `sing`, `purrs`) had already been spoken in the ask.

The learner should complete an answer-free sentence using agreement information.
The task planner previously collapsed that action into generic `say_answer`; the item
model then made the action verb both context and answer, and the generator correctly
refused every leaked item. The missing invariant was that the subject and predicate
must survive as context while the grammatical key remains absent until the learner
responds.

Repair:

- `spokenPracticePlan.ts` now distinguishes `subject_verb_agreement` while mapping it
  to the existing `say_answer` runtime mode.
- Code builds paired singular/plural present-progressive frames and derives `is`/`are`,
  the opposite-form signature error, and synchronized correction text. Coverage refuses
  a session unless the requested item count, both grammatical numbers, one matched pair,
  and every number-to-key mapping survive the standard gates.
- The eval-test validator now fails an empty recognized array instead of reporting a
  warning as `status: pass`.

Verification:

- Focused suites: 163/163 passed across generator, spoken-script, DI adapter, and
  eval-test validation checks. The Lumina typecheck passed with 0 diagnostics after
  this repair; a later final rerun saw two concurrent, unrelated `numberBondScript.ts`
  missing-return diagnostics and none in the DSP-4 files.
- Three fresh production-dispatch draws: 12/12 usable items, 0 gate drops. Every draw
  contained two matched singular/plural pairs; every singular key was `is`, every plural
  key was `are`, and no ask contained its answer. Draws covered frog/rabbit, dog/bird,
  and bird/duck pairs.
- [Live judged-loop drive](../tutor-reports/di-spoken-practice-live-di-signature-2026-09-09.md):
  4/4 opposite agreement forms refused, 4/4 correct forms affirmed, correction/retry
  lines replayed in full, 0 dropped challenges, and no pack-gate findings.

The live harness sent text answers, so microphone/ASR behavior remains a human-device
check rather than evidence here. This repair intentionally covers the published K
`is/are` agreement contract; articles, pronouns, other tense forms, and original full
sentence production remain separate `k-grammar-completion` scope. DSP-5 is independent
of this finding and is not resolved by the DSP-4 evidence.

## DSP-5 retest — 2026-09-09

DSP-5 is **RESOLVED**. A fresh pre-fix production-dispatcher draw reproduced the
answer-picture shortcut in 4/4 items, extending the preserved evidence to 12/12.
The generator prompt now makes the spoken clue the sole stimulus for riddles, and
the shared item builder deterministically removes any model-generated picture
whose semantic label matches an accepted answer. It retains the complete clue as
a replayable listening stimulus; planned picture/symbol naming bypasses this
normalization.

Three post-fix riddle sessions produced 12/12 usable listening-only items with
complete clues and zero emoji. Two live symbol-naming sessions preserved 8/8
visible targets with hidden names, and one spoken-addition session preserved 4/4
facts. Focused tests: 114/114; Lumina typecheck: 0 before and after. Full diagnosis,
matrix, and the picture-plan-yield limitation are in
[`../topic-fidelity/di-spoken-practice-2026-09-09.md`](../topic-fidelity/di-spoken-practice-2026-09-09.md).

DSP-4 is resolved by the separate subject-verb repair and evidence above; this
DSP-5 retest neither supplies nor replaces that evidence.
