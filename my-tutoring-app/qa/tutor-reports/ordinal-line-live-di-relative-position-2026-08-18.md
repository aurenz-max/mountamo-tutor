# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `c1` | voice/name-neighbour | White Hare | ✅✅ | Reindeer | ✅✅ |
| `c2` | voice/name-neighbour | Musk Ox | ✅✅ | Narwhal | ✅✅ |
| `c3` | voice/name-neighbour | Reindeer | ✅✅ | White Hare | ✅✅ |
| `c4` | voice/name-neighbour | Seal | ✅✅ | Polar Bear | ✅✅ |
| `c5` | voice/name-neighbour | Walrus | ✅✅ | Seal | ✅✅ |
| `c6` | voice/name-neighbour | Polar Bear | ✅✅ | Penguin | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 11.1s · audio: 618244 b64 bytes*
*note: voice item (name-neighbour)*

> Hi! Time to line up and count! Look at the line, then say the name of the one I ask for. Start counting at the engine. Who is right before the eighth one?

### wrong:c1
*expect: turn · turn_ended: True · 17.1s · audio: 1013764 b64 bytes*
*note: student says "White Hare" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth, fifth, sixth, seventh, eighth. That is the White Hare. The one right before is the Reindeer. Your turn. Who is right before the eighth one?

### right:c1
*expect: turn · turn_ended: True · 4.5s · audio: 197160 b64 bytes*
*note: student says "Reindeer"*

> Yes, the Reindeer is right before the eighth one.

### ask:c2
*expect: turn · turn_ended: True · 5.2s · audio: 233000 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right after the ninth one?

### wrong:c2
*expect: turn · turn_ended: True · 18.1s · audio: 1069444 b64 bytes*
*note: student says "Musk Ox" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth, fifth, sixth, seventh, eighth, ninth. That is the Musk Ox. The one right after is the Narwhal. Your turn. Who is right after the ninth one?

### right:c2
*expect: turn · turn_ended: True · 4.6s · audio: 202280 b64 bytes*
*note: student says "Narwhal"*

> Yes, the Narwhal is right after the ninth one.

### ask:c3
*expect: turn · turn_ended: True · 6.3s · audio: 238760 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right after the seventh one?

### wrong:c3
*expect: turn · turn_ended: True · 16.3s · audio: 972164 b64 bytes*
*note: student says "Reindeer" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth, fifth, sixth, seventh. That is the Reindeer. The one right after is the White Hare. Your turn. Who is right after the seventh one?

### right:c3
*expect: turn · turn_ended: True · 4.5s · audio: 184324 b64 bytes*
*note: student says "White Hare"*

> Yes, the White Hare is right after the seventh one.

### ask:c4
*expect: turn · turn_ended: True · 5.5s · audio: 230404 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the third one?

### wrong:c4
*expect: turn · turn_ended: True · 12.8s · audio: 744964 b64 bytes*
*note: student says "Seal" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third. That is the Seal. The one right before is the Polar Bear. Your turn. Who is right before the third one?

### right:c4
*expect: turn · turn_ended: True · 4.4s · audio: 186884 b64 bytes*
*note: student says "Polar Bear"*

> Yes, the Polar Bear is right before the third one.

### ask:c5
*expect: turn · turn_ended: True · 5.3s · audio: 237480 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the fourth one?

### wrong:c5
*expect: turn · turn_ended: True · 14.4s · audio: 823684 b64 bytes*
*note: student says "Walrus" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth. That is the Walrus. The one right before is the Seal. Your turn. Who is right before the fourth one?

### right:c5
*expect: turn · turn_ended: True · 4.3s · audio: 179240 b64 bytes*
*note: student says "Seal"*

> Yes, the Seal is right before the fourth one.

### ask:c6
*expect: turn · turn_ended: True · 5.4s · audio: 245800 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the second one?

### wrong:c6
*expect: turn · turn_ended: True · 12.6s · audio: 724484 b64 bytes*
*note: student says "Polar Bear" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second. That is the Polar Bear. The one right before is the Penguin. Your turn. Who is right before the second one?

