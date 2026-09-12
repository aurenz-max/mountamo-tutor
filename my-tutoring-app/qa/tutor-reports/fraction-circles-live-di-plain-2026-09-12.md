# Tier-3 Live Tutor Report — fraction-circles — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "fraction-circles", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "elementary", "undrivable_items": []}`
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
| `fc1` | gesture/touch_fraction | (placement) | ✅ | (placement) | ✅ |
| `fc2` | gesture/touch_fraction | (placement) | ✅ | (placement) | ✅ |
| `fc3` | gesture/touch_fraction | (placement) | ✅ | (placement) | ✅ |
| `fc4` | gesture/touch_fraction | (placement) | ✅ | (placement) | ✅ |
| `fc5` | gesture/touch_fraction | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:fc1
*expect: turn · turn_ended: True · 7.8s · audio: 396840 b64 bytes*
*note: gesture item (touch_fraction)*

> Let’s look at fractions. Listen, then touch a picture. Touch the picture showing one half.

### hands-hold:fc1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:fc1
*expect: turn · turn_ended: True · 10.1s · audio: 535684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn. You touched three fourths. one half means 1 of 2 equal parts are shaded. Touch the picture showing one half.

### commit-right:fc1
*expect: turn · turn_ended: True · 3.3s · audio: 135044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that shows one half.

### ask:fc2
*expect: turn · turn_ended: True · 3.6s · audio: 140804 b64 bytes*
*note: gesture item (touch_fraction)*

> Touch the picture showing one third.

### hands-hold:fc2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:fc2
*expect: turn · turn_ended: True · 9.8s · audio: 551044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn. You touched three fourths. one third means 1 of 3 equal parts are shaded. Touch the picture showing one third.

### commit-right:fc2
*expect: turn · turn_ended: True · 3.3s · audio: 136964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that shows one third.

### ask:fc3
*expect: turn · turn_ended: True · 3.9s · audio: 156164 b64 bytes*
*note: gesture item (touch_fraction)*

> Touch the picture showing two fourths.

### hands-hold:fc3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:fc3
*expect: turn · turn_ended: True · 10.4s · audio: 568360 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn. You touched two thirds. two fourths means 2 of 4 equal parts are shaded. Touch the picture showing two fourths.

### commit-right:fc3
*expect: turn · turn_ended: True · 3.3s · audio: 138884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that shows two fourths.

### ask:fc4
*expect: turn · turn_ended: True · 3.6s · audio: 136324 b64 bytes*
*note: gesture item (touch_fraction)*

> Touch the picture showing one half.

### hands-hold:fc4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:fc4
*expect: turn · turn_ended: True · 9.4s · audio: 528004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn. You touched one third. one half means 1 of 2 equal parts are shaded. Touch the picture showing one half.

### commit-right:fc4
*expect: turn · turn_ended: True · 4.2s · audio: 127364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that shows one half.

### ask:fc5
*expect: turn · turn_ended: True · 4.4s · audio: 152324 b64 bytes*
*note: gesture item (touch_fraction)*

> Touch the picture showing three fourths.

### hands-hold:fc5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:fc5
*expect: turn · turn_ended: True · 9.8s · audio: 553604 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn. You touched two fourths. three fourths means 3 of 4 equal parts are shaded. Touch the picture showing three fourths.

### commit-right:fc5
*expect: turn · turn_ended: True · 3.2s · audio: 131204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that shows three fourths.

### complete
*expect: turn · turn_ended: True · 4.6s · audio: 220804 b64 bytes*

> You finished your fraction pictures. Thanks for working with me!
