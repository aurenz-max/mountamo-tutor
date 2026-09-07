# Tier-3 Live Tutor Report — di-worked-procedure — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-worked-procedure", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "probes": 14, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:wpb-52-28-c0-decide:forgot-decrement:borrow, twelve minus eight 1/1, probe:wpb-52-28-c0-decide:off-task:umm 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `number_word_to_20/procedure_step` via di-worked-procedure

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 14 scored probe(s) over 1 stimulus/stimuli - 14 agreed with the key, 0 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `flipped-column` | 2 | 2 |
| `forgot-decrement` | 2 | 2 |
| `no-move` | 2 | 2 |
| `off-task` | 2 | 2 |
| `valid-canonical` | 1 | 1 |
| `valid-childlike` | 1 | 1 |
| `valid-paraphrase` | 2 | 2 |
| `wrong-landing` | 2 | 2 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `wpb-52-28-c0-decide` | `valid-canonical` | I can't take eight from two, so I regroup: four tens, twelve ones | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-decide` | `valid-paraphrase` | I borrow one from the five. The five is four now and the two is twelve. | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-decide` | `valid-paraphrase` | trade a ten. twelve and four | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-decide` | `valid-childlike` | um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-decide` | `flipped-column` | eight minus two is six | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `flipped-column` | two minus eight is six | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `forgot-decrement` | I regroup, the two becomes twelve | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `forgot-decrement` | borrow, twelve minus eight | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `no-move` | four | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `no-move` | twelve | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `wrong-landing` | I regroup: four tens, thirteen ones | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `wrong-landing` | borrow, so it's eleven and four | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-decide` | `off-task` | umm | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:wpb-52-28-c0-decide
*expect: turn · turn_ended: True · 11.8s · audio: 659204 b64 bytes*
*note: open-set ask - wpb-52-28-c0-decide*

> We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-canonical:I can't take eight from two, so I regroup: four tens, twelve ones
*expect: turn · turn_ended: True · 4.8s · audio: 232964 b64 bytes*
*note: student says "I can't take eight from two, so I regroup: four tens, twelve ones" (valid-canonical) - the anchor wording*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:0
*expect: turn · turn_ended: True · 5.8s · audio: 295080 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-paraphrase:I borrow one from the five. The five is four now and the two is twelve.
*expect: turn · turn_ended: True · 4.6s · audio: 220804 b64 bytes*
*note: student says "I borrow one from the five. The five is four now and the two is twelve." (valid-paraphrase) - "borrow" for regroup, digits named by value — the move and both numbers with none of the anchor phrasing*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:1
*expect: turn · turn_ended: True · 5.9s · audio: 293124 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-paraphrase:trade a ten. twelve and four
*expect: turn · turn_ended: True · 4.6s · audio: 217604 b64 bytes*
*note: student says "trade a ten. twelve and four" (valid-paraphrase) - terse, order reversed, "trade" for regroup — still the whole move*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:2
*expect: turn · turn_ended: True · 5.9s · audio: 299560 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-childlike:um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four
*expect: turn · turn_ended: True · 4.6s · audio: 215044 b64 bytes*
*note: student says "um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four" (valid-childlike) - grammar and hedging are not the skill*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:3
*expect: turn · turn_ended: True · 5.8s · audio: 295080 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:flipped-column:eight minus two is six
*expect: turn · turn_ended: True · 15.7s · audio: 899204 b64 bytes*
*note: student says "eight minus two is six" (flipped-column) - THE signature error: the column turned upside down. Fluent, true as a fact, wrong as a move*

> My turn: not eight minus two is six — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:flipped-column:two minus eight is six
*expect: turn · turn_ended: True · 15.1s · audio: 895364 b64 bytes*
*note: student says "two minus eight is six" (flipped-column) - the flip stated as if it were the column — same error, different words*

> My turn: not two minus eight is six — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:5
*expect: turn · turn_ended: True · 5.8s · audio: 293160 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:forgot-decrement:I regroup, the two becomes twelve
*expect: turn · turn_ended: True · 11.8s · audio: 680324 b64 bytes*
*note: student says "I regroup, the two becomes twelve" (forgot-decrement) - the right decision with the tens digit left at five — the error a teacher catches here, not at the tens*

> My turn: when you regroup, the tens change too. Five tens becomes four: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:forgot-decrement:borrow, twelve minus eight
*expect: turn · turn_ended: True · 12.2s · audio: 672644 b64 bytes*
*note: student says "borrow, twelve minus eight" (forgot-decrement) - names the regroup and the new ones, never the four*

> My turn: when you regroup, the tens change too. Five tens becomes four: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:7
*expect: turn · turn_ended: True · 6.0s · audio: 295044 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:no-move:four
*expect: turn · turn_ended: True · 14.3s · audio: 836484 b64 bytes*
*note: student says "four" (no-move) - the eventual difference with no move — the ask was "tell me what you do"*

> My turn: not four — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:no-move:twelve
*expect: turn · turn_ended: True · 14.4s · audio: 840324 b64 bytes*
*note: student says "twelve" (no-move) - the new ones number alone: a number, not a move, and the tens are untouched*

> My turn: not twelve — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:9
*expect: turn · turn_ended: True · 5.8s · audio: 291204 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:wrong-landing:I regroup: four tens, thirteen ones
*expect: turn · turn_ended: True · 15.4s · audio: 908804 b64 bytes*
*note: student says "I regroup: four tens, thirteen ones" (wrong-landing) - the right move landing on the wrong number*

> My turn: not four tens, thirteen ones — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:wrong-landing:borrow, so it's eleven and four
*expect: turn · turn_ended: True · 15.1s · audio: 889604 b64 bytes*
*note: student says "borrow, so it's eleven and four" (wrong-landing) - off by one on the regrouped ones*

> My turn: not eleven and four — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:11
*expect: turn · turn_ended: True · 6.1s · audio: 309764 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:off-task:I don't know
*expect: turn · turn_ended: True · 13.4s · audio: 778244 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: two minus eight. I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:off-task:umm
*expect: turn · turn_ended: True · 13.6s · audio: 792324 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> My turn: two minus eight. I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.
