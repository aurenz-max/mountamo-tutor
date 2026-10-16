# orbit-mechanics-lab levers and eval-test, 2026-10-16

Built with the W1 binding (`../tutor-reports/orbit-mechanics-lab-w1-2026-10-16.md`). Code: `orbitLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
No real-learner evidence: no demonstrations, misconception or remediation files exist for this id. The old catalog
block's `commonStruggles` (documented) named "no gravity in space", "faster is always better" and "too slow falls";
the rest is inferred from the tasks. The misses are what the check sees.

| Mode | Failure (class) | Miss |
|---|---|---|
| pick_speed | picks a push too slow or too fast for the asked path; "faster is always better" (documented) | `picked_slower`, `picked_faster` |
| orbit_speed | judges speed by drawn size (inferred; the hard tier is built on it) | `picked_biggest` |
| orbit_speed | thinks farther out is faster (inferred) | `picked_farther`, `picked_closer` |
| predict_burn | mixes up forward and backward, or ignores the push size (inferred) | `wrong_way`, `too_strong`, `too_weak` |
| predict_burn | thinks a push changes nothing (inferred) | `said_no_change` |
| circularize | right burn at the wrong point, or the circle at the other height (inferred) | `wrong_place`, `other_circle` |
| circularize | speeds up where it should slow down (inferred) | `wrong_way` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| pick_speed | `throw_model` | help | a card: a ball thrown sideways from a hill three times, each harder and landing farther | no throw goes around or flies away; no arrow is an item push |
| orbit_speed | `same_size` | help (sizes differ) | every rocket drawn the same size | no order, no mark |
| orbit_speed | `pull_card` | help | a card: Earth's pull as arrows, long close in, short far out | names no rocket, says nothing about speed or time |
| predict_burn | `speed_arrows` | help | the speed before and after the push as two arrows | draws no path |
| circularize | `mark_points` | help | dots and words on the loop's near and far points | marks both points, never one |
| circularize | `burn_card` | help | a card with a different loop: forward lifts the other side, backward lowers it | names neither point of this loop |
| all | `drop_one` | simplify, on the item | greys out the option farthest from the key | at least two untried options remain |

Every miss an item can show is answered by a help lever first (tested over every tier, 5 seeds per mode). No practice
items: the simplify lever acts on the item (user ruling 09-27).

## Measured
- Workspace test: each lever changes the screen and the scene fact in one commit; the next attempt records it
  (`assisted`, `levers`); `drop_one` greys a choice that then takes no tap; `drop_one` is withdrawn once two untried
  options would not remain.
- Sweep J9, J12, J13: 0 findings. Replay r2: lever and stuck replies describe each card by what it shows; the
  speed-arrows card is placed "beside the rocket" in about half its lever replies (it is under the view).

## Eval-test (`/api/lumina/eval-test`, 4 items each, after the overview fix)
Content checked by code with the live modules (adapter `validate`, `orbitItems`, keys, harness answers, every miss
answered, key not in ask/scene/lever facts); rendering by the browser drive in the W1 report.

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| pick_speed | PASS: 2 pushes, asks circle/away/falls, key moves | PASS: 3 pushes (falls, circle, away), key at 0/1/2 | PASS: 4 pushes incl. stretched, asks all four |
| orbit_speed | PASS: 2 rockets, track ratio ≥ 1.9 | PASS: 3 rockets, ratio ≥ 1.35 | PASS: 4 rockets, ratio ≥ 1.18, 4 sizes, biggest never the key |
| predict_burn | PASS: small push, 2 choices | PASS: small or big, 3 choices | PASS: all 5 outcomes |
| circularize | PASS: at the named point, speed up or slow down | PASS: 4 choices, height named | PASS: 4 choices, height as a dashed ring |

Fixed during the sweep: Gemini's overviews invited trial ("test different pushes", "observe rockets ... to see which
completes its trip first", though nothing moves before the answer); the prompt now asks for a predict/choose sentence.

## Failures without a lever
None. Inferred only: "no gravity in space" has no observable miss of its own; `throw_model` is the lever for it.
