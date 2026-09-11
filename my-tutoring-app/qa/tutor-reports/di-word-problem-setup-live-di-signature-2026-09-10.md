# Tier-3 Live Tutor Report — di-word-problem-setup — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-word-problem-setup", "items": 12, "voice_items": 9, "gesture_items": 3, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `wps-1-comparison-difference-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-1-comparison-difference-family` | voice/build_family | fourteen plus five equals box | ✅ | five plus box equals fourteen | ✅ |
| `wps-1-comparison-difference-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-1-comparison-difference-solve` | voice/build_family | nineteen | ✅ | nine | ✅ |
| `wps-2-change-loss_change-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-2-change-loss_change-family` | voice/build_family | fourteen plus two equals box | ✅ | two plus box equals fourteen | ✅ |
| `wps-2-change-loss_change-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-2-change-loss_change-solve` | voice/build_family | sixteen | ✅ | twelve | ✅ |
| `wps-3-part_whole-part-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-3-part_whole-part-family` | voice/build_family | sixteen plus eleven equals box | ✅ | eleven plus box equals sixteen | ✅ |
| `wps-3-part_whole-part-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-3-part_whole-part-solve` | voice/build_family | twenty-seven | ✅ | five | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wps-1-comparison-difference-big_number
*expect: turn · turn_ended: True · 26.0s · audio: 1559684 b64 bytes*
*note: gesture item (build_family)*

> We are going to set up word problems. I read you a story. You put the big number at the end of the arrow with your finger, then you say the family out loud — small plus small equals big, and you say box for the one we do not know — then add or subtract, then how many. Listen. Max has 14 apples. Ella has 5 apples. How many more apples does Max have than Ella? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-1-comparison-difference-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-1-comparison-difference-big_number
*expect: turn · turn_ended: True · 13.8s · audio: 798084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Max has more than Ella, so Max's apples is the whole amount. The big number is Max's apples. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-1-comparison-difference-big_number
*expect: turn · turn_ended: True · 7.5s · audio: 399400 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is Max's apples — Max has more than Ella, so Max's apples is the whole amount.

### ask:wps-1-comparison-difference-family
*expect: turn · turn_ended: True · 4.3s · audio: 132484 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-1-comparison-difference-family
*expect: turn · turn_ended: True · 11.9s · audio: 685444 b64 bytes*
*note: student says "fourteen plus five equals box" — the big number in a small slot — every number present, the family upside down*

> My turn: the big number goes last, after equals. Max's apples is the big number, so the family is five plus box equals fourteen. Your turn. Say the family.

### right:wps-1-comparison-difference-family
*expect: turn · turn_ended: True · 4.0s · audio: 169640 b64 bytes*
*note: student says "five plus box equals fourteen"*

> Yes, five plus box equals fourteen.

### ask:wps-1-comparison-difference-operation
*expect: turn · turn_ended: True · 3.8s · audio: 150404 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-1-comparison-difference-operation
*expect: turn · turn_ended: True · 8.5s · audio: 453764 b64 bytes*
*note: student says "add" — the operation taken from the story's word "more" instead of from the family*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-1-comparison-difference-operation
*expect: turn · turn_ended: True · 4.7s · audio: 211844 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-1-comparison-difference-solve
*expect: turn · turn_ended: True · 5.0s · audio: 226564 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many more apples does Max have than Ella?

### wrong:wps-1-comparison-difference-solve
*expect: turn · turn_ended: True · 8.8s · audio: 488324 b64 bytes*
*note: student says "nineteen" — the two story numbers combined the wrong way*

> My turn: not nineteen — fourteen minus five equals nine. Your turn. How many more apples does Max have than Ella?

### right:wps-1-comparison-difference-solve
*expect: turn · turn_ended: True · 6.3s · audio: 310404 b64 bytes*
*note: student says "nine"*

> Yes, fourteen minus five equals nine. Max has nine more apples than Ella.

### ask:wps-2-change-loss_change-big_number
*expect: turn · turn_ended: True · 12.3s · audio: 684840 b64 bytes*
*note: gesture item (build_family)*

> Listen. Ben had fourteen shells. Then Ben dropped some of them. Now Ben has two shells. How many shells did Ben drop? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-2-change-loss_change-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-2-change-loss_change-big_number
*expect: turn · turn_ended: True · 13.5s · audio: 792964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Ben dropped some, so what Ben started with is the whole amount. The big number is what Ben started with. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-2-change-loss_change-big_number
*expect: turn · turn_ended: True · 7.4s · audio: 396804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is what Ben started with — Ben dropped some, so what Ben started with is the whole amount.

