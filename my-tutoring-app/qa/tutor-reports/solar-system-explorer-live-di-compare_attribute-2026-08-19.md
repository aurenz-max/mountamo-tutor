# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `ssc-1` | voice/compare-planets | Sun | ✅ | Jupiter | ✅ |
| `ssc-2` | voice/compare-planets | Pluto | ✅ | Mercury | ✅ |
| `ssc-3` | voice/compare-planets | Jupiter | ✅ | Saturn | ✅ |
| `ssc-4` | voice/compare-planets | Mercury | ✅ | Venus | ✅ |
| `ssc-5` | voice/compare-planets | Mercury | ✅ | Earth | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 12.7s · audio: 714244 b64 bytes*
*note: voice item (compare-planets)*

> Hi! Time to explore the sky! Look at the planets next to each other, then say the name of the one I ask for. Look at all the planets. Which planet is the biggest? Say its name.

### wrong:ssc-1
*expect: turn · turn_ended: True · 9.8s · audio: 542724 b64 bytes*
*note: student says "Sun" — the Sun — the biggest thing on screen, but a star, not a planet*

> My turn: look at how much room each planet takes up — Jupiter takes the most. Your turn. Which planet is the biggest?

### right:ssc-1
*expect: turn · turn_ended: True · 5.8s · audio: 276520 b64 bytes*
*note: student says "Jupiter"*

> Yes, Jupiter. Jupiter is the biggest planet here.

### ask:ssc-2
*expect: turn · turn_ended: True · 6.1s · audio: 285444 b64 bytes*
*note: voice item (compare-planets)*

> Look at all the planets. Which planet is the smallest? Say its name.

### wrong:ssc-2
*expect: turn · turn_ended: True · 9.1s · audio: 482564 b64 bytes*
*note: student says "Pluto" — the tinier dwarf (or runner-up) that is not a true planet answer*

> My turn: look for the tiniest circle of all — that is Mercury. Your turn. Which planet is the smallest?

### right:ssc-2
*expect: turn · turn_ended: True · 5.5s · audio: 266884 b64 bytes*
*note: student says "Mercury"*

> Yes, Mercury. Mercury is the smallest planet here.

### ask:ssc-3
*expect: turn · turn_ended: True · 8.5s · audio: 359044 b64 bytes*
*note: voice item (compare-planets)*

> Tap the planets and look at their moons. Which planet has the most moons? Say its name.

### wrong:ssc-3
*expect: turn · turn_ended: True · 10.3s · audio: 574724 b64 bytes*
*note: student says "Jupiter" — the famous runner-up, named from fame rather than the cards*

> My turn: tap the planets and check their cards one at a time — Saturn has the most moons. Your turn. Which planet has the most moons?

### right:ssc-3
*expect: turn · turn_ended: True · 6.0s · audio: 288004 b64 bytes*
*note: student says "Saturn"*

> Yes, Saturn. Saturn has more moons than any other planet here.

### ask:ssc-4
*expect: turn · turn_ended: True · 7.4s · audio: 366120 b64 bytes*
*note: voice item (compare-planets)*

> Tap the planets and check how hot each one is. Which planet is the hottest? Say its name.

### wrong:ssc-4
*expect: turn · turn_ended: True · 9.8s · audio: 524840 b64 bytes*
*note: student says "Mercury" — the closest planet — closest-is-hottest, the canonical trap*

> My turn: the closest planet is not the hottest — Venus is the hottest. Your turn. Which planet is the hottest?

### right:ssc-4
*expect: turn · turn_ended: True · 7.8s · audio: 398084 b64 bytes*
*note: student says "Venus"*

> Yes, Venus. Venus is the hottest planet here, even though it is not the closest to the Sun.

### ask:ssc-5
*expect: turn · turn_ended: True · 6.0s · audio: 268164 b64 bytes*
*note: voice item (compare-planets)*

> Look at Mercury and Earth. Which one is bigger? Say its name.

### wrong:ssc-5
*expect: turn · turn_ended: True · 9.8s · audio: 535684 b64 bytes*
*note: student says "Mercury" — the other planet of the pair — the direction reversal*

> My turn: look at how much room each one takes up — Earth is bigger. Your turn. Look at Mercury and Earth — which one is bigger?

### right:ssc-5
*expect: turn · turn_ended: True · 3.8s · audio: 150404 b64 bytes*
*note: student says "Earth"*

> Yes, Earth is bigger than Mercury.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 393604 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
