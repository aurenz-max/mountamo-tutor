# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `ssc-1` | voice/count-rings | Neptune | ✅ | Mercury | ✅ |
| `ssc-2` | voice/count-rings | Mercury | ✅ | Neptune | ✅ |
| `ssc-3` | voice/count-rings | Mercury | ✅ | Venus | ✅ |
| `ssc-4` | voice/count-rings | Venus | ✅ | Earth | ✅ |
| `ssc-5` | voice/count-rings | Jupiter | ✅ | Saturn | ✅ |
| `ssc-6` | voice/count-rings | Saturn | ✅ | Uranus | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 13.3s · audio: 762920 b64 bytes*
*note: voice item (count-rings)*

> Hi! Time to explore the sky! Look at the rings around the Sun — each planet rides its own ring. Say the planet's name out loud. Which planet is closest to the Sun? Say its name.

### wrong:ssc-1
*expect: turn · turn_ended: True · 9.4s · audio: 532484 b64 bytes*
*note: student says "Neptune" — the direction reversal — the farthest planet, named confidently*

> My turn: start at the Sun and find the smallest ring — Mercury rides it. Your turn. Which planet is closest to the Sun?

### right:ssc-1
*expect: turn · turn_ended: True · 6.4s · audio: 333480 b64 bytes*
*note: student says "Mercury"*

> Yes, Mercury. Mercury rides the smallest ring, right beside the Sun.

### ask:ssc-2
*expect: turn · turn_ended: True · 5.0s · audio: 227844 b64 bytes*
*note: voice item (count-rings)*

> Which planet is farthest from the Sun? Say its name.

### wrong:ssc-2
*expect: turn · turn_ended: True · 10.3s · audio: 568324 b64 bytes*
*note: student says "Mercury" — the direction reversal — the closest planet, named confidently*

> My turn: find the biggest ring, out at the very edge — Neptune rides it. Your turn. Which planet is farthest from the Sun?

### right:ssc-2
*expect: turn · turn_ended: True · 6.5s · audio: 322564 b64 bytes*
*note: student says "Neptune"*

> Yes, Neptune. Neptune rides the biggest ring, far far away.

### ask:ssc-3
*expect: turn · turn_ended: True · 7.0s · audio: 352004 b64 bytes*
*note: voice item (count-rings)*

> Count the rings out from the Sun. Which planet is second from the Sun? Say its name.

### wrong:ssc-3
*expect: turn · turn_ended: True · 10.0s · audio: 551684 b64 bytes*
*note: student says "Mercury" — the count-the-Sun error — one planet short of the target*

> My turn: count the rings out from the Sun — one, two — Venus is second. Your turn. Which planet is second from the Sun?

### right:ssc-3
*expect: turn · turn_ended: True · 6.6s · audio: 342404 b64 bytes*
*note: student says "Venus"*

> Yes, Venus. Count the rings — one, two — Venus is second from the Sun.

### ask:ssc-4
*expect: turn · turn_ended: True · 6.6s · audio: 325764 b64 bytes*
*note: voice item (count-rings)*

> Count the rings out from the Sun. Which planet is third from the Sun? Say its name.

### wrong:ssc-4
*expect: turn · turn_ended: True · 10.0s · audio: 567044 b64 bytes*
*note: student says "Venus" — the count-the-Sun error — one planet short of the target*

> My turn: count the rings out from the Sun — one, two, three — Earth is third. Your turn. Which planet is third from the Sun?

### right:ssc-4
*expect: turn · turn_ended: True · 6.6s · audio: 347524 b64 bytes*
*note: student says "Earth"*

> Yes, Earth. Count the rings — one, two, three — Earth is third from the Sun.

### ask:ssc-5
*expect: turn · turn_ended: True · 7.0s · audio: 330884 b64 bytes*
*note: voice item (count-rings)*

> Count the rings out from the Sun. Which planet is sixth from the Sun? Say its name.

### wrong:ssc-5
*expect: turn · turn_ended: True · 12.5s · audio: 695684 b64 bytes*
*note: student says "Jupiter" — the count-the-Sun error — one planet short of the target*

> My turn: count the rings out from the Sun — one, two, three, four, five, six — Saturn is sixth. Your turn. Which planet is sixth from the Sun?

### right:ssc-5
*expect: turn · turn_ended: True · 9.2s · audio: 500484 b64 bytes*
*note: student says "Saturn"*

> Yes, Saturn. Count the rings — one, two, three, four, five, six — Saturn is sixth from the Sun.

### ask:ssc-6
*expect: turn · turn_ended: True · 6.8s · audio: 336004 b64 bytes*
*note: voice item (count-rings)*

> Count the rings out from the Sun. Which planet is seventh from the Sun? Say its name.

### wrong:ssc-6
*expect: turn · turn_ended: True · 12.6s · audio: 718724 b64 bytes*
*note: student says "Saturn" — the count-the-Sun error — one planet short of the target*

> My turn: count the rings out from the Sun — one, two, three, four, five, six, seven — Uranus is seventh. Your turn. Which planet is seventh from the Sun?

### right:ssc-6
*expect: turn · turn_ended: True · 9.5s · audio: 531204 b64 bytes*
*note: student says "Uranus"*

> Yes, Uranus. Count the rings — one, two, three, four, five, six, seven — Uranus is seventh from the Sun.

### complete
*expect: turn · turn_ended: True · 7.6s · audio: 405124 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
