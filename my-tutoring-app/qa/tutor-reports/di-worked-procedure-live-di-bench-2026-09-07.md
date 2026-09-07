# Tier-3 Live Tutor Report — di-worked-procedure — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-worked-procedure", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "probes": 54, "unkeyed_items": ["wpb-342-168-c0-decide", "wpb-342-168-c0-subtract", "wpb-342-168-c1-subtract", "wpb-75-32-c1-decide"], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**FAIL** — 2 HIGH + 1 WARN mechanism(s) confirmed (7 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-no-verdict` | probe:wpb-52-28-c0-decide:off-task:umm 1/1, probe:wpb-52-28-c0-subtract:off-task:umm 1/1, probe:wpb-52-28-c1-decide:off-task:umm 1/1, probe:wpb-342-168-c1-decide:off-task:umm 1/1, probe:wpb-342-168-c2-decide:off-task:umm 1/1, probe:wpb-75-32-c0-decide:off-task:umm 1/1 (6 beats) | answered "umm" and the tutor opened with neither sentinel — the loop stalls here: "Seventy-five minus thirty-two. Start in the ones column. Tell me what you do." |
| CONFIRMED | HIGH | `open-set-probe-vacuous` | * 1/1 (1 beat) | 6 probe(s) drew no classifiable verdict — those trials measured nothing and the bench cannot be read as covering them. |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:wpb-52-28-c0-decide:forgot-decrement:borrow, twelve minus eight 1/1, probe:wpb-342-168-c1-decide:forgot-decrement:thirteen minus six is seven 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `number_word_to_20/procedure_step` via di-worked-procedure

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 54 scored probe(s) over 6 stimulus/stimuli - 48 agreed with the key, 0 missed valid, 0 soft disagreement(s), 6 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `flipped-column` | 4 | 4 |
| `forgot-decrement` | 8 | 8 |
| `no-move` | 3 | 3 |
| `off-task` | 6 | 12 |
| `unneeded-regroup` | 4 | 4 |
| `valid-canonical` | 6 | 6 |
| `valid-childlike` | 3 | 3 |
| `valid-paraphrase` | 8 | 8 |
| `wrong-landing` | 3 | 3 |
| `wrong-number` | 3 | 3 |

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
| `wpb-52-28-c0-decide` | `off-task` | umm | REFUSE | NO VERDICT | MISS |
| `wpb-52-28-c0-subtract` | `valid-canonical` | four | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-subtract` | `valid-paraphrase` | twelve minus eight is four | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-subtract` | `valid-childlike` | eleven, ten, nine, eight, seven, six, five, four | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c0-subtract` | `flipped-column` | six | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-subtract` | `wrong-number` | five | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-subtract` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-52-28-c0-subtract` | `off-task` | umm | REFUSE | NO VERDICT | MISS |
| `wpb-52-28-c1-decide` | `valid-canonical` | two | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c1-decide` | `valid-paraphrase` | four minus two is two | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c1-decide` | `valid-childlike` | I don't need to borrow. four take away two, two | AFFIRM | AFFIRM | OK |
| `wpb-52-28-c1-decide` | `forgot-decrement` | three | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `forgot-decrement` | five minus two is three | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `unneeded-regroup` | I regroup, fourteen minus two is twelve | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `unneeded-regroup` | twelve | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `wrong-number` | one | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-52-28-c1-decide` | `off-task` | umm | REFUSE | NO VERDICT | MISS |
| `wpb-342-168-c1-decide` | `valid-canonical` | I can't take six from three, so I regroup: two hundreds, thirteen tens | AFFIRM | AFFIRM | OK |
| `wpb-342-168-c1-decide` | `valid-paraphrase` | borrow from the three hundred, it's two now and the tens are thirteen | AFFIRM | AFFIRM | OK |
| `wpb-342-168-c1-decide` | `wrong-landing` | four minus six, can't, regroup: two hundreds, fourteen tens | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `flipped-column` | six minus three is three | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `forgot-decrement` | I regroup, thirteen | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `forgot-decrement` | thirteen minus six is seven | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `no-move` | seven | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-342-168-c1-decide` | `off-task` | umm | REFUSE | NO VERDICT | MISS |
| `wpb-342-168-c2-decide` | `valid-canonical` | one | AFFIRM | AFFIRM | OK |
| `wpb-342-168-c2-decide` | `valid-paraphrase` | two minus one is one | AFFIRM | AFFIRM | OK |
| `wpb-342-168-c2-decide` | `forgot-decrement` | three minus one is two | REFUSE | REFUSE | OK |
| `wpb-342-168-c2-decide` | `forgot-decrement` | two | REFUSE | REFUSE | OK |
| `wpb-342-168-c2-decide` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-342-168-c2-decide` | `off-task` | umm | REFUSE | NO VERDICT | MISS |
| `wpb-75-32-c0-decide` | `valid-canonical` | three | AFFIRM | AFFIRM | OK |
| `wpb-75-32-c0-decide` | `valid-paraphrase` | five minus two is three | AFFIRM | AFFIRM | OK |
| `wpb-75-32-c0-decide` | `valid-paraphrase` | no regrouping, three | AFFIRM | AFFIRM | OK |
| `wpb-75-32-c0-decide` | `unneeded-regroup` | I regroup: fifteen minus two is thirteen | REFUSE | REFUSE | OK |
| `wpb-75-32-c0-decide` | `unneeded-regroup` | thirteen | REFUSE | REFUSE | OK |
| `wpb-75-32-c0-decide` | `wrong-number` | two | REFUSE | REFUSE | OK |
| `wpb-75-32-c0-decide` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpb-75-32-c0-decide` | `off-task` | umm | REFUSE | NO VERDICT | MISS |


