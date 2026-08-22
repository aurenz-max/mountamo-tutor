# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 4, "voice_items": 0, "gesture_items": 4, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `chal-2` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `chal-4` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `chal-5` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 12.3s · audio: 675204 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Hi! Let's make this habitat come alive. Use your hands to build one relationship on the habitat map. Find Microscopic Phytoplankton. Connect it to the living thing that eats it.

### hands-hold:chal-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:chal-1
*expect: turn · turn_ended: True · 14.6s · audio: 839684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Microscopic Phytoplankton to Green Frog Tadpole. Microscopic phytoplankton are consumed by green frog tadpoles, transferring energy up the food chain. Your turn: build that connection.

### commit-right:chal-1
*expect: turn · turn_ended: True · 9.4s · audio: 514600 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Microscopic phytoplankton are consumed by green frog tadpoles, transferring energy up the food chain.

### ask:chal-2
*expect: turn · turn_ended: True · 5.5s · audio: 248324 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Green Frog Tadpole. Connect it to the living thing that eats it.

### hands-hold:chal-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:chal-2
*expect: turn · turn_ended: True · 12.3s · audio: 708484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Green Frog Tadpole to Dragonfly Nymph. Green frog tadpoles are hunted by dragonfly nymphs as part of the wetland food web. Your turn: build that connection.

### commit-right:chal-2
*expect: turn · turn_ended: True · 8.0s · audio: 428804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Green frog tadpoles are hunted by dragonfly nymphs as part of the wetland food web.

### ask:chal-4
*expect: turn · turn_ended: True · 5.9s · audio: 273960 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Bluegill Sunfish. Connect it to the living thing that eats it.

### hands-hold:chal-4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:chal-4
*expect: turn · turn_ended: True · 11.2s · audio: 634244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Bluegill Sunfish to Great Blue Heron. Bluegill sunfish are captured and eaten by the great blue heron. Your turn: build that connection.

### commit-right:chal-4
*expect: turn · turn_ended: True · 6.8s · audio: 353284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Bluegill sunfish are captured and eaten by the great blue heron.

### ask:chal-5
*expect: turn · turn_ended: True · 7.7s · audio: 371204 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Freshwater Pond Snail. Connect it to the organism that benefits from it without harming it.

### hands-hold:chal-5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:chal-5
*expect: turn · turn_ended: True · 14.7s · audio: 844164 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Freshwater Pond Snail to Broadleaf Cattail. Freshwater pond snails associate with broadleaf cattails in a commensal relationship, using them for structural habitat. Your turn: build that connection.

### commit-right:chal-5
*expect: turn · turn_ended: True · 9.9s · audio: 549764 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Freshwater pond snails associate with broadleaf cattails in a commensal relationship, using them for structural habitat.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 355880 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
