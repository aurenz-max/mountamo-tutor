# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 4, "voice_items": 0, "gesture_items": 4, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `c1` | gesture/arrange | (placement) | ✅✅ | (placement) | ✅✅ |
| `c2` | gesture/arrange | (placement) | ✅✅ | (placement) | ✅✅ |
| `c3` | gesture/arrange | (placement) | ✅✅ | (placement) | ✅✅ |
| `c4` | gesture/arrange | (placement) | ✅✅ | (placement) | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 19.9s · audio: 1144964 b64 bytes*
*note: gesture item (arrange)*

> Hi! Time to line up and count! Touch the pictures one at a time to put them in their places. When you stop, I will look at your line. Put them in their places. The Elephant goes first. The Koala goes second. The Kangaroo goes third. The Zebra goes fourth. Touch them one at a time.

### hands-hold:c1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c1
*expect: turn · turn_ended: True · 8.4s · audio: 444804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c1
*expect: turn · turn_ended: True · 4.0s · audio: 185604 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c2
*expect: turn · turn_ended: True · 11.4s · audio: 622084 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Elephant goes first. The Zebra goes second. The Turtle goes third. The Kangaroo goes fourth. Touch them one at a time.

### hands-hold:c2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c2
*expect: turn · turn_ended: True · 8.2s · audio: 444804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c2
*expect: turn · turn_ended: True · 4.2s · audio: 183044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c3
*expect: turn · turn_ended: True · 12.1s · audio: 630404 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Kangaroo goes first. The Zebra goes second. The Turtle goes third. The Giraffe goes fourth. Touch them one at a time.

### hands-hold:c3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c3
*expect: turn · turn_ended: True · 8.3s · audio: 454404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c3
*expect: turn · turn_ended: True · 4.4s · audio: 186244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c4
*expect: turn · turn_ended: True · 11.5s · audio: 636164 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Giraffe goes first. The Penguin goes second. The Koala goes third. The Kangaroo goes fourth. Touch them one at a time.

### hands-hold:c4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c4
*expect: turn · turn_ended: True · 8.3s · audio: 447364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c4
*expect: turn · turn_ended: True · 4.0s · audio: 183684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 313604 b64 bytes*

> What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 19.6s · audio: 1141764 b64 bytes*
*note: gesture item (arrange)*

> Hi! Time to line up and count! Touch the pictures one at a time to put them in their places. When you stop, I will look at your line. Put them in their places. The Elephant goes first. The Koala goes second. The Kangaroo goes third. The Zebra goes fourth. Touch them one at a time.

### hands-hold:c1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c1
*expect: turn · turn_ended: True · 8.4s · audio: 447364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c1
*expect: turn · turn_ended: True · 3.9s · audio: 179204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c2
*expect: turn · turn_ended: True · 11.2s · audio: 622724 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Elephant goes first. The Zebra goes second. The Turtle goes third. The Kangaroo goes fourth. Touch them one at a time.

### hands-hold:c2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c2
*expect: turn · turn_ended: True · 8.0s · audio: 426244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c2
*expect: turn · turn_ended: True · 4.1s · audio: 179844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c3
*expect: turn · turn_ended: True · 11.9s · audio: 640644 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Kangaroo goes first. The Zebra goes second. The Turtle goes third. The Giraffe goes fourth. Touch them one at a time.

### hands-hold:c3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c3
*expect: turn · turn_ended: True · 8.3s · audio: 437124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c3
*expect: turn · turn_ended: True · 4.3s · audio: 192040 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### ask:c4
*expect: turn · turn_ended: True · 12.1s · audio: 638724 b64 bytes*
*note: gesture item (arrange)*

> Put them in their places. The Giraffe goes first. The Penguin goes second. The Koala goes third. The Kangaroo goes fourth. Touch them one at a time.

### hands-hold:c4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c4
*expect: turn · turn_ended: True · 8.5s · audio: 437124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: I listen for the place word, then I count to it from the engine. Your turn — put them in their places again.

### commit-right:c4
*expect: turn · turn_ended: True · 4.0s · audio: 180484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Every one is in its own place.

### complete
*expect: turn · turn_ended: True · 6.3s · audio: 310440 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
