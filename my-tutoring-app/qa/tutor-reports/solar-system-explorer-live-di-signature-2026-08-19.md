# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `ssc-1` | voice/watch-orbits | Mercury | ✅ | Neptune | ✅ |
| `ssc-2` | voice/watch-orbits | Neptune | ✅ | Mercury | ✅ |
| `ssc-3` | voice/watch-orbits | Jupiter | ✅ | Mars | ✅ |
| `ssc-4` | voice/watch-orbits | Neptune | ✅ | Uranus | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 14.0s · audio: 801284 b64 bytes*
*note: voice item (watch-orbits)*

> Hi! Time to explore the sky! Watch the planets travel around the Sun, then say the name of the one I ask for. Watch them travel. Which planet takes the longest to go all the way around the Sun? Say its name.

### wrong:ssc-1
*expect: turn · turn_ended: True · 12.8s · audio: 737924 b64 bytes*
*note: student says "Mercury" — the quickest planet — the relationship flipped*

> My turn: the farther the ring, the longer the trip — Neptune is farthest, so its year is the longest. Your turn. Which planet takes the longest to go around the Sun?

### right:ssc-1
*expect: turn · turn_ended: True · 7.8s · audio: 386564 b64 bytes*
*note: student says "Neptune"*

> Yes, Neptune. Neptune is the farthest away, so its trip around the Sun is the longest of all.

### ask:ssc-2
*expect: turn · turn_ended: True · 6.0s · audio: 284804 b64 bytes*
*note: voice item (watch-orbits)*

> Watch them travel. Which planet goes around the Sun the quickest? Say its name.

### wrong:ssc-2
*expect: turn · turn_ended: True · 11.6s · audio: 661764 b64 bytes*
*note: student says "Neptune" — the slowest planet — the relationship flipped*

> My turn: the closer the ring, the quicker the trip — Mercury is closest, so its year is the shortest. Your turn. Which planet goes around the Sun the quickest?

### right:ssc-2
*expect: turn · turn_ended: True · 6.6s · audio: 347560 b64 bytes*
*note: student says "Mercury"*

> Yes, Mercury. Mercury is the closest in, so its trip around the Sun is the shortest.

### ask:ssc-3
*expect: turn · turn_ended: True · 6.2s · audio: 296324 b64 bytes*
*note: voice item (watch-orbits)*

> Watch Mars and Jupiter go around the Sun. Which one is faster? Say its name.

### wrong:ssc-3
*expect: turn · turn_ended: True · 10.9s · audio: 544644 b64 bytes*
*note: student says "Jupiter" — the other planet of the pair — the direction reversal*

> My turn: the closer ring is the quicker trip — Mars is faster. Your turn. Watch Mars and Jupiter — which one is faster?

### right:ssc-3
*expect: turn · turn_ended: True · 6.4s · audio: 320004 b64 bytes*
*note: student says "Mars"*

> Yes, Mars is faster — its ring is closer to the Sun, so its trip is shorter.

### ask:ssc-4
*expect: turn · turn_ended: True · 6.4s · audio: 314920 b64 bytes*
*note: voice item (watch-orbits)*

> Watch Uranus and Neptune go around the Sun. Which one is faster? Say its name.

### wrong:ssc-4
*expect: turn · turn_ended: True · 10.5s · audio: 572164 b64 bytes*
*note: student says "Neptune" — the other planet of the pair — the direction reversal*

> My turn: the closer ring is the quicker trip — Uranus is faster. Your turn. Watch Uranus and Neptune — which one is faster?

### right:ssc-4
*expect: turn · turn_ended: True · 6.4s · audio: 327044 b64 bytes*
*note: student says "Uranus"*

> Yes, Uranus is faster — its ring is closer to the Sun, so its trip is shorter.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 380164 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
