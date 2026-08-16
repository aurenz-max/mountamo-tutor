# Tier-3 Live Tutor Report — phoneme-explorer — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "phoneme-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "kindergarten"}`
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
| `c1` | voice/blend | /p/ … iii … /g/ | ✅ | pig | ✅ |
| `c2` | voice/blend | /h/ … eee … /n/ | ✅ | hen | ✅ |
| `c3` | voice/blend | /d/ … ooo … /g/ | ✅ | dog | ✅ |
| `c4` | voice/blend | /r/ … aaa … /t/ | ✅ | rat | ✅ |
| `c5` | voice/blend | /d/ … uuu … /k/ | ✅ | duck | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 13.3s · audio: 752680 b64 bytes*
*note: voice item (blend)*

> Hi! Time to play with sounds! I say some sounds. You put them together and say the word fast! Listen: /p/ … iii … /g/. Your turn. Say it fast. What word?

### wrong:c1
*expect: turn · turn_ended: True · 8.8s · audio: 424964 b64 bytes*
*note: student says "/p/ … iii … /g/" — the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract's named miss and the one a string-matching judge affirms*

> My turn: /p/ … iii … /g/ … pig. Pig. Your turn. What word?

### right:c1
*expect: turn · turn_ended: True · 3.4s · audio: 106884 b64 bytes*
*note: student says "pig"*

> Yes, pig.

### ask:c2
*expect: turn · turn_ended: True · 7.6s · audio: 382724 b64 bytes*
*note: voice item (blend)*

> Listen: /h/ … eee … /n/. Your turn. Say it fast. What word?

### wrong:c2
*expect: turn · turn_ended: True · 8.4s · audio: 444804 b64 bytes*
*note: student says "/h/ … eee … /n/" — the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract's named miss and the one a string-matching judge affirms*

> My turn: /h/ … eee … /n/ … hen. Hen. Your turn. What word?

### right:c2
*expect: turn · turn_ended: True · 5.2s · audio: 103080 b64 bytes*
*note: student says "hen"*

> Yes, hen.

### ask:c3
*expect: turn · turn_ended: True · 7.4s · audio: 375044 b64 bytes*
*note: voice item (blend)*

> Listen: /d/ … ooo … /g/. Your turn. Say it fast. What word?

### wrong:c3
*expect: turn · turn_ended: True · 8.9s · audio: 442888 b64 bytes*
*note: student says "/d/ … ooo … /g/" — the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract's named miss and the one a string-matching judge affirms*

> My turn: /d/ … ooo … /g/ … dog. Dog. Your turn. What word?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 109480 b64 bytes*
*note: student says "dog"*

> Yes, dog.

### ask:c4
*expect: turn · turn_ended: True · 7.6s · audio: 378244 b64 bytes*
*note: voice item (blend)*

> Listen: /r/ … aaa … /t/. Your turn. Say it fast. What word?

### wrong:c4
*expect: turn · turn_ended: True · 8.0s · audio: 428804 b64 bytes*
*note: student says "/r/ … aaa … /t/" — the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract's named miss and the one a string-matching judge affirms*

> My turn: /r/ … aaa … /t/ … rat. Rat. Your turn. What word?

### right:c4
*expect: turn · turn_ended: True · 3.4s · audio: 104964 b64 bytes*
*note: student says "rat"*

> Yes, rat.

### ask:c5
*expect: turn · turn_ended: True · 7.7s · audio: 383364 b64 bytes*
*note: voice item (blend)*

> Listen: /d/ … uuu … /k/. Your turn. Say it fast. What word?

### wrong:c5
*expect: turn · turn_ended: True · 8.1s · audio: 441604 b64 bytes*
*note: student says "/d/ … uuu … /k/" — the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract's named miss and the one a string-matching judge affirms*

> My turn: /d/ … uuu … /k/ … duck. Duck. Your turn. What word?

### right:c5
*expect: turn · turn_ended: True · 4.3s · audio: 120360 b64 bytes*
*note: student says "duck"*

> Yes, duck.

### complete
*expect: turn · turn_ended: True · 7.1s · audio: 366120 b64 bytes*

> What great sound work today! Your ears heard every little sound. See you next time!
