# Tier-3 Live Tutor Report — word-builder — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-builder", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `instruction` | voice/multi_morpheme | ionstructin | ✅ | instruction | ✅ |
| `predictable` | voice/multi_morpheme | abledictpre | ✅ | predictable | ✅ |
| `interruption` | voice/multi_morpheme | ionruptinter | ✅ | interruption | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:instruction
*expect: turn · turn_ended: True · 26.5s · audio: 1594884 b64 bytes*
*note: voice item (multi_morpheme)*

> Hi! Today we put words together from their parts. The board shows word parts and what each one means. I tell you what a word means, and you put the parts together in your head and say the whole word. Every part carries a piece of what the word means, and the parts go in order: the front, then the middle, then the last part. Here is what the word means: This tells you the specific steps to take during your matter experiment. Your turn. Say the whole word.

### wrong:instruction
*expect: turn · turn_ended: True · 17.6s · audio: 1046404 b64 bytes*
*note: student says "ionstructin"*

> My turn: take the meaning apart. One part means into. One part means build. One part means act of. Here it is in a sentence: We must follow every hmm to safely turn the liquid into a gas. Your turn. Find those parts on the board and say the whole word.

### right:instruction
*expect: turn · turn_ended: True · 5.2s · audio: 248324 b64 bytes*
*note: student says "instruction"*

> Yes, instruction — in, struct, ion.

### ask:predictable
*expect: turn · turn_ended: True · 9.2s · audio: 494724 b64 bytes*
*note: voice item (multi_morpheme)*

> Here is what the word means: This describes a change that we can always expect to happen when we add heat. Your turn. Say the whole word.

### wrong:predictable
*expect: turn · turn_ended: True · 18.5s · audio: 1100804 b64 bytes*
*note: student says "abledictpre"*

> My turn: take the meaning apart. One part means before. One part means speak. One part means able to be. Here it is in a sentence: The way water turns into steam at a high temperature is very hmm. Your turn. Find those parts on the board and say the whole word.

### right:predictable
*expect: turn · turn_ended: True · 4.9s · audio: 237444 b64 bytes*
*note: student says "predictable"*

> Yes, predictable — pre, dict, able.

### ask:interruption
*expect: turn · turn_ended: True · 9.1s · audio: 480004 b64 bytes*
*note: voice item (multi_morpheme)*

> Here is what the word means: This happens when the steady flow of a liquid is suddenly broken or stopped. Your turn. Say the whole word.

### wrong:interruption
*expect: turn · turn_ended: True · 18.0s · audio: 1074564 b64 bytes*
*note: student says "ionruptinter"*

> My turn: take the meaning apart. One part means between. One part means break. One part means act of. Here it is in a sentence: The frozen ice caused an hmm in the flow of water through the garden hose. Your turn. Find those parts on the board and say the whole word.

### right:interruption
*expect: turn · turn_ended: True · 5.8s · audio: 273284 b64 bytes*
*note: student says "interruption"*

> Yes, interruption — inter, rupt, ion.

### complete
*expect: turn · turn_ended: True · 10.7s · audio: 600964 b64 bytes*

> Great work
