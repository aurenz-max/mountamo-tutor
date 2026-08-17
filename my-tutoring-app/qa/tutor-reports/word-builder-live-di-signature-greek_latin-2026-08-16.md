# Tier-3 Live Tutor Report — word-builder — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-builder", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `thermometer` | voice/greek_latin | thermo | ✅ | thermometer | ✅ |
| `microscope` | voice/greek_latin | micro | ✅ | microscope | ✅ |
| `atmosphere` | voice/greek_latin | atmo | ✅ | atmosphere | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:thermometer
*expect: turn · turn_ended: True · 27.2s · audio: 1646724 b64 bytes*
*note: voice item (greek_latin)*

> Hi! Today we put words together from their parts. The board shows word parts and what each one means. I tell you what a word means, and you put the parts together in your head and say the whole word. Every part carries a piece of what the word means, and the parts go in order: the front, then the middle, then the last part. Here is what the word means: This instrument measures how hot or cold a substance is. Your turn. Say the whole word.

### wrong:thermometer
*expect: turn · turn_ended: True · 17.4s · audio: 1025924 b64 bytes*
*note: student says "thermo" — the root said straight back — it is one of the cards on the board, it carries the target word's core meaning, and the tutor's own correction says what it means out loud, so a judge listening for "did they say something from the parts" affirms it. The contract names this miss by name*

> My turn: take the meaning apart. One part means heat. One part means measure. Here it is in a sentence: We used a hmm to see if the water was hot enough to turn into steam. Your turn. Find those parts on the board and say the whole word.

### right:thermometer
*expect: turn · turn_ended: True · 4.3s · audio: 200324 b64 bytes*
*note: student says "thermometer"*

> Yes, thermometer — thermo, meter.

### ask:microscope
*expect: turn · turn_ended: True · 9.6s · audio: 522920 b64 bytes*
*note: voice item (greek_latin)*

> Here is what the word means: This tool helps you see tiny particles of matter that are too small for your eyes. Your turn. Say the whole word.

### wrong:microscope
*expect: turn · turn_ended: True · 17.0s · audio: 1010564 b64 bytes*
*note: student says "micro" — the root said straight back — it is one of the cards on the board, it carries the target word's core meaning, and the tutor's own correction says what it means out loud, so a judge listening for "did they say something from the parts" affirms it. The contract names this miss by name*

> My turn: take the meaning apart. One part means small. One part means look at. Here it is in a sentence: The scientist used a hmm to look at the tiny crystals in the solid. Your turn. Find those parts on the board and say the whole word.

### right:microscope
*expect: turn · turn_ended: True · 5.5s · audio: 209284 b64 bytes*
*note: student says "microscope"*

> Yes, microscope — micro, scope.

### ask:atmosphere
*expect: turn · turn_ended: True · 10.0s · audio: 528004 b64 bytes*
*note: voice item (greek_latin)*

> Here is what the word means: This word describes the layer of gas that surrounds a planet like a giant shell. Your turn. Say the whole word.

### wrong:atmosphere
*expect: turn · turn_ended: True · 16.5s · audio: 983044 b64 bytes*
*note: student says "atmo" — the root said straight back — it is one of the cards on the board, it carries the target word's core meaning, and the tutor's own correction says what it means out loud, so a judge listening for "did they say something from the parts" affirms it. The contract names this miss by name*

> My turn: take the meaning apart. One part means vapor. One part means ball. Here it is in a sentence: The air in our hmm is a mix of different gases like oxygen. Your turn. Find those parts on the board and say the whole word.

### right:atmosphere
*expect: turn · turn_ended: True · 4.5s · audio: 198404 b64 bytes*
*note: student says "atmosphere"*

> Yes, atmosphere — atmo, sphere.

### complete
*expect: turn · turn_ended: True · 8.1s · audio: 442244 b64 bytes*

> Great work
