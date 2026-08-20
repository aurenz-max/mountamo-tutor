# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `ssc-1` | voice/name-kind | Neptune | ✅ | Mercury | ✅ |
| `ssc-2` | voice/name-kind | Earth | ✅ | Jupiter | ✅ |
| `ssc-3` | voice/name-kind | Mercury | ✅ | Pluto | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 12.8s · audio: 729604 b64 bytes*
*note: voice item (name-kind)*

> Hi! Time to explore the sky! Think about what kind of planet each one is, then say one planet's name out loud. Rocky planets are the smaller ones made of rock. Say the name of one rocky planet.

### wrong:ssc-1
*expect: turn · turn_ended: True · 9.6s · audio: 522244 b64 bytes*
*note: student says "Neptune" — the smallest giant — small mistaken for rocky*

> My turn: rocky planets are the smaller ones made of rock — Mercury is one. Your turn. Say the name of one rocky planet.

### right:ssc-1
*expect: turn · turn_ended: True · 5.3s · audio: 255364 b64 bytes*
*note: student says "Mercury"*

> Yes, that one is a rocky planet — the smaller ones made of rock.

### ask:ssc-2
*expect: turn · turn_ended: True · 7.0s · audio: 344964 b64 bytes*
*note: voice item (name-kind)*

> Gas giants are the great big planets made of gas. Say the name of one gas giant.

### wrong:ssc-2
*expect: turn · turn_ended: True · 9.4s · audio: 512644 b64 bytes*
*note: student says "Earth" — the biggest rocky planet — big mistaken for made-of-gas*

> My turn: gas giants are the great big ones made of gas — Jupiter is one. Your turn. Say the name of one gas giant.

### right:ssc-2
*expect: turn · turn_ended: True · 5.5s · audio: 280964 b64 bytes*
*note: student says "Jupiter"*

> Yes, that one is a gas giant — the great big planets made of gas.

### ask:ssc-3
*expect: turn · turn_ended: True · 7.4s · audio: 367364 b64 bytes*
*note: voice item (name-kind)*

> A dwarf planet is a tiny world, smaller than a true planet. Say the name of one dwarf planet.

### wrong:ssc-3
*expect: turn · turn_ended: True · 9.8s · audio: 552324 b64 bytes*
*note: student says "Mercury" — the smallest true planet — small mistaken for dwarf*

> My turn: a dwarf planet is a tiny world, smaller than a true planet — Pluto is one. Your turn. Say the name of one dwarf planet.

### right:ssc-3
*expect: turn · turn_ended: True · 5.9s · audio: 299524 b64 bytes*
*note: student says "Pluto"*

> Yes, that one is a dwarf planet — the tiny worlds, smaller than a true planet.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 387844 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
