# Fraction Circles: Touch the Fraction ? 2026-09-12

Implemented `fraction-circles[touch_fraction]`: hear a fraction and touch its matching circle. Scope is proper fractions in halves, thirds, and fourths. This is recognition of a pictured amount; the requested name is already in the question, so repeating it aloud would not demonstrate the skill. The user explicitly requested the touch interaction.

The code builds three mathematically distinct choices, with exactly one match, equal-sized wholes, randomized answer positions, and varied shaded slices. The same full bank stays available on a correction. A single touch commits the answer; code computes correctness and the shared DI runner carries the tutor's correction, affirmation, cap, and progression. The stage has no Check or Next button. DiActionPanel supplies the start/direction surface and question replay repeats only the ask.

`fractionTouchModes.ts` owns the catalog mode, generator docs, action contract, and response class. `fractionTouchScript.ts` owns picture construction, scripted cues, validation, and the headless adapter. `FractionTouch.tsx` supplies the stage. Existing fraction tasks retain their component flow; mixed sessions collect local child evaluations and submit one aggregate, preserving touch scores and per-task evidence. The new prior is beta 1.25; existing fraction priors are unchanged.

Generator routing now uses resolveEvalModes for pinned, intent, blend, and mixed requests. Schema bounds plus a coverage check and one retry prevent silent omission of a task. Mixed-draw inspection also exposed pre-existing text/diagram disagreement: instructions and narration now follow validated numeric data, and comparison/equivalent denominators obey the grade-band ceiling. The equivalentDenominator tutoring placeholder is now supplied.

## Verification

- 27 focused frontend tests across six files passed: exhaustive fraction-choice properties, DI pack/catalog gates, touch locking and evaluation, mixed-session single submission, generation routing/retry, legacy grade-band tests, and fraction oracle regressions.
- 3 backend tests passed, including the new fraction-touch calibration check.
- `npm run typecheck:lumina`: 0 errors.
- Static tutoring audit: PASS, no findings.
- Real generator probe: pinned easy, pinned hard, intent-only, touch+build blend, and all-five-mode mixed; all passed. Evidence: `pinned-easy.json`, `pinned-hard.json`, `intent.json`, `blend.json`, `mixed.json` in this directory. Reproduce with `node scripts/fraction-touch-probe.mjs --run`.
- Real Gemini Live drive: 5/5 deliberately wrong touches corrected, 5/5 correct touches affirmed, 5/5 hands-hold intervals silent, no findings. [Transcript](../tutor-reports/fraction-circles-live-di-plain-2026-09-12.md). The drive replays gesture cues; it does not exercise actual tablet input, browser audio, or microphone transport.

## Remaining human check

Open Math Primitives ? Fraction Circles ? Touch the Fraction. Start the tutor; intentionally touch a wrong picture, retry correctly, replay the question, and make rapid extra taps during a verdict. Confirm equal-sized circles, readable partitions on a narrow tablet, no answer-position hints, stable retries, and natural audio/progression. Also test a touch+build blend's handoff and final summary. Browser automation returned ?No browser is available? in this session; no pixel or physical touch verification is claimed. Tracked in HUMAN-CHECKS #153.

This is a new mode, not a conversion of the four legacy modes to DI. Their reading/typing/manual progression remains as before. Commits and pushes were not requested.
