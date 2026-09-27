# number-line: items drawn off the displayed line

Date: 2026-09-27 · Executor: `/eval-fix` · Blocks: the number-line jump lever pilot (`docs/SUPPORT_LEVERS_BRIEF.md`)

## What failed

On a 2026-09-26 live journey (Grade 1, topic "Subtracting multiples of ten on a number line", jump), the line rendered 0–30. Its items were 58−4, 60−5, 16−1 and 91−4, so three of the four landings were off the line. The component drops out-of-range values from its zoom and snaps a click to the visible edge, so both the scripted wrong answer and the scripted correct answer were placed at 30. The journey still reported PASS.

Reproduced on 2026-09-27 through the harness's own route (`/api/lumina/tutor-test`, Grade 1, `jump`, one draw per topic):

| Topic | Line | Items off the line |
|---|---|---|
| Subtracting multiples of ten on a number line | 0–30 | 4/4 |
| Adding and subtracting tens within 100 on a number line | 0–30 | 3/4 |
| Subtract within 10 (starting at 5 to 9, taking away 1 to 4) | 0–10 | 0/4 |
| Counting on to add within 20 | 0–20 | 0/4 |

## Cause

The learner should place a landing on the line they can see. `generateNumberLine` resolves the topic's domain (0–100 for both failing topics) and passes it to the sub-generators, and `selectShowJumpTuples` draws starts from that whole domain. Only after generation does the K-2 legibility clamp (contract C1) cut the displayed line to 0–30, and nothing re-checks the items against it. The missing invariant: every value an item asks the child to place must lie on the displayed line.

The adapter's `validateActivityData` does reject this content. It runs only where a lesson binds a section to the workspace (`lessonWorkspacePlan.ts:42`), and a rejection there silently leaves the section unbound. The journey driver's `mount` never called it.

## Fix

- `gemini-number-line.ts`: the displayed range is decided before any sub-generator draws (`clampK2Range`, the same C1 rule: cap 30, or 120 for an explicit Grade-1 domain). A focus range outside the displayed line is dropped. After generation, any item whose values fall off the line is dropped and logged, never moved (`challengeValues`). The late clamp stays as a guard.
- `scripts/primitive-runtime-driver.mjs`: `mount` runs the adapter's validator, so a journey fails on content a lesson would refuse.

## Verification

- New `gemini-number-line.display-range.test.ts` (4 tests): a Grade-2 jump session on a 0–100 domain over 20 draws, an explicit Grade-1 0–100 domain, a Grade-4 domain, and `clampK2Range` bounds. With the fix disabled, the first test fails.
- Existing number-line suites: 44 files, 710 tests passed. `typecheck:lumina` = 0.
- Real generations after the fix (same four topics, three draws each): **0 of 48 items off the line**.
- Driver: mounting the original failing payload now stops with "Generated number line has an invalid challenge".

## Still open

- **Topic fidelity, not fixed here.** Tens topics get hops of 1–5 (30−3, 23+2), because the K-2 jump sizes are fixed at 1–5. "Starting at 5 to 9, taking away 1 to 4" is not enforced either: starts of 1, 2, 3 and 10 appear. Executor: `/topic-fidelity`.
- **Grade-1 window on the probe route.** "Adding and subtracting tens within 100" rendered 0–30 on the tutor-test route. Either the route does not pass a canonical grade, or the resolver did not mark "within 100" as explicit. Unverified; check with `/topic-fidelity`.
- **A journey can pass without the correct answer being credited.** Executor: `/add-live-tutor-tools` (harness).
- Not re-driven as a connected Live journey.
