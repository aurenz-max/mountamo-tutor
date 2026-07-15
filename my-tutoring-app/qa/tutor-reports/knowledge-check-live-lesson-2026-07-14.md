# Tier-3 Live Tutor Report — knowledge-check — 2026-07-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"problems": 1, "question0": "Which one of these is a circle?", "options0": ["Square", "Circle", "Triangle"]}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 22.2 | 0.33 | 0.33 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 5.6s · audio: 284164 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hey there! Welcome to our lesson on shapes! I'm so excited to help you.

### problem_read_aloud
*expect: turn · turn_ended: True · 11.8s · audio: 714244 b64 bytes*
*note: STIMULUS: a non-reader needs the QUESTION and EVERY choice read aloud here — text-word options are the census failure this fixes*

> Let's try this together. Which one is a circle? A... Square. B... Circle. C... Triangle. Which one do you pick?

### student_stuck
*expect: turn · turn_ended: True · 5.4s · audio: 306564 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Take your time! Just look closely at each one and choose the shape you think is a circle.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.1s · audio: 526724 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hi there! I'm so excited to learn with you today. You're starting with a quick check to show what you know about shapes. You've got this!

### problem_read_aloud
*expect: turn · turn_ended: True · 10.8s · audio: 637444 b64 bytes*
*note: STIMULUS: a non-reader needs the QUESTION and EVERY choice read aloud here — text-word options are the census failure this fixes*

> Which one of these is a circle? A... Square. B... Circle. C... Triangle. Which one do you pick?

### student_stuck
*expect: turn · turn_ended: True · 8.9s · audio: 533800 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Take your time and look at each choice. Which one looks like it has no corners and is round all over? Go ahead and tap the one you think it is.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.3s · audio: 597764 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hi there! I'm so excited to learn about shapes with you today and I'll be right here to help every step of the way. Let's see what this first challenge has for us.

### problem_read_aloud
*expect: turn · turn_ended: True · 10.8s · audio: 641924 b64 bytes*
*note: STIMULUS: a non-reader needs the QUESTION and EVERY choice read aloud here — text-word options are the census failure this fixes*

> Which one of these is a circle? Listen carefully: A... Square. B... Circle. C... Triangle. Which picture do you pick?

### student_stuck
*expect: turn · turn_ended: True · 6.1s · audio: 348164 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Which shape looks like a wheel or a pizza? Take your time and choose the one you think is right.
