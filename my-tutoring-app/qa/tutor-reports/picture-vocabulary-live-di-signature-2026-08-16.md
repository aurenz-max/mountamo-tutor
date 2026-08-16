# Tier-3 Live Tutor Report — picture-vocabulary — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "picture-vocabulary", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "kindergarten"}`
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
| `pv-1` | voice/sentence_frame | table | ✅ | bed | ✅ |
| `pv-2` | voice/sentence_frame | table | ✅ | chair | ✅ |
| `pv-3` | voice/sentence_frame | table | ✅ | clock | ✅ |
| `pv-4` | voice/sentence_frame | table | ✅ | soap | ✅ |
| `pv-5` | voice/sentence_frame | table | ✅ | lamp | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pv-1
*expect: turn · turn_ended: True · 12.9s · audio: 725764 b64 bytes*
*note: voice item (sentence_frame)*

> Hi! Time to play with words! I say a sentence with a missing word. You say the word that finishes it! Listen: I sleep in my ... hmm ... at night. Your turn. Say the missing word.

### wrong:pv-1
*expect: turn · turn_ended: True · 6.6s · audio: 339844 b64 bytes*
*note: student says "table" — a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished*

> My turn: I sleep in my bed at night. Bed. Your turn. Say the missing word.

### right:pv-1
*expect: turn · turn_ended: True · 3.3s · audio: 87684 b64 bytes*
*note: student says "bed"*

> Yes, bed.

### ask:pv-2
*expect: turn · turn_ended: True · 7.3s · audio: 345000 b64 bytes*
*note: voice item (sentence_frame)*

> Listen: I sit on a ... hmm ... at the table. Your turn. Say the missing word.

### wrong:pv-2
*expect: turn · turn_ended: True · 6.9s · audio: 359684 b64 bytes*
*note: student says "table" — a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished*

> My turn: I sit on a chair at the table. Chair. Your turn. Say the missing word.

### right:pv-2
*expect: turn · turn_ended: True · 3.4s · audio: 94760 b64 bytes*
*note: student says "chair"*

> Yes, chair.

### ask:pv-3
*expect: turn · turn_ended: True · 7.4s · audio: 369960 b64 bytes*
*note: voice item (sentence_frame)*

> Listen: The ... hmm ... tells us what time it is. Your turn. Say the missing word.

### wrong:pv-3
*expect: turn · turn_ended: True · 7.2s · audio: 370564 b64 bytes*
*note: student says "table" — a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished*

> My turn: The clock tells us what time it is. Clock. Your turn. Say the missing word.

### right:pv-3
*expect: turn · turn_ended: True · 4.6s · audio: 90280 b64 bytes*
*note: student says "clock"*

> Yes, clock.

### ask:pv-4
*expect: turn · turn_ended: True · 7.0s · audio: 345000 b64 bytes*
*note: voice item (sentence_frame)*

> Listen: Wash your hands with water and ... hmm. Your turn. Say the missing word.

### wrong:pv-4
*expect: turn · turn_ended: True · 7.1s · audio: 375684 b64 bytes*
*note: student says "table" — a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished*

> My turn: Wash your hands with water and soap. Soap. Your turn. Say the missing word.

### right:pv-4
*expect: turn · turn_ended: True · 3.3s · audio: 89604 b64 bytes*
*note: student says "soap"*

> Yes, soap.

### ask:pv-5
*expect: turn · turn_ended: True · 8.0s · audio: 360360 b64 bytes*
*note: voice item (sentence_frame)*

> Listen: Turn on the ... hmm ... to see in the dark. Your turn. Say the missing word.

### wrong:pv-5
*expect: turn · turn_ended: True · 7.0s · audio: 367364 b64 bytes*
*note: student says "table" — a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished*

> My turn: Turn on the lamp to see in the dark. Lamp. Your turn. Say the missing word.

### right:pv-5
*expect: turn · turn_ended: True · 3.3s · audio: 92840 b64 bytes*
*note: student says "lamp"*

> Yes, lamp.

### complete
*expect: turn · turn_ended: True · 7.1s · audio: 357764 b64 bytes*

> What wonderful word work today! Your words grew bigger and stronger. See you next time!
