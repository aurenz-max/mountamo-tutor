# Letter Workshop acceptance audit — 2026-09-09

The existing L4 `letter-workshop` implementation was audited against the P1 “Make letter formation interactive and scored” contract. The core trace/copy/write contract was already present. This pass closed two acceptance gaps: generated framing could substitute number-practice language, and copy/write feedback showed a separate model without overlaying the reference on the submitted writing surface.

## Changes

- Constrained generated framing to approved letter-only title and description values, with a post-generation guard that rejects number, digit, numeral, number-sense, or mathematics substitutions.
- Added a dashed reference overlay after copy/write submission. The overlay follows the learner's horizontal placement while retaining the reference's writing-line height, so feedback does not disguise a wrong-case or vertically misplaced form.
- Added regression coverage for pre-submit masking, post-submit overlay, horizontal alignment across all 52 forms, and numeral-framing rejection.

## Acceptance evidence

| Contract | Result |
|---|---|
| Trace visible path | PASS — existing trace guide, starts/arrows by support tier, and ordered-stroke scoring retained |
| Copy beside model | PASS — separate model and blank writing surface before submission |
| Write from audible name | PASS — target remains absent before the cue and submission |
| Submitted/reference overlay | PASS — copy/write now show an aligned dashed reference over retained ink after checking |
| Ordered strokes and pen lifts | PASS — stroke boundaries, pointer type, points, event times, and cleared/submitted attempts remain in the evidence ledger |
| Path/formation scoring | PASS for automated geometric contract — coverage, precision, starts, direction, stroke count, and path length are checked; copy/write remain explicitly provisional and local-only |
| Cumulative groups and case | PASS — unit coverage resolves Groups 1–4 to 12/26/38/52 uppercase/lowercase templates; 12 fresh live group/mode draws stayed in scope |
| No numeral substitution | PASS — the defect reproduced before the patch (`Number Sense Practice`, `Number and Symbol Writing Practice`) and all fresh mode/group draws now return `Letter Workshop` with letter-only framing |

## Verification

- Focused Vitest: **254/254 passed** across component, geometry, formation, difficulty, and generator suites.
- Lumina typecheck: **0 errors**.
- Live `/api/lumina/eval-test`: trace, copy, and write each passed with four correctly pinned challenges and approved framing.
- Live cumulative sweep: **12/12 passed** (Groups 1–4 × trace/copy/write), four challenges per run.

## Remaining human/calibration gate

This audit does not convert provisional copy/write feedback into validated mastery scoring. Human review of all 52 manuscript forms, real audible cue checks, child finger/stylus trials, empirical tolerances, and backend evidence replay remain required. Copy/write therefore remain `localOnly`; no adaptive-state gate was changed.
