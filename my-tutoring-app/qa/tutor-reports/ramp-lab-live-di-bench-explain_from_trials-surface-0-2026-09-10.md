# Tier-3 Live Tutor Report — ramp-lab — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "ramp-lab", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "probes": 8, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 5 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:explain_from_trials-surface-0:wrong-number:A moved at 30.5 newtons and B at 34.5 newtons, so A needed less push. 1/1, probe:explain_from_trials-surface-0:answer-not-explanation:Setup A moved at 20.5 newtons. 1/1, probe:explain_from_trials-surface-0:adjacent-concept:Ramps make work easier. 1/1, probe:explain_from_trials-surface-0:echo:What did changing the condition do to the push? 1/1, probe:explain_from_trials-surface-0:off-task:I like pizza. 1/1 (5 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `concept_statement` via ramp-lab

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 8 scored probe(s) over 1 stimulus/stimuli - 8 agreed with the key, 0 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `adjacent-concept` | 1 | 1 |
| `answer-not-explanation` | 1 | 1 |
| `echo` | 1 | 1 |
| `off-task` | 1 | 1 |
| `valid-canonical` | 1 | 1 |
| `valid-paraphrase` | 1 | 1 |
| `wrong-number` | 1 | 1 |
| `wrong-verdict` | 1 | 1 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `explain_from_trials-surface-0` | `valid-canonical` | Changing the surface changed the push: setup A moved at 20.5 newtons and setup B at 34.5 newtons, so A needed less push. | AFFIRM | AFFIRM | OK |
| `explain_from_trials-surface-0` | `valid-paraphrase` | When we changed the surface, B took more push than A. | AFFIRM | AFFIRM | OK |
| `explain_from_trials-surface-0` | `wrong-verdict` | Setup B needed less push than setup A. | REFUSE | REFUSE | OK |
| `explain_from_trials-surface-0` | `wrong-number` | A moved at 30.5 newtons and B at 34.5 newtons, so A needed less push. | REFUSE | REFUSE | OK |
| `explain_from_trials-surface-0` | `answer-not-explanation` | Setup A moved at 20.5 newtons. | REFUSE | REFUSE | OK |
| `explain_from_trials-surface-0` | `adjacent-concept` | Ramps make work easier. | REFUSE | REFUSE | OK |
| `explain_from_trials-surface-0` | `echo` | What did changing the condition do to the push? | REFUSE | REFUSE | OK |
| `explain_from_trials-surface-0` | `off-task` | I like pizza. | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:explain_from_trials-surface-0
*expect: turn · turn_ended: True · 6.4s · audio: 316804 b64 bytes*
*note: open-set ask - explain_from_trials-surface-0*

> What did changing the surface do to the push? Use your two trial results to explain.

### probe:explain_from_trials-surface-0:valid-canonical:Changing the surface changed the push: setup A moved at 20.5 newtons and setup B at 34.5 newtons, so A needed less push.
*expect: turn · turn_ended: True · 11.2s · audio: 641924 b64 bytes*
*note: student says "Changing the surface changed the push: setup A moved at 20.5 newtons and setup B at 34.5 newtons, so A needed less push." (valid-canonical) - Changed condition and both recorded results.*

> Yes, your explanation agrees with both trials. Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons.

### reanchor:explain_from_trials-surface-0:0
*expect: turn · turn_ended: True · 6.2s · audio: 321284 b64 bytes*
*note: re-open the same item for the next probe*

> What did changing the surface do to the push? Use your two trial results to explain.

### probe:explain_from_trials-surface-0:valid-paraphrase:When we changed the surface, B took more push than A.
*expect: turn · turn_ended: True · 11.0s · audio: 620804 b64 bytes*
*note: student says "When we changed the surface, B took more push than A." (valid-paraphrase) - True qualitative comparison is allowed.*

> Yes, your explanation agrees with both trials. Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons.

### reanchor:explain_from_trials-surface-0:1
*expect: turn · turn_ended: True · 5.9s · audio: 303364 b64 bytes*
*note: re-open the same item for the next probe*

> What did changing the surface do to the push? Use your two trial results to explain.

### probe:explain_from_trials-surface-0:wrong-verdict:Setup B needed less push than setup A.
*expect: turn · turn_ended: True · 13.2s · audio: 760360 b64 bytes*
*note: student says "Setup B needed less push than setup A." (wrong-verdict) - Reversed evidence.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### probe:explain_from_trials-surface-0:wrong-number:A moved at 30.5 newtons and B at 34.5 newtons, so A needed less push.
*expect: turn · turn_ended: True · 12.7s · audio: 731524 b64 bytes*
*note: student says "A moved at 30.5 newtons and B at 34.5 newtons, so A needed less push." (wrong-number) - Correct conclusion with fabricated measurement.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### reanchor:explain_from_trials-surface-0:3
*expect: turn · turn_ended: True · 6.1s · audio: 311684 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> What did changing the surface do to the push? Use your two trial results to explain.

### probe:explain_from_trials-surface-0:answer-not-explanation:Setup A moved at 20.5 newtons.
*expect: turn · turn_ended: True · 13.0s · audio: 746244 b64 bytes*
*note: student says "Setup A moved at 20.5 newtons." (answer-not-explanation) - Only one observation, no comparison.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### probe:explain_from_trials-surface-0:adjacent-concept:Ramps make work easier.
*expect: turn · turn_ended: True · 12.9s · audio: 748804 b64 bytes*
*note: student says "Ramps make work easier." (adjacent-concept) - General slogan does not use the records.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### reanchor:explain_from_trials-surface-0:5
*expect: turn · turn_ended: True · 6.0s · audio: 308484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> What did changing the surface do to the push? Use your two trial results to explain.

### probe:explain_from_trials-surface-0:echo:What did changing the condition do to the push?
*expect: turn · turn_ended: True · 12.7s · audio: 736644 b64 bytes*
*note: student says "What did changing the condition do to the push?" (echo) - Echo without an explanation.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### probe:explain_from_trials-surface-0:off-task:I like pizza.
*expect: turn · turn_ended: True · 12.8s · audio: 743044 b64 bytes*
*note: student says "I like pizza." (off-task) - Unrelated to the investigation.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.
