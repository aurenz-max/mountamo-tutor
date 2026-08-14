# Tier-3 Live Tutor Report — ten-frame — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "ten-frame", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 12 HIGH + 4 WARN confirmed, 0 single-run note(s).

## Findings

| Status | Severity | Check | Beat | Rate | Example |
|---|---|---|---|---|---|
| CONFIRMED | HIGH | `di-tag-spoken` | moveon:c1 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | moveon:c1 | 1/1 | the ask contains the answer "three": "[CURRENT STATE]: The user indicates that the challenge should move forward despite the repeated incorrect answers, providing a new scripted prompt for when the " |
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c3 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:c3 | 1/1 | the ask contains the answer "four": "[CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'four'.
Eyes ready — watch the frame! You" |
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c4 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:c4 | 1/1 | the ask contains the answer "five": "[CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'five'.
Eyes ready — watch the frame! You" |
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c5 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:c5 | 1/1 | the ask contains the answer "six": "[CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'six'.
Eyes ready — watch the frame! Your" |
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c6 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:c6 | 1/1 | the ask contains the answer "eight": "[CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'eight'.
Eyes ready — watch the frame! Yo" |
| CONFIRMED | HIGH | `di-tag-spoken` | ask:c7 | 1/1 | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:c7 | 1/1 | the ask contains the answer "ten": "[CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'ten'.
Eyes ready — watch the frame! Your" |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1 | 1/1 | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong3:c1 | 1/1 | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1 | 1/1 | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |
| CONFIRMED | WARN | `di-verdict-embellished` | right:c7 | 1/1 | added 26 unscripted words to a "say exactly" line. SCRIPT: "Yes, ten counters." SPOKE: "Yes, ten counters. You've made it through so many frames today, great work! This will help you in the next activity where we build numbers on the fram" |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/look | three | ✅✅✅ | - | n/a |
| `c2` | voice/look | four | ✅ | three | ✅ |
| `c3` | voice/look | five | ✅ | four | ✅ |
| `c4` | voice/look | six | ✅ | five | ✅ |
| `c5` | voice/look | seven | ✅ | six | ✅ |
| `c6` | voice/look | nine | ✅ | eight | ✅ |
| `c7` | voice/look | eleven | ✅ | ten | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 13.1s · audio: 746884 b64 bytes*
*note: voice item (look)*

> Hi! Time to work with the ten frame! Watch the frame — the counters show for just a moment. Then say how many you saw! Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong1:c1
*expect: turn · turn_ended: True · 8.8s · audio: 491524 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong2:c1
*expect: turn · turn_ended: True · 8.9s · audio: 496644 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong3:c1
*expect: turn · turn_ended: True · 8.5s · audio: 468484 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### moveon:c1
*expect: turn · turn_ended: True · 8.2s · audio: 415400 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> [CURRENT STATE]: The user indicates that the challenge should move forward despite the repeated incorrect answers, providing a new scripted prompt for when the system presents the *next* item to subitize. The target answer for this new item is 'three'.
Good try! Here comes the next one. Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c2
*expect: turn · turn_ended: True · 9.1s · audio: 484484 b64 bytes*
*note: student says "four"*

> My turn: it was three. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c2
*expect: turn · turn_ended: True · 3.4s · audio: 133124 b64 bytes*
*note: student says "three"*

> Yes, three counters.

### ask:c3
*expect: turn · turn_ended: True · 6.1s · audio: 284840 b64 bytes*
*note: voice item (look)*

> [CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'four'.
Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c3
*expect: turn · turn_ended: True · 9.1s · audio: 487684 b64 bytes*
*note: student says "five"*

> My turn: it was four. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 119684 b64 bytes*
*note: student says "four"*

> Yes, four counters.

### ask:c4
*expect: turn · turn_ended: True · 6.6s · audio: 291880 b64 bytes*
*note: voice item (look)*

> [CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'five'.
Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c4
*expect: turn · turn_ended: True · 9.1s · audio: 480644 b64 bytes*
*note: student says "six"*

> My turn: it was five. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c4
*expect: turn · turn_ended: True · 3.2s · audio: 115844 b64 bytes*
*note: student says "five"*

> Yes, five counters.

### ask:c5
*expect: turn · turn_ended: True · 6.1s · audio: 279044 b64 bytes*
*note: voice item (look)*

> [CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'six'.
Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c5
*expect: turn · turn_ended: True · 9.4s · audio: 465924 b64 bytes*
*note: student says "seven"*

> My turn: it was six. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c5
*expect: turn · turn_ended: True · 4.6s · audio: 112644 b64 bytes*
*note: student says "six"*

> Yes, six counters.

### ask:c6
*expect: turn · turn_ended: True · 7.3s · audio: 277124 b64 bytes*
*note: voice item (look)*

> [CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'eight'.
Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c6
*expect: turn · turn_ended: True · 8.8s · audio: 483204 b64 bytes*
*note: student says "nine"*

> My turn: it was eight. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c6
*expect: turn · turn_ended: True · 4.0s · audio: 114564 b64 bytes*
*note: student says "eight"*

> Yes, eight counters.

### ask:c7
*expect: turn · turn_ended: True · 6.0s · audio: 281604 b64 bytes*
*note: voice item (look)*

> [CURRENT STATE]: The user has moved to the next item in the subitize challenge. The target answer for this new item is 'ten'.
Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c7
*expect: turn · turn_ended: True · 9.7s · audio: 503684 b64 bytes*
*note: student says "eleven"*

> My turn: it was ten. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c7
*expect: turn · turn_ended: True · 8.7s · audio: 485124 b64 bytes*
*note: student says "ten"*

> Yes, ten counters. You've made it through so many frames today, great work! This will help you in the next activity where we build numbers on the frame.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 345604 b64 bytes*

> What great number work today! Your eyes and your hands did hard thinking. See you next time!
