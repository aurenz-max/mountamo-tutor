# Tier-3 Live Tutor Report — push-pull-arena — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "push-pull-arena", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:c1 1/1, wrong3:c1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:c1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `c1` | voice/experiment | big | ✅✅✅ | - | n/a |
| `c2` | voice/experiment | little | ✅ | big | ✅ |
| `c3` | voice/experiment | big | ✅ | little | ✅ |
| `c4` | voice/experiment | little | ✅ | big | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 16.4s · audio: 951684 b64 bytes*
*note: voice item (experiment)*

> Hi! Time to explore pushes and pulls! Try your own pushes with the buttons and the slider. Then answer! The Toy Car is on the wood floor. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong1:c1
*expect: turn · turn_ended: True · 8.2s · audio: 416644 b64 bytes*
*note: student says "big"*

> My turn: the Toy Car is light — a little push is enough. Your turn. Big, or little?

### wrong2:c1
*expect: turn · turn_ended: True · 7.5s · audio: 398084 b64 bytes*
*note: student says "big"*

> My turn: the Toy Car is light — a little push is enough. Your turn. Big, or little?

### wrong3:c1
*expect: turn · turn_ended: True · 8.0s · audio: 415364 b64 bytes*
*note: student says "big"*

> My turn: the Toy Car is light — a little push is enough. Your turn. Big, or little?

### moveon:c1
*expect: turn · turn_ended: True · 11.6s · audio: 631044 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. The Barrel is on the carpet. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c2
*expect: turn · turn_ended: True · 8.8s · audio: 483844 b64 bytes*
*note: student says "little"*

> My turn: the Barrel is heavy and the carpet is grippy — it needs a big push. Your turn. Big, or little?

### right:c2
*expect: turn · turn_ended: True · 3.1s · audio: 85800 b64 bytes*
*note: student says "big"*

> Yes, big.

### ask:c3
*expect: turn · turn_ended: True · 9.6s · audio: 500484 b64 bytes*
*note: voice item (experiment)*

> The Tennis Ball is on the ice. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c3
*expect: turn · turn_ended: True · 7.8s · audio: 419844 b64 bytes*
*note: student says "big"*

> My turn: the Tennis Ball is light — a little push is enough. Your turn. Big, or little?

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 88360 b64 bytes*
*note: student says "little"*

> Yes, little.

### ask:c4
*expect: turn · turn_ended: True · 9.1s · audio: 478724 b64 bytes*
*note: voice item (experiment)*

> The Rock is on the grass. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.

### wrong:c4
*expect: turn · turn_ended: True · 8.5s · audio: 466564 b64 bytes*
*note: student says "little"*

> My turn: the Rock is heavy and the grass is grippy — it needs a big push. Your turn. Big, or little?

### right:c4
*expect: turn · turn_ended: True · 3.5s · audio: 87080 b64 bytes*
*note: student says "big"*

> Yes, big.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 394884 b64 bytes*

> What great force science today! You Watched, you thought, and you said what you saw. See you next time!
