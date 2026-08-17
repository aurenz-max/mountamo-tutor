# Tier-3 Live Tutor Report — word-builder — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-builder", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `heater` | voice/simple_affix | erheat | ✅ | heater | ✅ |
| `cooler` | voice/simple_affix | ercool | ✅ | cooler | ✅ |
| `reheat` | voice/simple_affix | heatre | ✅ | reheat | ✅ |
| `steamer` | voice/simple_affix | ersteam | ✅ | steamer | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:heater
*expect: turn · turn_ended: True · 27.1s · audio: 1607044 b64 bytes*
*note: voice item (simple_affix)*

> Hi! Today we put words together from their parts. The board shows word parts and what each one means. I tell you what a word means, and you put the parts together in your head and say the whole word. Every part carries a piece of what the word means, and the parts go in order: the front, then the middle, then the last part. Here is what the word means: This machine makes a cold room feel warm and cozy. Your turn. Say the whole word.

### wrong:heater
*expect: turn · turn_ended: True · 17.0s · audio: 1008644 b64 bytes*
*note: student says "erheat"*

> My turn: take the meaning apart. One part means warm energy. One part means a tool. Here it is in a sentence: We turned on the hmm because the house was freezing. Your turn. Find those parts on the board and say the whole word.

### right:heater
*expect: turn · turn_ended: True · 4.3s · audio: 182404 b64 bytes*
*note: student says "heater"*

> Yes, heater — heat, er.

### ask:cooler
*expect: turn · turn_ended: True · 8.6s · audio: 433924 b64 bytes*
*note: voice item (simple_affix)*

> Here is what the word means: This box is filled with ice to keep your food from getting warm. Your turn. Say the whole word.

### wrong:cooler
*expect: turn · turn_ended: True · 17.2s · audio: 1005444 b64 bytes*
*note: student says "ercool"*

> My turn: take the meaning apart. One part means low temperature. One part means a tool. Here it is in a sentence: Put the juice inside the hmm so it stays cold during the picnic. Your turn. Find those parts on the board and say the whole word.

### right:cooler
*expect: turn · turn_ended: True · 4.5s · audio: 202244 b64 bytes*
*note: student says "cooler"*

> Yes, cooler — cool, er.

### ask:reheat
*expect: turn · turn_ended: True · 9.2s · audio: 444840 b64 bytes*
*note: voice item (simple_affix)*

> Here is what the word means: This is what you do when you want to warm up food you already cooked. Your turn. Say the whole word.

### wrong:reheat
*expect: turn · turn_ended: True · 16.6s · audio: 965764 b64 bytes*
*note: student says "heatre"*

> My turn: take the meaning apart. One part means again. One part means warm energy. Here it is in a sentence: I will hmm the leftover soup in the microwave for lunch. Your turn. Find those parts on the board and say the whole word.

### right:reheat
*expect: turn · turn_ended: True · 4.3s · audio: 177284 b64 bytes*
*note: student says "reheat"*

> Yes, reheat — re, heat.

### ask:steamer
*expect: turn · turn_ended: True · 8.9s · audio: 464004 b64 bytes*
*note: voice item (simple_affix)*

> Here is what the word means: This pot uses hot gas from boiling water to cook your dinner. Your turn. Say the whole word.

### wrong:steamer
*expect: turn · turn_ended: True · 16.4s · audio: 971524 b64 bytes*
*note: student says "ersteam"*

> My turn: take the meaning apart. One part means hot gas. One part means a tool. Here it is in a sentence: Mom put the vegetables in the hmm to make them soft and hot. Your turn. Find those parts on the board and say the whole word.

### right:steamer
*expect: turn · turn_ended: True · 4.2s · audio: 175400 b64 bytes*
*note: student says "steamer"*

> Yes, steamer — steam, er.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 423044 b64 bytes*

> Great work with word parts today. Once you know the parts, you can work out words you have never seen before. See you next time!
