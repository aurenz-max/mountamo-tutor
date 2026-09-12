# Tier-3 Live Tutor Report — syllable-clapper — 2026-09-12

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
| `c1` | voice/count_parts | three | ✅ | one | ✅ |
| `c2` | voice/count_parts | one | ✅ | two | ✅ |
| `c3` | voice/count_parts | one | ✅ | two | ✅ |
| `c4` | voice/count_parts | one | ✅ | two | ✅ |
| `c5` | voice/count_parts | one | ✅ | two | ✅ |
| `c6` | voice/count_parts | one | ✅ | two | ✅ |
| `c7` | voice/count_parts | one | ✅ | two | ✅ |
| `c8` | voice/count_parts | three | ✅ | one | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 20.4s · audio: 1203844 b64 bytes*
*note: voice item (count_parts)*

> Hi! Words are made of parts, and we can hear them! Watch me first: pencil. Pen … cil. That is two parts. Listen: duck. Again, slowly: duck. Your turn. Clap the parts with your hands, then tell me how many parts in duck.

### wrong:c1
*expect: turn · turn_ended: True · 7.7s · audio: 416644 b64 bytes*
*note: student says "three"*

> My turn: duck. Duck. One part. Your turn. How many parts in duck?

### right:c1
*expect: turn · turn_ended: True · 3.2s · audio: 111364 b64 bytes*
*note: student says "one"*

> Yes, one part.

### ask:c2
*expect: turn · turn_ended: True · 11.1s · audio: 619560 b64 bytes*
*note: voice item (count_parts)*

> Listen: piglet. Again, slowly: piglet. Your turn. Clap the parts with your hands, then tell me how many parts in piglet.

### wrong:c2
*expect: turn · turn_ended: True · 9.5s · audio: 506884 b64 bytes*
*note: student says "one"*

> My turn: piglet. Pig … let. Two parts. Your turn. How many parts in piglet?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 122244 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c3
*expect: turn · turn_ended: True · 11.6s · audio: 616964 b64 bytes*
*note: voice item (count_parts)*

> Listen: rooster. Again, slowly: rooster. Your turn. Clap the parts with your hands, then tell me how many parts in rooster.

### wrong:c3
*expect: turn · turn_ended: True · 9.0s · audio: 505604 b64 bytes*
*note: student says "one"*

> My turn: rooster. Roos … ter. Two parts. Your turn. How many parts in rooster?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 116520 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c4
*expect: turn · turn_ended: True · 11.7s · audio: 597124 b64 bytes*
*note: voice item (count_parts)*

> Listen: donkey. Again, slowly: donkey. Your turn. Clap the parts with your hands, then tell me how many parts in donkey.

### wrong:c4
*expect: turn · turn_ended: True · 9.0s · audio: 496644 b64 bytes*
*note: student says "one"*

> My turn: donkey. Don … key. Two parts. Your turn. How many parts in donkey?

### right:c4
*expect: turn · turn_ended: True · 3.5s · audio: 113924 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c5
*expect: turn · turn_ended: True · 11.2s · audio: 618244 b64 bytes*
*note: voice item (count_parts)*

> Listen: turkey. Again, slowly: turkey. Your turn. Clap the parts with your hands, then tell me how many parts in turkey.

### wrong:c5
*expect: turn · turn_ended: True · 8.8s · audio: 487684 b64 bytes*
*note: student says "one"*

> My turn: turkey. Tur … key. Two parts. Your turn. How many parts in turkey?

### right:c5
*expect: turn · turn_ended: True · 3.9s · audio: 112004 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c6
*expect: turn · turn_ended: True · 10.8s · audio: 597800 b64 bytes*
*note: voice item (count_parts)*

> Listen: pony. Again, slowly: pony. Your turn. Clap the parts with your hands, then tell me how many parts in pony.

### wrong:c6
*expect: turn · turn_ended: True · 9.2s · audio: 516484 b64 bytes*
*note: student says "one"*

> My turn: pony. Po … ny. Two parts. Your turn. How many parts in pony?

### right:c6
*expect: turn · turn_ended: True · 3.1s · audio: 111364 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c7
*expect: turn · turn_ended: True · 11.0s · audio: 600324 b64 bytes*
*note: voice item (count_parts)*

> Listen: chicken. Again, slowly: chicken. Your turn. Clap the parts with your hands, then tell me how many parts in chicken.

### wrong:c7
*expect: turn · turn_ended: True · 9.1s · audio: 504324 b64 bytes*
*note: student says "one"*

> My turn: chicken. Chick … en. Two parts. Your turn. How many parts in chicken?

### right:c7
*expect: turn · turn_ended: True · 3.5s · audio: 138884 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c8
*expect: turn · turn_ended: True · 11.2s · audio: 624680 b64 bytes*
*note: voice item (count_parts)*

> Listen: horse. Again, slowly: horse. Your turn. Clap the parts with your hands, then tell me how many parts in horse.

### wrong:c8
*expect: turn · turn_ended: True · 9.1s · audio: 470404 b64 bytes*
*note: student says "three"*

> My turn: horse. Horse. One part. Your turn. How many parts in horse?

### right:c8
*expect: turn · turn_ended: True · 3.3s · audio: 103684 b64 bytes*
*note: student says "one"*

> Yes, one part.

### complete
*expect: turn · turn_ended: True · 7.2s · audio: 366084 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
