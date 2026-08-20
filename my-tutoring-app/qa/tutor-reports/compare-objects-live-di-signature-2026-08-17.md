# Tier-3 Live Tutor Report — compare-objects — 2026-08-17

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "compare-objects", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 1 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `di-answer-leak-in-ask` | ask:co-2 1/2 (1 beat) | the ask contains the answer "long" outside its stimulus: "Look at the paper strip and the blue crayon. Is the picture showing us how much they hold, how long they are, or play how heavy they are? Say it out loud." |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `co-1` | voice/name-attribute | how much they hold | ✅✅ | how heavy they are | ✅✅ |
| `co-2` | voice/name-attribute | how much they hold | ✅✅ | how long they are | ✅✅ |
| `co-3` | voice/name-attribute | how tall they are | ✅✅ | how much they hold | ✅✅ |
| `co-4` | voice/name-attribute | how heavy they are | ✅✅ | how tall they are | ✅✅ |
| `co-5` | voice/name-attribute | how much they hold | ✅✅ | how heavy they are | ✅✅ |
| `co-6` | voice/name-attribute | how heavy they are | ✅✅ | how tall they are | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:co-1
*expect: turn · turn_ended: True · 15.8s · audio: 915844 b64 bytes*
*note: voice item (name-attribute)*

> Hi! Time to measure and compare! Look at the picture, then say what we can measure. Look at the metal spoon and the wooden block. Is the picture showing us how much they hold, how long they are, or how heavy they are? Say it out loud.

### wrong:co-1
*expect: turn · turn_ended: True · 11.5s · audio: 665640 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how heavy they are. Your turn. Is the picture showing us how much they hold, how long they are, or how heavy they are?

### right:co-1
*expect: turn · turn_ended: True · 4.9s · audio: 238084 b64 bytes*
*note: student says "how heavy they are"*

> Yes, how heavy they are. That is called weight.

### ask:co-2
*expect: turn · turn_ended: True · 10.5s · audio: 556804 b64 bytes*
*note: voice item (name-attribute)*

> Look at the paper strip and the blue crayon. Is the picture showing us how much they hold, how long they are, or how heavy they are? Say it out loud.

### wrong:co-2
*expect: turn · turn_ended: True · 11.7s · audio: 666884 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how long they are. Your turn. Is the picture showing us how much they hold, how long they are, or how heavy they are?

### right:co-2
*expect: turn · turn_ended: True · 4.8s · audio: 224040 b64 bytes*
*note: student says "how long they are"*

> Yes, how long they are. That is called length.

### ask:co-3
*expect: turn · turn_ended: True · 10.1s · audio: 545284 b64 bytes*
*note: voice item (name-attribute)*

> Look at the paper cup and the glass pitcher. Is the picture showing us how much they hold, how tall they are, or how heavy they are? Say it out loud.

### wrong:co-3
*expect: turn · turn_ended: True · 11.6s · audio: 666244 b64 bytes*
*note: student says "how tall they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how much they hold. Your turn. Is the picture showing us how much they hold, how tall they are, or how heavy they are?

### right:co-3
*expect: turn · turn_ended: True · 5.1s · audio: 245764 b64 bytes*
*note: student says "how much they hold"*

> Yes, how much they hold. That is called capacity.

### ask:co-4
*expect: turn · turn_ended: True · 10.1s · audio: 531844 b64 bytes*
*note: voice item (name-attribute)*

> Look at the floor lamp and the desk lamp. Is the picture showing us how heavy they are, how much they hold, or how tall they are? Say it out loud.

### wrong:co-4
*expect: turn · turn_ended: True · 11.4s · audio: 648324 b64 bytes*
*note: student says "how heavy they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how tall they are. Your turn. Is the picture showing us how heavy they are, how much they hold, or how tall they are?

### right:co-4
*expect: turn · turn_ended: True · 4.8s · audio: 224040 b64 bytes*
*note: student says "how tall they are"*

> Yes, how tall they are. That is called height.

### ask:co-5
*expect: turn · turn_ended: True · 10.5s · audio: 577284 b64 bytes*
*note: voice item (name-attribute)*

> Look at the rubber eraser and the science textbook. Is the picture showing us how much they hold, how heavy they are, or how long they are? Say it out loud.

### wrong:co-5
*expect: turn · turn_ended: True · 12.1s · audio: 679684 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how heavy they are. Your turn. Is the picture showing us how much they hold, how heavy they are, or how long they are?

### right:co-5
*expect: turn · turn_ended: True · 4.8s · audio: 225284 b64 bytes*
*note: student says "how heavy they are"*

> Yes, how heavy they are. That is called weight.

### ask:co-6
*expect: turn · turn_ended: True · 9.8s · audio: 531204 b64 bytes*
*note: voice item (name-attribute)*

> Look at the water bottle and the coffee mug. Is the picture showing us how tall they are, how heavy they are, or how much they hold? Say it out loud.

