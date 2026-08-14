# Tier-3 Live Tutor Report — interactive-book — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "interactive-book", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:interactive-book-word-1-1 1/1, wrong3:interactive-book-word-1-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `interactive-book-word-1-1` | voice/read-focus-word | banana | ✅✅✅ | - | n/a |
| `interactive-book-word-2-1` | voice/read-focus-word | banana | ✅ | melt | ✅ |
| `interactive-book-word-2-2` | voice/read-focus-word | banana | ✅ | liquid | ✅ |
| `interactive-book-word-3-1` | voice/read-focus-word | banana | ✅ | boil | ✅ |
| `interactive-book-word-3-2` | voice/read-focus-word | banana | ✅ | gas | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:interactive-book-word-1-1
*expect: turn · turn_ended: True · 14.8s · audio: 835844 b64 bytes*
*note: voice item (read-focus-word)*

> Hi! Time to open our book! I read our book out loud, and I stop at one glowing word. You read that word to me! Listen: A cold freezer makes — hmm. Your turn. Read the glowing word.

### wrong1:interactive-book-word-1-1
*expect: turn · turn_ended: True · 8.6s · audio: 481924 b64 bytes*
*note: student says "banana"*

> My turn: that word is water. A cold freezer makes water turn into hard ice. Your turn. Read the glowing word.

### wrong2:interactive-book-word-1-1
*expect: turn · turn_ended: True · 8.8s · audio: 480644 b64 bytes*
*note: student says "banana"*

> My turn: that word is water. A cold freezer makes water turn into hard ice. Your turn. Read the glowing word.

### wrong3:interactive-book-word-1-1
*expect: turn · turn_ended: True · 8.6s · audio: 476164 b64 bytes*
*note: student says "banana"*

> My turn: that word is water. A cold freezer makes water turn into hard ice. Your turn. Read the glowing word.

### moveon:interactive-book-word-1-1
*expect: turn · turn_ended: True · 10.7s · audio: 545320 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That glowing word is water. Listen: Warm air helps the ice — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-1
*expect: turn · turn_ended: True · 9.1s · audio: 503044 b64 bytes*
*note: student says "banana"*

> My turn: that word is melt. Warm air helps the ice melt into wet liquid. Your turn. Read the glowing word.

### right:interactive-book-word-2-1
*expect: turn · turn_ended: True · 5.7s · audio: 289960 b64 bytes*
*note: student says "melt"*

> Yes, melt! Warm air helps the ice melt into wet liquid.

### ask:interactive-book-word-2-2
*expect: turn · turn_ended: True · 8.8s · audio: 419204 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Warm air helps the ice melt into wet — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.2s · audio: 503684 b64 bytes*
*note: student says "banana"*

> My turn: that word is liquid. Warm air helps the ice melt into wet liquid. Your turn. Read the glowing word.

### right:interactive-book-word-2-2
*expect: turn · turn_ended: True · 6.2s · audio: 289924 b64 bytes*
*note: student says "liquid"*

> Yes, liquid! Warm air helps the ice melt into wet liquid.

### ask:interactive-book-word-3-1
*expect: turn · turn_ended: True · 7.8s · audio: 384004 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Hot fire can make the water — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-1
*expect: turn · turn_ended: True · 8.9s · audio: 490244 b64 bytes*
*note: student says "banana"*

> My turn: that word is boil. Hot fire can make the water boil into gas. Your turn. Read the glowing word.

### right:interactive-book-word-3-1
*expect: turn · turn_ended: True · 5.5s · audio: 272004 b64 bytes*
*note: student says "boil"*

> Yes, boil! Hot fire can make the water boil into gas.

### ask:interactive-book-word-3-2
*expect: turn · turn_ended: True · 8.1s · audio: 423684 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: Hot fire can make the water boil into — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-2
*expect: turn · turn_ended: True · 8.6s · audio: 476804 b64 bytes*
*note: student says "banana"*

> My turn: that word is gas. Hot fire can make the water boil into gas. Your turn. Read the glowing word.

### right:interactive-book-word-3-2
*expect: turn · turn_ended: True · 5.5s · audio: 274600 b64 bytes*
*note: student says "gas"*

> Yes, gas! Hot fire can make the water boil into gas.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 304644 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!
