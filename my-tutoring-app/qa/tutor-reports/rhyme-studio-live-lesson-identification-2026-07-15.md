# Tier-3 Live Tutor Report — rhyme-studio — 2026-07-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeLevel": "K", "challenges": 9, "mode0": "identification", "target0": "cat", "mode1": "identification", "target1": "sun"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 23.0 | 0.78 | 0.22 | 0.11 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.4s · audio: 524804 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hi there! I'm so excited to practice rhyming words with you today, like finding words that end like "cat." You're going to do great!

### activity_start
*expect: turn · turn_ended: True · 11.5s · audio: 684164 b64 bytes*
*note: ORIENT/STIMULUS: the PRE-READER READ-ALOUD directive must SAY both words (recognition) / target + every option (identification) and ask the rhyme question — a non-reader cannot read any of it; must survive the one-sentence cap*

> Welcome to Rhyme Studio! We're going to have fun finding words that rhyme with 'cat'. Okay, listen closely: which word rhymes with cat — hat, or pig?

### pronounce_words
*expect: turn · turn_ended: True · 6.7s · audio: 332804 b64 bytes*
*note: ORIENT/STIMULUS on advance: the next challenge's words + rhyme question must be voiced too*

> Sun. Which word rhymes with sun? run, or box?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.7s · audio: 616324 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Welcome to the Rhyme Studio! I'm here to help you play with words.

Target word: cat. Choice words: hat, pig. Which one rhymes with cat?

### activity_start
*expect: turn · turn_ended: True · 10.9s · audio: 658600 b64 bytes*
*note: ORIENT/STIMULUS: the PRE-READER READ-ALOUD directive must SAY both words (recognition) / target + every option (identification) and ask the rhyme question — a non-reader cannot read any of it; must survive the one-sentence cap*

> Welcome to the Rhyme Studio! We're going to find words that sound the same.

Target word: cat. Choice words: hat, pig. Which word rhymes with cat?

### pronounce_words
*expect: turn · turn_ended: True · 6.0s · audio: 321284 b64 bytes*
*note: ORIENT/STIMULUS on advance: the next challenge's words + rhyme question must be voiced too*

> Target word: sun. Which word rhymes with sun? run, box.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 15.3s · audio: 924840 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hey there! I'm so excited to help you with rhyming words today. You're going to do great! Let's start with Rhyme Studio. Now, can you look at these pictures? We have "cat", and your choices are "hat" or "pig". Which one rhymes with "cat"?

### activity_start
*expect: turn · turn_ended: True · 8.8s · audio: 509444 b64 bytes*
*note: ORIENT/STIMULUS: the PRE-READER READ-ALOUD directive must SAY both words (recognition) / target + every option (identification) and ask the rhyme question — a non-reader cannot read any of it; must survive the one-sentence cap*

> Let's try this first one! Listen to the word "cat". The options are "hat" or "pig". Which word rhymes with "cat"?

### pronounce_words
*expect: turn · turn_ended: True · 10.7s · audio: 561284 b64 bytes*
*note: ORIENT/STIMULUS on advance: the next challenge's words + rhyme question must be voiced too*

> Awesome, you got it! Now listen to this word: "sun". The options are "run" or "box". Which one rhymes with "sun"?