### right:c6
*expect: turn · turn_ended: True · 4.2s · audio: 189480 b64 bytes*
*note: student says "Penguin"*

> Yes, the Penguin is right before the second one.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 328964 b64 bytes*

> What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 11.2s · audio: 608644 b64 bytes*
*note: voice item (name-neighbour)*

> Hi! Time to line up and count! Look at the line, then say the name of the one I ask for. Start counting at the engine. Who is right before the eighth one?

### wrong:c1
*expect: turn · turn_ended: True · 18.9s · audio: 1128324 b64 bytes*
*note: student says "White Hare" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count counted — first, second, third, fourth, fifth, sixth, seventh, eighth. That is the White Hare. The one right before is the Reindeer. Your turn. Who is right before the eighth one?

### right:c1
*expect: turn · turn_ended: True · 4.4s · audio: 206084 b64 bytes*
*note: student says "Reindeer"*

> Yes, the Reindeer is right before the eighth one.

### ask:c2
*expect: turn · turn_ended: True · 5.5s · audio: 253444 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right after the ninth one?

### wrong:c2
*expect: turn · turn_ended: True · 20.6s · audio: 1215364 b64 bytes*
*note: student says "Musk Ox" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth, fifth, sixth, seventh, eighth, ninth. That is the Musk Ox. The one right after is the Narwhal. Your turn. Who is right after the ninth one?

### right:c2
*expect: turn · turn_ended: True · 4.7s · audio: 220804 b64 bytes*
*note: student says "Narwhal"*

> Yes, the Narwhal is right after the ninth one.

### ask:c3
*expect: turn · turn_ended: True · 6.2s · audio: 261124 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right after the seventh one?

### wrong:c3
*expect: turn · turn_ended: True · 18.1s · audio: 1066884 b64 bytes*
*note: student says "Reindeer" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth, fifth, sixth, seventh. That is the Reindeer. The one right after is the White Hare. Your turn. Who is right after the seventh one?

### right:c3
*expect: turn · turn_ended: True · 4.7s · audio: 226564 b64 bytes*
*note: student says "White Hare"*

> Yes, the White Hare is right after the seventh one.

### ask:c4
*expect: turn · turn_ended: True · 5.8s · audio: 245760 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the third one?

### wrong:c4
*expect: turn · turn_ended: True · 14.2s · audio: 814724 b64 bytes*
*note: student says "Seal" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third. That is the Seal. The one right before is the Polar Bear. Your turn. Who is right before the third one?

### right:c4
*expect: turn · turn_ended: True · 5.9s · audio: 211844 b64 bytes*
*note: student says "Polar Bear"*

> Yes, the Polar Bear is right before the third one.

### ask:c5
*expect: turn · turn_ended: True · 5.5s · audio: 250920 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the fourth one?

### wrong:c5
*expect: turn · turn_ended: True · 15.4s · audio: 877444 b64 bytes*
*note: student says "Walrus" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second, third, fourth. That is the Walrus. The one right before is the Seal. Your turn. Who is right before the fourth one?

### right:c5
*expect: turn · turn_ended: True · 5.2s · audio: 206724 b64 bytes*
*note: student says "Seal"*

> Yes, the Seal is right before the fourth one.

### ask:c6
*expect: turn · turn_ended: True · 5.2s · audio: 235560 b64 bytes*
*note: voice item (name-neighbour)*

> Start counting at the engine. Who is right before the second one?

### wrong:c6
*expect: turn · turn_ended: True · 13.1s · audio: 759684 b64 bytes*
*note: student says "Polar Bear" — the anchor itself — the one the question points at, named by a learner who found it and stopped*

> My turn: I start at the engine and count — first, second. That is the Polar Bear. The one right before is the Penguin. Your turn. Who is right before the second one?

### right:c6
*expect: turn · turn_ended: True · 4.5s · audio: 208644 b64 bytes*
*note: student says "Penguin"*

> Yes, the Penguin is right before the second one.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 322564 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
