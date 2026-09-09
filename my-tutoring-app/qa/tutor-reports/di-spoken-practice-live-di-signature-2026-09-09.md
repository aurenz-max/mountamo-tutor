# Tier-3 Live Tutor Report — di-spoken-practice — 2026-09-09

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-spoken-practice", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "kindergarten", "undrivable_items": []}`
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
| `dsp-1` | voice/say_answer | are | ✅ | is | ✅ |
| `dsp-2` | voice/say_answer | is | ✅ | are | ✅ |
| `dsp-3` | voice/say_answer | are | ✅ | is | ✅ |
| `dsp-4` | voice/say_answer | is | ✅ | are | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:dsp-1
*expect: turn · turn_ended: True · 9.6s · audio: 512004 b64 bytes*
*note: voice item (say_answer)*

> I will ask, and you say the answer out loud. Listen: The dog ... running in the park. Say the missing word.

### wrong:dsp-1
*expect: turn · turn_ended: True · 13.0s · audio: 759044 b64 bytes*
*note: student says "are" — the opposite agreement form for a singular subject*

> My turn: Use "is" with one subject. The dog is running in the park. Your turn. Listen: The dog ... running in the park. Say the missing word.

### right:dsp-1
*expect: turn · turn_ended: True · 3.1s · audio: 96004 b64 bytes*
*note: student says "is"*

> Yes, is.

### ask:dsp-2
*expect: turn · turn_ended: True · 6.4s · audio: 317480 b64 bytes*
*note: voice item (say_answer)*

> Listen: The dogs ... running in the park. Say the missing word.

### wrong:dsp-2
*expect: turn · turn_ended: True · 13.3s · audio: 762884 b64 bytes*
*note: student says "is" — the opposite agreement form for a plural subject*

> My turn: Use "are" with more than one subject. The dogs are running in the park. Your turn. Listen: The dogs ... running in the park. Say the missing word.

### right:dsp-2
*expect: turn · turn_ended: True · 3.1s · audio: 90920 b64 bytes*
*note: student says "are"*

> Yes, are.

### ask:dsp-3
*expect: turn · turn_ended: True · 6.7s · audio: 323880 b64 bytes*
*note: voice item (say_answer)*

> Listen: The bird ... flying over the tree. Say the missing word.

### wrong:dsp-3
*expect: turn · turn_ended: True · 14.0s · audio: 764804 b64 bytes*
*note: student says "are" — the opposite agreement form for a singular subject*

> My turn: Use "is" with one subject. The bird is flying over the tree. Your turn. Listen: The bird ... flying over the tree. Say the missing word.

### right:dsp-3
*expect: turn · turn_ended: True · 3.8s · audio: 104324 b64 bytes*
*note: student says "is"*

> Yes, is.

### ask:dsp-4
*expect: turn · turn_ended: True · 6.5s · audio: 320680 b64 bytes*
*note: voice item (say_answer)*

> Listen: The birds ... flying over the tree. Say the missing word.

### wrong:dsp-4
*expect: turn · turn_ended: True · 13.7s · audio: 803204 b64 bytes*
*note: student says "is" — the opposite agreement form for a plural subject*

> My turn: Use "are" with more than one subject. The birds are flying over the tree. Your turn. Listen: The birds ... flying over the tree. Say the missing word.

### right:dsp-4
*expect: turn · turn_ended: True · 4.4s · audio: 94084 b64 bytes*
*note: student says "are"*

> Yes, are.

### complete
*expect: turn · turn_ended: True · 5.8s · audio: 286760 b64 bytes*

> Great work today! Your voice did the hard part. See you next time!
