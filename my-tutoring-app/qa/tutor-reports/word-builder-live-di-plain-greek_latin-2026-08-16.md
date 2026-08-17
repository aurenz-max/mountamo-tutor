# Tier-3 Live Tutor Report — word-builder — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-builder", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `thermal` | voice/greek_latin | altherm | ✅ | thermal | ✅ |
| `microscope` | voice/greek_latin | scopemicro | ✅ | microscope | ✅ |
| `atmosphere` | voice/greek_latin | sphereatmo | ✅ | atmosphere | ✅ |
| `metamorphic` | voice/greek_latin | icmorphmeta | ✅ | metamorphic | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:thermal
*expect: turn · turn_ended: True · 25.0s · audio: 1495044 b64 bytes*
*note: voice item (greek_latin)*

> Hi! Today we put words together from their parts. The board shows word parts and what each one means. I tell you what a word means, and you put the parts together in your head and say the whole word. Every part carries a piece of what the word means, and the parts go in order: the front, then the middle, then the last part. Here is what the word means: Describing things that have to do with heat energy. Your turn. Say the whole word.

### wrong:thermal
*expect: turn · turn_ended: True · 16.9s · audio: 1000324 b64 bytes*
*note: student says "altherm"*

> My turn: take the meaning apart. One part means heat. One part means relating to. Here it is in a sentence: The scientist wore hmm gloves to protect her hands from the boiling water. Your turn. Find those parts on the board and say the whole word.

### right:thermal
*expect: turn · turn_ended: True · 4.0s · audio: 179204 b64 bytes*
*note: student says "thermal"*

> Yes, thermal — therm, al.

### ask:microscope
*expect: turn · turn_ended: True · 8.8s · audio: 445444 b64 bytes*
*note: voice item (greek_latin)*

> Here is what the word means: A tool that makes very small things look much larger. Your turn. Say the whole word.

### wrong:microscope
*expect: turn · turn_ended: True · 17.0s · audio: 1008680 b64 bytes*
*note: student says "scopemicro"*

> My turn: take the meaning apart. One part means small. One part means look or see. Here it is in a sentence: We can see the tiny cells of a leaf by looking through a hmm. Your turn. Find those parts on the board and say the whole word.

### right:microscope
*expect: turn · turn_ended: True · 4.4s · audio: 197124 b64 bytes*
*note: student says "microscope"*

> Yes, microscope — micro, scope.

### ask:atmosphere
*expect: turn · turn_ended: True · 8.9s · audio: 453764 b64 bytes*
*note: voice item (greek_latin)*

> Here is what the word means: The air that wraps around our whole planet like a blanket. Your turn. Say the whole word.

### wrong:atmosphere
*expect: turn · turn_ended: True · 16.7s · audio: 964484 b64 bytes*
*note: student says "sphereatmo"*

> My turn: take the meaning apart. One part means vapor. One part means ball. Here it is in a sentence: The moon has almost no hmm so there is no air to breathe there. Your turn. Find those parts on the board and say the whole word.

### right:atmosphere
*expect: turn · turn_ended: True · 4.9s · audio: 195204 b64 bytes*
*note: student says "atmosphere"*

> Yes, atmosphere — atmo, sphere.

### ask:metamorphic
*expect: turn · turn_ended: True · 9.4s · audio: 496004 b64 bytes*
*note: voice item (greek_latin)*

> Here is what the word means: Describing a type of rock that has changed its form through heat or pressure. Your turn. Say the whole word.

### wrong:metamorphic
*expect: turn · turn_ended: True · 18.2s · audio: 1068804 b64 bytes*
*note: student says "icmorphmeta"*

> My turn: take the meaning apart. One part means change. One part means shape. One part means relating to. Here it is in a sentence: Marble is a hmm rock that was once made of simple limestone. Your turn. Find those parts on the board and say the whole word.

### right:metamorphic
*expect: turn · turn_ended: True · 4.8s · audio: 220804 b64 bytes*
*note: student says "metamorphic"*

> Yes, metamorphic — meta, morph, ic.

### complete
*expect: turn · turn_ended: True · 8.5s · audio: 432004 b64 bytes*

> Great work
