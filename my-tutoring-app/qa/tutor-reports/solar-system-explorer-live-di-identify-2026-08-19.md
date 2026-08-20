# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `ssc-1` | voice/name-planet | Venus | ✅ | Mercury | ✅ |
| `ssc-2` | voice/name-planet | Mars | ✅ | Earth | ✅ |
| `ssc-3` | voice/name-planet | Jupiter | ✅ | Mars | ✅ |
| `ssc-4` | voice/name-planet | Saturn | ✅ | Jupiter | ✅ |
| `ssc-5` | voice/name-planet | Uranus | ✅ | Saturn | ✅ |
| `ssc-6` | voice/name-planet | Uranus | ✅ | Neptune | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 12.0s · audio: 670760 b64 bytes*
*note: voice item (name-planet)*

> Hi! Time to explore the sky! When a planet glows bright, look at it, then say its name out loud. Look at the planet glowing bright. What planet is that?

### wrong:ssc-1
*expect: turn · turn_ended: True · 8.0s · audio: 428804 b64 bytes*
*note: student says "Venus" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Mercury — the small grey one. Your turn. What planet is that?

### right:ssc-1
*expect: turn · turn_ended: True · 5.3s · audio: 258600 b64 bytes*
*note: student says "Mercury"*

> Yes, Mercury. Mercury is the small grey one.

### ask:ssc-2
*expect: turn · turn_ended: True · 5.2s · audio: 230440 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-2
*expect: turn · turn_ended: True · 8.2s · audio: 439684 b64 bytes*
*note: student says "Mars" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Earth — the blue one, our home. Your turn. What planet is that?

### right:ssc-2
*expect: turn · turn_ended: True · 4.9s · audio: 229764 b64 bytes*
*note: student says "Earth"*

> Yes, Earth. Earth is the blue one, our home.

### ask:ssc-3
*expect: turn · turn_ended: True · 5.2s · audio: 206724 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-3
*expect: turn · turn_ended: True · 7.9s · audio: 391684 b64 bytes*
*note: student says "Jupiter" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Mars — the red one. Your turn. What planet is that?

### right:ssc-3
*expect: turn · turn_ended: True · 4.2s · audio: 185604 b64 bytes*
*note: student says "Mars"*

> Yes, Mars. Mars is the red one.

### ask:ssc-4
*expect: turn · turn_ended: True · 5.1s · audio: 221444 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-4
*expect: turn · turn_ended: True · 8.4s · audio: 449924 b64 bytes*
*note: student says "Saturn" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Jupiter — the one with orange stripes. Your turn. What planet is that?

### right:ssc-4
*expect: turn · turn_ended: True · 5.0s · audio: 240004 b64 bytes*
*note: student says "Jupiter"*

> Yes, Jupiter. Jupiter is the one with orange stripes.

### ask:ssc-5
*expect: turn · turn_ended: True · 5.9s · audio: 243880 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-5
*expect: turn · turn_ended: True · 8.9s · audio: 485124 b64 bytes*
*note: student says "Uranus" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Saturn — the pale gold one with rings. Your turn. What planet is that?

### right:ssc-5
*expect: turn · turn_ended: True · 5.4s · audio: 259204 b64 bytes*
*note: student says "Saturn"*

> Yes, Saturn. Saturn is the pale gold one with rings.

### ask:ssc-6
*expect: turn · turn_ended: True · 5.1s · audio: 227880 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-6
*expect: turn · turn_ended: True · 8.2s · audio: 424324 b64 bytes*
*note: student says "Uranus" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Neptune — the deep blue one. Your turn. What planet is that?

### right:ssc-6
*expect: turn · turn_ended: True · 4.9s · audio: 222120 b64 bytes*
*note: student says "Neptune"*

> Yes, Neptune. Neptune is the deep blue one.

### complete
*expect: turn · turn_ended: True · 8.7s · audio: 424324 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
