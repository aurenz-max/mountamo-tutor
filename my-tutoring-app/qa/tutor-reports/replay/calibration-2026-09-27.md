# Tutor replay calibration, 2026-09-27

Handoff 20 Part C step 4. Question: does a text replay (`backend/tests/tutor_live/tutor_replay.py`, gemini-3.8-flash, the Live session's real system instruction, tools and state notes) reproduce the tutor-wording defects that paid Live runs found?

Method: each saved Live `--lever` run was split into moments (start, miss, stuck, lever, credit). The tutor's actual line and 5 replay samples per moment were scored by the same code checks (`replay_checks.py`). Runs made before a doctrine change were replayed with the doctrine of that time (`--doctrine-rev`). History turns are the tutor's actual lines. Cost: text calls only, no Live session.

| Class | Runs | Live (actual lines) | Replay (samples) | Reproduced? |
|---|---|---|---|---|
| **LB-4** fix stated after a miss, old doctrine (`3cfb37a3^`) | ten-frame run-1,3,4,5,6 | miss 1/5 | miss **13/25**, stuck 3/20 | yes |
| **LB-4** after the doctrine change | ten-frame lb4-after ×3, lb3-text ×2, lb8-final-text | 0/6 miss, 0/6 stuck | **0/30** miss, 0/30 stuck | yes |
| Near-answer after "I'm stuck" (fraction build: "a picture showing one shaded slice") | fraction-circles build-text ×3, build-text-2 ×2, identify-text | stuck 3/6, lever 5/6 | stuck **22/30**, lever 6/30 | yes on stuck; lower on lever |
| Same, current doctrine | fraction-circles build-text-3 | lever 1/1 | stuck 4/5, lever 5/5 | yes |
| **LB-11** fix before any try ("shade just one of the slices"), old doctrine (`f0f32c22^`) | fraction-circles build ×5 | start 1/6 | start 0/30 | **no** (rare in Live: 1 of 7 runs) |
| Tutor says "I pulled a lever" to the child | fraction-circles build-text, build-text-3 | stuck 3/7 | 0/35 | **no** |

## Reading

- The replay reproduces a defect the doctrine caused and shows it gone after the doctrine fix. It shows the defect at a higher rate than Live did (13/25 against 1/5), so it is a sensitive check for "says the fix". It is not a rate estimate for Live.
- It reproduces the fraction near-answer. After a part-whole lever, both the Live tutor and the replay describe the lever's frame as "one shaded slice on top", which on a 1/3 build is the count to shade. This is a live defect in the current doctrine, not a scorer artifact. It is queued as a finding, not fixed here.
- It misses two classes:
  - **LB-11** was 1 of 7 in Live; 30 samples found none.
  - **"I pulled a lever"**: the Live tutor voiced its own tool call. The replay model, given the same tool, never said "lever". This may be a real difference between the audio and text models when narrating a tool call. It is **still a Live-only question**.
- All 16 flagged ten-frame replay lines were read by hand and all are true positives ("Try adding one more to make two!"). The scorer's false positives from this session are pinned in `test_replay_checks.py`: restating the ask, "Hop 1 is now drawn", "one-third" as the ask's own fraction, and "ten frame".

## What this supports (Part D, for the user to confirm)

A replay run can stand in for the text Live runs that ask "does the tutor say the answer or the fix before a try?". It cannot yet stand in for:
- tool-call narration ("lever", "tool"),
- rare wording events (under about 1 in 5),
- anything about timing or audio.

Files: `calibration-{tf,fc}-{before,after}-2026-09-27.json` (per-moment actual lines, replay samples and checks). Re-score after a check changes with `python tutor_replay.py --rescore <file>`, which is free.
