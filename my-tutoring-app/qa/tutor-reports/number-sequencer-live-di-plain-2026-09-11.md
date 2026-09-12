# Tier-3 Live Tutor Report — number-sequencer — 2026-09-11

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "number-sequencer", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `seq1:-1-answer` | gesture/order-cards | (placement) | ✅ | (placement) | ✅ |
| `seq2:-1-answer` | gesture/order-cards | (placement) | ✅ | (placement) | ✅ |
| `seq3:-1-answer` | gesture/order-cards | (placement) | ✅ | (placement) | ✅ |
| `seq4:-1-answer` | gesture/order-cards | (placement) | ✅ | (placement) | ✅ |
| `seq5:-1-answer` | gesture/order-cards | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:seq1:-1-answer
*expect: turn · turn_ended: True · 8.6s · audio: 462084 b64 bytes*
*note: gesture item (order-cards)*

> Let us work on a number train. Put 3, 1, 4, 2 in order from smallest to largest.

### hands-hold:seq1:-1-answer
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:seq1:-1-answer
*expect: turn · turn_ended: True · 12.2s · audio: 707204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: start with the smallest number, then find the next larger number. Your turn. Put 3, 1, 4, 2 in order from smallest to largest.

### commit-right:seq1:-1-answer
*expect: turn · turn_ended: True · 4.3s · audio: 192644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the numbers go from smallest to largest.

### ask:seq2:-1-answer
*expect: turn · turn_ended: True · 6.8s · audio: 346884 b64 bytes*
*note: gesture item (order-cards)*

> Put 7, 5, 8, 6 in order from smallest to largest.

### hands-hold:seq2:-1-answer
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:seq2:-1-answer
*expect: turn · turn_ended: True · 12.7s · audio: 702724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: start with the smallest number, then find the next larger number. Your turn. Put 7, 5, 8, 6 in order from smallest to largest.

### commit-right:seq2:-1-answer
*expect: turn · turn_ended: True · 4.0s · audio: 184964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the numbers go from smallest to largest.

### ask:seq3:-1-answer
*expect: turn · turn_ended: True · 6.7s · audio: 336644 b64 bytes*
*note: gesture item (order-cards)*

> Put 11, 9, 12, 10 in order from smallest to largest.

### hands-hold:seq3:-1-answer
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:seq3:-1-answer
*expect: turn · turn_ended: True · 12.7s · audio: 708484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: start with the smallest number, then find the next larger number. Your turn. Put 11, 9, 12, 10 in order from smallest to largest.

### commit-right:seq3:-1-answer
*expect: turn · turn_ended: True · 4.2s · audio: 193284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the numbers go from smallest to largest.

### ask:seq4:-1-answer
*expect: turn · turn_ended: True · 7.5s · audio: 381444 b64 bytes*
*note: gesture item (order-cards)*

> Put 15, 13, 16, 14 in order from smallest to largest.

### hands-hold:seq4:-1-answer
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:seq4:-1-answer
*expect: turn · turn_ended: True · 12.9s · audio: 736004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: start with the smallest number, then find the next larger number. Your turn. Put 15, 13, 16, 14 in order from smallest to largest.

### commit-right:seq4:-1-answer
*expect: turn · turn_ended: True · 4.5s · audio: 188164 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the numbers go from smallest to largest.

### ask:seq5:-1-answer
*expect: turn · turn_ended: True · 7.4s · audio: 382724 b64 bytes*
*note: gesture item (order-cards)*

> Put 19, 17, 20, 18 in order from smallest to largest.

### hands-hold:seq5:-1-answer
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:seq5:-1-answer
*expect: turn · turn_ended: True · 12.8s · audio: 740484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: start with the smallest number, then find the next larger number. Your turn. Put 19, 17, 20, 18 in order from smallest to largest.

### commit-right:seq5:-1-answer
*expect: turn · turn_ended: True · 4.5s · audio: 193284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the numbers go from smallest to largest.

### complete
*expect: turn · turn_ended: True · 4.1s · audio: 183684 b64 bytes*

> You worked on number sequences. Nice effort!
