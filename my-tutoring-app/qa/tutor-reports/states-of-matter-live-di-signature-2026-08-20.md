# Tier-3 Live Tutor Report — states-of-matter — 2026-08-20

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "states-of-matter", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `som-1-compare` | voice/melt_first | Chocolate | ✅ | Water | ✅ |
| `som-2-compare` | voice/melt_first | Iron | ✅ | Butter | ✅ |
| `som-3-compare` | voice/stay_solid | Mercury | ✅ | Wax | ✅ |
| `som-4-compare` | voice/stay_solid | Oxygen | ✅ | Aluminum | ✅ |
| `som-5-compare` | voice/melt_first | Coconut Oil | ✅ | Nitrogen | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:som-1-compare
*expect: turn · turn_ended: True · 28.3s · audio: 1716484 b64 bytes*
*note: voice item (melt_first)*

> Hi! Time to find out what heat does to things! I show you two things and tell you when each one melts — you say which melts first, out loud! The lower the melting point, the sooner something gives in to the heat. Water melts at 0 degrees. Chocolate melts at 34 degrees. Both beakers are solid at minus 20 degrees. Your turn. If I heat them both slowly, which one melts first — Water, or Chocolate?

### wrong:som-1-compare
*expect: turn · turn_ended: True · 15.0s · audio: 872964 b64 bytes*
*note: student says "Chocolate" — the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has*

> My turn: the one with the lower melting point gives in to the heat first — put 0 degrees next to 34 degrees and find the smaller one. Your turn. Which one melts first — Water, or Chocolate?

### right:som-1-compare
*expect: turn · turn_ended: True · 5.2s · audio: 257284 b64 bytes*
*note: student says "Water"*

> Yes, Water melts first — its melting point is the lower one.

### ask:som-2-compare
*expect: turn · turn_ended: True · 15.9s · audio: 923524 b64 bytes*
*note: voice item (melt_first)*

> Butter melts at 32 degrees. Iron melts at 1538 degrees. Both beakers are solid at 12 degrees. Your turn. If I heat them both slowly, which one melts first — Butter, or Iron?

### wrong:som-2-compare
*expect: turn · turn_ended: True · 16.2s · audio: 954884 b64 bytes*
*note: student says "Iron" — the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has*

> My turn: the one with the lower melting point gives in to the heat first — put 32 degrees next to 1538 degrees and find the smaller one. Your turn. Which one melts first — Butter, or Iron?

### right:som-2-compare
*expect: turn · turn_ended: True · 5.3s · audio: 245764 b64 bytes*
*note: student says "Butter"*

> Yes, Butter melts first — its melting point is the lower one.

### ask:som-3-compare
*expect: turn · turn_ended: True · 26.4s · audio: 1588484 b64 bytes*
*note: voice item (stay_solid)*

> I show you two things and heat them both — you say which one is still solid, out loud! Something holds its shape right up until the heat climbs past its own melting point. Mercury melts at minus 39 degrees. Wax melts at 60 degrees. Both are solid right now. I am about to heat them both to 11 degrees. Your turn. Which one is still solid then — Mercury, or Wax?

### wrong:som-3-compare
*expect: turn · turn_ended: True · 16.4s · audio: 966404 b64 bytes*
*note: student says "Mercury" — the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has*

> My turn: something stays solid until the heat climbs past its own melting point — check 11 degrees against minus 39 degrees, then against 60 degrees. Your turn. Which one is still solid — Mercury, or Wax?

### right:som-3-compare
*expect: turn · turn_ended: True · 5.5s · audio: 268840 b64 bytes*
*note: student says "Wax"*

> Yes, Wax is still solid — the heat never reached its melting point.

### ask:som-4-compare
*expect: turn · turn_ended: True · 19.4s · audio: 1047080 b64 bytes*
*note: voice item (stay_solid)*

> Oxygen melts at minus 218 degrees. Aluminum melts at 660 degrees. Both are solid right now. I am about to heat them both to 220 degrees. Your turn. Which one is still solid then — Oxygen, or Aluminum?

### wrong:som-4-compare
*expect: turn · turn_ended: True · 17.9s · audio: 1064324 b64 bytes*
*note: student says "Oxygen" — the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has*

> My turn: something stays solid until the heat climbs past its own melting point — check 220 degrees against minus 218 degrees, then against 660 degrees. Your turn. Which one is still solid — Oxygen, or Aluminum?

### right:som-4-compare
*expect: turn · turn_ended: True · 5.3s · audio: 260484 b64 bytes*
*note: student says "Aluminum"*

> Yes, Aluminum is still solid — the heat never reached its melting point.

### ask:som-5-compare
*expect: turn · turn_ended: True · 27.3s · audio: 1635844 b64 bytes*
*note: voice item (melt_first)*

> I show you two things and tell you when each one melts — you say which melts first, out loud! The lower the melting point, the sooner something gives in to the heat. Nitrogen melts at minus 210 degrees. Coconut Oil melts at 24 degrees. Both beakers are solid at minus 230 degrees. Your turn. If I heat them both slowly, which one melts first — Nitrogen, or Coconut Oil?

### wrong:som-5-compare
*expect: turn · turn_ended: True · 16.5s · audio: 937604 b64 bytes*
*note: student says "Coconut Oil" — the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has*

> My turn: the one with the lower melting point gives in to the heat first — put minus 210 degrees next to 24 degrees and find the smaller one. Your turn. Which one melts first — Nitrogen, or Coconut Oil?

### right:som-5-compare
*expect: turn · turn_ended: True · 5.2s · audio: 243204 b64 bytes*
*note: student says "Nitrogen"*

> Yes, Nitrogen melts first — its melting point is the lower one.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 417284 b64 bytes*

> What great science today! You watched the tiny particles and worked out what heat does to them. See you next time!
