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
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:bench-assoc-dog:same-category:cat 1/1, probe:bench-assoc-dog:same-category:bird 1/1, probe:bench-assoc-dog:nonword:frell 1/1, probe:bench-assoc-dog:off-task:I don't know 1/1, probe:bench-assoc-dog:off-task:um 1/1 (5 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

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
| `rationalised-chain` | 1 | 2 |
| `same-category` | 2 | 2 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `bench-assoc-dog` | `partner` | bone | AFFIRM | AFFIRM | OK |
| `bench-assoc-dog` | `partner-unlisted` | leash | AFFIRM | AFFIRM | OK |
| `bench-assoc-dog` | `partner-unlisted` | collar | AFFIRM | AFFIRM | OK |
| `bench-assoc-dog` | `echo` | dog | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `rationalised-chain` | moon | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `rationalised-chain` | mailman | REFUSE | AFFIRM | soft |
| `bench-assoc-dog` | `same-category` | cat | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `same-category` | bird | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `category-word` | animals | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `nonword` | frell | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `bench-assoc-dog` | `off-task` | um | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:bench-assoc-dog
*expect: turn · turn_ended: True · 5.4s · audio: 225284 b64 bytes*
*note: open-set ask - bench-assoc-dog*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:partner:bone
*expect: turn · turn_ended: True · 4.6s · audio: 218244 b64 bytes*
*note: student says "bone" (partner) - the generated partner — a creature and its thing, a different relation type from the worn-together sock pair*

> Yes, that goes with dog — they belong together.

### reanchor:bench-assoc-dog:0
*expect: turn · turn_ended: True · 5.0s · audio: 231684 b64 bytes*
*note: re-open the same item for the next probe*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:partner-unlisted:leash
*expect: turn · turn_ended: True · 4.7s · audio: 211204 b64 bytes*
*note: student says "leash" (partner-unlisted) - used with a dog every day; plainly goes with it and is not the generated partner*

> Yes, that goes with dog — they belong together.

### reanchor:bench-assoc-dog:1
*expect: turn · turn_ended: True · 4.9s · audio: 227844 b64 bytes*
*note: re-open the same item for the next probe*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:partner-unlisted:collar
*expect: turn · turn_ended: True · 4.3s · audio: 200964 b64 bytes*
*note: student says "collar" (partner-unlisted) - worn by a dog — a second unlisted partner a five-year-old would offer first*

> Yes, that goes with dog — they belong together.

### reanchor:bench-assoc-dog:2
*expect: turn · turn_ended: True · 5.1s · audio: 245764 b64 bytes*
*note: re-open the same item for the next probe*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:echo:dog
*expect: turn · turn_ended: True · 9.4s · audio: 520964 b64 bytes*
*note: student says "dog" (echo) - the stimulus back. Second reading of THE guard, on a stimulus whose partner is not something you wear — so a judge cannot refuse it by pattern from the sock item*

> My turn: dog cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with dog.

### probe:bench-assoc-dog:rationalised-chain:moon
*expect: turn · turn_ended: True · 8.0s · audio: 433284 b64 bytes*
*note: student says "moon" (rationalised-chain) - THE SHARPEST CHAIN IN THE SET. "Dogs howl at the moon" is a REAL cultural association, which makes it far harder to refuse than a random word — and it is still not a thing you find, use or keep with a dog. This probe separates "related somehow" from "goes together"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?

### reanchor:bench-assoc-dog:4
*expect: turn · turn_ended: True · 5.2s · audio: 249604 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:rationalised-chain:mailman
*expect: turn · turn_ended: True · 5.1s · audio: 209284 b64 bytes*
*note: student says "mailman" (rationalised-chain) - the cliche chain ("dogs chase the mailman"). Filed SOFT because it is genuinely arguable: a mail carrier is an everyday part of a dog world, so a judge affirming it is being defensible rather than gullible*

> Yes, that goes with dog — they belong together.

### probe:bench-assoc-dog:same-category:cat
*expect: turn · turn_ended: True · 8.4s · audio: 458884 b64 bytes*
*note: student says "cat" (same-category) - both are pets. The strongest same-category trap here because cats and dogs are a famous PAIR — famous as opposites, never as things that go together*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?

### reanchor:bench-assoc-dog:6
*expect: turn · turn_ended: True · 5.2s · audio: 251524 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:same-category:bird
*expect: turn · turn_ended: True · 8.9s · audio: 466564 b64 bytes*
*note: student says "bird" (same-category) - same group (a pet, an animal), no pairing whatsoever — the plain reading of the guard, against the harder cat probe above*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?

### probe:bench-assoc-dog:category-word:animals
*expect: turn · turn_ended: True · 9.9s · audio: 551684 b64 bytes*
*note: student says "animals" (category-word) - names the set dog belongs to rather than a partner. True of the picture and not an answer to the question — the empty superordinate, which is exactly the naming-mode failure in a new mode*

> My turn: that names a whole group. I want one thing. A hammer goes with a nail. Your turn. What goes with dog?

### reanchor:bench-assoc-dog:8
*expect: turn · turn_ended: True · 5.5s · audio: 252804 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:nonword:frell
*expect: turn · turn_ended: True · 8.5s · audio: 443524 b64 bytes*
*note: student says "frell" (nonword) - not a word. Checked by eye, and note the asymmetry with rhyme: a surname would still be wrong here, because a name is not a thing that goes with a dog*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?

### probe:bench-assoc-dog:off-task:I don't know
*expect: turn · turn_ended: True · 8.4s · audio: 457604 b64 bytes*
*note: student says "I don't know" (off-task) - an honest non-answer. The contract names it, and a judge without a scripted branch here invents one*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?

### reanchor:bench-assoc-dog:10
*expect: turn · turn_ended: True · 5.2s · audio: 244484 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Dog. Your turn. What goes with dog?

### probe:bench-assoc-dog:off-task:um
*expect: turn · turn_ended: True · 8.3s · audio: 451204 b64 bytes*
*note: student says "um" (off-task) - filler, not a thing — the nearest a text turn gets to dead air*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with dog?
