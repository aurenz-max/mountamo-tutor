# Tier-3 Live Tutor Report — place-value-chart — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "place-value-chart", "items": 5, "voice_items": 4, "gesture_items": 1, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": true, "capped_item": "pvc-1::value", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:pvc-1::value 1/1, wrong3:pvc-1::value 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:pvc-1::value 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `pvc-1::place` | voice/name-place | two hundred | ✅ | hundreds | ✅ |
| `pvc-1::value` | voice/say-value | two | ✅✅✅ | - | n/a |
| `pvc-2::build` | gesture/write-number | (placement) | ✅ | (placement) | ✅ |
| `pvc-3::place` | voice/name-place | twenty | ✅ | tens | ✅ |
| `pvc-3::value` | voice/say-value | two | ✅ | twenty | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pvc-1::place
*expect: turn · turn_ended: True · 15.9s · audio: 903684 b64 bytes*
*note: voice item (name-place)*

> Hi! Time to work with big numbers! Look at the glowing digit, then say the name of its place. Find the glowing two. Which place is it in? Is it the ones place, the tens place, the hundreds place, or the thousands place?

### wrong:pvc-1::place
*expect: turn · turn_ended: True · 12.3s · audio: 705284 b64 bytes*
*note: student says "two hundred" — the digit's VALUE said where its PLACE was asked — the mode confusion the catalog's own struggle row records*

> My turn: I start at the end and walk left — ones, tens, hundreds. The two sits in the hundreds place. Your turn. Which place is the glowing two in?

### right:pvc-1::place
*expect: turn · turn_ended: True · 4.1s · audio: 175364 b64 bytes*
*note: student says "hundreds"*

> Yes, the two is in the hundreds place.

### ask:pvc-1::value
*expect: turn · turn_ended: True · 7.5s · audio: 373764 b64 bytes*
*note: voice item (say-value)*

> Say what the glowing digit is worth. The glowing digit is in the hundreds place. What is it worth?

### wrong1:pvc-1::value
*expect: turn · turn_ended: True · 15.8s · audio: 916484 b64 bytes*
*note: student says "two" — the bare digit said for its worth — how many ones, not what it is worth here; the confusion this mode exists to undo, refused on purpose*

> My turn: I say the digit, then its place — two, hundreds: two hundred. Two alone only counts ones; in the hundreds place it is worth two hundred. Your turn. What is the glowing two worth?

### wrong2:pvc-1::value
*expect: turn · turn_ended: True · 15.3s · audio: 890244 b64 bytes*
*note: student says "two" — the bare digit said for its worth — how many ones, not what it is worth here; the confusion this mode exists to undo, refused on purpose*

> My turn: I say the digit, then its place — two, hundreds: two hundred. Two alone only counts ones; in the hundreds place it is worth two hundred. Your turn. What is the glowing two worth?

### wrong3:pvc-1::value
*expect: turn · turn_ended: True · 15.6s · audio: 904324 b64 bytes*
*note: student says "two" — the bare digit said for its worth — how many ones, not what it is worth here; the confusion this mode exists to undo, refused on purpose*

> My turn: I say the digit, then its place — two, hundreds: two hundred. Two alone only counts ones; in the hundreds place it is worth two hundred. Your turn. What is the glowing two worth?

### moveon:pvc-1::value
*expect: turn · turn_ended: True · 17.7s · audio: 1025924 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! I say a number, and you write it — one digit in each column. When you stop, I look at your number. Listen. The number is: three thousand nine hundred ninety-seven. Write it — one digit in each column.

### hands-hold:pvc-2::build
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:pvc-2::build
*expect: turn · turn_ended: True · 18.4s · audio: 1081604 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: when I hear three hundred six, I go column by column — a three in the hundreds place; no tens — so a zero in the tens place; a six in the ones place. Your turn. Listen: three thousand nine hundred ninety-seven. Write it again.

### commit-right:pvc-2::build
*expect: turn · turn_ended: True · 7.7s · audio: 387204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Three thousand nine hundred ninety-seven — every digit in its own place.

### ask:pvc-3::place
*expect: turn · turn_ended: True · 13.2s · audio: 723844 b64 bytes*
*note: voice item (name-place)*

> Look at the glowing digit, then say the name of its place. Find the glowing two. Which place is it in? Is it the ones place, the tens place, the hundreds place, or the thousands place?

### wrong:pvc-3::place
*expect: turn · turn_ended: True · 11.7s · audio: 660484 b64 bytes*
*note: student says "twenty" — the digit's VALUE said where its PLACE was asked — the mode confusion the catalog's own struggle row records*

> My turn: I start at the end and walk left — ones, tens. The two sits in the tens place. Your turn. Which place is the glowing two in?

### right:pvc-3::place
*expect: turn · turn_ended: True · 4.2s · audio: 180484 b64 bytes*
*note: student says "tens"*

> Yes, the two is in the tens place.

### ask:pvc-3::value
*expect: turn · turn_ended: True · 7.6s · audio: 383364 b64 bytes*
*note: voice item (say-value)*

> Say what the glowing digit is worth. The glowing digit is in the tens place. What is it worth?

### wrong:pvc-3::value
*expect: turn · turn_ended: True · 14.7s · audio: 859524 b64 bytes*
*note: student says "two" — the bare digit said for its worth — how many ones, not what it is worth here; the confusion this mode exists to undo, refused on purpose*

> My turn: I say the digit, then its place — two, tens: twenty. Two alone only counts ones; in the tens place it is worth twenty. Your turn. What is the glowing two worth?

### right:pvc-3::value
*expect: turn · turn_ended: True · 6.2s · audio: 309800 b64 bytes*
*note: student says "twenty"*

> Yes, twenty — a two in the tens place is worth twenty.

### complete
*expect: turn · turn_ended: True · 7.9s · audio: 412164 b64 bytes*

> What great number work today! You know where every digit lives and what it is worth. See you next time!


Frozen production payload SHA-256: `13a3962701ae3c8a952e426b55180a4c9c54475050dc9d8908f3ecd05c3d0543`
