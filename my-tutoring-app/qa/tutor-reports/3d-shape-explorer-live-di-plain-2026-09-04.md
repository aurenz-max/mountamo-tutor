# Tier-3 Live Tutor Report — 3d-shape-explorer — 2026-09-04

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "3d-shape-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `riddle-1:riddle:0` | voice/solve_riddle | triangle | ✅ | cube | ✅ |
| `riddle-2:riddle:0` | voice/solve_riddle | triangle | ✅ | sphere | ✅ |
| `riddle-3:riddle:0` | voice/solve_riddle | triangle | ✅ | cylinder | ✅ |
| `riddle-4:riddle:0` | voice/solve_riddle | triangle | ✅ | cone | ✅ |
| `riddle-5:riddle:0` | voice/solve_riddle | triangle | ✅ | rectangular prism | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:riddle-1:riddle:0
*expect: turn · turn_ended: True · 16.8s · audio: 986244 b64 bytes*
*note: voice item (solve_riddle)*

> Hi! Let us explore solid shapes. Look or listen, then say one answer out loud. I have six flat faces. Every flat face is a square. I can stack, but I do not roll smoothly. What solid shape am I?

### wrong:riddle-1:riddle:0
*expect: turn · turn_ended: True · 15.7s · audio: 930564 b64 bytes*
*note: student says "triangle"*

> My turn: I use every clue, especially the one that tells similar solids apart. The answer is cube. I have six flat faces. Every flat face is a square. I can stack, but I do not roll smoothly. What solid shape am I?

### right:riddle-1:riddle:0
*expect: turn · turn_ended: True · 3.2s · audio: 119044 b64 bytes*
*note: student says "cube"*

> Yes, it is a cube!

### ask:riddle-2:riddle:0
*expect: turn · turn_ended: True · 9.0s · audio: 487080 b64 bytes*
*note: voice item (solve_riddle)*

> I have no flat faces. I have one curved surface. I can roll in every direction. What solid shape am I?

### wrong:riddle-2:riddle:0
*expect: turn · turn_ended: True · 15.2s · audio: 887684 b64 bytes*
*note: student says "triangle"*

> My turn: I use every clue, especially the one that tells similar solids apart. The answer is sphere. I have no flat faces. I have one curved surface. I can roll in every direction. What solid shape am I?

### right:riddle-2:riddle:0
*expect: turn · turn_ended: True · 3.7s · audio: 122884 b64 bytes*
*note: student says "sphere"*

> Yes, it is a sphere.

### ask:riddle-3:riddle:0
*expect: turn · turn_ended: True · 10.2s · audio: 510724 b64 bytes*
*note: voice item (solve_riddle)*

> I have two flat circular faces. I have one curved surface. I can roll and I can stack. What solid shape am I?

### wrong:riddle-3:riddle:0
*expect: turn · turn_ended: True · 15.8s · audio: 933124 b64 bytes*
*note: student says "triangle"*

> My turn: I use every clue, especially the one that tells similar solids apart. The answer is cylinder. I have two flat circular faces. I have one curved surface. I can roll and I can stack. What solid shape am I?

### right:riddle-3:riddle:0
*expect: turn · turn_ended: True · 3.6s · audio: 117764 b64 bytes*
*note: student says "cylinder"*

> Yes, it is a cylinder!

### ask:riddle-4:riddle:0
*expect: turn · turn_ended: True · 9.3s · audio: 480644 b64 bytes*
*note: voice item (solve_riddle)*

> I have one flat circular face. I have one point. I can roll, but I do not stack. What solid shape am I?

### wrong:riddle-4:riddle:0
*expect: turn · turn_ended: True · 15.1s · audio: 887684 b64 bytes*
*note: student says "triangle"*

> My turn: I use every clue, especially the one that tells similar solids apart. The answer is cone. I have one flat circular face. I have one point. I can roll, but I do not stack. What solid shape am I?

### right:riddle-4:riddle:0
*expect: turn · turn_ended: True · 4.0s · audio: 113924 b64 bytes*
*note: student says "cone"*

> Yes, it is a cone.

### ask:riddle-5:riddle:0
*expect: turn · turn_ended: True · 10.6s · audio: 533124 b64 bytes*
*note: voice item (solve_riddle)*

> I have six flat faces. Every flat face is a rectangle. I can stack, but I do not roll smoothly. What solid shape am I?

### wrong:riddle-5:riddle:0
*expect: turn · turn_ended: True · 16.9s · audio: 991364 b64 bytes*
*note: student says "triangle"*

> My turn: I use every clue, especially the one that tells similar solids apart. The answer is rectangular prism. I have six flat faces. Every flat face is a rectangle. I can stack, but I do not roll smoothly. What solid shape am I?

### right:riddle-5:riddle:0
*expect: turn · turn_ended: True · 4.0s · audio: 154884 b64 bytes*
*note: student says "rectangular prism"*

> Yes, it is a rectangular prism.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 313604 b64 bytes*

> Great shape work today! You told me every answer out loud. See you next time!
