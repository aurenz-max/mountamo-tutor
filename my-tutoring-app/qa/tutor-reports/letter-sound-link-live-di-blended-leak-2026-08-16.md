# Tier-3 Live Tutor Report — letter-sound-link — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "letter-sound-link", "items": 5, "voice_items": 3, "gesture_items": 2, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "K"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 0 WARN mechanism(s) confirmed (1 + 0 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-answer-leak-in-ask` | ask:ch4 1/1 (1 beat) | the ask contains the answer "i" outside its stimulus: "I say a sound — you tap the letter that makes it! Listen: iii. Your turn. Tap the letter that makes iii." |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ch1` | voice/see-hear | mmm | ✅ | sss | ✅ |
| `ch2` | gesture/hear-see | (placement) | ✅ | (placement) | ✅ |
| `ch3` | voice/keyword-match | net | ✅ | apple | ✅ |
| `ch4` | gesture/hear-see | (placement) | ✅ | (placement) | ✅ |
| `ch5` | voice/keyword-match | net | ✅ | pig | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 13.7s · audio: 773124 b64 bytes*
*note: voice item (see-hear)*

> Hi! Time to play with letter sounds! A letter pops up — you say the sound it makes! This letter says sss. Listen: sss. Your turn. What sound does this letter make?

### wrong:ch1
*expect: turn · turn_ended: True · 8.3s · audio: 444804 b64 bytes*
*note: student says "mmm"*

> My turn: this letter says sss. Sss. Your turn. What sound does this letter make?

### right:ch1
*expect: turn · turn_ended: True · 3.3s · audio: 110724 b64 bytes*
*note: student says "sss"*

> Yes, sss.

### ask:ch2
*expect: turn · turn_ended: True · 9.2s · audio: 487720 b64 bytes*
*note: gesture item (hear-see)*

> I say a sound — you tap the letter that makes it! Listen: /t/. Your turn. Tap the letter that makes /t/.

### hands-hold:ch2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch2
*expect: turn · turn_ended: True · 6.9s · audio: 359044 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: listen again. /t/. Your turn. Tap the letter that makes /t/.

### commit-right:ch2
*expect: turn · turn_ended: True · 3.4s · audio: 81924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, /t/.

### ask:ch3
*expect: turn · turn_ended: True · 13.5s · audio: 765444 b64 bytes*
*note: voice item (keyword-match)*

> You will see a letter and two pictures. Say the picture word that starts with the letter’s sound! This letter says aaa. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch3
*expect: turn · turn_ended: True · 10.2s · audio: 573444 b64 bytes*
*note: student says "net"*

> My turn: this letter says aaa, and the word apple starts with aaa. Your turn. Which picture starts with this letter’s sound?

### right:ch3
*expect: turn · turn_ended: True · 3.4s · audio: 97320 b64 bytes*
*note: student says "apple"*

> Yes, apple.

### ask:ch4
*expect: turn · turn_ended: True · 9.3s · audio: 492804 b64 bytes*
*note: gesture item (hear-see)*

> I say a sound — you tap the letter that makes it! Listen: iii. Your turn. Tap the letter that makes iii.

### hands-hold:ch4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch4
*expect: turn · turn_ended: True · 7.2s · audio: 367364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: listen again. Iii. Your turn. Tap the letter that makes iii.

### commit-right:ch4
*expect: turn · turn_ended: True · 3.2s · audio: 90244 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, iii.

### ask:ch5
*expect: turn · turn_ended: True · 13.2s · audio: 741764 b64 bytes*
*note: voice item (keyword-match)*

> You will see a letter and two pictures. Say the picture word that starts with the letter’s sound! This letter says /p/. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch5
*expect: turn · turn_ended: True · 9.9s · audio: 549764 b64 bytes*
*note: student says "net"*

> My turn: this letter says /p/, and the word pig starts with /p/. Your turn. Which picture starts with this letter’s sound?

### right:ch5
*expect: turn · turn_ended: True · 3.4s · audio: 99844 b64 bytes*
*note: student says "pig"*

> Yes, pig.

### complete
*expect: turn · turn_ended: True · 6.9s · audio: 358404 b64 bytes*

> What great letter-sound work today! You are learning the sounds that letters make. See you next time!
