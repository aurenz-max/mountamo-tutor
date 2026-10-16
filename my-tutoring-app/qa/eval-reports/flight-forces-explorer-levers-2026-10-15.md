# flight-forces-explorer levers, 2026-10-15

Built with the W1 binding (`../tutor-reports/flight-forces-explorer-w1-2026-10-15.md`). Code: `flightForcesLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
There is no real-learner evidence (no demonstrations, misconception or remediation files for this id). The old
catalog `commonStruggles` documented three failures: not linking airflow to lift, avoiding a steep angle, and not
compensating for cargo. The rest are inferred from the tasks. The misses below are what the code check observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| predict | does not know which force a pilot action changes (inferred) | `said_no_change`, `opposite_way` |
| predict | thinks a steeper nose always gives more lift (documented: stall) | `stall_more_lift` |
| predict | misses that two equal changes cancel (inferred) | `missed_balance` |
| predict | stops after the first step of a two-step effect (inferred) | `said_no_change` |
| observe | reads the nose direction as the direction of travel (inferred) | `followed_nose` |
| observe | reads a balanced pair as motion, or the reverse (inferred) | `missed_balance`, `said_no_change` |
| observe | compares the wrong arrows or misjudges close lengths (inferred) | `opposite_way` |
| adjust | tilts past the stall angle (documented) | `stalled` |
| adjust | raises the nose and forgets the extra drag (inferred) | `forgot_drag` |
| adjust | does not know how big lift or thrust must be (documented: cargo) | `lift_vs_weight`, `thrust_vs_drag` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| predict | `force_link` | help | a card naming which force the action changes and which way (only when the ask does not name it) | no motion word (`motionLeak`) |
| predict | `show_arrows` | help | the arrows are drawn as they are right after the change; the plane does not move | the plane holds still; for a "little later" item only the first step is drawn |
| predict | `one_step` | simplify, hard | the same change asked one step simpler: the speed before the height, the nose tilted to 6° before 18°, one change before two | the practice key differs from the item's key |
| observe | `pair_up` | help | the arrows lined up in pairs as unit bars beside the plane | no comparison or motion word |
| observe | `count_units` | help | each arrow's length in units | numbers only |
| observe | `one_axis` | simplify | the same drawing, asking the height only | same drawing, ungraded |
| adjust | `target_marks` | help | dashed marks at the partner arrow's length on the lift and thrust tracks (the thrust mark follows the drag) | moves no control; text says a mark is equal length, not the goal |
| adjust | `stall_mark` | help, stall items | the stall angle marked on the nose control | names the angle only |
| adjust | `one_control` | simplify | the same height goal with thrust held as big as drag, only the nose to set | the start never meets the goal; a solution exists |

Every miss an item can show is answered by a help lever first (tested over every tier and plane). Practice items have
no levers and never shrink twice.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit, and the next attempt
  records it (`assisted`, `levers`); each simplify lever opens `<id>~simpler` and the full item comes back.
- Sweep J9, J12, J13: 0 findings on the three payloads.
- Replay: after the fixes in the W1 report, the lever and stuck replies describe each card by what it shows without
  stating the conclusion (r4). r1 found the marks described as targets and r2 found "balance the pairs"; both fixed in
  wording.

## Failures without a lever
None observed. The cancel items (two equal changes) rely on `show_arrows`, which draws both changed arrows; there is no
lever that teaches "equal changes cancel" on its own.
