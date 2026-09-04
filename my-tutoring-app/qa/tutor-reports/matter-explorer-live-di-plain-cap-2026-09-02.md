# Tier-3 Live Tutor Report — matter-explorer — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "matter-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "chal-1", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:chal-1 1/1, wrong3:chal-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `chal-1` | voice/name_state | gas | ✅✅✅ | - | n/a |
| `chal-2` | voice/name_state | solid | ✅ | liquid | ✅ |
| `chal-3` | voice/name_state | solid | ✅ | gas | ✅ |
| `chal-4` | voice/name_state | solid | ✅ | liquid | ✅ |
| `chal-5` | voice/name_state | gas | ✅ | solid | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 20.9s · audio: 1239684 b64 bytes*
*note: voice item (name_state)*

> Hi! Time to find out what everything around us is made of! I name something you know — you say what state it is, out loud! A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Think about the garden rock. Your turn. Say what state it is.

### wrong1:chal-1
*expect: turn · turn_ended: True · 14.3s · audio: 846724 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the garden rock again and say what state it is.

### wrong2:chal-1
*expect: turn · turn_ended: True · 14.2s · audio: 836484 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the garden rock again and say what state it is.

### wrong3:chal-1
*expect: turn · turn_ended: True · 14.3s · audio: 837124 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the garden rock again and say what state it is.

### moveon:chal-1
*expect: turn · turn_ended: True · 10.0s · audio: 530564 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! The garden rock is a solid. Here comes the next one. Think about the cup of water. Your turn. Say what state it is.

### wrong:chal-2
*expect: turn · turn_ended: True · 14.8s · audio: 858884 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the cup of water again and say what state it is.

### right:chal-2
*expect: turn · turn_ended: True · 5.6s · audio: 275844 b64 bytes*
*note: student says "liquid"*

> Yes, the cup of water is a liquid — you pictured it and worked it out.

### ask:chal-3
*expect: turn · turn_ended: True · 5.2s · audio: 238724 b64 bytes*
*note: voice item (name_state)*

> Think about the steam. Your turn. Say what state it is.

### wrong:chal-3
*expect: turn · turn_ended: True · 14.5s · audio: 828804 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the steam again and say what state it is.

### right:chal-3
*expect: turn · turn_ended: True · 5.2s · audio: 258564 b64 bytes*
*note: student says "gas"*

> Yes, the steam is a gas — you pictured it and worked it out.

### ask:chal-4
*expect: turn · turn_ended: True · 5.9s · audio: 273960 b64 bytes*
*note: voice item (name_state)*

> Think about the honey. Your turn. Say what state it is.

### wrong:chal-4
*expect: turn · turn_ended: True · 14.8s · audio: 860200 b64 bytes*
*note: student says "solid"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the honey again and say what state it is.

### right:chal-4
*expect: turn · turn_ended: True · 5.7s · audio: 284164 b64 bytes*
*note: student says "liquid"*

> Yes, the honey is a liquid — you pictured it and worked it out.

### ask:chal-5
*expect: turn · turn_ended: True · 5.5s · audio: 254084 b64 bytes*
*note: voice item (name_state)*

> Think about the sand. Your turn. Say what state it is.

### wrong:chal-5
*expect: turn · turn_ended: True · 14.8s · audio: 867844 b64 bytes*
*note: student says "gas"*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Think about the sand again and say what state it is.

### right:chal-5
*expect: turn · turn_ended: True · 5.7s · audio: 273928 b64 bytes*
*note: student says "solid"*

> Yes, the sand is a solid — you pictured it and worked it out.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 424360 b64 bytes*

> What great science today! You looked at ordinary things and worked out what they are made of. See you next time!
