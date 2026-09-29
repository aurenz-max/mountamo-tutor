# RP-2: a wrong spoken answer is recorded from the learner's words

**Status 2026-09-29: DONE, shipped `c7caf1db` (RP-2) + `50c9730b` (LB-15).** Enabled: counting-board `count`, ten-frame `subitize`. LB-15 fixed at the backend. Report: `qa/tutor-reports/rp2-spoken-verdict-from-words-2026-09-29.md`.

Date: 2026-09-29 · Executor: `/add-live-tutor-tools` · Queue: handoff [20](20-misses-and-tutor-replay.md) RP-2 (ruling and finding), plus lever-bench LB-15 · Owns: `components/live-activity/runtime/**`, the dialogue observer route, `backend/tests/tutor_live/` harness

## Why this exists

When a child answers aloud, the dialogue observer decides credit by reading the tutor's reply. If the tutor coaches without a verdict ("Let's count them together slowly!"), the observer returns no verdict: the wrong answer is never recorded and the lesson can stall. Replay: 5 of 19 samples on `counting-board.count`. `spoken_miss` already reads the learner's words and named every wrong count in the pilot, but today it only attaches a miss after the tutor's verdict says not credited.

Also seen Live on a spoken choice (handoff 26, LB-21): `knowledge-check` recall, "Police badge" said twice; the second drew a coaching question and no verdict, so the 2nd-wrong auto-pull never fired. Re-run `run_live_runtime.py --primitive knowledge-check --mode recall --input qa/tutor-reports/knowledge-check-runtime-recall-text-numeric-composed-payload-2026-09-29.json --lever --lesson-entry --lever-ladder second-wrong --runs 1` once, after this ships.

## User rulings, do not reopen (09-28)

1. A wrong spoken answer is known from the LEARNER'S words (JEV / `spoken_miss`), not the tutor's wording. The tutor never has to say "not yet" or "not credited". Do not fix this with doctrine that requires a verdict phrase.
2. **Per mode.** Deciding from the words is switched on only for a mode whose pilot shows JEV reads it well.
3. **Real transcripts.** The pilot must use real Live input transcripts, not written cases. The input ASR writes fiction for right answers ("sechs", "Ciao", "SeaWorld", "Please"; `qa/di/BACKLOG.md`).
4. **The tutor's affirmation still credits.** The tutor heard the audio. Only a non-committal reply is decided from the words.

## Work

1. **Collect real transcripts (free first).** Pull learner transcripts per mode from saved Live runs (`qa/tutor-reports/`, `qa/lever-bench/`, the DI bench runs, the 09-29 M1 audio run). Label each right/wrong by what the item expected. Where a mode has too few (under ~20), a small number of `--audio` runs; budget $35/day, count them in the report.
2. **Pilot per mode** with `spoken_miss` on those transcripts: false "wrong" on a right answer must be 0 to enable a mode. Start with number modes (`counting-board.count`, `ten-frame.subitize`); letters last (bare "s"/"p" were already ambiguous on clean text).
3. **Build:** for an enabled mode, when the observer returns no verdict and `spoken_miss` names a miss, record the attempt as not credited and let the trigger ladder and the 09-24 resolution run (the speech equivalent of `hasCheckedResponse`). A per-mode allow list in the catalog's `teachingWorkspace` (data, not a `componentId` check).
4. **Verify:** `tutor_replay.py --payload counting-board.count --observe` (text calls only): the 5/19 unresolved samples resolve; no right answer is marked wrong. Sweep J1-J11 green; `typecheck:lumina` 0.
5. **LB-15 (same files):** a provider output transcript with no audio behind it repeated the lesson system instruction (`---`, "LESSON ACTIVITIES ... YOUR ROLE"). Count it across session logs first (`silent_turns.py`-style scan); then drop a silent transcript chunk that repeats the system instruction or a markdown heading before it reaches the conversation panel and the observer. Fix at the source per the 09-17 ruling, not with a guard downstream.

## Closing

Handoff 20 RP-2 line: DONE with the per-mode list and the pilot numbers. Report in `qa/tutor-reports/`. LB-15 closed in `qa/lever-bench/QUEUE.md` with its commit. `WORKSTREAMS.md` 2.2 and the rulings table.
