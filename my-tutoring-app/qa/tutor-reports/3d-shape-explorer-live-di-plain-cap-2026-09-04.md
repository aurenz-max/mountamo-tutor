# Tier-3 Live Tutor Report — 3d-shape-explorer — 2026-09-04

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "3d-shape-explorer", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "fallback-properties:property:0:flatFaces", "grade": "Kindergarten", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:fallback-properties:property:0:flatFaces 1/1, wrong3:fallback-properties:property:0:flatFaces 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:fallback-properties:property:0:flatFaces 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `fallback-properties:property:0:flatFaces` | voice/count_property | triangle | ✅✅✅ | - | n/a |
| `fallback-properties:property:1:curvedSurfaces` | voice/count_property | triangle | ✅ | one | ✅ |
| `fallback-properties:property:2:faceShape` | voice/name_face_shape | triangle | ✅ | circle | ✅ |
| `fallback-properties:property:3:canStack` | voice/judge_property | no | ✅ | yes | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:fallback-properties:property:0:flatFaces
*expect: turn · turn_ended: True · 12.5s · audio: 700804 b64 bytes*
*note: voice item (count_property)*

> Hi! Welcome to the shape lab. Look or listen, then say your answer out loud. This is a cylinder. Look carefully at every flat face. How many flat faces?

### wrong1:fallback-properties:property:0:flatFaces
*expect: turn · turn_ended: True · 11.6s · audio: 649604 b64 bytes*
*note: student says "triangle"*

> My turn: I touch each flat face exactly once and count two. This is a cylinder. Look carefully at every flat face. How many flat faces?

### wrong2:fallback-properties:property:0:flatFaces
*expect: turn · turn_ended: True · 11.4s · audio: 654084 b64 bytes*
*note: student says "triangle"*

> My turn: I touch each flat face exactly once and count two. This is a cylinder. Look carefully at every flat face. How many flat faces?

### wrong3:fallback-properties:property:0:flatFaces
*expect: turn · turn_ended: True · 11.7s · audio: 650884 b64 bytes*
*note: student says "triangle"*

> My turn: I touch each flat face exactly once and count two. This is a cylinder. Look carefully at every flat face. How many flat faces?

### moveon:fallback-properties:property:0:flatFaces
*expect: turn · turn_ended: True · 10.4s · audio: 556804 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next question. This is a cylinder. Look carefully at every curved surface. How many curved surfaces?

### wrong:fallback-properties:property:1:curvedSurfaces
*expect: turn · turn_ended: True · 11.7s · audio: 671364 b64 bytes*
*note: student says "triangle"*

> My turn: I touch each curved surface exactly once and count one. This is a cylinder. Look carefully at every curved surface. How many curved surfaces?

### right:fallback-properties:property:1:curvedSurfaces
*expect: turn · turn_ended: True · 4.8s · audio: 208004 b64 bytes*
*note: student says "one"*

> Yes, this cylinder has one curved surface.

### ask:fallback-properties:property:2:faceShape
*expect: turn · turn_ended: True · 8.5s · audio: 419844 b64 bytes*
*note: voice item (name_face_shape)*

> Look or listen, then say your answer out loud. This is a cylinder. What shape is each flat face?

### wrong:fallback-properties:property:2:faceShape
*expect: turn · turn_ended: True · 9.9s · audio: 552324 b64 bytes*
*note: student says "triangle"*

> My turn: I name the flat face, not the solid. Each flat face is a circle. This is a cylinder. What shape is each flat face?

### right:fallback-properties:property:2:faceShape
*expect: turn · turn_ended: True · 3.9s · audio: 163844 b64 bytes*
*note: student says "circle"*

> Yes, each flat face is a circle.

### ask:fallback-properties:property:3:canStack
*expect: turn · turn_ended: True · 8.4s · audio: 429444 b64 bytes*
*note: voice item (judge_property)*

> Look or listen, then say your answer out loud. This is a cylinder. Could it stack? Tell me yes or no.

### wrong:fallback-properties:property:3:canStack
*expect: turn · turn_ended: True · 7.4s · audio: 388484 b64 bytes*
*note: student says "no"*

> My turn: the cylinder can stack. This is a cylinder. Could it stack? Tell me yes or no.

### right:fallback-properties:property:3:canStack
*expect: turn · turn_ended: True · 3.4s · audio: 101124 b64 bytes*
*note: student says "yes"*

> Yes, it can stack.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 302724 b64 bytes*

> Great shape work today! You told me every answer out loud. See you next time!
