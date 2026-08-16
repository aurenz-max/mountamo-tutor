# Tier-3 Live Tutor Report — counting-board — 2026-08-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "counting-board", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "Grade 1"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 0 WARN mechanism(s) confirmed (1 + 0 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c5 1/1 (1 beat) | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/count | three | ✅ | four | ✅ |
| `c2` | voice/count | eight | ✅ | nine | ✅ |
| `c3` | voice/count | seven | ✅ | eight | ✅ |
| `c4` | voice/count | fourteen | ✅ | fifteen | ✅ |
| `c5` | voice/count | eleven | ✅ | twelve | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 11.7s · audio: 654724 b64 bytes*
*note: voice item (count)*

> Hi! Time to count some blocks! Touch each block one time as you count. Then say how many! Count the groups of blocks. Your turn. How many altogether?

### wrong:c1
*expect: turn · turn_ended: True · 9.8s · audio: 544644 b64 bytes*
*note: student says "three"*

> My turn: watch me count. One, two, three, four. Four blocks. Your turn. How many blocks?

### right:c1
*expect: turn · turn_ended: True · 3.3s · audio: 120360 b64 bytes*
*note: student says "four"*

> Yes, four blocks.

### ask:c2
*expect: turn · turn_ended: True · 5.6s · audio: 239364 b64 bytes*
*note: voice item (count)*

> Count the groups of blocks. Your turn. How many altogether?

### wrong:c2
*expect: turn · turn_ended: True · 13.8s · audio: 792964 b64 bytes*
*note: student says "eight"*

> My turn: watch me count. One, two, three, four, five, six, seven, eight, nine. Nine blocks. Your turn. How many blocks?

### right:c2
*expect: turn · turn_ended: True · 4.1s · audio: 114564 b64 bytes*
*note: student says "nine"*

> Yes, nine blocks.

### ask:c3
*expect: turn · turn_ended: True · 5.5s · audio: 250280 b64 bytes*
*note: voice item (count)*

> Count the groups of blocks. Your turn. How many altogether?

### wrong:c3
*expect: turn · turn_ended: True · 13.1s · audio: 742404 b64 bytes*
*note: student says "seven"*

> My turn: watch me count. One, two, three, four, five, six, seven, eight. Eight blocks. Your turn. How many blocks?

### right:c3
*expect: turn · turn_ended: True · 3.9s · audio: 111364 b64 bytes*
*note: student says "eight"*

> Yes, eight blocks.

### ask:c4
*expect: turn · turn_ended: True · 5.5s · audio: 240644 b64 bytes*
*note: voice item (count)*

> Count the groups of blocks. Your turn. How many altogether?

### wrong:c4
*expect: turn · turn_ended: True · 9.2s · audio: 508804 b64 bytes*
*note: student says "fourteen"*

> My turn: there are fifteen blocks — count each one just once and say the last number. Your turn. How many blocks?

### right:c4
*expect: turn · turn_ended: True · 3.3s · audio: 120324 b64 bytes*
*note: student says "fifteen"*

> Yes, fifteen blocks.

### ask:c5
*expect: turn · turn_ended: True · 5.6s · audio: 252840 b64 bytes*
*note: voice item (count)*

> [CURRENT STATE] Where the student is in this activity:
  activity: live direct instruction counting practice
  challengeType: group_count
  objectType: blocks
  stimulus: equal groups of three blocks

Count the groups of blocks. Your turn. How many altogether?

### wrong:c5
*expect: turn · turn_ended: True · 8.8s · audio: 481284 b64 bytes*
*note: student says "eleven"*

> My turn: there are twelve blocks — count each one just once and say the last number. Your turn. How many blocks?

### right:c5
*expect: turn · turn_ended: True · 3.3s · audio: 128040 b64 bytes*
*note: student says "twelve"*

> Yes, twelve blocks.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 376964 b64 bytes*

> What great counting today! Your eyes and your ears did hard work. See you next time!
