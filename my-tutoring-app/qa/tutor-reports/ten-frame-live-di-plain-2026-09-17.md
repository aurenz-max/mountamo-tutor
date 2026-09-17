# Tier-3 Live Tutor Report — ten-frame — 2026-09-17

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ten-frame", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "undrivable_items": []}`
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
| `c1` | voice/complement | six | ✅✅✅ | five | ✅✅✅ |
| `c2` | voice/complement | five | ✅✅✅ | four | ✅✅✅ |
| `c3` | voice/complement | seven | ✅✅✅ | six | ✅✅✅ |
| `c4` | voice/complement | four | ✅✅✅ | three | ✅✅✅ |
| `c5` | voice/complement | eight | ✅✅✅ | seven | ✅✅✅ |
| `c6` | voice/complement | three | ✅✅✅ | two | ✅✅✅ |
| `c7` | voice/complement | ten | ✅✅✅ | nine | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 14.6s · audio: 798720 b64 bytes*
*note: voice item (complement)*

> Hi! Time to work with the ten frame! Some counters are already there. Then say how many MORE counters fill the frame. There are five counters on the frame. Your turn. How many more counters make ten?

### wrong:c1
*expect: turn · turn_ended: True · 8.4s · audio: 458884 b64 bytes*
*note: student says "six"*

> My turn: five and five make ten. Five more. Your turn. How many more counters make ten?

### right:c1
*expect: turn · turn_ended: True · 3.5s · audio: 107520 b64 bytes*
*note: student says "five"*

> Yes, five more.

### ask:c2
*expect: turn · turn_ended: True · 6.9s · audio: 335360 b64 bytes*
*note: voice item (complement)*

> There are six counters on the frame. Your turn. How many more counters make ten?

### wrong:c2
*expect: turn · turn_ended: True · 8.3s · audio: 440324 b64 bytes*
*note: student says "five"*

> My turn: six and four make ten. Four more. Your turn. How many more counters make ten?

### right:c2
*expect: turn · turn_ended: True · 3.3s · audio: 95360 b64 bytes*
*note: student says "four"*

> Yes, four more.

### ask:c3
*expect: turn · turn_ended: True · 6.8s · audio: 335360 b64 bytes*
*note: voice item (complement)*

> There are four counters on the frame. Your turn. How many more counters make ten?

### wrong:c3
*expect: turn · turn_ended: True · 8.0s · audio: 439684 b64 bytes*
*note: student says "seven"*

> My turn: four and six make ten. Six more. Your turn. How many more counters make ten?

### right:c3
*expect: turn · turn_ended: True · 3.1s · audio: 107520 b64 bytes*
*note: student says "six"*

> Yes, six more.

### ask:c4
*expect: turn · turn_ended: True · 7.0s · audio: 355204 b64 bytes*
*note: voice item (complement)*

> There are seven counters on the frame. Your turn. How many more counters make ten?

### wrong:c4
*expect: turn · turn_ended: True · 8.4s · audio: 444804 b64 bytes*
*note: student says "four"*

> My turn: seven and three make ten. Three more. Your turn. How many more counters make ten?

### right:c4
*expect: turn · turn_ended: True · 3.0s · audio: 103044 b64 bytes*
*note: student says "three"*

> Yes, three more.

### ask:c5
*expect: turn · turn_ended: True · 7.4s · audio: 371204 b64 bytes*
*note: voice item (complement)*

> There are three counters on the frame. Your turn. How many more counters make ten?

### wrong:c5
*expect: turn · turn_ended: True · 8.2s · audio: 451844 b64 bytes*
*note: student says "eight"*

> My turn: three and seven make ten. Seven more. Your turn. How many more counters make ten?

### right:c5
*expect: turn · turn_ended: True · 3.3s · audio: 106884 b64 bytes*
*note: student says "seven"*

> Yes, seven more.

### ask:c6
*expect: turn · turn_ended: True · 6.8s · audio: 340484 b64 bytes*
*note: voice item (complement)*

> There are eight counters on the frame. Your turn. How many more counters make ten?

### wrong:c6
*expect: turn · turn_ended: True · 7.8s · audio: 417924 b64 bytes*
*note: student says "three"*

> My turn: eight and two make ten. Two more. Your turn. How many more counters make ten?

### right:c6
*expect: turn · turn_ended: True · 3.3s · audio: 96644 b64 bytes*
*note: student says "two"*

> Yes, two more.

