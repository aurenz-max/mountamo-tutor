# Tier-3 Live Tutor Report — di-word-problem-setup — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-word-problem-setup", "items": 12, "voice_items": 9, "gesture_items": 3, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `wps-1-change-loss_change-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-1-change-loss_change-family` | voice/build_family | box equals seventeen | ✅ | four plus box equals seventeen | ✅ |
| `wps-1-change-loss_change-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-1-change-loss_change-solve` | voice/build_family | twelve | ✅ | thirteen | ✅ |
| `wps-2-part_whole-whole-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-2-part_whole-whole-family` | voice/build_family | five plus box | ✅ | five plus fifteen equals box | ✅ |
| `wps-2-part_whole-whole-operation` | voice/build_family | subtract | ✅ | add | ✅ |
| `wps-2-part_whole-whole-solve` | voice/build_family | nineteen | ✅ | twenty | ✅ |
| `wps-3-comparison-difference-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-3-comparison-difference-family` | voice/build_family | box equals eleven | ✅ | eight plus box equals eleven | ✅ |
| `wps-3-comparison-difference-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-3-comparison-difference-solve` | voice/build_family | two | ✅ | three | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wps-1-change-loss_change-big_number
*expect: turn · turn_ended: True · 28.9s · audio: 1742760 b64 bytes*
*note: gesture item (build_family)*

> We are going to set up word problems. I read you a story. You put the big number at the end of the arrow with your finger, then you say the family out loud— small plus small equals big, and you say box for the one we do not know— then add or subtract, then how many. Listen. Max had seventeen shells. Then Max dropped some of them. Now Max has four shells. How many shells did Max drop? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-1-change-loss_change-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-1-change-loss_change-big_number
*expect: turn · turn_ended: True · 13.9s · audio: 815364 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Max dropped some, so what Max started with is the whole amount. The big number is what Max started with. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-1-change-loss_change-big_number
*expect: turn · turn_ended: True · 7.7s · audio: 420484 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is what Max started with— Max dropped some, so what Max started with is the whole amount.

### ask:wps-1-change-loss_change-family
*expect: turn · turn_ended: True · 3.3s · audio: 70404 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-1-change-loss_change-family
*expect: turn · turn_ended: True · 10.5s · audio: 601640 b64 bytes*
*note: student says "box equals seventeen"*

> My turn: a family has all three— two small numbers and the big number. Four plus box equals seventeen. Your turn. Say the family.

### right:wps-1-change-loss_change-family
*expect: turn · turn_ended: True · 4.4s · audio: 179204 b64 bytes*
*note: student says "four plus box equals seventeen"*

> Yes, four plus box equals seventeen.

### ask:wps-1-change-loss_change-operation
*expect: turn · turn_ended: True · 3.5s · audio: 96004 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-1-change-loss_change-operation
*expect: turn · turn_ended: True · 7.6s · audio: 411524 b64 bytes*
*note: student says "add"*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-1-change-loss_change-operation
*expect: turn · turn_ended: True · 4.3s · audio: 208004 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-1-change-loss_change-solve
*expect: turn · turn_ended: True · 4.6s · audio: 174084 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many shells did Max drop?

### wrong:wps-1-change-loss_change-solve
*expect: turn · turn_ended: True · 8.0s · audio: 433284 b64 bytes*
*note: student says "twelve"*

> My turn: not twelve — seventeen minus four equals thirteen. Your turn. How many shells did Max drop?

### right:wps-1-change-loss_change-solve
*expect: turn · turn_ended: True · 7.3s · audio: 303400 b64 bytes*
*note: student says "thirteen"*

> Yes, seventeen minus four equals thirteen. Max dropped thirteen shells.

### ask:wps-2-part_whole-whole-big_number
*expect: turn · turn_ended: True · 10.1s · audio: 551720 b64 bytes*
*note: gesture item (build_family)*

> Listen. There are five striped stickers and fifteen spotted stickers. How many stickers are there in all? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-2-part_whole-whole-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-2-part_whole-whole-big_number
*expect: turn · turn_ended: True · 12.3s · audio: 712324 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. All the stickers together is the whole amount. The big number is all the stickers. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-2-part_whole-whole-big_number
*expect: turn · turn_ended: True · 5.9s · audio: 305320 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is all the stickers— all the stickers together is the whole amount.

