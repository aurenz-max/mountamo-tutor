# Tier-3 Live Tutor Report — sorting-station — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "sorting-station", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `c1::count::solid` | voice/count_group | two | ✅ | three | ✅ |
| `c1::count::liquid` | voice/count_group | one | ✅ | two | ✅ |
| `c1::compare` | voice/compare | more | ✅ | Solid | ✅ |
| `c2::count::liquid` | voice/count_group | one | ✅ | two | ✅ |
| `c2::count::gas` | voice/count_group | two | ✅ | one | ✅ |
| `c2::compare` | voice/compare | more | ✅ | Liquid | ✅ |
| `c4::count::boiling` | voice/count_group | one | ✅ | two | ✅ |
| `c4::count::condensation` | voice/count_group | two | ✅ | one | ✅ |
| `c4::compare` | voice/compare | more | ✅ | Boiling | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1::count::solid
*expect: turn · turn_ended: True · 11.8s · audio: 660484 b64 bytes*
*note: voice item (count_group)*

> Hi! Let us sort some things together! Now we count each group out loud. Touch each thing as you count. Your turn. How many are in the Solid group?

### wrong:c1::count::solid
*expect: turn · turn_ended: True · 7.2s · audio: 386564 b64 bytes*
*note: student says "two" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there are three in the Solid group. Your turn. How many are in the Solid group?

### right:c1::count::solid
*expect: turn · turn_ended: True · 4.2s · audio: 178564 b64 bytes*
*note: student says "three"*

> Yes, there are three in the Solid group.

### ask:c1::count::liquid
*expect: turn · turn_ended: True · 4.9s · audio: 225320 b64 bytes*
*note: voice item (count_group)*

> Your turn. How many are in the Liquid group?

### wrong:c1::count::liquid
*expect: turn · turn_ended: True · 7.2s · audio: 376324 b64 bytes*
*note: student says "one" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there are two in the Liquid group. Your turn. How many are in the Liquid group?

### right:c1::count::liquid
*expect: turn · turn_ended: True · 4.2s · audio: 188164 b64 bytes*
*note: student says "two"*

> Yes, there are two in the Liquid group.

### ask:c1::compare
*expect: turn · turn_ended: True · 10.8s · audio: 580484 b64 bytes*
*note: voice item (compare)*

> Now we compare the two groups. Think about the two counts. Your turn. Which group has more? Solid, Liquid, or the same?

### wrong:c1::compare
*expect: turn · turn_ended: True · 6.2s · audio: 319364 b64 bytes*
*note: student says "more" — the bare comparison word with no group named. It is the word the QUESTION itself used, said confidently, so a judge listening for "did they say something about more" affirms it — while the child has not said which group*

> My turn: there are more in Solid. Your turn. Which group has more?

### right:c1::compare
*expect: turn · turn_ended: True · 3.8s · audio: 157444 b64 bytes*
*note: student says "Solid"*

> Yes, there are more in Solid.

### ask:c2::count::liquid
*expect: turn · turn_ended: True · 8.9s · audio: 466564 b64 bytes*
*note: voice item (count_group)*

> Now we count each group out loud. Touch each thing as you count. Your turn. How many are in the Liquid group?

### wrong:c2::count::liquid
*expect: turn · turn_ended: True · 7.4s · audio: 398724 b64 bytes*
*note: student says "one" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there are two in the Liquid group. Your turn. How many are in the Liquid group?

### right:c2::count::liquid
*expect: turn · turn_ended: True · 4.1s · audio: 181764 b64 bytes*
*note: student says "two"*

> Yes, there are two in the Liquid group.

### ask:c2::count::gas
*expect: turn · turn_ended: True · 5.1s · audio: 220200 b64 bytes*
*note: voice item (count_group)*

> Your turn. How many are in the Gas group?

### wrong:c2::count::gas
*expect: turn · turn_ended: True · 7.1s · audio: 378244 b64 bytes*
*note: student says "two" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there is one in the Gas group. Your turn. How many are in the Gas group?

### right:c2::count::gas
*expect: turn · turn_ended: True · 3.8s · audio: 167044 b64 bytes*
*note: student says "one"*

> Yes, there is one in the Gas group.

### ask:c2::compare
*expect: turn · turn_ended: True · 10.8s · audio: 583720 b64 bytes*
*note: voice item (compare)*

> Now we compare the two groups. Think about the two counts. Your turn. Which group has more? Liquid, Gas, or the same?

### wrong:c2::compare
*expect: turn · turn_ended: True · 6.6s · audio: 341764 b64 bytes*
*note: student says "more" — the bare comparison word with no group named. It is the word the QUESTION itself used, said confidently, so a judge listening for "did they say something about more" affirms it — while the child has not said which group*

> My turn: there are more in Liquid. Your turn. Which group has more?

### right:c2::compare
*expect: turn · turn_ended: True · 3.6s · audio: 150404 b64 bytes*
*note: student says "Liquid"*

> Yes, there are more in Liquid.

### ask:c4::count::boiling
*expect: turn · turn_ended: True · 9.1s · audio: 486440 b64 bytes*
*note: voice item (count_group)*

> Now we count each group out loud. Touch each thing as you count. Your turn. How many are in the Boiling group?

### wrong:c4::count::boiling
*expect: turn · turn_ended: True · 7.2s · audio: 388484 b64 bytes*
*note: student says "one" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there are two in the Boiling group. Your turn. How many are in the Boiling group?

### right:c4::count::boiling
*expect: turn · turn_ended: True · 4.6s · audio: 176004 b64 bytes*
*note: student says "two"*

> Yes, there are two in the Boiling group.

### ask:c4::count::condensation
*expect: turn · turn_ended: True · 5.3s · audio: 234244 b64 bytes*
*note: voice item (count_group)*

> Your turn. How many are in the Condensation group?

### wrong:c4::count::condensation
*expect: turn · turn_ended: True · 8.2s · audio: 444804 b64 bytes*
*note: student says "two" — the off-by-one count — the most common miss in a spoken count, and the one a judge grading on "did they say a number" rounds toward. The contract forbids rounding by name*

> My turn: there is one in the Condensation group. Your turn. How many are in the Condensation group?

### right:c4::count::condensation
*expect: turn · turn_ended: True · 4.2s · audio: 191364 b64 bytes*
*note: student says "one"*

> Yes, there is one in the Condensation group.

### ask:c4::compare
*expect: turn · turn_ended: True · 10.9s · audio: 593960 b64 bytes*
*note: voice item (compare)*

> Now we compare the two groups. Think about the two counts. Your turn. Which group has more? Boiling, Condensation, or the same?

### wrong:c4::compare
*expect: turn · turn_ended: True · 7.0s · audio: 357764 b64 bytes*
*note: student says "more" — the bare comparison word with no group named. It is the word the QUESTION itself used, said confidently, so a judge listening for "did they say something about more" affirms it — while the child has not said which group*

> My turn: there are more in Boiling. Your turn. Which group has more?

### right:c4::compare
*expect: turn · turn_ended: True · 3.9s · audio: 159364 b64 bytes*
*note: student says "Boiling"*

> Yes, there are more in Boiling.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 321924 b64 bytes*

> Great sorting today! You told me every one out loud. See you next time!