## Run 1 — beat-by-beat transcript

### ask:wpb-52-28-c0-decide
*expect: turn · turn_ended: True · 11.6s · audio: 643240 b64 bytes*
*note: open-set ask - wpb-52-28-c0-decide*

> We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-canonical:I can't take eight from two, so I regroup: four tens, twelve ones
*expect: turn · turn_ended: True · 5.0s · audio: 230404 b64 bytes*
*note: student says "I can't take eight from two, so I regroup: four tens, twelve ones" (valid-canonical) - the anchor wording*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:0
*expect: turn · turn_ended: True · 5.4s · audio: 270724 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-paraphrase:I borrow one from the five. The five is four now and the two is twelve.
*expect: turn · turn_ended: True · 4.5s · audio: 216964 b64 bytes*
*note: student says "I borrow one from the five. The five is four now and the two is twelve." (valid-paraphrase) - "borrow" for regroup, digits named by value — the move and both numbers with none of the anchor phrasing*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:1
*expect: turn · turn_ended: True · 5.4s · audio: 268808 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-paraphrase:trade a ten. twelve and four
*expect: turn · turn_ended: True · 4.6s · audio: 216324 b64 bytes*
*note: student says "trade a ten. twelve and four" (valid-paraphrase) - terse, order reversed, "trade" for regroup — still the whole move*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:2
*expect: turn · turn_ended: True · 5.4s · audio: 267524 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:valid-childlike:um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four
*expect: turn · turn_ended: True · 4.6s · audio: 219524 b64 bytes*
*note: student says "um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four" (valid-childlike) - grammar and hedging are not the skill*

> Yes, regroup: four tens, twelve ones.

### reanchor:wpb-52-28-c0-decide:3
*expect: turn · turn_ended: True · 5.4s · audio: 263684 b64 bytes*
*note: re-open the same item for the next probe*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:flipped-column:eight minus two is six
*expect: turn · turn_ended: True · 15.6s · audio: 910724 b64 bytes*
*note: student says "eight minus two is six" (flipped-column) - THE signature error: the column turned upside down. Fluent, true as a fact, wrong as a move*

> My turn: not eight minus two is six — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:flipped-column:two minus eight is six
*expect: turn · turn_ended: True · 15.9s · audio: 942088 b64 bytes*
*note: student says "two minus eight is six" (flipped-column) - the flip stated as if it were the column — same error, different words*

> My turn: not two minus eight is six — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:5
*expect: turn · turn_ended: True · 5.6s · audio: 286760 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:forgot-decrement:I regroup, the two becomes twelve
*expect: turn · turn_ended: True · 11.9s · audio: 666244 b64 bytes*
*note: student says "I regroup, the two becomes twelve" (forgot-decrement) - the right decision with the tens digit left at five — the error a teacher catches here, not at the tens*

> My turn: when you regroup, the tens change too. Five tens becomes four: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:forgot-decrement:borrow, twelve minus eight
*expect: turn · turn_ended: True · 11.8s · audio: 681604 b64 bytes*
*note: student says "borrow, twelve minus eight" (forgot-decrement) - names the regroup and the new ones, never the four*

