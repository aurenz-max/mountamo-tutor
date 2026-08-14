# Tier-3 Live Tutor Report — ten-frame — 2026-08-14

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ten-frame", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 1 beat instances), 4 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1 2/2 (1 beat) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| note | HIGH | `di-tag-spoken` | wrong3:c1 1/2 (1 beat) | read control syntax aloud: "[STUDENT CONTEXT]" — the fabricated-tag class |
| note | HIGH | `di-no-verdict` | wrong3:c1 1/2 (1 beat) | answered "three" and the tutor opened with neither sentinel — the loop stalls here: "[STUDENT CONTEXT]
  Current attempt: 2
  Hints used: 0
[CURRENT STATE]
  challengeType: subitize
  stimulus: a quick flash of counters on the frame
  correctAns" |
| note | WARN | `di-correction-verbatim-repeat` | wrong3:c1 1/2 (1 beat) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| note | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1 1/2 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/look | three | ✅✅—✅✅✅ | - | n/a |
| `c2` | voice/look | four | ✅✅ | three | ✅✅ |
| `c3` | voice/look | five | ✅✅ | four | ✅✅ |
| `c4` | voice/look | six | ✅✅ | five | ✅✅ |
| `c5` | voice/look | seven | ✅✅ | six | ✅✅ |
| `c6` | voice/look | nine | ✅✅ | eight | ✅✅ |
| `c7` | voice/look | eleven | ✅✅ | ten | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 15.2s · audio: 871044 b64 bytes*
*note: voice item (look)*

> Hi! Time to work with the ten frame! Watch the frame — the counters show for just a moment. Then say how many you saw! Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong1:c1
*expect: turn · turn_ended: True · 9.5s · audio: 523524 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong2:c1
*expect: turn · turn_ended: True · 9.5s · audio: 518404 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong3:c1
*expect: turn · turn_ended: True · 3.8s · audio: 145924 b64 bytes*
*note: student says "three"*

> [STUDENT CONTEXT]
  Current attempt: 2
  Hints used: 0
[CURRENT STATE]
  challengeType: subitize
  stimulus: a quick flash of counters on the frame
  correctAnswer: 2
  studentAnswer: 3

Look at the frame and think about how many.

### moveon:c1
*expect: turn · turn_ended: True · 10.0s · audio: 509480 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c2
*expect: turn · turn_ended: True · 9.8s · audio: 521604 b64 bytes*
*note: student says "four"*

> My turn: it was three. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 120964 b64 bytes*
*note: student says "three"*

> Yes, three counters.

### ask:c3
*expect: turn · turn_ended: True · 6.5s · audio: 321924 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c3
*expect: turn · turn_ended: True · 9.2s · audio: 510084 b64 bytes*
*note: student says "five"*

> My turn: it was four. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c3
*expect: turn · turn_ended: True · 3.4s · audio: 119044 b64 bytes*
*note: student says "four"*

> Yes, four counters.

### ask:c4
*expect: turn · turn_ended: True · 6.9s · audio: 335364 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c4
*expect: turn · turn_ended: True · 9.1s · audio: 507524 b64 bytes*
*note: student says "six"*

> My turn: it was five. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c4
*expect: turn · turn_ended: True · 3.7s · audio: 121604 b64 bytes*
*note: student says "five"*

> Yes, five counters.

### ask:c5
*expect: turn · turn_ended: True · 6.9s · audio: 340484 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c5
*expect: turn · turn_ended: True · 9.1s · audio: 503684 b64 bytes*
*note: student says "seven"*

> My turn: it was six. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c5
*expect: turn · turn_ended: True · 3.7s · audio: 113284 b64 bytes*
*note: student says "six"*

> Yes, six counters.

### ask:c6
*expect: turn · turn_ended: True · 7.0s · audio: 340484 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c6
*expect: turn · turn_ended: True · 9.1s · audio: 506244 b64 bytes*
*note: student says "nine"*

> My turn: it was eight. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c6
*expect: turn · turn_ended: True · 3.3s · audio: 112648 b64 bytes*
*note: student says "eight"*

> Yes, eight counters.

### ask:c7
*expect: turn · turn_ended: True · 6.8s · audio: 341124 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c7
*expect: turn · turn_ended: True · 9.5s · audio: 526724 b64 bytes*
*note: student says "eleven"*

> My turn: it was ten. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c7
*expect: turn · turn_ended: True · 3.9s · audio: 119044 b64 bytes*
*note: student says "ten"*

> Yes, ten counters.

### complete
*expect: turn · turn_ended: True · 7.6s · audio: 374404 b64 bytes*

> What great number work today! Your eyes and your hands did hard thinking. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 14.2s · audio: 839084 b64 bytes*
*note: voice item (look)*

> Hi! Time to work with the ten frame! Watch the frame — the countersWatch the frame — the counters show for just a moment. Then say how many you saw! Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong1:c1
*expect: turn · turn_ended: True · 8.5s · audio: 470404 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong2:c1
*expect: turn · turn_ended: True · 9.4s · audio: 524200 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### wrong3:c1
*expect: turn · turn_ended: True · 9.7s · audio: 521604 b64 bytes*
*note: student says "three"*

> My turn: it was two. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### moveon:c1
*expect: turn · turn_ended: True · 8.4s · audio: 435844 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c2
*expect: turn · turn_ended: True · 9.2s · audio: 507524 b64 bytes*
*note: student says "four"*

> My turn: it was three. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c2
*expect: turn · turn_ended: True · 3.2s · audio: 114564 b64 bytes*
*note: student says "three"*

> Yes, three counters.

### ask:c3
*expect: turn · turn_ended: True · 6.9s · audio: 286084 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c3
*expect: turn · turn_ended: True · 9.2s · audio: 506884 b64 bytes*
*note: student says "five"*

> My turn: it was four. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 110724 b64 bytes*
*note: student says "four"*

> Yes, four counters.

### ask:c4
*expect: turn · turn_ended: True · 5.9s · audio: 283524 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c4
*expect: turn · turn_ended: True · 9.4s · audio: 512644 b64 bytes*
*note: student says "six"*

> My turn: it was five. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c4
*expect: turn · turn_ended: True · 4.1s · audio: 132484 b64 bytes*
*note: student says "five"*

> Yes, five counters.

### ask:c5
*expect: turn · turn_ended: True · 6.5s · audio: 311684 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c5
*expect: turn · turn_ended: True · 9.5s · audio: 536324 b64 bytes*
*note: student says "seven"*

> My turn: it was six. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c5
*expect: turn · turn_ended: True · 3.5s · audio: 142084 b64 bytes*
*note: student says "six"*

> Yes, six counters.

### ask:c6
*expect: turn · turn_ended: True · 6.8s · audio: 311684 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c6
*expect: turn · turn_ended: True · 9.4s · audio: 517124 b64 bytes*
*note: student says "nine"*

> My turn: it was eight. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c6
*expect: turn · turn_ended: True · 3.5s · audio: 147204 b64 bytes*
*note: student says "eight"*

> Yes, eight counters.

### ask:c7
*expect: turn · turn_ended: True · 6.3s · audio: 300164 b64 bytes*
*note: voice item (look)*

> Eyes ready — watch the frame! Your turn. How many counters did you see?

### wrong:c7
*expect: turn · turn_ended: True · 9.2s · audio: 515844 b64 bytes*
*note: student says "eleven"*

> My turn: it was ten. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?

### right:c7
*expect: turn · turn_ended: True · 3.3s · audio: 133764 b64 bytes*
*note: student says "ten"*

> Yes, ten counters.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 400004 b64 bytes*

> What great number work today! Your Your
