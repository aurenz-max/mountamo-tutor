# RP-2, widened: transcript pilots for more spoken modes

**PARKED 09-29 (user: development over testing).** Resume when a class needs spoken verdicts from the learner's words, or with LB-21.

Date: 2026-09-29 · Executor: `/add-live-tutor-tools` · Follows: [27](27-rp2-spoken-verdict-from-words.md) · Evidence: `qa/tutor-reports/rp2-spoken-verdict-from-words-2026-09-29.md`, `qa/tutor-reports/spoken-miss/rp2-transcripts-2026-09-29.json` (579 real turns) · Owns: `components/live-activity/runtime/**`, the spoken-miss and dialogue observers, catalog `teachingWorkspace` allow-list entries

## Why this exists

Since 09-29 a wrong spoken answer is recorded from the child's words on two modes: counting-board `count` and ten-frame `subitize`. The pilot was clean (right answers named wrong 0/340 and 0/100). Every other spoken mode still depends on the tutor's wording, so a coaching reply can leave a wrong answer unrecorded and the second-wrong auto-pull unfired (seen Live: LB-21, knowledge-check recall).

## Rulings, do not reopen (09-28)

1. The words decide, not the tutor's phrasing; no doctrine that requires "not yet".
2. Per mode, only after a pilot passes.
3. The pilot uses REAL Live input transcripts. The ASR writes fiction for right answers ("sechs", "Ciao", "SeaWorld").
4. A tutor affirmation still credits; only a non-committal reply is decided from the words.

## Pass bar (per mode)

Right answers named wrong: **0**. Non-answers named wrong: 0. Wrong answers named: report the rate; below about 80% the mode still gains little, say so. Use handoff 27's pilot script and its prior-line input unchanged, so numbers compare.

## Order: modes with real turns on file first (free)

| Mode | Real turns on file | Note |
|---|---|---|
| shape-sorter `identify` | 231 | |
| di-word-reading `cvc_reading` | 187 | DI family: the tutor judges from audio in-band. Enable only if the words path does not fight the DI affirmation |
| di-math-facts `answer_fact` | 140 | same DI note |
| number-sequencer `before_after` | 107 | M2; its levers are built, so the ladder is ready |
| di-letter-sounds | 175 | **last**: bare letters ("s", "p") were ambiguous even on clean text |

Then modes with too few turns: the rest of M1/M2's spoken modes (counting-board subitize/group/compare/count_on, number-sequencer, ordinal-line, compare-objects, base-ten read_blocks, place-value say_value) and knowledge-check recall. Collect turns from saved runs first; only a mode that matters and has under ~20 turns gets `--audio` runs (budget $35/day, count them in the report). Knowledge-check recall is the first paid candidate (LB-21).

## Build

For a passing mode: add it to the allow list (catalog data, never a `componentId` check). No other code change should be needed; if one is, it is a finding for handoff 27's design.

## Verify

Replay with `--observe` on each enabled mode's payload: a coaching reply after a wrong answer resolves; no right answer is marked wrong. Sweep J1-J11 green; `typecheck:lumina` 0. Browser/mic acceptance stays HUMAN-CHECKS #167.

## Closing

One report with a per-mode table (turns, right-named-wrong, wrong-named, enabled yes/no). Handoff 20 RP-2 line and handoff 27 status updated. `WORKSTREAMS.md` 2.2.
