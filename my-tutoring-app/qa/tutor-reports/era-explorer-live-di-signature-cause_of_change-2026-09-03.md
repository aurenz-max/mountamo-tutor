# Tier-3 Live Tutor Report — era-explorer — 2026-09-03

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "era-explorer", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 5", "undrivable_items": []}`
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
| `era-cause_of_change-1` | voice/cause_of_change | towns stopped relying on horse-drawn | ✅✅ | telegraph railroad | ✅✅ |
| `era-cause_of_change-2` | voice/cause_of_change | children no longer need to | ✅✅ | modern furnaces | ✅✅ |
| `era-cause_of_change-3` | voice/cause_of_change | most students no longer share | ✅✅ | large modern | ✅✅ |
| `era-cause_of_change-4` | voice/cause_of_change | families stopped melting animal fat | ✅✅ | electric lightbulbs | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:era-cause_of_change-1
*expect: turn · turn_ended: True · 33.3s · audio: 2035240 b64 bytes*
*note: voice item (cause_of_change)*

> Hi! Time to be a historian and work out how life used to be! I read you a way life changed — you say why it changed, out loud! Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Listen. Towns stopped relying on horse-drawn carriages to send mail and newspapers across the country. Your turn. Say why life changed — was it because the telegraph and railroad lines were built, because every family bought a heavy wooden wagon, or because farmers started growing extra vegetables in their gardens?

### wrong:era-cause_of_change-1
*expect: turn · turn_ended: True · 25.9s · audio: 1571844 b64 bytes*
*note: student says "towns stopped relying on horse-drawn" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Towns stopped relying on horse-drawn carriages to send mail and newspapers across the country. Say why life changed — was it because the telegraph and railroad lines were built, because every family bought a heavy wooden wagon, or because farmers started growing extra vegetables in their gardens?

### right:era-cause_of_change-1
*expect: turn · turn_ended: True · 8.0s · audio: 430084 b64 bytes*
*note: student says "telegraph railroad"*

> Yes, life changed because the telegraph and railroad lines were built — you found the cause, not just the change.

### ask:era-cause_of_change-2
*expect: turn · turn_ended: True · 18.9s · audio: 1102084 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Children no longer need to chop firewood and haul water before heading off to school. Your turn. Say why life changed — was it because teachers started assigning extra reading homework, because modern furnaces and indoor plumbing were invented, or because schools stopped teaching arithmetic and writing?

### wrong:era-cause_of_change-2
*expect: turn · turn_ended: True · 25.4s · audio: 1537284 b64 bytes*
*note: student says "children no longer need to" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Children no longer need to chop firewood and haul water before heading off to school. Say why life changed — was it because teachers started assigning extra reading homework, because modern furnaces and indoor plumbing were invented, or because schools stopped teaching arithmetic and writing?

### right:era-cause_of_change-2
*expect: turn · turn_ended: True · 8.7s · audio: 455684 b64 bytes*
*note: student says "modern furnaces"*

> Yes, life changed because modern furnaces and indoor plumbing were invented — you found the cause, not just the change.

### ask:era-cause_of_change-3
*expect: turn · turn_ended: True · 18.5s · audio: 1079684 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Most students no longer share one single classroom with children of all different ages. Your turn. Say why life changed — was it because parents decided to teach all lessons at home, because children stopped helping on the family farm, or because large modern school buildings were constructed?

### wrong:era-cause_of_change-3
*expect: turn · turn_ended: True · 25.5s · audio: 1544324 b64 bytes*
*note: student says "most students no longer share" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Most students no longer share one single classroom with children of all different ages. Say why life changed — was it because parents decided to teach all lessons at home, because children stopped helping on the family farm, or because large modern school buildings were constructed?

### right:era-cause_of_change-3
*expect: turn · turn_ended: True · 8.7s · audio: 439684 b64 bytes*
*note: student says "large modern"*

> Yes, life changed because large modern school buildings were constructed — you found the cause, not just the change.

### ask:era-cause_of_change-4
*expect: turn · turn_ended: True · 20.7s · audio: 1219844 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Families stopped melting animal fat to make their own candles for evening light. Your turn. Say why life changed — was it because electric lightbulbs and power grids were invented, because store owners stopped selling wooden tables and chairs, or because towns passed laws requiring stone fireplaces in every cabin?

### wrong:era-cause_of_change-4
*expect: turn · turn_ended: True · 27.9s · audio: 1692164 b64 bytes*
*note: student says "families stopped melting animal fat" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Families stopped melting animal fat to make their own candles for evening light. Say why life changed — was it because electric lightbulbs and power grids were invented, because store owners stopped selling wooden tables and chairs, or because towns passed laws requiring stone fireplaces in every cabin?

