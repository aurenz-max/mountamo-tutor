# Tier-3 Live Tutor Report — genre-explorer — 2026-08-17

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "genre-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "K"}`
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
| `feature::e1::f1` | voice/check-feature | no | ✅✅ | yes | ✅✅ |
| `feature::e1::f2` | voice/check-feature | yes | ✅✅ | no | ✅✅ |
| `genre::e1` | voice/name-genre | Fiction | ✅✅ | Nonfiction | ✅✅ |
| `feature::e2::f2` | voice/check-feature | no | ✅✅ | yes | ✅✅ |
| `feature::e2::f1` | voice/check-feature | yes | ✅✅ | no | ✅✅ |
| `genre::e2` | voice/name-genre | Nonfiction | ✅✅ | Fiction | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:feature::e1::f1
*expect: turn · turn_ended: True · 23.7s · audio: 1416964 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you — you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Listen to the first one. Water can be a hard ice cube. When the sun shines on the ice, it melts into a puddle of water. Your turn. Does the first one give facts you could look up?

### wrong:feature::e1::f1
*expect: turn · turn_ended: True · 8.2s · audio: 445444 b64 bytes*
*note: student says "no"*

> My turn: the first one does give facts you could look up. Your turn. Does the first one give facts you could look up?

### right:feature::e1::f1
*expect: turn · turn_ended: True · 5.4s · audio: 264324 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the first one does give facts you could look up.

### ask:feature::e1::f2
*expect: turn · turn_ended: True · 4.9s · audio: 214404 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the first one have a made-up ending?

### wrong:feature::e1::f2
*expect: turn · turn_ended: True · 7.7s · audio: 414084 b64 bytes*
*note: student says "yes"*

> My turn: the first one does not have a made-up ending. Your turn. Does the first one have a made-up ending?

### right:feature::e1::f2
*expect: turn · turn_ended: True · 5.4s · audio: 255364 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not have a made-up ending.

### ask:genre::e1
*expect: turn · turn_ended: True · 10.2s · audio: 550404 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Nonfiction, or Fiction?

### wrong:genre::e1
*expect: turn · turn_ended: True · 8.3s · audio: 442244 b64 bytes*
*note: student says "Fiction"*

> My turn: that one is Nonfiction. Your turn. What kind of writing is the first one? Nonfiction, or Fiction?

### right:genre::e1
*expect: turn · turn_ended: True · 4.8s · audio: 124200 b64 bytes*
*note: student says "Nonfiction"*

> Yes, that one is Nonfiction.

### ask:feature::e2::f2
*expect: turn · turn_ended: True · 13.0s · audio: 725764 b64 bytes*
*note: voice item (check-feature)*

> Listen to the second one. Ice Cube hopped out of the freezer and did a happy dance. He skipped across the kitchen table because he loved sunny days. Your turn. Does the second one have a made-up ending?

### wrong:feature::e2::f2
*expect: turn · turn_ended: True · 7.3s · audio: 376324 b64 bytes*
*note: student says "no"*

> My turn: the second one does have a made-up ending. Your turn. Does the second one have a made-up ending?

### right:feature::e2::f2
*expect: turn · turn_ended: True · 5.4s · audio: 250920 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does have a made-up ending.

### ask:feature::e2::f1
*expect: turn · turn_ended: True · 5.0s · audio: 217604 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give facts you could look up?

### wrong:feature::e2::f1
*expect: turn · turn_ended: True · 8.3s · audio: 432644 b64 bytes*
*note: student says "yes"*

> My turn: the second one does not give facts you could look up. Your turn. Does the second one give facts you could look up?

### right:feature::e2::f1
*expect: turn · turn_ended: True · 5.4s · audio: 260484 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not give facts you could look up.

### ask:genre::e2
*expect: turn · turn_ended: True · 6.3s · audio: 300164 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Nonfiction, or Fiction?

### wrong:genre::e2
*expect: turn · turn_ended: True · 8.7s · audio: 437124 b64 bytes*
*note: student says "Nonfiction"*

