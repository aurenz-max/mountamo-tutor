# Handoff: R2 — the 26 unbound primitives without eval modes — 2026-10-16

Executor: `/add-eval-modes`, then `/add-live-tutor-tools` ("W1 minimal binding"), then `/add-support-tiers`.
Queue: `my-tutoring-app/qa/workspace-rollout/ROLLOUT.md`, rows C23-C34 and "Held back" (authority over this file).
Phase 1 in `WORKSTREAMS.md`. Branch `ship/2026-08-10-judged-loop`. Commit by path, never `git add -A`.

## Where things stand

R1 (the 26 with eval modes) is done: batches 1-4, committed b4e1ae85 and the 10-16 follow-ups. R2 is the rest of
C23-C34. The user ruling of 10-15 applies: a mid G3+ sim may be rebuilt while it is bound
(memory `feedback_reimagine-mid-primitives-during-binding`): code builds items and keys, Gemini writes names and
text, exploration is never scored.

**Skip, ruled elsewhere:** `dump-truck-loader`, `excavator-arm-simulator`, `hydraulics-lab` (user moved to the
dioramas), `bridge-builder` (OB-4 pilot).

## Step 1: triage (read-only, one sitting, before any build)

Recount first; the queue's list is from 10-15 and other sessions bind primitives too. Recipe in ROLLOUT.md
"Status": catalog ids = `id: '...'` in `service/manifest/catalog/*.ts`, bound = has `teachingWorkspace: {`.
Candidates from the C rows (verify each): `telescope-simulator`, `microscope-viewer`, `bio-compare-contrast`,
`bio-process-animator`, `dna-explorer`, C25 (`energy-cycle-engine`, `evolution-timeline`, `inheritance-lab`,
`protein-folder`, `orbit-mechanics-lab`), `motion-diagram`, `mission-planner`, `rocket-builder`, `airfoil-lab`,
`paper-airplane-designer`, `shape-strength-tester`, `foundation-builder`, `propulsion-timeline`, `engine-explorer`,
`foundation-explorer`, `image-panel`, `feature-exhibit`, `comparison-panel`.

For each, write one row in a triage table (`qa/workspace-rollout/R2-triage-2026-10-16.md`):
- **Checkable task?** What a child could answer that code can check (a tap, a value, an order). Name the mode(s).
- **Verdict:** BUILD (modes + W1 + levers) · UNGRADED (exposition; `teachingWorkspace.ungraded` per the 09-24
  ruling) · HELD (reason, into "Held back").
- **Leaks seen now:** answers shown on screen, exploration scored.

Then stop and show the table to the user before building, unless every verdict is clear-cut. The UNGRADED vs BUILD
call on exhibits (`image-panel`, `feature-exhibit`, `comparison-panel`) is the likely question.

## Step 2: build in domain batches of 3-5

Batches by domain, as R1 did (biology, astro, physics/flight, engineering, exhibits). Per primitive:
`/add-eval-modes` (code-checked, IRT betas) → W1 binding (recipe at the end of ROLLOUT.md) → levers →
`/eval-test`. Reports go to `../tutor-reports/<id>-w1-2026-10-16.md` and `../eval-reports/<id>-levers-*.md`.
Read the replays by hand: in R1 the automatic checks scored 0 flags while reading found the tutor pointing at the
answer on seven primitives.

Every adoption edits `activityContract.ts`, the catalog and `liveJourneySpec.ts`. The diorama session also edits
`catalog/engineering.ts`: commit each primitive before the next starts on those files.

## Gates and close-out

- Per batch: `typecheck:lumina` 0, full tsc not above 770, the batch's tests plus
  `src/components/lumina/components/live-activity`. No paid Live runs: W1 smoke uses replay/gesture drives.
- Close each C row in ROLLOUT.md with its report link, and the phase 1 row of `WORKSTREAMS.md`, in the same commit.
- After R2: VB-2 (voice beside the tap, 3-5 math), then phase 2 (T2 observer tier, T3 responsiveness).
