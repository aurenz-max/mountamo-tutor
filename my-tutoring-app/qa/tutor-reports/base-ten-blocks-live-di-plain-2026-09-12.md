# Tier-3 Live Tutor Report — base-ten-blocks — 2026-09-12

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "base-ten-blocks", "items": 8, "voice_items": 4, "gesture_items": 4, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `base-ten-1-predict` | voice/trade-predict | sixteen | ✅ | fifteen | ✅ |
| `base-ten-1-trade` | gesture/trade-make | (placement) | ✅ | (placement) | ✅ |
| `base-ten-2-predict` | voice/trade-predict | fifteen | ✅ | fourteen | ✅ |
| `base-ten-2-trade` | gesture/trade-make | (placement) | ✅ | (placement) | ✅ |
| `base-ten-3-predict` | voice/trade-predict | thirteen | ✅ | twelve | ✅ |
| `base-ten-3-trade` | gesture/trade-make | (placement) | ✅ | (placement) | ✅ |
| `base-ten-4-predict` | voice/trade-predict | twelve | ✅ | eleven | ✅ |
| `base-ten-4-trade` | gesture/trade-make | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:base-ten-1-predict
*expect: turn · turn_ended: True · 14.7s · audio: 833960 b64 bytes*
*note: voice item (trade-predict)*

> Let us trade some blocks. You tell me what will happen first, and then you make it happen. You have 5 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### wrong:base-ten-1-predict
*expect: turn · turn_ended: True · 16.1s · audio: 938884 b64 bytes*
*note: student says "sixteen"*

> My turn: ten new ones cubes arrive and five were already there, so there are fifteen. Your turn. You have 5 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### right:base-ten-1-predict
*expect: turn · turn_ended: True · 4.1s · audio: 132484 b64 bytes*
*note: student says "fifteen"*

> Yes, fifteen ones cubes.

### ask:base-ten-1-trade
*expect: turn · turn_ended: True · 5.8s · audio: 248324 b64 bytes*
*note: gesture item (trade-make)*

> Now make that trade. Tap one ten-stick to break it apart.

### hands-hold:base-ten-1-trade
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:base-ten-1-trade
*expect: turn · turn_ended: True · 10.6s · audio: 586884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: one ten-stick breaks into ten ones cubes. Your turn. Now make that trade. Tap one ten-stick to break it apart.

### commit-right:base-ten-1-trade
*expect: turn · turn_ended: True · 6.7s · audio: 334724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, one ten-stick became ten ones cubes. The mat still shows the same number.

### ask:base-ten-2-predict
*expect: turn · turn_ended: True · 9.5s · audio: 474244 b64 bytes*
*note: voice item (trade-predict)*

> You have 4 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### wrong:base-ten-2-predict
*expect: turn · turn_ended: True · 16.0s · audio: 897284 b64 bytes*
*note: student says "fifteen"*

> My turn: ten new ones cubes arrive and four were already there, so there are fourteen. Your turn. You have 4 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### right:base-ten-2-predict
*expect: turn · turn_ended: True · 3.7s · audio: 132484 b64 bytes*
*note: student says "fourteen"*

> Yes, fourteen ones cubes.

### ask:base-ten-2-trade
*expect: turn · turn_ended: True · 5.9s · audio: 247044 b64 bytes*
*note: gesture item (trade-make)*

> Now make that trade. Tap one ten-stick to break it apart.

### hands-hold:base-ten-2-trade
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:base-ten-2-trade
*expect: turn · turn_ended: True · 10.6s · audio: 567684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: one ten-stick breaks into ten ones cubes. Your turn. Now make that trade. Tap one ten-stick to break it apart.

### commit-right:base-ten-2-trade
*expect: turn · turn_ended: True · 6.5s · audio: 333444 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, one ten-stick became ten ones cubes. The mat still shows the same number.

### ask:base-ten-3-predict
*expect: turn · turn_ended: True · 9.0s · audio: 456964 b64 bytes*
*note: voice item (trade-predict)*

> You have 2 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### wrong:base-ten-3-predict
*expect: turn · turn_ended: True · 15.2s · audio: 854404 b64 bytes*
*note: student says "thirteen"*

> My turn: ten new ones cubes arrive and two were already there, so there are twelve. Your turn. You have 2 ones cubes. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### right:base-ten-3-predict
*expect: turn · turn_ended: True · 4.0s · audio: 126724 b64 bytes*
*note: student says "twelve"*

> Yes, twelve ones cubes.

### ask:base-ten-3-trade
*expect: turn · turn_ended: True · 5.5s · audio: 234244 b64 bytes*
*note: gesture item (trade-make)*

> Now make that trade. Tap one ten-stick to break it apart.

### hands-hold:base-ten-3-trade
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:base-ten-3-trade
*expect: turn · turn_ended: True · 10.2s · audio: 567684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: one ten-stick breaks into ten ones cubes. Your turn. Now make that trade. Tap one ten-stick to break it apart.

### commit-right:base-ten-3-trade
*expect: turn · turn_ended: True · 6.5s · audio: 330884 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, one ten-stick became ten ones cubes. The mat still shows the same number.

### ask:base-ten-4-predict
*expect: turn · turn_ended: True · 9.1s · audio: 450564 b64 bytes*
*note: voice item (trade-predict)*

> You have 1 ones cube. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### wrong:base-ten-4-predict
*expect: turn · turn_ended: True · 15.0s · audio: 865284 b64 bytes*
*note: student says "twelve"*

> My turn: ten new ones cubes arrive and one was already there, so there are eleven. Your turn. You have 1 ones cube. You are going to trade one ten-stick for ten ones cubes. How many ones cubes will you have then?

### right:base-ten-4-predict
*expect: turn · turn_ended: True · 3.5s · audio: 119684 b64 bytes*
*note: student says "eleven"*

> Yes, eleven ones cubes.

### ask:base-ten-4-trade
*expect: turn · turn_ended: True · 5.3s · audio: 233604 b64 bytes*
*note: gesture item (trade-make)*

> Now make that trade. Tap one ten-stick to break it apart.

### hands-hold:base-ten-4-trade
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:base-ten-4-trade
*expect: turn · turn_ended: True · 10.5s · audio: 560004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: one ten-stick breaks into ten ones cubes. Your turn. Now make that trade. Tap one ten-stick to break it apart.

### commit-right:base-ten-4-trade
*expect: turn · turn_ended: True · 6.4s · audio: 325764 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, one ten-stick became ten ones cubes. The mat still shows the same number.

### complete
*expect: turn · turn_ended: True · 5.8s · audio: 263684 b64 bytes*

> You said
