# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 5, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 27 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `di-tag-spoken` | right:c1::p2 1/2, ask:c1::p3 1/2, right:c1::p3 1/2, ask:c1::p4 1/2, right:c1::p4 1/2, ask:c1::p6 1/2 — and 8 more (14 beats) | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| note | HIGH | `di-answer-leak-in-ask` | ask:c1::p3 1/2, ask:c1::p4 1/2, ask:c1::p6 1/2, ask:c2::p1 1/2, ask:c2::p5 1/2 (5 beats) | the ask contains the answer "fifth" outside its stimulus: "[CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". Valid answers: "fif" |
| note | WARN | `di-verdict-embellished` | right:c1::p2 1/2, right:c1::p3 1/2, right:c1::p4 1/2, wrong:c1::p6 1/2, right:c1::p6 1/2, wrong:c2::p1 1/2 — and 2 more (8 beats) | added 20 unscripted words to a "say exactly" line. SCRIPT: "Yes, that card says fifth." SPOKE: "[CURRENT STATE]: The child has answered "fifth" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card say" |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1::p2` | voice/read-symbol | two | ✅✅ | second | ✅✅ |
| `c1::p3` | voice/read-symbol | three | ✅✅ | third | ✅✅ |
| `c1::p4` | voice/read-symbol | four | ✅✅ | fourth | ✅✅ |
| `c1::p6` | voice/read-symbol | six | ✅✅ | sixth | ✅✅ |
| `c2::p1` | voice/read-symbol | one | ✅✅ | first | ✅✅ |
| `c2::p5` | voice/read-symbol | five | ✅✅ | fifth | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 5.

## Run 1 — beat-by-beat transcript

### ask:c1::p2
*expect: turn · turn_ended: True · 8.4s · audio: 446724 b64 bytes*
*note: voice item (read-symbol)*

> Hi! Time to line up and count! I will show you one card at a time. Read it out loud. Look at the card. What does it say?

### wrong:c1::p2
*expect: turn · turn_ended: True · 12.4s · audio: 677764 b64 bytes*
*note: student says "two" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two. Two tells how many; second tells which one. This card says second. Your turn. What does it say?

### right:c1::p2
*expect: turn · turn_ended: True · 3.6s · audio: 130564 b64 bytes*
*note: student says "second"*

> [CURRENT STATE]: The child has answered "second" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says second.

### ask:c1::p3
*expect: turn · turn_ended: True · 4.3s · audio: 131844 b64 bytes*
*note: voice item (read-symbol)*

> [CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". The correct answer is "third".

Look at the card. What does it say?

### wrong:c1::p3
*expect: turn · turn_ended: True · 13.8s · audio: 758404 b64 bytes*
*note: student says "three" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three. Three tells how many; third tells which one. This card says third. Your turn. What does it say?

### right:c1::p3
*expect: turn · turn_ended: True · 3.4s · audio: 121604 b64 bytes*
*note: student says "third"*

> [CURRENT STATE]: The child has answered "third" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says third.

### ask:c1::p4
*expect: turn · turn_ended: True · 5.0s · audio: 131844 b64 bytes*
*note: voice item (read-symbol)*

> [CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". Valid answers: "fourth", "the fourth one", "fourth place". Incorrect answers: "four", reading card digit, etc.

Look at the card. What does it say?

### wrong:c1::p4
*expect: turn · turn_ended: True · 13.7s · audio: 802564 b64 bytes*
*note: student says "four" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three, four. Four tells how many; fourth tells which one. This card says fourth. Your turn. What does it say?

### right:c1::p4
*expect: turn · turn_ended: True · 3.5s · audio: 122884 b64 bytes*
*note: student says "fourth"*

> [CURRENT STATE]: The child has answered "fourth" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says fourth.

### ask:c1::p6
*expect: turn · turn_ended: True · 4.8s · audio: 140164 b64 bytes*
*note: voice item (read-symbol)*

> [CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". Valid answers: "sixth", "the sixth one", "sixth place". Incorrect answers: "six", reading card digit, etc.

Look at the card. What does it say?

### wrong:c1::p6
*expect: turn · turn_ended: True · 15.6s · audio: 909444 b64 bytes*
*note: student says "six" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> [CURRENT STATE]: The child has answered "six" which is incorrect for the `match` challenge type. The correct answer is "sixth". "six" says how many, not which one.

My turn: I count up to this card — one, two, three, four, five, six. Six tells how many; sixth tells which one. This card says sixth. Your turn. What does it say?

### right:c1::p6
*expect: turn · turn_ended: True · 4.4s · audio: 129924 b64 bytes*
*note: student says "sixth"*

> [CURRENT STATE]: The child has answered "sixth" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says sixth.

### ask:c2::p1
*expect: turn · turn_ended: True · 4.4s · audio: 144040 b64 bytes*
*note: voice item (read-symbol)*

> [CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". Valid answers: "first", "the first one", "first place". Incorrect answers: "one", reading card digit, etc.

Look at the card. What does it say?

### wrong:c2::p1
*expect: turn · turn_ended: True · 11.7s · audio: 652840 b64 bytes*
*note: student says "one" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> [CURRENT STATE]: The child has answered "one" which is incorrect for the `match` challenge type. The correct answer is "first". "one" says how many, not which one.

My turn: I count up to this card — one. One tells how many; first tells which one. This card says first. Your turn. What does it say?

### right:c2::p1
*expect: turn · turn_ended: True · 3.7s · audio: 127364 b64 bytes*
*note: student says "first"*

> [CURRENT STATE]: The child has answered "first" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says first.

### ask:c2::p5
*expect: turn · turn_ended: True · 4.3s · audio: 151044 b64 bytes*
*note: voice item (read-symbol)*

> [CURRENT STATE]: The stimulus is one place-symbol card on its own waiting to be read. The question is "Look at the card. What does it say?". Valid answers: "fifth", "the fifth one", "fifth place". Incorrect answers: "five", reading card digit, etc.

Look at the card. What does it say?

### wrong:c2::p5
*expect: turn · turn_ended: True · 14.7s · audio: 857640 b64 bytes*
*note: student says "five" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three, four, five. Five tells how many; fifth tells which one. This card says fifth. Your turn. What does it say?

### right:c2::p5
*expect: turn · turn_ended: True · 4.1s · audio: 129924 b64 bytes*
*note: student says "fifth"*

> [CURRENT STATE]: The child has answered "fifth" which is marked correct per the cue's instructions for the `match` challenge type.

Yes, that card says fifth.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 297604 b64 bytes*

> [CURRENT STATE]: The user has completed the learning activity. There are no more upcoming activities.

What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1::p2
*expect: turn · turn_ended: True · 9.3s · audio: 487044 b64 bytes*
*note: voice item (read-symbol)*

> Hi! Time to line up and count! I will show you one card at a time. Read it out loud. Look at the card. What does it say?

### wrong:c1::p2
*expect: turn · turn_ended: True · 13.8s · audio: 789124 b64 bytes*
*note: student says "two" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two. Two tells how many; second tells which one. This card says second. Your turn. What does it say?

### right:c1::p2
*expect: turn · turn_ended: True · 3.3s · audio: 129284 b64 bytes*
*note: student says "second"*

> Yes, that card says second.

### ask:c1::p3
*expect: turn · turn_ended: True · 3.6s · audio: 129924 b64 bytes*
*note: voice item (read-symbol)*

> Look at the card. What does it say?

### wrong:c1::p3
*expect: turn · turn_ended: True · 13.6s · audio: 796804 b64 bytes*
*note: student says "three" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three. Three tells how many; third tells which one. This card says third. Your turn. What does it say?

### right:c1::p3
*expect: turn · turn_ended: True · 3.8s · audio: 117764 b64 bytes*
*note: student says "third"*

> Yes, that card says third.

### ask:c1::p4
*expect: turn · turn_ended: True · 3.5s · audio: 130564 b64 bytes*
*note: voice item (read-symbol)*

> Look at the card. What does it say?

### wrong:c1::p4
*expect: turn · turn_ended: True · 15.6s · audio: 907524 b64 bytes*
*note: student says "four" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three, four. Four tells how many; fourth tells which one. This card says fourth. Your turn. What does it say?

### right:c1::p4
*expect: turn · turn_ended: True · 3.3s · audio: 131844 b64 bytes*
*note: student says "fourth"*

> Yes, that card says fourth.

### ask:c1::p6
*expect: turn · turn_ended: True · 3.6s · audio: 138244 b64 bytes*
*note: voice item (read-symbol)*

> Look at the card. What does it say?

### wrong:c1::p6
*expect: turn · turn_ended: True · 17.8s · audio: 1035524 b64 bytes*
*note: student says "six" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three, four, five, six. Six tells how many; sixth tells which one. This card says sixth. Your turn. What does it say?

### right:c1::p6
*expect: turn · turn_ended: True · 3.4s · audio: 126084 b64 bytes*
*note: student says "sixth"*

> Yes, that card says sixth.

### ask:c2::p1
*expect: turn · turn_ended: True · 3.8s · audio: 126724 b64 bytes*
*note: voice item (read-symbol)*

> Look at the card. What does it say?

### wrong:c2::p1
*expect: turn · turn_ended: True · 12.6s · audio: 716804 b64 bytes*
*note: student says "one" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one. One tells how many; first tells which one. This card says first. Your turn. What does it say?

### right:c2::p1
*expect: turn · turn_ended: True · 3.3s · audio: 132484 b64 bytes*
*note: student says "first"*

> Yes, that card says first.

### ask:c2::p5
*expect: turn · turn_ended: True · 3.8s · audio: 128040 b64 bytes*
*note: voice item (read-symbol)*

> Look at the card. What does it say?

### wrong:c2::p5
*expect: turn · turn_ended: True · 17.0s · audio: 981764 b64 bytes*
*note: student says "five" — the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against*

> My turn: I count up to this card — one, two, three, four, five. Five tells how many; fifth tells which one. This card says fifth. Your turn. What does it say?

### right:c2::p5
*expect: turn · turn_ended: True · 3.5s · audio: 128644 b64 bytes*
*note: student says "fifth"*

> Yes, that card says fifth.

### complete
*expect: turn · turn_ended: True · 5.8s · audio: 286724 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
