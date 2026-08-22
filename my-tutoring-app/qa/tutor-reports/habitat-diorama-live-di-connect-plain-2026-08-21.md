# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `c1` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `c2` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `c3` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `c4` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |
| `c5` | gesture/build-ecological-relationship | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 11.8s · audio: 660484 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Hi! Let's make this habitat come alive. Use your hands to build one relationship on the habitat map. Find Green Phytoplankton. Connect it to the living thing it eats.

### hands-hold:c1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c1
*expect: turn · turn_ended: True · 11.0s · audio: 621444 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Green Phytoplankton to Pond Tadpole. Green Phytoplankton serves as a vital food source for the Pond Tadpole. Your turn: build that connection.

### commit-right:c1
*expect: turn · turn_ended: True · 7.1s · audio: 383364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Green Phytoplankton serves as a vital food source for the Pond Tadpole.

### ask:c2
*expect: turn · turn_ended: True · 5.2s · audio: 222760 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Water Lily. Connect it to the living thing it eats.

### hands-hold:c2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c2
*expect: turn · turn_ended: True · 10.5s · audio: 595844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Water Lily to Mallard Duck. Mallard ducks eat the seeds and tender plant material provided by the water lily. Your turn: build that connection.

### commit-right:c2
*expect: turn · turn_ended: True · 7.5s · audio: 398724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Mallard ducks eat the seeds and tender plant material provided by the water lily.

### ask:c3
*expect: turn · turn_ended: True · 5.3s · audio: 240680 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Pond Tadpole. Connect it to the living thing it eats.

### hands-hold:c3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c3
*expect: turn · turn_ended: True · 11.8s · audio: 666884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Pond Tadpole to Dragonfly Nymph. The dragonfly nymph acts as a secondary consumer that preys upon small pond tadpoles. Your turn: build that connection.

### commit-right:c3
*expect: turn · turn_ended: True · 8.6s · audio: 435204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. The dragonfly nymph acts as a secondary consumer that preys upon small pond tadpoles.

### ask:c4
*expect: turn · turn_ended: True · 6.3s · audio: 217604 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Pond Tadpole. Connect it to the living thing it eats.

### hands-hold:c4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c4
*expect: turn · turn_ended: True · 12.2s · audio: 633604 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Pond Tadpole to Common Garter Snake. The common garter snake preys upon pond tadpoles and frogs near the water edge. Your turn: build that connection.

### commit-right:c4
*expect: turn · turn_ended: True · 7.6s · audio: 410884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. The common garter snake preys upon pond tadpoles and frogs near the water edge.

### ask:c5
*expect: turn · turn_ended: True · 5.7s · audio: 233604 b64 bytes*
*note: gesture item (build-ecological-relationship)*

> Find Dragonfly Nymph. Connect it to the living thing it eats.

### hands-hold:c5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c5
*expect: turn · turn_ended: True · 11.9s · audio: 642600 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: connect Dragonfly Nymph to Mallard Duck. Mallard ducks dabble in the water and consume aquatic insects like dragonfly nymphs. Your turn: build that connection.

### commit-right:c5
*expect: turn · turn_ended: True · 7.8s · audio: 422440 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that connection works. Mallard ducks dabble in the water and consume aquatic insects like dragonfly nymphs.

### complete
*expect: turn · turn_ended: True · 6.7s · audio: 356484 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
