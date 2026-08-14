# Tier-3 Live Tutor Report — interactive-book — 2026-08-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "interactive-book", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 6 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `di-tag-spoken` | ask:interactive-book-word-2-1 1/3, ask:interactive-book-word-2-2 1/3, ask:interactive-book-word-3-1 1/3 (3 beats) | read control syntax aloud: "[CURRENT STATE]" — the fabricated-tag class |
| note | HIGH | `di-answer-leak-in-ask` | ask:interactive-book-word-2-1 1/3, ask:interactive-book-word-2-2 1/3, ask:interactive-book-word-3-1 1/3 (3 beats) | the ask contains the answer "gas": "[CURRENT STATE]: The student is on attempt 0 for the challenge 'read-focus-word' with the prompt 'Listen: Hot heat turns the water into an invisible — hmm. Your" |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `interactive-book-word-1-1` | voice/read-focus-word | banana | ✅✅✅ | solid | ✅✅✅ |
| `interactive-book-word-1-2` | voice/read-focus-word | banana | ✅✅✅ | cube | ✅✅✅ |
| `interactive-book-word-2-1` | voice/read-focus-word | banana | ✅✅✅ | liquid | ✅✅✅ |
| `interactive-book-word-2-2` | voice/read-focus-word | banana | ✅✅✅ | cup | ✅✅✅ |
| `interactive-book-word-3-1` | voice/read-focus-word | banana | ✅✅✅ | gas | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:interactive-book-word-1-1
*expect: turn · turn_ended: True · 15.7s · audio: 896644 b64 bytes*
*note: voice item (read-focus-word)*

> Hi! Time to open our book! I read our book out loud, and I stop at one glowing word. You read that word to me! Listen: When water gets very cold, it turns into — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-1
*expect: turn · turn_ended: True · 10.6s · audio: 593284 b64 bytes*
*note: student says "banana"*

> My turn: that word is solid. When water gets very cold, it turns into solid ice. Your turn. Read the glowing word.

### right:interactive-book-word-1-1
*expect: turn · turn_ended: True · 7.7s · audio: 412804 b64 bytes*
*note: student says "solid"*

> Yes, solid! When water gets very cold, it turns into solid ice. You did it!

### ask:interactive-book-word-1-2
*expect: turn · turn_ended: True · 7.6s · audio: 383364 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: You can hold a cold — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-2
*expect: turn · turn_ended: True · 8.9s · audio: 490884 b64 bytes*
*note: student says "banana"*

> My turn: that word is cube. You can hold a cold cube in your hand. Your turn. Read the glowing word.

### right:interactive-book-word-1-2
*expect: turn · turn_ended: True · 6.4s · audio: 330244 b64 bytes*
*note: student says "cube"*

> Yes, cube! You can hold a cold cube in your hand. That's reading!

### ask:interactive-book-word-2-1
*expect: turn · turn_ended: True · 8.9s · audio: 454440 b64 bytes*
*note: voice item (read-focus-word)*

> [CURRENT STATE]: The student is on attempt 0 for the challenge 'read-focus-word' with the prompt 'Listen: Warm air melts the ice into a wet — hmm. Your turn. Read the glowing word.' and the correct answer being 'liquid'.

Listen: Warm air melts the ice into a wet — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-1
*expect: turn · turn_ended: True · 9.6s · audio: 536360 b64 bytes*
*note: student says "banana"*

> My turn: that word is liquid. Warm air melts the ice into a wet liquid. Your turn. Read the glowing word.

### right:interactive-book-word-2-1
*expect: turn · turn_ended: True · 7.0s · audio: 359720 b64 bytes*
*note: student says "liquid"*

> Yes, liquid! Warm air melts the ice into a wet liquid. Great reading!

### ask:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.1s · audio: 469764 b64 bytes*
*note: voice item (read-focus-word)*

> [CURRENT STATE]: The student is on attempt 0 for the challenge 'read-focus-word' with the prompt 'Listen: The clear water pours down into a shiny — hmm. Your turn. Read the glowing word.' and the correct answer being 'cup'.

