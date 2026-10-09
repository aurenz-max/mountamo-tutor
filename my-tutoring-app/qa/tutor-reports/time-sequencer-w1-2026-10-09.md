# time-sequencer — W1 workspace binding (plain shape), 2026-10-09

**Modes (7):** sequence-3, time-of-day, sequence-5, before-after, duration-compare, clock-sequence, read-schedule. All driven.

**Checked by code (the activity's own Check, `timeSequencerMiss`):**

| Mode | Misses |
|---|---|
| sequence-3 | reversed, swapped_pair, wrong_first |
| sequence-5, clock-sequence | reversed, swapped_pair, wrong_first, out_of_order |
| time-of-day | next_period (cyclic neighbour), far_period |
| before-after | other_event (options carry no time data, so nothing finer) |
| duration-compare | said_same, missed_same, shorter_one |
| read-schedule | next_row, other_row, not_on_schedule |

Tutor packet: cards listed alphabetically (never in the day's order), clock-sequence hours not listed, no `correct*`
field. Event cards, period, duration and "About the Same" buttons gained `aria-label`s (journey `choose`).

**Gates**
- `typecheck:lumina`: 0.
- `TimeSequencer.workspace.test.tsx` 13/13; with pip surface, misses, lessonWorkspacePlan, activityContract: 224/224.
- Journey sweep + W1 contract (`-t time-sequencer`): 36/36; 7 payloads, 0 findings, 35/35 checked misses named.
- Payloads: 6 at Kindergarten, read-schedule at Grade 1.

**Tutor replay** (7 modes x 4 moments x 5 samples, gemini-3.8-flash), `replay/time-sequencer-2026-10-09.json`:
- First run: stuck `no_key_before_try` 12/20. Real hits: time-of-day stuck said "that is the morning! find Morning"
  (4/5); duration "eating a cookie can be pretty quick". Fixed in guidance (ask about the learner's day, then stop;
  never answer it or tie it to a choice). Before-fix run: `replay/time-sequencer-2026-10-09-before-guidance-fix.json`.
- Re-run: stuck 3/20, miss 0/20, start 18/20. Every remaining hit read by hand is the tutor reading ALL the
  choices aloud (the key is one of them), which the guidance asks for at K-1. Checker false positive on choice
  primitives; not filed in `replay_checks.py` from here (shared harness).

**Open:** no browser check yet (needs one on sequence ordering and Try again re-seeding the start-here card).
read-schedule highlights the asked row (existing scaffold, unchanged).