### ask:c7
*expect: turn · turn_ended: True · 6.7s · audio: 339844 b64 bytes*
*note: voice item (complement)*

> There are one counter on the frame. Your turn. How many more counters make ten?

### wrong:c7
*expect: turn · turn_ended: True · 8.8s · audio: 456320 b64 bytes*
*note: student says "ten"*

> My turn: one and nine make ten. Nine more. Your turn. How many more counters make ten?

### right:c7
*expect: turn · turn_ended: True · 3.2s · audio: 112644 b64 bytes*
*note: student says "nine"*

> Yes, nine more.

### complete
*expect: turn · turn_ended: True · 7.9s · audio: 409604 b64 bytes*

> What great number work today! Your eyes and your hands did hard thinking. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 16.2s · audio: 915840 b64 bytes*
*note: voice item (complement)*

> Hi! Time to work with the ten frame! Some counters are already there. Then say how many MORE counters fill the frame. There are five counters on the frame. Your turn. How many more counters make ten?

### wrong:c1
*expect: turn · turn_ended: True · 9.4s · audio: 515844 b64 bytes*
*note: student says "six"*

> My turn: five and five make ten. Five more. Your turn. How many more counters make ten?

### right:c1
*expect: turn · turn_ended: True · 3.9s · audio: 130560 b64 bytes*
*note: student says "five"*

> Yes, five more.

### ask:c2
*expect: turn · turn_ended: True · 7.7s · audio: 387844 b64 bytes*
*note: voice item (complement)*

> There are six counters on the frame. Your turn. How many more counters make ten?

### wrong:c2
*expect: turn · turn_ended: True · 8.6s · audio: 460800 b64 bytes*
*note: student says "five"*

> My turn: six and four make ten. Four more. Your turn. How many more counters make ten?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 112000 b64 bytes*
*note: student says "four"*

> Yes, four more.

### ask:c3
*expect: turn · turn_ended: True · 7.6s · audio: 378244 b64 bytes*
*note: voice item (complement)*

> There are four counters on the frame. Your turn. How many more counters make ten?

### wrong:c3
*expect: turn · turn_ended: True · 8.6s · audio: 453124 b64 bytes*
*note: student says "seven"*

> My turn: four and six make ten. Six more. Your turn. How many more counters make ten?

### right:c3
*expect: turn · turn_ended: True · 3.7s · audio: 119684 b64 bytes*
*note: student says "six"*

> Yes, six more.

### ask:c4
*expect: turn · turn_ended: True · 7.3s · audio: 366084 b64 bytes*
*note: voice item (complement)*

> There are seven counters on the frame. Your turn. How many more counters make ten?

### wrong:c4
*expect: turn · turn_ended: True · 8.9s · audio: 457600 b64 bytes*
*note: student says "four"*

> My turn: seven and three make ten. Three more. Your turn. How many more counters make ten?

### right:c4
*expect: turn · turn_ended: True · 3.4s · audio: 117120 b64 bytes*
*note: student says "three"*

> Yes, three more.

### ask:c5
*expect: turn · turn_ended: True · 7.8s · audio: 368644 b64 bytes*
*note: voice item (complement)*

> There are three counters on the frame. Your turn. How many more counters make ten?

### wrong:c5
*expect: turn · turn_ended: True · 9.0s · audio: 473604 b64 bytes*
*note: student says "eight"*

> My turn: three and seven make ten. Seven more. Your turn. How many more counters make ten?

### right:c5
*expect: turn · turn_ended: True · 3.8s · audio: 126084 b64 bytes*
*note: student says "seven"*

> Yes, seven more.

### ask:c6
*expect: turn · turn_ended: True · 7.4s · audio: 364800 b64 bytes*
*note: voice item (complement)*

> There are eight counters on the frame. Your turn. How many more counters make ten?

### wrong:c6
*expect: turn · turn_ended: True · 8.5s · audio: 456324 b64 bytes*
*note: student says "three"*

> My turn: eight and two make ten. Two more. Your turn. How many more counters make ten?

### right:c6
*expect: turn · turn_ended: True · 3.8s · audio: 115200 b64 bytes*
*note: student says "two"*

> Yes, two more.

### ask:c7
*expect: turn · turn_ended: True · 7.5s · audio: 364160 b64 bytes*
*note: voice item (complement)*

> There are one counter on the frame. Your turn. How many more counters make ten?

### wrong:c7
*expect: turn · turn_ended: True · 9.0s · audio: 481284 b64 bytes*
*note: student says "ten"*

