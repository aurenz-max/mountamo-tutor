# Tier-3 Live Tutor Report — picture-vocabulary — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "picture-vocabulary", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "probes": 12, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 1 WARN mechanism(s) confirmed (7 + 6 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-tag-spoken` | reanchor:bench-assoc-sock:0 1/1, reanchor:bench-assoc-sock:1 1/1, reanchor:bench-assoc-sock:2 1/1, reanchor:bench-assoc-sock:4 1/1, reanchor:bench-assoc-sock:6 1/1, reanchor:bench-assoc-sock:8 1/1 — and 1 more (7 beats) | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-assoc-sock:rationalised-chain:cloud 1/1, probe:bench-assoc-sock:same-category:shirt 1/1, probe:bench-assoc-sock:same-category:hat 1/1, probe:bench-assoc-sock:nonword:blen 1/1, probe:bench-assoc-sock:off-task:I don't know 1/1, probe:bench-assoc-sock:off-task:um 1/1 (6 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

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
| `bench-assoc-sock` | `partner` | shoe | AFFIRM | AFFIRM | OK |
| `bench-assoc-sock` | `partner-unlisted` | foot | AFFIRM | AFFIRM | OK |
| `bench-assoc-sock` | `partner-unlisted` | drawer | AFFIRM | AFFIRM | OK |
| `bench-assoc-sock` | `echo` | sock | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `rationalised-chain` | cat | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `rationalised-chain` | cloud | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `same-category` | shirt | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `same-category` | hat | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `category-word` | clothes | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `nonword` | blen | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-assoc-sock` | `off-task` | um | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:bench-assoc-sock
*expect: turn · turn_ended: True · 15.8s · audio: 894724 b64 bytes*
*note: open-set ask - bench-assoc-sock*

> Hi! Time to play with words! Some things go together, like friends — a hammer goes with a nail. I say a word, you say what goes with it! Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:partner:shoe
*expect: turn · turn_ended: True · 4.5s · audio: 211844 b64 bytes*
*note: student says "shoe" (partner) - the generated partner — worn together, and the pair the curated seed list ships*

> Yes, that goes with sock — they belong together.

### reanchor:bench-assoc-sock:0
*expect: turn · turn_ended: True · 4.9s · audio: 209960 b64 bytes*
*note: re-open the same item for the next probe*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:partner-unlisted:foot
*expect: turn · turn_ended: True · 4.4s · audio: 189444 b64 bytes*
*note: student says "foot" (partner-unlisted) - THE §2.2 RULING. A sock goes on a foot: plain, everyday, needs no story, and it is NOT the generated partner. A judge that refuses this has re-closed the set around its own first guess*

> Yes, that goes with sock — they belong together.

### reanchor:bench-assoc-sock:1
*expect: turn · turn_ended: True · 5.0s · audio: 206084 b64 bytes*
*note: re-open the same item for the next probe*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:partner-unlisted:drawer
*expect: turn · turn_ended: True · 4.6s · audio: 184964 b64 bytes*
*note: student says "drawer" (partner-unlisted) - where socks are kept. A second unlisted partner on a different relation (kept-with rather than worn-with), so the bucket is not one lucky word*

> Yes, that goes with sock — they belong together.

### reanchor:bench-assoc-sock:2
*expect: turn · turn_ended: True · 4.7s · audio: 216964 b64 bytes*
*note: re-open the same item for the next probe*

> [CURRENT STATE]: challengeType: association
stimulus: sock
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:echo:sock
*expect: turn · turn_ended: True · 9.7s · audio: 529284 b64 bytes*
*note: student says "sock" (echo) - the stimulus back. THE guard: a child told "Yes!" here learns a thing goes with itself, and deleting the option cards made this the cheapest wrong answer available*

> My turn: sock cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with sock.

### probe:bench-assoc-sock:rationalised-chain:cat
*expect: turn · turn_ended: True · 7.9s · audio: 410884 b64 bytes*
*note: student says "cat" (rationalised-chain) - THE HANDOFF OWN EXAMPLE. "Cats love to play with socks" is a story, not an everyday pairing. If the judge affirms this the mode is teaching that anything goes with anything*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### reanchor:bench-assoc-sock:4
*expect: turn · turn_ended: True · 5.2s · audio: 212484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:rationalised-chain:cloud
*expect: turn · turn_ended: True · 7.4s · audio: 393604 b64 bytes*
*note: student says "cloud" (rationalised-chain) - no everyday connection at all — the probe a helpful model has to work hardest to defend, which is precisely why it is here*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### probe:bench-assoc-sock:same-category:shirt
*expect: turn · turn_ended: True · 7.4s · audio: 398724 b64 bytes*
*note: student says "shirt" (same-category) - both are clothes. Being the same KIND of thing is not going together, and this is the guard the category-word one shades into*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### reanchor:bench-assoc-sock:6
*expect: turn · turn_ended: True · 4.9s · audio: 215080 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:same-category:hat
*expect: turn · turn_ended: True · 7.8s · audio: 407080 b64 bytes*
*note: student says "hat" (same-category) - same group, no pairing — a second reading of the same guard*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### probe:bench-assoc-sock:category-word:clothes
*expect: turn · turn_ended: True · 10.0s · audio: 504964 b64 bytes*
*note: student says "clothes" (category-word) - names the SET sock belongs to rather than a partner. This is the opposite-mode base-echo failure in a new coat*

> My turn: that names a whole group. I want one thing. A hammer goes with a nail. Your turn. What goes with sock?

### reanchor:bench-assoc-sock:8
*expect: turn · turn_ended: True · 5.1s · audio: 225960 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:nonword:blen
*expect: turn · turn_ended: True · 7.6s · audio: 389764 b64 bytes*
*note: student says "blen" (nonword) - not a word — the failure the closed emoji card set made structurally impossible and the rule cannot*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### probe:bench-assoc-sock:off-task:I don't know
*expect: turn · turn_ended: True · 7.2s · audio: 384644 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### reanchor:bench-assoc-sock:10
*expect: turn · turn_ended: True · 4.9s · audio: 225320 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> [CURRENT STATE]: challengeType: association
stimulus: sock
[SESSION RESUMED]
Sock. Your turn. What goes with sock?

### probe:bench-assoc-sock:off-task:um
*expect: turn · turn_ended: True · 7.4s · audio: 392964 b64 bytes*
*note: student says "um" (off-task) - filler, not a thing — the nearest a text turn gets to dead air*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?
