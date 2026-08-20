# Tier-3 Live Tutor Report — compare-objects — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "compare-objects", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "co-1", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:co-1 1/1, wrong3:co-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `co-1` | voice/name-object | plastic cup | ✅✅✅ | - | n/a |
| `co-2` | voice/name-object | brick | ✅ | balloon | ✅ |
| `co-3` | voice/name-object | spoon | ✅ | bucket | ✅ |
| `co-4` | voice/name-object | pitcher | ✅ | eyedropper | ✅ |
| `co-5` | voice/name-object | marble | ✅ | candle | ✅ |
| `co-6` | voice/name-object | glass bottle | ✅ | ice cube | ✅ |
| `co-7` | voice/name-object | chocolate chip | ✅ | frozen popsicle | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:co-1
*expect: turn · turn_ended: True · 12.3s · audio: 684804 b64 bytes*
*note: voice item (name-object)*

> Hi! Time to measure and compare! Look at both things, then say the name of the one I ask for. Which one is heavier — the metal ice tray or the plastic cup? Say its name.

### wrong1:co-1
*expect: turn · turn_ended: True · 11.5s · audio: 661764 b64 bytes*
*note: student says "plastic cup"*

> My turn: look at which side of the scale sinks down — the metal ice tray is heavier. Your turn. Which one is heavier — the metal ice tray or the plastic cup? Say its name.

### wrong2:co-1
*expect: turn · turn_ended: True · 11.5s · audio: 659844 b64 bytes*
*note: student says "plastic cup"*

> My turn: look at which side of the scale sinks down — the metal ice tray is heavier. Your turn. Which one is heavier — the metal ice tray or the plastic cup? Say its name.

### wrong3:co-1
*expect: turn · turn_ended: True · 11.5s · audio: 650244 b64 bytes*
*note: student says "plastic cup"*

> My turn: look at which side of the scale sinks down — the metal ice tray is heavier. Your turn. Which one is heavier — the metal ice tray or the plastic cup? Say its name.

### moveon:co-1
*expect: turn · turn_ended: True · 6.8s · audio: 319364 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Which one is lighter — the brick or the balloon? Say its name.

### wrong:co-2
*expect: turn · turn_ended: True · 10.9s · audio: 599684 b64 bytes*
*note: student says "brick"*

> My turn: look at which side of the scale sinks down — the balloon is lighter. Your turn. Which one is lighter — the brick or the balloon? Say its name.

### right:co-2
*expect: turn · turn_ended: True · 3.3s · audio: 118404 b64 bytes*
*note: student says "balloon"*

> Yes, the balloon is lighter.

### ask:co-3
*expect: turn · turn_ended: True · 5.7s · audio: 249604 b64 bytes*
*note: voice item (name-object)*

> Which one holds more — the bucket or the spoon? Say its name.

### wrong:co-3
*expect: turn · turn_ended: True · 10.4s · audio: 577924 b64 bytes*
*note: student says "spoon"*

> My turn: look at which one is filled up higher — the bucket holds more. Your turn. Which one holds more — the bucket or the spoon? Say its name.

### right:co-3
*expect: turn · turn_ended: True · 3.3s · audio: 122244 b64 bytes*
*note: student says "bucket"*

> Yes, the bucket holds more.

### ask:co-4
*expect: turn · turn_ended: True · 5.5s · audio: 256004 b64 bytes*
*note: voice item (name-object)*

> Which one holds less — the pitcher or the eyedropper? Say its name.

### wrong:co-4
*expect: turn · turn_ended: True · 10.9s · audio: 615684 b64 bytes*
*note: student says "pitcher"*

> My turn: look at which one is filled up higher — the eyedropper holds less. Your turn. Which one holds less — the pitcher or the eyedropper? Say its name.

### right:co-4
*expect: turn · turn_ended: True · 4.0s · audio: 131844 b64 bytes*
*note: student says "eyedropper"*

> Yes, the eyedropper holds less.

### ask:co-5
*expect: turn · turn_ended: True · 5.3s · audio: 244484 b64 bytes*
*note: voice item (name-object)*

> Which one is taller — the candle or the marble? Say its name.

### wrong:co-5
*expect: turn · turn_ended: True · 11.0s · audio: 613124 b64 bytes*
*note: student says "marble"*

> My turn: stand them side by side and look at the tops — the candle is taller. Your turn. Which one is taller — the candle or the marble? Say its name.

### right:co-5
*expect: turn · turn_ended: True · 3.5s · audio: 120964 b64 bytes*
*note: student says "candle"*

> Yes, the candle is taller.

### ask:co-6
*expect: turn · turn_ended: True · 5.9s · audio: 263684 b64 bytes*
*note: voice item (name-object)*

> Which one is shorter — the glass bottle or the ice cube? Say its name.

### wrong:co-6
*expect: turn · turn_ended: True · 11.3s · audio: 624004 b64 bytes*
*note: student says "glass bottle"*

> My turn: stand them side by side and look at the tops — the ice cube is shorter. Your turn. Which one is shorter — the glass bottle or the ice cube? Say its name.

### right:co-6
*expect: turn · turn_ended: True · 3.3s · audio: 140840 b64 bytes*
*note: student says "ice cube"*

> Yes, the ice cube is shorter.

### ask:co-7
*expect: turn · turn_ended: True · 6.1s · audio: 293800 b64 bytes*
*note: voice item (name-object)*

> Which one is longer — the frozen popsicle or the chocolate chip? Say its name.

### wrong:co-7
*expect: turn · turn_ended: True · 12.0s · audio: 693124 b64 bytes*
*note: student says "chocolate chip"*

> My turn: line them up at one end and look at the other end — the frozen popsicle is longer. Your turn. Which one is longer — the frozen popsicle or the chocolate chip? Say its name.

### right:co-7
*expect: turn · turn_ended: True · 3.5s · audio: 149764 b64 bytes*
*note: student says "frozen popsicle"*

> Yes, the frozen popsicle is longer.

### complete
*expect: turn · turn_ended: True · 6.3s · audio: 321284 b64 bytes*

> What great measuring today! You compared, you ordered, and you counted. See you next time!
