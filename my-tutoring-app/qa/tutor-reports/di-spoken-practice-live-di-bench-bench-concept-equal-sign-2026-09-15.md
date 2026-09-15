# Tier-3 Live Tutor Report — di-spoken-practice — 2026-09-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-spoken-practice", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "probes": 14, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 2 HIGH + 3 WARN mechanism(s) confirmed (2 + 9 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-no-verdict` | probe:bench-concept-equal-sign:off-task:um 1/1 (1 beat) | answered "um" and the tutor opened with neither sentinel — the loop stalls here: "Three plus two equals five. Look at the equal sign. What does the equal sign tell us?" |
| CONFIRMED | HIGH | `open-set-probe-vacuous` | * 1/1 (1 beat) | 1 probe(s) drew no classifiable verdict — those trials measured nothing and the bench cannot be read as covering them. |
| CONFIRMED | WARN | `di-sentinel-on-ask` | reanchor:bench-concept-equal-sign:5 1/1, reanchor:bench-concept-equal-sign:9 1/1 (2 beats) | the ask opens a sentence with a verdict sentinel — the reducer will read it as a verdict for the previous item: "My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two side" |
| CONFIRMED | WARN | `di-off-script-ask` | reanchor:bench-concept-equal-sign:5 1/1 (1 beat) | only 21% of the scripted ask survived. SCRIPT: "Three plus two equals five. Look at the equal sign. What does the equal sign tell us?" SPOKE: "Yes, the equal sign means both sides have the same amount." |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-concept-equal-sign:answer-not-explanation:five 1/1, probe:bench-concept-equal-sign:adjacent-concept:it means the answer is next 1/1, probe:bench-concept-equal-sign:adjacent-concept:it means add them up 1/1, probe:bench-concept-equal-sign:negated-keyword:they are not the same 1/1, probe:bench-concept-equal-sign:negated-keyword:one side has more, not equal 1/1, probe:bench-concept-equal-sign:off-task:I don't know 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `concept_statement` via di-spoken-practice

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 14 scored probe(s) over 1 stimulus/stimuli - 13 agreed with the key, 0 missed valid, 0 soft disagreement(s), 1 drew no classifiable verdict.

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
| `valid-partial` | 1 | 1 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-concept-equal-sign` | `valid-canonical` | both sides are the same | AFFIRM | AFFIRM | OK |
| `bench-concept-equal-sign` | `valid-canonical` | it means equal | AFFIRM | AFFIRM | OK |
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
| `bench-concept-equal-sign` | `off-task` | um | REFUSE | NO VERDICT | MISS |


## Run 1 — beat-by-beat transcript

### ask:bench-concept-equal-sign
*expect: turn · turn_ended: True · 12.3s · audio: 684160 b64 bytes*
*note: open-set ask - bench-concept-equal-sign*

> I will show you something, and you tell me what it means in your own words. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-canonical:both sides are the same
*expect: turn · turn_ended: True · 5.6s · audio: 284164 b64 bytes*
*note: student says "both sides are the same" (valid-canonical) - the primary anchor, as a child would say it*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:0
*expect: turn · turn_ended: True · 7.3s · audio: 392324 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-canonical:it means equal
*expect: turn · turn_ended: True · 5.6s · audio: 276484 b64 bytes*
*note: student says "it means equal" (valid-canonical) - the anchor "equal amounts" in its shortest honest form — equal IS the concept*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:1
*expect: turn · turn_ended: True · 7.5s · audio: 401924 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-paraphrase:they match
*expect: turn · turn_ended: True · 5.5s · audio: 273924 b64 bytes*
*note: student says "they match" (valid-paraphrase) - THE BUCKET THE CLASS EXISTS FOR: not one anchor token in it, and a complete statement of the idea*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:2
*expect: turn · turn_ended: True · 7.4s · audio: 392324 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-paraphrase:this side and that side are even
*expect: turn · turn_ended: True · 5.4s · audio: 264960 b64 bytes*
*note: student says "this side and that side are even" (valid-paraphrase) - a second paraphrase on a different word ("even"), so the bucket is not one lucky synonym*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:3
*expect: turn · turn_ended: True · 7.0s · audio: 378244 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-childlike:it's, um, same same on the two
*expect: turn · turn_ended: True · 5.5s · audio: 273284 b64 bytes*
*note: student says "it's, um, same same on the two" (valid-childlike) - grammar and diction are not the skill; the idea (same on both) is there*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:4
*expect: turn · turn_ended: True · 7.3s · audio: 384004 b64 bytes*
*note: re-open the same item for the next probe*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:valid-partial:same
*expect: turn · turn_ended: True · 5.4s · audio: 273920 b64 bytes*
*note: student says "same" (valid-partial) - a defensible half-answer — same WHAT is unsaid. Recorded either way, never counted*

> Yes, the equal sign means both sides have the same amount.

### reanchor:bench-concept-equal-sign:5
*expect: turn · turn_ended: True · 5.5s · audio: 273924 b64 bytes*
*note: re-open the same item for the next probe*

> Yes, the equal sign means both sides have the same amount.

### probe:bench-concept-equal-sign:echo:three plus two equals five
*expect: turn · turn_ended: True · 17.2s · audio: 1021444 b64 bytes*
*note: student says "three plus two equals five" (echo) - the stimulus read straight back with nothing added. A child affirmed here learns that reading the screen is explaining it*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:answer-not-explanation:five
*expect: turn · turn_ended: True · 17.1s · audio: 1003520 b64 bytes*
*note: student says "five" (answer-not-explanation) - THE K-1 SIGNATURE ERROR: the sum. True, confident, and not what = means — the miss a judge grading "did they say something correct" waves through*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### reanchor:bench-concept-equal-sign:7
*expect: turn · turn_ended: True · 8.1s · audio: 432640 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:adjacent-concept:it means the answer is next
*expect: turn · turn_ended: True · 17.1s · audio: 1006084 b64 bytes*
*note: student says "it means the answer is next" (adjacent-concept) - the documented misconception (= as "the answer comes here"), named in the objective's own intent text*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:adjacent-concept:it means add them up
*expect: turn · turn_ended: True · 16.7s · audio: 985604 b64 bytes*
*note: student says "it means add them up" (adjacent-concept) - the operator confusion — the sign that tells you to add is +, and this reads = as an instruction*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### reanchor:bench-concept-equal-sign:9
*expect: turn · turn_ended: True · 17.0s · audio: 986240 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:negated-keyword:they are not the same
*expect: turn · turn_ended: True · 16.8s · audio: 971520 b64 bytes*
*note: student says "they are not the same" (negated-keyword) - THE BUCKET THAT FAILS A WORD-MATCHING JUDGE: the anchor "the same" is in it, and the idea is reversed*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:negated-keyword:one side has more, not equal
*expect: turn · turn_ended: True · 16.4s · audio: 952960 b64 bytes*
*note: student says "one side has more, not equal" (negated-keyword) - anchor token "equal" present, claim opposite — second reading of the same trap*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### reanchor:bench-concept-equal-sign:11
*expect: turn · turn_ended: True · 7.0s · audio: 366084 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:off-task:I don't know
*expect: turn · turn_ended: True · 17.0s · audio: 993920 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: The equal sign means both sides have the same amount. Three plus two is five, and five is five, so the two sides match. Your turn. Three plus two equals five. Look at the equal sign. What does the equal sign tell us?

### probe:bench-concept-equal-sign:off-task:um
*expect: turn · turn_ended: True · 7.4s · audio: 381440 b64 bytes*
*note: student says "um" (off-task) - filler, not an idea — the nearest a text turn gets to dead air*

> Three plus two equals five. Look at the equal sign. What does the equal sign tell us?
