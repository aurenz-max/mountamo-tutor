# equation-workspace levers, 2026-10-09

`/add-support-tiers` on the W1 binding (C17). Module `equationWorkspaceLevers.ts`; component lever state keyed by item; catalog `levers: true`.

## Failure inventory

No real-learner evidence (no demonstrations, misconception or eval reports name this primitive). Classes:

| Miss (`equationMiss`) | What the screen shows | Class |
|---|---|---|
| `later_step` | an operation the path does later (divide before subtract; undo before distributing) | documented (catalog commonStruggles: wrong order) + synthetic (sweep) |
| `not_inverse` | the right step's opposite on the same number (add 15 where 15 must come off) | documented (commonStruggles: what "undoes") + synthetic |
| `wrong_number` | the right operation on the other side's number (subtract 47) | inferred; the generator's own distractors |
| `other_operation` | anything else (multiply by 1, simplify) | inferred |

## Lever table (every mode)

| Lever | Kind | Answers | What changes | Leak rule (code) |
|---|---|---|---|---|
| `inverse_reminder` | help | not_inverse, other_operation | panel: undo what is attached with its inverse, both sides. The easy tier's starting position (declared pulled, not recorded) | no digit |
| `layer_order` | help | later_step | panel: last thing done comes off first; on a path that starts with distribute/combine, "first tidy each side" | no digit |
| `sides_marked` | help | wrong_number, other_operation | the current line split into the variable's side and the other side, two boxes; follows the line as steps apply | the two boxes are exactly the line's two sides; refused when the variable is on both sides |
| `worked_model` | help | all four | every line of a different equation with the same kinds of steps, variable `y` | not the item's equation; shares no number with the item's equation, lines or menu |
| `fewer_steps` | simplify | all four | practice equation, same type, one step fewer (last undo dropped), own menu with the opposite and other-side distractors; ungraded; full item back blank | one step shorter; no number the item prints; never the item |

`worked_model` and `fewer_steps` exist only when every step is add/subtract/multiply/divide. Multi-step items with distribute/combine steps (5 of 5 payload items) get the three help levers, which answer every miss; **no simplify there**: a shorter equation without the tidy steps drops the mode's defining property (4+ steps), and code cannot build the tidy lines without a CAS.

## Gates

- `equationWorkspaceLevers.test.ts` 17/17 (declarations per mode, leak rules per mode, `buildLinear` over 200 seeds x 6 shapes, practice builder over 40 items per mode).
- `EquationWorkspace.levers.workspace.test.tsx` 8/8 (pull draws in the same commit, scene fact, attempt records the lever, repeat pull blocked with no change, starting position not recorded, practice ungraded and full item credited after, refused simplify on multi-step).
- Sweep: J9/J12/J13 0 findings on 4 payloads; lever inventory: guided-solve, identify-operation, solve 5 levers; multi-step 3; every miss answered.
- `typecheck:lumina` 0.
- Replay 4 x 5: `stuck` and `lever` moments 0 misses on not_empty, no_protocol_leak, no_key_before_try, no_fix_before_try, no_change_before_receipt. The tutor pulled `inverse_reminder` after not_inverse (all modes) and `layer_order` after later_step (multi-step); `worked_model` in 6 of 20 stuck replies.

## Failures with no lever

None by miss. No simplify on items with non-linear steps (all multi-step payload items), stated above.
