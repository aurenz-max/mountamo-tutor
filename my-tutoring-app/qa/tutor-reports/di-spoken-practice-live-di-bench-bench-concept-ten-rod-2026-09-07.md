# Tier-3 Live Tutor Report — di-spoken-practice — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-spoken-practice", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": ["item \"bench-concept-equal-sign\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-growing-pattern\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-repeating-pattern\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-ten-rod\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key."], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "probes": 14, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 2 HIGH + 1 WARN mechanism(s) confirmed (2 + 6 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-no-verdict` | probe:bench-concept-ten-rod:off-task:um 1/1 (1 beat) | answered "um" and the tutor opened with neither sentinel — the loop stalls here: "One ten rod, and ten ones. What does the ten rod show us?" |
| CONFIRMED | HIGH | `open-set-probe-vacuous` | * 1/1 (1 beat) | 1 probe(s) drew no classifiable verdict — those trials measured nothing and the bench cannot be read as covering them. |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-concept-ten-rod:answer-not-explanation:ten 1/1, probe:bench-concept-ten-rod:adjacent-concept:the rod is longer 1/1, probe:bench-concept-ten-rod:adjacent-concept:the rod is bigger so it's more 1/1, probe:bench-concept-ten-rod:negated-keyword:ten ones is not the same as a ten 1/1, probe:bench-concept-ten-rod:negated-keyword:the rod is one and the cubes are ten, so the cubes are more 1/1, probe:bench-concept-ten-rod:off-task:I don't know 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `concept_statement` via di-spoken-practice

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 14 scored probe(s) over 1 stimulus/stimuli - 12 agreed with the key, 1 missed valid, 1 soft disagreement(s), 1 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `adjacent-concept` | 2 | 2 |
| `answer-not-explanation` | 1 | 1 |
| `echo` | 1 | 1 |
| `negated-keyword` | 2 | 2 |
| `off-task` | 1 | 2 |
| `valid-canonical` | 2 | 2 |
| `valid-childlike` | 1 | 1 |
| `valid-paraphrase` | 2 | 2 |
| `valid-partial` | 0 | 1 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-concept-ten-rod` | `valid-canonical` | ten ones make one ten | AFFIRM | AFFIRM | OK |
| `bench-concept-ten-rod` | `valid-canonical` | the rod is the same as the ten cubes | AFFIRM | AFFIRM | OK |
| `bench-concept-ten-rod` | `valid-paraphrase` | they're both ten | AFFIRM | AFFIRM | OK |
| `bench-concept-ten-rod` | `valid-paraphrase` | it's just the little cubes stuck together | AFFIRM | AFFIRM | OK |
| `bench-concept-ten-rod` | `valid-childlike` | it's, like, ten of the little ones but in one piece | AFFIRM | AFFIRM | OK |
| `bench-concept-ten-rod` | `valid-partial` | same | AFFIRM | REFUSE | soft |
| `bench-concept-ten-rod` | `echo` | one ten rod and ten ones | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `answer-not-explanation` | ten | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `adjacent-concept` | the rod is longer | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `adjacent-concept` | the rod is bigger so it's more | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `negated-keyword` | ten ones is not the same as a ten | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `negated-keyword` | the rod is one and the cubes are ten, so the cubes are more | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-concept-ten-rod` | `off-task` | um | REFUSE | NO VERDICT | MISS |


## Run 1 — beat-by-beat transcript

### ask:bench-concept-ten-rod
*expect: turn · turn_ended: True · 6.0s · audio: 282244 b64 bytes*
*note: open-set ask - bench-concept-ten-rod*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-canonical:ten ones make one ten
*expect: turn · turn_ended: True · 5.2s · audio: 240004 b64 bytes*
*note: student says "ten ones make one ten" (valid-canonical) - the primary anchor ("ten ones make ten") as a child completes it*

> Yes, one ten rod is the same as ten ones.

### reanchor:bench-concept-ten-rod:0
*expect: turn · turn_ended: True · 5.9s · audio: 295044 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-canonical:the rod is the same as the ten cubes
*expect: turn · turn_ended: True · 5.0s · audio: 239364 b64 bytes*
*note: student says "the rod is the same as the ten cubes" (valid-canonical) - the concept sentence in a child's words*

> Yes, one ten rod is the same as ten ones.

