# Tier-3 Live Tutor Report — foundation-explorer — 2026-07-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"concepts": 3, "concept0": "Roots", "question0": "Which part of the plant grows under the dirt?", "options0": ["The roots", "The stem", "The leaf"]}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN confirmed, 0 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 32.43 | 0.67 | 0.56 | 0.0 |

## Findings

| Status | Severity | Check | Beat | Rate | Example |
|---|---|---|---|---|---|
| CONFIRMED | WARN | `question-stacking` | * | 2/3 | 2/3 turns ask 2+ questions in one breath |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.3s · audio: 401284 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hi there! I'm ready to explore plants with you today. Let's start with the part that holds the plant in the ground!

### concept_read_aloud
*expect: turn · turn_ended: True · 15.1s · audio: 928004 b64 bytes*
*note: STIMULUS: a non-reader needs the DEFINITION, the QUESTION, and EVERY option read aloud — the census failure was full-sentence text options + prose*

> Roots. Roots grow in the dirt and drink water. Roots stay in the dark ground. Which part of the plant grows under the dirt? A) The roots; B) The stem; C) The leaf. Which picture do you want to tap?

### student_stuck
*expect: turn · turn_ended: True · 7.7s · audio: 441604 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Look closely at those pictures — can you spot the part that's down in the dark dirt? Which one looks like it's hiding down there?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.7s · audio: 428164 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hi there! I'm excited to learn about plants with you today. Let's start by looking at the roots, stem, and leaves.

### concept_read_aloud
*expect: turn · turn_ended: True · 17.3s · audio: 1043204 b64 bytes*
*note: STIMULUS: a non-reader needs the DEFINITION, the QUESTION, and EVERY option read aloud — the census failure was full-sentence text options + prose*

> Roots. Roots grow in the dirt and drink water. Roots stay in the dark ground.

Now, which part of the plant grows under the dirt? A) The roots; B) The stem; C) The leaf. Which one do you think it is?

### student_stuck
*expect: turn · turn_ended: True · 8.9s · audio: 504324 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Roots grow right in the dirt to find water. Can you point to the part of the picture that's hiding under the ground? That's our answer.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 12.7s · audio: 739240 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Welcome to the lesson! I'm excited to help you learn all about plants with me today. You're looking at the Roots right now. Did you know they are really down low, usually under the ground?

### concept_read_aloud
*expect: turn · turn_ended: True · 15.8s · audio: 974724 b64 bytes*
*note: STIMULUS: a non-reader needs the DEFINITION, the QUESTION, and EVERY option read aloud — the census failure was full-sentence text options + prose*

> Roots. Roots grow in the dirt and drink water. Roots stay in the dark ground.

Which part of the plant grows under the dirt?

A) The roots;
B) The stem;
C) The leaf.

Which picture do you want to tap?

### student_stuck
*expect: turn · turn_ended: True · 14.3s · audio: 864644 b64 bytes*
*note: ORIENT: on a stall, does the tutor restate the choices in child terms? (observational — silence allowed by quiet-by-default)*

> Hmm, think about what we said about roots growing way down low where it's dark. Which one of those pictures shows something doing just that? Remember, the roots are the ones that stay in the ground. Which one looks like that one?
