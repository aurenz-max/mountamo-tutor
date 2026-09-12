# Tier-3 Live Tutor Report — syllable-clapper — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "syllable-clapper", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `c1` | voice/delete_compound | starfish | ✅ | fish | ✅ |
| `c2` | voice/delete_compound | bluebird | ✅ | bird | ✅ |
| `c3` | voice/delete_compound | ladybug | ✅ | bug | ✅ |
| `c4` | voice/delete_compound | dragonfly | ✅ | fly | ✅ |
| `c5` | voice/delete_compound | honeybee | ✅ | bee | ✅ |
| `c6` | voice/delete_compound | birdhouse | ✅ | house | ✅ |
| `c7` | voice/delete_compound | cowboy | ✅ | boy | ✅ |
| `c8` | voice/delete_compound | catfish | ✅ | fish | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 17.4s · audio: 1025284 b64 bytes*
*note: voice item (delete_compound)*

> Hi! Words are made of parts, and we can take one away! Watch me first: sunhat without sun is hat. Listen: starfish. Again, slowly: starfish. Your turn. Say starfish without star.

### wrong:c1
*expect: turn · turn_ended: True · 8.5s · audio: 468488 b64 bytes*
*note: student says "starfish" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: starfish without star is fish. Your turn. Say starfish without star.

### right:c1
*expect: turn · turn_ended: True · 3.4s · audio: 106280 b64 bytes*
*note: student says "fish"*

> Yes, fish.

### ask:c2
*expect: turn · turn_ended: True · 9.6s · audio: 500484 b64 bytes*
*note: voice item (delete_compound)*

> Listen: bluebird. Again, slowly: bluebird. Your turn. Say bluebird without blue.

### wrong:c2
*expect: turn · turn_ended: True · 8.0s · audio: 436484 b64 bytes*
*note: student says "bluebird" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: bluebird without blue is bird. Your turn. Say bluebird without blue.

### right:c2
*expect: turn · turn_ended: True · 3.2s · audio: 94760 b64 bytes*
*note: student says "bird"*

> Yes, bird.

### ask:c3
*expect: turn · turn_ended: True · 10.3s · audio: 515240 b64 bytes*
*note: voice item (delete_compound)*

> Listen: ladybug. Again, slowly: ladybug. Your turn. Say ladybug without lady.

### wrong:c3
*expect: turn · turn_ended: True · 8.5s · audio: 440964 b64 bytes*
*note: student says "ladybug" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: ladybug without lady is bug. Your turn. Say ladybug without lady.

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 92840 b64 bytes*
*note: student says "bug"*

> Yes, bug.

### ask:c4
*expect: turn · turn_ended: True · 11.3s · audio: 542084 b64 bytes*
*note: voice item (delete_compound)*

> Listen: dragonfly. Again, slowly: dragonfly. Your turn. Say dragonfly without dragon.

### wrong:c4
*expect: turn · turn_ended: True · 9.0s · audio: 455688 b64 bytes*
*note: student says "dragonfly" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: dragonfly without dragon is fly. Your turn. Say dragonfly without dragon.

### right:c4
*expect: turn · turn_ended: True · 4.4s · audio: 92164 b64 bytes*
*note: student says "fly"*

> Yes, fly.

### ask:c5
*expect: turn · turn_ended: True · 10.0s · audio: 517124 b64 bytes*
*note: voice item (delete_compound)*

> Listen: honeybee. Again, slowly: honeybee. Your turn. Say honeybee without honey.

### wrong:c5
*expect: turn · turn_ended: True · 7.8s · audio: 426884 b64 bytes*
*note: student says "honeybee" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: honeybee without honey is bee. Your turn. Say honeybee without honey.

### right:c5
*expect: turn · turn_ended: True · 3.1s · audio: 124840 b64 bytes*
*note: student says "bee"*

> Yes, bee.

### ask:c6
*expect: turn · turn_ended: True · 10.4s · audio: 526760 b64 bytes*
*note: voice item (delete_compound)*

> Listen: birdhouse. Again, slowly: birdhouse. Your turn. Say birdhouse without bird.

### wrong:c6
*expect: turn · turn_ended: True · 8.1s · audio: 441604 b64 bytes*
*note: student says "birdhouse" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: birdhouse without bird is house. Your turn. Say birdhouse without bird.

### right:c6
*expect: turn · turn_ended: True · 3.7s · audio: 95364 b64 bytes*
*note: student says "house"*

> Yes, house.

### ask:c7
*expect: turn · turn_ended: True · 9.3s · audio: 501764 b64 bytes*
*note: voice item (delete_compound)*

> Listen: cowboy. Again, slowly: cowboy. Your turn. Say cowboy without cow.

### wrong:c7
*expect: turn · turn_ended: True · 8.0s · audio: 432004 b64 bytes*
*note: student says "cowboy" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: cowboy without cow is boy. Your turn. Say cowboy without cow.

### right:c7
*expect: turn · turn_ended: True · 3.5s · audio: 121000 b64 bytes*
*note: student says "boy"*

> Yes, boy.

### ask:c8
*expect: turn · turn_ended: True · 9.4s · audio: 511364 b64 bytes*
*note: voice item (delete_compound)*

> Listen: catfish. Again, slowly: catfish. Your turn. Say catfish without cat.

### wrong:c8
*expect: turn · turn_ended: True · 7.8s · audio: 426244 b64 bytes*
*note: student says "catfish" — the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the residue as a substring, so a judge scoring on overlap affirms it every time*

> My turn: catfish without cat is fish. Your turn. Say catfish without cat.

### right:c8
*expect: turn · turn_ended: True · 3.8s · audio: 123524 b64 bytes*
*note: student says "fish"*

> Yes, fish.

### complete
*expect: turn · turn_ended: True · 6.7s · audio: 358404 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
