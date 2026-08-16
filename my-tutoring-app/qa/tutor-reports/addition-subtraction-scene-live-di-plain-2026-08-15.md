# Tier-3 Live Tutor Report — addition-subtraction-scene — 2026-08-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "addition-subtraction-scene", "items": 7, "voice_items": 0, "gesture_items": 7, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "Kindergarten"}`
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
| `ch1` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch2` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch3` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch4` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch5` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch6` | gesture/make | (placement) | ✅ | (placement) | ✅ |
| `ch7` | gesture/make | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 15.9s · audio: 924804 b64 bytes*
*note: gesture item (make)*

> Hi! Time for some number stories! Tap the big button to put more in, and tap one in the picture to send it away. Here is a number sentence: two plus one equals three. Your turn — make that story with the ducks in the pond.

### hands-hold:ch1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch1
*expect: turn · turn_ended: True · 8.6s · audio: 476804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says two plus one equals three. Your turn — make that story again with the ducks.

### commit-right:ch1
*expect: turn · turn_ended: True · 4.7s · audio: 192644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Three ducks. You made the story!

### ask:ch2
*expect: turn · turn_ended: True · 9.8s · audio: 499204 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: four take away one equals three. Your turn — make that story with the cookies in the kitchen.

### hands-hold:ch2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch2
*expect: turn · turn_ended: True · 9.3s · audio: 518404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says four take away one equals three. Your turn — make that story again with the cookies.

### commit-right:ch2
*expect: turn · turn_ended: True · 4.5s · audio: 211844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Three cookies. You made the story!

### ask:ch3
*expect: turn · turn_ended: True · 9.5s · audio: 512040 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: three plus two equals five. Your turn — make that story with the flowers in the garden.

### hands-hold:ch3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch3
*expect: turn · turn_ended: True · 9.3s · audio: 518404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says three plus two equals five. Your turn — make that story again with the flowers.

### commit-right:ch3
*expect: turn · turn_ended: True · 4.6s · audio: 213764 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Five flowers. You made the story!

### ask:ch4
*expect: turn · turn_ended: True · 9.3s · audio: 500484 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: five take away two equals three. Your turn — make that story with the frogs in the pond.

### hands-hold:ch4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch4
*expect: turn · turn_ended: True · 9.6s · audio: 531204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says five take away two equals three. Your turn — make that story again with the frogs.

### commit-right:ch4
*expect: turn · turn_ended: True · 4.4s · audio: 203524 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Three frogs. You made the story!

### ask:ch5
*expect: turn · turn_ended: True · 9.6s · audio: 506920 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: one plus three equals four. Your turn — make that story with the stars in the space.

### hands-hold:ch5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch5
*expect: turn · turn_ended: True · 9.2s · audio: 510084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says one plus three equals four. Your turn — make that story again with the stars.

### commit-right:ch5
*expect: turn · turn_ended: True · 4.7s · audio: 227880 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Four stars. You made the story!

### ask:ch6
*expect: turn · turn_ended: True · 9.2s · audio: 494084 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: four take away two equals two. Your turn — make that story with the apples in the farm.

### hands-hold:ch6
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch6
*expect: turn · turn_ended: True · 9.6s · audio: 529924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says four take away two equals two. Your turn — make that story again with the apples.

### commit-right:ch6
*expect: turn · turn_ended: True · 4.7s · audio: 215720 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Two apples. You made the story!

### ask:ch7
*expect: turn · turn_ended: True · 9.2s · audio: 474884 b64 bytes*
*note: gesture item (make)*

> Here is a number sentence: two plus two equals four. Your turn — make that story with the bunnies in the farm.

### hands-hold:ch7
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch7
*expect: turn · turn_ended: True · 9.1s · audio: 504324 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the number sentence says two plus two equals four. Your turn — make that story again with the bunnies.

### commit-right:ch7
*expect: turn · turn_ended: True · 5.0s · audio: 225924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Four bunnies. You made the story!

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 362884 b64 bytes*

> What great story math today! You listened hard and you did the thinking. See you next time!
