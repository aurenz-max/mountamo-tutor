# Tier-3 Live Tutor Report — picture-vocabulary — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "picture-vocabulary", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 5 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-verdict-embellished` | wrong:pv-1 1/1, wrong:pv-2 1/1, wrong:pv-3 1/1, wrong:pv-4 1/1, wrong:pv-5 1/1 (5 beats) | added 8 unscripted words to a "say exactly" line. SCRIPT: "My turn: a hammer goes with a nail — we use them together. Your turn. What goes " SPOKE: "My turn: toothbrush cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with toothbrush." |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `pv-1` | voice/association | pillow | ✅ | bed | ✅ |
| `pv-2` | voice/association | pencil | ✅ | paper | ✅ |
| `pv-3` | voice/association | fork | ✅ | spoon | ✅ |
| `pv-4` | voice/association | sock | ✅ | shoe | ✅ |
| `pv-5` | voice/association | toothbrush | ✅ | toothpaste | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pv-1
*expect: turn · turn_ended: True · 13.9s · audio: 787204 b64 bytes*
*note: voice item (association)*

> Hi! Time to play with words! Some things go together, like friends — a hammer goes with a nail. I say a word, you say what goes with it! Pillow. Your turn. What goes with pillow?

### wrong:pv-1
*expect: turn · turn_ended: True · 10.0s · audio: 545284 b64 bytes*
*note: student says "pillow" — the stimulus said straight back — the documented signature error for this mode. The ask itself just spoke that word aloud, and deleting the option cards made it likelier because there is no menu to pick from — so "say the word back" is now the cheapest wrong answer available. It is also the ONLY drive that reaches the scripted echo branch*

> My turn: pillow cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with pillow.

### right:pv-1
*expect: turn · turn_ended: True · 4.0s · audio: 187524 b64 bytes*
*note: student says "bed"*

> Yes, that goes with pillow — they belong together.

### ask:pv-2
*expect: turn · turn_ended: True · 4.5s · audio: 186884 b64 bytes*
*note: voice item (association)*

> Pencil. Your turn. What goes with pencil?

### wrong:pv-2
*expect: turn · turn_ended: True · 9.4s · audio: 521604 b64 bytes*
*note: student says "pencil" — the stimulus said straight back — the documented signature error for this mode. The ask itself just spoke that word aloud, and deleting the option cards made it likelier because there is no menu to pick from — so "say the word back" is now the cheapest wrong answer available. It is also the ONLY drive that reaches the scripted echo branch*

> My turn: pencil cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with pencil.

### right:pv-2
*expect: turn · turn_ended: True · 4.1s · audio: 190120 b64 bytes*
*note: student says "paper"*

> Yes, that goes with pencil — they belong together.

### ask:pv-3
*expect: turn · turn_ended: True · 4.5s · audio: 192004 b64 bytes*
*note: voice item (association)*

> Fork. Your turn. What goes with fork?

### wrong:pv-3
*expect: turn · turn_ended: True · 9.9s · audio: 523524 b64 bytes*
*note: student says "fork" — the stimulus said straight back — the documented signature error for this mode. The ask itself just spoke that word aloud, and deleting the option cards made it likelier because there is no menu to pick from — so "say the word back" is now the cheapest wrong answer available. It is also the ONLY drive that reaches the scripted echo branch*

> My turn: fork cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with fork.

### right:pv-3
*expect: turn · turn_ended: True · 3.9s · audio: 177284 b64 bytes*
*note: student says "spoon"*

> Yes, that goes with fork — they belong together.

### ask:pv-4
*expect: turn · turn_ended: True · 4.4s · audio: 182404 b64 bytes*
*note: voice item (association)*

> Sock. Your turn. What goes with sock?

### wrong:pv-4
*expect: turn · turn_ended: True · 9.2s · audio: 514564 b64 bytes*
*note: student says "sock" — the stimulus said straight back — the documented signature error for this mode. The ask itself just spoke that word aloud, and deleting the option cards made it likelier because there is no menu to pick from — so "say the word back" is now the cheapest wrong answer available. It is also the ONLY drive that reaches the scripted echo branch*

> My turn: sock cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with sock.

### right:pv-4
*expect: turn · turn_ended: True · 4.5s · audio: 176644 b64 bytes*
*note: student says "shoe"*

> Yes, that goes with sock— they belong together.

### ask:pv-5
*expect: turn · turn_ended: True · 4.7s · audio: 203524 b64 bytes*
*note: voice item (association)*

> Toothbrush. Your turn. What goes with toothbrush?

### wrong:pv-5
*expect: turn · turn_ended: True · 10.3s · audio: 529284 b64 bytes*
*note: student says "toothbrush" — the stimulus said straight back — the documented signature error for this mode. The ask itself just spoke that word aloud, and deleting the option cards made it likelier because there is no menu to pick from — so "say the word back" is now the cheapest wrong answer available. It is also the ONLY drive that reaches the scripted echo branch*

> My turn: toothbrush cannot go with itself. A hammer goes with a nail. Your turn. Tell me something different that goes with toothbrush.

### right:pv-5
*expect: turn · turn_ended: True · 4.3s · audio: 183684 b64 bytes*
*note: student says "toothpaste"*

> Yes, that goes with toothbrush— they belong together.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 369924 b64 bytes*

> What wonderful word work today! Your words grew bigger and stronger. See you next time!
