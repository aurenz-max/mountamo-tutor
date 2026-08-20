# Tier-3 Live Tutor Report — states-of-matter — 2026-08-20

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "states-of-matter", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "som-1-observe", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:som-1-observe 1/1, wrong3:som-1-observe 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `som-1-observe` | voice/name_state | gas | ✅✅✅ | - | n/a |
| `som-2-observe` | voice/name_state | solid | ✅ | liquid | ✅ |
| `som-3-observe` | voice/name_state | gas | ✅ | solid | ✅ |
| `som-4-observe` | voice/name_state | solid | ✅ | liquid | ✅ |
| `som-5-observe` | voice/name_state | gas | ✅ | solid | ✅ |
| `som-6-observe` | voice/name_state | solid | ✅ | liquid | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:som-1-observe
*expect: turn · turn_ended: True · 25.4s · audio: 1523844 b64 bytes*
*note: voice item (name_state)*

> Hi! Time to find out what heat does to things! I show you something in a beaker beside its tiny particles — you say what state it is, out loud! Particles that only shake in place are a solid; particles that slide past each other are a liquid; particles that fly apart are a gas. Look at the Coconut Oil in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong1:som-1-observe
*expect: turn · turn_ended: True · 16.0s · audio: 941444 b64 bytes*
*note: student says "gas"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Coconut Oil again and say what state it is.

### wrong2:som-1-observe
*expect: turn · turn_ended: True · 16.3s · audio: 959364 b64 bytes*
*note: student says "gas"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Coconut Oil again and say what state it is.

### wrong3:som-1-observe
*expect: turn · turn_ended: True · 16.2s · audio: 954244 b64 bytes*
*note: student says "gas"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Coconut Oil again and say what state it is.

### moveon:som-1-observe
*expect: turn · turn_ended: True · 12.2s · audio: 659204 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That Coconut Oil is a solid. Here comes the next one. Look at the Oxygen in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong:som-2-observe
*expect: turn · turn_ended: True · 15.9s · audio: 917764 b64 bytes*
*note: student says "solid"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Oxygen again and say what state it is.

### right:som-2-observe
*expect: turn · turn_ended: True · 6.3s · audio: 313604 b64 bytes*
*note: student says "liquid"*

> Yes, the Oxygen is a liquid — you read that straight off the particles.

### ask:som-3-observe
*expect: turn · turn_ended: True · 7.1s · audio: 347524 b64 bytes*
*note: voice item (name_state)*

> Look at the Nitrogen in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong:som-3-observe
*expect: turn · turn_ended: True · 15.8s · audio: 931844 b64 bytes*
*note: student says "gas"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Nitrogen again and say what state it is.

### right:som-3-observe
*expect: turn · turn_ended: True · 5.9s · audio: 298244 b64 bytes*
*note: student says "solid"*

> Yes, the Nitrogen is a solid — you read that straight off the particles.

### ask:som-4-observe
*expect: turn · turn_ended: True · 7.1s · audio: 338564 b64 bytes*
*note: voice item (name_state)*

> Look at the Chocolate in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong:som-4-observe
*expect: turn · turn_ended: True · 16.1s · audio: 941444 b64 bytes*
*note: student says "solid"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Chocolate again and say what state it is.

### right:som-4-observe
*expect: turn · turn_ended: True · 6.2s · audio: 307240 b64 bytes*
*note: student says "liquid"*

> Yes, the Chocolate is a liquid — you read that straight off the particles.

### ask:som-5-observe
*expect: turn · turn_ended: True · 6.8s · audio: 334084 b64 bytes*
*note: voice item (name_state)*

> Look at the Wax in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong:som-5-observe
*expect: turn · turn_ended: True · 15.8s · audio: 925444 b64 bytes*
*note: student says "gas"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Wax again and say what state it is.

### right:som-5-observe
*expect: turn · turn_ended: True · 8.8s · audio: 291844 b64 bytes*
*note: student says "solid"*

> Yes, the Wax is a solid — you read that straight off the particles.

### ask:som-6-observe
*expect: turn · turn_ended: True · 7.1s · audio: 348164 b64 bytes*
*note: voice item (name_state)*

> Look at the Iron in the beaker and watch its tiny particles. Your turn. Say what state it is.

### wrong:som-6-observe
*expect: turn · turn_ended: True · 15.8s · audio: 926084 b64 bytes*
*note: student says "solid"*

> My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the Iron again and say what state it is.

### right:som-6-observe
*expect: turn · turn_ended: True · 5.8s · audio: 288004 b64 bytes*
*note: student says "liquid"*

> Yes, the Iron is a liquid — you read that straight off the particles.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 422404 b64 bytes*

> What great science today! You watched the tiny particles and worked out what heat does to them. See you next time!
