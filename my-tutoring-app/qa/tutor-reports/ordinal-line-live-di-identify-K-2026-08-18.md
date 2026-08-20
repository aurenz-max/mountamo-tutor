# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten"}`
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
| `c1` | voice/name-character | Red Fox | ✅✅ | Brown Bear | ✅✅ |
| `c2` | voice/name-character | Snow Owl | ✅✅ | Penguin | ✅✅ |
| `c3` | voice/name-character | Sea Turtle | ✅✅ | Red Fox | ✅✅ |
| `c4` | voice/name-character | Red Fox | ✅✅ | Sea Turtle | ✅✅ |
| `c5` | voice/name-character | Penguin | ✅✅ | Snow Owl | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 10.8s · audio: 599684 b64 bytes*
*note: voice item (name-character)*

> Hi! Time to line up and count! Look at the line, then say the name of the one I ask for. Start counting at the front of the parade. Who is third?

### wrong:c1
*expect: turn · turn_ended: True · 11.5s · audio: 622084 b64 bytes*
*note: student says "Red Fox" — the off-by-one — one place past the target, the catalog's third recorded struggle*

> My turn: I start at the front of the parade and count — first, second, third. The Brown Bear is third. Your turn. Who is third?

### right:c1
*expect: turn · turn_ended: True · 3.6s · audio: 152324 b64 bytes*
*note: student says "Brown Bear"*

> Yes, the Brown Bear is third.

### ask:c2
*expect: turn · turn_ended: True · 5.2s · audio: 229124 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is first?

### wrong:c2
*expect: turn · turn_ended: True · 9.6s · audio: 520324 b64 bytes*
*note: student says "Snow Owl" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first. The Penguin is first. Your turn. Who is first?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 159364 b64 bytes*
*note: student says "Penguin"*

> Yes, the Penguin is first.

### ask:c3
*expect: turn · turn_ended: True · 5.1s · audio: 231684 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is fourth?

### wrong:c3
*expect: turn · turn_ended: True · 11.9s · audio: 684164 b64 bytes*
*note: student says "Sea Turtle" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second, third, fourth. The Red Fox is fourth. Your turn. Who is fourth?

### right:c3
*expect: turn · turn_ended: True · 4.5s · audio: 163204 b64 bytes*
*note: student says "Red Fox"*

> Yes, the Red Fox is fourth.

### ask:c4
*expect: turn · turn_ended: True · 5.0s · audio: 218244 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is second?

### wrong:c4
*expect: turn · turn_ended: True · 10.6s · audio: 602244 b64 bytes*
*note: student says "Red Fox" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second. The Sea Turtle is second. Your turn. Who is second?

### right:c4
*expect: turn · turn_ended: True · 4.2s · audio: 160004 b64 bytes*
*note: student says "Sea Turtle"*

> Yes, the Sea Turtle is second.

### ask:c5
*expect: turn · turn_ended: True · 5.6s · audio: 259844 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is fifth?

### wrong:c5
*expect: turn · turn_ended: True · 13.4s · audio: 744964 b64 bytes*
*note: student says "Penguin" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second, third, fourth, fifth. The Snow Owl is fifth. Your turn. Who is fifth?

### right:c5
*expect: turn · turn_ended: True · 3.6s · audio: 156804 b64 bytes*
*note: student says "Snow Owl"*

> Yes, the Snow Owl is fifth.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 321284 b64 bytes*

> What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 10.2s · audio: 545924 b64 bytes*
*note: voice item (name-character)*

> Hi! Time to line up and count! Look at the line, then say the name of the one I ask for. Start counting at the front of the parade. Who is third?

### wrong:c1
*expect: turn · turn_ended: True · 11.4s · audio: 636804 b64 bytes*
*note: student says "Red Fox" — the off-by-one — one place past the target, the catalog's third recorded struggle*

> My turn: I start at the front of the parade and count — first, second, third. The Brown Bear is third. Your turn. Who is third?

### right:c1
*expect: turn · turn_ended: True · 3.9s · audio: 132484 b64 bytes*
*note: student says "Brown Bear"*

> Yes, the Brown Bear is third.

### ask:c2
*expect: turn · turn_ended: True · 5.2s · audio: 218884 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is first?

### wrong:c2
*expect: turn · turn_ended: True · 9.5s · audio: 535080 b64 bytes*
*note: student says "Snow Owl" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first. The Penguin is first. Your turn. Who is first?

### right:c2
*expect: turn · turn_ended: True · 4.3s · audio: 126724 b64 bytes*
*note: student says "Penguin"*

> Yes, the Penguin is first.

### ask:c3
*expect: turn · turn_ended: True · 6.7s · audio: 211204 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is fourth?

### wrong:c3
*expect: turn · turn_ended: True · 11.4s · audio: 647044 b64 bytes*
*note: student says "Sea Turtle" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second, third, fourth. The Red Fox is fourth. Your turn. Who is fourth?

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 130564 b64 bytes*
*note: student says "Red Fox"*

> Yes, the Red Fox is fourth.

### ask:c4
*expect: turn · turn_ended: True · 5.0s · audio: 200324 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is second?

### wrong:c4
*expect: turn · turn_ended: True · 10.0s · audio: 560004 b64 bytes*
*note: student says "Red Fox" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second. The Sea Turtle is second. Your turn. Who is second?

### right:c4
*expect: turn · turn_ended: True · 3.8s · audio: 129284 b64 bytes*
*note: student says "Sea Turtle"*

> Yes, the Sea Turtle is second.

### ask:c5
*expect: turn · turn_ended: True · 4.8s · audio: 213764 b64 bytes*
*note: voice item (name-character)*

> Start counting at the front of the parade. Who is fifth?

### wrong:c5
*expect: turn · turn_ended: True · 11.8s · audio: 681604 b64 bytes*
*note: student says "Penguin" — the wrong-end count — the line counted from the back, this primitive's #1 recorded misconception*

> My turn: I start at the front of the parade and count — first, second, third, fourth, fifth. The Snow Owl is fifth. Your turn. Who is fifth?

### right:c5
*expect: turn · turn_ended: True · 3.5s · audio: 129924 b64 bytes*
*note: student says "Snow Owl"*

> Yes, the Snow Owl is fifth.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 298884 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
