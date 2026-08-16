# Tier-3 Live Tutor Report — letter-spotter — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "letter-spotter", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "K"}`
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
| `ch1` | voice/name-it | sun | ✅ | S | ✅ |
| `ch2` | voice/name-it | ant | ✅ | A | ✅ |
| `ch3` | voice/name-it | turkeys | ✅ | T | ✅ |
| `ch4` | voice/name-it | insects | ✅ | I | ✅ |
| `ch5` | voice/name-it | pigs | ✅ | P | ✅ |
| `ch6` | voice/name-it | nine | ✅ | N | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 17.3s · audio: 1017604 b64 bytes*
*note: voice item (name-it)*

> Hi! Time to go letter spotting! The star is hiding the first letter of the word — you tell me the letter it is hiding! Listen for the sound at the very start of the word. Listen: I can see the sun. Your turn. Say the letter that sun starts with.

### wrong:ch1
*expect: turn · turn_ended: True · 10.2s · audio: 508804 b64 bytes*
*note: student says "sun" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Sss … sun. Your turn. Say the letter that sun starts with.

### right:ch1
*expect: turn · turn_ended: True · 4.1s · audio: 158084 b64 bytes*
*note: student says "S"*

> Yes, sun starts with S.

### ask:ch2
*expect: turn · turn_ended: True · 8.2s · audio: 398084 b64 bytes*
*note: voice item (name-it)*

> Listen: An ant walks on the fence. Your turn. Say the letter that ant starts with.

### wrong:ch2
*expect: turn · turn_ended: True · 9.2s · audio: 517764 b64 bytes*
*note: student says "ant" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Aaa … ant. Your turn. Say the letter that ant starts with.

### right:ch2
*expect: turn · turn_ended: True · 3.5s · audio: 145284 b64 bytes*
*note: student says "A"*

> Yes, ant starts with A.

### ask:ch3
*expect: turn · turn_ended: True · 8.1s · audio: 426244 b64 bytes*
*note: voice item (name-it)*

> Listen: Two turkeys trot near the pen. Your turn. Say the letter that turkeys starts with.

### wrong:ch3
*expect: turn · turn_ended: True · 11.2s · audio: 623364 b64 bytes*
*note: student says "turkeys" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Turkeys. Listen right at the front of that word. Your turn. Say the letter that turkeys starts with.

### right:ch3
*expect: turn · turn_ended: True · 3.4s · audio: 144004 b64 bytes*
*note: student says "T"*

> Yes, turkeys starts with T.

### ask:ch4
*expect: turn · turn_ended: True · 8.3s · audio: 429480 b64 bytes*
*note: voice item (name-it)*

> Listen: Insects fly by the big pig. Your turn. Say the letter that insects starts with.

### wrong:ch4
*expect: turn · turn_ended: True · 9.8s · audio: 524164 b64 bytes*
*note: student says "insects" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Iii … insects. Your turn. Say the letter that insects starts with.

### right:ch4
*expect: turn · turn_ended: True · 3.7s · audio: 145284 b64 bytes*
*note: student says "I"*

> Yes, insects starts with I.

### ask:ch5
*expect: turn · turn_ended: True · 7.9s · audio: 401924 b64 bytes*
*note: voice item (name-it)*

> Listen: Pigs play in the muddy pool. Your turn. Say the letter that pigs starts with.

### wrong:ch5
*expect: turn · turn_ended: True · 10.7s · audio: 608004 b64 bytes*
*note: student says "pigs" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Pigs. Listen right at the front of that word. Your turn. Say the letter that pigs starts with.

### right:ch5
*expect: turn · turn_ended: True · 4.0s · audio: 167684 b64 bytes*
*note: student says "P"*

> Yes, pigs starts with P.

### ask:ch6
*expect: turn · turn_ended: True · 8.4s · audio: 422404 b64 bytes*
*note: voice item (name-it)*

> Listen: Nine nests rest in the tree. Your turn. Say the letter that nine starts with.

### wrong:ch6
*expect: turn · turn_ended: True · 9.8s · audio: 536964 b64 bytes*
*note: student says "nine" — the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name*

> My turn: listen to the start of the word. Nnn… nine. Your turn. Say the letter that nine starts with.

### right:ch6
*expect: turn · turn_ended: True · 4.1s · audio: 163204 b64 bytes*
*note: student says "N"*

> Yes, nine starts with N.

### complete
*expect: turn · turn_ended: True · 6.8s · audio: 346884 b64 bytes*

> What great letter spotting today! Your eyes are getting sharp. See you next time!
