# Lever turns in the shared tutor layer, 2026-10-15

The finding: the tutor pulls two levers in one turn and the reply describes only one, and the tutor says it
"pulled the lever". It was filed from replays on analog-clock, ratio-table, formula-lab and area-model (10-09) and
equation-balancer, stoichiometry-lab and gas-laws-simulator (10-15).

## Cause: the replay harness, not the tutor

`tutor_replay.py` answered every tool call with `visible`. For a lever the sweep had not pulled itself, it sent
back the packet from before the pull, with every lever still `pulled: false`. The tutor saw a pull that changed
nothing, so it pulled again, usually the lever the sweep had recorded, and then described that one. Every two-lever
reply in the baseline fits this. The first pull was never the sweep's lever (equation-balancer `atom_tally` then
`molecule_view`; stoichiometry `recipe_card` then `mole_counts`; gas-laws `one_change` then `relation_card`), and
three equation-balancer replies pulled `atom_tally` twice. Live gets the real packet with the lever marked pulled,
so it does not have this trigger.

Fix (harness only): a lever the sweep did not record now comes back with that lever marked pulled. Calls are
answered the way the bridge answers them: one action per round, with a second one `blocked`, "Another action is
awaiting its browser receipt". Later rounds keep the state from earlier rounds. New check `one_lever_per_turn` in
`replay_checks.py`, pinned in `test_replay_checks.py`.

## Measurement

The moments are the same in all three runs: `TUTOR_REPLAY_ITEMS=all` on equation-balancer, stoichiometry-lab,
gas-laws-simulator and formula-lab. That is 55 records and 260 moments, with 5 samples each, so 1300 replies per run.
I counted by reading the replies. "Narration" means the reply says lever, tool or "the host", or "I pulled".

| run | file (`replay/`) | two-lever replies | narration | "lever" word (leak) | key | fix | empty reply | API 429 |
|---|---|---|---|---|---|---|---|---|
| before: old harness, old code | `lever-turn-before-2026-10-15.json` | **53** | 6 | 0 | 9 | 0 | 10 | 0 |
| harness fix only, old code | `lever-turn-harness-2026-10-15.json` | **0** | 1 | 0 | 5 | 0 | 0 | 70 |
| harness fix + runtime one-lever rule + tool wording | `lever-turn-after-2026-10-15.json` | 0 | 0 | 0 | 9 | 0 | 0 | 69 |

Constellation-builder, where the "I pulled a lever" line came from, with the old wording vs the new wording:
`lever-turn-cb-before-2026-10-15.json` vs `lever-turn-cb-after-2026-10-15.json`. Both had 0 two-lever replies and
0 narration. The one leak in each run is "press Check Answer" at lesson start, which is a different class.

None of the narration says "lever". It is "I pulled up the mole counts", which describes the screen. All key flags
are on stoichiometry `yield#3`, where the `mole_counts` lever's own label reads "three moles". They show up in every
run and look like a key-list collision. The empty replies in the baseline were the tool-only stuck replies that
followed a pull that did nothing. In runs 2 and 3, about 5% of samples got a 429 because runs overlapped. Those
samples are left out of the counts above.

## What was kept

- Kept: the harness fix and the check (`backend/tests/tutor_live/tutor_replay.py`, `replay_checks.py`,
  `test_replay_checks.py`), plus a note in `LIVE_TESTING.md` under "Tutor replay, how".
- Reverted: the runtime rule (`RuntimeTransport` refused a second `pull_lever` in one learner turn, and the observer
  skipped its pull when the tutor had already pulled one) and the `pull_lever` wording ("One lever per turn ... never
  the tool or the word lever"). Once the harness was fixed they lowered nothing.

## Open

- One case replay cannot show: in Live, the learner says "I'm stuck", the tutor pulls a lever in its reply, and
  the observer's help reading then pulls another (`leverTrigger` does not check for a pull by the tutor). The
  reverted runtime rule closes that case, with a test. Read the next weekly `--lesson-entry --lever` run for
  `observer_lever` after a tutor pull. If it shows up, restore the rule. Executor `/add-live-tutor-tools`.
- The 10-09 and 10-15 two-lever rows (ROLLOUT W2 "lever turns, shared" and the three 10-15 family reports) were
  caused by the harness. They should be closed by whoever owns ROLLOUT.
