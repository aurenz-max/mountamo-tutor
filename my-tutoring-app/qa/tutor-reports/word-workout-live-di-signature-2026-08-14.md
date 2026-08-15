# Tier-3 Live Tutor Report — word-workout — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-workout", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "grade": "1"}`
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
| `c1-read` | voice/read_sentence | a cat sat on a mat. | ✅ | The cat sat on a mat. | ✅ |
| `c1-q` | voice/answer_question | sat | ✅ | cat | ✅ |
| `c2-read` | voice/read_sentence | A fat rat ran at | ✅ | A fat rat ran at bag. | ✅ |
| `c2-q` | voice/answer_question | fat | ✅ | rat | ✅ |
| `c3-read` | voice/read_sentence | Dad can nap in a | ✅ | Dad can nap in a van. | ✅ |
| `c3-q` | voice/answer_question | can | ✅ | dad | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1-read
*expect: turn · turn_ended: True · 9.6s · audio: 520360 b64 bytes*
*note: voice item (read_sentence)*

> Hi! Time for a word workout! I show you a little sentence. You read it out loud, all by yourself! Your turn. Read the sentence.

### wrong:c1-read
*expect: turn · turn_ended: True · 7.4s · audio: 398084 b64 bytes*
*note: student says "a cat sat on a mat." — a small word swapped for another small word — the commonest miss, and it sounds fluent*

> My turn: not "a cat" — The cat sat on a mat. Your turn. Read it again.

### right:c1-read
*expect: turn · turn_ended: True · 4.8s · audio: 197124 b64 bytes*
*note: student says "The cat sat on a mat."*

> Yes, that says The cat sat on a mat.

### ask:c1-q
*expect: turn · turn_ended: True · 7.6s · audio: 357764 b64 bytes*
*note: voice item (answer_question)*

> Now I ask you about the sentence, and you tell me out loud! Your turn. What sat on a mat?

### wrong:c1-q
*expect: turn · turn_ended: True · 7.5s · audio: 368644 b64 bytes*
*note: student says "sat" — a word lifted straight out of the sentence that does not answer the question — fluent because it came from the text*

> My turn: The cat sat on a mat. Cat. Your turn. What sat on a mat?

### right:c1-q
*expect: turn · turn_ended: True · 3.1s · audio: 90884 b64 bytes*
*note: student says "cat"*

> Yes, cat.

### ask:c2-read
*expect: turn · turn_ended: True · 7.4s · audio: 352644 b64 bytes*
*note: voice item (read_sentence)*

> I show you a little sentence. You read it out loud, all by yourself! Your turn. Read the sentence.

### wrong:c2-read
*expect: turn · turn_ended: True · 8.1s · audio: 444804 b64 bytes*
*note: student says "A fat rat ran at"*

> My turn: not "ran at" — A fat rat ran at bag. Your turn. Read it again.

### right:c2-read
*expect: turn · turn_ended: True · 5.3s · audio: 254084 b64 bytes*
*note: student says "A fat rat ran at bag."*

> Yes, that says A fat rat ran at bag.

### ask:c2-q
*expect: turn · turn_ended: True · 7.0s · audio: 351364 b64 bytes*
*note: voice item (answer_question)*

> Now I ask you about the sentence, and you tell me out loud! Your turn. What ran at the bag?

### wrong:c2-q
*expect: turn · turn_ended: True · 7.5s · audio: 400644 b64 bytes*
*note: student says "fat" — a word lifted straight out of the sentence that does not answer the question — fluent because it came from the text*

> My turn: A fat rat ran at bag. Rat. Your turn. What ran at the bag?

### right:c2-q
*expect: turn · turn_ended: True · 3.3s · audio: 122280 b64 bytes*
*note: student says "rat"*

> Yes, rat.

### ask:c3-read
*expect: turn · turn_ended: True · 7.9s · audio: 388484 b64 bytes*
*note: voice item (read_sentence)*

> I show you a little sentence. You read it out loud, all by yourself! Your turn. Read the sentence.

### wrong:c3-read
*expect: turn · turn_ended: True · 7.8s · audio: 412804 b64 bytes*
*note: student says "Dad can nap in a"*

> My turn: not "in a" — Dad can nap in a van. Your turn. Read it again.

### right:c3-read
*expect: turn · turn_ended: True · 4.2s · audio: 177924 b64 bytes*
*note: student says "Dad can nap in a van."*

> Yes, that says Dad can nap in a van.

### ask:c3-q
*expect: turn · turn_ended: True · 7.4s · audio: 376964 b64 bytes*
*note: voice item (answer_question)*

> Now I ask you about the sentence, and you tell me out loud! Your turn. Who can nap in a van?

### wrong:c3-q
*expect: turn · turn_ended: True · 7.7s · audio: 415364 b64 bytes*
*note: student says "can" — a word lifted straight out of the sentence that does not answer the question — fluent because it came from the text*

> My turn: Dad can nap in a van. Dad. Your turn. Who can nap in a van?

### right:c3-q
*expect: turn · turn_ended: True · 3.6s · audio: 111364 b64 bytes*
*note: student says "dad"*

> Yes, dad.

### complete
*expect: turn · turn_ended: True · 6.8s · audio: 357124 b64 bytes*

> What a great word workout! You read every word out loud, all by yourself. See you next time!
