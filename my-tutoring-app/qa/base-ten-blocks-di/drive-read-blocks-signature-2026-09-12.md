# Tier-3 Live Tutor Report — base-ten-blocks — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "base-ten-blocks", "items": 10, "voice_items": 10, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `base-ten-1-count` | voice/read-count | forty | ✅ | four | ✅ |
| `base-ten-1-worth` | voice/read-worth | four | ✅ | forty | ✅ |
| `base-ten-2-count` | voice/read-count | ten | ✅ | one | ✅ |
| `base-ten-2-worth` | voice/read-worth | one | ✅ | ten | ✅ |
| `base-ten-3-count` | voice/read-count | seventy | ✅ | seven | ✅ |
| `base-ten-3-worth` | voice/read-worth | seven | ✅ | seventy | ✅ |
| `base-ten-4-count` | voice/read-count | ten | ✅ | one | ✅ |
| `base-ten-4-worth` | voice/read-worth | one | ✅ | ten | ✅ |
| `base-ten-5-count` | voice/read-count | thirty | ✅ | three | ✅ |
| `base-ten-5-worth` | voice/read-worth | three | ✅ | thirty | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:base-ten-1-count
*expect: turn · turn_ended: True · 9.2s · audio: 484484 b64 bytes*
*note: voice item (read-count)*

> Let us read the blocks together. I will ask about one size at a time, and you answer out loud. How many ten-sticks do you see?

### wrong:base-ten-1-count
*expect: turn · turn_ended: True · 7.5s · audio: 346920 b64 bytes*
*note: student says "forty" — the VALUE said where the COUNT was asked — the mirror image of the worth step*

> My turn: there are four ten-sticks. Your turn. How many ten-sticks do you see?

### right:base-ten-1-count
*expect: turn · turn_ended: True · 3.5s · audio: 127364 b64 bytes*
*note: student says "four"*

> Yes, four ten-sticks.

### ask:base-ten-1-worth
*expect: turn · turn_ended: True · 4.7s · audio: 156804 b64 bytes*
*note: voice item (read-worth)*

> What are those ten-sticks worth altogether?

### wrong:base-ten-1-worth
*expect: turn · turn_ended: True · 9.4s · audio: 523524 b64 bytes*
*note: student says "four" — the BARE COUNT said for the value — "four" for "forty"*

> My turn: one ten-stick is worth ten, so four of them are worth forty. Your turn. What are those ten-sticks worth altogether?

### right:base-ten-1-worth
*expect: turn · turn_ended: True · 4.0s · audio: 164484 b64 bytes*
*note: student says "forty"*

> Yes, four ten-sticks are worth forty.

### ask:base-ten-2-count
*expect: turn · turn_ended: True · 4.0s · audio: 120964 b64 bytes*
*note: voice item (read-count)*

> How many ten-sticks do you see?

### wrong:base-ten-2-count
*expect: turn · turn_ended: True · 7.5s · audio: 339204 b64 bytes*
*note: student says "ten" — the VALUE said where the COUNT was asked — the mirror image of the worth step*

> My turn: there is one ten-stick. Your turn. How many ten-sticks do you see?

### right:base-ten-2-count
*expect: turn · turn_ended: True · 3.6s · audio: 136964 b64 bytes*
*note: student says "one"*

> Yes, one ten-stick.

### ask:base-ten-2-worth
*expect: turn · turn_ended: True · 5.6s · audio: 172804 b64 bytes*
*note: voice item (read-worth)*

> What are those ten-sticks worth altogether?

### wrong:base-ten-2-worth
*expect: turn · turn_ended: True · 7.6s · audio: 380164 b64 bytes*
*note: student says "one" — the BARE COUNT said for the value — "four" for "forty"*

> My turn: one ten-stick is worth ten. Your turn. What are those ten-sticks worth altogether?

### right:base-ten-2-worth
*expect: turn · turn_ended: True · 4.1s · audio: 151684 b64 bytes*
*note: student says "ten"*

> Yes, one ten-stick is worth ten.

### ask:base-ten-3-count
*expect: turn · turn_ended: True · 4.7s · audio: 141480 b64 bytes*
*note: voice item (read-count)*

> How many ten-sticks do you see?

