# Birth Certificate — addition-fact-strategies (2026-10-02)

**Lifecycle layer: L3 + workspace W1 (2026-10-03)** — born L0: pedagogically sound, measurable, single core mode, generic tutor.
Source: the standalone "Pip's Number Adventure" HTML game (map of 9 strategy levels).

- Core task identity: `recall`, which means saying the sum of a single-digit addition fact within one strategy family (`strategy`: plus_zero, plus_one, doubles, turnaround, plus_two, facts_3_4, facts_5_6, facts_7_8, facts_mixed). The family is chosen from the topic or intent, or pinned with `config.strategy`.
- Generator fork: **A, pool service.** Gemini writes only the title, description, strategy and objectEmoji. Code builds the facts from the source game's pools (8 per session, 10 for mixed, 6 for 7s/8s), deduplicates them, avoids adjacent repeats, and picks an intro example the session never asks.
- What was dropped from the source: the level map, stars, localStorage progress, browser TTS and the ⚡ "lightning fast" reward. The adaptive engine owns progression. The tutor voice is Gemini Live. Speed is measured silently (`averageFirstResponseMs`).
- sendText tags wired: [STRATEGY_INTRO], [NEXT_ITEM], [COMEBACK], [ANSWER_CORRECT], [ANSWER_INCORRECT] (help level stated, "do not say the sum"), [ALL_COMPLETE].
- Answer-leak audit:
  - The slot shows "?" until the fact is solved.
  - The pad is always 0-18, so it never narrows to the answer.
  - Object groups are hidden until the first miss. The source game showed them up front on +0 and +1.
  - The turn-around known fact appears only after a miss. The source game showed it permanently, which gave away the answer.
  - The intro example is never a session fact in either order.
  - Titles containing `=` or a digit+digit fact are replaced.
- Design gate (Phase 2):
  - Manipulation: pass. The child taps objects to count them and taps the sum.
  - Simulation: exception. Fact recall is not a system. Each strategy is shown in its own representation instead: a hop strip, butterfly wings, flipped cards, or groups.
  - Production: pass. The child picks from a full 0-18 pad instead of 3 choices, so wrong answers cannot be eliminated.
  - Timer: pass. There is no visible timer, and response time is recorded silently.
  - Layout leak: pass, as audited above.
- Measurement: per-fact score is 100 for a first try, 50 for a second and 25 after that. Canonical 9 metrics plus `strategy`, `averageFirstResponseMs`, `comebackCount` and `comebackFirstTryCount`. A missed fact comes back once, two facts later. The comeback is measured but does not change the fact's score.
- Curriculum home: **NOT RUN.** `/curriculum-fit addition-fact-strategies` needs the backend on :8000, which was down. Expected homes are 1.OA.C.6 and 2.OA.B.2 addition-within-20 skills.
- Pip surface (Phase 2d): classic, using `useWorkspacePipSurface`. Pip outlines the 0-18 pad as one region. It never points at a number, a counted object or the known-fact card. No surface is published on the intro card. Surface test 2/2. Tester attach test is green. Headless drive showed one dock and no overflow.

## Follow-up queue (run in order)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| ✓0 | `/curriculum-fit addition-fact-strategies` | home check | DONE 2026-10-03 ([report](../curriculum-fit/addition-fact-strategies-2026-10-03.md)). G2 OPS002-04-a direct; G1 homes partial; sum-window overrun on OPS001-01-c fixed. |
| 1b | `/add-eval-modes` | L1 | `near_doubles` mode (PTRN001-05-b, OPS002-04-a focus); needs a help state showing the double. |
| ✓1 | `/add-eval-modes` | L1 eval-dense | DONE 2026-10-03. 6 modes on the source game's step path: plus_zero 3.0, plus_one 3.5, doubles 4.0, turnaround 4.5, plus_two 5.0, big_facts 5.5 (the four big-fact bands are one mode; the topic picks the band). Constrains the root `strategy` enum; `config.strategy` still pins an exact band. Real-Gemini probe 11/11 (`scripts/addition-fact-strategies-modes-probe.mjs`). Owed: `/eval-test` per mode. |
| ✓2 | `/add-tutoring-scaffold` | L2 tutored | DONE 10-03; `/tutor-test` T1+T2 pass. Superseded the same day on the live path by the workspace (catalog `tutoring` no longer reaches the tutor there). |
| ✓3 | `/add-support-tiers` | L3 levered | DONE 10-03 on a new W1 workspace binding ([levers](addition-fact-strategies-levers-2026-10-03.md), [workspace](../tutor-reports/addition-fact-strategies-workspace-2026-10-03.md)). 5 levers, replay 0 misses. |
| 5 | `/add-sound` | L5 polished | Already uses SoundManager: correct/incorrect, pop per counted object, tap on start/next. Check that it fits the kit sound language. |
| ✓ | `/eval-test addition-fact-strategies` | QA loop | Birth passed (`qa/eval-reports/addition-fact-strategies-2026-10-02.md`). |
