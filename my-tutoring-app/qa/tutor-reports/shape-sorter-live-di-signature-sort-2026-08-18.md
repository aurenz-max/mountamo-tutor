# Tier-3 Live Tutor Report — shape-sorter — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "shape-sorter", "items": 12, "voice_items": 12, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 1"}`
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
| `c1::sort-0` | voice/sort | triangle | ✅ | 3 sides | ✅ |
| `c1::sort-1` | voice/sort | square | ✅ | 4 sides | ✅ |
| `c1::sort-2` | voice/sort | triangle | ✅ | 3 sides | ✅ |
| `c1::sort-3` | voice/sort | rectangle | ✅ | 4 sides | ✅ |
| `c2::sort-0` | voice/sort | triangle | ✅ | 3 sides | ✅ |
| `c2::sort-1` | voice/sort | square | ✅ | 4 sides | ✅ |
| `c2::sort-3` | voice/sort | triangle | ✅ | 3 sides | ✅ |
| `c2::sort-2` | voice/sort | diamond | ✅ | 4 sides | ✅ |
| `c2::sort-4` | voice/sort | rectangle | ✅ | 4 sides | ✅ |
| `c3::sort-0` | voice/sort | square | ✅ | 4 sides | ✅ |
| `c3::sort-1` | voice/sort | hexagon | ✅ | 6 sides | ✅ |
| `c3::sort-2` | voice/sort | pentagon | ✅ | 5 sides | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:c1::sort-0
*expect: turn · turn_ended: True · 15.3s · audio: 888324 b64 bytes*
*note: voice item (sort)*

> Hi! Let us look at some shapes! I will point to a shape — you tell me which group it belongs with. Think about what is the same about the shapes in each group. Your turn. Which group? 3 sides, or 4 sides?

### wrong:c1::sort-0
*expect: turn · turn_ended: True · 8.8s · audio: 466564 b64 bytes*
*note: student says "triangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a triangle belongs with 3 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c1::sort-0
*expect: turn · turn_ended: True · 4.8s · audio: 208644 b64 bytes*
*note: student says "3 sides"*

> Yes, a triangle belongs with 3 sides.

### ask:c1::sort-1
*expect: turn · turn_ended: True · 5.6s · audio: 256004 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c1::sort-1
*expect: turn · turn_ended: True · 8.7s · audio: 462084 b64 bytes*
*note: student says "square" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a square belongs with 4 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c1::sort-1
*expect: turn · turn_ended: True · 4.2s · audio: 191364 b64 bytes*
*note: student says "4 sides"*

> Yes, a square belongs with 4 sides.

### ask:c1::sort-2
*expect: turn · turn_ended: True · 5.6s · audio: 258564 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c1::sort-2
*expect: turn · turn_ended: True · 8.7s · audio: 460804 b64 bytes*
*note: student says "triangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a triangle belongs with 3 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c1::sort-2
*expect: turn · turn_ended: True · 4.7s · audio: 199044 b64 bytes*
*note: student says "3 sides"*

> Yes, a triangle belongs with 3 sides.

### ask:c1::sort-3
*expect: turn · turn_ended: True · 5.5s · audio: 254724 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c1::sort-3
*expect: turn · turn_ended: True · 8.6s · audio: 466564 b64 bytes*
*note: student says "rectangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a rectangle belongs with 4 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c1::sort-3
*expect: turn · turn_ended: True · 4.3s · audio: 197764 b64 bytes*
*note: student says "4 sides"*

> Yes, a rectangle belongs with 4 sides.

### ask:c2::sort-0
*expect: turn · turn_ended: True · 5.4s · audio: 248324 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c2::sort-0
*expect: turn · turn_ended: True · 8.6s · audio: 474244 b64 bytes*
*note: student says "triangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a triangle belongs with 3 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c2::sort-0
*expect: turn · turn_ended: True · 4.8s · audio: 192644 b64 bytes*
*note: student says "3 sides"*

