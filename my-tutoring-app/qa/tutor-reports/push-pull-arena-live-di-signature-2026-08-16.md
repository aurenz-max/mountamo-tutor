# Tier-3 Live Tutor Report — push-pull-arena — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "push-pull-arena", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "Kindergarten"}`
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
| `c1` | voice/experiment | I tried it and it moved | ✅ | little | ✅ |
| `c2` | voice/experiment | I tried it and it moved | ✅ | big | ✅ |
| `c3` | voice/experiment | I tried it and it moved | ✅ | little | ✅ |
| `c4` | voice/experiment | I tried it and it moved | ✅ | big | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 15.1s · audio: 867844 b64 bytes*
*note: voice item (experiment)*

> Hi! Time to explore pushes and pulls! Try your own pushes with the buttons and the slider. Then answer! The Toy Car is on the wood floor. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c1
*expect: turn · turn_ended: True · 7.6s · audio: 403204 b64 bytes*
*note: student says "I tried it and it moved" — the experiment reported instead of a push size — design's named miss*

> My turn: the Toy Car is light — a little push is enough. Your turn. Big, or little?

### right:c1
*expect: turn · turn_ended: True · 3.2s · audio: 81924 b64 bytes*
*note: student says "little"*

> Yes, little.

### ask:c2
*expect: turn · turn_ended: True · 8.9s · audio: 463364 b64 bytes*
*note: voice item (experiment)*

> The Barrel is on the carpet. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c2
*expect: turn · turn_ended: True · 8.5s · audio: 459524 b64 bytes*
*note: student says "I tried it and it moved" — the experiment reported instead of a push size — design's named miss*

> My turn: the Barrel is heavy and the carpet is grippy — it needs a big push. Your turn. Big, or little?

### right:c2
*expect: turn · turn_ended: True · 3.1s · audio: 87684 b64 bytes*
*note: student says "big"*

> Yes, big.

### ask:c3
*expect: turn · turn_ended: True · 8.9s · audio: 465284 b64 bytes*
*note: voice item (experiment)*

> The Tennis Ball is on the ice. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c3
*expect: turn · turn_ended: True · 7.9s · audio: 403204 b64 bytes*
*note: student says "I tried it and it moved" — the experiment reported instead of a push size — design's named miss*

> My turn: the Tennis Ball is light — a little push is enough. Your turn. Big, or little?

### right:c3
*expect: turn · turn_ended: True · 3.0s · audio: 84484 b64 bytes*
*note: student says "little"*

> Yes, little.

### ask:c4
*expect: turn · turn_ended: True · 8.6s · audio: 450564 b64 bytes*
*note: voice item (experiment)*

> The Rock is on the grass. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c4
*expect: turn · turn_ended: True · 9.0s · audio: 474884 b64 bytes*
*note: student says "I tried it and it moved" — the experiment reported instead of a push size — design's named miss*

> My turn: the Rock is heavy and the grass is grippy — it needs a big push. Your turn. Big, or little?

### right:c4
*expect: turn · turn_ended: True · 4.6s · audio: 82564 b64 bytes*
*note: student says "big"*

> Yes, big.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 368644 b64 bytes*

> What great force science today! You watched, you thought, and you said what you saw. See you next time!
