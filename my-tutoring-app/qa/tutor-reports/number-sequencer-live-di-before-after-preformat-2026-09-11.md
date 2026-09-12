# Tier-3 Live Tutor Report — number-sequencer — 2026-09-11

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "number-sequencer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 6 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-off-script-verdict` | wrong:seq1:1-answer 1/1 (1 beat) | verdict was right but only 45% of the scripted line survived. SCRIPT: "Let us work on a number train. What number comes after 3?" SPOKE: "My turn: 4 belongs in the missing space. Your turn. What number comes after 3?" |
| CONFIRMED | WARN | `di-verdict-embellished` | wrong:seq1:1-answer 1/1, wrong:seq2:0-answer 1/1, wrong:seq3:1-answer 1/1, wrong:seq4:0-answer 1/1, wrong:seq5:1-answer 1/1 (5 beats) | added 10 unscripted words to a "say exactly" line. SCRIPT: "What number comes after 19?" SPOKE: "My turn: 20 belongs in the missing space. Your turn. What number comes after 19?" |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `seq1:1-answer` | voice/before-after | 6 | ✅ | 4 | ✅ |
| `seq2:0-answer` | voice/before-after | 9 | ✅ | 7 | ✅ |
| `seq3:1-answer` | voice/before-after | 14 | ✅ | 12 | ✅ |
| `seq4:0-answer` | voice/before-after | 16 | ✅ | 14 | ✅ |
| `seq5:1-answer` | voice/before-after | 22 | ✅ | 20 | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:seq1:1-answer
*expect: turn · turn_ended: True · 5.1s · audio: 225960 b64 bytes*
*note: voice item (before-after)*

> Let us work on a number train. What number comes after 3?

### wrong:seq1:1-answer
*expect: turn · turn_ended: True · 6.9s · audio: 369924 b64 bytes*
*note: student says "6"*

> My turn: 4 belongs in the missing space. Your turn. What number comes after 3?

### right:seq1:1-answer
*expect: turn · turn_ended: True · 3.5s · audio: 79400 b64 bytes*
*note: student says "4"*

> Yes, 4.

### ask:seq2:0-answer
*expect: turn · turn_ended: True · 4.8s · audio: 126724 b64 bytes*
*note: voice item (before-after)*

> What number comes before 8?

### wrong:seq2:0-answer
*expect: turn · turn_ended: True · 7.1s · audio: 382724 b64 bytes*
*note: student says "9"*

> My turn: 7 belongs in the missing space. Your turn. What number comes before 8?

### right:seq2:0-answer
*expect: turn · turn_ended: True · 3.5s · audio: 97284 b64 bytes*
*note: student says "7"*

> Yes, 7.

### ask:seq3:1-answer
*expect: turn · turn_ended: True · 3.8s · audio: 124804 b64 bytes*
*note: voice item (before-after)*

> What number comes after 11?

### wrong:seq3:1-answer
*expect: turn · turn_ended: True · 7.1s · audio: 373764 b64 bytes*
*note: student says "14"*

> My turn: 12 belongs in the missing space. Your turn. What number comes after 11?

### right:seq3:1-answer
*expect: turn · turn_ended: True · 3.3s · audio: 103684 b64 bytes*
*note: student says "12"*

> Yes, 12.

### ask:seq4:0-answer
*expect: turn · turn_ended: True · 3.6s · audio: 135684 b64 bytes*
*note: voice item (before-after)*

> What number comes before 15?

### wrong:seq4:0-answer
*expect: turn · turn_ended: True · 7.5s · audio: 405764 b64 bytes*
*note: student says "16"*

> My turn: 14 belongs in the missing space. Your turn. What number comes before 15?

### right:seq4:0-answer
*expect: turn · turn_ended: True · 3.2s · audio: 106244 b64 bytes*
*note: student says "14"*

> Yes, 14.

### ask:seq5:1-answer
*expect: turn · turn_ended: True · 3.9s · audio: 135044 b64 bytes*
*note: voice item (before-after)*

> What number comes after 19?

### wrong:seq5:1-answer
*expect: turn · turn_ended: True · 7.1s · audio: 380164 b64 bytes*
*note: student says "22"*

> My turn: 20 belongs in the missing space. Your turn. What number comes after 19?

### right:seq5:1-answer
*expect: turn · turn_ended: True · 3.0s · audio: 90244 b64 bytes*
*note: student says "20"*

> Yes, 20.

### complete
*expect: turn · turn_ended: True · 4.2s · audio: 204840 b64 bytes*

> You worked on number sequences. Nice effort!
