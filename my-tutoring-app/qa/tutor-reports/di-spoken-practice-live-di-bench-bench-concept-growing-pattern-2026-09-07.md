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
| CONFIRMED | HIGH | `di-no-verdict` | probe:bench-concept-growing-pattern:off-task:um 1/1 (1 beat) | answered "um" and the tutor opened with neither sentinel — the loop stalls here: "Two, four, six, eight. What's the rule of this pattern?" |
| CONFIRMED | HIGH | `open-set-probe-vacuous` | * 1/1 (1 beat) | 1 probe(s) drew no classifiable verdict — those trials measured nothing and the bench cannot be read as covering them. |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-concept-growing-pattern:answer-not-explanation:ten 1/1, probe:bench-concept-growing-pattern:adjacent-concept:it goes up 1/1, probe:bench-concept-growing-pattern:adjacent-concept:it counts 1/1, probe:bench-concept-growing-pattern:negated-keyword:it's not plus two, it's plus one 1/1, probe:bench-concept-growing-pattern:negated-keyword:you take away two each time 1/1, probe:bench-concept-growing-pattern:off-task:I don't know 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

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
| `bench-concept-growing-pattern` | `valid-canonical` | plus two | AFFIRM | AFFIRM | OK |
| `bench-concept-growing-pattern` | `valid-canonical` | you add two every time | AFFIRM | AFFIRM | OK |
| `bench-concept-growing-pattern` | `valid-paraphrase` | it jumps by two | AFFIRM | AFFIRM | OK |
| `bench-concept-growing-pattern` | `valid-paraphrase` | every number is two more than the one before | AFFIRM | AFFIRM | OK |
| `bench-concept-growing-pattern` | `valid-childlike` | it's like, two more, two more, two more | AFFIRM | AFFIRM | OK |
| `bench-concept-growing-pattern` | `valid-partial` | twos | AFFIRM | REFUSE | soft |
| `bench-concept-growing-pattern` | `echo` | two four six eight | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `answer-not-explanation` | ten | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `adjacent-concept` | it goes up | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `adjacent-concept` | it counts | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `negated-keyword` | it's not plus two, it's plus one | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `negated-keyword` | you take away two each time | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-concept-growing-pattern` | `off-task` | um | REFUSE | NO VERDICT | MISS |


## Run 1 — beat-by-beat transcript

### ask:bench-concept-growing-pattern
*expect: turn · turn_ended: True · 11.5s · audio: 618280 b64 bytes*
*note: open-set ask - bench-concept-growing-pattern*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-canonical:plus two
*expect: turn · turn_ended: True · 4.9s · audio: 231684 b64 bytes*
*note: student says "plus two" (valid-canonical) - the primary anchor — two words, and the whole answer from a six-year-old*

> Yes, this pattern grows by adding two each time.

### reanchor:bench-concept-growing-pattern:0
*expect: turn · turn_ended: True · 10.5s · audio: 586248 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-canonical:you add two every time
*expect: turn · turn_ended: True · 5.5s · audio: 238120 b64 bytes*
*note: student says "you add two every time" (valid-canonical) - the second anchor in a sentence*

> Yes, this pattern grows by adding two each time.

### reanchor:bench-concept-growing-pattern:1
*expect: turn · turn_ended: True · 10.7s · audio: 583688 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-paraphrase:it jumps by two
*expect: turn · turn_ended: True · 4.8s · audio: 227204 b64 bytes*
*note: student says "it jumps by two" (valid-paraphrase) - no anchor PHRASE in it ("plus two" / "add two" / "counting by twos" are all absent); "two" alone is unavoidable in any true rule for this pattern*

> Yes, this pattern grows by adding two each time.

### reanchor:bench-concept-growing-pattern:2
*expect: turn · turn_ended: True · 10.9s · audio: 580488 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-paraphrase:every number is two more than the one before
*expect: turn · turn_ended: True · 4.9s · audio: 223364 b64 bytes*
*note: student says "every number is two more than the one before" (valid-paraphrase) - the rule stated as a relation between neighbours — a different framing, same idea*

> Yes, this pattern grows by adding two each time.

### reanchor:bench-concept-growing-pattern:3
*expect: turn · turn_ended: True · 10.2s · audio: 565124 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-childlike:it's like, two more, two more, two more
*expect: turn · turn_ended: True · 4.8s · audio: 224004 b64 bytes*
*note: student says "it's like, two more, two more, two more" (valid-childlike) - how a K child says "add two each time" — repetition is the child's "each time"*

> Yes, this pattern grows by adding two each time.

### reanchor:bench-concept-growing-pattern:4
*expect: turn · turn_ended: True · 10.4s · audio: 562564 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:valid-partial:twos
*expect: turn · turn_ended: True · 18.5s · audio: 1101444 b64 bytes*
*note: student says "twos" (valid-partial) - a defensible half-answer — twos WHAT is unsaid. Recorded, never counted*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### reanchor:bench-concept-growing-pattern:5
*expect: turn · turn_ended: True · 10.4s · audio: 565764 b64 bytes*
*note: re-open the same item for the next probe*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:echo:two four six eight
*expect: turn · turn_ended: True · 18.9s · audio: 1120004 b64 bytes*
*note: student says "two four six eight" (echo) - the stimulus read straight back — the pattern said, not its rule*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:answer-not-explanation:ten
*expect: turn · turn_ended: True · 19.3s · audio: 1152004 b64 bytes*
*note: student says "ten" (answer-not-explanation) - the NEXT number. Correct extension of the pattern, and not the rule — exactly the obj2/obj3 confusion the lesson separates*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### reanchor:bench-concept-growing-pattern:7
*expect: turn · turn_ended: True · 10.3s · audio: 573444 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:adjacent-concept:it goes up
*expect: turn · turn_ended: True · 19.4s · audio: 1142404 b64 bytes*
*note: student says "it goes up" (adjacent-concept) - the growing-pattern half-idea the signature clause names: direction without amount is not a rule*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:adjacent-concept:it counts
*expect: turn · turn_ended: True · 19.4s · audio: 1155844 b64 bytes*
*note: student says "it counts" (adjacent-concept) - a true remark about the stimulus that names no rule*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### reanchor:bench-concept-growing-pattern:9
*expect: turn · turn_ended: True · 10.5s · audio: 583684 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:negated-keyword:it's not plus two, it's plus one
*expect: turn · turn_ended: True · 19.4s · audio: 1152004 b64 bytes*
*note: student says "it's not plus two, it's plus one" (negated-keyword) - THE anchor phrase "plus two" is IN the utterance, negated. A word-matching judge affirms this*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:negated-keyword:you take away two each time
*expect: turn · turn_ended: True · 19.4s · audio: 1150724 b64 bytes*
*note: student says "you take away two each time" (negated-keyword) - the keyword "two" with the direction reversed*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### reanchor:bench-concept-growing-pattern:11
*expect: turn · turn_ended: True · 10.9s · audio: 578564 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:off-task:I don't know
*expect: turn · turn_ended: True · 19.3s · audio: 1136004 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: The rule is add two. Two, add two is four, add two is six, add two is eight. Your turn. Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?

### probe:bench-concept-growing-pattern:off-task:um
*expect: turn · turn_ended: True · 6.4s · audio: 314884 b64 bytes*
*note: student says "um" (off-task) - filler, not an idea — the nearest a text turn gets to dead air*

> Two, four, six, eight. What's the rule of this pattern?
