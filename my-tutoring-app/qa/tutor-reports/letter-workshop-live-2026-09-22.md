# Tier-3 Live Tutor Report — letter-workshop — 2026-09-22

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"grade": "Kindergarten", "target": "lowercase-p", "cue": "Write the lowercase letter P. Lowercase P."}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 5.0 | 11.53 | 0.0 | 0.0 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.0s · audio: 252160 b64 bytes*
*note: server auto-queues the standalone greeting on auth; write intros are suppressed*

> Welcome! I'm so excited to help you with this activity today.

### say_letter
*expect: turn · turn_ended: True · 5.5s · audio: 245120 b64 bytes*

> Write the lowercase letter P. Lowercase P.

### drawing_quiet
*expect: silence · turn_ended: False · 6.3s · audio: 0 b64 bytes*

> *(silent)*

### help_before_submit
*expect: turn · turn_ended: True · 4.4s · audio: 188804 b64 bytes*

> You can hear the letter name again to help you get started.

### replay
*expect: turn · turn_ended: True · 5.0s · audio: 229764 b64 bytes*

> Write the lowercase letter P. Lowercase P.

### answer_incorrect
*expect: turn · turn_ended: True · 6.2s · audio: 300164 b64 bytes*

> Compare your writing with the model, noticing its parts and where they meet the lines.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.1s · audio: 408320 b64 bytes*
*note: server auto-queues the standalone greeting on auth; write intros are suppressed*

> Hello! I'm so excited to help you with this activity today, and we are going to do a great job.

### say_letter
*expect: turn · turn_ended: True · 6.5s · audio: 302084 b64 bytes*

> Write the lowercase letter p. Lowercase p.

### drawing_quiet
*expect: silence · turn_ended: False · 6.3s · audio: 0 b64 bytes*

> *(silent)*

### help_before_submit
*expect: turn · turn_ended: True · 4.3s · audio: 188160 b64 bytes*

> You can hear the letter name again to help you get started.

### replay
*expect: turn · turn_ended: True · 6.3s · audio: 296960 b64 bytes*

> Write the lowercase letter p. Lowercase p.

### answer_incorrect
*expect: turn · turn_ended: True · 6.6s · audio: 328960 b64 bytes*

> Compare your writing with the model, noticing its parts and where they meet the lines.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.6s · audio: 358400 b64 bytes*
*note: server auto-queues the standalone greeting on auth; write intros are suppressed*

> Welcome! I'm so happy to be here with you today, and I'm ready to help you with this activity.

### say_letter
*expect: turn · turn_ended: True · 5.3s · audio: 240640 b64 bytes*

> Write the lowercase letter P. Lowercase P.

### drawing_quiet
*expect: silence · turn_ended: False · 6.3s · audio: 0 b64 bytes*

> *(silent)*

### help_before_submit
*expect: turn · turn_ended: True · 4.1s · audio: 164480 b64 bytes*

> You can hear the letter name again to help you write it.

### replay
*expect: turn · turn_ended: True · 5.1s · audio: 234884 b64 bytes*

> Write the lowercase letter P. Lowercase P.

### answer_incorrect
*expect: turn · turn_ended: True · 6.5s · audio: 299520 b64 bytes*

> Compare your writing with the model, noticing its parts and where they meet the lines.
