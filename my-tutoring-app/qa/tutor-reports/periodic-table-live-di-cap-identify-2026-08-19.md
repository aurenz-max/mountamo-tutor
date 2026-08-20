# Tier-3 Live Tutor Report — periodic-table — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "periodic-table", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "pt-1-identify", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:pt-1-identify 1/1, wrong3:pt-1-identify 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `pt-1-identify` | voice/name | tin | ✅✅✅ | - | n/a |
| `pt-2-identify` | voice/name | tin | ✅ | Chlorine | ✅ |
| `pt-3-identify` | voice/name | tin | ✅ | Helium | ✅ |
| `pt-4-identify` | voice/name | tin | ✅ | Hydrogen | ✅ |
| `pt-5-identify` | voice/name | tin | ✅ | Iron | ✅ |
| `pt-6-identify` | voice/name | tin | ✅ | Bromine | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pt-1-identify
*expect: turn · turn_ended: True · 20.0s · audio: 1174404 b64 bytes*
*note: voice item (name)*

> Hi! Time to explore the periodic table! I tell you where an element lives — you find its box and say its name out loud! Every box shows its element — the number on top, the symbol in big letters, the name underneath. Look at group 2, period 4. Your turn. Say that element's name.

### wrong1:pt-1-identify
*expect: turn · turn_ended: True · 11.0s · audio: 608004 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 2, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### wrong2:pt-1-identify
*expect: turn · turn_ended: True · 11.2s · audio: 604804 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 2, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### wrong3:pt-1-identify
*expect: turn · turn_ended: True · 11.0s · audio: 614404 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 2, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### moveon:pt-1-identify
*expect: turn · turn_ended: True · 9.4s · audio: 503080 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That element is Calcium. Here comes the next one. Find element number 17. Your turn. Say its name.

### wrong:pt-2-identify
*expect: turn · turn_ended: True · 9.7s · audio: 490244 b64 bytes*
*note: student says "tin"*

> My turn: follow the little numbers up to 17 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-2-identify
*expect: turn · turn_ended: True · 4.4s · audio: 144004 b64 bytes*
*note: student says "Chlorine"*

> Yes, that element is Chlorine.

### ask:pt-3-identify
*expect: turn · turn_ended: True · 6.4s · audio: 299524 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is H, e. Your turn. Say its name.

### wrong:pt-3-identify
*expect: turn · turn_ended: True · 8.4s · audio: 452484 b64 bytes*
*note: student says "tin"*

> My turn: match the big letters H, e — the name is written under them. Your turn. Say that element's name.

### right:pt-3-identify
*expect: turn · turn_ended: True · 3.7s · audio: 144644 b64 bytes*
*note: student says "Helium"*

> Yes, that element is Helium.

### ask:pt-4-identify
*expect: turn · turn_ended: True · 6.2s · audio: 293124 b64 bytes*
*note: voice item (name)*

> Look at group 1, period 1. Your turn. Say that element's name.

### wrong:pt-4-identify
*expect: turn · turn_ended: True · 10.4s · audio: 578564 b64 bytes*
*note: student says "tin"*

> My turn: count across to group 1, then down to period 1 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-4-identify
*expect: turn · turn_ended: True · 3.6s · audio: 149764 b64 bytes*
*note: student says "Hydrogen"*

> Yes, that element is Hydrogen.

### ask:pt-5-identify
*expect: turn · turn_ended: True · 5.9s · audio: 277764 b64 bytes*
*note: voice item (name)*

> Find element number 26. Your turn. Say its name.

### wrong:pt-5-identify
*expect: turn · turn_ended: True · 9.7s · audio: 527364 b64 bytes*
*note: student says "tin"*

> My turn: follow the little numbers up to 26 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-5-identify
*expect: turn · turn_ended: True · 4.0s · audio: 140804 b64 bytes*
*note: student says "Iron"*

> Yes, that element is Iron.

### ask:pt-6-identify
*expect: turn · turn_ended: True · 7.0s · audio: 312964 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is B, r. Your turn. Say its name.

### wrong:pt-6-identify
*expect: turn · turn_ended: True · 9.7s · audio: 477444 b64 bytes*
*note: student says "tin"*

> My turn: match the big letters B, r — the name is written under them. Your turn. Say that element's name.

### right:pt-6-identify
*expect: turn · turn_ended: True · 3.7s · audio: 149124 b64 bytes*
*note: student says "Bromine"*

> Yes, that element is Bromine.

### complete
*expect: turn · turn_ended: True · 8.3s · audio: 430120 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!
