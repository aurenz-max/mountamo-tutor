# Tier-3 Live Tutor Report — di-deduction — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-bench", "component": "di-deduction", "items": 1, "voice_items": 1, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "bench-key", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "probes": 11, "unkeyed_items": [], "max_corrections": 2}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 4 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | probe:ddb-insects-c0-conclude:echo:a beetle is an insect 1/1, probe:ddb-insects-c0-conclude:adjacent-concept:a beetle is black and shiny 1/1, probe:ddb-insects-c0-conclude:off-task:I don't know 1/1, probe:ddb-insects-c0-conclude:off-task:umm 1/1 (4 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Bench matrix - `deduction` via di-deduction

Scored against the port's hand-authored fixture, not against generated content. **THE GATE IS ASYMMETRIC AND IS NOT AN ACCURACY NUMBER**: zero false affirmations in the hard REFUSE buckets. A missed valid answer costs the child a turn; an affirmed wrong answer teaches them the error.

**PASS** - zero false affirmations. 11 scored probe(s) over 1 stimulus/stimuli - 11 agreed with the key, 0 missed valid, 0 soft disagreement(s), 0 drew no classifiable verdict.

| Bucket | Agreed | Probes |
|---|---|---|
| `adjacent-concept` | 1 | 1 |
| `echo` | 2 | 2 |
| `off-task` | 2 | 2 |
| `valid-canonical` | 1 | 1 |
| `valid-childlike` | 1 | 1 |
| `valid-paraphrase` | 2 | 2 |
| `wrong-verdict` | 2 | 2 |

| Item | Bucket | Student said | Owed | Observed | |
|---|---|---|---|---|---|
| `ddb-insects-c0-conclude` | `valid-canonical` | a beetle has six legs | AFFIRM | AFFIRM | OK |
| `ddb-insects-c0-conclude` | `valid-paraphrase` | it has six legs | AFFIRM | AFFIRM | OK |
| `ddb-insects-c0-conclude` | `valid-paraphrase` | so beetles have six legs too | AFFIRM | AFFIRM | OK |
| `ddb-insects-c0-conclude` | `valid-childlike` | um, that it's got six legs | AFFIRM | AFFIRM | OK |
| `ddb-insects-c0-conclude` | `echo` | all insects have six legs | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `echo` | a beetle is an insect | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `wrong-verdict` | a beetle is not an insect | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `wrong-verdict` | you can't tell | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `adjacent-concept` | a beetle is black and shiny | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `off-task` | I don't know | REFUSE | REFUSE | OK |
| `ddb-insects-c0-conclude` | `off-task` | umm | REFUSE | REFUSE | OK |


## Run 1 — beat-by-beat transcript

### ask:ddb-insects-c0-conclude
*expect: turn · turn_ended: True · 22.8s · audio: 1351044 b64 bytes*
*note: open-set ask - ddb-insects-c0-conclude*

> We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; then you say can't tell. Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:valid-canonical:a beetle has six legs
*expect: turn · turn_ended: True · 5.4s · audio: 263044 b64 bytes*
*note: student says "a beetle has six legs" (valid-canonical) - the anchor wording*

> Yes, a beetle is an insect, so a beetle has six legs.

### reanchor:ddb-insects-c0-conclude:0
*expect: turn · turn_ended: True · 8.4s · audio: 457604 b64 bytes*
*note: re-open the same item for the next probe*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:valid-paraphrase:it has six legs
*expect: turn · turn_ended: True · 5.5s · audio: 257924 b64 bytes*
*note: student says "it has six legs" (valid-paraphrase) - the conclusion with a pronoun*

> Yes, a beetle is an insect, so a beetle has six legs.

### reanchor:ddb-insects-c0-conclude:1
*expect: turn · turn_ended: True · 9.2s · audio: 463400 b64 bytes*
*note: re-open the same item for the next probe*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:valid-paraphrase:so beetles have six legs too
*expect: turn · turn_ended: True · 6.4s · audio: 252804 b64 bytes*
*note: student says "so beetles have six legs too" (valid-paraphrase) - plural, "too" — the idea is there*

> Yes, a beetle is an insect, so a beetle has six legs.

### reanchor:ddb-insects-c0-conclude:2
*expect: turn · turn_ended: True · 8.3s · audio: 454404 b64 bytes*
*note: re-open the same item for the next probe*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:valid-childlike:um, that it's got six legs
*expect: turn · turn_ended: True · 5.2s · audio: 250244 b64 bytes*
*note: student says "um, that it's got six legs" (valid-childlike) - grammar and hedging are not the skill*

> Yes, a beetle is an insect, so a beetle has six legs.

### reanchor:ddb-insects-c0-conclude:3
*expect: turn · turn_ended: True · 8.1s · audio: 441604 b64 bytes*
*note: re-open the same item for the next probe*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:echo:all insects have six legs
*expect: turn · turn_ended: True · 10.7s · audio: 604164 b64 bytes*
*note: student says "all insects have six legs" (echo) - THE guard: the rule read back says nothing about the beetle*

> My turn: The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:echo:a beetle is an insect
*expect: turn · turn_ended: True · 11.2s · audio: 622724 b64 bytes*
*note: student says "a beetle is an insect" (echo) - the case read back*

> My turn: The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### reanchor:ddb-insects-c0-conclude:5
*expect: turn · turn_ended: True · 8.2s · audio: 441604 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:wrong-verdict:a beetle is not an insect
*expect: turn · turn_ended: True · 13.0s · audio: 751364 b64 bytes*
*note: student says "a beetle is not an insect" (wrong-verdict) - contradicts the case*

> My turn: not "a beetle is not an insect" — The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:wrong-verdict:you can't tell
*expect: turn · turn_ended: True · 12.6s · audio: 725764 b64 bytes*
*note: student says "you can't tell" (wrong-verdict) - the rule DOES tell you here — the over-learned "can't tell"*

> My turn: not "you can't tell" — The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### reanchor:ddb-insects-c0-conclude:7
*expect: turn · turn_ended: True · 8.2s · audio: 441604 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:adjacent-concept:a beetle is black and shiny
*expect: turn · turn_ended: True · 10.9s · audio: 619524 b64 bytes*
*note: student says "a beetle is black and shiny" (adjacent-concept) - true, and not what the rule says*

> My turn: The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:off-task:I don't know
*expect: turn · turn_ended: True · 11.1s · audio: 610564 b64 bytes*
*note: student says "I don't know" (off-task) - not an answer; the correction branch*

> My turn: The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?

### reanchor:ddb-insects-c0-conclude:9
*expect: turn · turn_ended: True · 8.4s · audio: 455720 b64 bytes*
*note: re-open the same item for the next probe (correction cap reached)*

> Here is the rule: All insects have six legs. A beetle is an insect. So what does the rule tell you about a beetle?

### probe:ddb-insects-c0-conclude:off-task:umm
*expect: turn · turn_ended: True · 11.0s · audio: 616324 b64 bytes*
*note: student says "umm" (off-task) - a filler noise, no verdict and no reason*

> My turn: The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. Your turn. So what does the rule tell you about a beetle?
