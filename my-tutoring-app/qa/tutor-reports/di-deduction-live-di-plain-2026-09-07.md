# Tier-3 Live Tutor Report — di-deduction — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-deduction", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `dd-1-1-c0-conclude` | voice/deduce | a robin is not a bird | ✅ | a robin lays eggs | ✅ |
| `dd-1-1-c1-deny` | voice/deduce | yes, a dog is a bird | ✅ | no, a dog is not a bird, because all birds lay eggs and a dog does not lay eggs | ✅ |
| `dd-1-1-c2-cannot_tell` | voice/deduce | no, this animal is not a bird | ✅ | can't tell, because the rule does not say only birds lay eggs | ✅ |
| `dd-1-3-c0-conclude` | voice/deduce | a frog is not an amphibian | ✅ | a frog begins life in water | ✅ |
| `dd-1-3-c1-deny` | voice/deduce | yes, a robin is an amphibian | ✅ | no, a robin is not an amphibian, because all amphibians begin life in water and a robin does not begin life in water | ✅ |
| `dd-1-3-c2-cannot_tell` | voice/deduce | no, this animal is not an amphibian | ✅ | can't tell, because the rule does not say only amphibians begin life in water | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 21.8s · audio: 1293480 b64 bytes*
*note: voice item (deduce)*

> We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; then you say can't tell. Here is the rule: All birds lay eggs. A robin is a bird. So what does the rule tell you about a robin?

### wrong:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 12.7s · audio: 734724 b64 bytes*
*note: student says "a robin is not a bird"*

> My turn: not "a robin is not a bird" — The rule says all birds lay eggs. A robin is a bird, so a robin lays eggs. Your turn. So what does the rule tell you about a robin?

### right:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 4.6s · audio: 214404 b64 bytes*
*note: student says "a robin lays eggs"*

> Yes, a robin is a bird, so a robin lays eggs.

### ask:dd-1-1-c1-deny
*expect: turn · turn_ended: True · 7.1s · audio: 350724 b64 bytes*
*note: voice item (deduce)*

> Same rule. A dog does not lay eggs. Is a dog a bird? How do you know?

### wrong:dd-1-1-c1-deny
*expect: turn · turn_ended: True · 13.4s · audio: 774440 b64 bytes*
*note: student says "yes, a dog is a bird"*

> My turn: not "yes, a dog is a bird" — The rule says all birds lay eggs. A dog does not lay eggs, so a dog is not a bird. Your turn. Is a dog a bird? How do you know?

### right:dd-1-1-c1-deny
*expect: turn · turn_ended: True · 7.0s · audio: 367364 b64 bytes*
*note: student says "no, a dog is not a bird, because all birds lay eggs and a dog does not lay eggs"*

> Yes, a dog is not a bird, because all birds lay eggs and a dog does not lay eggs.

### ask:dd-1-1-c2-cannot_tell
*expect: turn · turn_ended: True · 7.2s · audio: 339844 b64 bytes*
*note: voice item (deduce)*

> Same rule. This animal lays eggs. Is this animal a bird? How do you know?

### wrong:dd-1-1-c2-cannot_tell
*expect: turn · turn_ended: True · 17.6s · audio: 1046404 b64 bytes*
*note: student says "no, this animal is not a bird"*

> My turn: not "no, this animal is not a bird" — The rule says all birds lay eggs. It does not say only birds lay eggs — a turtle lays eggs too, and a turtle is not a bird. So the rule can't tell you. Your turn. Is this animal a bird? How do you know?

### right:dd-1-1-c2-cannot_tell
*expect: turn · turn_ended: True · 10.1s · audio: 546564 b64 bytes*
*note: student says "can't tell, because the rule does not say only birds lay eggs"*

> Yes, you can't tell. All birds lay eggs, but the rule does not say only birds lay eggs — a turtle lays eggs too, and a turtle is not a bird.

### ask:dd-1-3-c0-conclude
*expect: turn · turn_ended: True · 9.0s · audio: 471720 b64 bytes*
*note: voice item (deduce)*

> Here is the rule: All amphibians begin life in water. A frog is an amphibian. So what does the rule tell you about a frog?

### wrong:dd-1-3-c0-conclude
*expect: turn · turn_ended: True · 14.3s · audio: 833924 b64 bytes*
*note: student says "a frog is not an amphibian"*

> My turn: not "a frog is not an amphibian" — The rule says all amphibians begin life in water. A frog is an amphibian, so a frog begins life in water. Your turn. So what does the rule tell you about a frog?

### right:dd-1-3-c0-conclude
*expect: turn · turn_ended: True · 5.3s · audio: 253444 b64 bytes*
*note: student says "a frog begins life in water"*

> Yes, a frog is an amphibian, so a frog begins life in water.

### ask:dd-1-3-c1-deny
*expect: turn · turn_ended: True · 7.5s · audio: 378884 b64 bytes*
*note: voice item (deduce)*

> Same rule. A robin does not begin life in water. Is a robin an amphibian? How do you know?

### wrong:dd-1-3-c1-deny
*expect: turn · turn_ended: True · 15.7s · audio: 924164 b64 bytes*
*note: student says "yes, a robin is an amphibian"*

> My turn: not "yes, a robin is an amphibian" — The rule says all amphibians begin life in water. A robin does not begin life in water, so a robin is not an amphibian. Your turn. Is a robin an amphibian? How do you know?

### right:dd-1-3-c1-deny
*expect: turn · turn_ended: True · 8.3s · audio: 452520 b64 bytes*
*note: student says "no, a robin is not an amphibian, because all amphibians begin life in water and a robin does not begin life in water"*

> Yes, a robin is not an amphibian, because all amphibians begin life in water and a robin does not begin life in water.

### ask:dd-1-3-c2-cannot_tell
*expect: turn · turn_ended: True · 7.6s · audio: 386600 b64 bytes*
*note: voice item (deduce)*

> Same rule. This animal begins life in water. Is this animal an amphibian? How do you know?

### wrong:dd-1-3-c2-cannot_tell
*expect: turn · turn_ended: True · 20.2s · audio: 1213444 b64 bytes*
*note: student says "no, this animal is not an amphibian"*

> My turn: not "no, this animal is not an amphibian" — The rule says all amphibians begin life in water. It does not say only amphibians begin life in water — a shark begins life in water too, and a shark is not an amphibian. So the rule can't tell you. Your turn. Is this animal an amphibian? How do you know?

### right:dd-1-3-c2-cannot_tell
*expect: turn · turn_ended: True · 12.4s · audio: 707204 b64 bytes*
*note: student says "can't tell, because the rule does not say only amphibians begin life in water"*

> Yes, you can't tell. All amphibians begin life in water, but the rule does not say only amphibians begin life in water — a shark begins life in water too, and a shark is not an amphibian.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 328964 b64 bytes*

> That's the end of our rule work. You used every rule yourself. Great thinking today!
