# Tier-3 Live Tutor Report — picture-vocabulary — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "picture-vocabulary", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "probes": 12, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 5 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-assoc-cup:rationalised-chain:cloud 1/1, probe:bench-assoc-cup:same-category:mug 1/1, probe:bench-assoc-cup:nonword:plound 1/1, probe:bench-assoc-cup:off-task:I don't know 1/1, probe:bench-assoc-cup:off-task:um 1/1 (5 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `open_set_word` via picture-vocabulary

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 12 scored probe(s) over 1 stimulus/stimuli - 11 agreed with the key, 0 missed valid, 1 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `category-word` | 1 | 1 |
| `echo` | 1 | 1 |
| `nonword` | 1 | 1 |
| `off-task` | 2 | 2 |
| `partner` | 1 | 1 |
| `partner-unlisted` | 2 | 2 |
| `rationalised-chain` | 2 | 2 |
| `same-category` | 1 | 2 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-assoc-cup` | `partner` | plate | AFFIRM | AFFIRM | OK |
| `bench-assoc-cup` | `partner-unlisted` | saucer | AFFIRM | AFFIRM | OK |
| `bench-assoc-cup` | `partner-unlisted` | tea | AFFIRM | AFFIRM | OK |
| `bench-assoc-cup` | `echo` | cup | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `rationalised-chain` | shoe | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `rationalised-chain` | cloud | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `same-category` | mug | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `same-category` | bowl | REFUSE | AFFIRM | soft |
| `bench-assoc-cup` | `category-word` | dishes | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `nonword` | plound | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-assoc-cup` | `off-task` | um | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:bench-assoc-cup
*expect: turn · turn_ended: True · 4.8s · audio: 184964 b64 bytes*
*note: open-set ask - bench-assoc-cup*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:partner:plate
*expect: turn · turn_ended: True · 5.1s · audio: 202884 b64 bytes*
*note: student says "plate" (partner) - the generated partner — tableware laid together, and the relation the same-category probes below are measured against*

> Yes, that goes with cup — they belong together.

### reanchor:bench-assoc-cup:0
*expect: turn · turn_ended: True · 4.1s · audio: 173444 b64 bytes*
*note: re-open the same item for the next probe*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:partner-unlisted:saucer
*expect: turn · turn_ended: True · 4.3s · audio: 195844 b64 bytes*
*note: student says "saucer" (partner-unlisted) - what a cup SITS ON — a specific functional pairing, and the contrast that makes the "bowl" probe below meaningful*

> Yes, that goes with cup — they belong together.

### reanchor:bench-assoc-cup:1
*expect: turn · turn_ended: True · 4.5s · audio: 177284 b64 bytes*
*note: re-open the same item for the next probe*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:partner-unlisted:tea
*expect: turn · turn_ended: True · 4.4s · audio: 202280 b64 bytes*
*note: student says "tea" (partner-unlisted) - what goes IN a cup. A third relation type on the accept side (contents rather than companion object), which is the widest the clause is asked to stretch*

> Yes, that goes with cup — they belong together.

### reanchor:bench-assoc-cup:2
*expect: turn · turn_ended: True · 4.0s · audio: 177924 b64 bytes*
*note: re-open the same item for the next probe*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:echo:cup
*expect: turn · turn_ended: True · 9.0s · audio: 497924 b64 bytes*
*note: student says "cup" (echo) - the stimulus back. Sharpest on this stimulus because "mug" sits two probes below it: one is the same thing renamed, the other is the same thing repeated, and both are wrong for the same reason*

> My turn: cup cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with cup.

### probe:bench-assoc-cup:rationalised-chain:shoe
*expect: turn · turn_ended: True · 7.2s · audio: 384644 b64 bytes*
*note: student says "shoe" (rationalised-chain) - a CROSS-PROBE: "shoe" is another stimulus correct partner, so a judge carrying context between items rather than judging this one is caught here*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?

### reanchor:bench-assoc-cup:4
*expect: turn · turn_ended: True · 4.4s · audio: 175364 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:rationalised-chain:cloud
*expect: turn · turn_ended: True · 7.5s · audio: 384644 b64 bytes*
*note: student says "cloud" (rationalised-chain) - no everyday connection to a cup; any link a model produces here it has just invented, which is the whole test*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?

### probe:bench-assoc-cup:same-category:mug
*expect: turn · turn_ended: True · 7.3s · audio: 384644 b64 bytes*
*note: student says "mug" (same-category) - a mug IS a cup — the purest same-category failure in the whole fixture. The child has named the same thing again, not a partner*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?

### reanchor:bench-assoc-cup:6
*expect: turn · turn_ended: True · 4.1s · audio: 183044 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:same-category:bowl
*expect: turn · turn_ended: True · 4.2s · audio: 186280 b64 bytes*
*note: student says "bowl" (same-category) - another dish, not a companion to a cup — but filed SOFT because tableware genuinely is kept together, so this is the boundary of the guard rather than its centre. Contrast with "saucer" above, which pairs with a cup specifically*

> Yes, that goes with cup — they belong together.

### probe:bench-assoc-cup:category-word:dishes
*expect: turn · turn_ended: True · 8.9s · audio: 475524 b64 bytes*
*note: student says "dishes" (category-word) - names the set cup belongs to rather than a partner. Sharpest here because dishes really are used together, so the judge must refuse the GROUP NAME while still affirming saucer*

> My turn: that names a whole group. I want one thing. A hammer goes with a nail. Your turn. What goes with cup?

### reanchor:bench-assoc-cup:8
*expect: turn · turn_ended: True · 4.9s · audio: 193284 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:nonword:plound
*expect: turn · turn_ended: True · 7.9s · audio: 380804 b64 bytes*
*note: student says "plound" (nonword) - not a word, and one phoneme from the real word "pound" — the nonword hardest to refuse in the fixture*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?

### probe:bench-assoc-cup:off-task:I don't know
*expect: turn · turn_ended: True · 7.1s · audio: 379524 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?

### reanchor:bench-assoc-cup:10
*expect: turn · turn_ended: True · 5.1s · audio: 195844 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Cup. Your turn. What goes with cup?

### probe:bench-assoc-cup:off-task:um
*expect: turn · turn_ended: True · 8.2s · audio: 423044 b64 bytes*
*note: student says "um" (off-task) - filler, not a thing — the nearest a text turn gets to dead air*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with cup?
