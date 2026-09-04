# Tier-3 Live Tutor Report — matter-explorer — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "matter-explorer", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | voice/mystery_state | smooth stone | ✅ | solid | ✅ |
| `chal-2` | voice/mystery_state | honey | ✅ | liquid | ✅ |
| `chal-3` | voice/mystery_state | steam | ✅ | gas | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 27.8s · audio: 1680040 b64 bytes*
*note: voice item (mystery_state)*

> Hi! Time to find out what everything around us is made of! I give you clues about a secret thing — you say what state it is, out loud! A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. I am thinking of something secret. Here are the clues: it looks gray, it feels smooth, it is opaque. Your turn. Say what state my secret thing is.

### wrong:chal-1
*expect: turn · turn_ended: True · 18.4s · audio: 1105924 b64 bytes*
*note: student says "smooth stone" — the OBJECT guessed instead of its state — the mode withholds the name, so naming it feels like winning; it is still not an answer to the question asked*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Listen to the clues again — it looks gray, it feels smooth, it is opaque — and say what state my secret thing is.

### right:chal-1
*expect: turn · turn_ended: True · 6.9s · audio: 343044 b64 bytes*
*note: student says "solid"*

> Yes, my secret thing is a solid — the clues told you, and it was the smooth stone.

### ask:chal-2
*expect: turn · turn_ended: True · 11.7s · audio: 636164 b64 bytes*
*note: voice item (mystery_state)*

> I am thinking of something secret. Here are the clues: it looks yellow, it feels smooth, it is translucent. Your turn. Say what state my secret thing is.

### wrong:chal-2
*expect: turn · turn_ended: True · 18.8s · audio: 1117444 b64 bytes*
*note: student says "honey" — the OBJECT guessed instead of its state — the mode withholds the name, so naming it feels like winning; it is still not an answer to the question asked*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Listen to the clues again — it looks yellow, it feels smooth, it is translucent — and say what state my secret thing is.

### right:chal-2
*expect: turn · turn_ended: True · 5.8s · audio: 293124 b64 bytes*
*note: student says "liquid"*

> Yes, my secret thing is a liquid — the clues told you, and it was the honey.

### ask:chal-3
*expect: turn · turn_ended: True · 11.6s · audio: 629764 b64 bytes*
*note: voice item (mystery_state)*

> I am thinking of something secret. Here are the clues: it looks white, it feels soft, it is translucent. Your turn. Say what state my secret thing is.

### wrong:chal-3
*expect: turn · turn_ended: True · 18.9s · audio: 1136680 b64 bytes*
*note: student says "steam" — the OBJECT guessed instead of its state — the mode withholds the name, so naming it feels like winning; it is still not an answer to the question asked*

> My turn: A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room. Your turn. Listen to the clues again — it looks white, it feels soft, it is translucent — and say what state my secret thing is.

### right:chal-3
*expect: turn · turn_ended: True · 6.3s · audio: 325764 b64 bytes*
*note: student says "gas"*

> Yes, my secret thing is a gas — the clues told you, and it was the steam.

### complete
*expect: turn · turn_ended: True · 7.9s · audio: 417284 b64 bytes*

> What great science today! You looked at ordinary things and worked out what they are made of. See you next time!
