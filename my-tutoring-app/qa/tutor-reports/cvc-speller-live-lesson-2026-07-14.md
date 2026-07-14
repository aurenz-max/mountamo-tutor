# Tier-3 Live Tutor Report — cvc-speller — 2026-07-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"taskType": "fill-vowel", "vowelFocus": "short-a", "challenges": 5, "word0": "sat", "word1": "mat"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN confirmed, 2 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 5.0 | 21.47 | 0.8 | 0.0 | 0.0 |

## Findings

| Status | Severity | Check | Beat | Rate | Example |
|---|---|---|---|---|---|
| note | HIGH | `stimulus-not-read` | success_invite | 1/3 | tutor did not voice load-bearing content — missing ['sat']: "S-a-t... yes! You heard that middle sound was /a/. Now, can you say the whole word out loud for me?" |
| note | HIGH | `stimulus-not-read` | wrong_attempt | 1/3 | tutor did not voice load-bearing content — missing ['sat']: "That's a good try! Let's try listening again.

The word is s-a-a-a-t. Listen to the middle sound... is it /e/ like egg, or /a/ like apple?" |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 12.4s · audio: 731524 b64 bytes*
*note: lesson mode: the server greeting/[PRIMITIVE SWITCH] — the aiDirective makes saying the word the greeting itself*

> Yay, welcome to this lesson where we'll practice short 'a' words! I'm excited to help you learn today.

Our first word is sat, sat. Which sound do you hear in the middle?

### activity_start
*expect: turn · turn_ended: True · 15.1s · audio: 921604 b64 bytes*
*note: STIMULUS+ORIENT: must SAY "sat" and state the task in child terms*

> Oops, looks like we got ahead of ourselves! Let's try this again.

Welcome to our lesson on short 'a' words, I'm so excited to help you learn! Our first word is sat, sat. Tap the screen to choose the sound you hear in the middle.

### wrong_attempt
*expect: turn · turn_ended: True · 9.9s · audio: 581124 b64 bytes*
*note: FEEDBACK: spoken hint must re-say the word (eyes-free recovery)*

> Hmm, let's listen closely again.

Say the word sat.

Is that middle sound like /e/ like egg, or /a/ like apple?

### success_invite
*expect: turn · turn_ended: True · 7.0s · audio: 409640 b64 bytes*
*note: production beat: celebrate and invite the student to say the word*

> S-a-t... yes! You heard that middle sound was /a/. Now, can you say the whole word out loud for me?

### next_word
*expect: turn · turn_ended: False · 60.3s · audio: 282884 b64 bytes*
*note: STIMULUS on advance: "mat" must be said aloud*

> mat, mat. What sound do you hear in the middle of this word?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.2s · audio: 595844 b64 bytes*
*note: lesson mode: the server greeting/[PRIMITIVE SWITCH] — the aiDirective makes saying the word the greeting itself*

> Welcome to this lesson! Let's practice some short "a" words. The word is sat. sat. Which sound do you hear in the middle?

### activity_start
*expect: turn · turn_ended: True · 7.4s · audio: 417320 b64 bytes*
*note: STIMULUS+ORIENT: must SAY "sat" and state the task in child terms*

> [PRIMITIVE SWITCH] Let's play with short "a" words! The word is sat. sat. Which sound do you hear in the middle?

### wrong_attempt
*expect: turn · turn_ended: True · 10.2s · audio: 595240 b64 bytes*
*note: FEEDBACK: spoken hint must re-say the word (eyes-free recovery)*

> Let's try again, super thinker! The word is sat. Listen to the middle sound... is it /e/ like egg, or /a/ like apple?

### success_invite
*expect: turn · turn_ended: True · 5.7s · audio: 323204 b64 bytes*
*note: production beat: celebrate and invite the student to say the word*

> Sat... yes! You found the middle sound. Can you say the whole word for me?

### next_word
*expect: turn · turn_ended: True · 3.2s · audio: 126120 b64 bytes*
*note: STIMULUS on advance: "mat" must be said aloud*

> mat. mat.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.8s · audio: 635524 b64 bytes*
*note: lesson mode: the server greeting/[PRIMITIVE SWITCH] — the aiDirective makes saying the word the greeting itself*

> Hey there! I'm so excited to practice short a words with you today. You've got this!

Our first word is sat. Sat. Which sound do you hear in the middle?

### activity_start
*expect: turn · turn_ended: True · 10.4s · audio: 622724 b64 bytes*
*note: STIMULUS+ORIENT: must SAY "sat" and state the task in child terms*

> Hey there! I'm so excited to help you learn and play with short a words.

Let's start! Our first word is sat, sat. What sound do you hear in the middle?

### wrong_attempt
*expect: turn · turn_ended: True · 12.4s · audio: 754600 b64 bytes*
*note: FEEDBACK: spoken hint must re-say the word (eyes-free recovery)*

> That's a good try! Let's try listening again.

The word is s-a-a-a-t. Listen to the middle sound... is it /e/ like egg, or /a/ like apple?

### success_invite
*expect: turn · turn_ended: True · 7.2s · audio: 412164 b64 bytes*
*note: production beat: celebrate and invite the student to say the word*

> Sat... yes! You heard that /a/ sound perfectly.

Can you say the whole word "sat" for me now?

### next_word
*expect: turn · turn_ended: True · 2.9s · audio: 126084 b64 bytes*
*note: STIMULUS on advance: "mat" must be said aloud*

> mat. mat.
