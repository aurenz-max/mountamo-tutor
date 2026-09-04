# Tier-3 Live Tutor Report — matter-explorer — 2026-09-02

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "matter-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | voice/name_property | solid | ✅ | own shape | ✅ |
| `chal-2` | voice/name_property | liquid | ✅ | the cup | ✅ |
| `chal-4` | voice/name_property | solid | ✅ | own shape | ✅ |
| `chal-3` | voice/name_property | liquid | ✅ | the cup | ✅ |
| `chal-5` | voice/name_property | gas | ✅ | the room | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 26.9s · audio: 1617960 b64 bytes*
*note: voice item (name_property)*

> Hi! Time to find out what everything around us is made of! I name something you know — you say what it does when you put it in a cup, out loud! Everything you can touch does one of three things in a cup: keeps its own shape, takes the cup's shape, or spreads out and fills the room. Think about the garden rock going into a cup. Your turn. Tell me what it does — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### wrong:chal-1
*expect: turn · turn_ended: True · 18.7s · audio: 1096360 b64 bytes*
*note: student says "solid" — the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification*

> My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the garden rock do — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### right:chal-1
*expect: turn · turn_ended: True · 6.2s · audio: 321924 b64 bytes*
*note: student says "own shape"*

> Yes, the garden rock keeps its own shape — that is exactly what a solid does.

### ask:chal-2
*expect: turn · turn_ended: True · 11.6s · audio: 643204 b64 bytes*
*note: voice item (name_property)*

> Think about the water going into a cup. Your turn. Tell me what it does — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### wrong:chal-2
*expect: turn · turn_ended: True · 18.8s · audio: 1131560 b64 bytes*
*note: student says "liquid" — the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification*

> My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the water do — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### right:chal-2
*expect: turn · turn_ended: True · 6.1s · audio: 314884 b64 bytes*
*note: student says "the cup"*

> Yes, the water takes the shape of the cup — that is exactly what a liquid does.

### ask:chal-4
*expect: turn · turn_ended: True · 11.8s · audio: 660520 b64 bytes*
*note: voice item (name_property)*

> Think about the sand going into a cup. Your turn. Tell me what it does — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### wrong:chal-4
*expect: turn · turn_ended: True · 19.1s · audio: 1136680 b64 bytes*
*note: student says "solid" — the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification*

> My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the sand do — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### right:chal-4
*expect: turn · turn_ended: True · 6.4s · audio: 316164 b64 bytes*
*note: student says "own shape"*

> Yes, the sand keeps its own shape — that is exactly what a solid does.

### ask:chal-3
*expect: turn · turn_ended: True · 11.6s · audio: 644484 b64 bytes*
*note: voice item (name_property)*

> Think about the honey going into a cup. Your turn. Tell me what it does — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### wrong:chal-3
*expect: turn · turn_ended: True · 19.0s · audio: 1130884 b64 bytes*
*note: student says "liquid" — the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification*

> My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the honey do — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### right:chal-3
*expect: turn · turn_ended: True · 6.1s · audio: 311044 b64 bytes*
*note: student says "the cup"*

> Yes, the honey takes the shape of the cup — that is exactly what a liquid does.

### ask:chal-5
*expect: turn · turn_ended: True · 11.9s · audio: 653444 b64 bytes*
*note: voice item (name_property)*

> Think about the steam going into a cup. Your turn. Tell me what it does — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### wrong:chal-5
*expect: turn · turn_ended: True · 19.3s · audio: 1159720 b64 bytes*
*note: student says "gas" — the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification*

> My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the steam do — does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?

### right:chal-5
*expect: turn · turn_ended: True · 6.9s · audio: 350724 b64 bytes*
*note: student says "the room"*

> Yes, the steam spreads out and fills the whole room — that is exactly what a gas does.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 412200 b64 bytes*

> What great science today! You looked at ordinary things and worked out what they are made of. See you next time!
