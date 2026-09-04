# Tier-3 Live Tutor Report — era-explorer — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "era-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "era-era_sort-1", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:era-era_sort-1 1/1, wrong3:era-era_sort-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:era-era_sort-1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `era-era_sort-1` | voice/era_sort | back then | ✅✅✅ | - | n/a |
| `era-era_sort-2` | voice/era_sort | back then | ✅ | both | ✅ |
| `era-era_sort-3` | voice/era_sort | today | ✅ | back then | ✅ |
| `era-era_sort-5` | voice/era_sort | back then | ✅ | both | ✅ |
| `era-era_sort-4` | voice/era_sort | today | ✅ | back then | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:era-era_sort-1
*expect: turn · turn_ended: True · 29.1s · audio: 1747204 b64 bytes*
*note: voice item (era_sort)*

> Hi! Time to be a historian and work out how life used to be! I read you something about life — you say when life looked like that, out loud! Some things happened only back then, some happen only today, and some happen in both times. Listen. Families turn on a kitchen faucet to get clean drinking water instantly. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong1:era-era_sort-1
*expect: turn · turn_ended: True · 21.9s · audio: 1320964 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families turn on a kitchen faucet to get clean drinking water instantly. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong2:era-era_sort-1
*expect: turn · turn_ended: True · 22.3s · audio: 1346564 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families turn on a kitchen faucet to get clean drinking water instantly. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong3:era-era_sort-1
*expect: turn · turn_ended: True · 22.6s · audio: 1362564 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families turn on a kitchen faucet to get clean drinking water instantly. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### moveon:era-era_sort-1
*expect: turn · turn_ended: True · 18.2s · audio: 1065604 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That one was true only today. Here comes the next one. Listen. Children help their parents by feeding the farm animals and gathering firewood. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-2
*expect: turn · turn_ended: True · 22.2s · audio: 1329924 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Children help their parents by feeding the farm animals and gathering firewood. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-2
*expect: turn · turn_ended: True · 5.3s · audio: 260484 b64 bytes*
*note: student says "both"*

> Yes, that was true in both times — you pictured both times and chose.

### ask:era-era_sort-3
*expect: turn · turn_ended: True · 14.1s · audio: 797444 b64 bytes*
*note: voice item (era_sort)*

> Listen. People cook meals over an open fireplace using heavy iron pots. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-3
*expect: turn · turn_ended: True · 21.6s · audio: 1299204 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. People cook meals over an open fireplace using heavy iron pots. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-3
*expect: turn · turn_ended: True · 6.7s · audio: 347524 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### ask:era-era_sort-5
*expect: turn · turn_ended: True · 14.5s · audio: 783400 b64 bytes*
*note: voice item (era_sort)*

> Listen. Families share meals together at the end of a busy day. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-5
*expect: turn · turn_ended: True · 21.0s · audio: 1253768 b64 bytes*
*note: student says "back then"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Families share meals together at the end of a busy day. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-5
*expect: turn · turn_ended: True · 6.2s · audio: 304644 b64 bytes*
*note: student says "both"*

> Yes, that was true in both times — you pictured both times and chose.

### ask:era-era_sort-4
*expect: turn · turn_ended: True · 14.8s · audio: 830724 b64 bytes*
*note: voice item (era_sort)*

> Listen. Students of many different ages learn together inside a single classroom. Your turn. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### wrong:era-era_sort-4
*expect: turn · turn_ended: True · 22.5s · audio: 1352964 b64 bytes*
*note: student says "today"*

> My turn: Some things happened only back then, some happen only today, and some happen in both times. Your turn. Listen again. Students of many different ages learn together inside a single classroom. Say when life looked like that — was it only back then in Pioneer Times, only today in your own life, or true in both times?

### right:era-era_sort-4
*expect: turn · turn_ended: True · 6.6s · audio: 340484 b64 bytes*
*note: student says "back then"*

> Yes, that was true only back then in Pioneer Times — you pictured both times and chose.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 380164 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!
