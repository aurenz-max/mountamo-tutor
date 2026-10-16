# reaction-lab W1 binding (ROLLOUT C26), 2026-10-15

**Shape P. All three modes are bound: predict, observe and explain.** Levers are in `../eval-reports/reaction-lab-levers-2026-10-15.md`. Not committed.

## What code checks
Every item is one generated challenge with a key held in code: the option id, the true/false value, or the classify
answer (chemical or physical). A predict challenge is asked beside the substances before they are mixed. Every other
challenge waits for Mix Substances!, with `readyForResponse: false` until then, and is then asked beside the reaction.
Every item is `speech` with `acceptsGesture` (J14), and JEV judges speech against `reactionExpectedAnswer`. The misses
(`reactionMiss`) are `true_false_flipped`, `chemical_physical_swap`, `unbalanced_equation`, `no_change` and
`other_choice`. Challenges that only take a typed answer have no code check, so the workspace path leaves them out. The
scripted path keeps them with the old rule (any answer of 15 or more characters passes).

The generator ignored the eval mode. It now narrows the schema enum and filters the challenges to the mode's types,
and the catalog's `challengeTypes` list the full sets: observe = observe, identify_signs, classify; explain = explain,
balance, conservation.

## Answer leaks fixed (both paths)
- The key's position: the generator lists the right option first and prints its id as the letter (5 of 6 saved MC
  items were "A"). Options are now shuffled with a fixed seed and lettered by position. The notebook prediction is too.
- The equation bar printed the products during predictions and the balanced equation during a balance challenge. It
  is now hidden then.
- The conservation counter printed "Reactant atoms = Product atoms" (it counts molecules, and shows "=" even when the
  counts differ). It is hidden on the workspace path, and on the scripted path while a conservation challenge is open.
- Scripted observe notebook: each sign button turned green or red by the key as soon as it was tapped. Marked signs
  now stay one neutral colour.
- The particle caption explains the reaction. It is hidden beside an open challenge on the workspace path.
- Scripted host messages sent the key (`target is "..."`) and the signs before mixing. Both are removed. The catalog's
  level-3 scaffold named the reaction type (the classify answer). It no longer does.
- A scripted-path bug: the evaluation was never submitted, because Next was hidden once every challenge was right and
  only Next submitted. It now submits once on completion.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770), none in reaction-lab files.
- `ReactionLab.workspace.test.tsx` 11/11, including a scripted-path walk. `live-activity`, `misses.test.ts`, the
  ScienceWorkspaces Pip surface and the generator grade-band test: 39 files, 4063 passed.
- Payloads: `w1-payloads/reaction-lab.{predict,observe,explain}.json` from `save_payload.py` on :3000, real content
  (grade 4, band 3-5), no fallback lesson.
- Sweep: 0 findings on J1-J14, 8 of 8 misses named, J10 100, J11 67. Advisory: the choices are listed in the scene
  facts, so the key appears there as one choice among them. They stay so the tutor can read them aloud.

## Replay (5 samples per moment, `--observe`, gemini-3.8-flash)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| first wording (`replay/reaction-lab-2026-10-15.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| + legend: "never ask which choice matches a sign"; particle view placed "to the right of the beaker" (`-r2`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| + particle view: "say only where it is" (`-r3`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

I read every reply. In run 1, 3 of 5 predict stuck replies asked "which choice matches one of those reaction signs?".
That narrows four predictions to the two that name a sign, and it assumes the mix reacts, which is the prediction
itself. In 2 of 5 replies the tutor put the particle view "below the beaker", which is not where it is drawn. Run 2
fixed both, but 1 of 5 explain stuck replies said the particles were "turning into new substances like gas", which
restates the key. In run 3 no reply names a key or a sign to match. Every stuck reply pulls the mode's help lever
itself and describes it after the call.

## Modes not driven
None.

## Open findings
- The generator does not always follow the prompt on predict instructions. Two saved runs had questions that state
  the result ("all that foam", "this fizzing eruption"). → `/eval-fix` (a code check on predict instructions).
- The key and the target can disagree: in the first explain payload the key was "A" but the target was option B.
  There is now a code re-key when the target clearly matches another option. → `/oracle-test`, to measure the rate.
- The conservation counter counts molecules but labels them atoms, and always prints "=". → `/eval-fix`.
- There is no `docs/contracts/reaction-lab.md`. → `/primitive-contract`.
- The scripted path changed shape. Predict challenges now come before mixing, Run the Experiment replaces the
  1.5-second timer, and Mix needs two substances selected. This needs a browser check in the tester, along with the
  workspace path's Mix-then-question step and the lever card.
