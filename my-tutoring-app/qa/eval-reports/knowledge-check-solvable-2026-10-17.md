# knowledge-check — K items with no single right answer (2026-10-17)

`/eval-fix knowledge-check`, from two items the user saw in a K lesson.

## Original failures (saved as calibration cases F1, F2)

| Item | Defect |
|---|---|
| "How many hands long is a row of four small blocks?" ✌️ Two hands / 🖐 Five hands / 👐 Twenty hands | Nothing drawn: the child can only guess. Emoji show other quantities. The Live tutor's bubble said "is two hands long." before the child answered. |
| "Which handle needs more muscle to twist around?" 🚰 Tiny sink knob / 🪣 Long well crank / 🛋️🪔 Soft bed pillow | The load is not stated, so either handle can be defended; it contradicts the wheel-and-axle lesson whichever key is used. Emoji do not show the labels. |

## Cause

The generator's K prompt allowed measuring and comparison questions with nothing drawn. Two checks run after
generation: `preReaderEvidence.ts` matches phrases such as "how many ... are there" or "the picture", and neither
stem contains one; the Jev review (`reviewKnowledgeCheck.ts`) reads "nothing on screen" as `no_evidence`, which
passes. No check asked whether the item can be answered with exactly one right choice, so both shipped.

## Change

- `reviewKnowledgeCheck.ts`: new `solvable` Jev choice on multiple-choice problems (`one_answer` /
  `missing_information` / `several_answers`). `missing + several >= 0.5` sets `blocking` and adds a redraw note.
- `gemini-knowledge-check.ts` `reviewAndRedraw`: a problem still blocking after its one redraw is dropped (the set
  keeps at least one problem). Other notes still ship after the redraw, as before.
- K prompt (`preReaderMcPalette`): the answer must follow from what the child knows or sees; no unit measuring of
  undrawn things; "which needs more" names every condition; each option's emoji shows that thing.

## Calibration (Jev, `solvable` only)

- 12 held-out K cases: all 4 with no single answer score 0.67-1.00 (F1 0.88, F2 0.74, rug steps 1.00, jar/bowl
  0.67); all 8 answerable cases score 0.00-0.21.
- The 33 saved multiple-choice problems from `knowledge-check-jev-review/` (K-5): all <= 0.09.
- True/false was dropped from scope: two true statements scored `missing_information` 0.53 and 0.87.

## Emoji check: built, measured, removed

A per-choice Jev "does the picture show the words" judgment missed both reported items (0.40, 0.31) about where a
fine item scored (0.33). With emoji names supplied by hand it caught every bad case (0.86-0.97) but also flagged
stand-ins that must stay (🚛 for "dump truck" 0.88, 🏖️ for "carry sand" 0.91; excavator has no emoji). Not shipped;
queued as KC-4.

## End to end (12 K sets, 48 problems, 6 topics x 2)

Topics: measuring with hands/blocks, wheels and axles, capacity, weight (the original failure and neighbours);
2D shapes, community helpers (controls). 48/48 problems shipped (4 per set, nothing dropped); 7 sets had first-review
failures, all redrawn; no hands- or crank-style item appeared. Shipped multiple-choice items rescored with `solvable`:
one real miss, "Which container holds less sand? Tall thin glass / Short wide bowl" (0.21): Jev takes the tall glass
as smaller, which is the trap the item sets. No real generation triggered a drop; the drop path is covered by unit
tests (`gemini-knowledge-check.review.test.ts`).

Raw data and scripts: `knowledge-check-jev-review/solvable-2026-10-17/` (`calibration.json` also carries the
removed per-choice picture scores).

## Status

KC-3 mitigated, open for the capacity residual. KC-4 (emoji fidelity) and KC-5 (tutor said the answer) queued.
Tests: knowledge-check folder 51/51. `typecheck:lumina` 0; full tsc 770, none in the touched folder.
