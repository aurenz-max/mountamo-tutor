# Tier-3 Live Tutor Report — di-word-problem-setup — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-word-problem-setup", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "probes": 57, "unkeyed_items": ["wpsb-cmp-big-big_number", "wpsb-cmp-big-operation", "wpsb-cmp-big-solve", "wpsb-cmp-diff-big_number", "wpsb-cmp-diff-operation", "wpsb-chg-gain-big_number", "wpsb-chg-gain-family", "wpsb-chg-gain-solve", "wpsb-chg-loss-big_number", "wpsb-chg-loss-operation", "wpsb-chg-loss-solve", "wpsb-pw-whole-big_number", "wpsb-pw-whole-solve", "wpsb-pw-part-big_number", "wpsb-pw-part-operation", "wpsb-pw-part-solve"], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**FAIL** — 1 HIGH + 1 WARN mechanism(s) confirmed (1 + 14 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-false-refusal` | probe:wpsb-cmp-big-family:valid-childlike:um, twelve… and then eight… is, box 1/1 (1 beat) | CORRECTED a right answer ("um, twelve… and then eight… is, box"): "My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family." |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:wpsb-cmp-big-family:big-number-misplaced:box plus eight equals twelve 1/1, probe:wpsb-cmp-big-family:family-incomplete:box equals twelve 1/1, probe:wpsb-cmp-big-family:echo:Jen has twelve stickers and Tom has eight more 1/1, probe:wpsb-cmp-big-family:off-task:umm 1/1, probe:wpsb-cmp-diff-family:big-number-misplaced:twelve plus twenty equals box 1/1, probe:wpsb-cmp-diff-family:operation-not-family:twenty take away twelve is box 1/1 — and 8 more (14 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `closed_set_choice/equation_statement/manipulation/number_word_to_20` via di-word-problem-setup

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 57 scored probe(s) over 7 stimulus/stimuli - 56 agreed with the key, 1 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `big-number-misplaced` | 6 | 6 |
| `echo` | 2 | 2 |
| `family-incomplete` | 6 | 6 |
| `off-task` | 14 | 14 |
| `operation-not-family` | 4 | 4 |
| `valid-canonical` | 7 | 7 |
| `valid-childlike` | 0 | 1 |
| `valid-paraphrase` | 11 | 11 |
| `wrong-number` | 2 | 2 |
| `wrong-verdict` | 4 | 4 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `wpsb-cmp-big-family` | `valid-canonical` | twelve plus eight equals box | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-paraphrase` | eight and twelve makes something | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-paraphrase` | twelve plus eight is what | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-childlike` | um, twelve… and then eight… is, box | AFFIRM | REFUSE | MISS |
| `wpsb-cmp-big-family` | `valid-paraphrase` | twelve plus eight equals twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `big-number-misplaced` | eight plus box equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `big-number-misplaced` | box plus eight equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `family-incomplete` | twelve plus box | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `family-incomplete` | box equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `echo` | Jen has twelve stickers and Tom has eight more | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `valid-canonical` | twelve plus box equals twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-family` | `valid-paraphrase` | box and twelve is twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-family` | `valid-paraphrase` | twelve plus what equals twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-family` | `valid-paraphrase` | twelve plus eight equals twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-family` | `big-number-misplaced` | twenty plus twelve equals box | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `big-number-misplaced` | twelve plus twenty equals box | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `operation-not-family` | twenty minus twelve equals box | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `operation-not-family` | twenty take away twelve is box | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `family-incomplete` | box equals twenty | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `family-incomplete` | twelve plus box | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `echo` | Jen has twenty and Tom has twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-family` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-solve` | `valid-canonical` | eight | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-solve` | `valid-paraphrase` | Jen has eight more stickers than Tom | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-diff-solve` | `wrong-number` | thirty-two | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-solve` | `wrong-number` | seven | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-solve` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-cmp-diff-solve` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-classify` | `valid-canonical` | change | AFFIRM | AFFIRM | OK |
| `wpsb-chg-gain-classify` | `valid-paraphrase` | a change problem | AFFIRM | AFFIRM | OK |
| `wpsb-chg-gain-classify` | `wrong-verdict` | comparison | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-classify` | `wrong-verdict` | part-whole | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-classify` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-classify` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-operation` | `valid-canonical` | subtract | AFFIRM | AFFIRM | OK |
| `wpsb-chg-gain-operation` | `valid-paraphrase` | take away | AFFIRM | AFFIRM | OK |
| `wpsb-chg-gain-operation` | `wrong-verdict` | add | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-operation` | `wrong-verdict` | plus, because Jen found more | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-operation` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-chg-gain-operation` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-chg-loss-family` | `valid-canonical` | six plus box equals fifteen | AFFIRM | AFFIRM | OK |
| `wpsb-chg-loss-family` | `valid-paraphrase` | box plus six makes fifteen | AFFIRM | AFFIRM | OK |
| `wpsb-chg-loss-family` | `big-number-misplaced` | fifteen plus six equals box | REFUSE | REFUSE | OK |
| `wpsb-chg-loss-family` | `operation-not-family` | fifteen minus six equals box | REFUSE | REFUSE | OK |
| `wpsb-chg-loss-family` | `family-incomplete` | six plus box | REFUSE | REFUSE | OK |
| `wpsb-chg-loss-family` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-chg-loss-family` | `off-task` | umm | REFUSE | REFUSE | OK |
| `wpsb-pw-part-family` | `valid-canonical` | seven plus box equals twelve | AFFIRM | AFFIRM | OK |
| `wpsb-pw-part-family` | `valid-paraphrase` | box and seven is twelve | AFFIRM | AFFIRM | OK |
| `wpsb-pw-part-family` | `big-number-misplaced` | twelve plus seven equals box | REFUSE | REFUSE | OK |
| `wpsb-pw-part-family` | `operation-not-family` | twelve minus seven equals box | REFUSE | REFUSE | OK |
| `wpsb-pw-part-family` | `family-incomplete` | box equals twelve | REFUSE | REFUSE | OK |
| `wpsb-pw-part-family` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-pw-part-family` | `off-task` | umm | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:wpsb-cmp-big-family
*expect: turn · turn_ended: True · 3.5s · audio: 80644 b64 bytes*
*note: open-set ask - wpsb-cmp-big-family*

> Say the family.

### probe:wpsb-cmp-big-family:valid-canonical:twelve plus eight equals box
*expect: turn · turn_ended: True · 4.2s · audio: 200964 b64 bytes*
*note: student says "twelve plus eight equals box" (valid-canonical) - the anchor wording*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:0
*expect: turn · turn_ended: True · 3.0s · audio: 71684 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:eight and twelve makes something
*expect: turn · turn_ended: True · 4.1s · audio: 188164 b64 bytes*
*note: student says "eight and twelve makes something" (valid-paraphrase) - smalls swapped, "and"/"makes"/"something" — right numbers, right slots, none of the anchor phrasing*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:1
*expect: turn · turn_ended: True · 3.0s · audio: 73604 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:twelve plus eight is what
*expect: turn · turn_ended: True · 4.0s · audio: 181124 b64 bytes*
*note: student says "twelve plus eight is what" (valid-paraphrase) - "what" for the box*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:2
*expect: turn · turn_ended: True · 3.2s · audio: 115204 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-childlike:um, twelve… and then eight… is, box
*expect: turn · turn_ended: True · 10.0s · audio: 567080 b64 bytes*
*note: student says "um, twelve… and then eight… is, box" (valid-childlike) - in pieces, hedged — the family is whole*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:3
*expect: turn · turn_ended: True · 3.3s · audio: 138244 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:twelve plus eight equals twenty
*expect: turn · turn_ended: True · 4.6s · audio: 188804 b64 bytes*
*note: student says "twelve plus eight equals twenty" (valid-paraphrase) - the box filled with the right number — the family is right*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:4
*expect: turn · turn_ended: True · 3.5s · audio: 143364 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:big-number-misplaced:eight plus box equals twelve
*expect: turn · turn_ended: True · 11.1s · audio: 634884 b64 bytes*
*note: student says "eight plus box equals twelve" (big-number-misplaced) - THE signature error: Jen's twelve promoted to the big slot because it is the biggest number seen; the box demoted to a small*

> My turn: the big number goes last, after equals. Tom's stickers is the big number, so the family is twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:big-number-misplaced:box plus eight equals twelve
*expect: turn · turn_ended: True · 11.3s · audio: 645764 b64 bytes*
*note: student says "box plus eight equals twelve" (big-number-misplaced) - the same upside-down family, smalls swapped*

> My turn: the big number goes last, after equals. Tom's stickers is the big number, so the family is twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:6
*expect: turn · turn_ended: True · 3.3s · audio: 130564 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:family-incomplete:twelve plus box
*expect: turn · turn_ended: True · 10.6s · audio: 606084 b64 bytes*
*note: student says "twelve plus box" (family-incomplete) - no equals, no big number*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:family-incomplete:box equals twelve
*expect: turn · turn_ended: True · 10.3s · audio: 588164 b64 bytes*
*note: student says "box equals twelve" (family-incomplete) - one small number and a wrong big*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:8
*expect: turn · turn_ended: True · 3.5s · audio: 129284 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:echo:Jen has twelve stickers and Tom has eight more
*expect: turn · turn_ended: True · 10.1s · audio: 572804 b64 bytes*
*note: student says "Jen has twelve stickers and Tom has eight more" (echo) - the story read back — no family*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:off-task:I don't know
*expect: turn · turn_ended: True · 6.9s · audio: 323204 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:10
*expect: turn · turn_ended: True · 3.2s · audio: 100484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:off-task:umm
*expect: turn · turn_ended: True · 5.9s · audio: 288004 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: twelve plus eight equals box. Your turn. Say the family.

### ask:wpsb-cmp-diff-family
*expect: turn · turn_ended: True · 4.4s · audio: 132484 b64 bytes*
*note: open-set ask - wpsb-cmp-diff-family*

> Say the family.

### probe:wpsb-cmp-diff-family:valid-canonical:twelve plus box equals twenty
*expect: turn · turn_ended: True · 4.0s · audio: 178564 b64 bytes*
*note: student says "twelve plus box equals twenty" (valid-canonical) - the anchor wording*

> Yes, twelve plus box equals twenty.

### reanchor:wpsb-cmp-diff-family:0
*expect: turn · turn_ended: True · 4.0s · audio: 143364 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-diff-family:valid-paraphrase:box and twelve is twenty
*expect: turn · turn_ended: True · 3.7s · audio: 163844 b64 bytes*
*note: student says "box and twelve is twenty" (valid-paraphrase) - smalls swapped, "and"/"is"*

> Yes, twelve plus box equals twenty.

### reanchor:wpsb-cmp-diff-family:1
*expect: turn · turn_ended: True · 4.2s · audio: 145924 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-diff-family:valid-paraphrase:twelve plus what equals twenty
*expect: turn · turn_ended: True · 4.7s · audio: 195844 b64 bytes*
*note: student says "twelve plus what equals twenty" (valid-paraphrase) - "what" for the box*

> Yes, twelve plus box equals twenty.

### reanchor:wpsb-cmp-diff-family:2
*expect: turn · turn_ended: True · 3.4s · audio: 142084 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-diff-family:valid-paraphrase:twelve plus eight equals twenty
*expect: turn · turn_ended: True · 4.1s · audio: 186244 b64 bytes*
*note: student says "twelve plus eight equals twenty" (valid-paraphrase) - the box filled with the right number*

> Yes, twelve plus box equals twenty.

### reanchor:wpsb-cmp-diff-family:3
*expect: turn · turn_ended: True · 3.9s · audio: 142724 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-diff-family:big-number-misplaced:twenty plus twelve equals box
*expect: turn · turn_ended: True · 12.0s · audio: 695684 b64 bytes*
*note: student says "twenty plus twelve equals box" (big-number-misplaced) - THE signature error: the big number said before equals, the box last — every number present, family upside down*

> My turn: the big number goes last, after equals. Jen's stickers is the big number, so the family is twelve plus box equals twenty. Your turn. Say the family.

### probe:wpsb-cmp-diff-family:big-number-misplaced:twelve plus twenty equals box
*expect: turn · turn_ended: True · 11.8s · audio: 672644 b64 bytes*
*note: student says "twelve plus twenty equals box" (big-number-misplaced) - the same, smalls swapped*

> My turn: the big number goes last, after equals. Jen's stickers is the big number, so the family is twelve plus box equals twenty. Your turn. Say the family.

### reanchor:wpsb-cmp-diff-family:5
*expect: turn · turn_ended: True · 4.6s · audio: 140804 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-diff-family:operation-not-family:twenty minus twelve equals box
*expect: turn · turn_ended: True · 10.7s · audio: 606724 b64 bytes*
*note: student says "twenty minus twelve equals box" (operation-not-family) - correct arithmetic, not a family — skips the decision*

> My turn: a family says small plus small equals big — we do not subtract yet. Twelve plus box equals twenty. Your turn. Say the family.

### probe:wpsb-cmp-diff-family:operation-not-family:twenty take away twelve is box
*expect: turn · turn_ended: True · 10.6s · audio: 601604 b64 bytes*
*note: student says "twenty take away twelve is box" (operation-not-family) - the subtraction form in child words*

> My turn: a family says small plus small equals big — we do not subtract yet. Twelve plus box equals twenty. Your turn. Say the family.

### reanchor:wpsb-cmp-diff-family:7
*expect: turn · turn_ended: True · 3.6s · audio: 145924 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-diff-family:family-incomplete:box equals twenty
*expect: turn · turn_ended: True · 10.5s · audio: 591364 b64 bytes*
*note: student says "box equals twenty" (family-incomplete) - no small number*

> My turn: a family has all three — two small numbers and the big number. Twelve plus box equals twenty. Your turn. Say the family.

### probe:wpsb-cmp-diff-family:family-incomplete:twelve plus box
*expect: turn · turn_ended: True · 10.4s · audio: 588804 b64 bytes*
*note: student says "twelve plus box" (family-incomplete) - no big number*

> My turn: a family has all three — two small numbers and the big number. Twelve plus box equals twenty. Your turn. Say the family.

### reanchor:wpsb-cmp-diff-family:9
*expect: turn · turn_ended: True · 3.3s · audio: 120324 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-diff-family:echo:Jen has twenty and Tom has twelve
*expect: turn · turn_ended: True · 10.2s · audio: 573444 b64 bytes*
*note: student says "Jen has twenty and Tom has twelve" (echo) - the story read back*

> My turn: a family has all three — two small numbers and the big number. Twelve plus box equals twenty. Your turn. Say the family.

### probe:wpsb-cmp-diff-family:off-task:I don't know
*expect: turn · turn_ended: True · 6.5s · audio: 323204 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: twelve plus box equals twenty. Your turn. Say the family.

### reanchor:wpsb-cmp-diff-family:11
*expect: turn · turn_ended: True · 3.5s · audio: 147204 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-diff-family:off-task:umm
*expect: turn · turn_ended: True · 6.2s · audio: 314244 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: twelve plus box equals twenty. Your turn. Say the family.

### ask:wpsb-cmp-diff-solve
*expect: turn · turn_ended: True · 5.3s · audio: 242564 b64 bytes*
*note: open-set ask - wpsb-cmp-diff-solve*

> Now work it. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:valid-canonical:eight
*expect: turn · turn_ended: True · 6.3s · audio: 324484 b64 bytes*
*note: student says "eight" (valid-canonical) - the answer*

> Yes, twenty minus twelve equals eight. Jen has eight more stickers than Tom.

### reanchor:wpsb-cmp-diff-solve:0
*expect: turn · turn_ended: True · 5.1s · audio: 245764 b64 bytes*
*note: re-open the same item for the next probe*

> Now work it. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:valid-paraphrase:Jen has eight more stickers than Tom
*expect: turn · turn_ended: True · 6.3s · audio: 312324 b64 bytes*
*note: student says "Jen has eight more stickers than Tom" (valid-paraphrase) - the whole sentence*

> Yes, twenty minus twelve equals eight. Jen has eight more stickers than Tom.

### reanchor:wpsb-cmp-diff-solve:1
*expect: turn · turn_ended: True · 5.2s · audio: 250884 b64 bytes*
*note: re-open the same item for the next probe*

> Now work it. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:wrong-number:thirty-two
*expect: turn · turn_ended: True · 9.3s · audio: 519684 b64 bytes*
*note: student says "thirty-two" (wrong-number) - THE signature error: the two story numbers added*

> My turn: not thirty-two — twenty minus twelve equals eight. Your turn. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:wrong-number:seven
*expect: turn · turn_ended: True · 8.8s · audio: 488324 b64 bytes*
*note: student says "seven" (wrong-number) - plain wrong*

> My turn: not seven — twenty minus twelve equals eight. Your turn. How many more stickers does Jen have than Tom?

### reanchor:wpsb-cmp-diff-solve:3
*expect: turn · turn_ended: True · 5.3s · audio: 255364 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Now work it. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:off-task:I don't know
*expect: turn · turn_ended: True · 8.0s · audio: 426884 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: twenty minus twelve equals eight. Your turn. How many more stickers does Jen have than Tom?

### probe:wpsb-cmp-diff-solve:off-task:umm
*expect: turn · turn_ended: True · 8.0s · audio: 421764 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: twenty minus twelve equals eight. Your turn. How many more stickers does Jen have than Tom?

### ask:wpsb-chg-gain-classify
*expect: turn · turn_ended: True · 34.9s · audio: 2136324 b64 bytes*
*note: open-set ask - wpsb-chg-gain-classify*

> We are going to set up word problems. I read you a story. First you say what kind of problem it is, then you put the big number at the end of the arrow with your finger, then you say the family out loud — small plus small equals big, and you say box for the one we do not know — then add or subtract, then how many. Listen. Jen had nine stickers. Then Jen found some more. Now Jen has fifteen stickers. How many stickers did Jen find? What kind of problem is this — a comparison problem, a change problem, or a part-whole problem?

### probe:wpsb-chg-gain-classify:valid-canonical:change
*expect: turn · turn_ended: True · 6.0s · audio: 288644 b64 bytes*
*note: student says "change" (valid-canonical) - the menu word*

> Yes, this is a change problem — it starts with an amount that changes.

### reanchor:wpsb-chg-gain-classify:0
*expect: turn · turn_ended: True · 16.2s · audio: 944644 b64 bytes*
*note: re-open the same item for the next probe*

> Listen. Jen had nine stickers. Then Jen found some more. Now Jen has fifteen stickers. How many stickers did Jen find? What kind of problem is this — a comparison problem, a change problem, or a part-whole problem?

### probe:wpsb-chg-gain-classify:valid-paraphrase:a change problem
*expect: turn · turn_ended: True · 5.7s · audio: 285444 b64 bytes*
*note: student says "a change problem" (valid-paraphrase) - inside a phrase*

> Yes, this is a change problem — it starts with an amount that changes.

### reanchor:wpsb-chg-gain-classify:1
*expect: turn · turn_ended: True · 15.8s · audio: 933160 b64 bytes*
*note: re-open the same item for the next probe*

> Listen. Jen had nine stickers. Then Jen found some more. Now Jen has fifteen stickers. How many stickers did Jen find? What kind of problem is this — a comparison problem, a change problem, or a part-whole problem?

### probe:wpsb-chg-gain-classify:wrong-verdict:comparison
*expect: turn · turn_ended: True · 9.8s · audio: 544644 b64 bytes*
*note: student says "comparison" (wrong-verdict) - THE signature error: the last sentence asks how many did Jen find, which sounds like comparing*

> My turn: not comparison — it starts with an amount that changes, so this is a change problem. Your turn. What kind of problem is it?

### probe:wpsb-chg-gain-classify:wrong-verdict:part-whole
*expect: turn · turn_ended: True · 9.7s · audio: 534404 b64 bytes*
*note: student says "part-whole" (wrong-verdict) - plain wrong*

> My turn: not part-whole — it starts with an amount that changes, so this is a change problem. Your turn. What kind of problem is it?

### reanchor:wpsb-chg-gain-classify:3
*expect: turn · turn_ended: True · 16.3s · audio: 955560 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Listen. Jen had nine stickers. Then Jen found some more. Now Jen has fifteen stickers. How many stickers did Jen find? What kind of problem is this — a comparison problem, a change problem, or a part-whole problem?

### probe:wpsb-chg-gain-classify:off-task:I don't know
*expect: turn · turn_ended: True · 8.2s · audio: 444164 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: it starts with an amount that changes, so this is a change problem. Your turn. What kind of problem is it?

### probe:wpsb-chg-gain-classify:off-task:umm
*expect: turn · turn_ended: True · 8.2s · audio: 447364 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: it starts with an amount that changes, so this is a change problem. Your turn. What kind of problem is it?

### ask:wpsb-chg-gain-operation
*expect: turn · turn_ended: True · 3.6s · audio: 128004 b64 bytes*
*note: open-set ask - wpsb-chg-gain-operation*

> Do you add or subtract?

### probe:wpsb-chg-gain-operation:valid-canonical:subtract
*expect: turn · turn_ended: True · 5.2s · audio: 218244 b64 bytes*
*note: student says "subtract" (valid-canonical) - the box is a small number*

> Yes, the box is a small number, so we subtract.

### reanchor:wpsb-chg-gain-operation:0
*expect: turn · turn_ended: True · 3.3s · audio: 125444 b64 bytes*
*note: re-open the same item for the next probe*

> Do you add or subtract?

### probe:wpsb-chg-gain-operation:valid-paraphrase:take away
*expect: turn · turn_ended: True · 4.9s · audio: 230440 b64 bytes*
*note: student says "take away" (valid-paraphrase) - child words for subtract*

> Yes, the box is a small number, so we subtract.

### reanchor:wpsb-chg-gain-operation:1
*expect: turn · turn_ended: True · 3.4s · audio: 131844 b64 bytes*
*note: re-open the same item for the next probe*

> Do you add or subtract?

### probe:wpsb-chg-gain-operation:wrong-verdict:add
*expect: turn · turn_ended: True · 8.0s · audio: 432004 b64 bytes*
*note: student says "add" (wrong-verdict) - THE signature error: "found" sounds like add; the family says subtract*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### probe:wpsb-chg-gain-operation:wrong-verdict:plus, because Jen found more
*expect: turn · turn_ended: True · 10.1s · audio: 570244 b64 bytes*
*note: student says "plus, because Jen found more" (wrong-verdict) - the operation taken from the story's word*

> My turn: the story says found, but the family decides. The box is a small number, so we subtract. Your turn. Add or subtract?

### reanchor:wpsb-chg-gain-operation:3
*expect: turn · turn_ended: True · 3.2s · audio: 128004 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Do you add or subtract?

### probe:wpsb-chg-gain-operation:off-task:I don't know
*expect: turn · turn_ended: True · 6.9s · audio: 365444 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: the box is a small number, so we subtract. Your turn. Add or subtract?

### probe:wpsb-chg-gain-operation:off-task:umm
*expect: turn · turn_ended: True · 7.2s · audio: 368004 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: the box is a small number, so we subtract. Your turn. Add or subtract?

### ask:wpsb-chg-loss-family
*expect: turn · turn_ended: True · 3.8s · audio: 145284 b64 bytes*
*note: open-set ask - wpsb-chg-loss-family*

> Say the family.

### probe:wpsb-chg-loss-family:valid-canonical:six plus box equals fifteen
*expect: turn · turn_ended: True · 4.5s · audio: 195204 b64 bytes*
*note: student says "six plus box equals fifteen" (valid-canonical) - the anchor wording*

> Yes, six plus box equals fifteen.

### reanchor:wpsb-chg-loss-family:0
*expect: turn · turn_ended: True · 3.6s · audio: 145924 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-chg-loss-family:valid-paraphrase:box plus six makes fifteen
*expect: turn · turn_ended: True · 4.5s · audio: 193924 b64 bytes*
*note: student says "box plus six makes fifteen" (valid-paraphrase) - smalls swapped, "makes"*

> Yes, six plus box equals fifteen.

### reanchor:wpsb-chg-loss-family:1
*expect: turn · turn_ended: True · 3.5s · audio: 126724 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-chg-loss-family:big-number-misplaced:fifteen plus six equals box
*expect: turn · turn_ended: True · 17.1s · audio: 1121928 b64 bytes*
*note: student says "fifteen plus six equals box" (big-number-misplaced) - the start promoted past equals — the biggest number seen, placed wrong*

> My turn: the big number goes last, after equals. What Jen started with is the big number, soMy turn: the big number goes last, after equals. What Jen started with is the big number, so the family is six plus box equals fifteen. Your turn. Say the family.

### probe:wpsb-chg-loss-family:operation-not-family:fifteen minus six equals box
*expect: turn · turn_ended: True · 11.0s · audio: 616324 b64 bytes*
*note: student says "fifteen minus six equals box" (operation-not-family) - the subtraction sentence*

> My turn: a family says small plus small equals big — we do not subtract yet. Six plus box equals fifteen. Your turn. Say the family.

### reanchor:wpsb-chg-loss-family:3
*expect: turn · turn_ended: True · 3.9s · audio: 144004 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-chg-loss-family:family-incomplete:six plus box
*expect: turn · turn_ended: True · 11.0s · audio: 606084 b64 bytes*
*note: student says "six plus box" (family-incomplete) - no big number*

> My turn: a family has all three — two small numbers and the big number. Six plus box equals fifteen. Your turn. Say the family.

### probe:wpsb-chg-loss-family:off-task:I don't know
*expect: turn · turn_ended: True · 6.4s · audio: 324484 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: six plus box equals fifteen. Your turn. Say the family.

### reanchor:wpsb-chg-loss-family:5
*expect: turn · turn_ended: True · 3.9s · audio: 112644 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-chg-loss-family:off-task:umm
*expect: turn · turn_ended: True · 6.4s · audio: 324484 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: six plus box equals fifteen. Your turn. Say the family.

### ask:wpsb-pw-part-family
*expect: turn · turn_ended: True · 4.0s · audio: 145924 b64 bytes*
*note: open-set ask - wpsb-pw-part-family*

> Say the family.

### probe:wpsb-pw-part-family:valid-canonical:seven plus box equals twelve
*expect: turn · turn_ended: True · 5.0s · audio: 184964 b64 bytes*
*note: student says "seven plus box equals twelve" (valid-canonical) - the anchor wording*

> Yes, seven plus box equals twelve.

### reanchor:wpsb-pw-part-family:0
*expect: turn · turn_ended: True · 3.6s · audio: 145284 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-pw-part-family:valid-paraphrase:box and seven is twelve
*expect: turn · turn_ended: True · 4.4s · audio: 187524 b64 bytes*
*note: student says "box and seven is twelve" (valid-paraphrase) - smalls swapped*

> Yes, seven plus box equals twelve.

### reanchor:wpsb-pw-part-family:1
*expect: turn · turn_ended: True · 4.3s · audio: 144644 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-pw-part-family:big-number-misplaced:twelve plus seven equals box
*expect: turn · turn_ended: True · 12.4s · audio: 683524 b64 bytes*
*note: student says "twelve plus seven equals box" (big-number-misplaced) - the whole in a small slot*

> My turn: the big number goes last, after equals. All the stickers is the big number, so the family is seven plus box equals twelve. Your turn. Say the family.

### probe:wpsb-pw-part-family:operation-not-family:twelve minus seven equals box
*expect: turn · turn_ended: True · 10.9s · audio: 606724 b64 bytes*
*note: student says "twelve minus seven equals box" (operation-not-family) - the subtraction sentence*

> My turn: a family says small plus small equals big — we do not subtract yet. Seven plus box equals twelve. Your turn. Say the family.

### reanchor:wpsb-pw-part-family:3
*expect: turn · turn_ended: True · 3.2s · audio: 74280 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-pw-part-family:family-incomplete:box equals twelve
*expect: turn · turn_ended: True · 10.6s · audio: 587524 b64 bytes*
*note: student says "box equals twelve" (family-incomplete) - no small number*

> My turn: a family has all three — two small numbers and the big number. Seven plus box equals twelve. Your turn. Say the family.

### probe:wpsb-pw-part-family:off-task:I don't know
*expect: turn · turn_ended: True · 6.5s · audio: 328324 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: seven plus box equals twelve. Your turn. Say the family.

### reanchor:wpsb-pw-part-family:5
*expect: turn · turn_ended: True · 4.2s · audio: 138884 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-pw-part-family:off-task:umm
*expect: turn · turn_ended: True · 6.5s · audio: 327044 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: seven plus box equals twelve. Your turn. Say the family.
