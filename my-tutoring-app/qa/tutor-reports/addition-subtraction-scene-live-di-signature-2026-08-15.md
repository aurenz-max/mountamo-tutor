# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-08-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "addition-subtraction-scene", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "Grade 1"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Findings

None.

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ch1` | voice/solve | three | ✅ | five | ✅ |
| `ch2` | voice/solve | six | ✅ | four | ✅ |
| `ch3` | voice/solve | four | ✅ | eight | ✅ |
| `ch4` | voice/solve | nine | ✅ | six | ✅ |
| `ch5` | voice/solve | three | ✅ | four | ✅ |
| `ch6` | voice/solve | eight | ✅ | three | ✅ |
| `ch7` | voice/solve | five | ✅ | nine | ✅ |
| `ch8` | voice/solve | ten | ✅ | six | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 13.6s · audio: 774404 b64 bytes*
*note: voice item (solve)*

> Hi! Time for some number stories! Listen to the story, then say your answer out loud. 3 ducks are swimming in the pond. 2 more ducks join them. Your turn. How many ducks are there now?

### wrong:ch1
*expect: turn · turn_ended: True · 12.0s · audio: 688680 b64 bytes*
*note: student says "three" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: three and two. Watch me count. One, two, three, four, five. Five. Your turn. How many ducks are there now?

### right:ch1
*expect: turn · turn_ended: True · 3.5s · audio: 126120 b64 bytes*
*note: student says "five"*

> Yes, five ducks now.

### ask:ch2
*expect: turn · turn_ended: True · 8.4s · audio: 436484 b64 bytes*
*note: voice item (solve)*

> 6 red flowers are growing in the garden. 2 flowers are picked. Your turn. How many flowers are left?

### wrong:ch2
*expect: turn · turn_ended: True · 11.9s · audio: 675844 b64 bytes*
*note: student says "six" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: six take away two. Watch me count. One, two, three, four. Four. Your turn. How many flowers are left?

### right:ch2
*expect: turn · turn_ended: True · 3.3s · audio: 129924 b64 bytes*
*note: student says "four"*

> Yes, four flowers left.

### ask:ch3
*expect: turn · turn_ended: True · 9.0s · audio: 471080 b64 bytes*
*note: voice item (solve)*

> 4 red apples are on the table. 4 green apples are added to the plate. Your turn. How many apples are there now?

### wrong:ch3
*expect: turn · turn_ended: True · 15.2s · audio: 856964 b64 bytes*
*note: student says "four" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: four and four. Watch me count. One, two, three, four, five, six, seven, eight. Eight. Your turn. How many apples are there now?

### right:ch3
*expect: turn · turn_ended: True · 3.8s · audio: 120324 b64 bytes*
*note: student says "eight"*

> Yes, eight apples now.

### ask:ch4
*expect: turn · turn_ended: True · 8.4s · audio: 439684 b64 bytes*
*note: voice item (solve)*

> 9 rockets are waiting on the launchpad. 3 rockets stay behind. Your turn. How many rockets are left?

### wrong:ch4
*expect: turn · turn_ended: True · 13.8s · audio: 799364 b64 bytes*
*note: student says "nine" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: nine take away three. Watch me count. One, two, three, four, five, six. Six. Your turn. How many rockets are left?

### right:ch4
*expect: turn · turn_ended: True · 3.5s · audio: 142120 b64 bytes*
*note: student says "six"*

> Yes, six rockets left.

### ask:ch5
*expect: turn · turn_ended: True · 11.5s · audio: 627204 b64 bytes*
*note: voice item (solve)*

> Some butterflies are resting on the leaves. 3 more butterflies fly in, making a total of 7 butterflies. Your turn. How many butterflies were there at the start?

### wrong:ch5
*expect: turn · turn_ended: True · 9.2s · audio: 503044 b64 bytes*
*note: student says "three" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: work backwards from seven, and the start was four. Your turn. How many butterflies were there at the start?

### right:ch5
*expect: turn · turn_ended: True · 4.3s · audio: 136324 b64 bytes*
*note: student says "four"*

> Yes, four at the start.

### ask:ch6
*expect: turn · turn_ended: True · 9.7s · audio: 519044 b64 bytes*
*note: voice item (solve)*

> 8 bunnies are playing in the grass. Some bunnies hop away, leaving 5 bunnies behind. Your turn. How many bunnies went away?

### wrong:ch6
*expect: turn · turn_ended: True · 8.8s · audio: 472964 b64 bytes*
*note: student says "eight" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: it went from eight to five, so three went away. Your turn. How many bunnies went away?

### right:ch6
*expect: turn · turn_ended: True · 4.0s · audio: 144644 b64 bytes*
*note: student says "three"*

> Yes, three went away.

### ask:ch7
*expect: turn · turn_ended: True · 9.7s · audio: 521604 b64 bytes*
*note: voice item (solve)*

> 5 chocolate chip cookies are cooling on the tray. 4 more cookies are taken out of the oven. Your turn. How many cookies are there now?

### wrong:ch7
*expect: turn · turn_ended: True · 47.4s · audio: 919044 b64 bytes*
*note: student says "five" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: five and four. Watch me count. One, two, three, four, five, six, seven, eight, nine. Nine. Your turn. How many cookies are there now?

### right:ch7
*expect: turn · turn_ended: True · 3.7s · audio: 149160 b64 bytes*
*note: student says "nine"*

> Yes, nine cookies now.

### ask:ch8
*expect: turn · turn_ended: True · 9.1s · audio: 480004 b64 bytes*
*note: voice item (solve)*

> 10 stars are shining bright. 4 stars fade behind a cloud. Your turn. How many stars are left?

### wrong:ch8
*expect: turn · turn_ended: True · 14.2s · audio: 823684 b64 bytes*
*note: student says "ten" — an operand the story states out loud, said back — the contract names it as NOT the answer*

> My turn: ten take away four. Watch me count. One, two, three, four, five, six. Six. Your turn. How many stars are left?

### right:ch8
*expect: turn · turn_ended: True · 3.8s · audio: 160040 b64 bytes*
*note: student says "six"*

> Yes, six stars left.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 375044 b64 bytes*

> What great story math today! You listened hard and you did the thinking. See you next time!
