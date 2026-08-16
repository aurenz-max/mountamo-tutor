# Tier-3 Live Tutor Report — letter-sound-link — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "letter-sound-link", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "K"}`
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
| `ch1` | voice/see-hear | ess | ✅ | sss | ✅ |
| `ch2` | voice/see-hear | ay | ✅ | aaa | ✅ |
| `ch3` | voice/see-hear | eye | ✅ | iii | ✅ |
| `ch4` | voice/see-hear | en | ✅ | nnn | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 13.3s · audio: 750120 b64 bytes*
*note: voice item (see-hear)*

> Hi! Time to play with letter sounds! A letter pops up — you say the sound it makes! This letter says sss. Listen: sss. Your turn. What sound does this letter make?

### wrong:ch1
*expect: turn · turn_ended: True · 7.6s · audio: 396804 b64 bytes*
*note: student says "ess" — the letter NAME said in place of its sound — this primitive's own documented signature error, fluent and confident and genuinely about the letter on screen. The contract names it, so a false affirm here is the judge failing the lesson's central distinction*

> My turn: this letter says sss. Sss. Your turn. What sound does this letter make?

### right:ch1
*expect: turn · turn_ended: True · 3.2s · audio: 89640 b64 bytes*
*note: student says "sss"*

> Yes, sss.

### ask:ch2
*expect: turn · turn_ended: True · 8.0s · audio: 401284 b64 bytes*
*note: voice item (see-hear)*

> This letter says aaa. Listen: aaa. Your turn. What sound does this letter make?

### wrong:ch2
*expect: turn · turn_ended: True · 7.4s · audio: 394884 b64 bytes*
*note: student says "ay" — the letter NAME said in place of its sound — this primitive's own documented signature error, fluent and confident and genuinely about the letter on screen. The contract names it, so a false affirm here is the judge failing the lesson's central distinction*

> My turn: this letter says aaa. Aaa. Your turn. What sound does this letter make?

### right:ch2
*expect: turn · turn_ended: True · 3.6s · audio: 102440 b64 bytes*
*note: student says "aaa"*

> Yes, aaa.

### ask:ch3
*expect: turn · turn_ended: True · 7.5s · audio: 380804 b64 bytes*
*note: voice item (see-hear)*

> This letter says iii. Listen: iii. Your turn. What sound does this letter make?

### wrong:ch3
*expect: turn · turn_ended: True · 7.5s · audio: 385924 b64 bytes*
*note: student says "eye" — the letter NAME said in place of its sound — this primitive's own documented signature error, fluent and confident and genuinely about the letter on screen. The contract names it, so a false affirm here is the judge failing the lesson's central distinction*

> My turn: this letter says iii. Iii. Your turn. What sound does this letter make?

### right:ch3
*expect: turn · turn_ended: True · 4.0s · audio: 92164 b64 bytes*
*note: student says "iii"*

> Yes, iii.

### ask:ch4
*expect: turn · turn_ended: True · 7.7s · audio: 387204 b64 bytes*
*note: voice item (see-hear)*

> This letter says nnn. Listen: nnn. Your turn. What sound does this letter make?

### wrong:ch4
*expect: turn · turn_ended: True · 8.2s · audio: 409604 b64 bytes*
*note: student says "en" — the letter NAME said in place of its sound — this primitive's own documented signature error, fluent and confident and genuinely about the letter on screen. The contract names it, so a false affirm here is the judge failing the lesson's central distinction*

> My turn: this letter says nnn. Nnn. Your turn. What sound does this letter make?

### right:ch4
*expect: turn · turn_ended: True · 3.3s · audio: 94084 b64 bytes*
*note: student says "nnn"*

> Yes, nnn.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 349444 b64 bytes*

> What great letter-sound work today! You are learning the sounds that letters make. See you next time!
