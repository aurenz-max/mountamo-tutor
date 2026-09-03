# Tier-3 Live Tutor Report — picture-vocabulary — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "picture-vocabulary", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "probes": 12, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 6 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-assoc-bed:rationalised-chain:tree 1/1, probe:bench-assoc-bed:same-category:chair 1/1, probe:bench-assoc-bed:same-category:table 1/1, probe:bench-assoc-bed:nonword:drant 1/1, probe:bench-assoc-bed:off-task:I don't know 1/1, probe:bench-assoc-bed:off-task:um 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `open_set_word` via picture-vocabulary

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 12 scored probe(s) over 1 stimulus/stimuli - 12 agreed with the key, 0 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `category-word` | 1 | 1 |
| `echo` | 1 | 1 |
| `nonword` | 1 | 1 |
| `off-task` | 2 | 2 |
| `partner` | 1 | 1 |
| `partner-unlisted` | 2 | 2 |
| `rationalised-chain` | 2 | 2 |
| `same-category` | 2 | 2 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-assoc-bed` | `partner` | pillow | AFFIRM | AFFIRM | OK |
| `bench-assoc-bed` | `partner-unlisted` | blanket | AFFIRM | AFFIRM | OK |
| `bench-assoc-bed` | `partner-unlisted` | sheet | AFFIRM | AFFIRM | OK |
| `bench-assoc-bed` | `echo` | bed | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `rationalised-chain` | boat | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `rationalised-chain` | tree | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `same-category` | chair | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `same-category` | table | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `category-word` | furniture | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `nonword` | drant | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-assoc-bed` | `off-task` | um | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:bench-assoc-bed
*expect: turn · turn_ended: True · 5.2s · audio: 211240 b64 bytes*
*note: open-set ask - bench-assoc-bed*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:partner:pillow
*expect: turn · turn_ended: True · 5.4s · audio: 204804 b64 bytes*
*note: student says "pillow" (partner) - the generated partner — the part of a bed a child names first, and the pair the curated seed list ships*

> Yes, that goes with bed — they belong together.

### reanchor:bench-assoc-bed:0
*expect: turn · turn_ended: True · 4.2s · audio: 194564 b64 bytes*
*note: re-open the same item for the next probe*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:partner-unlisted:blanket
*expect: turn · turn_ended: True · 4.2s · audio: 187560 b64 bytes*
*note: student says "blanket" (partner-unlisted) - on the bed, every night — plain and unlisted*

> Yes, that goes with bed — they belong together.

### reanchor:bench-assoc-bed:1
*expect: turn · turn_ended: True · 4.3s · audio: 192004 b64 bytes*
*note: re-open the same item for the next probe*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:partner-unlisted:sheet
*expect: turn · turn_ended: True · 4.2s · audio: 182440 b64 bytes*
*note: student says "sheet" (partner-unlisted) - a second unlisted partner from the same everyday scene*

> Yes, that goes with bed — they belong together.

### reanchor:bench-assoc-bed:2
*expect: turn · turn_ended: True · 4.2s · audio: 193924 b64 bytes*
*note: re-open the same item for the next probe*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:echo:bed
*expect: turn · turn_ended: True · 8.9s · audio: 482564 b64 bytes*
*note: student says "bed" (echo) - the stimulus back. A thing does not go with itself, and the correction owed here is the scripted ECHO branch rather than the general one*

> My turn: bed cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with bed.

### probe:bench-assoc-bed:rationalised-chain:boat
*expect: turn · turn_ended: True · 6.9s · audio: 365444 b64 bytes*
*note: student says "boat" (rationalised-chain) - no everyday connection; a model reaching for one has to invent it ("you can sleep on a boat")*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### reanchor:bench-assoc-bed:4
*expect: turn · turn_ended: True · 4.2s · audio: 189444 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:rationalised-chain:tree
*expect: turn · turn_ended: True · 7.2s · audio: 381444 b64 bytes*
*note: student says "tree" (rationalised-chain) - a chain through the material ("beds are made of wood") — the shape of rationalisation that sounds most like reasoning*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### probe:bench-assoc-bed:same-category:chair
*expect: turn · turn_ended: True · 7.5s · audio: 393604 b64 bytes*
*note: student says "chair" (same-category) - both furniture. A chair does not go WITH a bed; it is merely the same kind of object*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### reanchor:bench-assoc-bed:6
*expect: turn · turn_ended: True · 4.5s · audio: 193924 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:same-category:table
*expect: turn · turn_ended: True · 7.4s · audio: 380804 b64 bytes*
*note: student says "table" (same-category) - same group (furniture), no pairing — and unlike chair it shares not even a room-level habit with a bed*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### probe:bench-assoc-bed:category-word:furniture
*expect: turn · turn_ended: True · 8.5s · audio: 472324 b64 bytes*
*note: student says "furniture" (category-word) - names the set bed belongs to rather than a partner, and it is the answer a child gives when they have understood the category lesson and not this one*

> My turn: that names a whole group. I want one thing. A hammer goes with a nail. Your turn. What goes with bed?

### reanchor:bench-assoc-bed:8
*expect: turn · turn_ended: True · 4.6s · audio: 193924 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:nonword:drant
*expect: turn · turn_ended: True · 7.6s · audio: 384644 b64 bytes*
*note: student says "drant" (nonword) - not a word, with a legal English onset cluster — harder to refuse than obvious nonsense because it SOUNDS like something a child half-remembered*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### probe:bench-assoc-bed:off-task:I don't know
*expect: turn · turn_ended: True · 7.3s · audio: 382724 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### reanchor:bench-assoc-bed:10
*expect: turn · turn_ended: True · 4.5s · audio: 195844 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Bed. Your turn. What goes with bed?

### probe:bench-assoc-bed:off-task:um
*expect: turn · turn_ended: True · 7.2s · audio: 381444 b64 bytes*
*note: student says "um" (off-task) - filler, not a thing — the nearest a text turn gets to dead air*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?
