# Tier-3 Live Tutor Report — decodable-reader — 2026-07-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"readingMode": "read_along", "totalWords": 9, "passageText": "The cat can hop. It is a fun pet.", "options": 3}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 20.8 | 0.25 | 0.17 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.7s · audio: 424964 b64 bytes*
*note: server auto-queues the standalone/lesson greeting on auth*

> Hi there! I'm so excited to read this story with you. Try to read it yourself, and tap any word you want me to say.

### read_along_start
*expect: turn · turn_ended: True · 7.4s · audio: 429444 b64 bytes*
*note: STIMULUS: a pre-reader needs the WHOLE passage read aloud, word for word*

> The cat can hop. It is a fun pet. You can tap any word to hear it again!

### student_stuck
*expect: turn · turn_ended: True · 4.8s · audio: 232324 b64 bytes*
*note: ORIENT: does the tutor gently restate what to do, in child terms?*

> You're doing great. Tap any word you want to hear me read!

### comprehension
*expect: turn · turn_ended: True · 11.1s · audio: 616964 b64 bytes*
*note: STIMULUS: the question AND every picture choice must be voiced*

> What can the cat do? A: The cat can hop. B: The cat can nap. C: The cat can eat. Which one do you think?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.0s · audio: 392324 b64 bytes*
*note: server auto-queues the standalone/lesson greeting on auth*

> Hello there! I'm so excited to help you practice animals at the park. Let's start with this story!

### read_along_start
*expect: turn · turn_ended: True · 7.8s · audio: 452484 b64 bytes*
*note: STIMULUS: a pre-reader needs the WHOLE passage read aloud, word for word*

> The cat can hop. It is a fun pet. You can tap any word you want to hear again!

### student_stuck
*expect: turn · turn_ended: True · 4.7s · audio: 259844 b64 bytes*
*note: ORIENT: does the tutor gently restate what to do, in child terms?*

> Try tapping a word if you want to hear it. It's okay to listen to them!

### comprehension
*expect: turn · turn_ended: False · 60.3s · audio: 634884 b64 bytes*
*note: STIMULUS: the question AND every picture choice must be voiced*

> You finished reading! Now, what can the cat do? A: The cat can hop. B: The cat can nap. C: The cat can eat.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.3s · audio: 459524 b64 bytes*
*note: server auto-queues the standalone/lesson greeting on auth*

> Hi there! Welcome to the park. I'm so excited to help you read this story! Tap any word you want me to say.

### read_along_start
*expect: turn · turn_ended: True · 7.2s · audio: 417284 b64 bytes*
*note: STIMULUS: a pre-reader needs the WHOLE passage read aloud, word for word*

> The cat can hop. It is a fun pet. Tap any word you want me to say again!

### student_stuck
*expect: turn · turn_ended: True · 5.0s · audio: 276484 b64 bytes*
*note: ORIENT: does the tutor gently restate what to do, in child terms?*

> You're doing great looking at the words! Which one should we listen to first?

### comprehension
*expect: turn · turn_ended: True · 13.1s · audio: 798084 b64 bytes*
*note: STIMULUS: the question AND every picture choice must be voiced*

> You finished reading, nice work! Now, let's think about the story. What can the cat do?

A: The cat can hop.
B: The cat can nap.
C: The cat can eat.

Which one do you think it is?
