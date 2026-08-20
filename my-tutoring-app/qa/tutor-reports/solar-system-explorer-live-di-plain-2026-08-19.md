# Tier-3 Live Tutor Report — solar-system-explorer — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "solar-system-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "ssc-1", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:ssc-1 1/1, wrong3:ssc-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:ssc-1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ssc-1` | voice/name-planet | Venus | ✅✅✅ | - | n/a |
| `ssc-2` | voice/name-planet | Mercury | ✅ | Venus | ✅ |
| `ssc-3` | voice/name-planet | Mercury | ✅ | Mars | ✅ |
| `ssc-4` | voice/name-planet | Mercury | ✅ | Jupiter | ✅ |
| `ssc-5` | voice/name-planet | Mercury | ✅ | Uranus | ✅ |
| `ssc-6` | voice/name-planet | Mercury | ✅ | Neptune | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ssc-1
*expect: turn · turn_ended: True · 11.4s · audio: 620804 b64 bytes*
*note: voice item (name-planet)*

> Hi! Time to explore the sky! When a planet glows bright, look at it, then say its name out loud. Look at the planet glowing bright. What planet is that?

### wrong1:ssc-1
*expect: turn · turn_ended: True · 8.3s · audio: 455044 b64 bytes*
*note: student says "Venus"*

> My turn: that planet is Mercury — the small grey one. Your turn. What planet is that?

### wrong2:ssc-1
*expect: turn · turn_ended: True · 8.9s · audio: 448004 b64 bytes*
*note: student says "Venus"*

> My turn: that planet is Mercury — the small grey one. Your turn. What planet is that?

### wrong3:ssc-1
*expect: turn · turn_ended: True · 8.0s · audio: 442244 b64 bytes*
*note: student says "Venus"*

> My turn: that planet is Mercury — the small grey one. Your turn. What planet is that?

### moveon:ssc-1
*expect: turn · turn_ended: True · 5.8s · audio: 266244 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Look at the planet glowing bright. What planet is that?

### wrong:ssc-2
*expect: turn · turn_ended: True · 8.3s · audio: 429444 b64 bytes*
*note: student says "Mercury"*

> My turn: that planet is Venus — the pale yellow one. Your turn. What planet is that?

### right:ssc-2
*expect: turn · turn_ended: True · 5.1s · audio: 225960 b64 bytes*
*note: student says "Venus"*

> Yes, Venus. Venus is the pale yellow one.

### ask:ssc-3
*expect: turn · turn_ended: True · 4.6s · audio: 199684 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-3
*expect: turn · turn_ended: True · 7.8s · audio: 416644 b64 bytes*
*note: student says "Mercury"*

> My turn: that planet is Mars — the red one. Your turn. What planet is that?

### right:ssc-3
*expect: turn · turn_ended: True · 4.4s · audio: 186884 b64 bytes*
*note: student says "Mars"*

> Yes, Mars. Mars is the red one.

### ask:ssc-4
*expect: turn · turn_ended: True · 4.8s · audio: 211204 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-4
*expect: turn · turn_ended: True · 8.2s · audio: 449284 b64 bytes*
*note: student says "Mercury"*

> My turn: that planet is Jupiter — the one with orange stripes. Your turn. What planet is that?

### right:ssc-4
*expect: turn · turn_ended: True · 6.2s · audio: 237444 b64 bytes*
*note: student says "Jupiter"*

> Yes, Jupiter. Jupiter is the one with orange stripes.

### ask:ssc-5
*expect: turn · turn_ended: True · 5.2s · audio: 240004 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-5
*expect: turn · turn_ended: True · 8.7s · audio: 480644 b64 bytes*
*note: student says "Mercury"*

> My turn: that planet is Uranus — the light blue-green one. Your turn. What planet is that?

### right:ssc-5
*expect: turn · turn_ended: True · 5.1s · audio: 250884 b64 bytes*
*note: student says "Uranus"*

> Yes, Uranus. Uranus is the light blue-green one.

### ask:ssc-6
*expect: turn · turn_ended: True · 5.0s · audio: 224004 b64 bytes*
*note: voice item (name-planet)*

> Look at the planet glowing bright. What planet is that?

### wrong:ssc-6
*expect: turn · turn_ended: True · 8.5s · audio: 452484 b64 bytes*
*note: student says "Mercury"*

> My turn: that planet is Neptune — the deep blue one. Your turn. What planet is that?

### right:ssc-6
*expect: turn · turn_ended: True · 4.6s · audio: 215720 b64 bytes*
*note: student says "Neptune"*

> Yes, Neptune. Neptune is the deep blue one.

### complete
*expect: turn · turn_ended: True · 7.9s · audio: 419844 b64 bytes*

> What great sky-watching today! You called the planets by name, like a real astronomer. See you next time!
