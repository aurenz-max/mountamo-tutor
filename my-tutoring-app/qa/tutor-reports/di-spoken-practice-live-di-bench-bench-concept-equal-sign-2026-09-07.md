# Tier-3 Live Tutor Report — di-spoken-practice — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-spoken-practice", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": ["item \"bench-concept-equal-sign\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-growing-pattern\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-repeating-pattern\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key.", "item \"bench-concept-ten-rod\": response class \"concept_statement\" is BLOCKED \u2014 BENCH OWED \u2014 qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md \u00a75 (qa/di/BACKLOG.md item 36). First caller di-spoken-practice `explain_concept`; the class is refused here until `/tutor-test di-spoken-practice --di-bench` clears it on the conceptStatementBench key."], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "probes": 14, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 2 WARN mechanism(s) confirmed (1 + 7 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-false-refusal` | probe:bench-concept-equal-sign:valid-canonical:it means equal 1/1 (1 beat) | CORRECTED a right answer ("it means equal"): "My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equal" |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-concept-equal-sign:answer-not-explanation:five 1/1, probe:bench-concept-equal-sign:adjacent-concept:it means the answer is next 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-verdict-embellished` | probe:bench-concept-equal-sign:adjacent-concept:it means add them up 1/1, probe:bench-concept-equal-sign:negated-keyword:they are not the same 1/1, probe:bench-concept-equal-sign:negated-keyword:one side has more, not equal 1/1, probe:bench-concept-equal-sign:off-task:I don't know 1/1, probe:bench-concept-equal-sign:off-task:um 1/1 (5 beats) | added 20 unscripted words to a "say exactly" line. SCRIPT: "My turn: The equal sign means both sides have the same amount. Three plus two is" SPOKE: "My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus" |

## Bench matrix - `concept_statement` via di-spoken-practice

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 14 scored probe(s) over 1 stimulus/stimuli - 13 agreed with the key, 1 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `adjacent-concept` | 2 | 2 |
| `answer-not-explanation` | 1 | 1 |
| `echo` | 1 | 1 |
| `negated-keyword` | 2 | 2 |
| `off-task` | 2 | 2 |
| `valid-canonical` | 1 | 2 |
| `valid-childlike` | 1 | 1 |
| `valid-paraphrase` | 2 | 2 |
| `valid-partial` | 1 | 1 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-concept-equal-sign` | `valid-canonical` | both sides are the same | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `valid-canonical` | it means equal | AFFIRM | REFUSE | MISS |
| `bench-concept-equal-sign` | `valid-paraphrase` | they match | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `valid-paraphrase` | this side and that side are even | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `valid-childlike` | it's, um, same same on the two | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `valid-partial` | same | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `echo` | three plus two equals five | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `answer-not-explanation` | five | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `adjacent-concept` | it means the answer is next | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `adjacent-concept` | it means add them up | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `negated-keyword` | they are not the same | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `negated-keyword` | one side has more, not equal | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-concept-equal-sign` | `off-task` | um | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:bench-concept-equal-sign
*expect: turn · turn_ended: True · 11.8s · audio: 647720 b64 bytes*
*note: open-set ask - bench-concept-equal-sign*

