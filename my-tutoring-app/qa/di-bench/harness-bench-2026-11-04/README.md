# di-spoken-practice explain_concept: rails vs agent harness (2026-11-04)

Trigger: a K skid-steer lesson shipped an empty "Say It Out Loud" section (every item dropped by the
gates and the review; the screen then said "needs the tutor").

Script: `scripts/di-explain-harness-bench.mjs --run --harness rails|agent [--model m] [--only ids] [--tag t]`.
Five objectives (skid steer mechanism, equal sign, growing pattern, choose-and-why, why plants need
sun and water), 4 items each, one independent judge (gemini-flash-latest) per run.

| Harness | Runs | Sessions shipped | Judge-good items / run (of 4) | Median s | Max s | $/run |
|---|---|---|---|---|---|---|
| Rails, before the fix | 12 | 9 | 2.2 | ~36 | 88 | ~0.025 |
| Rails, fixed (equal/pattern/choice from `rails-fixed`, skid/plants from `rails-fixed2`) | 10 | 10 | 3.2 | ~45 | 70 | ~0.022 |
| Agent, gemini-flash-latest | 11 | 11 | 3.6 | ~64 | 158 | ~0.043 |
| Agent, gemini-flash-lite-latest | 10 | 7 | 2.4 | ~38 | 79 | 0.022 |

Per objective (fixed rails / agent flash): skid 4,4 / 4,4 · equal 4,4 / 4,4 · pattern 4,4 / 4,4 ·
choice 4,4 / 4,4 · plants 0,0 / 4,0,4. Rails-before skid: empty, 1/4.

`rails-baseline.json` and `agent-flash.json` were written empty when a judge 504 crashed those runs;
their rows above come from the printed per-run lines (judge now retries). Spend for the whole bench ~$1.9.

Open: "why plants need sunlight and water" fails the judge in every harness except agent-flash 2/3:
scenes name the cause (dark hallway, dry dirt) and the anchors restate need ("needs water") instead
of why. Objective shape, not harness.
