# Tier-3 Live Tutor Report — sorting-station — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "sorting-station", "items": 10, "voice_items": 10, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "c1::obj1", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1::obj1 1/1, wrong3:c1::obj1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1::obj1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1::obj1` | voice/sort | Liquid | ✅✅✅ | - | n/a |
| `c1::obj2` | voice/sort | Solid | ✅ | Liquid | ✅ |
| `c1::obj3` | voice/sort | Solid | ✅ | Gas | ✅ |
| `c1::obj4` | voice/sort | Liquid | ✅ | Solid | ✅ |
| `c1::obj5` | voice/sort | Solid | ✅ | Liquid | ✅ |
| `c2::obj7` | voice/sort | Liquid | ✅ | Solid | ✅ |
| `c2::obj8` | voice/sort | Solid | ✅ | Liquid | ✅ |
| `c2::obj9` | voice/sort | Solid | ✅ | Gas | ✅ |
| `c2::obj10` | voice/sort | Liquid | ✅ | Solid | ✅ |
| `c2::obj11` | voice/sort | Solid | ✅ | Liquid | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:c1::obj1
*expect: turn · turn_ended: True · 16.0s · audio: 913928 b64 bytes*
*note: voice item (sort)*

> Hi! Let us sort some things together! I will say one thing at a time, and you tell me which group it belongs with. Think about what kind of thing it is. Your turn. Listen: Wooden Block. Solid, Liquid, or Gas?

### wrong1:c1::obj1
*expect: turn · turn_ended: True · 7.4s · audio: 373124 b64 bytes*
*note: student says "Liquid"*

> My turn: Wooden Block goes with Solid. Your turn. Where does Wooden Block go?

### wrong2:c1::obj1
*expect: turn · turn_ended: True · 7.2s · audio: 360964 b64 bytes*
*note: student says "Liquid"*

> My turn: Wooden Block goes with Solid. Your turn. Where does Wooden Block go?

### wrong3:c1::obj1
*expect: turn · turn_ended: True · 6.4s · audio: 326404 b64 bytes*
*note: student says "Liquid"*

> My turn: Wooden Block goes with Solid. Your turn. Where does Wooden Block go?

### moveon:c1::obj1
*expect: turn · turn_ended: True · 10.0s · audio: 521604 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. Listen: Drinking Water. Solid, Liquid, or Gas?

### wrong:c1::obj2
*expect: turn · turn_ended: True · 7.1s · audio: 362244 b64 bytes*
*note: student says "Solid"*

> My turn: Drinking Water goes with Liquid. Your turn. Where does Drinking Water go?

### right:c1::obj2
*expect: turn · turn_ended: True · 4.4s · audio: 184964 b64 bytes*
*note: student says "Liquid"*

> Yes, Drinking Water goes with Liquid.

### ask:c1::obj3
*expect: turn · turn_ended: True · 7.7s · audio: 364804 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Helium Balloon Air. Solid, Liquid, or Gas?

### wrong:c1::obj3
*expect: turn · turn_ended: True · 8.2s · audio: 416644 b64 bytes*
*note: student says "Solid"*

> My turn: Helium Balloon Air goes with Gas. Your turn. Where does Helium Balloon Air go?

### right:c1::obj3
*expect: turn · turn_ended: True · 4.5s · audio: 193960 b64 bytes*
*note: student says "Gas"*

> Yes, Helium Balloon Air goes with Gas.

### ask:c1::obj4
*expect: turn · turn_ended: True · 7.3s · audio: 346884 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Metal Spoon. Solid, Liquid, or Gas?

### wrong:c1::obj4
*expect: turn · turn_ended: True · 7.0s · audio: 357764 b64 bytes*
*note: student says "Liquid"*

> My turn: Metal Spoon goes with Solid. Your turn. Where does Metal Spoon go?

### right:c1::obj4
*expect: turn · turn_ended: True · 4.8s · audio: 169604 b64 bytes*
*note: student says "Solid"*

> Yes, Metal Spoon goes with Solid.

### ask:c1::obj5
*expect: turn · turn_ended: True · 7.6s · audio: 332808 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Apple Juice. Solid, Liquid, or Gas?

### wrong:c1::obj5
*expect: turn · turn_ended: True · 7.0s · audio: 358404 b64 bytes*
*note: student says "Solid"*

> My turn: Apple Juice goes with Liquid. Your turn. Where does Apple Juice go?

### right:c1::obj5
*expect: turn · turn_ended: True · 4.0s · audio: 160644 b64 bytes*
*note: student says "Liquid"*

> Yes, Apple Juice goes with Liquid.

### ask:c2::obj7
*expect: turn · turn_ended: True · 6.7s · audio: 327044 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Ice Cube. Solid, Liquid, or Gas?

### wrong:c2::obj7
*expect: turn · turn_ended: True · 6.9s · audio: 343048 b64 bytes*
*note: student says "Liquid"*

> My turn: Ice Cube goes with Solid. Your turn. Where does Ice Cube go?

### right:c2::obj7
*expect: turn · turn_ended: True · 3.8s · audio: 157444 b64 bytes*
*note: student says "Solid"*

> Yes, Ice Cube goes with Solid.

### ask:c2::obj8
*expect: turn · turn_ended: True · 6.7s · audio: 321284 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Milk. Solid, Liquid, or Gas?

### wrong:c2::obj8
*expect: turn · turn_ended: True · 6.3s · audio: 308484 b64 bytes*
*note: student says "Solid"*

> My turn: Milk goes with Liquid. Your turn. Where does Milk go?

### right:c2::obj8
*expect: turn · turn_ended: True · 3.6s · audio: 143364 b64 bytes*
*note: student says "Liquid"*

> Yes, Milk goes with Liquid.

### ask:c2::obj9
*expect: turn · turn_ended: True · 6.9s · audio: 328964 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Cloud Air. Solid, Liquid, or Gas?

### wrong:c2::obj9
*expect: turn · turn_ended: True · 6.9s · audio: 346884 b64 bytes*
*note: student says "Solid"*

> My turn: Cloud Air goes with Gas. Your turn. Where does Cloud Air go?

### right:c2::obj9
*expect: turn · turn_ended: True · 3.8s · audio: 155524 b64 bytes*
*note: student says "Gas"*

> Yes, Cloud Air goes with Gas.

### ask:c2::obj10
*expect: turn · turn_ended: True · 7.1s · audio: 323844 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Rock. Solid, Liquid, or Gas?

### wrong:c2::obj10
*expect: turn · turn_ended: True · 6.6s · audio: 330280 b64 bytes*
*note: student says "Liquid"*

> My turn: Rock goes with Solid. Your turn. Where does Rock go?

### right:c2::obj10
*expect: turn · turn_ended: True · 3.6s · audio: 143364 b64 bytes*
*note: student says "Solid"*

> Yes, Rock goes with Solid.

### ask:c2::obj11
*expect: turn · turn_ended: True · 7.2s · audio: 343684 b64 bytes*
*note: voice item (sort)*

> Your turn. Listen: Raindrop. Solid, Liquid, or Gas?

### wrong:c2::obj11
*expect: turn · turn_ended: True · 6.8s · audio: 348200 b64 bytes*
*note: student says "Solid"*

> My turn: Raindrop goes with Liquid. Your turn. Where does Raindrop go?

### right:c2::obj11
*expect: turn · turn_ended: True · 4.4s · audio: 152964 b64 bytes*
*note: student says "Liquid"*

> Yes, Raindrop goes with Liquid.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 301444 b64 bytes*

> Great sorting today! You told me every one out loud. See you next time!
