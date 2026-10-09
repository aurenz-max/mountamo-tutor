# practice-problem — contract

One generated problem, solved by hand on a whiteboard. The transcription (`transcribeWork`) reads the lines; the judge
(`compareWork`) compares them with the generated worked solution and returns correct / partial / incorrect. Modes
`derive_easy`, `derive_medium`, `derive_hard` are step-count bands (2-3, 3-5, 4-6) of the same task. The support tier
(`config.difficulty`) only sets which scaffolds start on screen.

## Requirements

- **R1 — the answer stays private until credit.** No label, scaffold or default state shows `canonicalAnswer` or a
  step's `canonicalBody`. Step titles name the move, never its result. Probe: `practiceProblemLevers.test.ts` (leak rule
  over every saved payload's scaffold text).
- **R2 — the tier withdraws scaffolds, never content.** easy: titles, start-here hint, strategy; medium: titles and
  strategy; hard: none. The judge always compares against the full worked solution. Probe: the generator's tier code.
- **R3 — workspace (2026-10-09, W1 C17).** On the tutor-owned path the judge's verdict is the checked gesture
  (`practiceMiss`: `nothing_read`, `unfinished`, `answer_without_work`, `step_error`, `wrong_answer`). A not-correct
  verdict shows a one-line status and keeps the worked solution, the judge's summary and its notes off the screen and
  out of the packet; Try again keeps the learner's lines. The worked solution shows only after a correct verdict. The
  tutor is never sent the canonical solution. Probe: `PracticeProblem.workspace.test.tsx`.
- **R4 — levers (2026-10-09).** `step_titles`, `start_here`, `strategy` (the tier's scaffolds, pullable when off; a
  scaffold whose text shows a result is not offered) and `mark_lines` (only after a check flagged a line; marks the
  learner's own line, never the fix). No simplify lever; `nothing_read` unanswered. Probe:
  `PracticeProblem.levers.workspace.test.tsx`, `practiceProblemLevers.test.ts`.
- **R5 — scripted path unchanged.** Without the tutor: one attempt, the verdict and the side-by-side reveal, one
  submission scored 100 / 60 / 0.

## Gaps

- **G1 — answer keys that disagree with their own steps · FIXED 2026-10-09.** 2026-10-09 payloads: derive_medium
  `4(m + 2) + 14 = 134` keys `m = 27` (the steps give m + 2 = 30, so 28); derive_easy keys `x = \frac{21}{3}` against a
  step ending `x = 7` and a statement asking for simplest form. The judge grounds on the key, so a right derivation can
  be marked wrong. The derive_hard payload was wrong too (`3300h = 105000 -> h = 300`). Fixed in code:
  `service/math/practiceProblemKey.ts` (`checkPracticeKey`) solves every one-variable linear equation in the steps;
  steps that disagree are dropped and the solution regenerated (3 tries), a key that disagrees with consistent steps
  or is unreduced in a simplest-form problem is replaced by the last step's result. Non-linear work is unchecked.
  Probe: `practiceProblemKey.test.ts`; fresh payloads 3/3 consistent.
- **G2 — not drivable by the dry sweep · OPEN.** Every mode needs a canvas image and the model judge; the sweep has
  neither (J1 baselined). The mounted tests stub both routes.

## History

- 2026-10-09 — created with the W1 workspace binding (R3) and levers (R4).