### ask:wps-2-change-loss_change-family
*expect: turn · turn_ended: True · 3.5s · audio: 130600 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-2-change-loss_change-family
*expect: turn · turn_ended: True · 12.2s · audio: 706600 b64 bytes*
*note: student says "fourteen plus two equals box" — the big number in a small slot — every number present, the family upside down*

> My turn: the big number goes last, after equals. What Ben started with is the big number, so the family is two plus box equals fourteen. Your turn. Say the family.

### right:wps-2-change-loss_change-family
*expect: turn · turn_ended: True · 4.0s · audio: 180484 b64 bytes*
*note: student says "two plus box equals fourteen"*

> Yes, two plus box equals fourteen.

### ask:wps-2-change-loss_change-operation
*expect: turn · turn_ended: True · 4.5s · audio: 120964 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-2-change-loss_change-operation
*expect: turn · turn_ended: True · 8.7s · audio: 453160 b64 bytes*
*note: student says "add" — the other operation*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-2-change-loss_change-operation
*expect: turn · turn_ended: True · 4.9s · audio: 212520 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-2-change-loss_change-solve
*expect: turn · turn_ended: True · 4.9s · audio: 184324 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many shells did Ben drop?

### wrong:wps-2-change-loss_change-solve
*expect: turn · turn_ended: True · 8.4s · audio: 458884 b64 bytes*
*note: student says "sixteen" — the two story numbers combined the wrong way*

> My turn: not sixteen — fourteen minus two equals twelve. Your turn. How many shells did Ben drop?

### right:wps-2-change-loss_change-solve
*expect: turn · turn_ended: True · 5.7s · audio: 288644 b64 bytes*
*note: student says "twelve"*

> Yes, fourteen minus two equals twelve. Ben dropped twelve shells.

### ask:wps-3-part_whole-part-big_number
*expect: turn · turn_ended: True · 12.0s · audio: 672644 b64 bytes*
*note: gesture item (build_family)*

> Listen. There are sixteen stickers. Eleven of them are striped. The rest are spotted. How many stickers are spotted? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-3-part_whole-part-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-3-part_whole-part-big_number
*expect: turn · turn_ended: True · 12.3s · audio: 712964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. All the stickers together is the whole amount. The big number is all the stickers. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-3-part_whole-part-big_number
*expect: turn · turn_ended: True · 6.2s · audio: 318084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is all the stickers — all the stickers together is the whole amount.

### ask:wps-3-part_whole-part-family
*expect: turn · turn_ended: True · 3.7s · audio: 131844 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-3-part_whole-part-family
*expect: turn · turn_ended: True · 12.1s · audio: 690564 b64 bytes*
*note: student says "sixteen plus eleven equals box" — the big number in a small slot — every number present, the family upside down*

> My turn: the big number goes last, after equals. All the stickers is the big number, so the family is eleven plus box equals sixteen. Your turn. Say the family.

### right:wps-3-part_whole-part-family
*expect: turn · turn_ended: True · 4.2s · audio: 190084 b64 bytes*
*note: student says "eleven plus box equals sixteen"*

> Yes, eleven plus box equals sixteen.

### ask:wps-3-part_whole-part-operation
*expect: turn · turn_ended: True · 3.7s · audio: 123524 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-3-part_whole-part-operation
*expect: turn · turn_ended: True · 8.2s · audio: 449284 b64 bytes*
*note: student says "add" — the other operation*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-3-part_whole-part-operation
*expect: turn · turn_ended: True · 4.5s · audio: 212484 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-3-part_whole-part-solve
*expect: turn · turn_ended: True · 5.0s · audio: 193284 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many stickers are spotted?

### wrong:wps-3-part_whole-part-solve
*expect: turn · turn_ended: True · 8.5s · audio: 464004 b64 bytes*
*note: student says "twenty-seven" — the two story numbers combined the wrong way*

> My turn: not twenty-seven — sixteen minus eleven equals five. Your turn. How many stickers are spotted?

### right:wps-3-part_whole-part-solve
*expect: turn · turn_ended: True · 5.8s · audio: 294404 b64 bytes*
*note: student says "five"*

> Yes, sixteen minus eleven equals five. Five stickers are spotted.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 317480 b64 bytes*

> That's the end of our word problems. You set up every one yourself. Great work today!