Listen: The clear water pours down into a shiny — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.6s · audio: 535080 b64 bytes*
*note: student says "banana"*

> My turn: that word is cup. The clear water pours down into a shiny cup. Your turn. Read the glowing word.

### right:interactive-book-word-2-2
*expect: turn · turn_ended: True · 7.2s · audio: 374440 b64 bytes*
*note: student says "cup"*

> Yes, cup! The clear water pours down into a shiny cup. You've got it!

### ask:interactive-book-word-3-1
*expect: turn · turn_ended: True · 9.2s · audio: 473000 b64 bytes*
*note: voice item (read-focus-word)*

> [CURRENT STATE]: The student is on attempt 0 for the challenge 'read-focus-word' with the prompt 'Listen: Hot heat turns the water into an invisible — hmm. Your turn. Read the glowing word.' and the correct answer being 'gas'.

Listen: Hot word.

### wrong:interactive-book-word-3-1
*expect: turn · turn_ended: True · 10.3s · audio: 539524 b64 bytes*
*note: student says "banana"*

> My turn: that word is gas. Hot heat turns the water into an invisible gas. Your turn. Read the glowing word.

### right:interactive-book-word-3-1
*expect: turn · turn_ended: True · 7.3s · audio: 386600 b64 bytes*
*note: student says "gas"*

> Yes, gas! Hot heat turns the water into an invisible gas. That's reading!

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 316804 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!


## Run 2 — beat-by-beat transcript

### ask:interactive-book-word-1-1
*expect: turn · turn_ended: True · 16.1s · audio: 926760 b64 bytes*
*note: voice item (read-focus-word)*

> Hi! Time to open our book! I read our book out loud, and I stop at one glowing word. You read that word to me! Listen: When water gets very cold, it turns into — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-1
*expect: turn · turn_ended: True · 9.9s · audio: 556804 b64 bytes*
*note: student says "banana"*

> My turn: that word is solid. When water gets very cold, it turns into solid ice. Your turn. Read the glowing word.

### right:interactive-book-word-1-1
*expect: turn · turn_ended: True · 6.9s · audio: 350120 b64 bytes*
*note: student says "solid"*

> Yes, solid! When water gets very cold, it turns into solid ice.

### ask:interactive-book-word-1-2
*expect: turn · turn_ended: True · 7.0s · audio: 350084 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: You can hold a cold — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-2
*expect: turn · turn_ended: True · 8.5s · audio: 465284 b64 bytes*
*note: student says "banana"*

> My turn: that word is cube. You can hold a cold cube in your hand. Your turn. Read the glowing word.

### right:interactive-book-word-1-2
*expect: turn · turn_ended: True · 5.3s · audio: 259880 b64 bytes*
*note: student says "cube"*

> Yes, cube! You can hold a cold cube in your hand.

### ask:interactive-book-word-2-1
*expect: turn · turn_ended: True · 8.8s · audio: 444804 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Warm air melts the ice into a wet — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-1
*expect: turn · turn_ended: True · 9.5s · audio: 522280 b64 bytes*
*note: student says "banana"*

> My turn: that word is liquid. Warm air melts the ice into a wet liquid. Your turn. Read the glowing word.

### right:interactive-book-word-2-1
*expect: turn · turn_ended: True · 6.8s · audio: 346920 b64 bytes*
*note: student says "liquid"*

> Yes, liquid! Warm air melts the ice into a wet liquid.

### ask:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.5s · audio: 506920 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: The clear water pours down into a shiny — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.7s · audio: 542760 b64 bytes*
*note: student says "banana"*

> My turn: that word is cup. The clear water pours down into a shiny cup. Your turn. Read the glowing word.

### right:interactive-book-word-2-2
*expect: turn · turn_ended: True · 6.2s · audio: 304040 b64 bytes*
*note: student says "cup"*

