# open-builder levers (build_to_goal), 2026-10-08

`/add-support-tiers`, class sweep batch (user waived the Phase 2 stop). One mode: `build_to_goal`. No contract doc
exists for open-builder (`docs/contracts/open-builder.md` absent); the only other consumers are the tester presets and
the generator menu, both kept unchanged (practice scenes are off `SCENE_IDS`).

## Failure inventory

| Miss (named by the buddy) | Evidence class | Source |
|---|---|---|
| `missing_part`: a part the goal names is not built (no roof, one castle tower, no wheels) | observed-synthetic | vision drive 2026-10-06 (`qa/open-build/vision-drive-2026-10-06/SUMMARY.md`): castle, robot, truck, puppy unfinished builds |
| `does_not_work`: parts there, job not done (bridge short of the far bank, tower below the giraffe, steps short of the cliff, wall the sheep step over) | observed-synthetic | same drive: bridge, giraffe, cliff-steps, sheep-wall |

No real-learner, demonstration or remediation evidence exists for this primitive. The miss function is the judge's
verdict (`gemini-open-builder-judge.ts`); the catalog already lists both misses.

## Lever table

There is no key, so no lever may draw a block, a position, a block count or a finished build.

| Lever | Kind | Carrier | Scenes | Leak rule (code) |
|---|---|---|---|---|
| `job_marks`: marks on the scenery the job is about (bank flags at the water; a dashed line level with the giraffe's head; a ring on the bunny plus a flag on the cliff top; rings on the sheep and flowers). Drawn as `data-aid`, so the buddy's picture never contains them | help | shown | bridge, giraffe, cliff-steps, sheep-wall | `marksLeak`: flags stand on ground out of the water, rings circle a prop, a line is level with a prop's top and stops at it |
| `goal_parts`: picture cards of the parts the goal names (walls, a roof; head, body, two arms, two legs; two towers and a wall; wheels, room for apples; tall, pointy on top) | help | both | puppy-house, castle, robot, truck, rocket | `partsLeak`: no block kind the scene's goal does not say, no digits, no place words |
| `smaller_job`: ungraded practice project in other scenery, a smaller job of the same kind (stream / pony / low ledge / roof for a kitten / one tower / little rocket / little robot / duck wall) | simplify | shown | every scene except truck | `practiceLeaks`: never the item's id, scene or goal, never a scene in the lesson; id `<item>~simpler` |

Per item: every one of the 9 menu scenes has a help lever answering both misses (unit test). Truck has no simplify
lever: "with wheels" is already one demand. No miss goes to the catalog `unanswered` list.

Tier start (Phase 6): the generator copies `ctx.supportTier` onto each project; easy shows the help lever from the
start (not recorded as a pull). Content unchanged.

## Built

- `openBuilderModel.ts`: 8 practice scenes in `SCENES` (judge and adapter accept them), off the menu; `supportTier` on a project.
- `openBuilderLevers.ts` (new): marks, parts, smaller job, leak rules, `openBuilderLevers`.
- `OpenBuilderArt.tsx`: board draws `job_marks` as a `data-aid` layer.
- `OpenBuilder.tsx`: lever state per item, practice project, `pullLever` / `endPractice`, `onScreen` and `practice` facts, parts cards; a met practice build records no result.
- `gemini-open-builder.ts`: tier start.

## Tests

- `openBuilderLevers.test.ts` (new, 28): menu excludes practice scenes; per scene help coverage and leak rules; leak counter-cases; smaller job per scene; truck has none; practice scenes buildable; `nextLever` table; easy start.
- `OpenBuilder.levers.workspace.test.tsx` (new, 3, mounted via `workspaceHarness`): pull changes board + scene fact in one commit, marks are aids, a refused pull leaves screen/levers/attempts unchanged, next attempt records the lever; parts then simplify opens `ob-1~simpler` (kitten-shade, judged on its own scene), ungraded, full project back on an empty board and credited with both levers; easy start not a pull.
- Existing `OpenBuilder.workspace.test.tsx` passes. Creation folder: 3 files, 36/36. `workspaceContract` open-builder: 5/5. `typecheck:lumina`: 0.

## Not measured

- The journey sweep cannot drive this mode (J1 baseline: the check is the Gemini buddy), so J9/J12 never see these levers; the mounted test stands in.
- The buddy has not judged the practice scenes' builds yet (one paid vision call per scene); the practice scenes reuse the existing scene shape the 10-06 drive passed 18/18.
- Tutor replay and the class Live gate wait for the batch verify step.
