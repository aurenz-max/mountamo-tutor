# Tier-3 Live Tutor Report — rhyme-studio — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "rhyme-studio", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**FAIL** — 3 HIGH + 0 WARN mechanism(s) confirmed (11 + 0 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-false-refusal` | right:c1 1/1 (1 beat) | CORRECTED a right answer ("cat"): "My turn: listen to the end of cat — at. Your turn. Tell me a word that ends with at." |
| CONFIRMED | HIGH | `di-no-verdict` | wrong:c3 1/1, wrong:c5 1/1, wrong:c7 1/1, right:c7 1/1, wrong:c8 1/1, wrong:c9 1/1 (6 beats) | answered "hen" and the tutor opened with neither sentinel — the loop stalls here: "A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of hen — en. Your turn. Tell me a word " |
| CONFIRMED | HIGH | `di-silent-turn` | right:c3 1/1, right:c5 1/1, right:c8 1/1, right:c9 1/1 (4 beats) | no speech in 60s — the loop cannot advance without the tutor's line |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/production | zat | ✅ | cat | ❌ |
| `c2` | voice/production | zun | ✅ | fun | ✅ |
| `c3` | voice/production | bed | — | (placement) | — |
| `c4` | voice/production | blig | ✅ | big | ✅ |
| `c5` | voice/production | dog | — | (placement) | — |
| `c6` | voice/production | vop | ✅ | hop | ✅ |
| `c7` | voice/production | pan | — | (placement) | — |
| `c8` | voice/production | bug | — | (placement) | — |
| `c9` | voice/production | hen | — | (placement) | — |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 20.8s · audio: 1209604 b64 bytes*
*note: voice item (production)*

> Hi! Time to play with rhyming words! I say a word — you think of a word that rhymes with it and say it! Words rhyme when they end the same way. Listen: bee, tree — both end with ee. Listen to this word: cat. Your turn. Tell me a word that rhymes with cat.

### wrong:c1
*expect: turn · turn_ended: True · 8.2s · audio: 442244 b64 bytes*
*note: student says "zat"*

> My turn: listen to the end of cat — at. Your turn. Tell me a word that ends with at.

### right:c1
*expect: turn · turn_ended: True · 8.4s · audio: 439044 b64 bytes*
*note: student says "cat"*

> My turn: listen to the end of cat — at. Your turn. Tell me a word that ends with at.

### ask:c2
*expect: turn · turn_ended: True · 7.4s · audio: 369924 b64 bytes*
*note: voice item (production)*

> Listen to this word: sun. Your turn. Tell me a word that rhymes with sun.

### wrong:c2
*expect: turn · turn_ended: True · 8.2s · audio: 439044 b64 bytes*
*note: student says "zun"*

> My turn: listen to the end of sun — un. Your turn. Tell me a word that ends with un.

### right:c2
*expect: turn · turn_ended: True · 4.7s · audio: 211844 b64 bytes*
*note: student says "fun"*

> Yes, that rhymes with sun — both end with un.

### ask:c3
*expect: turn · turn_ended: True · 7.2s · audio: 362244 b64 bytes*
*note: voice item (production)*

> Listen to this word: bed. Your turn. Tell me a word that rhymes with bed.

### wrong:c3
*expect: turn · turn_ended: True · 12.9s · audio: 737960 b64 bytes*
*note: student says "bed"*

> A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of bed — ed. Your turn. Tell me a word that ends with ed.

### right:c3
*expect: turn · turn_ended: False · 60.3s · audio: 0 b64 bytes*
*note: student says ""*

> *(silent)*

### ask:c4
*expect: turn · turn_ended: True · 7.3s · audio: 364804 b64 bytes*
*note: voice item (production)*

> Listen to this word: pig. Your turn. Tell me a word that rhymes with pig.

### wrong:c4
*expect: turn · turn_ended: True · 8.1s · audio: 439684 b64 bytes*
*note: student says "blig"*

> My turn: listen to the end of pig — ig. Your turn. Tell me a word that ends with ig.

### right:c4
*expect: turn · turn_ended: True · 4.5s · audio: 208004 b64 bytes*
*note: student says "big"*

> Yes, that rhymes with pig — both end with ig.

### ask:c5
*expect: turn · turn_ended: True · 7.9s · audio: 376964 b64 bytes*
*note: voice item (production)*

> Listen to this word: dog. Your turn. Tell me a word that rhymes with dog.

### wrong:c5
*expect: turn · turn_ended: True · 13.0s · audio: 734724 b64 bytes*
*note: student says "dog"*

> A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of dog — og. Your turn. Tell me a word that ends with og.

### right:c5
*expect: turn · turn_ended: False · 60.3s · audio: 0 b64 bytes*
*note: student says ""*

> *(silent)*

### ask:c6
*expect: turn · turn_ended: True · 7.3s · audio: 354564 b64 bytes*
*note: voice item (production)*

> Listen to this word: top. Your turn. Tell me a word that rhymes with top.

### wrong:c6
*expect: turn · turn_ended: True · 7.9s · audio: 426884 b64 bytes*
*note: student says "vop"*

> My turn: listen to the end of top — op. Your turn. Tell me a word that ends with op.

### right:c6
*expect: turn · turn_ended: True · 4.8s · audio: 218244 b64 bytes*
*note: student says "hop"*

> Yes, that rhymes with top — both end with op.

### ask:c7
*expect: turn · turn_ended: True · 7.2s · audio: 358404 b64 bytes*
*note: voice item (production)*

> Listen to this word: pan. Your turn. Tell me a word that rhymes with pan.

### wrong:c7
*expect: turn · turn_ended: True · 12.6s · audio: 730884 b64 bytes*
*note: student says "pan"*

> A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of pan — an. Your turn. Tell me a word that ends with an.

### right:c7
*expect: turn · turn_ended: True · 59.7s · audio: 67844 b64 bytes*
*note: student says ""*

> <no speech>

### ask:c8
*expect: turn · turn_ended: True · 7.3s · audio: 364164 b64 bytes*
*note: voice item (production)*

> Listen to this word: bug. Your turn. Tell me a word that rhymes with bug.

### wrong:c8
*expect: turn · turn_ended: True · 12.5s · audio: 720644 b64 bytes*
*note: student says "bug"*

> A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of bug — ug. Your turn. Tell me a word that ends with ug.

### right:c8
*expect: turn · turn_ended: False · 60.3s · audio: 0 b64 bytes*
*note: student says ""*

> *(silent)*

### ask:c9
*expect: turn · turn_ended: True · 7.6s · audio: 371240 b64 bytes*
*note: voice item (production)*

> Listen to this word: hen. Your turn. Tell me a word that rhymes with hen.

### wrong:c9
*expect: turn · turn_ended: True · 13.0s · audio: 737960 b64 bytes*
*note: student says "hen"*

> A word does not rhyme with itself in this game. Ask again for a different word that ends the same way. Listen to the end of hen — en. Your turn. Tell me a word that ends with en.

### right:c9
*expect: turn · turn_ended: False · 60.3s · audio: 0 b64 bytes*
*note: student says ""*

> *(silent)*

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 412164 b64 bytes*

> What wonderful rhyming work today! Your ears are getting sharp at hearing how words end. See you next time!
