---
name: add-misconception-loop
description: Add or repair Lumina misconception-loop wiring for one primitive family. Use when a primitive captures diagnoses but does not consume activeMisconception/remediationFocus, when Probe G reports DEAD-FIELD or NOT-WIRED, or when a portfolio queue explicitly routes remediation implementation to add-misconception-loop.
---

# Add Misconception Loop

Raise one primitive family to the personalization layer without changing its learning objective, difficulty, evaluation-mode identity, or student-facing script. Treat the repository queue or handoff as the task contract; close the slice with `$misconception-test` evidence.

## Establish the contract

1. Read the owning queue item, its handoff, `src/components/lumina/docs/PRD_MISCONCEPTION_LOOP.md` §5.1, the primitive birth certificate, and the current generator/component/catalog tests.
2. Inventory the five stations from `$misconception-test`: catalog scope, component evidence capture, generator consumption, diagnosis scenarios, and round-trip coverage.
3. Preserve unrelated working-tree changes. Stop if the requested primitive or queue item is ambiguous.
4. Write an affordance inventory per evaluation mode from code-owned content levers and `tutoring.commonStruggles`. Prefer `misconceptionScope: 'skill'` unless the interaction model itself is the concept; preserve an already-reviewed scope ruling.

## Implement one bounded slice

Follow the handoff when it is narrower than the generic workflow.

1. Define a typed remediation-move union and a pure exported resolver from task identity plus `remediationFocus` to a safe enum or `null`.
2. Match only narrow, task-bounded diagnosis language. Blank, unsupported, cross-mode, or out-of-scope focus must return `null`; never guess.
3. Consume the focus at the content-selection layer that owns the relevant items. Apply remediation after eval-mode, objective/scope, and structural-difficulty eligibility, but before ordinary variance selection. Named lesson anchors outrank remediation.
4. Change emphasis only. Preserve count, mode allocation, scope, support tier, magnitude/length caps, uniqueness, answer recomputation, and every student-facing cue/correction/completion string.
5. Target no more than the reviewed dosage. Saturate honestly when the eligible pool lacks capacity; never widen scope or duplicate content to hit a quota.
6. Never return diagnosis text or `remediationFocus` in generated data. Log only reviewed safe enums, counts, and skip reasons.
7. Use `buildRemediationPrompt` only for generators whose content is legitimately authored by that model. For code-owned DI pools, do not send private diagnoses to wrapper/title prompts; use deterministic selection instead.
8. Wire missing capture, catalog, scenario, or round-trip stations only when they are part of the active slice. Do not broaden a pilot into a family sweep before its runtime gate passes.

## Pin invariants before live probes

Add focused tests that prove:

- no focus, blank focus, unsupported focus, and mode-conflict focus are baseline-compatible;
- resolver mappings are narrow and deterministic;
- targeted dosage and predicate hold where legal capacity exists;
- named anchors, structural bands, scope, item counts, uniqueness, and correct answers are unchanged;
- serialized output contains neither the diagnosis nor an unreviewed remediation field;
- revert non-vacuity: the new targeting assertions fail when the implementation is removed.

Run the narrow suite first, then the relevant typecheck and full unit suite required by the owning queue. Treat pre-existing failures as baseline only after reproducing and recording them.

## Close with the verifier

Read and execute the complete `$misconception-test` skill for the primitive. At minimum, run its static inventory and Tier 0 gates, then the real Probe G route specified by the active handoff. Real-engine probes require a clean local server and may use quota.

For Probe G compare null and remediation runs and assert:

- the intended move/predicate is observable;
- mode, count, objective scope, structural tier, and caps are unchanged;
- answers remain synchronized;
- no diagnosis or correct-rule prose leaks into student-visible or serialized data.

Do not sweep sibling generators until the pilot Probe G passes. Save the dated QA report, update the owning queue and `WORKSTREAMS.md` in the same slice, and preserve browser-only capture checks in `qa/HUMAN-CHECKS.md` for the user.

## Failure routing

- `DEAD-FIELD`: trace the value origin to the deterministic selector; do not compensate with prompt prose.
- `DRIFTED`: move remediation later in the eligibility pipeline or restore the displaced invariant.
- `LEAKY`: remove the focus from prompt/output surfaces and add a serialized-output guard.
- insufficient legal targets: log saturation and keep the ordinary eligible fill.
- live Probe G unavailable: leave the implementation and queue item explicitly unclosed with the exact runtime blocker.