> My turn: when you regroup, the tens change too. Five tens becomes four: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:7
*expect: turn · turn_ended: True · 5.4s · audio: 268804 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:no-move:four
*expect: turn · turn_ended: True · 14.8s · audio: 861444 b64 bytes*
*note: student says "four" (no-move) - the eventual difference with no move — the ask was "tell me what you do"*

> My turn: not four — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:no-move:twelve
*expect: turn · turn_ended: True · 15.0s · audio: 877444 b64 bytes*
*note: student says "twelve" (no-move) - the new ones number alone: a number, not a move, and the tens are untouched*

> My turn: not twelve — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:9
*expect: turn · turn_ended: True · 6.1s · audio: 269444 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:wrong-landing:I regroup: four tens, thirteen ones
*expect: turn · turn_ended: True · 16.2s · audio: 958724 b64 bytes*
*note: student says "I regroup: four tens, thirteen ones" (wrong-landing) - the right move landing on the wrong number*

> My turn: not four tens, thirteen ones — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:wrong-landing:borrow, so it's eleven and four
*expect: turn · turn_ended: True · 16.0s · audio: 926084 b64 bytes*
*note: student says "borrow, so it's eleven and four" (wrong-landing) - off by one on the regrouped ones*

> My turn: not eleven and four — two minus eight, I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-52-28-c0-decide:11
*expect: turn · turn_ended: True · 5.8s · audio: 284164 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:off-task:I don't know
*expect: turn · turn_ended: True · 14.2s · audio: 800644 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: two minus eight. I can't take eight from two, so I regroup. One ten becomes ten ones: four tens, twelve ones. Your turn. The ones column. Tell me what you do.

### probe:wpb-52-28-c0-decide:off-task:umm
*expect: turn · turn_ended: True · 5.4s · audio: 266884 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Fifty-two minus twenty-eight. Start in the ones column. Tell me what you do.

### ask:wpb-52-28-c0-subtract
*expect: turn · turn_ended: True · 3.9s · audio: 152324 b64 bytes*
*note: open-set ask - wpb-52-28-c0-subtract*

> Now subtract the ones.

### probe:wpb-52-28-c0-subtract:valid-canonical:four
*expect: turn · turn_ended: True · 3.7s · audio: 157480 b64 bytes*
*note: student says "four" (valid-canonical) - the difference*

> Yes, twelve minus eight is four.

### reanchor:wpb-52-28-c0-subtract:0
*expect: turn · turn_ended: True · 3.8s · audio: 163204 b64 bytes*
*note: re-open the same item for the next probe*

> Now subtract the ones.

### probe:wpb-52-28-c0-subtract:valid-paraphrase:twelve minus eight is four
*expect: turn · turn_ended: True · 3.8s · audio: 169000 b64 bytes*
*note: student says "twelve minus eight is four" (valid-paraphrase) - the whole fact*

> Yes, twelve minus eight is four.

### reanchor:wpb-52-28-c0-subtract:1
*expect: turn · turn_ended: True · 4.1s · audio: 179240 b64 bytes*
*note: re-open the same item for the next probe*

> Now subtract the ones.

### probe:wpb-52-28-c0-subtract:valid-childlike:eleven, ten, nine, eight, seven, six, five, four
*expect: turn · turn_ended: True · 3.9s · audio: 157444 b64 bytes*
*note: student says "eleven, ten, nine, eight, seven, six, five, four" (valid-childlike) - counting back, landing on four*

> Yes, twelve minus eight is four.

### reanchor:wpb-52-28-c0-subtract:2
*expect: turn · turn_ended: True · 3.8s · audio: 156164 b64 bytes*
*note: re-open the same item for the next probe*

> Now subtract the ones.

### probe:wpb-52-28-c0-subtract:flipped-column:six
*expect: turn · turn_ended: True · 7.8s · audio: 419844 b64 bytes*
*note: student says "six" (flipped-column) - eight minus two — the flip, which the plan gate guarantees is a different digit*

> My turn: not six — twelve minus eight is four. Your turn. Subtract the ones.

### probe:wpb-52-28-c0-subtract:wrong-number:five
*expect: turn · turn_ended: True · 7.3s · audio: 390404 b64 bytes*
*note: student says "five" (wrong-number) - plain wrong*

> My turn: not five — twelve minus eight is four. Your turn. Subtract the ones.

### reanchor:wpb-52-28-c0-subtract:4
*expect: turn · turn_ended: True · 3.8s · audio: 156164 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now subtract the ones.

