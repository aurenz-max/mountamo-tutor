# skip-counting-runner — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C12. `withWorkspaceController`: the scripted path is kept (retry until correct, Next). Not committed.

## Modes and what code checks
All five catalog modes are gesture items. The runner's own check (`skipMatches`, `skipCountingWorkspace.ts`) is the judge, so there is no `expectedAnswer` and no key in the scene facts.

| Mode | Learner input | Check | Misses (`skipMiss`) |
|---|---|---|---|
| count_along | tap the next tick (`tick-<n>`) per jump, then Check | each tap = the next landing; Check at the end | skipped_a_landing, jumped_far |
| predict | type, Check | = next landing | stayed_put, added_one, two_jumps, wrong_way, near_miss, off_count |
| fill_missing | type one gap, Check; repeat | each fill is an open gap; credited on the last one | not_a_gap, already_filled, near_miss, off_count |
| find_skip_value | type, Check | = skip value | twice_the_step, half_the_step, typed_a_landing, one_short, one_over, short_by_more, over_by_more |
| connect_multiplication | type the jumps in "? × N = landing", Check | = number of jumps | typed_product, typed_skip, counted_start, one_short, short_by_more, over_by_more |

## Fixed on both paths (pedagogy)
- **Answers on screen:** predict labelled the next landing under its tick. find_skip_value at easy and medium showed the answer in "Count by N", in "+N" on the Jump button, in the n × N line, in the array caption and in the ones-digit row. connect_multiplication printed the whole fact ("7 × 4 =" with 28 in the instruction). On fill_missing, Jump landed on a gap and printed its number, after which the gap could not be filled.
- **Checks:** connect now asks for the number of jumps. The product is in the instruction by the generator's own rule, so it could never be the unknown. fill_missing needs every gap. Before, any one gap completed the item, so the hard tier's three gaps worked like one.
- **The scripted path never submitted.** Its submit sat on a Next button that is hidden on the last challenge. It now submits once the last challenge is correct.
- **Generator** (code, after generation): count_along, fill_missing and connect instructions are code-built. They had contradicted the screen ("from 10 to 20" on a 0-50 count, blanks that were not the hidden numbers, "made 2 leaps"). The generator also code-builds the fill, connect and find hints, which named or described the answer, and strips the jump size from a find title or instruction. When every count_along item started at the same place, their starts are now spread along the line, so the items are not one count repeated. The oracle comments were updated to the new connect key.
- **Workspace only:** easy count_along auto-play becomes tapping, because nothing moves on its own. The generated hint is hidden.

## Gates
- `typecheck:lumina`: 0. Full `tsc`: 770, the same as the baseline.
- `SkipCountingRunner.workspace.test.tsx` 12/12. Oracle 16/16. `pip/MathWorkspaces.surface` passes.
- `workspaceContract` + `misses` + `lessonWorkspacePlan` + `activityContract`: pass. The 8-file batch had 2402/2402.
- Sweep, full: 516 passed, 0 failing. `-t skip-counting-runner`: 5 payloads, 28 items, 0 findings (J1-J13), 28/28 misses named. J10 clean records 100/100; J11 recover records 67/0.

## Tutor replay (5 payloads x 5 samples)
- **r1** (`replay/skip-counting-runner-2026-10-09.json`): 0 misses except miss `no_fix_before_try` 1/25 on fill_missing: "Try adding five from the number right before the question mark." It names the step, not a gap.
- **Fix:** one guidance clause: do not tell the learner what to add to which number; ask what changes from one number to the next.
- **r2** (`-r2.json`): 0 misses except stuck `no_fix_before_try` 1/25, on fill_missing after the tutor pulled `step_arcs`: "Jumping arcs with plus five have appeared … count five more." This reads out the lever's own "+5" picture. Read by hand: no reply on any sample names a key before the try. Left at one fix, as instructed.

## Undriven modes
None. The 400 ms jump delay was removed so taps register at once, which also lets the driver tap tick after tick.

## Open findings
1. **Generator, connect_multiplication content** (`/eval-fix`): the saved payload starts at 1 jump (1 × 10). It is a trivial first item, and the prompt does not set a minimum.
2. **Mixed (unpinned) lessons:** a find_skip_value item in a blended lesson can still sit under a session title that names the skip ("Jump by 5s!"). Only a pinned find title is replaced.
3. **Replay check** `no_fix_before_try` flags a reply that reads a pulled lever's "+N" label. The same class was seen on length-lab. Owner: shared replay_checks (`/add-live-tutor-tools`).
4. Needs a browser check on count_along tapping and the lever pictures. Everything has run in JSDOM only.
