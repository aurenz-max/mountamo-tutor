# Tier-3 Live Tutor Report — decodable-reader — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "decodable-reader", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 1"}`
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
| `line-s1` | voice/read_line | They have a cute frog at box. | ✅ | They have a cute frog at home. | ✅ |
| `line-s2` | voice/read_line | His frog can hop on a box. | ✅ | His frog can hop on a rug. | ✅ |
| `line-s3` | voice/read_line | The fish is in the box. | ✅ | The fish is in the tank. | ✅ |
| `line-s4` | voice/read_line | Her cat likes to box. | ✅ | Her cat likes to nap. | ✅ |
| `line-s5` | voice/read_line | We said hello with a box. | ✅ | We said hello with a grin. | ✅ |
| `q-1` | voice/answer_spoken | rocket | ✅ | rug | ✅ |
| `q-2` | voice/answer_spoken | rocket | ✅ | fish | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:line-s1
*expect: turn · turn_ended: True · 8.8s · audio: 477444 b64 bytes*
*note: voice item (read_line)*

> Hi! Time for a story! I show you one line of our story. You read it out loud, all by yourself! Your turn. Read it.

### wrong:line-s1
*expect: turn · turn_ended: True · 7.1s · audio: 381444 b64 bytes*
*note: student says "They have a cute frog at box."*

> My turn: not box — They have a cute frog at home. Your turn. Read it again.

### right:line-s1
*expect: turn · turn_ended: True · 4.1s · audio: 188200 b64 bytes*
*note: student says "They have a cute frog at home."*

> Yes, that says They have a cute frog at home.

### ask:line-s2
*expect: turn · turn_ended: True · 4.3s · audio: 96644 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s2
*expect: turn · turn_ended: True · 7.4s · audio: 371204 b64 bytes*
*note: student says "His frog can hop on a box."*

> My turn: not box — His frog can hop on a rug. Your turn. Read it again.

### right:line-s2
*expect: turn · turn_ended: True · 4.0s · audio: 179880 b64 bytes*
*note: student says "His frog can hop on a rug."*

> Yes, that says His frog can hop on a rug.

### ask:line-s3
*expect: turn · turn_ended: True · 3.6s · audio: 101764 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s3
*expect: turn · turn_ended: True · 6.8s · audio: 339204 b64 bytes*
*note: student says "The fish is in the box."*

> My turn: not box — The fish is in the tank. Your turn. Read it again.

### right:line-s3
*expect: turn · turn_ended: True · 3.7s · audio: 151720 b64 bytes*
*note: student says "The fish is in the tank."*

> Yes, that says The fish is in the tank.

### ask:line-s4
*expect: turn · turn_ended: True · 3.9s · audio: 147844 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s4
*expect: turn · turn_ended: True · 7.0s · audio: 359684 b64 bytes*
*note: student says "Her cat likes to box."*

> My turn: not box — Her cat likes to nap. Your turn. Read it again.

### right:line-s4
*expect: turn · turn_ended: True · 3.8s · audio: 169640 b64 bytes*
*note: student says "Her cat likes to nap."*

> Yes, that says Her cat likes to nap.

### ask:line-s5
*expect: turn · turn_ended: True · 3.7s · audio: 113924 b64 bytes*
*note: voice item (read_line)*

> Your turn. Read it.

### wrong:line-s5
*expect: turn · turn_ended: True · 7.3s · audio: 387844 b64 bytes*
*note: student says "We said hello with a box."*

> My turn: not box — We said hello with a grin. Your turn. Read it again.

### right:line-s5
*expect: turn · turn_ended: True · 4.1s · audio: 190120 b64 bytes*
*note: student says "We said hello with a grin."*

> Yes, that says We said hello with a grin.

### ask:q-1
*expect: turn · turn_ended: True · 7.0s · audio: 355204 b64 bytes*
*note: voice item (answer_spoken)*

> Now I ask you about the story, and you tell me out loud! Your turn. Where can the frog hop?

### wrong:q-1
*expect: turn · turn_ended: True · 7.6s · audio: 383364 b64 bytes*
*note: student says "rocket"*

> My turn: His frog can hop on a rug. Rug. Your turn. Where can the frog hop?

### right:q-1
*expect: turn · turn_ended: True · 3.2s · audio: 99240 b64 bytes*
*note: student says "rug"*

> Yes, rug.

### ask:q-2
*expect: turn · turn_ended: True · 3.8s · audio: 145284 b64 bytes*
*note: voice item (answer_spoken)*

> Your turn. What is in the tank?

### wrong:q-2
*expect: turn · turn_ended: True · 7.1s · audio: 362244 b64 bytes*
*note: student says "rocket"*

> My turn: The fish is in the tank. Fish. Your turn. What is in the tank?

### right:q-2
*expect: turn · turn_ended: True · 3.6s · audio: 97960 b64 bytes*
*note: student says "fish"*

> Yes, fish.

### complete
*expect: turn · turn_ended: True · 5.6s · audio: 272644 b64 bytes*

> You read the whole story and you knew all about it. Great reading today!
