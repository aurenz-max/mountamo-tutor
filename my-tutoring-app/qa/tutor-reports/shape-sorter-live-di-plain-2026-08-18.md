# Tier-3 Live Tutor Report — shape-sorter — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "shape-sorter", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 3, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "c1::name-0", "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1::name-0 1/1, wrong3:c1::name-0 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1::name-0 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1::name-0` | voice/identify | triangle | ✅✅✅ | - | n/a |
| `c1::name-1` | voice/identify | circle | ✅ | square | ✅ |
| `c1::name-2` | voice/identify | circle | ✅ | triangle | ✅ |
| `c1::name-3` | voice/identify | circle | ✅ | rectangle | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 3.

## Run 1 — beat-by-beat transcript

### ask:c1::name-0
*expect: turn · turn_ended: True · 12.1s · audio: 669444 b64 bytes*
*note: voice item (identify)*

> Hi! Let us look at some shapes! I will point to a shape — you tell me its name out loud. Look at the whole shape before you name it. Your turn. What shape is this?

### wrong1:c1::name-0
*expect: turn · turn_ended: True · 5.6s · audio: 279044 b64 bytes*
*note: student says "triangle"*

> My turn: this shape is a circle. Your turn. What shape is this?

### wrong2:c1::name-0
*expect: turn · turn_ended: True · 5.5s · audio: 270084 b64 bytes*
*note: student says "triangle"*

> My turn: this shape is a circle. Your turn. What shape is this?

### wrong3:c1::name-0
*expect: turn · turn_ended: True · 5.7s · audio: 273284 b64 bytes*
*note: student says "triangle"*

> My turn: this shape is a circle. Your turn. What shape is this?

### moveon:c1::name-0
*expect: turn · turn_ended: True · 6.1s · audio: 288004 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. What shape is this?

### wrong:c1::name-1
*expect: turn · turn_ended: True · 6.4s · audio: 316804 b64 bytes*
*note: student says "circle"*

> My turn: this shape is a square. Your turn. What shape is this?

### right:c1::name-1
*expect: turn · turn_ended: True · 3.8s · audio: 148484 b64 bytes*
*note: student says "square"*

> Yes, this shape is a square.

### ask:c1::name-2
*expect: turn · turn_ended: True · 3.8s · audio: 142084 b64 bytes*
*note: voice item (identify)*

> Your turn. What shape is this?

### wrong:c1::name-2
*expect: turn · turn_ended: True · 5.9s · audio: 295684 b64 bytes*
*note: student says "circle"*

> My turn: this shape is a triangle. Your turn. What shape is this?

### right:c1::name-2
*expect: turn · turn_ended: True · 4.4s · audio: 160644 b64 bytes*
*note: student says "triangle"*

> Yes, this shape is a triangle.

### ask:c1::name-3
*expect: turn · turn_ended: True · 3.9s · audio: 137604 b64 bytes*
*note: voice item (identify)*

> Your turn. What shape is this?

### wrong:c1::name-3
*expect: turn · turn_ended: True · 6.1s · audio: 308520 b64 bytes*
*note: student says "circle"*

> My turn: this shape is a rectangle. Your turn. What shape is this?

### right:c1::name-3
*expect: turn · turn_ended: True · 4.3s · audio: 156164 b64 bytes*
*note: student says "rectangle"*

> Yes, this shape is a rectangle.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 318084 b64 bytes*

> Great shape work today! You told me every one out loud. See you next time!
