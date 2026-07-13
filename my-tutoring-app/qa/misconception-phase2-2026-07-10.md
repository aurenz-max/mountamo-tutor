# Misconception Loop — Phase 2 exposure + consumption

**Date:** 2026-07-10  
**Feature:** `PRD_MISCONCEPTION_LOOP.md`, Phase 2  
**Gate:** active Firestore diagnosis reaches the registry boundary and changes
real pilot generation without leaking the student model.

## What shipped

- Generation context batch-reads active misconceptions with mastery state and
  emits optional `objectives[].activeMisconception`.
- Lineage aliases remain readable while the stored document stays canonical.
- Manifest flatten joins diagnosis by objective id and stamps the private signal
  only on that objective's component config. `resolveGenerationContext` exposes
  it as typed `ctx.remediationFocus`.
- One shared anti-leak remediation prompt block is consumed by TapeDiagram,
  ComparisonBuilder, CompareObjects, and PhonicsBlender.
- TapeDiagram adds schema-constrained `remediationMove`; comparison gap and
  distractor moves deterministically force the difference as the unknown.
- `/api/lumina/eval-test` accepts `remediationFocus` so Probe G can exercise the
  production registry/generator path without mutating a real student.

## Runtime verification

1. `backend/scripts/probe_misconception_phase2.py --student 999904` used real
   Firestore: write active diagnosis → call generation-context assembly → see
   exact `activeMisconception` on the resolved objective → cleanup misconception
   and disposable student docs. Passed.
2. Real Gemini tape-diagram `solve_comparison` probe with the flagship
   fewer/smaller-vs-difference diagnosis: 4/4 challenges selected
   `diagnostic_distractor`, 4/4 forced `unknownPart='difference'`, all smaller
   quantities differed from the correct gap, and no student-model text leaked.
3. Real Gemini pilot probes passed for ComparisonBuilder `compare_groups`,
   CompareObjects `compare_two`, and PhonicsBlender `cvc`; no exact or generic
   diagnosis text appeared in returned component data.
4. The first phonics probe exposed a raw-config merge leak (`remediationFocus`
   rode into returned data). Fixed by stripping all registry-only fields before
   config override merge. A second probe exposed an invented remediation word;
   added a real-word constraint. Rerun returned `bat`, `dog`, `bus`, `dig`, with
   only the normal `title/gradeLevel/patternType/words` keys.
5. Vitest: 32/32 across resolver, flatten, and prompt contracts. Backend pytest:
   2/2 generation-context assembly tests. TypeScript: 811 repository-baseline
   errors, 0 in touched files.

## Still browser-owned

Phase 1's authenticated wrong-session capture smoke remains outstanding. Phase 2
was exercised at both runtime boundaries (real Firestore exposure and real Gemini
consumption), but not as a single browser lesson from captured error through the
next generated lesson. Phase 3's permanent round-trip journey should close that
full browser/headless chain together with resolution.
