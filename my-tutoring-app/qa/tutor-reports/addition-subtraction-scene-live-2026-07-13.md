# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-07-13

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeBand": "K", "challenges": 4, "story0": "There are 2 ducks swimming. 1 more duck joins them.", "story1": "There are 4 cookies on the tray. 2 cookies are eaten."}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 23.3 | 0.67 | 0.25 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.4s · audio: 403844 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hi there! I'm excited to work through these story problems with you. Let's get started making your ducks swim!

### activity_start
*expect: turn · turn_ended: True · 10.4s · audio: 616964 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks! There are 2 ducks swimming. 1 more duck joins them. Can you show me that story by dragging 2 ducks into the pond?

### student_stuck
*expect: turn · turn_ended: True · 4.8s · audio: 258564 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What happened in the story? Did the ducks come or go away?

### next_story
*expect: turn · turn_ended: True · 12.1s · audio: 733480 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Great job telling that story! Now, let's try another one: There are 4 cookies on the tray. 2 cookies are eaten. Can you put 4 cookies on the tray, and then take 2 away?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.5s · audio: 362244 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hi there! I'm excited to help you with these ducks today. Let's get them swimming in the pond!

### activity_start
*expect: turn · turn_ended: True · 9.4s · audio: 558760 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks! There are 2 ducks swimming. 1 more duck joins them. Can you put 2 ducks in the pond?

### student_stuck
*expect: turn · turn_ended: True · 5.5s · audio: 307240 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What's happening in our story? Are the ducks coming or going away?

### next_story
*expect: turn · turn_ended: True · 11.7s · audio: 711080 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Great job with those ducks!

Now, there are 4 cookies on the tray. 2 cookies are eaten. Let's act that out and see how many are left! Can you put 4 cookies on the tray?


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.3s · audio: 345604 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hi there! I'm so excited to work with you on these duck puzzles. Let's have some fun with math!

### activity_start
*expect: turn · turn_ended: True · 10.2s · audio: 618280 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with ducks! There are 2 ducks swimming, and 1 more duck joins them. Can you drag 2 ducks into the pond, and then add 1 more?

### student_stuck
*expect: turn · turn_ended: True · 4.7s · audio: 255364 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What's happening in our story? Did the ducks come or go away?

### next_story
*expect: turn · turn_ended: True · 11.0s · audio: 660520 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Great job with those ducks! Now there are 4 cookies on the tray, but 2 cookies are eaten. Let's put 4 cookies on the tray, and then take 2 away to see how many are left!
