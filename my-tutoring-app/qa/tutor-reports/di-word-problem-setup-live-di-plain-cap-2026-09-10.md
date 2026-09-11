# Tier-3 Live Tutor Report — di-word-problem-setup — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-word-problem-setup", "items": 12, "voice_items": 9, "gesture_items": 3, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "wps-1-part_whole-part-family", "grade": "Grade 2", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:wps-1-part_whole-part-family 1/1, wrong3:wps-1-part_whole-part-family 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `wps-1-part_whole-part-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-1-part_whole-part-family` | voice/build_family | box equals thirteen | ✅✅✅ | - | n/a |
| `wps-1-part_whole-part-operation` | voice/build_family | add | ✅ | subtract | ✅ |
| `wps-1-part_whole-part-solve` | voice/build_family | nine | ✅ | ten | ✅ |
| `wps-2-comparison-more_person-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-2-comparison-more_person-family` | voice/build_family | sixteen plus box | ✅ | sixteen plus three equals box | ✅ |
| `wps-2-comparison-more_person-operation` | voice/build_family | subtract | ✅ | add | ✅ |
| `wps-2-comparison-more_person-solve` | voice/build_family | eighteen | ✅ | nineteen | ✅ |
| `wps-3-change-gain_end-big_number` | gesture/build_family | (placement) | ✅ | (placement) | ✅ |
| `wps-3-change-gain_end-family` | voice/build_family | twelve plus box | ✅ | twelve plus six equals box | ✅ |
| `wps-3-change-gain_end-operation` | voice/build_family | subtract | ✅ | add | ✅ |
| `wps-3-change-gain_end-solve` | voice/build_family | seventeen | ✅ | eighteen | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wps-1-part_whole-part-big_number
*expect: turn · turn_ended: True · 26.4s · audio: 1582084 b64 bytes*
*note: gesture item (build_family)*

> We are going to set up word problems. I read you a story. You put the big number at the end of the arrow with your finger, then you say the family out loud — small plus small equals big, and you say box for the one we do not know — then add or subtract, then how many. Listen. There are thirteen shells. Three of them are red. The rest are blue. How many shells are blue? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-1-part_whole-part-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-1-part_whole-part-big_number
*expect: turn · turn_ended: True · 13.5s · audio: 776964 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. All the shells together is the whole amount. Maximum number is all the shells. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-1-part_whole-part-big_number
*expect: turn · turn_ended: True · 6.1s · audio: 314884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is all the shells — all the shells together is the whole amount.

### ask:wps-1-part_whole-part-family
*expect: turn · turn_ended: True · 3.4s · audio: 89640 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong1:wps-1-part_whole-part-family
*expect: turn · turn_ended: True · 10.6s · audio: 600964 b64 bytes*
*note: student says "box equals thirteen"*

> My turn: a family has all three — two small numbers and the big number. Three plus box equals thirteen. Your turn. Say the family.

### wrong2:wps-1-part_whole-part-family
*expect: turn · turn_ended: True · 10.2s · audio: 574724 b64 bytes*
*note: student says "box equals thirteen"*

> My turn: a family has all three — two small numbers and the big number. Three plus box equals thirteen. Your turn. Say the family.

### wrong3:wps-1-part_whole-part-family
*expect: turn · turn_ended: True · 10.2s · audio: 576004 b64 bytes*
*note: student says "box equals thirteen"*

> My turn: a family has all three — two small numbers and the big number. Three plus box equals thirteen. Your turn. Say the family.

### moveon:wps-1-part_whole-part-family
*expect: turn · turn_ended: True · 6.3s · audio: 309764 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try. Three plus box equals thirteen. Do you add or subtract?

### wrong:wps-1-part_whole-part-operation
*expect: turn · turn_ended: True · 7.7s · audio: 418564 b64 bytes*
*note: student says "add"*

> My turn: not add — the box is a small number, so we subtract. Your turn. Add or subtract?

### right:wps-1-part_whole-part-operation
*expect: turn · turn_ended: True · 4.6s · audio: 222084 b64 bytes*
*note: student says "subtract"*

> Yes, the box is a small number, so we subtract.

### ask:wps-1-part_whole-part-solve
*expect: turn · turn_ended: True · 4.4s · audio: 181764 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many shells are blue?

### wrong:wps-1-part_whole-part-solve
*expect: turn · turn_ended: True · 7.9s · audio: 429444 b64 bytes*
*note: student says "nine"*

> My turn: not nine — thirteen minus three equals ten. Your turn. How many shells are blue?

### right:wps-1-part_whole-part-solve
*expect: turn · turn_ended: True · 5.6s · audio: 277124 b64 bytes*
*note: student says "ten"*

> Yes, thirteen minus three equals ten. Ten shells are blue.

### ask:wps-2-comparison-more_person-big_number
*expect: turn · turn_ended: True · 12.1s · audio: 679684 b64 bytes*
*note: gesture item (build_family)*

> Listen. Leo has sixteen stickers. Mia has three more stickers than Leo. How many stickers does Mia have? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-2-comparison-more_person-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-2-comparison-more_person-big_number
*expect: turn · turn_ended: True · 14.8s · audio: 867844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Mia has more than Leo, so Mia's stickers is the whole amount. The big number is Mia's stickers. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-2-comparison-more_person-big_number
*expect: turn · turn_ended: True · 7.7s · audio: 408324 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is Mia's stickers — Mia has more than Leo, so Mia's stickers is the whole amount.

