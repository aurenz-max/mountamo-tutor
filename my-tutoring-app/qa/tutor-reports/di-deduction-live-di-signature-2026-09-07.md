# Tier-3 Live Tutor Report — di-deduction — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-deduction", "items": 2, "voice_items": 2, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 4", "undrivable_items": []}`
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
| `dd-1-2-c0-cannot_tell` | voice/deduce | yes, because it lives in water | ✅ | can't tell, because the rule does not say only fish live in water | ✅ |
| `dd-1-4-c0-cannot_tell` | voice/deduce | yes, because it has four equal sides | ✅ | can't tell, because the rule does not say only squares have four equal sides | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:dd-1-2-c0-cannot_tell
*expect: turn · turn_ended: True · 21.0s · audio: 1249284 b64 bytes*
*note: voice item (deduce)*

> We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; then you say can't tell. Here is the rule: All fish live in water. This animal lives in water. Is this animal a fish? How do you know?

### wrong:dd-1-2-c0-cannot_tell
*expect: turn · turn_ended: True · 16.2s · audio: 967044 b64 bytes*
*note: student says "yes, because it lives in water" — affirming the consequent: fluent, cites the rule, and wrong — the rule does not run backwards*

> My turn: the rule does not work backwards. The rule says all fish live in water. It does not say only fish live in water — a whale lives in water too, and a whale is not a fish. So the rule can't tell you. Your turn. Is this animal a fish? How do you know?

### right:dd-1-2-c0-cannot_tell
*expect: turn · turn_ended: True · 10.0s · audio: 552324 b64 bytes*
*note: student says "can't tell, because the rule does not say only fish live in water"*

> Yes, you can't tell. All fish live in water, but the rule does not say only fish live in water — a whale lives in water too, and a whale is not a fish.

### ask:dd-1-4-c0-cannot_tell
*expect: turn · turn_ended: True · 9.8s · audio: 524164 b64 bytes*
*note: voice item (deduce)*

> Here is the rule: All squares have four equal sides. This shape has four equal sides. Is this shape a square? How do you know?

### wrong:dd-1-4-c0-cannot_tell
*expect: turn · turn_ended: True · 19.2s · audio: 1150084 b64 bytes*
*note: student says "yes, because it has four equal sides" — affirming the consequent: fluent, cites the rule, and wrong — the rule does not run backwards*

> My turn: the rule does not work backwards. The rule says all squares have four equal sides. It does not say only squares have four equal sides — a rhombus has four equal sides too, and a rhombus is not a square. So the rule can't tell you. Your turn. Is this shape a square? How do you know?

### right:dd-1-4-c0-cannot_tell
*expect: turn · turn_ended: True · 11.9s · audio: 681640 b64 bytes*
*note: student says "can't tell, because the rule does not say only squares have four equal sides"*

> Yes, you can't tell. All squares have four equal sides, but the rule does not say only squares have four equal sides — a rhombus has four equal sides too, and a rhombus is not a square.

### complete
*expect: turn · turn_ended: True · 6.1s · audio: 313000 b64 bytes*

> That's the end of our rule work. You used every rule yourself. Great thinking today!
