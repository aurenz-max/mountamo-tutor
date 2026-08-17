# Tier-3 Live Tutor Report — word-builder — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-builder", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "unheated", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:unheated 1/1, wrong3:unheated 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `unheated` | voice/compound_affix | edheatun | ✅✅✅ | - | n/a |
| `precooling` | voice/compound_affix | ingcoolpre | ✅ | precooling | ✅ |
| `intermixing` | voice/compound_affix | ingmixinter | ✅ | intermixing | ✅ |
| `displacement` | voice/compound_affix | mentplacedis | ✅ | displacement | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:unheated
*expect: turn · turn_ended: True · 28.2s · audio: 1711364 b64 bytes*
*note: voice item (compound_affix)*

> Hi! Today we put words together from their parts. The board shows word parts and what each one means. I tell you what a word means, and you put the parts together in your head and say the whole word. Every part carries a piece of what the word means, and the parts go in order: the front, then the middle, then the last part. Here is what the word means: This describes matter that has not been warmed up. Your turn. Say the whole word.

### wrong1:unheated
*expect: turn · turn_ended: True · 19.2s · audio: 1146244 b64 bytes*
*note: student says "edheatun"*

> My turn: take the meaning apart. One part means not. One part means warmth. One part means happened. Here it is in a sentence: The hmm metal felt cold to the touch before the experiment started. Your turn. Find those parts on the board and say the whole word.

### wrong2:unheated
*expect: turn · turn_ended: True · 19.6s · audio: 1180160 b64 bytes*
*note: student says "edheatun"*

> My turn: take the meaning apart. One part means not. One part means warmth. One part means happened. Here it is in a sentence: The hmm metal felt cold to the touch before the experiment started. Your turn. Find those parts on the board and say the whole word.

### wrong3:unheated
*expect: turn · turn_ended: True · 19.2s · audio: 1150724 b64 bytes*
*note: student says "edheatun"*

> My turn: take the meaning apart. One part means not. One part means warmth. One part means happened. Here it is in a sentence: The hmm metal felt cold to the touch before the experiment started. Your turn. Find those parts on the board and say the whole word.

### moveon:unheated
*expect: turn · turn_ended: True · 18.8s · audio: 1096324 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! The word is unheated — un means not, heat means warmth, and ed means happened. Here comes the next one. Here is what the word means: The act of lowering the temperature of something before starting a process. Your turn. Say the whole word.

### wrong:precooling
*expect: turn · turn_ended: True · 18.5s · audio: 1088644 b64 bytes*
*note: student says "ingcoolpre"*

> My turn: take the meaning apart. One part means before. One part means chilly. One part means doing. Here it is in a sentence: Scientists start hmm the gas before it turns into a liquid. Your turn. Find those parts on the board and say the whole word.

### right:precooling
*expect: turn · turn_ended: True · 4.9s · audio: 231044 b64 bytes*
*note: student says "precooling"*

> Yes, precooling — pre, cool, ing.

### ask:intermixing
*expect: turn · turn_ended: True · 9.2s · audio: 493444 b64 bytes*
*note: voice item (compound_affix)*

> Here is what the word means: The process of different types of matter blending together. Your turn. Say the whole word.

### wrong:intermixing
*expect: turn · turn_ended: True · 18.4s · audio: 1098884 b64 bytes*
*note: student says "ingmixinter"*

> My turn: take the meaning apart. One part means between. One part means blend. One part means doing. Here it is in a sentence: The hmm of the two liquids happened as soon as they touched. Your turn. Find those parts on the board and say the whole word.

### right:intermixing
*expect: turn · turn_ended: True · 5.8s · audio: 260484 b64 bytes*
*note: student says "intermixing"*

> Yes, intermixing — inter, mix, ing.

### ask:displacement
*expect: turn · turn_ended: True · 9.8s · audio: 531204 b64 bytes*
*note: voice item (compound_affix)*

> Here is what the word means: The act of matter moving from its original spot when something else is added. Your turn. Say the whole word.

### wrong:displacement
*expect: turn · turn_ended: True · 19.1s · audio: 1130244 b64 bytes*
*note: student says "mentplacedis"*

> My turn: take the meaning apart. One part means apart. One part means spot. One part means act of. Here it is in a sentence: The water rose in the cup because of hmm when we dropped the stone. Your turn. Find those parts on the board and say the whole word.

### right:displacement
*expect: turn · turn_ended: True · 5.5s · audio: 264324 b64 bytes*
*note: student says "displacement"*

> Yes, displacement — dis, place, ment.

### complete
*expect: turn · turn_ended: True · 7.9s · audio: 427524 b64 bytes*

> Great work with word parts today. Once you know the parts, you can work out words you have never seen before. See you next time!
