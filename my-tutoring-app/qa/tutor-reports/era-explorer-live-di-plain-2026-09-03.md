# Tier-3 Live Tutor Report — era-explorer — 2026-09-03

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "era-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `era-era_sort-1` | voice/era_sort | today | ✅✅ | back then | ✅✅ |
| `era-era_sort-2` | voice/era_sort | back then | ✅✅ | both | ✅✅ |
| `era-era_sort-3` | voice/era_sort | back then | ✅✅ | today | ✅✅ |
| `era-era_sort-5` | voice/era_sort | today | ✅✅ | back then | ✅✅ |
| `era-era_sort-4` | voice/era_sort | back then | ✅✅ | today | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:era-era_sort-1
*expect: turn · turn_ended: True · 28.8s · audio: 1742084 b64 bytes*
*note: voice item (era_sort)*

> Hi! Time to be a historian and work out how life used to be! I read you something about life — you say when life looked like that, out loud! Some things happened only back then, some happen only today, and some happen in both times. Listen. Children learn reading and writing from a single teacher in a small building with all different ages together. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-1
*expect: turn · turn_ended: True · 22.8s · audio: 1382404 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Children learn reading and writing from a single teacher in a small building with all different ages together. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-1
*expect: turn · turn_ended: True · 7.8s · audio: 362884 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### ask:era-era_sort-2
*expect: turn · turn_ended: True · 15.0s · audio: 851844 b64 bytes*
*note: voice item (era_sort)*

> Listen. Kids play tag outside with their friends during a break from their daily routines. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-2
*expect: turn · turn_ended: True · 21.7s · audio: 1310084 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Kids play tag outside with their friends during a break from their daily routines. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-2
*expect: turn · turn_ended: True · 5.4s · audio: 273284 b64 bytes*
*note: student says "both"*

> Yes, that was true in both times — you pictured both times and chose.

### ask:era-era_sort-3
*expect: turn · turn_ended: True · 15.4s · audio: 853800 b64 bytes*
*note: voice item (era_sort)*

> Listen. People turn on a kitchen faucet to get instant running water for cooking and cleaning. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-3
*expect: turn · turn_ended: True · 22.1s · audio: 1331204 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. People turn on a kitchen faucet to get instant running water for cooking and cleaning. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-3
*expect: turn · turn_ended: True · 5.6s · audio: 268804 b64 bytes*
*note: student says "today"*

> Yes, that was true only today — you pictured both times and chose.

### ask:era-era_sort-5
*expect: turn · turn_ended: True · 16.2s · audio: 930564 b64 bytes*
*note: voice item (era_sort)*

> Listen. People cook meals using heavy iron cookware placed directly over burning logs in a fireplace. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-5
*expect: turn · turn_ended: True · 23.9s · audio: 1409924 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. People cook meals using heavy iron cookware placed directly over burning logs in a fireplace. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-5
*expect: turn · turn_ended: True · 6.6s · audio: 337284 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### ask:era-era_sort-4
*expect: turn · turn_ended: True · 15.9s · audio: 917124 b64 bytes*
*note: voice item (era_sort)*

> Listen. Families light their homes after sunset using electric lightbulbs plugged into wall outlets. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-4
*expect: turn · turn_ended: True · 22.8s · audio: 1379204 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families light their homes after sunset using electric lightbulbs plugged into wall outlets. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-4
*expect: turn · turn_ended: True · 5.7s · audio: 258564 b64 bytes*
*note: student says "today"*

> Yes, that was true only today — you pictured both times and chose.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 364804 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!


## Run 2 — beat-by-beat transcript

### ask:era-era_sort-1
*expect: turn · turn_ended: True · 30.8s · audio: 1875204 b64 bytes*
*note: voice item (era_sort)*

> Hi! Time to be a historian and work out how life used to be! I read you something about life — you say when life looked like that, out loud! Some things happened only back then, some happen only today, and some happen in both times. Listen. Children learn reading and writing from a single teacher in a small building with all different ages together. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-1
*expect: turn · turn_ended: True · 23.5s · audio: 1420164 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Children learn reading and writing from a single teacher in a small building with all different ages together. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-1
*expect: turn · turn_ended: True · 7.2s · audio: 349444 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### ask:era-era_sort-2
*expect: turn · turn_ended: True · 15.3s · audio: 871684 b64 bytes*
*note: voice item (era_sort)*

> Listen. Kids play tag outside with their friends during a break from their daily routines. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-2
*expect: turn · turn_ended: True · 22.6s · audio: 1297928 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Kids play tag outside with their friends during a break from their daily routines. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-2
*expect: turn · turn_ended: True · 5.9s · audio: 282244 b64 bytes*
*note: student says "both"*

> Yes, that was true in both times — you pictured both times and chose.

### ask:era-era_sort-3
*expect: turn · turn_ended: True · 15.6s · audio: 904324 b64 bytes*
*note: voice item (era_sort)*

> Listen. People turn on a kitchen faucet to get instant running water for cooking and cleaning. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-3
*expect: turn · turn_ended: True · 22.8s · audio: 1374724 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. People turn on a kitchen faucet to get instant running water for cooking and cleaning. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-3
*expect: turn · turn_ended: True · 6.0s · audio: 273284 b64 bytes*
*note: student says "today"*

> Yes, that was true only today — you pictured both times and chose.

### ask:era-era_sort-5
*expect: turn · turn_ended: True · 17.0s · audio: 971524 b64 bytes*
*note: voice item (era_sort)*

> Listen. People cook meals using heavy iron cookware placed directly over burning logs in a fireplace. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-5
*expect: turn · turn_ended: True · 23.3s · audio: 1413800 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. People cook meals using heavy iron cookware placed directly over burning logs in a fireplace. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-5
*expect: turn · turn_ended: True · 7.3s · audio: 378244 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### ask:era-era_sort-4
*expect: turn · turn_ended: True · 16.9s · audio: 988804 b64 bytes*
*note: voice item (era_sort)*

> Listen. Families light their homes after sunset using electric lightbulbs plugged into wall outlets. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-4
*expect: turn · turn_ended: True · 23.1s · audio: 1393924 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families light their homes after sunset using electric lightbulbs plugged into wall outlets. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-4
*expect: turn · turn_ended: True · 5.6s · audio: 270724 b64 bytes*
*note: student says "today"*

> Yes, that was true only today — you pictured both times and chose.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 398084 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!