### right:era-cause_of_change-4
*expect: turn · turn_ended: True · 8.5s · audio: 445444 b64 bytes*
*note: student says "electric lightbulbs"*

> Yes, life changed because electric lightbulbs and power grids were invented — you found the cause, not just the change.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 397480 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!


## Run 2 — beat-by-beat transcript

### ask:era-cause_of_change-1
*expect: turn · turn_ended: True · 32.8s · audio: 1998760 b64 bytes*
*note: voice item (cause_of_change)*

> Hi! Time to be a historian and work out how life used to be! I read you a way life changed — you say why it changed, out loud! Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Listen. Towns stopped relying on horse-drawn carriages to send mail and newspapers across the country. Your turn. Say why life changed — was it because the telegraph and railroad lines were built, because every family bought a heavy wooden wagon, or because farmers started growing extra vegetables in their gardens?

### wrong:era-cause_of_change-1
*expect: turn · turn_ended: True · 26.2s · audio: 1582724 b64 bytes*
*note: student says "towns stopped relying on horse-drawn" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Towns stopped relying on horse-drawn carriages to send mail and newspapers across the country. Say why life changed — was it because the telegraph and railroad lines were built, because every family bought a heavy wooden wagon, or because farmers started growing extra vegetables in their gardens?

### right:era-cause_of_change-1
*expect: turn · turn_ended: True · 8.0s · audio: 430120 b64 bytes*
*note: student says "telegraph railroad"*

> Yes, life changed because the telegraph and railroad lines were built — you found the cause, not just the change.

### ask:era-cause_of_change-2
*expect: turn · turn_ended: True · 19.1s · audio: 1120644 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Children no longer need to chop firewood and haul water before heading off to school. Your turn. Say why life changed — was it because teachers started assigning extra reading homework, because modern furnaces and indoor plumbing were invented, or because schools stopped teaching arithmetic and writing?

### wrong:era-cause_of_change-2
*expect: turn · turn_ended: True · 25.2s · audio: 1530244 b64 bytes*
*note: student says "children no longer need to" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Children no longer need to chop firewood and haul water before heading off to school. Say why life changed — was it because teachers started assigning extra reading homework, because modern furnaces and indoor plumbing were invented, or because schools stopped teaching arithmetic and writing?

### right:era-cause_of_change-2
*expect: turn · turn_ended: True · 8.8s · audio: 475524 b64 bytes*
*note: student says "modern furnaces"*

> Yes, life changed because modern furnaces and indoor plumbing were invented — you found the cause, not just the change.

### ask:era-cause_of_change-3
*expect: turn · turn_ended: True · 18.4s · audio: 1058564 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Most students no longer share one single classroom with children of all different ages. Your turn. Say why life changed — was it because parents decided to teach all lessons at home, because children stopped helping on the family farm, or because large modern school buildings were constructed?

### wrong:era-cause_of_change-3
*expect: turn · turn_ended: True · 24.4s · audio: 1479044 b64 bytes*
*note: student says "most students no longer share" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Most students no longer share one single classroom with children of all different ages. Say why life changed — was it because parents decided to teach all lessons at home, because children stopped helping on the family farm, or because large modern school buildings were constructed?

### right:era-cause_of_change-3
*expect: turn · turn_ended: True · 8.2s · audio: 433924 b64 bytes*
*note: student says "large modern"*

> Yes, life changed because large modern school buildings were constructed — you found the cause, not just the change.

### ask:era-cause_of_change-4
*expect: turn · turn_ended: True · 20.4s · audio: 1194244 b64 bytes*
*note: voice item (cause_of_change)*

> Listen. Families stopped melting animal fat to make their own candles for evening light. Your turn. Say why life changed — was it because electric lightbulbs and power grids were invented, because store owners stopped selling wooden tables and chairs, or because towns passed laws requiring stone fireplaces in every cabin?

### wrong:era-cause_of_change-4
*expect: turn · turn_ended: True · 25.4s · audio: 1540484 b64 bytes*
*note: student says "families stopped melting animal fat" — WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause*

> My turn: Life changes for a reason — a new invention, a new way to earn a living, or a new rule. Your turn. Listen again. Families stopped melting animal fat to make their own candles for evening light. Say why life changed — was it because electric lightbulbs and power grids were invented, because store owners stopped selling wooden tables and chairs, or because towns passed laws requiring stone fireplaces in every cabin?

### right:era-cause_of_change-4
*expect: turn · turn_ended: True · 8.3s · audio: 444164 b64 bytes*
*note: student says "electric lightbulbs"*

> Yes, life changed because electric lightbulbs and power grids were invented — you found the cause, not just the change.

### complete
*expect: turn · turn_ended: False · 60.3s · audio: 145284 b64 bytes*

> What good history today! You read