### probe:wpb-52-28-c0-subtract:off-task:I don't know
*expect: turn · turn_ended: True · 6.5s · audio: 329604 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: twelve minus eight is four. Your turn. Subtract the ones.

### probe:wpb-52-28-c0-subtract:off-task:umm
*expect: turn · turn_ended: True · 4.2s · audio: 156840 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Now subtract the ones.

### ask:wpb-52-28-c1-decide
*expect: turn · turn_ended: True · 5.0s · audio: 179240 b64 bytes*
*note: open-set ask - wpb-52-28-c1-decide*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:valid-canonical:two
*expect: turn · turn_ended: True · 7.7s · audio: 362884 b64 bytes*
*note: student says "two" (valid-canonical) - the difference, read off the decremented four*

> Yes, no regrouping: four minus two is two. Fifty-two minus twenty-eight is twenty-four.

### reanchor:wpb-52-28-c1-decide:0
*expect: turn · turn_ended: True · 3.9s · audio: 168324 b64 bytes*
*note: re-open the same item for the next probe*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:valid-paraphrase:four minus two is two
*expect: turn · turn_ended: True · 6.9s · audio: 355204 b64 bytes*
*note: student says "four minus two is two" (valid-paraphrase) - the whole column*

> Yes, no regrouping: four minus two is two. Fifty-two minus twenty-eight is twenty-four.

### reanchor:wpb-52-28-c1-decide:1
*expect: turn · turn_ended: True · 5.2s · audio: 169604 b64 bytes*
*note: re-open the same item for the next probe*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:valid-childlike:I don't need to borrow. four take away two, two
*expect: turn · turn_ended: True · 7.0s · audio: 366084 b64 bytes*
*note: student says "I don't need to borrow. four take away two, two" (valid-childlike) - the decision said out loud, then the fact*

> Yes, no regrouping: four minus two is two. Fifty-two minus twenty-eight is twenty-four.

### reanchor:wpb-52-28-c1-decide:2
*expect: turn · turn_ended: True · 3.8s · audio: 163204 b64 bytes*
*note: re-open the same item for the next probe*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:forgot-decrement:three
*expect: turn · turn_ended: True · 11.4s · audio: 634884 b64 bytes*
*note: student says "three" (forgot-decrement) - five minus two — read the crossed-out five*

> My turn: not three — this column lent one, so it is four now, not five. Four minus two is two. Your turn. The tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:forgot-decrement:five minus two is three
*expect: turn · turn_ended: True · 10.9s · audio: 616964 b64 bytes*
*note: student says "five minus two is three" (forgot-decrement) - the same error, narrated*

> My turn: not five — this column lent one, so it is four now, not five. Four minus two is two. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-52-28-c1-decide:4
*expect: turn · turn_ended: True · 3.8s · audio: 161284 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:unneeded-regroup:I regroup, fourteen minus two is twelve
*expect: turn · turn_ended: True · 10.0s · audio: 549764 b64 bytes*
*note: student says "I regroup, fourteen minus two is twelve" (unneeded-regroup) - borrowing where the column subtracts cleanly*

> My turn: you can take two from four, so you do not regroup. Four minus two is two. Your turn. The tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:unneeded-regroup:twelve
*expect: turn · turn_ended: True · 8.2s · audio: 423684 b64 bytes*
*note: student says "twelve" (unneeded-regroup) - the result of an unneeded regroup, bare*

> My turn: not twelve — four minus two is two. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-52-28-c1-decide:6
*expect: turn · turn_ended: True · 3.7s · audio: 158084 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:wrong-number:one
*expect: turn · turn_ended: True · 7.8s · audio: 416004 b64 bytes*
*note: student says "one" (wrong-number) - plain wrong*

> My turn: not one — four minus two is two. Your turn. The tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:off-task:I don't know
*expect: turn · turn_ended: True · 7.0s · audio: 364804 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: four minus two is two. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-52-28-c1-decide:8
*expect: turn · turn_ended: True · 3.8s · audio: 163204 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-52-28-c1-decide:off-task:umm
*expect: turn · turn_ended: True · 3.9s · audio: 164520 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Now the tens column. Tell me what you do.

### ask:wpb-342-168-c1-decide
*expect: turn · turn_ended: True · 4.3s · audio: 158724 b64 bytes*
*note: open-set ask - wpb-342-168-c1-decide*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:valid-canonical:I can't take six from three, so I regroup: two hundreds, thirteen tens
*expect: turn · turn_ended: True · 4.7s · audio: 224644 b64 bytes*
*note: student says "I can't take six from three, so I regroup: two hundreds, thirteen tens" (valid-canonical) - the anchor wording, on the decremented three*

