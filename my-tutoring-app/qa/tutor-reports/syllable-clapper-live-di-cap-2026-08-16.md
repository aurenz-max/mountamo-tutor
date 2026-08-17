# Tier-3 Live Tutor Report — syllable-clapper — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "syllable-clapper", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "c1", "grade": "K"}`
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
| `c1` | voice/count-parts | three | ✅✅✅ | - | n/a |
| `c2` | voice/count-parts | one | ✅ | two | ✅ |
| `c3` | voice/count-parts | three | ✅ | one | ✅ |
| `c4` | voice/count-parts | one | ✅ | two | ✅ |
| `c5` | voice/count-parts | three | ✅ | one | ✅ |
| `c6` | voice/count-parts | one | ✅ | two | ✅ |
| `c7` | voice/count-parts | three | ✅ | one | ✅ |
| `c8` | voice/count-parts | one | ✅ | two | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 19.0s · audio: 1118084 b64 bytes*
*note: voice item (count-parts)*

> Hi! Words are made of parts, and we can hear them! Watch me first: pencil. Pen … cil. That is two parts. Listen: duck. Again, slowly: duck. Your turn. Clap the parts with your hands, then tell me how many parts in duck.

### wrong1:c1
*expect: turn · turn_ended: True · 7.9s · audio: 386564 b64 bytes*
*note: student says "three"*

> My turn: duck. Duck. One part. Your turn. How many parts in duck?

### wrong2:c1
*expect: turn · turn_ended: True · 7.3s · audio: 391684 b64 bytes*
*note: student says "three"*

> My turn: duck. Duck. One part. Your turn. How many parts in duck?

### wrong3:c1
*expect: turn · turn_ended: True · 7.3s · audio: 391044 b64 bytes*
*note: student says "three"*

> My turn: duck. Duck. One part. Your turn. How many parts in duck?

### moveon:c1
*expect: turn · turn_ended: True · 13.8s · audio: 788484 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good listening! Here comes the next word. Listen: piglet. Again, slowly: piglet. Your turn. Clap the parts with your hands, then tell me how many parts in piglet.

### wrong:c2
*expect: turn · turn_ended: True · 8.4s · audio: 455684 b64 bytes*
*note: student says "one"*

> My turn: piglet. Pig … let. Two parts. Your turn. How many parts in piglet?

### right:c2
*expect: turn · turn_ended: True · 3.7s · audio: 101764 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c3
*expect: turn · turn_ended: True · 10.5s · audio: 561924 b64 bytes*
*note: voice item (count-parts)*

> Listen: cow. Again, slowly: cow. Your turn. Clap the parts with your hands, then tell me how many parts in cow.

### wrong:c3
*expect: turn · turn_ended: True · 7.3s · audio: 384004 b64 bytes*
*note: student says "three"*

> My turn: cow. Cow. One part. Your turn. How many parts in cow?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 98564 b64 bytes*
*note: student says "one"*

> Yes, one part.

### ask:c4
*expect: turn · turn_ended: True · 10.4s · audio: 559364 b64 bytes*
*note: voice item (count-parts)*

> Listen: rabbit. Again, slowly: rabbit. Your turn. Clap the parts with your hands, then tell me how many parts in rabbit.

### wrong:c4
*expect: turn · turn_ended: True · 8.2s · audio: 444804 b64 bytes*
*note: student says "one"*

> My turn: rabbit. Rab … bit. Two parts. Your turn. How many parts in rabbit?

### right:c4
*expect: turn · turn_ended: True · 4.3s · audio: 102404 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c5
*expect: turn · turn_ended: True · 10.3s · audio: 538884 b64 bytes*
*note: voice item (count-parts)*

> Listen: horse. Again, slowly: horse. Your turn. Clap the parts with your hands, then tell me how many parts in horse.

### wrong:c5
*expect: turn · turn_ended: True · 7.4s · audio: 392324 b64 bytes*
*note: student says "three"*

> My turn: horse. Horse. One part. Your turn. How many parts in horse?

### right:c5
*expect: turn · turn_ended: True · 3.6s · audio: 108164 b64 bytes*
*note: student says "one"*

> Yes, one part.

### ask:c6
*expect: turn · turn_ended: True · 10.6s · audio: 573480 b64 bytes*
*note: voice item (count-parts)*

> Listen: donkey. Again, slowly: donkey. Your turn. Clap the parts with your hands, then tell me how many parts in donkey.

### wrong:c6
*expect: turn · turn_ended: True · 8.1s · audio: 440964 b64 bytes*
*note: student says "one"*

> My turn: donkey. Don … key. Two parts. Your turn. How many parts in donkey?

### right:c6
*expect: turn · turn_ended: True · 3.4s · audio: 125444 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c7
*expect: turn · turn_ended: True · 10.3s · audio: 549124 b64 bytes*
*note: voice item (count-parts)*

> Listen: sheep. Again, slowly: sheep. Your turn. Clap the parts with your hands, then tell me how many parts in sheep.

### wrong:c7
*expect: turn · turn_ended: True · 7.5s · audio: 378244 b64 bytes*
*note: student says "three"*

> My turn: sheep. Sheep. One part. Your turn. How many parts in sheep?

### right:c7
*expect: turn · turn_ended: True · 3.2s · audio: 104964 b64 bytes*
*note: student says "one"*

> Yes, one part.

### ask:c8
*expect: turn · turn_ended: True · 10.9s · audio: 578600 b64 bytes*
*note: voice item (count-parts)*

> Listen: chicken. Again, slowly: chicken. Your turn. Clap the parts with your hands, then tell me how many parts in chicken.

### wrong:c8
*expect: turn · turn_ended: True · 7.9s · audio: 421124 b64 bytes*
*note: student says "one"*

> My turn: chicken. Chick … en. Two parts. Your turn. How many parts in chicken?

### right:c8
*expect: turn · turn_ended: True · 3.5s · audio: 119684 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### complete
*expect: turn · turn_ended: True · 6.4s · audio: 327684 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