> My turn: that one is Fiction. Your turn. What kind of writing is the second one? Nonfiction, or Fiction?

### right:genre::e2
*expect: turn · turn_ended: True · 3.2s · audio: 105604 b64 bytes*
*note: student says "Fiction"*

> Yes, that one is Fiction.

### complete
*expect: turn · turn_ended: True · 8.2s · audio: 443524 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!


## Run 2 — beat-by-beat transcript

### ask:feature::e1::f1
*expect: turn · turn_ended: True · 25.1s · audio: 1509124 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you — you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Listen to the first one. Water can be a hard ice cube. When the sun shines on the ice, it melts into a puddle of water. Your turn. Does the first one give facts you could look up?

### wrong:feature::e1::f1
*expect: turn · turn_ended: True · 9.0s · audio: 488324 b64 bytes*
*note: student says "no"*

> My turn: the first one does give facts you could look up. Your turn. Does the first one give facts you could look up?

### right:feature::e1::f1
*expect: turn · turn_ended: True · 5.3s · audio: 257924 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the first one does give facts you could look up.

### ask:feature::e1::f2
*expect: turn · turn_ended: True · 4.8s · audio: 197124 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the first one have a made-up ending?

### wrong:feature::e1::f2
*expect: turn · turn_ended: True · 8.2s · audio: 448004 b64 bytes*
*note: student says "yes"*

> My turn: the first one does not have a made-up ending. Your turn. Does the first one have a made-up ending?

### right:feature::e1::f2
*expect: turn · turn_ended: True · 5.3s · audio: 260484 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not have a made-up ending.

### ask:genre::e1
*expect: turn · turn_ended: True · 11.2s · audio: 611204 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Nonfiction, or Fiction?

### wrong:genre::e1
*expect: turn · turn_ended: True · 10.0s · audio: 506244 b64 bytes*
*note: student says "Fiction"*

> My turn: that one is Nonfiction. Your turn. What kind of writing is the first one? Nonfiction, or Fiction?

### right:genre::e1
*expect: turn · turn_ended: True · 4.1s · audio: 120324 b64 bytes*
*note: student says "Nonfiction"*

> Yes, that one is Nonfiction.

### ask:feature::e2::f2
*expect: turn · turn_ended: True · 13.6s · audio: 773124 b64 bytes*
*note: voice item (check-feature)*

> Listen to the second one. Ice Cube hopped out of the freezer and did a happy dance. He skipped across the kitchen table because he loved sunny days. Your turn. Does the second one have a made-up ending?

### wrong:feature::e2::f2
*expect: turn · turn_ended: True · 8.4s · audio: 444164 b64 bytes*
*note: student says "no"*

> My turn: the second one does have a made-up ending. Your turn. Does the second one have a made-up ending?

### right:feature::e2::f2
*expect: turn · turn_ended: True · 5.9s · audio: 239364 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does have a made-up ending.

### ask:feature::e2::f1
*expect: turn · turn_ended: True · 5.4s · audio: 245124 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give facts you could look up?

### wrong:feature::e2::f1
*expect: turn · turn_ended: True · 8.9s · audio: 487044 b64 bytes*
*note: student says "yes"*

> My turn: the second one does not give facts you could look up. Your turn. Does the second one give facts you could look up?

### right:feature::e2::f1
*expect: turn · turn_ended: True · 5.9s · audio: 289284 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not give facts you could look up.

### ask:genre::e2
*expect: turn · turn_ended: True · 6.5s · audio: 314920 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Nonfiction, or Fiction?

### wrong:genre::e2
*expect: turn · turn_ended: True · 8.9s · audio: 492804 b64 bytes*
*note: student says "Nonfiction"*

> My turn: that one is Fiction. Your turn. What kind of writing is the second one? Nonfiction, or Fiction?

### right:genre::e2
*expect: turn · turn_ended: True · 3.2s · audio: 128004 b64 bytes*
*note: student says "Fiction"*

> Yes, that one is Fiction.

### complete
*expect: turn · turn_ended: True · 8.6s · audio: 453124 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!
