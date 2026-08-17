# Tier-3 Live Tutor Report — word-sorter — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-sorter", "items": 12, "voice_items": 12, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "binary_sort-0::w5", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong3:binary_sort-0::w5 1/1 (1 beat) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:binary_sort-0::w5 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `binary_sort-0::w5` | voice/binary_sort | Liquid | ✅✅✅ | - | n/a |
| `binary_sort-0::w1` | voice/binary_sort | Liquid | ✅ | Solid | ✅ |
| `binary_sort-0::w2` | voice/binary_sort | Solid | ✅ | Liquid | ✅ |
| `binary_sort-0::w0` | voice/binary_sort | Solid | ✅ | Liquid | ✅ |
| `binary_sort-0::w3` | voice/binary_sort | Liquid | ✅ | Solid | ✅ |
| `binary_sort-0::w4` | voice/binary_sort | Solid | ✅ | Liquid | ✅ |
| `binary_sort-1::w4` | voice/binary_sort | Hard | ✅ | Soft | ✅ |
| `binary_sort-1::w1` | voice/binary_sort | Soft | ✅ | Hard | ✅ |
| `binary_sort-1::w3` | voice/binary_sort | Soft | ✅ | Hard | ✅ |
| `binary_sort-1::w5` | voice/binary_sort | Soft | ✅ | Hard | ✅ |
| `binary_sort-1::w2` | voice/binary_sort | Hard | ✅ | Soft | ✅ |
| `binary_sort-1::w0` | voice/binary_sort | Hard | ✅ | Soft | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:binary_sort-0::w5
*expect: turn · turn_ended: True · 15.1s · audio: 871044 b64 bytes*
*note: voice item (binary_sort)*

> Hi! Let us play a sorting game! I say a word — you tell me which group it belongs with. Think about what the word means, and where it belongs. Your turn. Listen: desk. Liquid, or Solid?

### wrong1:binary_sort-0::w5
*expect: turn · turn_ended: True · 9.1s · audio: 487684 b64 bytes*
*note: student says "Liquid"*

> My turn: desk belongs with Solid. Your turn. Listen: desk. Liquid, or Solid?

### wrong2:binary_sort-0::w5
*expect: turn · turn_ended: True · 8.9s · audio: 465960 b64 bytes*
*note: student says "Liquid"*

> My turn: desk belongs with Liquid. Your turn. Listen: desk. Liquid, or Solid?

### wrong3:binary_sort-0::w5
*expect: turn · turn_ended: True · 8.6s · audio: 471684 b64 bytes*
*note: student says "Liquid"*

> My turn: desk belongs with Solid. Your turn. Listen: desk. Liquid, or Solid?

### moveon:binary_sort-0::w5
*expect: turn · turn_ended: True · 8.5s · audio: 438404 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. Listen: rock. Liquid, or Solid?

### wrong:binary_sort-0::w1
*expect: turn · turn_ended: True · 8.1s · audio: 439684 b64 bytes*
*note: student says "Liquid"*

> My turn: rock belongs with Solid. Your turn. Listen: rock. Liquid, or Solid?

### right:binary_sort-0::w1
*expect: turn · turn_ended: True · 4.9s · audio: 171560 b64 bytes*
*note: student says "Solid"*

> Yes, rock belongs with Solid.

### ask:binary_sort-0::w2
*expect: turn · turn_ended: True · 6.0s · audio: 288644 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: milk. Liquid, or Solid?

### wrong:binary_sort-0::w2
*expect: turn · turn_ended: True · 8.4s · audio: 460164 b64 bytes*
*note: student says "Solid"*

> My turn: milk belongs with Liquid. Your turn. Listen: milk. Liquid, or Solid?

### right:binary_sort-0::w2
*expect: turn · turn_ended: True · 4.0s · audio: 158724 b64 bytes*
*note: student says "Liquid"*

> Yes, milk belongs with Liquid.

### ask:binary_sort-0::w0
*expect: turn · turn_ended: True · 6.2s · audio: 278404 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: juice. Liquid, or Solid?

### wrong:binary_sort-0::w0
*expect: turn · turn_ended: True · 8.2s · audio: 444804 b64 bytes*
*note: student says "Solid"*

> My turn: juice belongs with Liquid. Your turn. Listen: juice. Liquid, or Solid?

### right:binary_sort-0::w0
*expect: turn · turn_ended: True · 3.9s · audio: 152324 b64 bytes*
*note: student says "Liquid"*

> Yes, juice belongs with Liquid.

### ask:binary_sort-0::w3
*expect: turn · turn_ended: True · 6.1s · audio: 288644 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: chair. Liquid, or Solid?

### wrong:binary_sort-0::w3
*expect: turn · turn_ended: True · 8.4s · audio: 460164 b64 bytes*
*note: student says "Liquid"*

