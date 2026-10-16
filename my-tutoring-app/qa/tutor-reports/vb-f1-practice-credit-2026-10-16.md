# VB-F1: a spoken credit on a practice item showed nothing (2026-10-16)

Row: `qa/workspace-rollout/ROLLOUT.md` VB-F1. Executor: `/add-live-tutor-tools` (§5, a finding closes at its class).

## Mechanism

A simplify lever opens an easier practice item. When the observer credits a spoken answer on it with no transition
(the tutor talks about it before returning to the full item), `useTeachingWorkspace` called `onSolved` only for a
session item (`!practice`, in both the verdict path and the gesture path), and `useWorkspaceRunner.solved` is false on
practice. Components set their own `practiceSolved` only inside their gesture check. So a spoken practice credit
changed nothing on screen in any family, not only spatial-scene and analog-clock.

## Fix

Shared, additive (no existing option or return field changed meaning):

- `useTeachingWorkspace`: new `onPracticeSolved(practiceId, response, source)` fired on a correct practice commit
  (spoken verdict or checked gesture). It reports the practice credit to the enclosing scope.
- `runtime/practiceCredit.tsx` (new): `PracticeCreditScope` renders a kit callout ("Practice question: That's right.
  Next, the tutor brings back the full question.") while the open practice item is credited. It names no answer.
  Mounted by `SubmissionScope` (all three `withTeaching*` wrappers) and by `DiTeachingStage`.
- `useWorkspaceRunner`: passes `onPracticeSolved` through; returns optional `practiceSolved`.
- `useWorkspaceProgress`: `onPracticeSolved(practiceId, source)` option and optional `practiceSolved`.

Practice still records nothing: no `onSolved`, `onAffirmed`, `mergeResult` or advance; the session item stays unsolved.

Per primitive, 21 components (the row's list, less the four with no practice item: planetary-explorer,
mixing-and-dissolving, reaction-lab, fast-fact) also show the credited answer on their practice surface, as their
session spoken credit does: analog-clock, spatial-scene, calendar-explorer (grid), coin-counter, comparison-builder,
constellation-builder, hundreds-chart, length-lab, skip-counting-runner, time-sequencer, addition-fact-strategies,
math-fact-fluency, energy-of-reactions, equation-balancer, gas-laws-simulator, ph-explorer, stoichiometry-lab,
flight-forces-explorer, gravity-drop-tower, race-track-lab, sound-wave-explorer. The shown key is the practice item's.
Contracts say a practice item never carries the full item's answer (`practiceLeaks`), and the full item returns blank.

## Check

`J15-practice-credit-shows` in `runtime/journeySweep.test.tsx` (`driveSimplified`). On the first item whose simplify
lever opens a spoken practice item, it pulls the lever, says the practice key, and commits a credit with no transition.
It then asserts four things: the screen text changed, the item is still the held practice item, no correct attempt is
recorded on the session item, and after the return the full item's key is not newly on screen.
`JOURNEY_SWEEP_ONLY=J15` runs it alone (about 2 min).

Hits: before the fix, 196 of the 211 payloads that reached a spoken practice credit, in 58 of 63 families. After the
fix, 0. With the shared callout disabled, the 21 component displays clear their own families by themselves.
Practice items that need a learner-prepared stimulus (a roll or a build) are not driven.

## Gates

- Full journey sweep (J1-J15): 724 payloads passed; J15 drove 213 payloads in 64 families with 0 findings.
- Component tests of the 21 primitives plus `direct-instruction/`: 132 files, 1843 tests passed.
- `components/live-activity` (without the sweep): 3473 passed, 1 failed. The failure is someone else's work:
  `workspaceContract` "has a saved generated payload" for `vehicle-comparison-lab`, which is mid-binding.
- `typecheck:lumina`: 0 errors in these files. 3 errors in other agents' in-progress files:
  `EngineeringPrimitivesTester.tsx` (construction-sequence-planner), `HowItWorks.workspace.test.tsx`,
  `VehicleComparisonLab.workspace.test.tsx`.
- No Live or replay run. What the tutor is told is unchanged.

## Ratio

The runtime change is about 45 lines plus a 30-line scope component. The component changes total about 150 lines, the
sweep rule about 110 lines, and this report.
