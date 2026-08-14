# Tier-3 Live Tutor Report — number-bond — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "number-bond", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "Grade 1"}`
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
| `c1` | gesture/build | (placement) | ✅ | (placement) | ✅ |
| `c2` | gesture/build | (placement) | ✅ | (placement) | ✅ |
| `c3` | gesture/build | (placement) | ✅ | (placement) | ✅ |
| `c4` | gesture/build | (placement) | ✅ | (placement) | ✅ |
| `c5` | gesture/build | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 12.6s · audio: 717444 b64 bytes*
*note: gesture item (build)*

> Hi! Time for number bonds! Tap the tiles to build the number sentence. When you stop, I will check it. The parts are two and three, and the whole is five. Build a number sentence with the tiles.

### hands-hold:c1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c1
*expect: turn · turn_ended: True · 10.3s · audio: 562564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: those numbers do not make that total. Look at the bond: two and three make five. Your turn — build the number sentence again.

### commit-right:c1
*expect: turn · turn_ended: True · 6.5s · audio: 341764 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Two plus three equals five. Your number sentence tells the truth about the bond!

### ask:c2
*expect: turn · turn_ended: True · 6.7s · audio: 337924 b64 bytes*
*note: gesture item (build)*

> The parts are four and two, and the whole is six. Build a number sentence with the tiles.

### hands-hold:c2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c2
*expect: turn · turn_ended: True · 10.3s · audio: 561924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: those numbers do not make that total. Look at the bond: four and two make six. Your turn — build the number sentence again.

### commit-right:c2
*expect: turn · turn_ended: True · 6.5s · audio: 335364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Four plus two equals six. Your number sentence tells the truth about the bond!

### ask:c3
*expect: turn · turn_ended: True · 7.2s · audio: 364164 b64 bytes*
*note: gesture item (build)*

> The parts are three and four, and the whole is seven. Build a number sentence with the tiles.

### hands-hold:c3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c3
*expect: turn · turn_ended: True · 10.1s · audio: 566404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: those numbers do not make that total. Look at the bond: three and four make seven. Your turn — build the number sentence again.

### commit-right:c3
*expect: turn · turn_ended: True · 7.0s · audio: 362244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Three plus four equals seven. Your number sentence tells the truth about the bond!

### ask:c4
*expect: turn · turn_ended: True · 7.4s · audio: 353284 b64 bytes*
*note: gesture item (build)*

> The parts are five and three, and the whole is eight. Build a number sentence with the tiles.

### hands-hold:c4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c4
*expect: turn · turn_ended: True · 10.1s · audio: 572804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: those numbers do not make that total. Look at the bond: five and three make eight. Your turn — build the number sentence again.

### commit-right:c4
*expect: turn · turn_ended: True · 7.3s · audio: 350724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Five plus three equals eight. Your number sentence tells the truth about the bond!

### ask:c5
*expect: turn · turn_ended: True · 7.1s · audio: 361604 b64 bytes*
*note: gesture item (build)*

> The parts are six and four, and the whole is ten. Build a number sentence with the tiles.

### hands-hold:c5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:c5
*expect: turn · turn_ended: True · 10.6s · audio: 576004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: those numbers do not make that total. Look at the bond: six and four make ten. Your turn — build the number sentence again.

### commit-right:c5
*expect: turn · turn_ended: True · 6.9s · audio: 359684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Six plus four equals ten. Your number sentence tells the truth about the bond!

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 395524 b64 bytes*

> What great number bond work today! You broke numbers apart and put them back together. See you next time!
