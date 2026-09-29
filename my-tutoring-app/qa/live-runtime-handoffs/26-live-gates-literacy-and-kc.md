# Live gates: literacy L1-L3 and knowledge-check

**Status 09-29: DONE for L1-L3 and knowledge-check** ([report](../tutor-reports/h26-live-gates-2026-09-29.md)). L4 still waits on the user.

Date: 2026-09-29 · Executor: `/add-live-tutor-tools` (runs and scoring); fixes go to the executor each miss names · Follows: [22](22-literacy-levers.md), [24](24-literacy-measure-and-finish.md), [25](25-knowledge-check-levers.md) · Pattern: M1's pair, `qa/tutor-reports/m1-live-gate-2026-09-29.md`

## Why this exists

Four classes now have levers on every eval mode and pass their vitest gates: literacy L1 (phonics taps), L2 (spoken sound work), L3 (decoding and reading) and knowledge-check. Under the 09-28 readiness ruling each gets its paid Live pair. This is the only evidence of what the tutor does with the levers in a real session: whether it or the auto-pull acts without being asked, and whether the screen changes before the tutor describes it. L4 waits on the story-bridge ruling (below); do not run it.

## Rulings, do not reopen

- **Readiness (09-28):** every mode levered and vitest green. Payloads cross several challenge types (a mixed payload where one exists).
- **Budget (09-27):** about $35/day. Two runs per class, eight in all. Spread over two days if needed. Stop when the question is answered; never re-run a passed gate. A fix re-runs Live only if it changes tool narration or timing (`LIVE_TESTING.md`).
- **RP-2 (09-28):** a wrong spoken answer is known from the learner's words. It is built in handoff 27, not here; if an L2/L3 run stalls after a coaching reply, file it against RP-2, do not work around it.

## Before you start

- Tree clean and committed (shipped 09-29, `be2fe747`).
- Backend with the absolute `--reload-exclude` (CLAUDE.md). This lane edits no `backend/*.py`; if another lane does, a save mid-run kills the drive (ws 1012).
- `--input <saved payload>` on every run, so no run pays for generation.

## The runs

| Class | Primitive · payload (pick the one crossing the most modes) | Text run | Audio run |
|---|---|---|---|
| L1 phonics taps | letter-spotter or cvc-speller | `--lever --lesson-entry --lever-ladder second-wrong` | `--audio` |
| L2 spoken sound work | rhyme-studio (the pilot) or phoneme-explorer | `--lever --lesson-entry` | `--audio` (the one that matters: the answer is spoken) |
| L3 decoding and reading | word-workout or decodable-reader | `--lever --lesson-entry` | `--audio` |
| knowledge-check | a saved payload with both a numeric and a text choice item | `--lever --lesson-entry --lever-ladder second-wrong` | `--audio` |

Each: score with `lever_checks.py`; `lever_review.py` files misses in `qa/lever-bench/QUEUE.md` with their executor. Read the transcript: no lever described before its visible receipt, no answer word before a try (literacy leak rules, handoff 22). Save one summary per class in `qa/tutor-reports/`.

## Closing

Per class: the class line in handoff 22 (or 25) says "Live gate passed" with the report, `WORKSTREAMS.md` 3.1b / 3.1c / 3.3 updated, lever-bench rows filed. A failing check that is a harness defect (as M1's missing `[data-lever]` mark was) is fixed in the harness and re-scored with `analyze_run.py`, not re-run.

## Blocked here, on the user

L4: story-bridge `say_alike`, `say_different`, `main_idea_compare` have no misses and no levers. Either they get spoken misses (handoff 20 Part B), or they are ruled out of L4's class gate.