> My turn: one and nine make ten. Nine more. Your turn. How many more counters make ten?

### right:c7
*expect: turn · turn_ended: True · 3.4s · audio: 126080 b64 bytes*
*note: student says "nine"*

> Yes, nine more.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 394244 b64 bytes*

> What great number work today! Your eyes and your hands did hard thinking. See you next time!


## Run 3 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 14.8s · audio: 843520 b64 bytes*
*note: voice item (complement)*

> Hi! Time to work with the ten frame! Some counters are already there. Then say how many MORE counters fill the frame. There are five counters on the frame. Your turn. How many more counters make ten?

### wrong:c1
*expect: turn · turn_ended: True · 8.9s · audio: 496644 b64 bytes*
*note: student says "six"*

> My turn: five and five make ten. Five more. Your turn. How many more counters make ten?

### right:c1
*expect: turn · turn_ended: True · 3.5s · audio: 120964 b64 bytes*
*note: student says "five"*

> Yes, five more.

### ask:c2
*expect: turn · turn_ended: True · 6.8s · audio: 352644 b64 bytes*
*note: voice item (complement)*

> There are six counters on the frame. Your turn. How many more counters make ten?

### wrong:c2
*expect: turn · turn_ended: True · 8.6s · audio: 468484 b64 bytes*
*note: student says "five"*

> My turn: six and four make ten. Four more. Your turn. How many more counters make ten?

### right:c2
*expect: turn · turn_ended: True · 3.3s · audio: 120324 b64 bytes*
*note: student says "four"*

> Yes, four more.

### ask:c3
*expect: turn · turn_ended: True · 7.2s · audio: 360964 b64 bytes*
*note: voice item (complement)*

> There are four counters on the frame. Your turn. How many more counters make ten?

### wrong:c3
*expect: turn · turn_ended: True · 8.6s · audio: 469124 b64 bytes*
*note: student says "seven"*

> My turn: four and six make ten. Six more. Your turn. How many more counters make ten?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 112640 b64 bytes*
*note: student says "six"*

> Yes, six more.

### ask:c4
*expect: turn · turn_ended: True · 7.5s · audio: 365444 b64 bytes*
*note: voice item (complement)*

> There are seven counters on the frame. Your turn. How many more counters make ten?

### wrong:c4
*expect: turn · turn_ended: True · 8.4s · audio: 458880 b64 bytes*
*note: student says "four"*

> My turn: seven and three make ten. Three more. Your turn. How many more counters make ten?

### right:c4
*expect: turn · turn_ended: True · 3.2s · audio: 112004 b64 bytes*
*note: student says "three"*

> Yes, three more.

### ask:c5
*expect: turn · turn_ended: True · 7.6s · audio: 365444 b64 bytes*
*note: voice item (complement)*

> There are three counters on the frame. Your turn. How many more counters make ten?

### wrong:c5
*expect: turn · turn_ended: True · 8.6s · audio: 467204 b64 bytes*
*note: student says "eight"*

> My turn: three and seven make ten. Seven more. Your turn. How many more counters make ten?

### right:c5
*expect: turn · turn_ended: True · 3.3s · audio: 119684 b64 bytes*
*note: student says "seven"*

> Yes, seven more.

### ask:c6
*expect: turn · turn_ended: True · 6.8s · audio: 337924 b64 bytes*
*note: voice item (complement)*

> There are eight counters on the frame. Your turn. How many more counters make ten?

### wrong:c6
*expect: turn · turn_ended: True · 8.3s · audio: 444160 b64 bytes*
*note: student says "three"*

> My turn: eight and two make ten. Two more. Your turn. How many more counters make ten?

### right:c6
*expect: turn · turn_ended: True · 3.4s · audio: 104324 b64 bytes*
*note: student says "two"*

> Yes, two more.

### ask:c7
*expect: turn · turn_ended: True · 7.3s · audio: 360324 b64 bytes*
*note: voice item (complement)*

> There are one counter on the frame. Your turn. How many more counters make ten?

### wrong:c7
*expect: turn · turn_ended: True · 8.8s · audio: 476164 b64 bytes*
*note: student says "ten"*

> My turn: one and nine make ten. Nine more. Your turn. How many more counters make ten?

### right:c7
*expect: turn · turn_ended: True · 3.5s · audio: 115204 b64 bytes*
*note: student says "nine"*

> Yes, nine more.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 394244 b64 bytes*

> What great number work today! Your eyes and your hands did hard thinking. See you next time!
