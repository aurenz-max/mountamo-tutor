# Tier-3 Live Tutor Report — periodic-table — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "periodic-table", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `pt-1-identify` | voice/name | tin | ✅ | Iodine | ✅ |
| `pt-2-identify` | voice/name | tin | ✅ | Chlorine | ✅ |
| `pt-3-identify` | voice/name | tin | ✅ | Iron | ✅ |
| `pt-4-identify` | voice/name | tin | ✅ | Barium | ✅ |
| `pt-5-identify` | voice/name | tin | ✅ | Carbon | ✅ |
| `pt-6-identify` | voice/name | tin | ✅ | Sulfur | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pt-1-identify
*expect: turn · turn_ended: True · 20.0s · audio: 1194244 b64 bytes*
*note: voice item (name)*

> Hi! Time to explore the periodic table! I tell you where an element lives — you find its box and say its name out loud! Every box shows its element — the number on top, the symbol in big letters, the name underneath. Look at group 17, period 5. Your turn. Say that element's name.

### wrong:pt-1-identify
*expect: turn · turn_ended: True · 10.6s · audio: 608644 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 17, then down to period 5 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-1-identify
*expect: turn · turn_ended: True · 4.0s · audio: 162564 b64 bytes*
*note: student says "Iodine"*

> Yes, that element is Iodine.

### ask:pt-2-identify
*expect: turn · turn_ended: True · 5.7s · audio: 258564 b64 bytes*
*note: voice item (name)*

> Find element number 17. Your turn. Say its name.

### wrong:pt-2-identify
*expect: turn · turn_ended: True · 9.5s · audio: 528004 b64 bytes*
*note: student says "tin"*

> My turn: follow the little numbers up to 17 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-2-identify
*expect: turn · turn_ended: True · 3.5s · audio: 146564 b64 bytes*
*note: student says "Chlorine"*

> Yes, that element is Chlorine.

### ask:pt-3-identify
*expect: turn · turn_ended: True · 6.2s · audio: 305924 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is F, e. Your turn. Say its name.

### wrong:pt-3-identify
*expect: turn · turn_ended: True · 8.8s · audio: 485124 b64 bytes*
*note: student says "tin"*

> My turn: match the big letters F, e — the name is written under them. Your turn. Say that element's name.

### right:pt-3-identify
*expect: turn · turn_ended: True · 3.8s · audio: 145284 b64 bytes*
*note: student says "Iron"*

> Yes, that element is Iron.

### ask:pt-4-identify
*expect: turn · turn_ended: True · 6.6s · audio: 302084 b64 bytes*
*note: voice item (name)*

> Look at group 2, period 6. Your turn. Say that element's name.

### wrong:pt-4-identify
*expect: turn · turn_ended: True · 10.3s · audio: 580484 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 2, then down to period 6 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-4-identify
*expect: turn · turn_ended: True · 3.8s · audio: 149764 b64 bytes*
*note: student says "Barium"*

> Yes, that element is Barium.

### ask:pt-5-identify
*expect: turn · turn_ended: True · 5.5s · audio: 256004 b64 bytes*
*note: voice item (name)*

> Find element number 6. Your turn. Say its name.

### wrong:pt-5-identify
*expect: turn · turn_ended: True · 9.1s · audio: 511364 b64 bytes*
*note: student says "tin"*

> My turn: follow the little numbers up to 6 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-5-identify
*expect: turn · turn_ended: True · 3.5s · audio: 150404 b64 bytes*
*note: student says "Carbon"*

> Yes, that element is Carbon.

### ask:pt-6-identify
*expect: turn · turn_ended: True · 5.9s · audio: 274564 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is S. Your turn. Say its name.

### wrong:pt-6-identify
*expect: turn · turn_ended: True · 8.4s · audio: 463364 b64 bytes*
*note: student says "tin"*

> My turn: match the big letters S — the name is written under them. Your turn. Say that element's name.

### right:pt-6-identify
*expect: turn · turn_ended: True · 3.8s · audio: 169604 b64 bytes*
*note: student says "Sulfur"*

> Yes, that element is Sulfur.

### complete
*expect: turn · turn_ended: True · 8.3s · audio: 441604 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!
