# propulsion-lab levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/propulsion-lab-w1-2026-10-16.md`). Code: `propulsionLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
There is no real-learner evidence: no demonstrations, misconception or remediation files exist for this id. The old
catalog `commonStruggles` documented three failures: thinking a propeller works in vacuum, not linking exhaust to
motion, and confusing action with reaction. The rest are inferred from the tasks. The misses below are what the code
check observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| predict | thinks a jet engine, propeller or sail works in space (documented) | `said_moves` |
| predict | thinks the engine cannot work where it can (inferred) | `said_still` |
| predict | thinks the craft goes the way the blast goes (documented: action/reaction) | `wrong_way` |
| predict | misses that two equal opposite pushes cancel (inferred) | `missed_cancel` |
| observe | does not link the stream to motion, or reads its direction as the craft's (documented) | `wrong_way`, `said_still` |
| observe | sees an engine switched on and expects motion with nothing coming out (documented: vacuum) | `said_moves` |
| observe | misjudges two streams one unit apart, or misses equal ones (inferred) | `wrong_way`, `missed_cancel` |
| experiment | changes two things at once, or nothing (inferred) | `changed_more_than_one`, `same_tests` |
| experiment | changes a thing the question does not ask about (inferred) | `changed_other` |
| experiment | tests a different engine or place than the question names (inferred) | `wrong_subject` |
| experiment | tests throttle where the engine has nothing to push (inferred) | `cannot_show` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| predict | `how_it_works` | help | a card with each engine's one-line description ("A propeller spins its blades to push air.") | no word for where the craft goes (`motionLeak`); names no place |
| predict | `air_marks` | help | the scene is labelled "Air all around" or "No air here", and the air specks are ringed | a fact about the place, not the engine |
| predict | `blast_arrows` | help, engines only | a dashed arrow at each engine, the way it is aimed to blast; nothing switches on | never an arrow on the craft or the way it goes |
| predict | `one_step` | simplify | two engines become one, or an engine turned around faces backward | the practice key differs from the item's key |
| observe | `label_streams` | help | each engine labelled "its stream leaves to the left" or "nothing comes out" | names the stream's way, never the craft's |
| observe | `stream_units` | help, two streams | each stream's length in units | numbers only, no comparison |
| observe | `one_stream` | simplify, two streams | the same craft with only the smaller stream | the practice key differs from the item's key |
| experiment | `compare_tests` | help | a row per setting, "the same in both (propeller)" or "different (A air, B space)", follows the learner's settings | never says which setting should differ |
| experiment | `can_push` | help, throttle questions | under each test, whether its engine has anything to push there | offered only where the question is not about air |
| experiment | `one_test` | simplify, both tests free | the same question with Test A set and locked | the start is never already a fair test |

Every miss an item can show is answered by a help lever first (tested over every tier and three seeds). Practice items
have no levers and never shrink twice.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit. The next attempt records
  it (`assisted`, `levers`). Each simplify lever opens `<id>~simpler`, and the full item comes back after it.
- Sweep J9, J12, J13, J15: 0 findings on the three payloads. Lever inventory: every catalog miss is answered on its
  mode.
- Replay: after the fixes in the W1 report, lever and stuck replies describe each card by what it shows and quote the
  how-it-works card as written (r6). r1 found "the card shows both engines need air to work" and "both pushing
  equally"; r2 found replies singling out the bigger engine. All are fixed in guidance wording.

## Failures without a lever
None observed. `can_push` is offered only on throttle questions: on an air question it would state the answer the
test is meant to find.
