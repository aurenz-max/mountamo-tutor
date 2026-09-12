# Tier-3 Live Tutor Report — number-sequencer — 2026-09-11

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "number-sequencer", "items": 14, "voice_items": 14, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "seq1:1-answer", "grade": "Kindergarten", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:seq1:1-answer 1/1, wrong3:seq1:1-answer 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:seq1:1-answer 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `seq1:1-answer` | voice/count-from | 6 | ✅✅✅ | - | n/a |
| `seq1:2-answer` | voice/count-from | 7 | ✅ | 5 | ✅ |
| `seq2:1-answer` | voice/count-from | 9 | ✅ | 7 | ✅ |
| `seq2:2-answer` | voice/count-from | 10 | ✅ | 8 | ✅ |
| `seq3:1-answer` | voice/count-from | 12 | ✅ | 10 | ✅ |
| `seq3:2-answer` | voice/count-from | 13 | ✅ | 11 | ✅ |
| `seq3:3-answer` | voice/count-from | 14 | ✅ | 12 | ✅ |
| `seq4:1-answer` | voice/count-from | 15 | ✅ | 13 | ✅ |
| `seq4:2-answer` | voice/count-from | 16 | ✅ | 14 | ✅ |
| `seq4:3-answer` | voice/count-from | 17 | ✅ | 15 | ✅ |
| `seq5:1-answer` | voice/count-from | 19 | ✅ | 17 | ✅ |
| `seq5:2-answer` | voice/count-from | 20 | ✅ | 18 | ✅ |
| `seq5:3-answer` | voice/count-from | 21 | ✅ | 19 | ✅ |
| `seq5:4-answer` | voice/count-from | 22 | ✅ | 20 | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:seq1:1-answer
*expect: turn · turn_ended: True · 6.4s · audio: 317444 b64 bytes*
*note: voice item (count-from)*

> Let us work on a number train. Count forward from 3. What is the next number?

### wrong1:seq1:1-answer
*expect: turn · turn_ended: True · 9.1s · audio: 495364 b64 bytes*
*note: student says "6"*

> My turn: counting forward, after 3 comes 4. Your turn. Count forward from 3. What is the next number?

### wrong2:seq1:1-answer
*expect: turn · turn_ended: True · 8.8s · audio: 494724 b64 bytes*
*note: student says "6"*

> My turn: counting forward, after 3 comes 4. Your turn. Count forward from 3. What is the next number?

### wrong3:seq1:1-answer
*expect: turn · turn_ended: True · 8.6s · audio: 479364 b64 bytes*
*note: student says "6"*

> My turn: counting forward, after 3 comes 4. Your turn. Count forward from 3. What is the next number?

### moveon:seq1:1-answer
*expect: turn · turn_ended: True · 4.4s · audio: 184964 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Count forward from 4. What is the next number?

### wrong:seq1:2-answer
*expect: turn · turn_ended: True · 8.6s · audio: 479364 b64 bytes*
*note: student says "7"*

> My turn: counting forward, after 4 comes 5. Your turn. Count forward from 4. What is the next number?

### right:seq1:2-answer
*expect: turn · turn_ended: True · 3.1s · audio: 87044 b64 bytes*
*note: student says "5"*

> Yes, 5.

### ask:seq2:1-answer
*expect: turn · turn_ended: True · 4.6s · audio: 180484 b64 bytes*
*note: voice item (count-from)*

> Count forward from 6. What is the next number?

### wrong:seq2:1-answer
*expect: turn · turn_ended: True · 9.0s · audio: 471048 b64 bytes*
*note: student says "9"*

> My turn: counting forward, after 6 comes 7. Your turn. Count forward from 6. What is the next number?

### right:seq2:1-answer
*expect: turn · turn_ended: True · 3.2s · audio: 96644 b64 bytes*
*note: student says "7"*

> Yes, 7.

### ask:seq2:2-answer
*expect: turn · turn_ended: True · 4.5s · audio: 183044 b64 bytes*
*note: voice item (count-from)*

> Count forward from 7. What is the next number?

### wrong:seq2:2-answer
*expect: turn · turn_ended: True · 8.5s · audio: 468484 b64 bytes*
*note: student says "10"*

> My turn: counting forward, after 7 comes 8. Your turn. Count forward from 7. What is the next number?

### right:seq2:2-answer
*expect: turn · turn_ended: True · 3.2s · audio: 91524 b64 bytes*
*note: student says "8"*

> Yes, 8.

### ask:seq3:1-answer
*expect: turn · turn_ended: True · 4.6s · audio: 194600 b64 bytes*
*note: voice item (count-from)*

> Count forward from 9. What is the next number?

### wrong:seq3:1-answer
*expect: turn · turn_ended: True · 8.8s · audio: 469124 b64 bytes*
*note: student says "12"*

> My turn: counting forward, after 9 comes 10. Your turn. Count forward from 9. What is the next number?

### right:seq3:1-answer
*expect: turn · turn_ended: True · 3.2s · audio: 85124 b64 bytes*
*note: student says "10"*

> Yes, 10.

### ask:seq3:2-answer
*expect: turn · turn_ended: True · 4.7s · audio: 179844 b64 bytes*
*note: voice item (count-from)*

> Count forward from 10. What is the next number?

### wrong:seq3:2-answer
*expect: turn · turn_ended: True · 8.5s · audio: 466564 b64 bytes*
*note: student says "13"*

