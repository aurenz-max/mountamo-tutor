# multiplication-explorer: W1 binding (plain shape), 2026-10-09

**Modes bound:** build, connect, commutative, distributive, missing_factor, fluency (all six catalog modes).
Each is one typed number ("Your answer") and Check, judged by the activity's own check (`multiplicationAnswerCorrect`).
No expected answer reaches the tutor.

## What changed

- `multiplicationExplorerWorkspace.ts`: fact resolution, `askedSlot`/`expectedAnswer`, `askFor`/`hintFor` (code wording when
  the generated text names the answer, digits or number words), `modelShown`, `equationText`, `workspaceScene`,
  `multiplicationMiss` + `MultiplicationMiss`.
- `MultiplicationExplorer.tsx`: `MultiplicationExplorerSurface` on `useScriptedProgress` / `useWorkspaceProgressFor`; the
  calculator keypad became a kit input + Check (the sweep and the driver need a labelled input); Next, Submit Results and
  the score line are scripted-only; `useLuminaAI({ enabled: !tutorOwned })`; scene in `useLayoutEffect`; submit only under
  an evaluation provider. The item's tab is set in `onItemOpened` (a tab set by an effect superseded the receipt, J7).
- **Leaks fixed on both paths:** the equation printed the missing factor on missing_factor; its panels drew it (5 groups of
  4); the fact family printed every answer; the break-apart printed the sum; the number line labelled the landing point;
  connect/commutative shipped `hiddenValue: null` so the product readout passed the generator's leak guard; hints named the
  answer ("Count up: 4, 8, 12", "groups of three make twenty-one"); missing-factor squares (`? × 6 = 36`). Generator now
  stamps `hiddenValue` from the type and skips squares on missing_factor.
- Adapter `adapters/multiplicationExplorerLive.ts`, `activityContract.ts`, catalog `teachingWorkspace` (guidance + misses),
  journey row, `lessonWorkspacePlan.test.ts`, contract `docs/contracts/multiplication-explorer.md`.

## Misses (code-named)

Product modes: `added_factors`, `one_group_short`, `one_group_over`, `off_by_one`, `other_product`; distributive adds
`one_part_only`. missing_factor: `gave_product`, `gave_known_factor`, `subtracted`, `one_jump_off`, `other_factor`.

## Gates

- `typecheck:lumina`: 0 in my files (3 errors in sibling `MeasurementTools*`, mid-edit).
- `MultiplicationExplorer.workspace.test.tsx` 10/10, `per-challenge-fact` 5/5, generator structural + oracle tests green,
  `MathWorkspaces.surface.test.tsx` green.
- `workspaceContract`, `journeySweep` (6 payloads, 0 findings for this id after two fixes: J7 superseded on advance, J3
  "Score 0/1 Reps 1/5" appearing after a miss), `misses.test.ts`, `activityContract.test.ts`, `lessonWorkspacePlan.test.ts`: green.
- Tutor replay 6 payloads x 4 moments x 5 samples: r1 4/30 start `press Check Answer` (the old button label is a shared
  protocol pattern; button renamed Check); r2 1/30 distributive miss "Try adding those two parts" (guidance invited it;
  reworded); r3 **0 misses** (`qa/tutor-reports/replay/multiplication-explorer-2026-10-09-r3.json`). Replies read: they ask
  about groups, skip-count part way, never name the key.

## Undriven

None: every mode drives through the real input.

## Open findings

- G1: `build` has no build interaction (contract G1).
- G2: distributive ask's split can differ from the drawn split (contract G2).
- Needs a browser check on the input + Check layout (the keypad was replaced).
