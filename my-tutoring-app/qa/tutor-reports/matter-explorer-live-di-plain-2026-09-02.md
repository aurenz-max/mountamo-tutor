# Tier-3 Live Tutor Report — matter-explorer — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "matter-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | voice/name_state | gas | ✅ | solid | ✅ |
| `chal-2` | voice/name_state | solid | ✅ | liquid | ✅ |
| `chal-3` | voice/name_state | solid | ✅ | gas | ✅ |
| `chal-4` | voice/name_state | solid | ✅ | liquid | ✅ |
| `chal-5` | voice/name_state | gas | ✅ | solid | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 20.3s · audio: 1206404 b64 bytes*
*note: voice item (name_state)*

> Hi! Time to find out what everything around us is made of! I name something you know — you say what state it is, out loud! A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Think about the garden pebble. Your turn. Say what state it is.

### wrong:chal-1
*expect: turn · turn_ended: True · 14.2s · audio: 826244 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the garden pebble again and say what state it is.

### right:chal-1
*expect: turn · turn_ended: True · 5.9s · audio: 294404 b64 bytes*
*note: student says "solid"*

> Yes, the garden pebble is a solid — you pictured it and worked it out.

### ask:chal-2
*expect: turn · turn_ended: True · 5.4s · audio: 250884 b64 bytes*
*note: voice item (name_state)*

> Think about the drinking water. Your turn. Say what state it is.

### wrong:chal-2
*expect: turn · turn_ended: True · 14.8s · audio: 839044 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the drinking water again and say what state it is.

### right:chal-2
*expect: turn · turn_ended: True · 6.3s · audio: 270084 b64 bytes*
*note: student says "liquid"*

> Yes, the drinking water is a liquid — you pictured it and worked it out.

### ask:chal-3
*expect: turn · turn_ended: True · 5.5s · audio: 246440 b64 bytes*
*note: voice item (name_state)*

> Think about the party balloon. Your turn. Say what state it is.

### wrong:chal-3
*expect: turn · turn_ended: True · 14.5s · audio: 844804 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the party balloon again and say what state it is.

### right:chal-3
*expect: turn · turn_ended: True · 5.4s · audio: 257284 b64 bytes*
*note: student says "gas"*

> Yes, the party balloon is a gas — you pictured it and worked it out.

### ask:chal-4
*expect: turn · turn_ended: True · 5.2s · audio: 238760 b64 bytes*
*note: voice item (name_state)*

> Think about the sweet honey. Your turn. Say what state it is.

### wrong:chal-4
*expect: turn · turn_ended: True · 14.3s · audio: 836484 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the sweet honey again and say what state it is.

### right:chal-4
*expect: turn · turn_ended: True · 5.6s · audio: 270084 b64 bytes*
*note: student says "liquid"*

> Yes, the sweet honey is a liquid — you pictured it and worked it out.

### ask:chal-5
*expect: turn · turn_ended: True · 5.6s · audio: 240644 b64 bytes*
*note: voice item (name_state)*

> Think about the sandbox sand. Your turn. Say what state it is.

### wrong:chal-5
*expect: turn · turn_ended: True · 14.8s · audio: 851844 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the sandbox sand again and say what state it is.

### right:chal-5
*expect: turn · turn_ended: True · 6.2s · audio: 288004 b64 bytes*
*note: student says "solid"*

> Yes, the sandbox sand is a solid — you pictured it and worked it out.

### complete
*expect: turn · turn_ended: True · 7.2s · audio: 385284 b64 bytes*

> What great science today! You looked at ordinary things and worked out what they are made of. See you next time!
