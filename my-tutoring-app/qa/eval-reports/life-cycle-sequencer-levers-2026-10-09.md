# life-cycle-sequencer — support levers, 2026-10-09

One mode, `sequence`. Not committed.

## Failure inventory
| Failure | Class | Observable miss |
|---|---|---|
| orders backwards / unsure which slot is the start | inferred + documented ("thinks a circle has an end") | `reversed` |
| confuses two neighbouring stages ("stuck on two middle stages") | documented | `adjacent_swap`, `two_swapped` |
| one stage out of place (orders by size) | documented | `one_moved` |
| follows the shown card order / no plan | documented | `mixed_order` |
| circle in the right order, started elsewhere | inferred | `cycle_rotated` |
No real-learner evidence; synthetic = the journey's adjacent swap and the workspace test's reversed and rotated orders.

## Lever table
| Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|
| `time_arrow` flag + arrow start → later over the slots; way-back arrow on a circle | help | shown | reversed, mixed_order | names no stage (fact test) |
| `keep_right` lock the stages the check marked right; the rest go back | help | shown | adjacent_swap, two_swapped, one_moved, mixed_order | `keptLeaks`: only right slots, never all; refused before a check / none right |
| `fewer_stages` 3-stage practice of the same shape from a code pool | simplify | shown | all five order misses | `practiceLeaks`: same shape, fewer stages, no shared stage word, skips the item's own subject |
| — | — | — | `cycle_rotated` | catalog `unanswered`: the start stage is the item's choice; showing it places a stage |

## Gates
- `typecheck:lumina` 0; lever unit 46/46, mounted levers 3/3, workspace 6/6.
- Sweep J1-J13 on both payloads: 0 findings; J12 every checked miss answered on the item; J13 both help levers
  pulled after the swap, no key newly on screen, correct input still credits.
- workspaceContract / misses / lessonWorkspacePlan / activityContract pass.

## Replay (`-r3`, 5 × 2)
`stuck`: the tutor pulled `keep_right` itself 10/10, no change narrated before the receipt (0/10). `lever`
`no_fix_before_try` 2/10, read by hand as false positives: "Place those last two cards" counts the unlocked cards the
screen shows, naming no slot or order. Not re-run (guidance not at fault). The check (`said_fix`) treats any number
not in the ask as an amount; a count of remaining cards could be excused there → replay_checks owner.

## Findings
- After an adjacent swap the check's own per-slot marks already force the retry (contract G1); `keep_right` adds
  saved work, not information. The first-response gate keeps the retry from counting as independent.
- No starting positions from `config.difficulty` (no tier harness in this generator).