> Yes, regroup: two hundreds, thirteen tens.

### reanchor:wpb-342-168-c1-decide:0
*expect: turn · turn_ended: True · 3.8s · audio: 160644 b64 bytes*
*note: re-open the same item for the next probe*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:valid-paraphrase:borrow from the three hundred, it's two now and the tens are thirteen
*expect: turn · turn_ended: True · 5.1s · audio: 249640 b64 bytes*
*note: student says "borrow from the three hundred, it's two now and the tens are thirteen" (valid-paraphrase) - the move and both numbers, no anchor phrasing*

> Yes, regroup: two hundreds, thirteen tens.

### reanchor:wpb-342-168-c1-decide:1
*expect: turn · turn_ended: True · 3.8s · audio: 165124 b64 bytes*
*note: re-open the same item for the next probe*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:wrong-landing:four minus six, can't, regroup: two hundreds, fourteen tens
*expect: turn · turn_ended: True · 16.3s · audio: 952324 b64 bytes*
*note: student says "four minus six, can't, regroup: two hundreds, fourteen tens" (wrong-landing) - read the crossed-out four, so the regroup lands on fourteen — the double-mark trap*

> My turn: not four minus six can't, — three minus six, I can't take six from three, so I regroup. One hundred becomes ten tens: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:flipped-column:six minus three is three
*expect: turn · turn_ended: True · 16.4s · audio: 971524 b64 bytes*
*note: student says "six minus three is three" (flipped-column) - the flip; the plan gate makes it a different digit from seven*

> My turn: not six minus three is three — three minus six, I can't take six from three, so I regroup. One hundred becomes ten tens: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-342-168-c1-decide:3
*expect: turn · turn_ended: True · 4.0s · audio: 176680 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:forgot-decrement:I regroup, thirteen
*expect: turn · turn_ended: True · 12.7s · audio: 716164 b64 bytes*
*note: student says "I regroup, thirteen" (forgot-decrement) - the hundreds never change*

> My turn: when you regroup, the hundreds change too. Three hundreds becomes two: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:forgot-decrement:thirteen minus six is seven
*expect: turn · turn_ended: True · 12.6s · audio: 728964 b64 bytes*
*note: student says "thirteen minus six is seven" (forgot-decrement) - skips to the difference; the hundreds were never decremented*

> My turn: when you regroup, the hundreds change too. Three hundreds becomes two: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-342-168-c1-decide:5
*expect: turn · turn_ended: True · 3.9s · audio: 163844 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:no-move:seven
*expect: turn · turn_ended: True · 14.8s · audio: 865924 b64 bytes*
*note: student says "seven" (no-move) - a bare number on a decide step*

> My turn: not seven — three minus six, I can't take six from three, so I regroup. One hundred becomes ten tens: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:off-task:I don't know
*expect: turn · turn_ended: True · 14.3s · audio: 832644 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: three minus six. I can't take six from three, so I regroup. One hundred becomes ten tens: two hundreds, thirteen tens. Your turn. The tens column. Tell me what you do.

### reanchor:wpb-342-168-c1-decide:7
*expect: turn · turn_ended: True · 4.0s · audio: 163844 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the tens column. Tell me what you do.

### probe:wpb-342-168-c1-decide:off-task:umm
*expect: turn · turn_ended: True · 3.9s · audio: 161284 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Now the tens column. Tell me what you do.

### ask:wpb-342-168-c2-decide
*expect: turn · turn_ended: True · 4.4s · audio: 166404 b64 bytes*
*note: open-set ask - wpb-342-168-c2-decide*

> Now the hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:valid-canonical:one
*expect: turn · turn_ended: True · 9.1s · audio: 471044 b64 bytes*
*note: student says "one" (valid-canonical) - two minus one*

> Yes, no regrouping: two minus one is one. Three hundred forty-two minus one hundred sixty-eight is one hundred seventy-four.

### reanchor:wpb-342-168-c2-decide:0
*expect: turn · turn_ended: True · 4.7s · audio: 163844 b64 bytes*
*note: re-open the same item for the next probe*

> Now the hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:valid-paraphrase:two minus one is one
*expect: turn · turn_ended: True · 8.8s · audio: 473604 b64 bytes*
*note: student says "two minus one is one" (valid-paraphrase) - the whole column*

> Yes, no regrouping: two minus one is one. Three hundred forty-two minus one hundred sixty-eight is one hundred seventy-four.

