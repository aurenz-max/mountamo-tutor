# Tier-3 Live Tutor Report — rhyme-studio — 2026-08-19

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "rhyme-studio", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": ["c3", "c6", "c7", "c8", "c9"]}`
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
| `c1` | voice/production | cat | ✅ | mat | ✅ |
| `c2` | voice/production | sun | ✅ | fun | ✅ |
| `c3` | voice/production | bed | ✅ | - | n/a |
| `c4` | voice/production | top | ✅ | hop | ✅ |
| `c5` | voice/production | pig | ✅ | big | ✅ |
| `c6` | voice/production | dog | ✅ | - | n/a |
| `c7` | voice/production | bug | ✅ | - | n/a |
| `c8` | voice/production | pen | ✅ | - | n/a |
| `c9` | voice/production | pot | ✅ | - | n/a |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 19.7s · audio: 1159044 b64 bytes*
*note: voice item (production)*

> Hi! Time to play with rhyming words! I say a word — you think of a word that rhymes with it and say it! Words rhyme when they end the same way. Listen: bee, tree — both end with ee. Listen to this word: cat. Your turn. Tell me a word that rhymes with cat.

### wrong:c1
*expect: turn · turn_ended: True · 10.8s · audio: 608644 b64 bytes*
*note: student says "cat" — the stimulus said straight back. A word rhymes with itself only trivially and the ask is for a DIFFERENT word; it is the documented signature error of this mode, and deleting the word bank made it likelier because there is no menu to pick from*

> My turn: a word cannot rhyme with itself. Listen to the end of cat — at. Your turn. Tell me a different word that ends with at.

### right:c1
*expect: turn · turn_ended: True · 4.8s · audio: 218884 b64 bytes*
*note: student says "mat"*

> Yes, that rhymes with cat — both end with at.

### ask:c2
*expect: turn · turn_ended: True · 7.1s · audio: 346884 b64 bytes*
*note: voice item (production)*

> Listen to this word: sun. Your turn. Tell me a word that rhymes with sun.

### wrong:c2
*expect: turn · turn_ended: True · 10.9s · audio: 603524 b64 bytes*
*note: student says "sun" — the stimulus said straight back. A word rhymes with itself only trivially and the ask is for a DIFFERENT word; it is the documented signature error of this mode, and deleting the word bank made it likelier because there is no menu to pick from*

> My turn: a word cannot rhyme with itself. Listen to the end of sun — un. Your turn. Tell me a different word that ends with un.

### right:c2
*expect: turn · turn_ended: True · 4.5s · audio: 206724 b64 bytes*
*note: student says "fun"*

> Yes, that rhymes with sun — both end with un.

### ask:c3
*expect: turn · turn_ended: True · 7.0s · audio: 346884 b64 bytes*
*note: voice item (production)*

> Listen to this word: bed. Your turn. Tell me a word that rhymes with bed.

### wrong:c3
*expect: turn · turn_ended: True · 10.6s · audio: 599684 b64 bytes*
*note: student says "bed"*

> My turn: a word cannot rhyme with itself. Listen to the end of bed — ed. Your turn. Tell me a different word that ends with ed.

### ask:c4
*expect: turn · turn_ended: True · 7.0s · audio: 339204 b64 bytes*
*note: voice item (production)*

> Listen to this word: top. Your turn. Tell me a word that rhymes with top.

### wrong:c4
*expect: turn · turn_ended: True · 10.8s · audio: 600964 b64 bytes*
*note: student says "top" — the stimulus said straight back. A word rhymes with itself only trivially and the ask is for a DIFFERENT word; it is the documented signature error of this mode, and deleting the word bank made it likelier because there is no menu to pick from*

> My turn: a word cannot rhyme with itself. Listen to the end of top — op. Your turn. Tell me a different word that ends with op.

### right:c4
*expect: turn · turn_ended: True · 4.6s · audio: 209284 b64 bytes*
*note: student says "hop"*

> Yes, that rhymes with top — both end with op.

### ask:c5
*expect: turn · turn_ended: True · 7.2s · audio: 336004 b64 bytes*
*note: voice item (production)*

> Listen to this word: pig. Your turn. Tell me a word that rhymes with pig.

### wrong:c5
*expect: turn · turn_ended: True · 10.5s · audio: 595204 b64 bytes*
*note: student says "pig" — the stimulus said straight back. A word rhymes with itself only trivially and the ask is for a DIFFERENT word; it is the documented signature error of this mode, and deleting the word bank made it likelier because there is no menu to pick from*

> My turn: a word cannot rhyme with itself. Listen to the end of pig — ig. Your turn. Tell me a different word that ends with ig.

### right:c5
*expect: turn · turn_ended: True · 4.6s · audio: 213124 b64 bytes*
*note: student says "big"*

> Yes, that rhymes with pig — both end with ig.

### ask:c6
*expect: turn · turn_ended: True · 6.9s · audio: 341764 b64 bytes*
*note: voice item (production)*

> Listen to this word: dog. Your turn. Tell me a word that rhymes with dog.

### wrong:c6
*expect: turn · turn_ended: True · 10.6s · audio: 590084 b64 bytes*
*note: student says "dog"*

> My turn: a word cannot rhyme with itself. Listen to the end of dog — og. Your turn. Tell me a different word that ends with og.

### ask:c7
*expect: turn · turn_ended: True · 7.1s · audio: 332164 b64 bytes*
*note: voice item (production)*

> Listen to this word: bug. Your turn. Tell me a word that rhymes with bug.

### wrong:c7
*expect: turn · turn_ended: True · 10.6s · audio: 593960 b64 bytes*
*note: student says "bug"*

> My turn: a word cannot rhyme with itself. Listen to the end of bug — ug. Your turn. Tell me a different word that ends with ug.

### ask:c8
*expect: turn · turn_ended: True · 7.1s · audio: 332164 b64 bytes*
*note: voice item (production)*

> Listen to this word: pen. Your turn. Tell me a word that rhymes with pen.

### wrong:c8
*expect: turn · turn_ended: True · 10.5s · audio: 588164 b64 bytes*
*note: student says "pen"*

> My turn: a word cannot rhyme with itself. Listen to the end of pen — en. Your turn. Tell me a different word that ends with en.

### ask:c9
*expect: turn · turn_ended: True · 6.8s · audio: 327044 b64 bytes*
*note: voice item (production)*

> Listen to this word: pot. Your turn. Tell me a word that rhymes with pot.

### wrong:c9
*expect: turn · turn_ended: True · 10.5s · audio: 586280 b64 bytes*
*note: student says "pot"*

> My turn: a word cannot rhyme with itself. Listen to the end of pot — ot. Your turn. Tell me a different word that ends with ot.

### complete
*expect: turn · turn_ended: True · 7.2s · audio: 380164 b64 bytes*

> What wonderful rhyming work today! Your ears are getting sharp at hearing how words end. See you next time!
