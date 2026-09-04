# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "cause-effect-chain", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS** — no findings.

## Findings

None.

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `cec-1` | gesture/build_chain | (placement) | ✅ | (placement) | ✅ |
| `cec-2` | gesture/build_chain | (placement) | ✅ | (placement) | ✅ |
| `cec-3` | gesture/build_chain | (placement) | ✅ | (placement) | ✅ |
| `cec-4` | gesture/build_chain | (placement) | ✅ | (placement) | ✅ |
| `cec-5` | gesture/build_chain | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:cec-1
*expect: turn · turn_ended: True · 41.7s · audio: 3408044 b64 bytes*
*note: gesture item (build_chain)*

> Hi! Time to be a historian and work out what led to what! I tell you how something ended, and the events that led to it are on cards. You build the chain: tap the cards in the order they happened, earliest first, so each one leads to the next. Tap a card in the chain to take it back out, and when your chain is done, hold still and I will look. The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Listen. In theearliest first, so each one leads to the next. Tap a card in the chain to take it back out, and when your chain is done, hold still and I will look. The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Listen. In the end: Families crossed the continent in days instead of months. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

### hands-hold:cec-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:cec-1
*expect: turn · turn_ended: True · 11.0s · audio: 636804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Your turn. Build the chain again.

### commit-right:cec-1
*expect: turn · turn_ended: True · 6.1s · audio: 317444 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the order things had to happen in — each one made the next one possible.

### ask:cec-2
*expect: turn · turn_ended: True · 14.1s · audio: 810280 b64 bytes*
*note: gesture item (build_chain)*

> Listen. In the end: Farmers grew large fields of golden wheat on the open plains. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

### hands-hold:cec-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:cec-2
*expect: turn · turn_ended: True · 11.2s · audio: 642564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Your turn. Build the chain again.

### commit-right:cec-2
*expect: turn · turn_ended: True · 6.0s · audio: 314244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the order things had to happen in — each one made the next one possible.

### ask:cec-3
*expect: turn · turn_ended: True · 13.4s · audio: 757764 b64 bytes*
*note: gesture item (build_chain)*

> Listen. In the end: Pioneers receive letters from their relatives back east. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

### hands-hold:cec-3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:cec-3
*expect: turn · turn_ended: True · 11.0s · audio: 626564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Your turn. Build the chain again.

### commit-right:cec-3
*expect: turn · turn_ended: True · 6.1s · audio: 311044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the order things had to happen in — each one made the next one possible.

### ask:cec-4
*expect: turn · turn_ended: True · 13.6s · audio: 778244 b64 bytes*
*note: gesture item (build_chain)*

> Listen. In the end: Children sit at wooden desks to learn reading and math. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

### hands-hold:cec-4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:cec-4
*expect: turn · turn_ended: True · 11.4s · audio: 629124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Your turn. Build the chain again.

### commit-right:cec-4
*expect: turn · turn_ended: True · 6.1s · audio: 314244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the order things had to happen in — each one made the next one possible.

### ask:cec-5
*expect: turn · turn_ended: True · 13.4s · audio: 755844 b64 bytes*
*note: gesture item (build_chain)*

> Listen. In the end: Townsfolk pump fresh water straight into their home kitchens. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

### hands-hold:cec-5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:cec-5
*expect: turn · turn_ended: True · 11.2s · audio: 640004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: The earliest event is the one that could happen before any of the others, and each event makes the next one possible. Your turn. Build the chain again.

### commit-right:cec-5
*expect: turn · turn_ended: True · 6.1s · audio: 314884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the order things had to happen in — each one made the next one possible.

### complete
*expect: turn · turn_ended: True · 7.6s · audio: 408324 b64 bytes*

> What good history today! You worked out what had to happen before what, all by yourself. See you next time!