> My turn: chair belongs with Solid. Your turn. Listen: chair. Liquid, or Solid?

### right:binary_sort-0::w3
*expect: turn · turn_ended: True · 4.0s · audio: 169000 b64 bytes*
*note: student says "Solid"*

> Yes, chair belongs with Solid.

### ask:binary_sort-0::w4
*expect: turn · turn_ended: True · 6.2s · audio: 288644 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: water. Liquid, or Solid?

### wrong:binary_sort-0::w4
*expect: turn · turn_ended: True · 8.4s · audio: 451844 b64 bytes*
*note: student says "Solid"*

> My turn: water belongs with Liquid. Your turn. Listen: water. Liquid, or Solid?

### right:binary_sort-0::w4
*expect: turn · turn_ended: True · 3.7s · audio: 155524 b64 bytes*
*note: student says "Liquid"*

> Yes, water belongs with Liquid.

### ask:binary_sort-1::w4
*expect: turn · turn_ended: True · 6.0s · audio: 281604 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: blanket. Hard, or Soft?

### wrong:binary_sort-1::w4
*expect: turn · turn_ended: True · 8.3s · audio: 435204 b64 bytes*
*note: student says "Hard"*

> My turn: blanket belongs with Soft. Your turn. Listen: blanket. Hard, or Soft?

### right:binary_sort-1::w4
*expect: turn · turn_ended: True · 3.7s · audio: 152964 b64 bytes*
*note: student says "Soft"*

> Yes, blanket belongs with Soft.

### ask:binary_sort-1::w1
*expect: turn · turn_ended: True · 6.3s · audio: 283524 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: brick. Hard, or Soft?

### wrong:binary_sort-1::w1
*expect: turn · turn_ended: True · 8.1s · audio: 440964 b64 bytes*
*note: student says "Soft"*

> My turn: brick belongs with Hard. Your turn. Listen: brick. Hard, or Soft?

### right:binary_sort-1::w1
*expect: turn · turn_ended: True · 3.5s · audio: 143364 b64 bytes*
*note: student says "Hard"*

> Yes, brick belongs with Hard.

### ask:binary_sort-1::w3
*expect: turn · turn_ended: True · 6.0s · audio: 286084 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: spoon. Hard, or Soft?

### wrong:binary_sort-1::w3
*expect: turn · turn_ended: True · 8.5s · audio: 463364 b64 bytes*
*note: student says "Soft"*

> My turn: spoon belongs with Hard. Your turn. Listen: spoon. Hard, or Soft?

### right:binary_sort-1::w3
*expect: turn · turn_ended: True · 3.5s · audio: 144644 b64 bytes*
*note: student says "Hard"*

> Yes, spoon belongs with Hard.

### ask:binary_sort-1::w5
*expect: turn · turn_ended: True · 6.8s · audio: 280324 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: coin. Hard, or Soft?

### wrong:binary_sort-1::w5
*expect: turn · turn_ended: True · 8.0s · audio: 430084 b64 bytes*
*note: student says "Soft"*

> My turn: coin belongs with Hard. Your turn. Listen: coin. Hard, or Soft?

### right:binary_sort-1::w5
*expect: turn · turn_ended: True · 3.5s · audio: 142724 b64 bytes*
*note: student says "Hard"*

> Yes, coin belongs with Hard.

### ask:binary_sort-1::w2
*expect: turn · turn_ended: True · 5.8s · audio: 276484 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: teddy. Hard, or Soft?

### wrong:binary_sort-1::w2
*expect: turn · turn_ended: True · 8.2s · audio: 443524 b64 bytes*
*note: student says "Hard"*

> My turn: teddy belongs with Soft. Your turn. Listen: teddy. Hard, or Soft?

### right:binary_sort-1::w2
*expect: turn · turn_ended: True · 3.7s · audio: 151044 b64 bytes*
*note: student says "Soft"*

> Yes, teddy belongs with Soft.

### ask:binary_sort-1::w0
*expect: turn · turn_ended: True · 6.9s · audio: 296324 b64 bytes*
*note: voice item (binary_sort)*

> Your turn. Listen: pillow. Hard, or Soft?

### wrong:binary_sort-1::w0
*expect: turn · turn_ended: True · 8.0s · audio: 432644 b64 bytes*
*note: student says "Hard"*

> My turn: pillow belongs with Soft. Your turn. Listen: pillow. Hard, or Soft?

### right:binary_sort-1::w0
*expect: turn · turn_ended: True · 3.5s · audio: 142084 b64 bytes*
*note: student says "Soft"*

> Yes, pillow belongs with Soft.

### complete
*expect: turn · turn_ended: True · 6.0s · audio: 294404 b64 bytes*

> Great sorting today! You told me every one out loud. See you next time!
