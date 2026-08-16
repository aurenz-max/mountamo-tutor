# Tier-3 Live Tutor Report — letter-sound-link — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "letter-sound-link", "items": 5, "voice_items": 4, "gesture_items": 1, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "K"}`
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
| `ch1` | voice/see-hear | mmm | ✅ | sss | ✅ |
| `ch2` | voice/keyword-match | tent | ✅ | apple | ✅ |
| `ch3` | gesture/hear-see | (placement) | ✅ | (placement) | ✅ |
| `ch4` | voice/see-hear | mmm | ✅ | iii | ✅ |
| `ch5` | voice/keyword-match | net | ✅ | pig | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 12.5s · audio: 707240 b64 bytes*
*note: voice item (see-hear)*

> Hi! Time to play with letter sounds! A letter pops up — you say the sound it makes! This letter says sss. Listen: sss. Your turn. What sound does this letter make?

### wrong:ch1
*expect: turn · turn_ended: True · 7.4s · audio: 401924 b64 bytes*
*note: student says "mmm"*

> My turn: this letter says sss. Sss. Your turn. What sound does this letter make?

### right:ch1
*expect: turn · turn_ended: True · 3.2s · audio: 100520 b64 bytes*
*note: student says "sss"*

> Yes, sss.

### ask:ch2
*expect: turn · turn_ended: True · 12.0s · audio: 675204 b64 bytes*
*note: voice item (keyword-match)*

> You will see a letter and two pictures. Say the picture word that starts with the letter’s sound! This letter says aaa. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch2
*expect: turn · turn_ended: True · 10.1s · audio: 533124 b64 bytes*
*note: student says "tent"*

> My turn: this letter says aaa, and the word apple starts with aaa. Your turn. Which picture starts with this letter’s sound?

### right:ch2
*expect: turn · turn_ended: True · 3.1s · audio: 93444 b64 bytes*
*note: student says "apple"*

> Yes, apple.

### ask:ch3
*expect: turn · turn_ended: True · 9.0s · audio: 451844 b64 bytes*
*note: gesture item (hear-see)*

> Listen for the sound, then tap the letter that makes it! Listen: /t/. Your turn. Tap the letter that makes /t/.

### hands-hold:ch3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch3
*expect: turn · turn_ended: True · 7.0s · audio: 360324 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: listen again. /t/. Your turn. Tap the letter that makes /t/.

### commit-right:ch3
*expect: turn · turn_ended: True · 3.3s · audio: 99204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, /t/.

### ask:ch4
*expect: turn · turn_ended: True · 11.3s · audio: 588840 b64 bytes*
*note: voice item (see-hear)*

> A letter pops up — you say the sound it makes! This letter says iii. Listen: iii. Your turn. What sound does this letter make?

### wrong:ch4
*expect: turn · turn_ended: True · 8.3s · audio: 451204 b64 bytes*
*note: student says "mmm"*

> My turn: this letter says iii. Iii. Your turn. What sound does this letter make?

### right:ch4
*expect: turn · turn_ended: True · 3.3s · audio: 121604 b64 bytes*
*note: student says "iii"*

> Yes, iii.

### ask:ch5
*expect: turn · turn_ended: True · 12.4s · audio: 696360 b64 bytes*
*note: voice item (keyword-match)*

> You will see a letter and two pictures. Say the picture word that starts with the letter’s sound! This letter says /p/. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch5
*expect: turn · turn_ended: True · 9.6s · audio: 517124 b64 bytes*
*note: student says "net"*

> My turn: this letter says /p/, and the word pig starts with /p/. Your turn. Which picture starts with this letter’s sound?

### right:ch5
*expect: turn · turn_ended: True · 3.5s · audio: 122280 b64 bytes*
*note: student says "pig"*

> Yes, pig.

### complete
*expect: turn · turn_ended: True · 6.7s · audio: 352004 b64 bytes*

> What great letter-sound work today! You are learning the sounds that letters make. See you next time!