### reanchor:bench-concept-ten-rod:1
*expect: turn · turn_ended: True · 5.9s · audio: 279044 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-paraphrase:they're both ten
*expect: turn · turn_ended: True · 5.5s · audio: 238724 b64 bytes*
*note: student says "they're both ten" (valid-paraphrase) - equivalence stated without "same", "make", or "ones" — no anchor phrase present*

> Yes, one ten rod is the same as ten ones.

### reanchor:bench-concept-ten-rod:2
*expect: turn · turn_ended: True · 5.8s · audio: 276484 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-paraphrase:it's just the little cubes stuck together
*expect: turn · turn_ended: True · 5.1s · audio: 236804 b64 bytes*
*note: student says "it's just the little cubes stuck together" (valid-paraphrase) - the composition idea from the other direction (a ten is made of ones) with no anchor token*

> Yes, one ten rod is the same as ten ones.

### reanchor:bench-concept-ten-rod:3
*expect: turn · turn_ended: True · 5.9s · audio: 297000 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-childlike:it's, like, ten of the little ones but in one piece
*expect: turn · turn_ended: True · 4.8s · audio: 231684 b64 bytes*
*note: student says "it's, like, ten of the little ones but in one piece" (valid-childlike) - diction is not the skill; ten-ones-as-one-piece IS the idea*

> Yes, one ten rod is the same as ten ones.

### reanchor:bench-concept-ten-rod:4
*expect: turn · turn_ended: True · 5.6s · audio: 275204 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:valid-partial:same
*expect: turn · turn_ended: True · 15.0s · audio: 871684 b64 bytes*
*note: student says "same" (valid-partial) - a defensible half-answer. Recorded, never counted*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### reanchor:bench-concept-ten-rod:5
*expect: turn · turn_ended: True · 5.8s · audio: 272644 b64 bytes*
*note: re-open the same item for the next probe*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:echo:one ten rod and ten ones
*expect: turn · turn_ended: True · 14.9s · audio: 869764 b64 bytes*
*note: student says "one ten rod and ten ones" (echo) - the stimulus read straight back*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:answer-not-explanation:ten
*expect: turn · turn_ended: True · 15.1s · audio: 876804 b64 bytes*
*note: student says "ten" (answer-not-explanation) - the number. True of both things on the table, and not an explanation of why they are the same*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### reanchor:bench-concept-ten-rod:7
*expect: turn · turn_ended: True · 5.9s · audio: 280964 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:adjacent-concept:the rod is longer
*expect: turn · turn_ended: True · 15.1s · audio: 876164 b64 bytes*
*note: student says "the rod is longer" (adjacent-concept) - a TRUE fact about the rod that is not the idea — the trap for a judge grading truth instead of relevance*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:adjacent-concept:the rod is bigger so it's more
*expect: turn · turn_ended: True · 15.0s · audio: 883204 b64 bytes*
*note: student says "the rod is bigger so it's more" (adjacent-concept) - the base-ten misconception itself (a ten rod is "more" than ten ones)*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### reanchor:bench-concept-ten-rod:9
*expect: turn · turn_ended: True · 5.7s · audio: 277800 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:negated-keyword:ten ones is not the same as a ten
*expect: turn · turn_ended: True · 15.1s · audio: 869124 b64 bytes*
*note: student says "ten ones is not the same as a ten" (negated-keyword) - every anchor token present, idea reversed — THE word-matching trap*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:negated-keyword:the rod is one and the cubes are ten, so the cubes are more
*expect: turn · turn_ended: True · 15.1s · audio: 879364 b64 bytes*
*note: student says "the rod is one and the cubes are ten, so the cubes are more" (negated-keyword) - the keywords one and ten, deployed to argue inequality — the counting-the-pieces confusion*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### reanchor:bench-concept-ten-rod:11
*expect: turn · turn_ended: True · 5.7s · audio: 276484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:off-task:I don't know
*expect: turn · turn_ended: True · 15.0s · audio: 875524 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: One ten rod is the same as ten ones. If you break the rod apart you get ten little ones, so they are the same amount. Your turn. One ten rod, and ten ones. What does the ten rod show us?

### probe:bench-concept-ten-rod:off-task:um
*expect: turn · turn_ended: True · 5.8s · audio: 273320 b64 bytes*
*note: student says "um" (off-task) - filler, not an idea — the nearest a text turn gets to dead air*

> One ten rod, and ten ones. What does the ten rod show us?
