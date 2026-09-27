# When to run a live Gemini journey

Every `run_*.py` journey here is a paid Gemini Live session, plus observer, reviewer and (without
`--input`) generation calls. `--audio` costs most. On 2026-09-27 the harness account opened ~100 Live
sessions in a day (~$35); about a dozen answered every question asked. This file decides how many a
change needs. Skills point here instead of setting their own counts.

## What only a live run shows

A live run is the only evidence of what the **model** does with what we send it:

- what the tutor says and does given its instructions: 3 of 3 runs stated the fix after a wrong
  answer until the doctrine changed (LB-4); the tutor told the child "I pulled a lever" because a host
  message said "lever";
- which tool the tutor chooses (a lever pull or talk; 0 of 3 pulls before `LEVER_DOCTRINE`);
- turn order and timing with real audio: a host message sent into a reply already under way went
  unanswered (LB-8), and text runs could not show it;
- a judge's verdicts on real speech (`--di-bench`).

No vitest, eval-test or oracle run can show these. When a change can affect them, run live.

## What it does not show better than a free check

- Rendering, component state, the workspace commit, a lever's leak rule, a simplify builder: vitest
  with the real runtime (`runtime/testing/workspaceHarness.tsx`).
- Generated content: `/eval-test`, `/oracle-test`, a generator probe.
- A harness fix (an assertion, an id, a wait): re-read the saved report JSON the failing run wrote.
- A refactor with unit coverage, catalog text the tutor never receives.

## How many runs, by change

| Change | Free checks (always) | Live runs |
|---|---|---|
| Component, generator, leak rule, builder, harness | vitest, eval-test/oracle, saved JSON | **none**, unless it changes what the tutor is told (scene facts, lever list, task text): then 1 text run |
| New live capability on a primitive (workspace binding, lever set, DI port) | vitest | **the gate, once**: 3 text + 1 `--audio` (W1 binding: 1 smoke run, `--audio` only on a spoken mode) |
| Tutor-facing wording (guidance, doctrine, host messages, tool descriptions) | vitest | text runs on the family that showed the problem; stop when the answer is clear (usually 2-4). A shared layer: plus 1 run on ONE other family |
| Timing, turn order, transport, speech judging | vitest with simulated turns | `--audio`, 1-2 runs per affected family |
| A fix to a primitive whose gate already passed | vitest | only the change type's row above; the gate is not re-run |

## Rules for any live run

- Name the question first; stop as soon as it is answered. A finding confirmed 2 of 2 needs no third run.
- Use `--input <saved payload>` so a run pays for no generation.
- A startup flake ("the model never spoke its opening") is re-run alone, not with its batch.
- One session benches a family at a time: check for another session before starting.
- A queued reviewer finding is fixed and then checked by the run its change type needs, not by the full gate.
- A finding seen in 1 of N runs is not re-run on its own: a few clean runs cannot confirm it. Mark it fixed-unmeasured and read it off the next planned gate.
