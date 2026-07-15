# Tier-3 Live Tutor Report — letter-sound-link — 2026-07-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"letterGroup": 1, "challenges": 6, "mode0": "see-hear", "letter0": "S", "sound0": "/s/", "keyword0": "sun", "mode1": "see-hear", "letter1": "A", "keyword1": "apple"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 28.37 | 0.0 | 0.0 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.2s · audio: 533160 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hello there! I'm ready to learn along with you today. Tap a bubble to hear a sound, and when you find the one that makes /s/, tap it again to keep it!

### activity_start
*expect: turn · turn_ended: True · 13.3s · audio: 805124 b64 bytes*
*note: ORIENT+STIMULUS: the HOW-TO-PLAY directive must voice a tap/listen action (the protocol a non-reader can't read) AND say the keyword aloud*

> Wow, we're going to learn about the sounds that letters make! For this first challenge, the letter S makes the sound /s/ as in sun. Tap a bubble to hear it, and when you find the one that makes /s/, tap it again!

### answer_correct
*expect: turn · turn_ended: True · 5.3s · audio: 289924 b64 bytes*
*note: production beat: after celebrating, invite the child to say the keyword (THEIR TURN directive — "Now YOU say {keyword}")*

> Yes! The letter S makes the sound /s/! Now YOU say sun!

### next_challenge
*expect: turn · turn_ended: True · 11.5s · audio: 659204 b64 bytes*
*note: ORIENT on advance: the how-to-play protocol + keyword must be enacted for the next challenge too (survives the one-sentence cap)*

> Great job, you're racing right through! Now we have a new letter, and it makes the sound /ă/ as in apple. Tap a bubble, and when you hear /ă/, tap it again!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 12.0s · audio: 703364 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hi there! I'm so happy you're here to learn letter sounds with me. Let's get started with your challenge!

Tap a bubble to hear it. When you find the one that makes /s/, tap it again to keep it!

### activity_start
*expect: turn · turn_ended: True · 11.7s · audio: 637444 b64 bytes*
*note: ORIENT+STIMULUS: the HOW-TO-PLAY directive must voice a tap/listen action (the protocol a non-reader can't read) AND say the keyword aloud*

> We're going to learn the SOUNDS that letters make! Tap a bubble to hear it, and when you find the one that makes /s/, like in "sun," tap it again! /s/ as in sun.

### answer_correct
*expect: turn · turn_ended: True · 5.6s · audio: 305284 b64 bytes*
*note: production beat: after celebrating, invite the child to say the keyword (THEIR TURN directive — "Now YOU say {keyword}")*

> Yes! The letter S makes the sound /s/! Now YOU say sun!

### next_challenge
*expect: turn · turn_ended: True · 9.0s · audio: 499240 b64 bytes*
*note: ORIENT on advance: the how-to-play protocol + keyword must be enacted for the next challenge too (survives the one-sentence cap)*

> You're doing great! Now, listen for the sound /ă/, like in "apple." Tap a bubble to find it! /ă/ as in apple.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 13.2s · audio: 788484 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hi there! I'm ready to help you listen to some letter sounds today. This first game is going to help you become a super reader.

Tap a bubble to hear it. When you find the one that makes /s/, tap it again to keep it!

### activity_start
*expect: turn · turn_ended: True · 10.1s · audio: 599684 b64 bytes*
*note: ORIENT+STIMULUS: the HOW-TO-PLAY directive must voice a tap/listen action (the protocol a non-reader can't read) AND say the keyword aloud*

> Welcome! We're going to listen to the sounds that letters make.

Tap a bubble to hear it. When you find the one that makes /s/, like in sun, tap it again!

### answer_correct
*expect: turn · turn_ended: True · 5.4s · audio: 302724 b64 bytes*
*note: production beat: after celebrating, invite the child to say the keyword (THEIR TURN directive — "Now YOU say {keyword}")*

> Yes! The letter S makes the sound /s/!

Now YOU say sun!

### next_challenge
*expect: turn · turn_ended: True · 9.0s · audio: 510760 b64 bytes*
*note: ORIENT on advance: the how-to-play protocol + keyword must be enacted for the next challenge too (survives the one-sentence cap)*

> Great job! Now, let's try another one. Tap the bubbles to find the sound that matches the letter at the top, like /ă/ as in apple.
