# Tier-3 Live Tutor Report — number-bond — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "number-bond", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "kindergarten"}`
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
| `c1` | voice/say | three | ✅ | two | ✅ |
| `c2` | voice/say | four | ✅ | two | ✅ |
| `c3` | voice/say | two | ✅ | one | ✅ |
| `c4` | voice/say | five | ✅ | two | ✅ |
| `c5` | voice/say | five | ✅ | three | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 12.8s · audio: 716164 b64 bytes*
*note: voice item (say)*

> Hi! Time for number bonds! Look at the number bond and think, then say the missing part out loud. Three is the whole. One part is one. What is the other part?

### wrong:c1
*expect: turn · turn_ended: True · 11.8s · audio: 677764 b64 bytes*
*note: student says "three" — the whole said back instead of the missing part — the ask itself just said it*

> My turn: start at one and count up to three: two, three. That is two more. Your turn. One part is one — what is the other part?

### right:c1
*expect: turn · turn_ended: True · 4.7s · audio: 224004 b64 bytes*
*note: student says "two"*

> Yes, two — two and one make three.

### ask:c2
*expect: turn · turn_ended: True · 6.7s · audio: 295684 b64 bytes*
*note: voice item (say)*

> Four is the whole. One part is two. What is the other part?

### wrong:c2
*expect: turn · turn_ended: True · 11.5s · audio: 656004 b64 bytes*
*note: student says "four" — the whole said back instead of the missing part — the ask itself just said it*

> My turn: start at two and count up to four: three, four. That is two more. Your turn. One part is two — what is the other part?

### right:c2
*expect: turn · turn_ended: True · 4.6s · audio: 218244 b64 bytes*
*note: student says "two"*

> Yes, two — two and two make four.

### ask:c3
*expect: turn · turn_ended: True · 6.4s · audio: 295044 b64 bytes*
*note: voice item (say)*

> Two is the whole. One part is one. What is the other part?

### wrong:c3
*expect: turn · turn_ended: True · 11.4s · audio: 630404 b64 bytes*
*note: student says "two" — the whole said back instead of the missing part — the ask itself just said it*

> My turn: start at one and count up to two: two. That is one more. Your turn. One part is one — what is the other part?

### right:c3
*expect: turn · turn_ended: True · 4.5s · audio: 205444 b64 bytes*
*note: student says "one"*

> Yes, one — one and one make two.

### ask:c4
*expect: turn · turn_ended: True · 6.4s · audio: 310404 b64 bytes*
*note: voice item (say)*

> Five is the whole. One part is three. What is the other part?

### wrong:c4
*expect: turn · turn_ended: True · 11.5s · audio: 657284 b64 bytes*
*note: student says "five" — the whole said back instead of the missing part — the ask itself just said it*

> My turn: start at three and count up to five: four, five. That is two more. Your turn. One part is three — what is the other part?

### right:c4
*expect: turn · turn_ended: True · 5.1s · audio: 236804 b64 bytes*
*note: student says "two"*

> Yes, two — two and three make five.

### ask:c5
*expect: turn · turn_ended: True · 6.7s · audio: 312964 b64 bytes*
*note: voice item (say)*

> Five is the whole. One part is two. What is the other part?

### wrong:c5
*expect: turn · turn_ended: True · 14.2s · audio: 762244 b64 bytes*
*note: student says "five" — the whole said back instead of the missing part — the ask itself just said it*

> My turn: start at two and count up to five: three, four, five. That is three more. Your turn. One part is two — what is the other part?

### right:c5
*expect: turn · turn_ended: True · 5.2s · audio: 241924 b64 bytes*
*note: student says "three"*

> Yes, three — three and two make five.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 395524 b64 bytes*

> What great number bond work today! You broke numbers apart and put them back together. See you next time!
