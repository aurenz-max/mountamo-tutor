# Tier-3 Live Tutor Report — di-deduction — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-deduction", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "dd-1-1-c0-conclude", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:dd-1-1-c0-conclude 1/1, wrong3:dd-1-1-c0-conclude 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:dd-1-1-c0-conclude 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `dd-1-1-c0-conclude` | voice/deduce | an ant is not an insect | ✅✅✅ | - | n/a |
| `dd-1-1-c1-deny` | voice/deduce | yes, a dog is an insect | ✅ | no, a dog is not an insect, because all insects have six legs and a dog does not have six legs | ✅ |
| `dd-1-2-c0-conclude` | voice/deduce | a robin is not a bird | ✅ | a robin has feathers | ✅ |
| `dd-1-2-c1-deny` | voice/deduce | yes, a frog is a bird | ✅ | no, a frog is not a bird, because all birds have feathers and a frog does not have feathers | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 23.6s · audio: 1413124 b64 bytes*
*note: voice item (deduce)*

> We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; then you say can't tell. Here is the rule: All insects have six legs. An ant is an insect. So what does the rule tell you about an ant?

### wrong1:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 14.7s · audio: 862084 b64 bytes*
*note: student says "an ant is not an insect"*

> My turn: not an ant is not an insect — The rule says all insects have six legs. An ant is an insect, so an ant has six legs. Your turn. So what does the rule tell you about an ant?

### wrong2:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 15.8s · audio: 887684 b64 bytes*
*note: student says "an ant is not an insect"*

> My turn: not an ant is not an insect — The rule says all insects have six legs. An ant is an insect, so an ant has six legs. Your turn. So what does the rule tell you about an ant?

### wrong3:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 15.2s · audio: 885764 b64 bytes*
*note: student says "an ant is not an insect"*

> My turn: not an ant is not an insect — The rule says all insects have six legs. An ant is an insect, so an ant has six legs. Your turn. So what does the rule tell you about an ant?

### moveon:dd-1-1-c0-conclude
*expect: turn · turn_ended: True · 11.9s · audio: 664324 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try. An ant is an insect, so an ant has six legs. Same rule. A dog does not have six legs. Is a dog an insect? How do you know?

### wrong:dd-1-1-c1-deny
*expect: turn · turn_ended: True · 14.7s · audio: 862084 b64 bytes*
*note: student says "yes, a dog is an insect"*

> My turn: not yes, a dog is an insect — The rule says all insects have six legs. A dog does not have six legs, so a dog is not an insect. Your turn. Is a dog an insect? How do you know?

### right:dd-1-1-c1-deny
*expect: turn · turn_ended: True · 7.8s · audio: 413444 b64 bytes*
*note: student says "no, a dog is not an insect, because all insects have six legs and a dog does not have six legs"*

> Yes, a dog is not an insect, because all insects have six legs and a dog does not have six legs.

### ask:dd-1-2-c0-conclude
*expect: turn · turn_ended: True · 8.8s · audio: 456964 b64 bytes*
*note: voice item (deduce)*

> Here is the rule: All birds have feathers. A robin is a bird. So what does the rule tell you about a robin?

### wrong:dd-1-2-c0-conclude
*expect: turn · turn_ended: True · 13.3s · audio: 764804 b64 bytes*
*note: student says "a robin is not a bird"*

> My turn: not a robin is not a bird — The rule says all birds have feathers. A robin is a bird, so a robin has feathers. Your turn. So what does the rule tell you about a robin?

### right:dd-1-2-c0-conclude
*expect: turn · turn_ended: True · 5.0s · audio: 240004 b64 bytes*
*note: student says "a robin has feathers"*

> Yes, a robin is a bird, so a robin has feathers.

### ask:dd-1-2-c1-deny
*expect: turn · turn_ended: True · 8.2s · audio: 341764 b64 bytes*
*note: voice item (deduce)*

> Same rule. A frog does not have feathers. Is a frog a bird? How do you know?

### wrong:dd-1-2-c1-deny
*expect: turn · turn_ended: True · 13.6s · audio: 788484 b64 bytes*
*note: student says "yes, a frog is a bird"*

> My turn: not yes, a frog is a bird — The rule says all birds have feathers. A frog does not have feathers, so a frog is not a bird. Your turn. Is a frog a bird? How do you know?

### right:dd-1-2-c1-deny
*expect: turn · turn_ended: True · 6.9s · audio: 356484 b64 bytes*
*note: student says "no, a frog is not a bird, because all birds have feathers and a frog does not have feathers"*

> Yes, a frog is not a bird, because all birds have feathers and a frog does not have feathers.

### complete
*expect: turn · turn_ended: True · 6.7s · audio: 341764 b64 bytes*

> That's the end of our rule work. You used every rule yourself. Great thinking today!