### reanchor:wpb-342-168-c2-decide:1
*expect: turn · turn_ended: True · 4.1s · audio: 168964 b64 bytes*
*note: re-open the same item for the next probe*

> Now the hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:forgot-decrement:three minus one is two
*expect: turn · turn_ended: True · 18.6s · audio: 1347208 b64 bytes*
*note: student says "three minus one is two" (forgot-decrement) - read the crossed-out three*

> My turn: not three minus one is two — this column lent one, so it is two now, not three. Two minus one is one. Your turn. The hundreds column. Tell me what you do.My turn: not two — this column lent one, so it is two now, not three. Two minus one is one. Your turn. The hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:forgot-decrement:two
*expect: turn · turn_ended: True · 7.8s · audio: 406404 b64 bytes*
*note: student says "two" (forgot-decrement) - the same error, bare*

> My turn: not two — two minus one is one. Your turn. The hundreds column. Tell me what you do.

### reanchor:wpb-342-168-c2-decide:3
*expect: turn · turn_ended: True · 4.2s · audio: 181800 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now the hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:off-task:I don't know
*expect: turn · turn_ended: True · 7.6s · audio: 396840 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: two minus one is one. Your turn. The hundreds column. Tell me what you do.

### probe:wpb-342-168-c2-decide:off-task:umm
*expect: turn · turn_ended: True · 4.0s · audio: 172804 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Now the hundreds column. Tell me what you do.

### ask:wpb-75-32-c0-decide
*expect: turn · turn_ended: True · 6.5s · audio: 308484 b64 bytes*
*note: open-set ask - wpb-75-32-c0-decide*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:valid-canonical:three
*expect: turn · turn_ended: True · 4.8s · audio: 224004 b64 bytes*
*note: student says "three" (valid-canonical) - five minus two*

> Yes, no regrouping: five minus two is three.

### reanchor:wpb-75-32-c0-decide:0
*expect: turn · turn_ended: True · 6.1s · audio: 307844 b64 bytes*
*note: re-open the same item for the next probe*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:valid-paraphrase:five minus two is three
*expect: turn · turn_ended: True · 4.8s · audio: 218244 b64 bytes*
*note: student says "five minus two is three" (valid-paraphrase) - the whole column*

> Yes, no regrouping: five minus two is three.

### reanchor:wpb-75-32-c0-decide:1
*expect: turn · turn_ended: True · 6.9s · audio: 341764 b64 bytes*
*note: re-open the same item for the next probe*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:valid-paraphrase:no regrouping, three
*expect: turn · turn_ended: True · 4.8s · audio: 218884 b64 bytes*
*note: student says "no regrouping, three" (valid-paraphrase) - the decision named*

> Yes, no regrouping: five minus two is three.

### reanchor:wpb-75-32-c0-decide:2
*expect: turn · turn_ended: True · 6.9s · audio: 341124 b64 bytes*
*note: re-open the same item for the next probe*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:unneeded-regroup:I regroup: fifteen minus two is thirteen
*expect: turn · turn_ended: True · 10.1s · audio: 554884 b64 bytes*
*note: student says "I regroup: fifteen minus two is thirteen" (unneeded-regroup) - borrowing where five minus two is clean*

> My turn: you can take two from five, so you do not regroup. Five minus two is three. Your turn. The ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:unneeded-regroup:thirteen
*expect: turn · turn_ended: True · 8.0s · audio: 423044 b64 bytes*
*note: student says "thirteen" (unneeded-regroup) - the result of an unneeded regroup, bare*

> My turn: not thirteen — five minus two is three. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-75-32-c0-decide:4
*expect: turn · turn_ended: True · 6.6s · audio: 338564 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:wrong-number:two
*expect: turn · turn_ended: True · 8.5s · audio: 439044 b64 bytes*
*note: student says "two" (wrong-number) - plain wrong*

> My turn: not two — five minus two is three. Your turn. The ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:off-task:I don't know
*expect: turn · turn_ended: True · 7.3s · audio: 362884 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: five minus two is three. Your turn. The ones column. Tell me what you do.

### reanchor:wpb-75-32-c0-decide:6
*expect: turn · turn_ended: True · 5.8s · audio: 286724 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.

### probe:wpb-75-32-c0-decide:off-task:umm
*expect: turn · turn_ended: True · 6.8s · audio: 294404 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no move and no number*

> Seventy-five minus thirty-two. Start in the ones column. Tell me what you do.
