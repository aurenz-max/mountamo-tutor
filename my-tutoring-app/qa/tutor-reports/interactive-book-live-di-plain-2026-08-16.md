# Tier-3 Live Tutor Report — interactive-book — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "interactive-book", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "kindergarten"}`
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
| `interactive-book-word-1-2` | voice/read-focus-word | banana | ✅ | seed | ✅ |
| `interactive-book-word-2-1` | voice/read-focus-word | banana | ✅ | sun | ✅ |
| `interactive-book-word-2-2` | voice/read-focus-word | banana | ✅ | hose | ✅ |
| `interactive-book-word-3-1` | voice/read-focus-word | banana | ✅ | stem | ✅ |
| `interactive-book-word-3-2` | voice/read-focus-word | banana | ✅ | bug | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:interactive-book-word-1-1
*expect: turn · turn_ended: True · 15.5s · audio: 897924 b64 bytes*
*note: voice item (read-focus-word)*

> Hi! Time to open our book! I read our book out loud, and I stop at one glowing word. You read that word to me! Listen: We dig a small — hmm. Your turn. Read the glowing word.

### wrong1:interactive-book-word-1-1
*expect: turn · turn_ended: True · 9.9s · audio: 513924 b64 bytes*
*note: student says "banana"*

> My turn: that word is hole. We dig a small hole in the dark dirt. Your turn. Read the glowing word.

### wrong2:interactive-book-word-1-1
*expect: turn · turn_ended: True · 8.9s · audio: 488324 b64 bytes*
*note: student says "banana"*

> My turn: that word is hole. We dig a small hole in the dark dirt. Your turn. Read the glowing word.

### wrong3:interactive-book-word-1-1
*expect: turn · turn_ended: True · 9.2s · audio: 518404 b64 bytes*
*note: student says "banana"*

> My turn: that word is hole. We dig a small hole in the dark dirt. Your turn. Read the glowing word.

### moveon:interactive-book-word-1-1
*expect: turn · turn_ended: True · 11.2s · audio: 601604 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That glowing word is hole. Listen: We drop a tiny — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-1-2
*expect: turn · turn_ended: True · 9.1s · audio: 505604 b64 bytes*
*note: student says "banana"*

> My turn: that word is seed. We drop a tiny seed right inside. Your turn. Read the glowing word.

### right:interactive-book-word-1-2
*expect: turn · turn_ended: True · 5.8s · audio: 293764 b64 bytes*
*note: student says "seed"*

> Yes, seed! We drop a tiny seed right inside.

### ask:interactive-book-word-2-1
*expect: turn · turn_ended: True · 7.2s · audio: 364200 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: The warm — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-1
*expect: turn · turn_ended: True · 9.4s · audio: 526724 b64 bytes*
*note: student says "banana"*

> My turn: that word is sun. The warm sun shines high up in the blue sky. Your turn. Read the glowing word.

### right:interactive-book-word-2-1
*expect: turn · turn_ended: True · 6.2s · audio: 323204 b64 bytes*
*note: student says "sun"*

> Yes, sun! The warm sun shines high up in the blue sky.

### ask:interactive-book-word-2-2
*expect: turn · turn_ended: True · 7.9s · audio: 407044 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: We use a bright red — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-2-2
*expect: turn · turn_ended: True · 9.5s · audio: 533124 b64 bytes*
*note: student says "banana"*

> My turn: that word is hose. We use a bright red hose to wet the dry plant. Your turn. Read the glowing word.

### right:interactive-book-word-2-2
*expect: turn · turn_ended: True · 6.2s · audio: 319364 b64 bytes*
*note: student says "hose"*

> Yes, hose! We use a bright red hose to wet the dry plant.

### ask:interactive-book-word-3-1
*expect: turn · turn_ended: True · 7.8s · audio: 402564 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: A long green — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-1
*expect: turn · turn_ended: True · 9.1s · audio: 506884 b64 bytes*
*note: student says "banana"*

> My turn: that word is stem. A long green stem grows up tall. Your turn. Read the glowing word.

### right:interactive-book-word-3-1
*expect: turn · turn_ended: True · 5.8s · audio: 286084 b64 bytes*
*note: student says "stem"*

> Yes, stem! A long green stem grows up tall.

### ask:interactive-book-word-3-2
*expect: turn · turn_ended: True · 7.9s · audio: 372484 b64 bytes*
*note: voice item (read-focus-word)*

> Listen: A red — hmm. Your turn. Read the glowing word.

### wrong:interactive-book-word-3-2
*expect: turn · turn_ended: True · 9.4s · audio: 494120 b64 bytes*
*note: student says "banana"*

> My turn: that word is bug. A red bug sits on the soft leaf. Your turn. Read the glowing word.

### right:interactive-book-word-3-2
*expect: turn · turn_ended: True · 5.7s · audio: 273320 b64 bytes*
*note: student says "bug"*

> Yes, bug! A red bug sits on the soft leaf.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 317444 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!
