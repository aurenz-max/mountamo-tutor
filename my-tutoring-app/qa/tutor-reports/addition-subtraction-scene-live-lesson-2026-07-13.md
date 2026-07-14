# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-07-13

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeBand": "K", "challenges": 4, "story0": "There are 2 flowers in the garden. 1 more flower grows. How many are there in total?", "story1": "4 butterflies are resting on a leaf. 2 butterflies fly away. How many are left?"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 32.73 | 0.25 | 0.25 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 16.2s · audio: 971524 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Welcome to the lesson, I'm here to help you practice adding within 5! There are 2 flowers in the garden. 1 more flower grows. How many are there in total? Drag 2 flowers into the garden, then add 1 more to see how many there are!

### activity_start
*expect: turn · turn_ended: True · 13.5s · audio: 816004 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with flowers! "There are 2 flowers in the garden. 1 more flower grows. How many are there in total?" Drag 2 flowers into the garden, then add 1 more to see how many there are!

### student_stuck
*expect: turn · turn_ended: True · 6.0s · audio: 276484 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What happened in the story? Did the flowers come or go away?

### next_story
*expect: turn · turn_ended: True · 15.8s · audio: 953640 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> You're doing great! Now, let's try this one: "4 butterflies are resting on a leaf. 2 butterflies fly away. How many are left?" Drag 4 butterflies onto the leaf, then take 2 away to see how many are left!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 14.4s · audio: 864644 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hey there, learner! I'm so excited to practice with you today. There are 2 flowers in the garden. 1 more flower grows. How many are there in total? Drag 2 flowers into the garden, then add 1 more to see how many there are!

### activity_start
*expect: turn · turn_ended: True · 12.6s · audio: 763524 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with flowers! There are 2 flowers in the garden. 1 more flower grows. How many are there in total? Drag 2 flowers into the garden, then add 1 more to see how many there are!

### student_stuck
*expect: turn · turn_ended: True · 5.4s · audio: 272644 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What happened in the story? Did the flowers come or go away?

### next_story
*expect: turn · turn_ended: True · 13.2s · audio: 792964 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Oh look, we have some butterflies now! 4 butterflies are resting on a leaf. 2 butterflies fly away. How many are left? Drag 4 butterflies onto the leaf, then make 2 fly away!


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 16.6s · audio: 1000964 b64 bytes*
*note: server auto-queues the standalone greeting on auth*

> Hi there! I'm so excited to learn with you today. Let's get started!

"There are 2 flowers in the garden. 1 more flower grows. How many are there in total?"

Drag 2 flowers into the garden, then add 1 more to see how many there are!

### activity_start
*expect: turn · turn_ended: True · 13.2s · audio: 805160 b64 bytes*
*note: STIMULUS: a non-reader needs the whole story READ ALOUD here, not just a 'let's do a story' intro*

> Let's tell a story with flowers!

"There are 2 flowers in the garden. 1 more flower grows. How many are there in total?"

Drag 2 flowers into the garden, then add 1 more to see how many there are!

### student_stuck
*expect: turn · turn_ended: True · 5.2s · audio: 274564 b64 bytes*
*note: ORIENT: does the tutor restate, in child terms, what to do?*

> What happened in the story? Did the flowers come or go away?

### next_story
*expect: turn · turn_ended: True · 13.9s · audio: 832004 b64 bytes*
*note: STIMULUS on advance: the second story must be read aloud too*

> Look, a new friend!

"4 butterflies are resting on a leaf. 2 butterflies fly away. How many are left?"

Try dragging 4 butterflies onto the leaf, and then make 2 fly away!
