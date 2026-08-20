# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `c1` | voice/name-place | four | ✅✅ | fourth | ✅✅ |
| `c2` | voice/name-place | one | ✅✅ | first | ✅✅ |
| `c3` | voice/name-place | five | ✅✅ | fifth | ✅✅ |
| `c4` | voice/name-place | seven | ✅✅ | seventh | ✅✅ |
| `c5` | voice/name-place | two | ✅✅ | second | ✅✅ |
| `c6` | voice/name-place | three | ✅✅ | third | ✅✅ |
| `c7` | voice/name-place | six | ✅✅ | sixth | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 10.3s · audio: 558120 b64 bytes*
*note: voice item (name-place)*

> Hi! Time to line up and count! Find the one I name, then say its place out loud. Start counting at the engine. What place is the Otter in?

### wrong:c1
*expect: turn · turn_ended: True · 15.4s · audio: 901764 b64 bytes*
*note: student says "four"*

> My turn: I start at the engine and count — one, two, three, four. Four tells how many; fourth tells which one. The Otter is fourth. Your turn. What place is the Otter in?

### right:c1
*expect: turn · turn_ended: True · 3.8s · audio: 128644 b64 bytes*
*note: student says "fourth"*

> Yes, the Otter is fourth.

### ask:c2
*expect: turn · turn_ended: True · 5.2s · audio: 228484 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Penguin in?

### wrong:c2
*expect: turn · turn_ended: True · 13.0s · audio: 737284 b64 bytes*
*note: student says "one"*

> My turn: I start at the engine and count — one. One tells how many; first tells which one. The Penguin is first. Your turn. What place is the Penguin in?

### right:c2
*expect: turn · turn_ended: True · 4.1s · audio: 138244 b64 bytes*
*note: student says "first"*

> Yes, the Penguin is first.

### ask:c3
*expect: turn · turn_ended: True · 5.7s · audio: 218280 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Whale in?

### wrong:c3
*expect: turn · turn_ended: True · 17.0s · audio: 992644 b64 bytes*
*note: student says "five"*

> My turn: I start at the engine and count — one, two, three, four, five. Five tells how many; fifth tells which one. The Whale is fifth. Your turn. What place is the Whale in?

### right:c3
*expect: turn · turn_ended: True · 6.5s · audio: 129320 b64 bytes*
*note: student says "fifth"*

> Yes, the Whale is fifth.

### ask:c4
*expect: turn · turn_ended: True · 5.5s · audio: 220840 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Puffin in?

### wrong:c4
*expect: turn · turn_ended: True · 18.3s · audio: 1084804 b64 bytes*
*note: student says "seven"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven. Seven tells how many; seventh tells which one. The Puffin is seventh. Your turn. What place is the Puffin in?

### right:c4
*expect: turn · turn_ended: True · 4.3s · audio: 138920 b64 bytes*
*note: student says "seventh"*

> Yes, the Puffin is seventh.

### ask:c5
*expect: turn · turn_ended: True · 5.6s · audio: 253444 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Polar Bear in?

### wrong:c5
*expect: turn · turn_ended: True · 13.6s · audio: 782084 b64 bytes*
*note: student says "two"*

> My turn: I start at the engine and count — one, two. Two tells how many; second tells which one. The Polar Bear is second. Your turn. What place is the Polar Bear in?

### right:c5
*expect: turn · turn_ended: True · 4.0s · audio: 169604 b64 bytes*
*note: student says "second"*

> Yes, the Polar Bear is second.

### ask:c6
*expect: turn · turn_ended: True · 5.4s · audio: 241320 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Seal in?

### wrong:c6
*expect: turn · turn_ended: True · 14.5s · audio: 839684 b64 bytes*
*note: student says "three"*

> My turn: I start at the engine and count — one, two, three. Three tells how many; third tells which one. The Seal is third. Your turn. What place is the Seal in?

### right:c6
*expect: turn · turn_ended: True · 4.0s · audio: 147204 b64 bytes*
*note: student says "third"*

> Yes, the Seal is third.

### ask:c7
*expect: turn · turn_ended: True · 5.5s · audio: 245800 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Walrus in?

### wrong:c7
*expect: turn · turn_ended: True · 18.3s · audio: 1082244 b64 bytes*
*note: student says "six"*

> My turn: I start at the engine and count — one, two, three, four, five, six. Six tells how many; sixth tells which one. The Walrus is sixth. Your turn. What place is the Walrus in?

