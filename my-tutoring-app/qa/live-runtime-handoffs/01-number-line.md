# Session 01 — number-line runtime adoption

**Implemented 2026-09-17.** The brief below is preserved as the original scope.
See [action evidence](../tutor-reports/number-line-runtime-live-2026-09-17.md) and
[replication handoff](05-primitive-tools.md). The commit assumption is resolved via
imperative `flushSync` and committed refs, verified inside dispatch against actual
DOM. Number Line now uses the existing host's runtime shell. Combined planned
orders and microphone acceptance remain open.

Implement only number-line's opt-in live adapter and its focused tests. Read
`src/components/lumina/components/live-activity/runtime/README.md`, the roadmap G1–G3,
`activityContract.ts`, `NumberLine.tsx`, its current controls and jump evidence tests.
There were pre-existing uncommitted NumberLine changes when the foundation was built;
inspect the working tree and preserve them.

First resolve the actual commit boundary. NumberLineControls.advance schedules
React state, and getState is refreshed by the next commit. The runtime currently
requires synchronous mutation. Do not wrap advance and certify an immediate state
read as committed or visible. Prove acknowledgement of the real transition, including
cancel/unmount, before exposing actions. Keep this work in the existing lesson host
and preserve its voice path; the synthetic fixture was rejected as a learner demo.

Use `usePrimitiveRuntime` with a stable mount descriptor. Publish the actual objective,
resolved mode, current challenge ID, phase, attempt and checked correctness. Share the
existing learner validation functions with `execute()`; return false on refusal.
Start with advance/retry and only replay/point targets that have real handlers.
Add one scaffold/fade pair only if the component can execute it honestly. Do not
advertise all actions merely because they appear in the shared union.

Planned mode needs an explicit host-owned completion contract. Suppress its competing
`[ANSWER_CORRECT]`/`[ALL_COMPLETE]` completion turn at the source when the host owns
completion; preserve ordinary standalone behavior. Do not filter these in Python.
Record assistance and exposure; a retry/fade must not clear that history.

Certify suspension before publishing support artifacts: preserve placed points,
jump endpoints, in-progress work, phase and checked state; invalidate late callbacks.
Use prepared examples derived from the mounted payload and declare answer exposure.
Do not add generation or change task shape under an in-progress response.

Exit: real-component tests for stale challenge/revision, wrong answer then retry,
checked advance, unsupported target, scaffold/fade history, mid-work help/return,
same DOM/work preserved, and a fresh blank item after help. Run the shared runtime
suite and NumberLine tests plus Lumina typecheck. Report supported versus unavailable
actions explicitly. This session does not certify ten-frame or microphone acceptance.