### ask:wps-2-comparison-more_person-family
*expect: turn · turn_ended: True · 3.5s · audio: 88964 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-2-comparison-more_person-family
*expect: turn · turn_ended: True · 10.2s · audio: 572804 b64 bytes*
*note: student says "sixteen plus box"*

> My turn: a family has all three — two small numbers and the big number. Sixteen plus three equals box. Your turn. Say the family.

### right:wps-2-comparison-more_person-family
*expect: turn · turn_ended: True · 4.2s · audio: 190120 b64 bytes*
*note: student says "sixteen plus three equals box"*

> Yes, sixteen plus three equals box.

### ask:wps-2-comparison-more_person-operation
*expect: turn · turn_ended: True · 3.7s · audio: 120324 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-2-comparison-more_person-operation
*expect: turn · turn_ended: True · 7.9s · audio: 428164 b64 bytes*
*note: student says "subtract"*

> My turn: not subtract — the box is the big number, so we add. Your turn. Add or subtract?

### right:wps-2-comparison-more_person-operation
*expect: turn · turn_ended: True · 4.3s · audio: 200964 b64 bytes*
*note: student says "add"*

> Yes, the box is the big number, so we add.

### ask:wps-2-comparison-more_person-solve
*expect: turn · turn_ended: True · 5.2s · audio: 215080 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many stickers does Mia have?

### wrong:wps-2-comparison-more_person-solve
*expect: turn · turn_ended: True · 8.5s · audio: 457604 b64 bytes*
*note: student says "eighteen"*

> My turn: not eighteen — sixteen plus three equals nineteen. Your turn. How many stickers does Mia have?

### right:wps-2-comparison-more_person-solve
*expect: turn · turn_ended: True · 6.1s · audio: 312324 b64 bytes*
*note: student says "nineteen"*

> Yes, sixteen plus three equals nineteen. Mia has nineteen stickers.

### ask:wps-3-change-gain_end-big_number
*expect: turn · turn_ended: True · 11.5s · audio: 634244 b64 bytes*
*note: gesture item (build_family)*

> Listen. Sam had twelve marbles. Then Sam won six more. How many marbles does Sam have now? Which is the big number? Put it at the end of the arrow.

### hands-hold:wps-3-change-gain_end-big_number
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:wps-3-change-gain_end-big_number
*expect: turn · turn_ended: True · 15.2s · audio: 896004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the big number is the whole amount, the one that has it all. Sam won more, so what Sam has now is the whole amount. The big number is what Sam has now. Your turn. Put the big number at the end of the arrow.

### commit-right:wps-3-change-gain_end-big_number
*expect: turn · turn_ended: True · 7.6s · audio: 406404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, the big number is what Sam has now — Sam won more, so what Sam has now is the whole amount.

### ask:wps-3-change-gain_end-family
*expect: turn · turn_ended: True · 3.5s · audio: 90920 b64 bytes*
*note: voice item (build_family)*

> Say the family.

### wrong:wps-3-change-gain_end-family
*expect: turn · turn_ended: True · 10.0s · audio: 556164 b64 bytes*
*note: student says "twelve plus box"*

> My turn: a family has all three — two small numbers and the big number. Twelve plus six equals box. Your turn. Say the family.

### right:wps-3-change-gain_end-family
*expect: turn · turn_ended: True · 4.1s · audio: 181764 b64 bytes*
*note: student says "twelve plus six equals box"*

> Yes, twelve plus six equals box.

### ask:wps-3-change-gain_end-operation
*expect: turn · turn_ended: True · 3.6s · audio: 135720 b64 bytes*
*note: voice item (build_family)*

> Do you add or subtract?

### wrong:wps-3-change-gain_end-operation
*expect: turn · turn_ended: True · 8.1s · audio: 439684 b64 bytes*
*note: student says "subtract"*

> My turn: not subtract — the box is the big number, so we add. Your turn. Add or subtract?

### right:wps-3-change-gain_end-operation
*expect: turn · turn_ended: True · 4.4s · audio: 198404 b64 bytes*
*note: student says "add"*

> Yes, the box is the big number, so we add.

### ask:wps-3-change-gain_end-solve
*expect: turn · turn_ended: True · 4.8s · audio: 208644 b64 bytes*
*note: voice item (build_family)*

> Now work it. How many marbles does Sam have now?

### wrong:wps-3-change-gain_end-solve
*expect: turn · turn_ended: True · 8.4s · audio: 462084 b64 bytes*
*note: student says "seventeen"*

> My turn: not seventeen — twelve plus six equals eighteen. My turn. How many marbles does Sam have now?

### right:wps-3-change-gain_end-solve
*expect: turn · turn_ended: True · 6.0s · audio: 304680 b64 bytes*
*note: student says "eighteen"*

> Yes, twelve plus six equals eighteen. Sam has eighteen marbles now.

### complete
*expect: turn · turn_ended: True · 6.3s · audio: 323204 b64 bytes*

> That's the end of our word problems. You set up every one yourself. Great work today!