### right:c7
*expect: turn · turn_ended: True · 4.0s · audio: 154244 b64 bytes*
*note: student says "sixth"*

> Yes, the Walrus is sixth.

### complete
*expect: turn · turn_ended: True · 6.6s · audio: 319400 b64 bytes*

> What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 10.3s · audio: 564484 b64 bytes*
*note: voice item (name-place)*

> Hi! Time to line up and count! Find the one I name, then say its place out loud. Start counting at the engine. What place is the Otter in?

### wrong:c1
*expect: turn · turn_ended: True · 14.7s · audio: 856324 b64 bytes*
*note: student says "four"*

> My turn: I start at the engine and count — one, two, three, four. Four tells how many; fourth tells which one. The Otter is fourth. Your turn. What place is the Otter in?

### right:c1
*expect: turn · turn_ended: True · 3.9s · audio: 128644 b64 bytes*
*note: student says "fourth"*

> Yes, the Otter is fourth.

### ask:c2
*expect: turn · turn_ended: True · 5.0s · audio: 228484 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Penguin in?

### wrong:c2
*expect: turn · turn_ended: True · 12.3s · audio: 696324 b64 bytes*
*note: student says "one"*

> My turn: I start at the engine and count — one. One tells how many; first tells which one. The Penguin is first. Your turn. What place is the Penguin in?

### right:c2
*expect: turn · turn_ended: True · 4.6s · audio: 137604 b64 bytes*
*note: student says "first"*

> Yes, the Penguin is first.

### ask:c3
*expect: turn · turn_ended: True · 5.5s · audio: 212484 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Whale in?

### wrong:c3
*expect: turn · turn_ended: True · 15.4s · audio: 901124 b64 bytes*
*note: student says "five"*

> My turn: I start at the engine and count — one, two, three, four, five. Five tells how many; fifth tells which one. The Whale is fifth. Your turn. What place is the Whale in?

### right:c3
*expect: turn · turn_ended: True · 3.5s · audio: 125444 b64 bytes*
*note: student says "fifth"*

> Yes, the Whale is fifth.

### ask:c4
*expect: turn · turn_ended: True · 5.3s · audio: 225924 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Puffin in?

### wrong:c4
*expect: turn · turn_ended: True · 16.4s · audio: 965128 b64 bytes*
*note: student says "seven"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven. Seven tells how many; seventh tells which one. The Puffin is seventh. Your turn. What place is the Puffin in?

### right:c4
*expect: turn · turn_ended: True · 3.2s · audio: 131844 b64 bytes*
*note: student says "seventh"*

> Yes, the Puffin is seventh.

### ask:c5
*expect: turn · turn_ended: True · 5.1s · audio: 235560 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Polar Bear in?

### wrong:c5
*expect: turn · turn_ended: True · 13.6s · audio: 760324 b64 bytes*
*note: student says "two"*

> My turn: I start at the engine and count — one, two. Two tells how many; second tells which one. The Polar Bear is second. Your turn. What place is the Polar Bear in?

### right:c5
*expect: turn · turn_ended: True · 3.8s · audio: 161284 b64 bytes*
*note: student says "second"*

> Yes, the Polar Bear is second.

### ask:c6
*expect: turn · turn_ended: True · 5.5s · audio: 229124 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Seal in?

### wrong:c6
*expect: turn · turn_ended: True · 13.6s · audio: 777604 b64 bytes*
*note: student says "three"*

> My turn: I start at the engine and count — one, two, three. Three tells how many; third tells which one. The Seal is third. Your turn. What place is the Seal in?

### right:c6
*expect: turn · turn_ended: True · 3.6s · audio: 145284 b64 bytes*
*note: student says "third"*

> Yes, the Seal is third.

### ask:c7
*expect: turn · turn_ended: True · 5.7s · audio: 236804 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Walrus in?

### wrong:c7
*expect: turn · turn_ended: True · 15.5s · audio: 918404 b64 bytes*
*note: student says "six"*

> My turn: I start at the engine and count — one, two, three, four, five, six. Six tells how many; sixth tells which one. The Walrus is sixth. Your turn. What place is the Walrus in?

### right:c7
*expect: turn · turn_ended: True · 3.5s · audio: 148484 b64 bytes*
*note: student says "sixth"*

> Yes, the Walrus is sixth.

### complete
*expect: turn · turn_ended: True · 6.0s · audio: 305284 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
