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
| `ch1` | voice/keyword-match | sss | ✅ | sun | ✅ |
| `ch2` | voice/keyword-match | aaa | ✅ | apple | ✅ |
| `ch3` | voice/keyword-match | puh | ✅ | pig | ✅ |
| `ch4` | voice/keyword-match | tuh | ✅ | tent | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 15.5s · audio: 895364 b64 bytes*
*note: voice item (keyword-match)*

> Hi! Time to play with letter sounds! You will see a letter and two pictures. Say the picture word that starts with the letter's sound! This letter says sss. Your turn. Which picture starts with this letter's sound? Say the word.

### wrong:ch1
*expect: turn · turn_ended: True · 10.1s · audio: 572164 b64 bytes*
*note: student says "sss" — the letter's SOUND said back instead of the picture word — the ask names the sound as the route to the answer, and at easy and medium the tutor modelled it seconds earlier, so a judge grading on "did they engage with the sound" affirms an answer that names no picture*

> My turn: this letter says sss, and the word sun starts with sss. Your turn. Which picture starts with this letter's sound?

### right:ch1
*expect: turn · turn_ended: True · 3.5s · audio: 97284 b64 bytes*
*note: student says "sun"*

> Yes, sun.

### ask:ch2
*expect: turn · turn_ended: True · 7.7s · audio: 393604 b64 bytes*
*note: voice item (keyword-match)*

> This letter says aaa. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch2
*expect: turn · turn_ended: True · 10.3s · audio: 552324 b64 bytes*
*note: student says "aaa" — the letter's SOUND said back instead of the picture word — the ask names the sound as the route to the answer, and at easy and medium the tutor modelled it seconds earlier, so a judge grading on "did they engage with the sound" affirms an answer that names no picture*

> My turn: this letter says aaa, and the word apple starts with aaa. Your turn. Which picture starts with this letter’s sound?

### right:ch2
*expect: turn · turn_ended: True · 3.2s · audio: 102440 b64 bytes*
*note: student says "apple"*

> Yes, apple.

### ask:ch3
*expect: turn · turn_ended: True · 7.6s · audio: 386564 b64 bytes*
*note: voice item (keyword-match)*

> This letter says /p/. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch3
*expect: turn · turn_ended: True · 9.4s · audio: 525444 b64 bytes*
*note: student says "puh" — the letter's SOUND said back instead of the picture word — the ask names the sound as the route to the answer, and at easy and medium the tutor modelled it seconds earlier, so a judge grading on "did they engage with the sound" affirms an answer that names no picture*

> My turn: this letter says /p/, and the word pig starts with /p/. Your turn. Which picture starts with this letter’s sound?

### right:ch3
*expect: turn · turn_ended: True · 3.2s · audio: 87080 b64 bytes*
*note: student says "pig"*

> Yes, pig.

### ask:ch4
*expect: turn · turn_ended: True · 7.7s · audio: 366084 b64 bytes*
*note: voice item (keyword-match)*

> This letter says /t/. Your turn. Which picture starts with this letter’s sound? Say the word.

### wrong:ch4
*expect: turn · turn_ended: True · 9.2s · audio: 511364 b64 bytes*
*note: student says "tuh" — the letter's SOUND said back instead of the picture word — the ask names the sound as the route to the answer, and at easy and medium the tutor modelled it seconds earlier, so a judge grading on "did they engage with the sound" affirms an answer that names no picture*

> My turn: this letter says /t/, and the word tent starts with /t/. Your turn. Which picture starts with this letter’s sound?

### right:ch4
*expect: turn · turn_ended: True · 3.2s · audio: 87720 b64 bytes*
*note: student says "tent"*

> Yes, tent.

### complete
*expect: turn · turn_ended: True · 6.6s · audio: 343044 b64 bytes*

> What great letter-sound work today! You are learning the sounds that letters make. See you next time!
