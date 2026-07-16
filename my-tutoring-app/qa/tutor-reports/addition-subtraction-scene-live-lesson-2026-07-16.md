# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-07-16

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeBand": "K", "challenges": 4, "story0": "3 ducks are swimming. 2 more ducks join them.", "story1": "There are 4 cookies on the tray. 2 cookies are eaten."}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 23.4 | 0.25 | 0.25 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.9s · audio: 574760 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hi there! I'm so excited to help you learn. Let's start! "3 ducks are swimming. 2 more ducks join them."

Tap to bring 2 more ducks in!

### activity_start
*expect: turn · turn_ended: True · 7.6s · audio: 447400 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks! 3 ducks are swimming. 2 more ducks join them.

Tap to bring 2 more ducks in!

### student_stuck
*expect: turn · turn_ended: True · 4.5s · audio: 250884 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What happened in the story? Did the ducks come or go away?

### next_story
*expect: turn · turn_ended: True · 8.2s · audio: 458244 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> New story time! "There are 4 cookies on the tray. 2 cookies are eaten."

Now, tap to take 2 cookies away.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.1s · audio: 567044 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Welcome to Lumina, I'm so glad to help you learn today!

"3 ducks are swimming. 2 more ducks join them." Tap to bring 2 more ducks in!

### activity_start
*expect: turn · turn_ended: True · 8.3s · audio: 479400 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks!

"3 ducks are swimming. 2 more ducks join them."

Tap to bring 2 more ducks in!

### student_stuck
*expect: turn · turn_ended: True · 6.6s · audio: 378244 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> Remember, you can tap the ducks to bring them into the pond. Try bringing 2 more ducks to join them!

### next_story
*expect: turn · turn_ended: True · 8.5s · audio: 500484 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Now we have a new story!

"There are 4 cookies on the tray. 2 cookies are eaten."

Tap to show 2 cookies being eaten!


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 12.7s · audio: 758404 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hey there! I'm so excited to practice adding and subtracting with you today. Let's start with this story: 3 ducks are swimming. 2 more ducks join them. Tap to bring 2 more ducks in!

### activity_start
*expect: turn · turn_ended: True · 8.5s · audio: 509444 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks! 3 ducks are swimming. 2 more ducks join them. Tap to bring 2 more ducks in!

### student_stuck
*expect: turn · turn_ended: True · 8.2s · audio: 480644 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> Need some help getting those ducks into the pond? Try tapping on the screen where you'd like them to appear. How many more ducks do we need?

### next_story
*expect: turn · turn_ended: True · 9.3s · audio: 555560 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Ready for another story? There are 4 cookies on the tray. 2 cookies are eaten. Can you tap to make 2 cookies disappear?
