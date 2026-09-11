# Tier-3 Live Tutor Report — di-word-problem-setup — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-word-problem-setup", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "probes": 12, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 4 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:wpsb-cmp-big-family:big-number-misplaced:box plus eight equals twelve 1/1, probe:wpsb-cmp-big-family:family-incomplete:box equals twelve 1/1, probe:wpsb-cmp-big-family:echo:Jen has twelve stickers and Tom has eight more 1/1, probe:wpsb-cmp-big-family:off-task:umm 1/1 (4 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `closed_set_choice/equation_statement/manipulation/number_word_to_20` via di-word-problem-setup

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 12 scored probe(s) over 1 stimulus/stimuli - 12 agreed with the key, 0 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `big-number-misplaced` | 2 | 2 |
| `echo` | 1 | 1 |
| `family-incomplete` | 2 | 2 |
| `off-task` | 2 | 2 |
| `valid-canonical` | 1 | 1 |
| `valid-childlike` | 1 | 1 |
| `valid-paraphrase` | 3 | 3 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `wpsb-cmp-big-family` | `valid-canonical` | twelve plus eight equals box | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-paraphrase` | eight and twelve makes something | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-paraphrase` | twelve plus eight is what | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-childlike` | um, twelve… and then eight… is, box | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `valid-paraphrase` | twelve plus eight equals twenty | AFFIRM | AFFIRM | OK |
| `wpsb-cmp-big-family` | `big-number-misplaced` | eight plus box equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `big-number-misplaced` | box plus eight equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `family-incomplete` | twelve plus box | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `family-incomplete` | box equals twelve | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `echo` | Jen has twelve stickers and Tom has eight more | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `wpsb-cmp-big-family` | `off-task` | umm | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:wpsb-cmp-big-family
*expect: turn · turn_ended: True · 3.5s · audio: 83204 b64 bytes*
*note: open-set ask - wpsb-cmp-big-family*

> Say the family.

### probe:wpsb-cmp-big-family:valid-canonical:twelve plus eight equals box
*expect: turn · turn_ended: True · 4.2s · audio: 193284 b64 bytes*
*note: student says "twelve plus eight equals box" (valid-canonical) - the anchor wording*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:0
*expect: turn · turn_ended: True · 3.0s · audio: 82564 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:eight and twelve makes something
*expect: turn · turn_ended: True · 4.7s · audio: 188804 b64 bytes*
*note: student says "eight and twelve makes something" (valid-paraphrase) - smalls swapped, "and"/"makes"/"something" — right numbers, right slots, none of the anchor phrasing*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:1
*expect: turn · turn_ended: True · 3.7s · audio: 81924 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:twelve plus eight is what
*expect: turn · turn_ended: True · 4.0s · audio: 180484 b64 bytes*
*note: student says "twelve plus eight is what" (valid-paraphrase) - "what" for the box*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:2
*expect: turn · turn_ended: True · 3.1s · audio: 74884 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-childlike:um, twelve… and then eight… is, box
*expect: turn · turn_ended: True · 4.0s · audio: 186884 b64 bytes*
*note: student says "um, twelve… and then eight… is, box" (valid-childlike) - in pieces, hedged — the family is whole*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:3
*expect: turn · turn_ended: True · 3.3s · audio: 82564 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:valid-paraphrase:twelve plus eight equals twenty
*expect: turn · turn_ended: True · 4.0s · audio: 186244 b64 bytes*
*note: student says "twelve plus eight equals twenty" (valid-paraphrase) - the box filled with the right number — the family is right*

> Yes, twelve plus eight equals box.

### reanchor:wpsb-cmp-big-family:4
*expect: turn · turn_ended: True · 3.6s · audio: 81284 b64 bytes*
*note: re-open the same item for the next probe*

> Say the family.

### probe:wpsb-cmp-big-family:big-number-misplaced:eight plus box equals twelve
*expect: turn · turn_ended: True · 12.0s · audio: 695684 b64 bytes*
*note: student says "eight plus box equals twelve" (big-number-misplaced) - THE signature error: Jen's twelve promoted to the big slot because it is the biggest number seen; the box demoted to a small*

> My turn: the big number goes last, after equals. Tom's stickers is the big number, so the family is twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:big-number-misplaced:box plus eight equals twelve
*expect: turn · turn_ended: True · 11.9s · audio: 689284 b64 bytes*
*note: student says "box plus eight equals twelve" (big-number-misplaced) - the same upside-down family, smalls swapped*

> My turn: the big number goes last, after equals. Tom's stickers is the big number, so the family is twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:6
*expect: turn · turn_ended: True · 3.0s · audio: 88324 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:family-incomplete:twelve plus box
*expect: turn · turn_ended: True · 10.3s · audio: 583044 b64 bytes*
*note: student says "twelve plus box" (family-incomplete) - no equals, no big number*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:family-incomplete:box equals twelve
*expect: turn · turn_ended: True · 10.5s · audio: 583044 b64 bytes*
*note: student says "box equals twelve" (family-incomplete) - one small number and a wrong big*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:8
*expect: turn · turn_ended: True · 3.1s · audio: 92164 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:echo:Jen has twelve stickers and Tom has eight more
*expect: turn · turn_ended: True · 10.2s · audio: 580484 b64 bytes*
*note: student says "Jen has twelve stickers and Tom has eight more" (echo) - the story read back — no family*

> My turn: a family has all three — two small numbers and the big number. Twelve plus eight equals box. Your turn. Say the family.

### probe:wpsb-cmp-big-family:off-task:I don't know
*expect: turn · turn_ended: True · 6.2s · audio: 319364 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: twelve plus eight equals box. Your turn. Say the family.

### reanchor:wpsb-cmp-big-family:10
*expect: turn · turn_ended: True · 3.6s · audio: 92804 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Say the family.

### probe:wpsb-cmp-big-family:off-task:umm
*expect: turn · turn_ended: True · 6.5s · audio: 327044 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no family and no number*

> My turn: twelve plus eight equals box. Your turn. Say the family.
