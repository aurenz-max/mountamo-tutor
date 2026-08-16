# Tier-3 Live Tutor Report — picture-vocabulary — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "picture-vocabulary", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "kindergarten"}`
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
| `pv-1` | gesture/association | (placement) | ✅ | (placement) | ✅ |
| `pv-2` | gesture/association | (placement) | ✅ | (placement) | ✅ |
| `pv-3` | gesture/association | (placement) | ✅ | (placement) | ✅ |
| `pv-4` | gesture/association | (placement) | ✅ | (placement) | ✅ |
| `pv-5` | gesture/association | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pv-1
*expect: turn · turn_ended: True · 14.6s · audio: 845444 b64 bytes*
*note: gesture item (association)*

> Hi! Time to play with words! Some things go together, like friends. I show a picture — you tap the picture that goes with it! Plate. Your turn. Tap the picture that goes with plate.

### hands-hold:pv-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pv-1
*expect: turn · turn_ended: True · 9.9s · audio: 561284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: think about which one is used with plate — they belong together. Your turn. Tap the picture that goes with plate.

### commit-right:pv-1
*expect: turn · turn_ended: True · 3.7s · audio: 150404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Plate goes with cup.

### ask:pv-2
*expect: turn · turn_ended: True · 5.7s · audio: 269444 b64 bytes*
*note: gesture item (association)*

> Paper. Your turn. Tap the picture that goes with paper.

### hands-hold:pv-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pv-2
*expect: turn · turn_ended: True · 9.3s · audio: 519044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: think about which one is used with paper — they belong together. Your turn. Tap the picture that goes with paper.

### commit-right:pv-2
*expect: turn · turn_ended: True · 4.1s · audio: 146564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Paper goes with pencil.

### ask:pv-3
*expect: turn · turn_ended: True · 5.8s · audio: 251524 b64 bytes*
*note: gesture item (association)*

> Lock. Your turn. Tap the picture that goes with lock.

### hands-hold:pv-3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pv-3
*expect: turn · turn_ended: True · 9.3s · audio: 523524 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: think about which one is used with lock — they belong together. Your turn. Tap the picture that goes with lock.

### commit-right:pv-3
*expect: turn · turn_ended: True · 3.6s · audio: 148520 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Lock goes with key.

### ask:pv-4
*expect: turn · turn_ended: True · 5.5s · audio: 254724 b64 bytes*
*note: gesture item (association)*

> Pillow. Your turn. Tap the picture that goes with pillow.

### hands-hold:pv-4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pv-4
*expect: turn · turn_ended: True · 9.5s · audio: 511364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: think about which one is used with pillow — they belong together. Your turn. Tap the picture that goes with pillow.

### commit-right:pv-4
*expect: turn · turn_ended: True · 3.8s · audio: 144644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Pillow goes with bed.

### ask:pv-5
*expect: turn · turn_ended: True · 5.9s · audio: 250244 b64 bytes*
*note: gesture item (association)*

> Fork. Your turn. Tap the picture to that goes with fork.

### hands-hold:pv-5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pv-5
*expect: turn · turn_ended: True · 9.4s · audio: 524164 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: think about which one is used with fork — they belong together. Your turn. Tap the picture that goes with fork.

### commit-right:pv-5
*expect: turn · turn_ended: True · 3.9s · audio: 144004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Fork goes with spoon.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 389160 b64 bytes*

> What wonderful word work today! Your words grew bigger and stronger. See you next time!
