# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `c1` | voice/story-place | three | ✅✅ | third | ✅✅ |
| `c2` | voice/story-place | four | ✅✅ | fourth | ✅✅ |
| `c3` | voice/story-place | two | ✅✅ | second | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 25.2s · audio: 1500804 b64 bytes*
*note: voice item (story-place)*

> Hi! Time to line up and count! Listen to the whole story, then say the place I ask about. Listen. The animals are lining up for the train! Penguin leads the way in first place. Seal is in second place. Polar Bear is in third place. Walrus is in fourth place. Whale is in fifth place. What place is the Polar Bear in?

### wrong:c1
*expect: turn · turn_ended: True · 21.9s · audio: 1308164 b64 bytes*
*note: student says "three" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. The animals are lining up for the train! Penguin leads the way in first place. Seal is in second place. Polar Bear is in third place. Walrus is in fourth place. Whale is in fifth place. So the Polar Bear is third. Your turn. What place is the Polar Bear in?

### right:c1
*expect: turn · turn_ended: True · 3.5s · audio: 141444 b64 bytes*
*note: student says "third"*

> Yes, the Polar Bear is third.

### ask:c2
*expect: turn · turn_ended: True · 18.2s · audio: 1056004 b64 bytes*
*note: voice item (story-place)*

> Listen. Look at the freezing ice train where the walrus is first, the snuggly polar bear is second, and the splashing seal is third. Chugging right behind them, the clever penguin is fourth and the massive whale is fifth! What place is the Penguin in?

### wrong:c2
*expect: turn · turn_ended: True · 21.7s · audio: 1288324 b64 bytes*
*note: student says "four" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. Look at the freezing ice train where the walrus is first, the snuggly polar bear is second, and the splashing seal is third. Chugging right behind them, the clever penguin is fourth and the massive whale is fifth! So the Penguin is fourth. Your turn. What place is the Penguin in?

### right:c2
*expect: turn · turn_ended: True · 4.3s · audio: 145960 b64 bytes*
*note: student says "fourth"*

> Yes, the Penguin is fourth.

### ask:c3
*expect: turn · turn_ended: True · 22.0s · audio: 1260804 b64 bytes*
*note: voice item (story-place)*

> Listen. The grand Whale is first as a solid ice cube, while the friendly Seal is second melting into a liquid splash. The wonderful Walrus is third as warm steam, the playful Penguin is fourth cooling down again, and the cozy Polar Bear is fifth back into solid ice. What place is the Seal in?

### wrong:c3
*expect: turn · turn_ended: True · 26.1s · audio: 1571240 b64 bytes*
*note: student says "two" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. The grand Whale is first as a solid ice cube, while the friendly Seal is second melting into a liquid splash. The wonderful Walrus is third as warm steam, the playful Penguin is fourth cooling down again, and the cozy Polar Bear is fifth back into solid ice. So the Seal is second. Your turn. What place is the Seal in?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 128644 b64 bytes*
*note: student says "second"*

> Yes, the Seal is second.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 316164 b64 bytes*

> What great counting today! You found every place in the line. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 22.0s · audio: 1311364 b64 bytes*
*note: voice item (story-place)*

> Hi! Time to line up and count! Listen to the whole story, then say the place I ask about. Listen. The animals are lining up for the train! Penguin leads the way in first place. Seal is in second place. Polar Bear is in third place. Walrus is in fourth place. Whale is in fifth place. What place is the Polar Bear in?

### wrong:c1
*expect: turn · turn_ended: True · 22.0s · audio: 1194884 b64 bytes*
*note: student says "three" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. The animals are lining up for the train! Penguin leads the way in first place. Seal is in second place. Polar Bear is in third place. Walrus is in fourth place. Whale is in fifth place. So the Polar Bear is third. Your turn. What place is the Polar Bear in?

### right:c1
*expect: turn · turn_ended: True · 5.4s · audio: 137604 b64 bytes*
*note: student says "third"*

> Yes, the Polar Bear is third.

### ask:c2
*expect: turn · turn_ended: True · 17.2s · audio: 990724 b64 bytes*
*note: voice item (story-place)*

> Listen. Look at the freezing ice train where the walrus is first, the snuggly polar bear is second, and the splashing seal is third. Chugging right behind them, the clever penguin is fourth and the massive whale is fifth! What place is the Penguin in?

### wrong:c2
*expect: turn · turn_ended: True · 19.9s · audio: 1200680 b64 bytes*
*note: student says "four" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. Look at the freezing ice train where the walrus is first, the snuggly polar bear is second, and the splashing seal is third. Chugging right behind them, the clever penguin is fourth and the massive whale is fifth! So the Penguin is fourth. Your turn. What place is the Penguin in?

### right:c2
*expect: turn · turn_ended: True · 3.8s · audio: 115204 b64 bytes*
*note: student says "fourth"*

> Yes, the Penguin is fourth.

### ask:c3
*expect: turn · turn_ended: True · 21.4s · audio: 1256964 b64 bytes*
*note: voice item (story-place)*

> Listen. The grand Whale is first as a solid ice cube, while the friendly Seal is second melting into a liquid splash. The wonderful Walrus is third as warm steam, the playful Penguin is fourth cooling down again, and the cozy Polar Bear is fifth back into solid ice. What place is the Seal in?

### wrong:c3
*expect: turn · turn_ended: True · 24.1s · audio: 1464324 b64 bytes*
*note: student says "two" — the cardinal said for the ordinal — how many instead of which one*

> My turn: listen again. The grand Whale is first as a solid ice cube, while the friendly Seal is second melting into a liquid splash. The wonderful Walrus is third as warm steam, the playful Penguin is fourth cooling down again, and the cozy Polar Bear is fifth back into solid ice. So the Seal is second. Your turn. What place is the Seal in?

### right:c3
*expect: turn · turn_ended: True · 3.5s · audio: 112644 b64 bytes*
*note: student says "second"*

> Yes, the Seal is second.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 310404 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
