# Tier-3 Live Tutor Report — counting-board — 2026-08-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "counting-board", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1 1/1, wrong3:c1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/count | three | ✅✅✅ | - | n/a |
| `c2` | voice/count | five | ✅ | six | ✅ |
| `c3` | voice/count | four | ✅ | five | ✅ |
| `c4` | voice/count | seven | ✅ | eight | ✅ |
| `c5` | voice/count | six | ✅ | seven | ✅ |
| `c6` | voice/count | eight | ✅ | nine | ✅ |
| `c7` | voice/count | nine | ✅ | ten | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 11.6s · audio: 650884 b64 bytes*
*note: voice item (count)*

> Hi! Time to count some butterflies! Touch each butterfly one time as you count. Then say how many! Count the butterflies. Your turn. How many butterflies?

### wrong1:c1
*expect: turn · turn_ended: True · 11.2s · audio: 616964 b64 bytes*
*note: student says "three"*

> My turn: watch me count. One, two, three, four. Four butterflies. Your turn. How many butterflies?

### wrong2:c1
*expect: turn · turn_ended: True · 10.8s · audio: 618884 b64 bytes*
*note: student says "three"*

> My turn: watch me count. One, two, three, four. Four butterflies. Your turn. How many butterflies?

### wrong3:c1
*expect: turn · turn_ended: True · 10.9s · audio: 615684 b64 bytes*
*note: student says "three"*

> My turn: watch me count. One, two, three, four. Four butterflies. Your turn. How many butterflies?

### moveon:c1
*expect: turn · turn_ended: True · 7.4s · audio: 375044 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Count the butterflies. Your turn. How many butterflies?

### wrong:c2
*expect: turn · turn_ended: True · 12.9s · audio: 730884 b64 bytes*
*note: student says "five"*

> My turn: watch me count. One, two, three, four, five, six. Six butterflies. Your turn. How many butterflies?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 138884 b64 bytes*
*note: student says "six"*

> Yes, six butterflies.

### ask:c3
*expect: turn · turn_ended: True · 4.9s · audio: 220164 b64 bytes*
*note: voice item (count)*

> Count the butterflies. Your turn. How many butterflies?

### wrong:c3
*expect: turn · turn_ended: True · 11.5s · audio: 662404 b64 bytes*
*note: student says "four"*

> My turn: watch me count. One, two, three, four, five. Five butterflies. Your turn. How many butterflies?

### right:c3
*expect: turn · turn_ended: True · 3.4s · audio: 145960 b64 bytes*
*note: student says "five"*

> Yes, five butterflies.

### ask:c4
*expect: turn · turn_ended: True · 5.0s · audio: 226564 b64 bytes*
*note: voice item (count)*

> Count the butterflies. Your turn. How many butterflies?

### wrong:c4
*expect: turn · turn_ended: True · 14.2s · audio: 826884 b64 bytes*
*note: student says "seven"*

> My turn: watch me count. One, two, three, four, five, six, seven, eight. Eight butterflies. Your turn. How many butterflies?

### right:c4
*expect: turn · turn_ended: True · 3.8s · audio: 124804 b64 bytes*
*note: student says "eight"*

> Yes, eight butterflies.

### ask:c5
*expect: turn · turn_ended: True · 5.3s · audio: 231684 b64 bytes*
*note: voice item (count)*

> Count the butterflies. Your turn. How many butterflies?

### wrong:c5
*expect: turn · turn_ended: True · 13.7s · audio: 802564 b64 bytes*
*note: student says "six"*

> My turn: watch me count. One, two, three, four, five, six, seven. Seven butterflies. Your turn. How many butterflies?

### right:c5
*expect: turn · turn_ended: True · 3.4s · audio: 129924 b64 bytes*
*note: student says "seven"*

> Yes, seven butterflies.

### ask:c6
*expect: turn · turn_ended: True · 5.1s · audio: 231684 b64 bytes*
*note: voice item (count)*

> Count the butterflies. Your turn. How many butterflies?

### wrong:c6
*expect: turn · turn_ended: True · 15.4s · audio: 912004 b64 bytes*
*note: student says "eight"*

> My turn: watch me count. One, two, three, four, five, six, seven, eight, nine. Nine butterflies. Your turn. How many butterflies?

### right:c6
*expect: turn · turn_ended: True · 3.5s · audio: 137604 b64 bytes*
*note: student says "nine"*

> Yes, nine butterflies.

### ask:c7
*expect: turn · turn_ended: True · 5.6s · audio: 250244 b64 bytes*
*note: voice item (count)*

> Count the butterflies. Your turn. How many butterflies?

### wrong:c7
*expect: turn · turn_ended: True · 16.6s · audio: 961284 b64 bytes*
*note: student says "nine"*

> My turn: watch me count. One, two, three, four, five, six, seven, eight, nine, ten. Ten butterflies. Your turn. How many butterflies?

### right:c7
*expect: turn · turn_ended: True · 3.6s · audio: 148484 b64 bytes*
*note: student says "ten"*

> Yes, ten butterflies.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 336644 b64 bytes*

> What great counting today! Your eyes and your ears did hard work. See you next time!
