# Canvas author: thinking level bench (2026-11-14)

Model `gemini-4-hydrogen`, one run per cell, same code, same session. Override: `LUMINA_AUTHOR_THINKING=LOW|MEDIUM|HIGH`
(kit-wide in `agent-kit/authorLoop.ts`, default LOW). Runs saved as `2026-11-14-think-<topic>-<LEVEL>.*`.

| Topic | LOW $ / s / turns | MEDIUM $ / s / turns | HIGH $ / s / turns |
|---|---|---|---|
| circuit (G4) | 0.077 / 42 / 4 | 0.083 / 48 / 5 | 0.531 / 241 / 8 (look skipped: out of time) |
| fracline (G3) | 0.057 / 35 / 4 | 0.067 / 46 / 4 | 0.260 / 146 / 9 |
| tens to 120 (G1) | 0.155 / 90 / 8 | 0.236 / 122 / 10 | 0.337 / 229 / 6 |
| **total** | **0.29** | **0.39** | **1.13** |

All 9 shipped: rest goal false, proof replays to goal, no errors, no advisories.

Quality (screenshots):
- fracline: LOW and MEDIUM split the line with a +/- stepper, so the canvas does the partitioning. HIGH has the child drag
  divider pegs and slide them into equal parts: the objective's actual skill.
- tens: LOW and MEDIUM both count 34 with a ten-frame. HIGH counts 104 with crates, which uses the objective's range to 120.
- circuit: about the same at every level; HIGH has more detail in the art.

HIGH source is about 2x longer (14-20K chars vs 5-10K). HIGH costs about 4x LOW, runs 3-4x longer, and hit the 330s hard
limit once, shipping a canvas no reader looked at.

Earlier LOW runs today (`bench-*-gemini-4-hydrogen`) logged $0.13-0.42, 2-3x this rerun on the same topics. Single runs
vary a lot, so the cost columns are rough.
