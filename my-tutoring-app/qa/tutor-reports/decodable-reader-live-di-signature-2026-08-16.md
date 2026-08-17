# Tier-3 Live Tutor Report — decodable-reader — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "decodable-reader", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 1"}`
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
| `line-s1` | voice/read_line | We have a cute frog at home. | ✅ | They have a cute frog at home. | ✅ |
| `line-s2` | voice/read_line | Her frog can hop on a rug. | ✅ | His frog can hop on a rug. | ✅ |
| `line-s3` | voice/read_line | A fish is in the tank. | ✅ | The fish is in the tank. | ✅ |
| `line-s4` | voice/read_line | His dog can run with them. | ✅ | Her dog can run with them. | ✅ |
| `line-s5` | voice/read_line | What fun we share! | ✅ | What fun they share! | ✅ |
| `q-1` | voice/answer_spoken | share | ✅ | tank | ✅ |
| `q-2` | voice/answer_spoken | share | ✅ | rug | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:line-s1
*expect: turn · turn_ended: True · 9.1s · audio: 490244 b64 bytes*
*note: voice item (read_line)*

> Hi! Time for a story! I show you one line of our story. You read it out loud, all by yourself! Your turn. Read it.

### wrong:line-s1
*expect: turn · turn_ended: True · 6.8s · audio: 355204 b64 bytes*
*note: student says "We have a cute frog at home." — one small word swapped for another — the miss the reading contract calls the commonest one there is. It keeps the meaning, it keeps the rhythm, and a judge grading the read for gist rather than word by word affirms it, which is the whole thing this pack exists not to do*

> My turn: not We — They have a cute frog at home. Your turn. Read it again.

### right:line-s1
*expect: turn · turn_ended: True · 4.6s · audio: 218244 b64 bytes*
*note: student says "They have a cute frog at home."*

> Yes, that says They have a cute frog at home.

### ask:line-s2
*expect: turn · turn_ended: True · 3.9s · audio: 113320 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s2
*expect: turn · turn_ended: True · 6.9s · audio: 366084 b64 bytes*
*note: student says "Her frog can hop on a rug." — one small word swapped for another — the miss the reading contract calls the commonest one there is. It keeps the meaning, it keeps the rhythm, and a judge grading the read for gist rather than word by word affirms it, which is the whole thing this pack exists not to do*

> My turn: not Her — His frog can hop on a rug. Your turn. Read it again.

### right:line-s2
*expect: turn · turn_ended: True · 4.9s · audio: 215684 b64 bytes*
*note: student says "His frog can hop on a rug."*

> Yes, that says His frog can hop on a rug.

### ask:line-s3
*expect: turn · turn_ended: True · 3.6s · audio: 108804 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s3
*expect: turn · turn_ended: True · 6.7s · audio: 353284 b64 bytes*
*note: student says "A fish is in the tank." — one small word swapped for another — the miss the reading contract calls the commonest one there is. It keeps the meaning, it keeps the rhythm, and a judge grading the read for gist rather than word by word affirms it, which is the whole thing this pack exists not to do*

> My turn: not A — The fish is in the tank. Your turn. Read it again.

### right:line-s3
*expect: turn · turn_ended: True · 4.5s · audio: 194564 b64 bytes*
*note: student says "The fish is in the tank."*

> Yes, that says The fish is in the tank.

### ask:line-s4
*expect: turn · turn_ended: True · 3.5s · audio: 108840 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s4
*expect: turn · turn_ended: True · 6.9s · audio: 364164 b64 bytes*
*note: student says "His dog can run with them." — one small word swapped for another — the miss the reading contract calls the commonest one there is. It keeps the meaning, it keeps the rhythm, and a judge grading the read for gist rather than word by word affirms it, which is the whole thing this pack exists not to do*

> My turn: not His — Her dog can run with them. Your turn. Read it again.

### right:line-s4
*expect: turn · turn_ended: True · 4.3s · audio: 200964 b64 bytes*
*note: student says "Her dog can run with them."*

> Yes, that says Her dog can run with them.

### ask:line-s5
*expect: turn · turn_ended: True · 3.9s · audio: 115844 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s5
*expect: turn · turn_ended: True · 6.5s · audio: 341124 b64 bytes*
*note: student says "What fun we share!" — one small word swapped for another — the miss the reading contract calls the commonest one there is. It keeps the meaning, it keeps the rhythm, and a judge grading the read for gist rather than word by word affirms it, which is the whole thing this pack exists not to do*

> My turn: not we — What fun they share! Your turn. Read it again.

### right:line-s5
*expect: turn · turn_ended: True · 4.0s · audio: 181764 b64 bytes*
*note: student says "What fun they share!"*

> Yes, that says What fun they share!

### ask:q-1
*expect: turn · turn_ended: True · 7.6s · audio: 355844 b64 bytes*
*note: voice item (answer_spoken)*

> Now I ask you about the story, and you tell me out loud! Your turn. Where is the fish?

### wrong:q-1
*expect: turn · turn_ended: True · 8.5s · audio: 332164 b64 bytes*
*note: student says "share" — a word lifted straight out of the story — out of the very sentence the real answer lives in — that does not answer the question. The contract names this one and says why it is hard: it sounds right BECAUSE it came from the text, so a judge checking only "did I hear a story word" affirms it*

> My turn: The fish is in the tank. Tank. Your turn. Where is the fish?

### right:q-1
*expect: turn · turn_ended: True · 3.4s · audio: 84484 b64 bytes*
*note: student says "tank"*

> Yes, tank.

### ask:q-2
*expect: turn · turn_ended: True · 4.2s · audio: 150404 b64 bytes*
*note: voice item (answer_spoken)*

> Your turn. What can the frog hop on?

### wrong:q-2
*expect: turn · turn_ended: True · 7.0s · audio: 362244 b64 bytes*
*note: student says "share" — a word lifted straight out of the story — out of the very sentence the real answer lives in — that does not answer the question. The contract names this one and says why it is hard: it sounds right BECAUSE it came from the text, so a judge checking only "did I hear a story word" affirms it*

> My turn: His frog can hop on a rug. Rug. Your turn. What can the frog hop on?

### right:q-2
*expect: turn · turn_ended: True · 3.1s · audio: 85764 b64 bytes*
*note: student says "rug"*

> Yes, rug.

### complete
*expect: turn · turn_ended: True · 5.6s · audio: 284804 b64 bytes*

> You read the whole story and you knew all about it. Great reading today!