### wrong:co-6
*expect: turn · turn_ended: True · 11.7s · audio: 649604 b64 bytes*
*note: student says "how heavy they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how tall they are. Your turn. Is the picture showing us how tall they are, how heavy they are, or how much they hold?

### right:co-6
*expect: turn · turn_ended: True · 5.0s · audio: 220164 b64 bytes*
*note: student says "how tall they are"*

> Yes, how tall they are. That is called height.

### complete
*expect: turn · turn_ended: True · 10.3s · audio: 577284 b64 bytes*

> What great measuring today! You compared,


## Run 2 — beat-by-beat transcript

### ask:co-1
*expect: turn · turn_ended: True · 16.6s · audio: 970280 b64 bytes*
*note: voice item (name-attribute)*

> Hi! Time to measure and compare! Look at the picture, then say what we can measure. Look at the metal spoon and the wooden block. Is the picture showing us how much they hold, how long they are, or how heavy they are? Say it out loud.

### wrong:co-1
*expect: turn · turn_ended: True · 11.8s · audio: 677764 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how heavy they are. Your turn. Is the picture showing us how much they hold, how long they are, or how heavy they are?

### right:co-1
*expect: turn · turn_ended: True · 4.7s · audio: 211844 b64 bytes*
*note: student says "how heavy they are"*

> Yes, how heavy they are. That is called weight.

### ask:co-2
*expect: turn · turn_ended: True · 10.3s · audio: 566404 b64 bytes*
*note: voice item (name-attribute)*

> Look at the paper strip and the blue crayon. Is the picture showing us how much they hold, how long they are, or play how heavy they are? Say it out loud.

### wrong:co-2
*expect: turn · turn_ended: True · 11.6s · audio: 655400 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how long they are. Your turn. Is the picture showing us how much they hold, how long they are, or how heavy they are?

### right:co-2
*expect: turn · turn_ended: True · 4.8s · audio: 201604 b64 bytes*
*note: student says "how long they are"*

> Yes, how long they are. That is called length.

### ask:co-3
*expect: turn · turn_ended: True · 10.4s · audio: 539524 b64 bytes*
*note: voice item (name-attribute)*

> Look at the paper cup and the glass pitcher. Is the picture showing us how much they hold, how tall they are, or how heavy they are? Say it out loud.

### wrong:co-3
*expect: turn · turn_ended: True · 11.2s · audio: 644484 b64 bytes*
*note: student says "how tall they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how much they hold. Your turn. Is the picture showing us how much they hold, how tall they are, or how heavy they are?

### right:co-3
*expect: turn · turn_ended: True · 4.8s · audio: 224644 b64 bytes*
*note: student says "how much they hold"*

> Yes, how much they hold. That is called capacity.

### ask:co-4
*expect: turn · turn_ended: True · 10.2s · audio: 558724 b64 bytes*
*note: voice item (name-attribute)*

> Look at the floor lamp and the desk lamp. Is the picture showing us how heavy they are, how much they hold, or how tall they are? Say it out loud.

### wrong:co-4
*expect: turn · turn_ended: True · 11.7s · audio: 654724 b64 bytes*
*note: student says "how heavy they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how tall they are. Your turn. Is the picture showing us how heavy they are, how much they hold, or how tall they are?

### right:co-4
*expect: turn · turn_ended: True · 4.5s · audio: 209960 b64 bytes*
*note: student says "how tall they are"*

> Yes, how tall they are. That is called height.

### ask:co-5
*expect: turn · turn_ended: True · 10.6s · audio: 583684 b64 bytes*
*note: voice item (name-attribute)*

> Look at the rubber eraser and the science textbook. Is the picture showing us how much they hold, how heavy they are, or how long they are? Say it out loud.

### wrong:co-5
*expect: turn · turn_ended: True · 11.4s · audio: 642564 b64 bytes*
*note: student says "how much they hold" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how heavy they are. Your turn. Is the picture showing us how much they hold, how heavy they are, or how long they are?

### right:co-5
*expect: turn · turn_ended: True · 4.4s · audio: 200964 b64 bytes*
*note: student says "how heavy they are"*

> Yes, how heavy they are. That is called weight.

### ask:co-6
*expect: turn · turn_ended: True · 10.5s · audio: 558084 b64 bytes*
*note: voice item (name-attribute)*

> Look at the water bottle and the coffee mug. Is the picture showing us how tall they are, how heavy they are, or how much they hold? Say it out loud.

### wrong:co-6
*expect: turn · turn_ended: True · 11.6s · audio: 664324 b64 bytes*
*note: student says "how heavy they are" — another attribute that is true of the objects but is not the one the picture draws*

> My turn: look at the picture again — it shows us how tall they are. Your turn. Is the picture showing us how tall they are, how heavy they are, or how much they hold?

### right:co-6
*expect: turn · turn_ended: True · 4.7s · audio: 215684 b64 bytes*
*note: student says "how tall they are"*

> Yes, how tall they are. That is called height.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 414760 b64 bytes*

> What great measuring today! You compared,
