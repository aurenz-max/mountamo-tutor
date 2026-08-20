# Tier-3 Live Tutor Report — shape-sorter — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "shape-sorter", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten"}`
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
| `c1::count-0` | voice/count | two | ✅ | three | ✅ |
| `c2::count-0` | voice/count | three | ✅ | four | ✅ |
| `c3::count-0` | voice/count | four | ✅ | five | ✅ |
| `c4::count-0` | voice/count | five | ✅ | six | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1::count-0
*expect: turn · turn_ended: True · 14.3s · audio: 823684 b64 bytes*
*note: voice item (count)*

> Hi! Let us look at some shapes! I will show you a shape — you count, then tell me the number out loud. Count each one, and count it only once. Your turn. How many sides does this shape have?

### wrong:c1::count-0
*expect: turn · turn_ended: True · 8.3s · audio: 401284 b64 bytes*
*note: student says "two" — the OFF-BY-ONE count — the error side-counting exists to correct, and the answer a judge grading on "did I hear a number?" affirms. The contract names one-more-or-one-less explicitly*

> My turn: this shape has three sides. Your turn. How many sides does this shape have?

### right:c1::count-0
*expect: turn · turn_ended: True · 3.8s · audio: 169604 b64 bytes*
*note: student says "three"*

> Yes, this shape has three sides.

### ask:c2::count-0
*expect: turn · turn_ended: True · 4.5s · audio: 191364 b64 bytes*
*note: voice item (count)*

> Your turn. How many corners does this shape have?

### wrong:c2::count-0
*expect: turn · turn_ended: True · 7.7s · audio: 404484 b64 bytes*
*note: student says "three" — the OFF-BY-ONE count — the error side-counting exists to correct, and the answer a judge grading on "did I hear a number?" affirms. The contract names one-more-or-one-less explicitly*

> My turn: this shape has four corners. Your turn. How many corners does this shape have?

### right:c2::count-0
*expect: turn · turn_ended: True · 3.9s · audio: 176680 b64 bytes*
*note: student says "four"*

> Yes, this shape has four corners.

### ask:c3::count-0
*expect: turn · turn_ended: True · 5.1s · audio: 233604 b64 bytes*
*note: voice item (count)*

> Your turn. How many sides does this shape have?

### wrong:c3::count-0
*expect: turn · turn_ended: True · 7.7s · audio: 416644 b64 bytes*
*note: student says "four" — the OFF-BY-ONE count — the error side-counting exists to correct, and the answer a judge grading on "did I hear a number?" affirms. The contract names one-more-or-one-less explicitly*

> My turn: this shape has five sides. Your turn. How many sides does this shape have?

### right:c3::count-0
*expect: turn · turn_ended: True · 4.2s · audio: 192644 b64 bytes*
*note: student says "five"*

> Yes, this shape has five sides.

### ask:c4::count-0
*expect: turn · turn_ended: True · 4.8s · audio: 211204 b64 bytes*
*note: voice item (count)*

> Your turn. How many corners does this shape have?

### wrong:c4::count-0
*expect: turn · turn_ended: True · 8.0s · audio: 435844 b64 bytes*
*note: student says "five" — the OFF-BY-ONE count — the error side-counting exists to correct, and the answer a judge grading on "did I hear a number?" affirms. The contract names one-more-or-one-less explicitly*

> My turn: this shape has six corners. Your turn. How many corners does this shape have?

### right:c4::count-0
*expect: turn · turn_ended: True · 4.2s · audio: 188164 b64 bytes*
*note: student says "six"*

> Yes, this shape has six corners.

### complete
*expect: turn · turn_ended: True · 6.0s · audio: 306564 b64 bytes*

> Great shape work today! You told me every one out loud. See you next time!