> Yes, a triangle belongs with 3 sides.

### ask:c2::sort-1
*expect: turn · turn_ended: True · 6.6s · audio: 286084 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c2::sort-1
*expect: turn · turn_ended: True · 9.2s · audio: 473604 b64 bytes*
*note: student says "square" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a square belongs with 4 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c2::sort-1
*expect: turn · turn_ended: True · 4.2s · audio: 188804 b64 bytes*
*note: student says "4 sides"*

> Yes, a square belongs with 4 sides.

### ask:c2::sort-3
*expect: turn · turn_ended: True · 6.2s · audio: 280324 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c2::sort-3
*expect: turn · turn_ended: True · 8.8s · audio: 482564 b64 bytes*
*note: student says "triangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a triangle belongs with 3 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c2::sort-3
*expect: turn · turn_ended: True · 4.3s · audio: 197764 b64 bytes*
*note: student says "3 sides"*

> Yes, a triangle belongs with 3 sides.

### ask:c2::sort-2
*expect: turn · turn_ended: True · 6.6s · audio: 280964 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c2::sort-2
*expect: turn · turn_ended: True · 8.9s · audio: 488324 b64 bytes*
*note: student says "diamond" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a diamond belongs with 4 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c2::sort-2
*expect: turn · turn_ended: True · 4.5s · audio: 195240 b64 bytes*
*note: student says "4 sides"*

> Yes, a diamond belongs with 4 sides.

### ask:c2::sort-4
*expect: turn · turn_ended: True · 6.6s · audio: 282884 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 3 sides, or 4 sides?

### wrong:c2::sort-4
*expect: turn · turn_ended: True · 8.9s · audio: 480644 b64 bytes*
*note: student says "rectangle" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a rectangle belongs with 4 sides. Your turn. Which group? 3 sides, or 4 sides?

### right:c2::sort-4
*expect: turn · turn_ended: True · 5.0s · audio: 215684 b64 bytes*
*note: student says "4 sides"*

> Yes, a rectangle belongs with 4 sides.

### ask:c3::sort-0
*expect: turn · turn_ended: True · 7.1s · audio: 353924 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### wrong:c3::sort-0
*expect: turn · turn_ended: True · 9.5s · audio: 532484 b64 bytes*
*note: student says "square" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a square belongs with 4 sides. Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### right:c3::sort-0
*expect: turn · turn_ended: True · 5.4s · audio: 204200 b64 bytes*
*note: student says "4 sides"*

> Yes, a square belongs with 4 sides.

### ask:c3::sort-1
*expect: turn · turn_ended: True · 7.1s · audio: 347524 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### wrong:c3::sort-1
*expect: turn · turn_ended: True · 10.2s · audio: 551684 b64 bytes*
*note: student says "hexagon" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a hexagon belongs with 6 sides. Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### right:c3::sort-1
*expect: turn · turn_ended: True · 4.8s · audio: 209924 b64 bytes*
*note: student says "6 sides"*

> Yes, a hexagon belongs with 6 sides.

### ask:c3::sort-2
*expect: turn · turn_ended: True · 7.0s · audio: 342404 b64 bytes*
*note: voice item (sort)*

> Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### wrong:c3::sort-2
*expect: turn · turn_ended: True · 10.1s · audio: 547844 b64 bytes*
*note: student says "pentagon" — the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, but not a classification. A judge that reasons "a square does have four sides, close enough" has affirmed a child who never sorted; the contract refuses it by name*

> My turn: a pentagon belongs with 5 sides. Your turn. Which group? 4 sides, 5 sides, or 6 sides?

### right:c3::sort-2
*expect: turn · turn_ended: True · 4.6s · audio: 211204 b64 bytes*
*note: student says "5 sides"*

> Yes, a pentagon belongs with 5 sides.

### complete
*expect: turn · turn_ended: True · 5.9s · audio: 293124 b64 bytes*

> Great shape work today! You told me every one out loud. See you next time!
