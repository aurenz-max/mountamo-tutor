# Tier-3 Live Tutor Report — 3d-shape-explorer — 2026-09-04

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "3d-shape-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `c1:shape:0` | voice/classify_dimension | solid | ✅ | flat | ✅ |
| `c1:shape:1` | voice/classify_dimension | flat | ✅ | solid | ✅ |
| `c1:shape:2` | voice/classify_dimension | solid | ✅ | flat | ✅ |
| `c2:shape:0` | voice/classify_dimension | flat | ✅ | solid | ✅ |
| `c2:shape:1` | voice/classify_dimension | solid | ✅ | flat | ✅ |
| `c2:shape:2` | voice/classify_dimension | flat | ✅ | solid | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1:shape:0
*expect: turn · turn_ended: True · 10.2s · audio: 557444 b64 bytes*
*note: voice item (classify_dimension)*

> Hi! Welcome to the shape lab. Look or listen, then say one answer out loud. Look at this shape. Is it flat or solid?

### wrong:c1:shape:0
*expect: turn · turn_ended: True · 10.7s · audio: 592004 b64 bytes*
*note: student says "solid" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is flat. Look at this shape. Is it flat or solid?

### right:c1:shape:0
*expect: turn · turn_ended: True · 3.4s · audio: 117124 b64 bytes*
*note: student says "flat"*

> Yes, this shape is flat.

### ask:c1:shape:1
*expect: turn · turn_ended: True · 4.8s · audio: 208004 b64 bytes*
*note: voice item (classify_dimension)*

> Here is another shape. Is it flat or solid?

### wrong:c1:shape:1
*expect: turn · turn_ended: True · 10.7s · audio: 597124 b64 bytes*
*note: student says "flat" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is solid. Here is another shape. Is it flat or solid?

### right:c1:shape:1
*expect: turn · turn_ended: True · 3.4s · audio: 119684 b64 bytes*
*note: student says "solid"*

> Yes, this shape is solid.

### ask:c1:shape:2
*expect: turn · turn_ended: True · 4.8s · audio: 209924 b64 bytes*
*note: voice item (classify_dimension)*

> Study this shape. Is it flat or solid?

### wrong:c1:shape:2
*expect: turn · turn_ended: True · 10.9s · audio: 599044 b64 bytes*
*note: student says "solid" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is flat. Study this shape. Is it flat or solid?

### right:c1:shape:2
*expect: turn · turn_ended: True · 3.6s · audio: 142724 b64 bytes*
*note: student says "flat"*

> Yes, this shape is flat.

### ask:c2:shape:0
*expect: turn · turn_ended: True · 5.2s · audio: 228484 b64 bytes*
*note: voice item (classify_dimension)*

> Take a close look. Is this shape flat or solid?

### wrong:c2:shape:0
*expect: turn · turn_ended: True · 11.1s · audio: 629124 b64 bytes*
*note: student says "flat" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is solid. Take a close look. Is this shape flat or solid?

### right:c2:shape:0
*expect: turn · turn_ended: True · 3.6s · audio: 144004 b64 bytes*
*note: student says "solid"*

> Yes, this shape is solid.

### ask:c2:shape:1
*expect: turn · turn_ended: True · 4.8s · audio: 195844 b64 bytes*
*note: voice item (classify_dimension)*

> Look at this shape. Is it flat or solid?

### wrong:c2:shape:1
*expect: turn · turn_ended: True · 10.4s · audio: 581124 b64 bytes*
*note: student says "solid" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is flat. Look at this shape. Is it flat or solid?

### right:c2:shape:1
*expect: turn · turn_ended: True · 3.5s · audio: 119684 b64 bytes*
*note: student says "flat"*

> Yes, this shape is flat.

### ask:c2:shape:2
*expect: turn · turn_ended: True · 4.9s · audio: 211844 b64 bytes*
*note: voice item (classify_dimension)*

> Here is another shape. Is it flat or solid?

### wrong:c2:shape:2
*expect: turn · turn_ended: True · 11.0s · audio: 603524 b64 bytes*
*note: student says "flat" — the confident flat/solid reversal*

> My turn: a flat shape can be drawn on paper; a solid can be held. This one is solid. Here is another shape. Is it flat or solid?

### right:c2:shape:2
*expect: turn · turn_ended: True · 4.1s · audio: 114564 b64 bytes*
*note: student says "solid"*

> Yes, this shape is solid.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 324520 b64 bytes*

> Great shape work today! You told me every answer out loud. See you next time!
