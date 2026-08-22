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
| `rest_1` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |
| `rest_2` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |
| `rest_3` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |
| `rest_4` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |
| `rest_5` | gesture/place-restoration-part | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:rest_1
*expect: turn · turn_ended: True · 15.1s · audio: 804520 b64 bytes*
*note: gesture item (place-restoration-part)*

> Hi! Let's make this habitat come alive. Use your hands to place the missing living thing into the best habitat zone. Place Green Phytoplankton in the habitat zone where it can best meet its needs.

### hands-hold:rest_1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:rest_1
*expect: turn · turn_ended: True · 14.0s · audio: 816004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Green Phytoplankton belongs in the water zone. Green Phytoplankton belongs in the water zone because it requires sunlight and water to produce food and sustain the pond food web. Your turn: place it there.

### commit-right:rest_1
*expect: turn · turn_ended: True · 11.8s · audio: 666244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Green Phytoplankton belongs in the water zone because it requires sunlight and water to produce food and sustain the pond food web.

### ask:rest_2
*expect: turn · turn_ended: True · 6.0s · audio: 270084 b64 bytes*
*note: gesture item (place-restoration-part)*

> Place Frog Tadpole in the habitat zone where it can best meet its needs.

### hands-hold:rest_2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:rest_2
*expect: turn · turn_ended: True · 12.6s · audio: 722564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Frog Tadpole belongs in the water zone. Frog Tadpoles thrive in the water zone where they can easily graze on submerged algae and escape predators. Your turn: place it there.

### commit-right:rest_2
*expect: turn · turn_ended: True · 10.4s · audio: 593284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Frog Tadpoles thrive in the water zone where they can easily graze on submerged algae and escape predators.

### ask:rest_3
*expect: turn · turn_ended: True · 6.3s · audio: 296964 b64 bytes*
*note: gesture item (place-restoration-part)*

> Place Common Dragonfly Nymph in the habitat zone where it can best meet its needs.

### hands-hold:rest_3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:rest_3
*expect: turn · turn_ended: True · 12.9s · audio: 721924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Common Dragonfly Nymph belongs in the water zone. Common Dragonfly Nymphs need the water zone to hunt tadpoles and small aquatic insects successfully. Your turn: place it there.

### commit-right:rest_3
*expect: turn · turn_ended: True · 9.6s · audio: 540164 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Common Dragonfly Nymphs need the water zone to hunt tadpoles and small aquatic insects successfully.

### ask:rest_4
*expect: turn · turn_ended: True · 5.6s · audio: 246404 b64 bytes*
*note: gesture item (place-restoration-part)*

> Place Mallard Duck in the habitat zone where it can best meet its needs.

### hands-hold:rest_4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:rest_4
*expect: turn · turn_ended: True · 12.6s · audio: 732804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Mallard Duck belongs in the shoreline zone. Mallard Ducks require the shoreline zone to forage for aquatic plants, insects, and small animals in shallow areas. Your turn: place it there.

### commit-right:rest_4
*expect: turn · turn_ended: True · 10.5s · audio: 596484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Mallard Ducks require the shoreline zone to forage for aquatic plants, insects, and small animals in shallow areas.

### ask:rest_5
*expect: turn · turn_ended: True · 5.7s · audio: 272644 b64 bytes*
*note: gesture item (place-restoration-part)*

> Place Great Blue Heron in the habitat zone where it can best meet its needs.

### hands-hold:rest_5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:rest_5
*expect: turn · turn_ended: True · 12.4s · audio: 717444 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: Great Blue Heron belongs in the shoreline zone. Great Blue Herons utilize the shoreline zone to stalk fish, frogs, and other suitable prey in the shallows. Your turn: place it there.

### commit-right:rest_5
*expect: turn · turn_ended: True · 10.0s · audio: 552964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that placement helps the habitat recover. Great Blue Herons utilize the shoreline zone to stalk fish, frogs, and other suitable prey in the shallows.

### complete
*expect: turn · turn_ended: True · 7.8s · audio: 364164 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
