# Tier-3 Live Tutor Report — word-workout — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "word-workout", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "1"}`
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
| `c1` | voice/real_word | trombone | ✅✅✅ | - | n/a |
| `c2` | voice/real_word | trombone | ✅ | pan | ✅ |
| `c3` | voice/real_word | trombone | ✅ | map | ✅ |
| `c4` | voice/real_word | trombone | ✅ | hat | ✅ |
| `c5` | voice/real_word | trombone | ✅ | sam | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 12.4s · audio: 700840 b64 bytes*
*note: voice item (real_word)*

> Hi! Time to for a word workout! I show you two words. One is a real word and one is just silly sounds. You read them both and tell me the real one! Your turn. Read them both. Which one is a real word?

### wrong1:c1
*expect: turn · turn_ended: True · 8.0s · audio: 436484 b64 bytes*
*note: student says "trombone"*

> My turn: cat is a real word. Zat is just silly sounds. Your turn. Which one is a real word?

### wrong2:c1
*expect: turn · turn_ended: True · 7.9s · audio: 436484 b64 bytes*
*note: student says "trombone"*

> My turn: cat is a real word. Zat is just silly sounds. Your turn. Which one is a real word?

### wrong3:c1
*expect: turn · turn_ended: True · 8.0s · audio: 435844 b64 bytes*
*note: student says "trombone"*

> My turn: cat is a real word. Zat is just silly sounds. Your turn. Which one is a real word?

### moveon:c1
*expect: turn · turn_ended: True · 7.7s · audio: 360964 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! The real word was cat. Your turn. Read them both. Which one is a real word?

### wrong:c2
*expect: turn · turn_ended: True · 8.2s · audio: 421764 b64 bytes*
*note: student says "trombone"*

> My turn: pan is a real word. Lan is just silly sounds. Your turn. Which one is a real word?

### right:c2
*expect: turn · turn_ended: True · 3.4s · audio: 134404 b64 bytes*
*note: student says "pan"*

> Yes, pan is a real word!

### ask:c3
*expect: turn · turn_ended: True · 4.9s · audio: 220164 b64 bytes*
*note: voice item (real_word)*

> Your turn. Read them both. Which one is a real word?

### wrong:c3
*expect: turn · turn_ended: True · 8.7s · audio: 480644 b64 bytes*
*note: student says "trombone"*

> My turn: map is a real word. Vap is just silly sounds. Your turn. Which one is a real word?

### right:c3
*expect: turn · turn_ended: True · 3.3s · audio: 136964 b64 bytes*
*note: student says "map"*

> Yes, map is a real word!

### ask:c4
*expect: turn · turn_ended: True · 5.0s · audio: 226564 b64 bytes*
*note: voice item (real_word)*

> Your turn. Read them both. Which one is a real word?

### wrong:c4
*expect: turn · turn_ended: True · 8.2s · audio: 437124 b64 bytes*
*note: student says "trombone"*

> My turn: hat is a real word. Dat is just silly sounds. Your turn. Which one is a real word?

### right:c4
*expect: turn · turn_ended: True · 3.7s · audio: 156840 b64 bytes*
*note: student says "hat"*

> Yes, hat is a real word!

### ask:c5
*expect: turn · turn_ended: True · 4.9s · audio: 218884 b64 bytes*
*note: voice item (real_word)*

> Your turn. Read them both. Which one is a real word?

### wrong:c5
*expect: turn · turn_ended: True · 8.2s · audio: 455684 b64 bytes*
*note: student says "trombone"*

> My turn: sam is a real word. Tam is just silly sounds. Your turn. Which one is a real word?

### right:c5
*expect: turn · turn_ended: True · 3.7s · audio: 131880 b64 bytes*
*note: student says "sam"*

> Yes, sam is a real word!

### complete
*expect: turn · turn_ended: True · 6.8s · audio: 360324 b64 bytes*

> What a great word workout! You read every word out loud, all by yourself. See you next time!
