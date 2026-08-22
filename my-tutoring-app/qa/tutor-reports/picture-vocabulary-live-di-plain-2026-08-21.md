# Tier-3 Live Tutor Report — picture-vocabulary — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "picture-vocabulary", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `pv-1` | voice/association | blen | ✅ | key | ✅ |
| `pv-2` | voice/association | blen | ✅ | shoe | ✅ |
| `pv-3` | voice/association | blen | ✅ | cup | ✅ |
| `pv-4` | voice/association | blen | ✅ | pillow | ✅ |
| `pv-5` | voice/association | blen | ✅ | spoon | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pv-1
*expect: turn · turn_ended: True · 13.5s · audio: 748804 b64 bytes*
*note: voice item (association)*

> Hi! Time to play with words! Some things go together, like friends — a hammer goes with a nail. I say a word, you say what goes with it! Lock. Your turn. What goes with lock?

### wrong:pv-1
*expect: turn · turn_ended: True · 7.4s · audio: 389764 b64 bytes*
*note: student says "blen"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with lock?

### right:pv-1
*expect: turn · turn_ended: True · 4.3s · audio: 199044 b64 bytes*
*note: student says "key"*

> Yes, that goes with lock — they belong together.

### ask:pv-2
*expect: turn · turn_ended: True · 4.7s · audio: 192644 b64 bytes*
*note: voice item (association)*

> Sock. Your turn. What goes with sock?

### wrong:pv-2
*expect: turn · turn_ended: True · 6.9s · audio: 368680 b64 bytes*
*note: student says "blen"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with sock?

### right:pv-2
*expect: turn · turn_ended: True · 4.5s · audio: 206724 b64 bytes*
*note: student says "shoe"*

> Yes, that goes with sock — they belong together.

### ask:pv-3
*expect: turn · turn_ended: True · 4.5s · audio: 192040 b64 bytes*
*note: voice item (association)*

> Plate. Your turn. What goes with plate?

### wrong:pv-3
*expect: turn · turn_ended: True · 7.2s · audio: 380804 b64 bytes*
*note: student says "blen"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with plate?

### right:pv-3
*expect: turn · turn_ended: True · 4.6s · audio: 190724 b64 bytes*
*note: student says "cup"*

> Yes, that goes with plate — they belong together.

### ask:pv-4
*expect: turn · turn_ended: True · 4.9s · audio: 186884 b64 bytes*
*note: voice item (association)*

> Bed. Your turn. What goes with bed?

### wrong:pv-4
*expect: turn · turn_ended: True · 6.9s · audio: 369284 b64 bytes*
*note: student says "blen"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with bed?

### right:pv-4
*expect: turn · turn_ended: True · 4.4s · audio: 199044 b64 bytes*
*note: student says "pillow"*

> Yes, that goes with bed — they belong together.

### ask:pv-5
*expect: turn · turn_ended: True · 4.4s · audio: 181768 b64 bytes*
*note: voice item (association)*

> Fork. Your turn. What goes with fork?

### wrong:pv-5
*expect: turn · turn_ended: True · 7.2s · audio: 384644 b64 bytes*
*note: student says "blen"*

> My turn: a hammer goes with a nail — we use them together. Your turn. What goes with fork?

### right:pv-5
*expect: turn · turn_ended: True · 4.6s · audio: 220804 b64 bytes*
*note: student says "spoon"*

> Yes, that goes with fork — they belong together.

### complete
*expect: turn · turn_ended: True · 6.6s · audio: 345604 b64 bytes*

> What wonderful word work today! Your words grew bigger and stronger. See you next time!