> I will show you something, and you tell me what it means in your own words. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-canonical:both sides are the same
*expect: turn · turn_ended: True · 5.5s · audio: 263720 b64 bytes*
*note: student says "both sides are the same" (valid-canonical) - the primary anchor, as a child would say it*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:0
*expect: turn · turn_ended: True · 7.2s · audio: 365444 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-canonical:it means equal
*expect: turn · turn_ended: True · 17.9s · audio: 1050884 b64 bytes*
*note: student says "it means equal" (valid-canonical) - the anchor "equal amounts" in its shortest honest form — equal IS the concept*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### reanchor:bench-concept-equal-sign:1
*expect: turn · turn_ended: True · 7.2s · audio: 365444 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-paraphrase:they match
*expect: turn · turn_ended: True · 5.2s · audio: 236164 b64 bytes*
*note: student says "they match" (valid-paraphrase) - THE BUCKET THE CLASS EXISTS FOR: not one anchor token in it, and a complete statement of the idea*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:2
*expect: turn · turn_ended: True · 7.5s · audio: 370564 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-paraphrase:this side and that side are even
*expect: turn · turn_ended: True · 5.1s · audio: 240644 b64 bytes*
*note: student says "this side and that side are even" (valid-paraphrase) - a second paraphrase on a different word ("even"), so the bucket is not one lucky synonym*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:3
*expect: turn · turn_ended: True · 7.3s · audio: 367364 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-childlike:it's, um, same same on the two
*expect: turn · turn_ended: True · 5.8s · audio: 254724 b64 bytes*
*note: student says "it's, um, same same on the two" (valid-childlike) - grammar and diction are not the skill; the idea (same on both) is there*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:4
*expect: turn · turn_ended: True · 8.0s · audio: 362884 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-partial:same
*expect: turn · turn_ended: True · 5.1s · audio: 242564 b64 bytes*
*note: student says "same" (valid-partial) - a defensible half-answer — same WHAT is unsaid. Recorded either way, never counted*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:5
*expect: turn · turn_ended: True · 7.2s · audio: 373124 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:echo:three plus two equals five
*expect: turn · turn_ended: True · 17.8s · audio: 1025284 b64 bytes*
*note: student says "three plus two equals five" (echo) - the stimulus read straight back with nothing added. A child affirmed here learns that reading the screen is explaining it*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:answer-not-explanation:five
*expect: turn · turn_ended: True · 17.5s · audio: 1032964 b64 bytes*
*note: student says "five" (answer-not-explanation) - THE K-1 SIGNATURE ERROR: the sum. True, confident, and not what = means — the miss a judge grading "did they say something correct" waves through*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### reanchor:bench-concept-equal-sign:7
*expect: turn · turn_ended: True · 7.2s · audio: 368644 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:adjacent-concept:it means the answer is next
*expect: turn · turn_ended: True · 17.8s · audio: 1037444 b64 bytes*
*note: student says "it means the answer is next" (adjacent-concept) - the documented misconception (= as "the answer comes here"), named in the objective's own intent text*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:adjacent-concept:it means add them up
*expect: turn · turn_ended: True · 19.0s · audio: 1124484 b64 bytes*
*note: student says "it means add them up" (adjacent-concept) - the operator confusion — the sign that tells you to add is +, and this reads = as an instruction*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us? Think about what we just said together.

### reanchor:bench-concept-equal-sign:9
*expect: turn · turn_ended: True · 7.3s · audio: 372484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:negated-keyword:they are not the same
*expect: turn · turn_ended: True · 22.8s · audio: 1370884 b64 bytes*
*note: student says "they are not the same" (negated-keyword) - THE BUCKET THAT FAILS A WORD-MATCHING JUDGE: the anchor "the same" is in it, and the idea is reversed*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us? Remember when you said they match earlier? That's the same idea as having the same amount.

### probe:bench-concept-equal-sign:negated-keyword:one side has more, not equal
*expect: turn · turn_ended: True · 21.8s · audio: 1304964 b64 bytes*
*note: student says "one side has more, not equal" (negated-keyword) - anchor token "equal" present, claim opposite — second reading of the same trap*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us? Think about a scale when it's balanced – that means both sides are the same.

### reanchor:bench-concept-equal-sign:11
*expect: turn · turn_ended: True · 7.3s · audio: 372520 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:off-task:I don't know
*expect: turn · turn_ended: True · 24.0s · audio: 1440004 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us? The answer is that both parts are equal, or the same. Can you tell me what that means in your own words?

### probe:bench-concept-equal-sign:off-task:um
*expect: turn · turn_ended: True · 24.4s · audio: 1476484 b64 bytes*
*note: student says "um" (off-task) - filler, not an idea — the nearest a text turn gets to dead air*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us? Remember when we talked about a scale being balanced with the same amount on each side? It's like that. What do you think?
