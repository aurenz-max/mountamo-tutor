# Tier-3 Live Tutor Report — syllable-clapper — 2026-09-11

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "syllable-clapper", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `c1` | voice/blend_syllables | table | ✅ | monkey | ✅ |
| `c2` | voice/blend_syllables | table | ✅ | zebra | ✅ |
| `c3` | voice/blend_syllables | table | ✅ | rabbit | ✅ |
| `c4` | voice/blend_syllables | table | ✅ | penguin | ✅ |
| `c5` | voice/blend_syllables | table | ✅ | turtle | ✅ |
| `c6` | voice/blend_syllables | table | ✅ | dolphin | ✅ |
| `c7` | voice/blend_syllables | table | ✅ | kangaroo | ✅ |
| `c8` | voice/blend_syllables | table | ✅ | ladybug | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 20.3s · audio: 1189764 b64 bytes*
*note: voice item (blend_syllables)*

> Hi! Words are made of parts, and we can put them back together! Watch me first: pen … cil. That is pencil. Listen: mon … key. Again: mon … key. Your turn. Put the parts together. What word is that?

### wrong:c1
*expect: turn · turn_ended: True · 10.0s · audio: 508804 b64 bytes*
*note: student says "table"*

> My turn: mon … key. Monkey. Your turn. Put the parts together. What word is that?

### right:c1
*expect: turn · turn_ended: True · 3.3s · audio: 102404 b64 bytes*
*note: student says "monkey"*

> Yes, monkey.

### ask:c2
*expect: turn · turn_ended: True · 11.3s · audio: 610564 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: ze … bra. Again: ze … bra. Your turn. Put the parts together. What word is that?

### wrong:c2
*expect: turn · turn_ended: True · 9.4s · audio: 518404 b64 bytes*
*note: student says "table"*

> My turn: ze … bra. Zebra. Your turn. Put the parts together. What word is that?

### right:c2
*expect: turn · turn_ended: True · 3.8s · audio: 108804 b64 bytes*
*note: student says "zebra"*

> Yes, zebra.

### ask:c3
*expect: turn · turn_ended: True · 11.5s · audio: 632324 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: rab … bit. Again: rab … bit. Your turn. Put the parts together. What word is that?

### wrong:c3
*expect: turn · turn_ended: True · 9.5s · audio: 519044 b64 bytes*
*note: student says "table"*

> My turn: rab … bit. Rabbit. Your turn. Put the parts together. What word is that?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 104360 b64 bytes*
*note: student says "rabbit"*

> Yes, rabbit.

### ask:c4
*expect: turn · turn_ended: True · 12.6s · audio: 692484 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: pen … guin. Again: pen … guin. Your turn. Put the parts together. What word is that?

### wrong:c4
*expect: turn · turn_ended: True · 10.0s · audio: 558084 b64 bytes*
*note: student says "table"*

> My turn: pen … guin. Penguin. Your turn. Put the parts together. What word is that?

### right:c4
*expect: turn · turn_ended: True · 3.3s · audio: 100484 b64 bytes*
*note: student says "penguin"*

> Yes, penguin.

### ask:c5
*expect: turn · turn_ended: True · 12.1s · audio: 663044 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: tur … tle. Again: tur … tle. Your turn. Put the parts together. What word is that?

### wrong:c5
*expect: turn · turn_ended: True · 9.8s · audio: 549764 b64 bytes*
*note: student says "table"*

> My turn: tur … tle. Turtle. Your turn. Put the parts together. What word is that?

### right:c5
*expect: turn · turn_ended: True · 3.5s · audio: 126084 b64 bytes*
*note: student says "turtle"*

> Yes, turtle.

### ask:c6
*expect: turn · turn_ended: True · 12.7s · audio: 708520 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: dol … phin. Again: dol … phin. Your turn. Put the parts together. What word is that?

### wrong:c6
*expect: turn · turn_ended: True · 11.0s · audio: 618920 b64 bytes*
*note: student says "table"*

> My turn: dol … phin. Dolphin. Your turn. Put the parts together. What word is that?

### right:c6
*expect: turn · turn_ended: True · 3.4s · audio: 131880 b64 bytes*
*note: student says "dolphin"*

> Yes, dolphin.

### ask:c7
*expect: turn · turn_ended: True · 14.6s · audio: 813444 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: kan … ga … roo. Again: kan … ga … roo. Your turn. Put the parts together. What word is that?

### wrong:c7
*expect: turn · turn_ended: True · 11.3s · audio: 645124 b64 bytes*
*note: student says "table"*

> My turn: kan … ga … roo. Kangaroo. Your turn. Put the parts together. What word is that?

### right:c7
*expect: turn · turn_ended: True · 3.5s · audio: 148484 b64 bytes*
*note: student says "kangaroo"*

> Yes, kangaroo.

### ask:c8
*expect: turn · turn_ended: True · 15.7s · audio: 810244 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: la … dy … bug. Again: la … dy … bug. Your turn. Put the parts together. What word is that?

### wrong:c8
*expect: turn · turn_ended: True · 11.5s · audio: 638084 b64 bytes*
*note: student says "table"*

> My turn: la … dy … bug. Ladybug. Your turn. Put the parts together. What word is that?

### right:c8
*expect: turn · turn_ended: True · 3.3s · audio: 108804 b64 bytes*
*note: student says "ladybug"*

> Yes, ladybug.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 349444 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
