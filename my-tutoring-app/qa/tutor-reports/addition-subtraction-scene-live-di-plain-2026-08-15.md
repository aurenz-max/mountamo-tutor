# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-08-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "addition-subtraction-scene", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Grade 1"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:ch1 1/1, wrong3:ch1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:ch1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ch1` | voice/solve | four | ✅✅✅ | - | n/a |
| `ch2` | voice/solve | three | ✅ | four | ✅ |
| `ch3` | voice/solve | seven | ✅ | eight | ✅ |
| `ch4` | voice/solve | seven | ✅ | eight | ✅ |
| `ch5` | voice/solve | three | ✅ | four | ✅ |
| `ch6` | voice/solve | eight | ✅ | nine | ✅ |
| `ch7` | voice/solve | three | ✅ | four | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 47.2s · audio: 829444 b64 bytes*
*note: voice item (solve)*

> Hi! Time for some number stories! Listen to the story, then say your answer out loud. 3 ducks are swimming in the pond. 2 more ducks join them. Your turn. How many ducks are there now?

### wrong1:ch1
*expect: turn · turn_ended: True · 38.3s · audio: 815364 b64 bytes*
*note: student says "four"*

> My turn: three and two. Watch me count. One, two, three, four, five. Five. Your turn. How many ducks are there now?

### wrong2:ch1
*expect: turn · turn_ended: True · 41.1s · audio: 846724 b64 bytes*
*note: student says "four"*

> My turn: three and two. Watch me count. One, two, three, four, five. Five. Your turn. How many ducks are there now?

### wrong3:ch1
*expect: turn · turn_ended: True · 39.2s · audio: 851844 b64 bytes*
*note: student says "four"*

> My turn: three and two. Watch me count. One, two, three, four, five. Five. Your turn. How many ducks are there now?

### moveon:ch1
*expect: turn · turn_ended: True · 45.7s · audio: 650884 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next story. 6 white bunnies are playing in the grass. 2 bunnies hop away. Your turn. How many bunnies are left?

### wrong:ch2
*expect: turn · turn_ended: True · 13.4s · audio: 784004 b64 bytes*
*note: student says "three"*

> My turn: six take away two. Watch me count. One, two, three, four. Four. Your turn. How many bunnies are left?

### right:ch2
*expect: turn · turn_ended: True · 3.3s · audio: 130564 b64 bytes*
*note: student says "four"*

> Yes, four bunnies left.

### ask:ch3
*expect: turn · turn_ended: True · 8.8s · audio: 465924 b64 bytes*
*note: voice item (solve)*

> 4 chocolate cookies are on the tray. You bake 4 more cookies. Your turn. How many cookies are there now?

### wrong:ch3
*expect: turn · turn_ended: True · 16.4s · audio: 972840 b64 bytes*
*note: student says "seven"*

> My turn: four and four. Watch me count. One, two, three, four, five, six, seven, eight. Eight. Your turn. How many cookies are there now?

### right:ch3
*expect: turn · turn_ended: True · 3.4s · audio: 123560 b64 bytes*
*note: student says "eight"*

> Yes, eight cookies now.

### ask:ch4
*expect: turn · turn_ended: True · 11.5s · audio: 613764 b64 bytes*
*note: voice item (solve)*

> Some bright stars shine in the space sky. 3 stars fade away, leaving 5 stars behind. Your turn. How many stars were there at the start?

### wrong:ch4
*expect: turn · turn_ended: True · 8.5s · audio: 471684 b64 bytes*
*note: student says "seven"*

> My turn: work backwards from five, and the start was eight. Your turn. How many stars were there at the start?

### right:ch4
*expect: turn · turn_ended: True · 3.9s · audio: 117124 b64 bytes*
*note: student says "eight"*

> Yes, eight at the start.

### ask:ch5
*expect: turn · turn_ended: True · 9.8s · audio: 530564 b64 bytes*
*note: voice item (solve)*

> 3 red flowers grow in the garden. More flowers bloom until there are 7 flowers total. Your turn. How many flowers came?

### wrong:ch5
*expect: turn · turn_ended: True · 8.3s · audio: 453160 b64 bytes*
*note: student says "three"*

> My turn: it went from three to seven, so four came. Your turn. How many flowers came?

### right:ch5
*expect: turn · turn_ended: True · 3.5s · audio: 144644 b64 bytes*
*note: student says "four"*

> Yes, four came.

### ask:ch6
*expect: turn · turn_ended: True · 9.1s · audio: 478084 b64 bytes*
*note: voice item (solve)*

> 5 little birds sit on the fence. 4 more birds fly over to join them. Your turn. How many birds are there now?

### wrong:ch6
*expect: turn · turn_ended: True · 17.3s · audio: 1007364 b64 bytes*
*note: student says "eight"*

> My turn: five and four. Watch me count. One, two, three, four, five, six, seven, eight, nine. Nine. Your turn. How many birds are there now?

### right:ch6
*expect: turn · turn_ended: True · 3.7s · audio: 140164 b64 bytes*
*note: student says "nine"*

> Yes, nine birds now.

### ask:ch7
*expect: turn · turn_ended: True · 10.2s · audio: 550404 b64 bytes*
*note: voice item (solve)*

> 10 delicious cupcakes are on the table. Some are eaten, leaving 6 cupcakes left. Your turn. How many cupcakes went away?

### wrong:ch7
*expect: turn · turn_ended: True · 9.0s · audio: 465284 b64 bytes*
*note: student says "three"*

> My turn: it went from ten to six, so four went away. Your turn. How many cupcakes went away?

### right:ch7
*expect: turn · turn_ended: True · 3.8s · audio: 144644 b64 bytes*
*note: student says "four"*

> Yes, four went away.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 390404 b64 bytes*

> What great story math today! You listened hard and you did the thinking. See you next time!