> My turn: counting forward, after 10 comes 11. Your turn. Count forward from 10. What is the next number?

### right:seq3:2-answer
*expect: turn · turn_ended: True · 3.8s · audio: 97284 b64 bytes*
*note: student says "11"*

> Yes, 11.

### ask:seq3:3-answer
*expect: turn · turn_ended: True · 4.7s · audio: 184964 b64 bytes*
*note: voice item (count-from)*

> Count forward from 11. What is the next number?

### wrong:seq3:3-answer
*expect: turn · turn_ended: True · 8.6s · audio: 479364 b64 bytes*
*note: student says "14"*

> My turn: counting forward, after 11 comes 12. Your turn. Count forward from 11. What is the next number?

### right:seq3:3-answer
*expect: turn · turn_ended: True · 3.4s · audio: 100484 b64 bytes*
*note: student says "12"*

> Yes, 12.

### ask:seq4:1-answer
*expect: turn · turn_ended: True · 4.4s · audio: 186884 b64 bytes*
*note: voice item (count-from)*

> Count forward from 12. What is the next number?

### wrong:seq4:1-answer
*expect: turn · turn_ended: True · 8.7s · audio: 481284 b64 bytes*
*note: student says "15"*

> My turn: counting forward, after 12 comes 13. Your turn. Count forward from 12. What is the next number?

### right:seq4:1-answer
*expect: turn · turn_ended: True · 3.3s · audio: 105604 b64 bytes*
*note: student says "13"*

> Yes, 13.

### ask:seq4:2-answer
*expect: turn · turn_ended: True · 5.4s · audio: 215044 b64 bytes*
*note: voice item (count-from)*

> Count forward from 13. What is the next number?

### wrong:seq4:2-answer
*expect: turn · turn_ended: True · 8.9s · audio: 492164 b64 bytes*
*note: student says "16"*

> My turn: counting forward, after 13 comes 14. Your turn. Count forward from 13. What is the next number?

### right:seq4:2-answer
*expect: turn · turn_ended: True · 3.9s · audio: 122244 b64 bytes*
*note: student says "14"*

> Yes, 14.

### ask:seq4:3-answer
*expect: turn · turn_ended: True · 5.3s · audio: 220804 b64 bytes*
*note: voice item (count-from)*

> Count forward from 14. What is the next number?

### wrong:seq4:3-answer
*expect: turn · turn_ended: True · 9.0s · audio: 496644 b64 bytes*
*note: student says "17"*

> My turn: counting forward, after 14 comes 15. Your turn. Count forward from 14. What is the next number?

### right:seq4:3-answer
*expect: turn · turn_ended: True · 3.4s · audio: 126084 b64 bytes*
*note: student says "15"*

> Yes, 15.

### ask:seq5:1-answer
*expect: turn · turn_ended: True · 4.7s · audio: 192644 b64 bytes*
*note: voice item (count-from)*

> Count forward from 16. What is the next number?

### wrong:seq5:1-answer
*expect: turn · turn_ended: True · 9.1s · audio: 504964 b64 bytes*
*note: student says "19"*

> My turn: counting forward, after 16 comes 17. Your turn. Count forward from 16. What is the next number?

### right:seq5:1-answer
*expect: turn · turn_ended: True · 3.5s · audio: 133800 b64 bytes*
*note: student says "17"*

> Yes, 17.

### ask:seq5:2-answer
*expect: turn · turn_ended: True · 5.1s · audio: 224644 b64 bytes*
*note: voice item (count-from)*

> Count forward from 17. What is the next number?

### wrong:seq5:2-answer
*expect: turn · turn_ended: True · 9.4s · audio: 525444 b64 bytes*
*note: student says "20"*

> My turn: counting forward, after 17 comes 18. Your turn. Count forward from 17. What is the next number?

### right:seq5:2-answer
*expect: turn · turn_ended: True · 3.5s · audio: 126084 b64 bytes*
*note: student says "18"*

> Yes, 18.

### ask:seq5:3-answer
*expect: turn · turn_ended: True · 5.0s · audio: 224004 b64 bytes*
*note: voice item (count-from)*

> Count forward from 18. What is the next number?

### wrong:seq5:3-answer
*expect: turn · turn_ended: True · 9.4s · audio: 522884 b64 bytes*
*note: student says "21"*

> My turn: counting forward, after 18 comes 19. Your turn. Count forward from 18. What is the next number?

### right:seq5:3-answer
*expect: turn · turn_ended: True · 3.4s · audio: 124164 b64 bytes*
*note: student says "19"*

> Yes, 19.

### ask:seq5:4-answer
*expect: turn · turn_ended: True · 4.9s · audio: 213800 b64 bytes*
*note: voice item (count-from)*

> Count forward from 19. What is the next number?

### wrong:seq5:4-answer
*expect: turn · turn_ended: True · 9.7s · audio: 510084 b64 bytes*
*note: student says "22"*

> My turn: counting forward, after 19 comes 20. Your turn. Count forward from 19. What is the next number?

### right:seq5:4-answer
*expect: turn · turn_ended: True · 3.3s · audio: 118404 b64 bytes*
*note: student says "20"*

> Yes, 20.

### complete
*expect: turn · turn_ended: True · 4.4s · audio: 202884 b64 bytes*

> You worked on number sequences. Nice effort!
