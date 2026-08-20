# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 0 WARN mechanism(s) confirmed (5 + 0 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-tag-spoken` | ask:ssc-2 1/1, ask:ssc-3 1/1, ask:ssc-4 1/1, ask:ssc-5 1/1, ask:ssc-6 1/1 (5 beats) | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ssc-1` | voice/name-planet | Venus | ✅ | Mercury | ✅ |
| `ssc-2` | voice/name-planet | Earth | ✅ | Venus | ✅ |
| `ssc-3` | voice/name-planet | Mars | ✅ | Earth | ✅ |
| `ssc-4` | voice/name-planet | Jupiter | ✅ | Mars | ✅ |
| `ssc-5` | voice/name-planet | Uranus | ✅ | Saturn | ✅ |
| `ssc-6` | voice/name-planet | Neptune | ✅ | Uranus | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 11.5s · audio: 632964 b64 bytes*
*note: voice item (name-planet)*

> Hi! Time to explore the sky! When a planet glows bright, look at it, then say its name out loud. Look at the planet glowing bright. What planet is that?

### wrong:ssc-1
*expect: turn · turn_ended: True · 7.7s · audio: 410244 b64 bytes*
*note: student says "Venus" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Mercury — the small grey one. Your turn. What planet is that?

### right:ssc-1
*expect: turn · turn_ended: True · 5.2s · audio: 248324 b64 bytes*
*note: student says "Mercury"*

> Yes, Mercury. Mercury is the small grey one.

### ask:ssc-2
*expect: turn · turn_ended: True · 5.0s · audio: 203524 b64 bytes*
*note: voice item (name-planet)*

> [CURRENT STATE]: one planet in the live model is glowing bright; naming it is the task
Look at the planet glowing bright. What planet is that?

### wrong:ssc-2
*expect: turn · turn_ended: True · 7.8s · audio: 404484 b64 bytes*
*note: student says "Earth" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Venus — the pale yellow one. Your turn. What planet is that?

### right:ssc-2
*expect: turn · turn_ended: True · 5.0s · audio: 236164 b64 bytes*
*note: student says "Venus"*

> Yes, Venus. Venus is the pale yellow one.

### ask:ssc-3
*expect: turn · turn_ended: True · 5.1s · audio: 206760 b64 bytes*
*note: voice item (name-planet)*

> [CURRENT STATE]: one planet in the live model is glowing bright; naming it is the task
Look at the planet glowing bright. What planet is that?

### wrong:ssc-3
*expect: turn · turn_ended: True · 8.1s · audio: 426244 b64 bytes*
*note: student says "Mars" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Earth — the blue one, our home. Your turn. What planet is that?

### right:ssc-3
*expect: turn · turn_ended: True · 4.9s · audio: 237480 b64 bytes*
*note: student says "Earth"*

> Yes, Earth. Earth is the blue one, our home.

### ask:ssc-4
*expect: turn · turn_ended: True · 4.7s · audio: 195204 b64 bytes*
*note: voice item (name-planet)*

> [CURRENT STATE]: one planet in the live model is glowing bright; naming it is the task
Look at the planet glowing bright. What planet is that?

### wrong:ssc-4
*expect: turn · turn_ended: True · 7.5s · audio: 376324 b64 bytes*
*note: student says "Jupiter" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Mars — the red one. Your turn. What planet is that?

### right:ssc-4
*expect: turn · turn_ended: True · 4.6s · audio: 199080 b64 bytes*
*note: student says "Mars"*

> Yes, Mars. Mars is the red one.

### ask:ssc-5
*expect: turn · turn_ended: True · 4.5s · audio: 189444 b64 bytes*
*note: voice item (name-planet)*

> [CURRENT STATE]: one planet in the live model is glowing bright; naming it is the task
Look at the planet glowing bright. What planet is that?

### wrong:ssc-5
*expect: turn · turn_ended: True · 8.8s · audio: 451204 b64 bytes*
*note: student says "Uranus" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Saturn — the pale gold one with rings. Your turn. What planet is that?

### right:ssc-5
*expect: turn · turn_ended: True · 5.7s · audio: 276484 b64 bytes*
*note: student says "Saturn"*

> Yes, Saturn. Saturn is the pale gold one with rings.

### ask:ssc-6
*expect: turn · turn_ended: True · 4.7s · audio: 190724 b64 bytes*
*note: voice item (name-planet)*

> [CURRENT STATE]: one planet in the live model is glowing bright; naming it is the task
Look at the planet glowing bright. What planet is that? glowing bright. What planet

### wrong:ssc-6
*expect: turn · turn_ended: True · 8.1s · audio: 433924 b64 bytes*
*note: student says "Neptune" — the neighbour planet — right neighbourhood, wrong name*

> My turn: that planet is Uranus — the light blue-green one. Your turn. What planet is that?

### right:ssc-6
*expect: turn · turn_ended: True · 5.4s · audio: 252164 b64 bytes*
*note: student says "Uranus"*

> Yes, Uranus. Uranus is the light blue-green one.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 403844 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
