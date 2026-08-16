# Tier-3 Live Tutor Report — phoneme-explorer — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "phoneme-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "kindergarten"}`
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
| `c1` | voice/blend | ladder | ✅✅✅ | - | n/a |
| `c2` | voice/blend | ladder | ✅ | hen | ✅ |
| `c3` | voice/blend | ladder | ✅ | dog | ✅ |
| `c4` | voice/blend | ladder | ✅ | rat | ✅ |
| `c5` | voice/blend | ladder | ✅ | duck | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 12.4s · audio: 694440 b64 bytes*
*note: voice item (blend)*

> Hi! Time to play with sounds! I say some sounds. You put them together and say the word fast! Listen: /p/ … iii … /g/. Your turn. Say it fast. What word?

### wrong1:c1
*expect: turn · turn_ended: True · 8.1s · audio: 423080 b64 bytes*
*note: student says "ladder"*

> My turn: /p/ … iii … /g/ … pig. Pig. Your turn. What word?

### wrong2:c1
*expect: turn · turn_ended: True · 8.4s · audio: 409604 b64 bytes*
*note: student says "ladder"*

> My turn: /p/ … iii … /g/ … pig. Pig. Your turn. What word?

### wrong3:c1
*expect: turn · turn_ended: True · 7.5s · audio: 403844 b64 bytes*
*note: student says "ladder"*

> My turn: /p/ … iii … /g/ … pig. Pig. Your turn. What word?

### moveon:c1
*expect: turn · turn_ended: True · 9.9s · audio: 505604 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Listen: /h/ … eee … /n/. Your turn. Say it fast. What word?

### wrong:c2
*expect: turn · turn_ended: True · 8.0s · audio: 403844 b64 bytes*
*note: student says "ladder"*

> My turn: /h/ … eee … /n/ … hen. Hen. Your turn. What word?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 107560 b64 bytes*
*note: student says "hen"*

> Yes, hen.

### ask:c3
*expect: turn · turn_ended: True · 8.3s · audio: 364200 b64 bytes*
*note: voice item (blend)*

> Listen: /d/ … ooo … /g/. Your turn. Say it fast. What word?

### wrong:c3
*expect: turn · turn_ended: True · 7.5s · audio: 400004 b64 bytes*
*note: student says "ladder"*

> My turn: /d/ … ooo … /g/ … dog. Dog. Your turn. What word?

### right:c3
*expect: turn · turn_ended: True · 3.1s · audio: 85764 b64 bytes*
*note: student says "dog"*

> Yes, dog.

### ask:c4
*expect: turn · turn_ended: True · 7.4s · audio: 371240 b64 bytes*
*note: voice item (blend)*

> Listen: /r/ … aaa … /t/. Your turn. Say it fast. What word?

### wrong:c4
*expect: turn · turn_ended: True · 7.9s · audio: 430084 b64 bytes*
*note: student says "ladder"*

> My turn: /r/ … aaa … /t/ … rat. Rat. Your turn. What word?

### right:c4
*expect: turn · turn_ended: True · 3.2s · audio: 74244 b64 bytes*
*note: student says "rat"*

> Yes, rat.

### ask:c5
*expect: turn · turn_ended: True · 7.6s · audio: 380200 b64 bytes*
*note: voice item (blend)*

> Listen: /d/ … uuu … /k/. Your turn. Say it fast. What word?

### wrong:c5
*expect: turn · turn_ended: True · 7.7s · audio: 403844 b64 bytes*
*note: student says "ladder"*

> My turn: /d/ … uuu … /k/ … duck. Duck. Your turn. What word?

### right:c5
*expect: turn · turn_ended: True · 3.2s · audio: 116484 b64 bytes*
*note: student says "duck"*

> Yes, duck.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 316200 b64 bytes*

> What great sound work today! Your ears heard every little sound. See you next time!
