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
| CONFIRMED | HIGH | `di-no-verdict` | probe:bench-concept-repeating-pattern:off-task:um 1/1 (1 beat) | answered "um" and the tutor opened with neither sentinel — the loop stalls here: "Red, blue, red, blue. What is the rule of this pattern?" |
| CONFIRMED | HIGH | `open-set-probe-vacuous` | * 1/1 (1 beat) | 1 probe(s) drew no classifiable verdict — those trials measured nothing and the bench cannot be read as covering them. |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-concept-repeating-pattern:answer-not-explanation:red 1/1, probe:bench-concept-repeating-pattern:adjacent-concept:colors 1/1, probe:bench-concept-repeating-pattern:adjacent-concept:it gets bigger 1/1, probe:bench-concept-repeating-pattern:negated-keyword:it's red then blue then green 1/1, probe:bench-concept-repeating-pattern:negated-keyword:it does not repeat 1/1, probe:bench-concept-repeating-pattern:off-task:I don't know 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

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
| `bench-concept-repeating-pattern` | `valid-canonical` | red then blue | AFFIRM | AFFIRM | OK |
| `bench-concept-repeating-pattern` | `valid-canonical` | red, blue, red, blue, over and over | AFFIRM | AFFIRM | OK |
| `bench-concept-repeating-pattern` | `valid-paraphrase` | it takes turns, one color then the other | AFFIRM | AFFIRM | OK |
| `bench-concept-repeating-pattern` | `valid-paraphrase` | it switches back and forth between them | AFFIRM | AFFIRM | OK |
| `bench-concept-repeating-pattern` | `valid-childlike` | red, blue, red, blue, and it just keeps going like that | AFFIRM | AFFIRM | OK |
| `bench-concept-repeating-pattern` | `valid-partial` | it repeats | AFFIRM | REFUSE | soft |
| `bench-concept-repeating-pattern` | `echo` | red blue red blue | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `answer-not-explanation` | red | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `adjacent-concept` | colors | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `adjacent-concept` | it gets bigger | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `negated-keyword` | it's red then blue then green | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `negated-keyword` | it does not repeat | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-concept-repeating-pattern` | `off-task` | um | REFUSE | NO VERDICT | MISS |


## Run 1 — beat-by-beat transcript

### ask:bench-concept-repeating-pattern
*expect: turn · turn_ended: True · 6.5s · audio: 312324 b64 bytes*
*note: open-set ask - bench-concept-repeating-pattern*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-canonical:red then blue
*expect: turn · turn_ended: True · 5.5s · audio: 245124 b64 bytes*
*note: student says "red then blue" (valid-canonical) - the primary anchor*

> Yes, the pattern repeats red then blue over and over.

### reanchor:bench-concept-repeating-pattern:0
*expect: turn · turn_ended: True · 6.2s · audio: 302120 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-canonical:red, blue, red, blue, over and over
*expect: turn · turn_ended: True · 4.9s · audio: 235524 b64 bytes*
*note: student says "red, blue, red, blue, over and over" (valid-canonical) - THE ECHO-PLUS-IDEA CASE: the stimulus is inside it, and "over and over" is the concept. The echo guard must refuse the read-back ALONE, not the read-back with the rule attached*

> Yes, the pattern repeats red then blue over and over.

### reanchor:bench-concept-repeating-pattern:1
*expect: turn · turn_ended: True · 6.2s · audio: 314920 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-paraphrase:it takes turns, one color then the other
*expect: turn · turn_ended: True · 4.9s · audio: 234244 b64 bytes*
*note: student says "it takes turns, one color then the other" (valid-paraphrase) - no colour named, no anchor token — the idea of alternation stated abstractly*

> Yes, the pattern repeats red then blue over and over.

### reanchor:bench-concept-repeating-pattern:2
*expect: turn · turn_ended: True · 6.2s · audio: 305284 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-paraphrase:it switches back and forth between them
*expect: turn · turn_ended: True · 4.9s · audio: 225924 b64 bytes*
*note: student says "it switches back and forth between them" (valid-paraphrase) - second paraphrase on a different verb*

> Yes, the pattern repeats red then blue over and over.

### reanchor:bench-concept-repeating-pattern:3
*expect: turn · turn_ended: True · 6.5s · audio: 319400 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-childlike:red, blue, red, blue, and it just keeps going like that
*expect: turn · turn_ended: True · 5.2s · audio: 250244 b64 bytes*
*note: student says "red, blue, red, blue, and it just keeps going like that" (valid-childlike) - how a K child explains repetition — by doing it and saying "keeps going"*

> Yes, the pattern repeats red then blue over and over.

### reanchor:bench-concept-repeating-pattern:4
*expect: turn · turn_ended: True · 6.6s · audio: 334084 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:valid-partial:it repeats
*expect: turn · turn_ended: True · 17.0s · audio: 990724 b64 bytes*
*note: student says "it repeats" (valid-partial) - the idea without the unit — a defensible half-answer. Recorded, never counted*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### reanchor:bench-concept-repeating-pattern:5
*expect: turn · turn_ended: True · 6.5s · audio: 332164 b64 bytes*
*note: re-open the same item for the next probe*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:echo:red blue red blue
*expect: turn · turn_ended: True · 16.8s · audio: 997124 b64 bytes*
*note: student says "red blue red blue" (echo) - the stimulus read straight back with NOTHING added — contrast the canonical probe two rows up, where "over and over" is added*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:answer-not-explanation:red
*expect: turn · turn_ended: True · 16.7s · audio: 989444 b64 bytes*
*note: student says "red" (answer-not-explanation) - the next colour. A correct extension, and not the rule*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### reanchor:bench-concept-repeating-pattern:7
*expect: turn · turn_ended: True · 7.2s · audio: 327684 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:adjacent-concept:colors
*expect: turn · turn_ended: True · 17.3s · audio: 1011204 b64 bytes*
*note: student says "colors" (adjacent-concept) - the category the signature clause names — true, and not a rule*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:adjacent-concept:it gets bigger
*expect: turn · turn_ended: True · 17.3s · audio: 1015684 b64 bytes*
*note: student says "it gets bigger" (adjacent-concept) - the growing-pattern confusion — this lesson's own obj2 contrast, applied to the wrong pattern*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### reanchor:bench-concept-repeating-pattern:9
*expect: turn · turn_ended: True · 6.3s · audio: 319364 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:negated-keyword:it's red then blue then green
*expect: turn · turn_ended: True · 17.0s · audio: 1004804 b64 bytes*
*note: student says "it's red then blue then green" (negated-keyword) - THE anchor phrase "red then blue" is in it, and the unit is wrong. A word-matching judge affirms this*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:negated-keyword:it does not repeat
*expect: turn · turn_ended: True · 17.0s · audio: 1002248 b64 bytes*
*note: student says "it does not repeat" (negated-keyword) - the keyword "repeat" with the idea reversed*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### reanchor:bench-concept-repeating-pattern:11
*expect: turn · turn_ended: True · 6.3s · audio: 318084 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:off-task:I don't know
*expect: turn · turn_ended: True · 17.1s · audio: 1000968 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: The rule is red then blue, over and over. Red, blue, then red, blue again — the same two colors repeat. Your turn. Red, blue, red, blue. What is the rule of this pattern?

### probe:bench-concept-repeating-pattern:off-task:um
*expect: turn · turn_ended: True · 7.4s · audio: 308484 b64 bytes*
*note: student says "um" (off-task) - filler, not an idea — the nearest a text turn gets to dead air*

> Red, blue, red, blue. What is the rule of this pattern?
