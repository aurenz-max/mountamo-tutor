# systems-equations-visualizer — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C20. `withWorkspaceController`: the scripted path is kept (its Next System, hint and feedback). Not committed.

## Modes and what code checks
All three catalog modes are gesture items: type x and y, press Check. No `expectedAnswer`, no key in the scene facts.

| Mode | Check | Misses (`systemsMiss`) |
|---|---|---|
| graph | `solutionCorrect` (within 0.01 of the key) | swapped, both_signs, x_sign, y_sign, intercept_point, one_line_only, off_by_one, x_only, y_only, wrong_point |
| substitution | same | same |
| elimination | same | same, without intercept_point (standard form prints no b) |

The adapter refuses an item whose lines are parallel or do not both pass through the key.

## Fixed
- **"Peek at the graph"** on substitution and elimination drew both lines, so the learner could read the crossing instead of solving: removed on both paths (the catalog says the graph is hidden until correct).
- **"Show hint" showed the answer** on both paths: `hintFor` printed the pair ("The answer is (2, 1)", "you should get 3"). It now gives the method only; the oracle's answer-leak check covers `hint` (the oracle had excused it).
- **Solutions on the y-axis** (4 of 12 items in the first payloads): the unshaped slope-form builder allowed x = 0, so both equations ended in the answer's y (`y = x + 3`, `y = -x + 3`). Now skipped, as the shaped builder already did.
- The correct-crossing marker read a non-reactive ref; it now reads a `solved` state that resets with the item.
- Workspace only: boxes and Check closed while a checked answer waits for Try again; no Next, hint or scripted tutor text; submit only under an evaluation provider.

## Gates
- `typecheck:lumina` 0; full `tsc` 771 (C19 baseline 770; none of the errors are in this primitive's files, the extra one is outside `components/lumina`).
- `SystemsEquationsVisualizer.workspace.test.tsx` 7/7; with workspaceContract, misses, lessonWorkspacePlan, activityContract, pip surface, oracles, sourceControlBytes: 3108/3108.
- Sweep `systems-equations`: 3 payloads, 12 items, 0 findings (J1-J13), 12/12 misses named; J10 clean 100, J11 recover 67/0.

## Tutor replay (3 payloads x 5 samples)
`replay/systems-equations-visualizer-2026-10-09.json`: 0 misses on every check. Read by hand: on graph x_sign the tutor asks which side of the y-axis the crossing is on (a question, not the sign); elimination "stuck" names the scaling step (multiply line B by 2) without its result. Two stuck samples pulled two levers and said nothing.

## Undriven modes
None.

## Open findings
1. Browser check owed: the canvas (lines, easy-tier glow, solved marker) and the lever pictures. JSDOM has no 2D context.
2. Elimination items are often hard for their band at no tier (`-3x + 2y = -10`, `-2x + 3y = -10`: both equations need scaling). `/eval-test` question on the default tier.
3. The tutor writes LaTeX (`$-2x - 1 = -x - 2$`) in speech: a class property of the Live voice, not this binding.
4. The scripted tutoring block still sends the expected pair in `[ANSWER_INCORRECT]`; it reaches only the scripted path and goes when that fallback is retired.