### wrong:base-ten-3-count
*expect: turn · turn_ended: True · 7.6s · audio: 366724 b64 bytes*
*note: student says "seventy" — the VALUE said where the COUNT was asked — the mirror image of the worth step*

> My turn: there are seven ten-sticks. Your turn. How many ten-sticks do you see?

### right:base-ten-3-count
*expect: turn · turn_ended: True · 3.6s · audio: 142724 b64 bytes*
*note: student says "seven"*

> Yes, seven ten-sticks.

### ask:base-ten-3-worth
*expect: turn · turn_ended: True · 4.6s · audio: 170884 b64 bytes*
*note: voice item (read-worth)*

> What are those ten-sticks worth altogether?

### wrong:base-ten-3-worth
*expect: turn · turn_ended: True · 10.5s · audio: 557444 b64 bytes*
*note: student says "seven" — the BARE COUNT said for the value — "four" for "forty"*

> My turn: one ten-stick is worth ten, so seven of them are worth seventy. Your turn. What are those ten-sticks worth altogether?

### right:base-ten-3-worth
*expect: turn · turn_ended: True · 4.3s · audio: 193284 b64 bytes*
*note: student says "seventy"*

> Yes, seven ten-sticks are worth seventy.

### ask:base-ten-4-count
*expect: turn · turn_ended: True · 4.2s · audio: 117124 b64 bytes*
*note: voice item (read-count)*

> How many ten-sticks do you see?

### wrong:base-ten-4-count
*expect: turn · turn_ended: True · 7.3s · audio: 332804 b64 bytes*
*note: student says "ten" — the VALUE said where the COUNT was asked — the mirror image of the worth step*

> My turn: there is one ten-stick. Your turn. How many ten-sticks do you see?

### right:base-ten-4-count
*expect: turn · turn_ended: True · 3.8s · audio: 134404 b64 bytes*
*note: student says "one"*

> Yes, one ten-stick.

### ask:base-ten-4-worth
*expect: turn · turn_ended: True · 4.3s · audio: 173444 b64 bytes*
*note: voice item (read-worth)*

> What are those ten-sticks worth altogether?

### wrong:base-ten-4-worth
*expect: turn · turn_ended: True · 8.0s · audio: 411524 b64 bytes*
*note: student says "one" — the BARE COUNT said for the value — "four" for "forty"*

> My turn: one ten-stick is worth ten. Your turn. What are those ten-sticks worth altogether?

### right:base-ten-4-worth
*expect: turn · turn_ended: True · 4.1s · audio: 170244 b64 bytes*
*note: student says "ten"*

> Yes, one ten-stick is worth ten.

### ask:base-ten-5-count
*expect: turn · turn_ended: True · 3.9s · audio: 140804 b64 bytes*
*note: voice item (read-count)*

> How many ten-sticks do you see?

### wrong:base-ten-5-count
*expect: turn · turn_ended: True · 7.2s · audio: 378244 b64 bytes*
*note: student says "thirty" — the VALUE said where the COUNT was asked — the mirror image of the worth step*

> My turn: there are three ten-sticks. Your turn. How many ten-sticks do you see?

### right:base-ten-5-count
*expect: turn · turn_ended: True · 3.7s · audio: 144644 b64 bytes*
*note: student says "three"*

> Yes, three ten-sticks.

### ask:base-ten-5-worth
*expect: turn · turn_ended: True · 4.6s · audio: 177924 b64 bytes*
*note: voice item (read-worth)*

> What are those ten-sticks worth altogether?

### wrong:base-ten-5-worth
*expect: turn · turn_ended: True · 9.8s · audio: 543364 b64 bytes*
*note: student says "three" — the BARE COUNT said for the value — "four" for "forty"*

> My turn: one ten-stick is worth ten, so three of them are worth thirty. Your turn. What are those ten-sticks worth altogether?

### right:base-ten-5-worth
*expect: turn · turn_ended: True · 4.1s · audio: 181124 b64 bytes*
*note: student says "thirty"*

> Yes, three ten-sticks are worth thirty.

### complete
*expect: turn · turn_ended: True · 5.2s · audio: 243844 b64 bytes*

> You read the blocks and said what they are worth. Nice work with the mat!