> Yes, cup! The clear water pours down into a shiny cup.

### ask:interactive-book-word-3-1
*expect: turn · turn_ended: True · 9.1s · audio: 462760 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Hot heat turns the water into an invisible — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-1
*expect: turn · turn_ended: True · 10.0s · audio: 552360 b64 bytes*
*note: student says "banana"*

> My turn: that word is gas. Hot heat turns the water into an invisible gas. Your turn. Read the glowing word.

### right:interactive-book-word-3-1
*expect: turn · turn_ended: True · 6.2s · audio: 319364 b64 bytes*
*note: student says "gas"*

> Yes, gas! Hot heat turns the water into an invisible gas.

### complete
*expect: turn · turn_ended: True · 5.9s · audio: 292484 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!


## Run 3 — beat-by-beat transcript

### ask:interactive-book-word-1-1
*expect: turn · turn_ended: True · 16.0s · audio: 929924 b64 bytes*
*note: voice item (read-focus-word)*

> Hi! Time to open our book! I read our book out loud, and I stop at one glowing word. You read that word to me! Listen: When water gets very cold, it turns into — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-1
*expect: turn · turn_ended: True · 10.3s · audio: 583720 b64 bytes*
*note: student says "banana"*

> My turn: that word is solid. When water gets very cold, it turns into solid ice. Your turn. Read the glowing word.

### right:interactive-book-word-1-1
*expect: turn · turn_ended: True · 7.7s · audio: 368004 b64 bytes*
*note: student says "solid"*

> Yes, solid! When water gets very cold, it turns into solid ice.

### ask:interactive-book-word-1-2
*expect: turn · turn_ended: True · 7.5s · audio: 370564 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: You can hold a cold — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-2
*expect: turn · turn_ended: True · 8.2s · audio: 449924 b64 bytes*
*note: student says "banana"*

> My turn: that word is cube. You can hold a cold cube in your hand. Your turn. Read the glowing word.

### right:interactive-book-word-1-2
*expect: turn · turn_ended: True · 5.4s · audio: 269480 b64 bytes*
*note: student says "cube"*

> Yes, cube! You can hold a cold cube in your hand.

### ask:interactive-book-word-2-1
*expect: turn · turn_ended: True · 8.9s · audio: 469124 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Warm air melts the ice into a wet — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-1
*expect: turn · turn_ended: True · 9.2s · audio: 506884 b64 bytes*
*note: student says "banana"*

> My turn: that word is liquid. Warm air melts the ice into a wet liquid. Your turn. Read the glowing word.

### right:interactive-book-word-2-1
*expect: turn · turn_ended: True · 6.3s · audio: 325800 b64 bytes*
*note: student says "liquid"*

> Yes, liquid! Warm air melts the ice into a wet liquid.

### ask:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.3s · audio: 490244 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: The clear water pours down into a shiny — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-2
*expect: turn · turn_ended: True · 8.9s · audio: 495364 b64 bytes*
*note: student says "banana"*

> My turn: that word is cup. The clear water pours down into a shiny cup. Your turn. Read the glowing word.

### right:interactive-book-word-2-2
*expect: turn · turn_ended: True · 6.3s · audio: 316840 b64 bytes*
*note: student says "cup"*

> Yes, cup! The clear water pours down into a shiny cup.

### ask:interactive-book-word-3-1
*expect: turn · turn_ended: True · 9.0s · audio: 480644 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Hot heat turns the water into an invisible — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-1
*expect: turn · turn_ended: True · 9.4s · audio: 521604 b64 bytes*
*note: student says "banana"*

> My turn: that word is gas. Hot heat turns the water into an invisible gas. Your turn. Read the glowing word.

### right:interactive-book-word-3-1
*expect: turn · turn_ended: True · 6.4s · audio: 327720 b64 bytes*
*note: student says "gas"*

> Yes, gas! Hot heat turns the water into an invisible gas.

### complete
*expect: turn · turn_ended: True · 6.6s · audio: 330244 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!
