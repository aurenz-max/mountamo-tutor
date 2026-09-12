# Tier-3 Live Tutor Report — syllable-clapper — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "syllable-clapper", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "c1", "grade": "Kindergarten", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1 1/1, wrong3:c1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/blend_syllables | table | ✅✅✅ | - | n/a |
| `c2` | voice/blend_syllables | table | ✅ | monkey | ✅ |
| `c3` | voice/blend_syllables | table | ✅ | penguin | ✅ |
| `c4` | voice/blend_syllables | table | ✅ | turtle | ✅ |
| `c5` | voice/blend_syllables | table | ✅ | zebra | ✅ |
| `c6` | voice/blend_syllables | table | ✅ | kangaroo | ✅ |
| `c8` | voice/blend_syllables | table | ✅ | hippo | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 18.8s · audio: 1111684 b64 bytes*
*note: voice item (blend_syllables)*

> Hi! Words are made of parts, and we can put them back together! Watch me first: pen … cil. That is pencil. Listen: rab … bit. Again: rab … bit. Your turn. Put the parts together. What word is that?

### wrong1:c1
*expect: turn · turn_ended: True · 8.2s · audio: 429444 b64 bytes*
*note: student says "table"*

> My turn: rab … bit. Rabbit. Your turn. Put the parts together. What word is that?

### wrong2:c1
*expect: turn · turn_ended: True · 8.0s · audio: 442244 b64 bytes*
*note: student says "table"*

> My turn: rab … bit. Rabbit. Your turn. Put the parts together. What word is that?

### wrong3:c1
*expect: turn · turn_ended: True · 8.0s · audio: 437764 b64 bytes*
*note: student says "table"*

> My turn: rab … bit. Rabbit. Your turn. Put the parts together. What word is that?

### moveon:c1
*expect: turn · turn_ended: True · 13.2s · audio: 748804 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good listening! Here comes the next word. Listen: mon … key. Again: mon … key. Your turn. Put the parts together. What word is that?

### wrong:c2
*expect: turn · turn_ended: True · 8.1s · audio: 439684 b64 bytes*
*note: student says "table"*

> My turn: mon … key. Monkey. Your turn. Put the parts together. What word is that?

### right:c2
*expect: turn · turn_ended: True · 3.3s · audio: 115240 b64 bytes*
*note: student says "monkey"*

> Yes, monkey.

### ask:c3
*expect: turn · turn_ended: True · 10.7s · audio: 585604 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: pen … guin. Again: pen … guin. Your turn. Put the parts together. What word is that?

### wrong:c3
*expect: turn · turn_ended: True · 8.5s · audio: 444804 b64 bytes*
*note: student says "table"*

> My turn: pen … guin. Penguin. Your turn. Put the parts together. What word is that?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 101764 b64 bytes*
*note: student says "penguin"*

> Yes, penguin.

### ask:c4
*expect: turn · turn_ended: True · 11.0s · audio: 583684 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: tur … tle. Again: tur … tle. Your turn. Put the parts together. What word is that?

### wrong:c4
*expect: turn · turn_ended: True · 8.5s · audio: 444804 b64 bytes*
*note: student says "table"*

> My turn: tur … tle. Turtle. Your turn. Put the parts together. What word is that?

### right:c4
*expect: turn · turn_ended: True · 3.2s · audio: 96004 b64 bytes*
*note: student says "turtle"*

> Yes, turtle.

### ask:c5
*expect: turn · turn_ended: True · 10.7s · audio: 592644 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: ze … bra. Again: ze … bra. Your turn. Put the parts together. What word is that?

### wrong:c5
*expect: turn · turn_ended: True · 8.5s · audio: 460164 b64 bytes*
*note: student says "table"*

> My turn: ze … bra. Zebra. Your turn. Put the parts together. What word is that?

### right:c5
*expect: turn · turn_ended: True · 3.3s · audio: 102404 b64 bytes*
*note: student says "zebra"*

> Yes, zebra.

### ask:c6
*expect: turn · turn_ended: True · 12.5s · audio: 704040 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: kan … ga … roo. Again: kan … ga … roo. Your turn. Put the parts together. What word is that?

### wrong:c6
*expect: turn · turn_ended: True · 9.5s · audio: 531844 b64 bytes*
*note: student says "table"*

> My turn: kan … ga … roo. Kangaroo. Your turn. Put the parts together. What word is that?

### right:c6
*expect: turn · turn_ended: True · 3.2s · audio: 107524 b64 bytes*
*note: student says "kangaroo"*

> Yes, kangaroo.

### ask:c8
*expect: turn · turn_ended: True · 11.0s · audio: 607364 b64 bytes*
*note: voice item (blend_syllables)*

> Listen: hip … po. Again: hip … po. Your turn. Put the parts together. What word is that?

### wrong:c8
*expect: turn · turn_ended: True · 8.5s · audio: 467204 b64 bytes*
*note: student says "table"*

> My turn: hip … po. Hippo. Your turn. Put the parts together. What word is that?

### right:c8
*expect: turn · turn_ended: True · 3.5s · audio: 125444 b64 bytes*
*note: student says "hippo"*

> Yes, hippo.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 400040 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
