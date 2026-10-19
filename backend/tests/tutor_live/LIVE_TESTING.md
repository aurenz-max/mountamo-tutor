# When to run a live Gemini journey

Every `run_*.py` journey here is a paid Gemini Live session, plus observer, reviewer and (without
`--input`) generation calls. `--audio` costs most. On 2026-09-27 the harness account opened ~100 Live
sessions in a day (~$35); about a dozen answered every question asked. This file decides how many a
change needs. Skills point here instead of setting their own counts.

**USER RULING 2026-10-17: agents never run a Live session or a tutor replay. The user runs them.** A
`.claude/hooks/block-paid-gemini.py` PreToolUse hook blocks `run_*.py` and `tutor_replay.py` (except
`--rescore`, which is free). An agent finishes the free tiers, then hands the user the exact command and the
question it answers, and stops. Why: tutor replay was treated as free; on 10-10, 10-15 and 10-16 agents ran
11-13K replay samples a day on gemini-3.8-flash (117 runs in two days) and the bill was ~$90-105 a day.
Generation calls that produce content to run Lumina (`save_payload.py`, `/eval-test`, `/oracle-test`, probes)
stay allowed.

**Since 2026-09-27 (handoff 20 Part D, user ruling) a primitive's gate is code plus tutor replay, not Live.**
Live sessions are kept for what only they show: tool-call narration, turn timing, transport and real audio.

## The three tiers

| Question | Tier | Cost |
|---|---|---|
| Does the screen do the right thing on a right or wrong answer (credit, retry, advance, nothing revealed)? | the dry journey `runtime/journeySweep.test.tsx` (J1-J8 on every saved payload) | free, ~20 s |
| What does this wrong answer show, and which lever comes next? | the primitive's miss function and `nextLever`, `it.each` tables; catalog `misses` typed by `missLists<Union>` and checked by `catalog/misses.test.ts` | free |
| Does the tutor say something useful, without the answer, the fix, protocol or an early narration? | **tutor replay** `tutor_replay.py`: the Live session's real instructions, tools and state notes to gemini-3.8-flash, 1 sample per moment by default, scored by `replay_checks.py`; `--observe` sends spoken replies to the real dialogue observer | **paid, user-run**: every request resends instructions, tools and history; a full-family gate at 5 samples is dollars, not cents |
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
cd backend/tests/tutor_live && ../../venv/Scripts/python tutor_replay.py <moments.json> --primitive <id> [--samples 1] [--observe]
```

The first line (moments) is free and an agent may run it. The second is the user's: the script prints the
request count and refuses over 300 without `--yes`. Always `--samples 1` (USER RULING 2026-10-18, below).

By default only each payload's first item is recorded. `TUTOR_REPLAY_ITEMS=all` records every item, one record each
(`<file>#2`, `#3`...; the host text the tutor got as the item opened starts its record): use it for a gate, since later
items carry different keys, choices and lever states (10-15: equation-balancer named the unbalanced element on a
later item 3/5 that the first item never showed).

Tool calls are answered as the bridge answers them: one action per round (a second is `blocked`), and a lever the
sweep did not record comes back marked pulled in the packet. Until 10-15 an unrecorded lever came back with nothing
pulled, and the tutor pulled again: every two-lever reply in the 10-15 lever-turn replay was that
(`qa/tutor-reports/lever-turn-doctrine-2026-10-15.md`).

**USER RULING 2026-10-19: no sample per family on the boss path.** A family moved to a boss is gated by the free
checks (`test:primitive`, the boss guards, `boss-card.mjs`). Ask the user for a sample only when a change touches the
shared path (a doctrine sentence, a judge or flow value, the assignment or key shape in `boss.ts`, host messages,
tool descriptions) or adds `words.special`. Nothing is recorded as owed.

**USER RULING 2026-10-18: one sample, breadth over depth, on the boss path.** The 10-17 bar (under 3% misses per
check) took ~22K samples across the primitives and is retired. A replay or Live run is ONE sample per moment, and
speed beats per-primitive certainty: cover many bosses once rather than one boss many times.

- A miss seen once is a finding. Read it by hand (a false positive is fixed in `replay_checks.py` with a pinned case
  in `test_replay_checks.py`), then fix it where every boss gets the fix: the rotation (`ROTATION_DOCTRINE`), the
  shared doctrine, or the boss schema (`components/live-activity/boss.ts`). A boss's `words.special` takes only a
  fact true of that primitive alone.
- No re-sampling to confirm a miss, and no before/after at 5-10 samples. The fix is checked on the next bosses'
  single samples; a shared fix that holds there is done.
- A primitive still on prose `guidance` is not tuned further: it moves to a boss (`/add-live-tutor-tools`), and its
  findings land on the shared path.

## How many runs, by change

The Replay and Live columns below are what the agent ASKS the user to run, once per primitive. A fix after a
failed replay re-runs only the failing moment, not the family.

| Change | Free checks (always) | Replay | Live runs |
|---|---|---|---|
| Component, generator, leak rule, builder, harness | vitest, sweep, eval-test/oracle, saved JSON | only if it changes what the tutor is told (scene facts, lever list, task text): the family, 1 sample | **none** |
| New live capability on a primitive (workspace binding, lever set, DI port): **the gate** | workspace test, sweep J1-J8 on its payload, miss table, `misses.test.ts`, typecheck. **This is the whole gate.** | **none** (USER RULING 10-17: the shared doctrine is proven; a binding adds only its payload, which the free checks cover) | **none**. A spoken mode judged from real audio (a DI port, phonemes): 1 `--audio`, user-run |
| Tutor-facing wording (guidance, doctrine, host messages, tool descriptions) | vitest | 1 sample on the family that showed the problem; a shared layer (rotation, doctrine, boss schema): plus 1 sample on other bosses | **none**, unless the class is one replay cannot see (tool-call narration, under 1 in 5): then text runs, stop when clear |
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
