# Tier-3 Live Tutor Report — periodic-table — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "periodic-table", "items": 6, "voice_items": 0, "gesture_items": 6, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `pt-1-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |
| `pt-2-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |
| `pt-3-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |
| `pt-4-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |
| `pt-5-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |
| `pt-6-explore` | gesture/find | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pt-1-explore
*expect: turn · turn_ended: True · 14.2s · audio: 819880 b64 bytes*
*note: gesture item (find)*

> Hi! Time to explore the periodic table! I name an element — you hunt for its box on the big table and tap it! Sweep one row at a time, all the way across. Find Lithium. Your turn. Tap its box.

### hands-hold:pt-1-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-1-explore
*expect: turn · turn_ended: True · 9.0s · audio: 496004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: sweep one row at a time, left to right, and check each box for Lithium. Your turn. Tap the box for Lithium.

### commit-right:pt-1-explore
*expect: turn · turn_ended: True · 4.8s · audio: 233604 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is Lithium — group 1, period 2.

### ask:pt-2-explore
*expect: turn · turn_ended: True · 5.4s · audio: 256644 b64 bytes*
*note: gesture item (find)*

> Find element number 28. Your turn. Tap its box.

### hands-hold:pt-2-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-2-explore
*expect: turn · turn_ended: True · 9.2s · audio: 519044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the little number in each box counts up one at a time — follow it to 28. Your turn. Tap the box for number 28.

### commit-right:pt-2-explore
*expect: turn · turn_ended: True · 4.8s · audio: 227204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is Nickel — group 10, period 4.

### ask:pt-3-explore
*expect: turn · turn_ended: True · 6.4s · audio: 322600 b64 bytes*
*note: gesture item (find)*

> Find the element in group 11, period 6. Your turn. Tap its box.

### hands-hold:pt-3-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-3-explore
*expect: turn · turn_ended: True · 10.6s · audio: 483204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: count across the top to group 11, then down the side to period 6. Your turn. Tap the box where they meet.

### commit-right:pt-3-explore
*expect: turn · turn_ended: True · 5.2s · audio: 235524 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, group 11, period 6 — that box is Gold.

### ask:pt-4-explore
*expect: turn · turn_ended: True · 6.0s · audio: 272644 b64 bytes*
*note: gesture item (find)*

> Find the element whose symbol is C, a. Your turn. Tap its box.

### hands-hold:pt-4-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-4-explore
*expect: turn · turn_ended: True · 9.2s · audio: 462084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: check the big letters in each box — we want C, a. Your turn. Tap the box whose symbol is C, a.

### commit-right:pt-4-explore
*expect: turn · turn_ended: True · 4.7s · audio: 222084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is Calcium — group 2, period 4.

### ask:pt-5-explore
*expect: turn · turn_ended: True · 4.9s · audio: 186244 b64 bytes*
*note: gesture item (find)*

> Find Lead. Your turn. Tap its box.

### hands-hold:pt-5-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-5-explore
*expect: turn · turn_ended: True · 8.8s · audio: 486404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: sweep one row at a time, left to right, and check each box for Lead. Your turn. Tap the box for Lead.

### commit-right:pt-5-explore
*expect: turn · turn_ended: True · 5.1s · audio: 227844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is Lead — group 14, period 6.

### ask:pt-6-explore
*expect: turn · turn_ended: True · 5.6s · audio: 225284 b64 bytes*
*note: gesture item (find)*

> Find element number 1. Your turn. Tap its box.

### hands-hold:pt-6-explore
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pt-6-explore
*expect: turn · turn_ended: True · 9.3s · audio: 512040 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the little number in each box counts up one at a time — follow it to 1. Your turn. Tap the box for number 1.

### commit-right:pt-6-explore
*expect: turn · turn_ended: True · 5.2s · audio: 221444 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is Hydrogen — group 1, period 1.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 405124 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!
