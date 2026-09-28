# When to run a live Gemini journey

Every `run_*.py` journey here is a paid Gemini Live session, plus observer, reviewer and (without
`--input`) generation calls. `--audio` costs most. On 2026-09-27 the harness account opened ~100 Live
sessions in a day (~$35); about a dozen answered every question asked. This file decides how many a
change needs. Skills point here instead of setting their own counts.

**Since 2026-09-27 (handoff 20 Part D, user ruling) a primitive's gate is code plus tutor replay, not Live.**
Live sessions are kept for what only they show: tool-call narration, turn timing, transport and real audio.

## The three tiers

| Question | Tier | Cost |
|---|---|---|
| Does the screen do the right thing on a right or wrong answer (credit, retry, advance, nothing revealed)? | the dry journey `runtime/journeySweep.test.tsx` (J1-J8 on every saved payload) | free, ~20 s |
| What does this wrong answer show, and which lever comes next? | the primitive's miss function and `nextLever`, `it.each` tables; catalog `misses` typed by `missLists<Union>` and checked by `catalog/misses.test.ts` | free |
| Does the tutor say something useful, without the answer, the fix, protocol or an early narration? | **tutor replay** `tutor_replay.py`: the Live session's real instructions, tools and state notes to gemini-3.8-flash, 5 samples per moment, scored by `replay_checks.py`; `--observe` sends spoken replies to the real dialogue observer | text calls, cents |
| Timing, turn order, transport, real audio, what the tutor says about its own tool call | a Live run | paid |

Replay is calibrated against saved Live runs (`my-tutoring-app/qa/tutor-reports/replay/calibration-2026-09-27.md`):
it reproduces the fix stated after a miss (LB-4: 13/25 on the old doctrine, 0/30 on the current) and the
fraction near-answer (22/30), and it fixed RP-1 from 30/30 to 0/30 without a Live run. **It does not see**
the tutor narrating its own tool call ("I pulled a lever": Live 3/7, replay 0/35) or events rarer than
about 1 in 5 (LB-11). Those stay Live questions.

## What only a live run shows

- turn order and timing with real audio: a host message sent into a reply already under way went
  unanswered (LB-8), and text runs could not show it;
- what the tutor says about a tool call it made itself (the replay model never voiced "lever" where
  the Live tutor did);
- a judge's verdicts on real speech (`--di-bench`), and anything about the microphone or playback.

## Free checks, always

- Rendering, component state, the workspace commit, a lever's leak rule, a simplify builder: vitest
  with the real runtime (`runtime/testing/workspaceHarness.tsx`).
- Misses and levers: code, `it.each` (`/add-support-tiers`, "The table becomes code").
- Every bound family end to end on its saved payloads: the dry journey. A new binding's payload comes from
  `python save_payload.py --primitive <id> --mode <m>` (one generation call, no Live session).
- Generated content: `/eval-test`, `/oracle-test`, a generator probe.
- A harness or check fix: re-score saved JSON. `analyze_run.py <report.json>` for `--lever` runs,
  `tutor_replay.py --rescore <report.json>` for replay and calibration reports.

## Tutor replay, how

```bash
cd my-tutoring-app && TUTOR_REPLAY_OUT=<moments.json> TUTOR_REPLAY_ONLY=<id> npm test -- src/components/lumina/components/live-activity/runtime/journeySweep.test.tsx -t "tutor replay"
cd backend/tests/tutor_live && ../../venv/Scripts/python tutor_replay.py <moments.json> --primitive <id> --samples 5 [--observe]
```

A replay passes when no check misses on any sample. A miss is read by hand before it is filed: the checks are
code over words, and a false positive is fixed in `replay_checks.py` with a pinned case in `test_replay_checks.py`.
For a before/after comparison, replay the same moments with the old and the new wording
(`--calibrate <saved run> --doctrine-rev <rev>` for doctrine changes).

## How many runs, by change

| Change | Free checks (always) | Replay | Live runs |
|---|---|---|---|
| Component, generator, leak rule, builder, harness | vitest, sweep, eval-test/oracle, saved JSON | only if it changes what the tutor is told (scene facts, lever list, task text): the family, 5 samples | **none** |
| New live capability on a primitive (workspace binding, lever set, DI port): **the gate** | workspace test, sweep J1-J8 on its payload, miss table, `misses.test.ts`, typecheck | the family, every recorded mode, 5 samples; `--observe` on a spoken mode | **none**. A spoken mode judged from real audio (a DI port, phonemes): 1 `--audio` |
| Tutor-facing wording (guidance, doctrine, host messages, tool descriptions) | vitest | before and after on the family that showed the problem, 5-10 samples; a shared layer: plus ONE other family | **none**, unless the class is one replay cannot see (tool-call narration, under 1 in 5): then text runs, stop when clear |
| A change to WHERE shared doctrine rides (guidance vs session instruction vs host message) | vitest | before and after | 1 text run on two families (placement changed Live behavior in ways text did not, 09-21) |
| Timing, turn order, transport, speech judging | vitest with simulated turns | — | `--audio`, 1-2 runs per affected family |
| A fix to a primitive whose gate already passed | vitest | the change type's row | the change type's row; the gate is not re-run |

**Weekly Live sample.** Once a week, one `--lesson-entry --lever` text run and one `--audio` run, on three
families that changed that week (rotate otherwise). Each run's actual lines are then replayed with
`--calibrate`, so the replay's agreement is re-measured on fresh Live evidence. Record the result in
`my-tutoring-app/qa/tutor-reports/replay/`.

## Rules for any live run

- Name the question first, and why replay cannot answer it. Stop as soon as it is answered. A finding confirmed 2 of 2 needs no third run.
- Use `--input <saved payload>` so a run pays for no generation.
- A startup flake ("the model never spoke its opening") is re-run alone, not with its batch.
- One session benches a family at a time: check for another session before starting.
- A queued reviewer finding is fixed and then checked by the tier its change type needs, not by the full gate.
- A finding seen in 1 of N runs is not re-run on its own: a few clean runs cannot confirm it. Mark it fixed-unmeasured and read it off the next weekly sample.
