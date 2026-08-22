# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 2, "voice_items": 0, "gesture_items": 2, "dropped_challenges": 3, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `challenge-1` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |
| `challenge-2` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 3.

## Run 1 — beat-by-beat transcript

### ask:challenge-1
*expect: turn · turn_ended: True · 14.4s · audio: 816004 b64 bytes*
*note: gesture item (place-restoration-part)*

> Hi! Let's make this habitat come alive. Use your hands to place the missing living thing into the best habitat zone. Place Microscopic Algae in the habitat zone where it can best meet its needs.

### hands-hold:challenge-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:challenge-1
*expect: turn · turn_ended: True · 13.5s · audio: 782724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Microscopic Algae belongs in the water zone. Microscopic Algae belong in the water where they absorb sunlight to produce food for primary consumers. Your turn: place it there.

### commit-right:challenge-1
*expect: turn · turn_ended: True · 10.3s · audio: 580484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Microscopic Algae belong in the water where they absorb sunlight to produce food for primary consumers.

### ask:challenge-2
*expect: turn · turn_ended: True · 6.3s · audio: 289924 b64 bytes*
*note: gesture item (place-restoration-part)*

> Place Common Cattail in the habitat zone where it can best meet its needs.

### hands-hold:challenge-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:challenge-2
*expect: turn · turn_ended: True · 13.2s · audio: 736644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Common Cattail belongs in the shoreline zone. Common Cattails thrive along the shoreline, anchoring themselves in shallow water and damp earth. Your turn: place it there.

### commit-right:challenge-2
*expect: turn · turn_ended: True · 10.4s · audio: 566404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Common Cattails thrive along the shoreline, anchoring themselves in shallow water and damp earth.

### complete
*expect: turn · turn_ended: True · 7.1s · audio: 371204 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
