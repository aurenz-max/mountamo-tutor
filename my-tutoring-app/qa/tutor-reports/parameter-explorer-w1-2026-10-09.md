# parameter-explorer — W1 workspace binding (C20), 2026-10-09

Plain shape (P): `withWorkspaceController('parameter-explorer', ParameterExplorerSurface, useScriptedProgress, useWorkspaceProgressFor(...))`.
Domain module `parameterExplorerWorkspace.ts`; adapter `adapters/parameterExplorerLive.ts`; catalog `teachingWorkspace { grades 6-12, guidance, misses, levers }`;
journey row `parameter-explorer`; contract `docs/contracts/parameter-explorer.md` (R1-R3).

## Modes and what code checks

| Mode | Answer on screen | Check (`parameterCheck`) | Misses (`parameterMiss`) |
|---|---|---|---|
| explore | a slider moved, Done Exploring | a move since the item opened (always credited) | none |
| predict-direction | Increase / Decrease / Stay Same + Check | the formula's direction at `newValue`, others at start | opposite_direction, missed_change, invented_change |
| predict-value | number typed + Check | the formula at that setting, tolerance 0.5-5% | unchanged_output, assumed_proportional, near_miss, opposite_direction, too_high, too_low |
| identify-relationship | a parameter + Check | the parameter whose doubling moves the output furthest (≥1.25× the next) | no_effect, largest_value, weaker_effect |

## Fixed on both paths (the generator's keys and the screen)

- **Predict modes fell back to the fixed V=IR lesson almost every time.** flash-lite dropped the optional `pred*` fields (and once wrote `predVaryParameter: "mIdv2"`); the formula service dropped `param2` while the expression still used it, and wrote `G` as a letter. Now: per-mode required fields and a symbol enum, a second formula call for two parameters, constants as numbers. All four saved payloads are real generations.
- **Keys were the LLM's words.** predict-direction named no setting ("if I changes"), so the direction was unverifiable; identify's "strongest effect" had no definition (V = IR has none). Code now keys every item (`settleChallenge`), builds the asks from the data, drops what it cannot answer, and keeps one identify item per lesson (three identical asks before).
- **The answer was on screen.** With no tier, the predict modes showed the live output, so sliding to the asked setting read off the answer; observation cards ("voltage changes linearly with current") showed beside predictions. Output now hidden in the predict modes until the item is over; cards on explore only. A wrong check showed the explanation; on the workspace path a miss now shows "Not yet" only.
- **Tiny outputs** (G·M/r², 1e-11) rounded to 0, so every change read as "stay the same"; rounding and tolerances are now relative.
- The fallback lesson is P = I²R (V = IR has no leading parameter); explore credit is per item.

## Gates

- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `ParameterExplorer.workspace.test.tsx` 10/10. `workspaceContract`, `misses`, `lessonWorkspacePlan`, `activityContract`, `MathWorkspaces.surface`, `sourceControlBytes`: 2926/2926.
- Sweep (`-t parameter-explorer`), 4 payloads, 11 items: 0 findings (J1-J13), misses named 8/8; J10 clean 100, J11 recover 67 (explore 100).

## Tutor replay (4 payloads × 5 samples)

- r1 (`replay/parameter-explorer-2026-10-09.json`): 9 `no_protocol_leak` (LaTeX braces: the scene carried the LaTeX formula). Read by hand: predict-direction stuck replies applied the role ("since M is on top, making it bigger makes the result bigger"; "think of x/2: if x goes up..."); identify once said "give Velocity a try".
- Fixed once: the scene's formula is plain symbols (`plainFormula`); guidance now says the rule for a role is the answer here (no same-shape example, no answering its own question, never naming a choice to try).
- r3 (`-r3.json`, after a payload change): 3/70 `no_protocol_leak`, all the tutor writing its own LaTeX (`$\text{KE}$`). No direction, value or leader stated; predict-direction replies ask where F sits and what that does.

## Undriven

None: every mode through its real controls (slider by `<name> (<symbol>) slider`, direction and parameter buttons by aria-label, `Your prediction`, Check). explore has no wrong move.

## Open findings

1. **The tutor writes LaTeX in speech** (`$...$`, `\text{}`), from its own habit; the scene no longer carries any. Seen on every math family with a formula; shared doctrine or replay-check class, not this primitive.
2. **Leaning questions remain** in about 2/10 predict-direction replies ("what happens to a division when the number on top gets bigger?"). It asks rather than tells; guidance already forbids more.
3. **Generator: one identify item per lesson** (one formula, one leader). A second ask needs a second formula or a "least" ask: `/add-eval-modes` if wanted.
4. **Generator: explanations are mostly dropped** for predict-direction (the LLM's setting rarely matches its own word); the result line built from the formula replaces them.
5. Needs a browser check on the hidden-output predict view and the lever pictures.
