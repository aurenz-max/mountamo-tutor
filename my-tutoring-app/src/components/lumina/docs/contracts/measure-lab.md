# Contract: measure-lab

- **Derived:** 2026-10-09 (W1 workspace binding; no earlier contract)
- **Component:** `primitives/visual-primitives/math/MeasureLab.tsx` · **Domain:** `measureLabWorkspace.ts` ·
  **Generator:** `service/math/gemini-measure-lab.ts` · **Oracle:** `service/qa/oracles/measure-lab.ts` ·
  **Catalog:** `service/manifest/catalog/math.ts` (`measure-lab`)
- **Modes:** `balance_predict` · `capacity_predict` · `pour_count` · `order_capacity` (K.MD.A.1, K.MD.A.2)

## Requirements

### R1 — no quantity is ever printed · OBSERVED
- **Property:** weights, capacities and fill amounts are code-owned and never rendered; the beam's tip and the water
  level are the only evidence. The scene facts carry none of them before the test runs.
- **Probe:** `MeasureLab.workspace.test.tsx` (no digit in the facts before a try, every mode).

### R2 — the prediction is the score · OBSERVED
- **Property:** balance and capacity take a guess first; the test (both on the scale, or Pour) runs only after it, and
  the check grades the guess, after a 900 ms settle owned by `verdictTimerRef`.
- **Probe:** `MeasureLab.surface.test.tsx`, workspace test (no verdict until the beam settles).

### R3 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- **Property:** under a live runtime the tutor owns every mode. `workspaceAssignment` gives the prompt as the task,
  gesture response, no `expectedAnswer`. Each verdict commits through `progress.commitCheck` with `measureMiss`
  (`picked_lighter`; `tall_means_more`, `picked_less`; `one_short`, `one_over`, `too_few`, `too_many`;
  `most_to_least`, `two_swapped`, `out_of_order`). Try again clears the bench (guess, pans, pours, taps). The scene
  states what the test showed only once it has run (`scale`, `afterPouring`); the pour count is never stated.
  Next is hidden, input is closed while a checked answer waits, the legacy AI hook is off.
- **Probe:** `MeasureLab.workspace.test.tsx`; journey sweep on `w1-payloads/measure-lab.*.json` (17/17 misses named);
  tutor replay `qa/tutor-reports/replay/measure-lab-2026-10-09.json`.

## Gaps

### G1 — vocabulary does not fit the drawn shape · OPEN
- **Shortfall:** the generator draws the shape by index, so a "big bowl" can render tall and narrow, and a
  "cooking pot" tall beside a "coffee mug" drawn wide (2026-10-09 payloads). The capacity compare reads the shape.
- **Path:** generator picks the name per shape → `/eval-fix`.

## Changelog

- 2026-10-09 — derived with the W1 binding. Scripted path gains a Try again after a wrong guess on the prediction
  modes (it was a dead end: no control after the test ran). The capacity pour's timer moved onto the balance's ref.
