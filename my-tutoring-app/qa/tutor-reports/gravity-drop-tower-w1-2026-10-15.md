# gravity-drop-tower W1 binding (ROLLOUT C28), 2026-10-15

**Shape P, five modes, all bound** (observe, predict, compare, measure, calculate). Levers in `../eval-reports/gravity-drop-tower-levers-2026-10-15.md`. Not committed. No contract doc existed.

## What changed, and why
The old screen let the learner skip the concept in every mode. Gemini wrote every question, choice and answer string, so a key could disagree with what the sim drew (the compare fallback asked about 5 m and 20 m, but the tower only dropped from 20 m). The live speed label, the landing-time stamps and the running timer printed the measure answer as the drop ran. Predict locked Drop until the answer was right, so the learner guessed until credited and then watched. The scripted messages sent the correct answer to the tutor.

Rebuilt so each mode is a task with a code-built key from one physics model (`gravityDropWorkspace.ts`): no air, h = ½gt²; with air, each object has a top speed in air (`vt`). The model makes every key: which lands first, the landing order, the stopwatch times.
- **observe (K-1)**: the learner drops and watches, then says or taps what they saw. The choices open only after the first drop, and no time or speed is shown. Easy: air pairs (a dense object and a feather, a balloon or a flat sheet). Medium: pairs with and without air mixed (the no-air pair lands together, which is the misconception item). Hard: "did it speed up?" plus pairs.
- **predict (1-3)**: which of two lands first, said before anything falls; the drop runs once credited. Easy: the same pair twice, without air and then with air. Medium: adds the flat sheet against the crumpled ball (the same mass, a different shape). Hard: the choices pair each outcome with a reason, so "the hammer first: heavier things fall faster" is a named miss (`heavier_reason`) even though the outcome is right.
- **compare (2-4)**: three objects let go together from different heights; the learner taps them in landing order. Easy: the same object three times. Medium: the heaviest object is not the first to land. Hard: with air, a floater lands last even from a lower platform. Gesture only, because an order is not one sayable answer (J14).
- **measure (4-5)**: a stopwatch table with two measured rows (h0, 4·h0). Easy asks the time for 16·h0, medium 9·h0, hard the height for 3·t0. Wrong choices: time in step with height, the last value kept, the same step added again. Measured rows can be replayed; the asked drop runs only after credit.
- **calculate (6-8)**: easy is the fall time from a height, medium the height from a time, hard the impact speed (two steps). Wrong choices: the ½ left out, the root left out, the time not squared, the fall time given as the speed. Items whose key equals g, or that have two equal choices, are not built.
- **Removed**: the free-form Gemini MC; the live m/s label, the landing stamps and the timer before credit; the `showReadouts` tier (tiers are now structural); "Predict first!" guessing; the K-only "did it go up or down" question (falling down is still observed in every drop). The learner air toggle was a badge only, so nothing was taken away there: air is set per item.
- **Generator**: Gemini writes only the title and description. Code builds the items from the mode pin, the grade (default modes) and `config.difficulty`. A legacy payload (`challenges[].type`) is rebuilt from its modes. The catalog description and constraints now say this (grades K-8; calculate is for 6-8).

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (not above 770), 0 errors in these files.
- `GravityDropTower.workspace.test.tsx` 24/24: each mode on hand-built items, plus the physics, the item space over 3 tiers x 3 seeds, structural tiers, leak rules, misses, levers and a legacy payload.
- live-activity + `misses.test.ts` + `sourceControlBytes` + ExhibitWorkspaces Pip + physics: 46 files, 4354 passed.
- Payloads from `save_payload.py`. All five titles were written by the model, not the fallback: observe K medium, predict G2 hard, compare G3 hard, measure G5 medium, calculate G7 hard.
- Sweep: 0 findings on the 5 payloads, and every miss was named (3/3, 4/4, 3/3, 3/3, 3/3). The advisories ("scene facts contain the key") come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, 16 item records x 5 samples, `TUTOR_REPLAY_ITEMS=all`, `--observe`; `replay/gravity-drop-tower-2026-10-15{,-r2,-r3}.json`)
The automatic checks flagged 8/1040 on r1. All 8 were false positives: an object named in a question. Reading every reply by hand found:
- **r1, observe**: after a `said_together` miss and on stuck/lever turns, about 17 of 30 replies asked "which one touches the ground first?". That tells the learner the pair did not land together, which is the fix. On the no-air pair, 3/5 lever replies said "as they fall slowly together" or "side by side", which is the answer.
- **r1, measure**: 2/10 stuck replies asked "what number multiplied by itself gives nine?" (the square-root step), and several said "45 m is nine times 5 m" for the learner.
- **Fixes.** Guidance now forbids questions or descriptions that assume one object lands first or that they fall together, and forbids saying the height ratio or the square root in measure. The observe scene constraint says "Which one landed first?" is not asked. **r3**: 2/30 observe stuck/lever replies still say "see what touches first"; none say "together" or "side by side"; no measure reply names the root or the ratio.
- **No other leaks found.** Predict replies read the Moon card's text aloud, which is on screen (see open findings). Calculate replies read the formula card aloud, also on screen. Credit replies are accurate.
- **Lever doctrine (the other agent's finding, counted only):** "I opened / I've added / I've simplified" narration appeared 1x in r1 and 5x in r3. Two-lever turns: 0 (one_lever_per_turn 0/160 on each run).

## Undriven modes
None. The sweep drives taps; the workspace test drives a spoken answer on observe.

## Open findings
- 2/30 observe replies still presuppose "which one touches first". The wording is the tutor's, not ours, so a check over replies would catch it: `/add-live-tutor-tools` (T3 responsiveness tier, shared).
- `moon_card` on no-air predict items is strong help: tutors read its last line ("they hit the ground at the same moment") and the learner can transfer it. Credit is recorded as assisted. Ruled 2026-10-16 (R10): keep. A help lever may show more, and the credit is assisted.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`, one spoken program per mode.
- No `docs/contracts/gravity-drop-tower.md`. The new requirements (code-built keys, no readout before credit, choices opening after a watched drop, a clear gap for every air pair) are recorded only here. `/primitive-contract`.
- Needs a browser check on the canvas: platform heights, the fall animation and its timing, the stopwatch, the air lines and arrows, ghost pictures, the level line and the hidden-height ruler. Only JSDOM has run them, and JSDOM has no canvas.
