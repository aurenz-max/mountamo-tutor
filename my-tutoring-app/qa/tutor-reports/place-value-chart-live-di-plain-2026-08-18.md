# Tier-3 Live Tutor Report — place-value-chart — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "place-value-chart", "items": 5, "voice_items": 4, "gesture_items": 1, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "pvc-1::place", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:pvc-1::place 1/1, wrong3:pvc-1::place 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:pvc-1::place 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `pvc-1::place` | voice/name-place | tens | ✅✅✅ | - | n/a |
| `pvc-1::value` | voice/say-value | two | ✅ | nine | ✅ |
| `pvc-2::build` | gesture/write-number | (placement) | ✅ | (placement) | ✅ |
| `pvc-3::place` | voice/name-place | ones | ✅ | tens | ✅ |
| `pvc-3::value` | voice/say-value | twenty | ✅ | ninety | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pvc-1::place
*expect: turn · turn_ended: True · 12.3s · audio: 681000 b64 bytes*
*note: voice item (name-place)*

> Hi! Time to work with big numbers! Look at the glowing digit, then say the name of its place. Find the glowing nine. Which place is it in? Is it the ones place, or the tens place?

### wrong1:pvc-1::place
*expect: turn · turn_ended: True · 11.7s · audio: 677764 b64 bytes*
*note: student says "tens"*

> My turn: the digit at the very end is always in the ones place. The nine sits at the end, so it is in the ones place. Your turn. Which place is the glowing nine in?

### wrong2:pvc-1::place
*expect: turn · turn_ended: True · 11.8s · audio: 670724 b64 bytes*
*note: student says "tens"*

> My turn: the digit at the very end is always in the ones place. The nine sits at the end, so it is in the ones place. Your turn. Which place is the glowing nine in?

### wrong3:pvc-1::place
*expect: turn · turn_ended: True · 12.3s · audio: 714280 b64 bytes*
*note: student says "tens"*

> My turn: the digit at the very end is always in the ones place. The nine sits at the end, so it is in the ones place. Your turn. Which place is the glowing nine in?

### moveon:pvc-1::place
*expect: turn · turn_ended: True · 8.3s · audio: 437764 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Say what the glowing digit is worth. The glowing digit is in the ones place. What is it worth?

### wrong:pvc-1::value
*expect: turn · turn_ended: True · 9.1s · audio: 504964 b64 bytes*
*note: student says "two"*

> My turn: a digit in the ones place is worth just itself — nine. Your turn. What is the glowing nine worth?

### right:pvc-1::value
*expect: turn · turn_ended: True · 5.5s · audio: 266920 b64 bytes*
*note: student says "nine"*

> Yes, nine — a nine in the ones place is worth nine.

### ask:pvc-2::build
*expect: turn · turn_ended: True · 14.1s · audio: 766084 b64 bytes*
*note: gesture item (write-number)*

> I say a number, and you write it — one digit in each column. When you stop, I look at your number. Listen. The number is: sixty-one. Write it — one digit in each column.

### hands-hold:pvc-2::build
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pvc-2::build
*expect: turn · turn_ended: True · 13.4s · audio: 787204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: when I hear forty, I go column by column — a four in the tens place; no ones — so a zero in the ones place. Your turn. Listen: sixty-one. Write it again.

### commit-right:pvc-2::build
*expect: turn · turn_ended: True · 5.2s · audio: 247720 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Sixty-one — every digit in its own place.

### ask:pvc-3::place
*expect: turn · turn_ended: True · 9.8s · audio: 528680 b64 bytes*
*note: voice item (name-place)*

> Look at the glowing digit, then say the name of its place. Find the glowing nine. Which place is it in? Is it the ones place, or the tens place?

### wrong:pvc-3::place
*expect: turn · turn_ended: True · 12.2s · audio: 666244 b64 bytes*
*note: student says "ones"*

> My turn: I start at the end and walk left — ones, tens. The nine sits in the tens place. Your turn. Which place is the glowing nine in?

### right:pvc-3::place
*expect: turn · turn_ended: True · 3.7s · audio: 159364 b64 bytes*
*note: student says "tens"*

> Yes, the nine is in the tens place.

### ask:pvc-3::value
*expect: turn · turn_ended: True · 6.9s · audio: 348164 b64 bytes*
*note: voice item (say-value)*

> Say what the glowing digit is worth. The glowing digit is in the tens place. What is it worth?

### wrong:pvc-3::value
*expect: turn · turn_ended: True · 14.6s · audio: 856324 b64 bytes*
*note: student says "twenty"*

> My turn: I say the digit, then its place — nine, tens: ninety. Nine alone only counts ones; in the tens place it is worth ninety. Your turn. What is the glowing nine worth?

### right:pvc-3::value
*expect: turn · turn_ended: True · 5.3s · audio: 261764 b64 bytes*
*note: student says "ninety"*

> Yes, ninety — a nine in the tens place is worth ninety.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 400644 b64 bytes*

> What great number work today! You know where every digit lives and what it is worth. See you next time!
