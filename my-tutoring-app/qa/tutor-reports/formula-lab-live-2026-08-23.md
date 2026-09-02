# Tier-3 Live Tutor Report — formula-lab — 2026-08-23

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 0 WARN mechanism(s) confirmed (2 + 0 beat instances), 0 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 30.53 | 0.56 | 0.0 | 0.0 |

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `tag-syntax-spoken` | student_orientation 3/3, answer_fish 3/3 (2 beats) | tutor read system-message syntax aloud: "[CURRENT STATE]: {"outputName": "Volume", "challengeType": "predict-direction", "changedVariable": "height", "currentChallengeIndex": 1, "totalChallenges": 3, "" |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.4s · audio: 378244 b64 bytes*

> Hello! I'm here to help you explore how this works. Let's start by looking at what changes!

### student_orientation
*expect: turn · turn_ended: True · 7.0s · audio: 339844 b64 bytes*

> [CURRENT STATE]: {"outputName": "Volume", "challengeType": "predict-direction", "changedVariable": "height", "predictionLocked": false}

Let's start by looking at 'height' in the formula. How do you think changing that will affect the Volume?

### answer_fish
*expect: turn · turn_ended: True · 2.9s · audio: 0 b64 bytes*

> [CURRENT STATE]: {"outputName": "Volume", "challengeType": "predict-direction", "changedVariable": "height", "predictionLocked": false}

I can't tell you the answer, but we can figure it out! Think about 'height'—is it being multiplied, divided, or something else in the formula?

That will help you predict which way the Volume moves.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.3s · audio: 310404 b64 bytes*

> Hey there! I'm here to help you figure out this cool volume puzzle. Let's get started!

### student_orientation
*expect: turn · turn_ended: True · 7.5s · audio: 388484 b64 bytes*

> [CURRENT STATE]: {"challengeType": "predict-direction", "changedVariable": "Height"}

Let's start by looking at Height in the formula. What kind of relationship do you see between the Height and the final Volume?

### answer_fish
*expect: turn · turn_ended: True · 9.8s · audio: 529924 b64 bytes*

> [CURRENT STATE]: {"challengeType": "predict-direction", "changedVariable": "Height"}

I can't tell you the answer, but let's think about it. If Height gets bigger, and we're multiplying, what do you predict will happen to the Volume?


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.6s · audio: 320040 b64 bytes*

> Welcome! I'm excited to help you explore volume today. Let's get started!

### student_orientation
*expect: turn · turn_ended: True · 10.6s · audio: 589480 b64 bytes*

> [CURRENT STATE]: {"outputName": "Volume", "challengeType": "predict-direction", "changedVariable": "height", "currentChallengeIndex": 1, "totalChallenges": 3, "predictionLocked": false, "currentInputValue": 10, "targetInputValue": 20, "challengeComplete": false}
First, look at the change you're about to make and predict whether the volume will go up or down. Does increasing the height make more space in the cylinder?

### answer_fish
*expect: turn · turn_ended: True · 9.2s · audio: 499240 b64 bytes*

> [CURRENT STATE]: {"outputName": "Volume", "challengeType": "predict-direction", "changedVariable": "height", "currentChallengeIndex": 1, "totalChallenges": 3, "predictionLocked": false, "currentInputValue": 10, "targetInputValue": 20, "challengeComplete": false}
I can't tell you the answer, but I can help you figure it out. Is the height a multiplier or a divisor in the formula?