### ask:wps-2-part_whole-whole-family
*expect: turn · turn_ended: True · 3.5s · audio: 74244 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-2-part_whole-whole-family
*expect: turn · turn_ended: True · 10.0s · audio: 561284 b64 bytes*
*note: student says "five plus box"*

> My turn: a family has all three— two small numbers and the big number. Five plus fifteen equals box. Your turn. Say the family.

### right:wps-2-part_whole-whole-family
*expect: turn · turn_ended: True · 3.9s · audio: 175400 b64 bytes*
*note: student says "five plus fifteen equals box"*

> Yes, five plus fifteen equals box.

### ask:wps-2-part_whole-whole-operation
*expect: turn · turn_ended: True · 3.5s · audio: 112644 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-2-part_whole-whole-operation
*expect: turn · turn_ended: True · 7.9s · audio: 428804 b64 bytes*
*note: student says "subtract"*

> My turn: not subtract — the box is the big number, so we add. Your turn. Add or subtract?

### right:wps-2-part_whole-whole-operation
*expect: turn · turn_ended: True · 4.3s · audio: 201604 b64 bytes*
*note: student says "add"*

> Yes, the box is the big number, so we add.

### ask:wps-2-part_whole-whole-solve
*expect: turn · turn_ended: True · 4.5s · audio: 192644 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many stickers are there in all?

### wrong:wps-2-part_whole-whole-solve
*expect: turn · turn_ended: True · 8.1s · audio: 444164 b64 bytes*
*note: student says "nineteen"*

> My turn: not nineteen — five plus fifteen equals twenty. Your turn. How many stickers are there in all?

### right:wps-2-part_whole-whole-solve
*expect: turn · turn_ended: True · 5.8s · audio: 282244 b64 bytes*
*note: student says "twenty"*

> Yes, five plus fifteen equals twenty. There are twenty stickers in all.

### ask:wps-3-comparison-difference-big_number
*expect: turn · turn_ended: True · 10.9s · audio: 601000 b64 bytes*
*note: gesture item (build_family)*

> Listen. Sam has eleven marbles. Zoe has eight marbles. How many more marbles does Sam have than Zoe? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-3-comparison-difference-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-3-comparison-difference-big_number
*expect: turn · turn_ended: True · 13.7s · audio: 800644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Sam has more than Zoe, so Sam's marbles is the whole amount. The big number is Sam's marbles. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-3-comparison-difference-big_number
*expect: turn · turn_ended: True · 7.7s · audio: 400004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is Sam's marbles— Sam has more than Zoe, so Sam's marbles is the whole amount.

### ask:wps-3-comparison-difference-family
*expect: turn · turn_ended: True · 3.4s · audio: 90884 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-3-comparison-difference-family
*expect: turn · turn_ended: True · 9.9s · audio: 556804 b64 bytes*
*note: student says "box equals eleven"*

> My turn: a family has all three— two small numbers and the big number. Eight plus box equals eleven. Your turn. Say the family.

### right:wps-3-comparison-difference-family
*expect: turn · turn_ended: True · 4.2s · audio: 183080 b64 bytes*
*note: student says "eight plus box equals eleven"*

> Yes, eight plus box equals eleven.

### ask:wps-3-comparison-difference-operation
*expect: turn · turn_ended: True · 3.5s · audio: 117124 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-3-comparison-difference-operation
*expect: turn · turn_ended: True · 9.6s · audio: 537604 b64 bytes*
*note: student says "add"*

> My turn: the story says more, but the family decides. The box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-3-comparison-difference-operation
*expect: turn · turn_ended: True · 4.5s · audio: 218244 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-3-comparison-difference-solve
*expect: turn · turn_ended: True · 5.1s · audio: 231684 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many more marbles does Sam have than Zoe?

### wrong:wps-3-comparison-difference-solve
*expect: turn · turn_ended: True · 8.6s · audio: 467844 b64 bytes*
*note: student says "two"*

> My turn: not two — eleven minus eight equals three. Your turn. How many more marbles does Sam have than Zoe?

### right:wps-3-comparison-difference-solve
*expect: turn · turn_ended: True · 6.3s · audio: 329000 b64 bytes*
*note: student says "three"*

> Yes, eleven minus eight equals three. Sam has three more marbles than Zoe.

### complete
*expect: turn · turn_ended: True · 6.0s · audio: 304644 b64 bytes*

> That's the end of our word problems. You set up every one yourself. Great work today!
