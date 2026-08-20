# Tier-3 Live Tutor Report — ordinal-line — 2026-08-18

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "ordinal-line", "items": 7, "voice_items": 7, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "c1", "grade": "Grade 3"}`
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
| `c1` | voice/name-place | ten | ✅✅✅ | - | n/a |
| `c2` | voice/name-place | eight | ✅ | eighth | ✅ |
| `c3` | voice/name-place | five | ✅ | fifth | ✅ |
| `c4` | voice/name-place | three | ✅ | third | ✅ |
| `c5` | voice/name-place | nine | ✅ | ninth | ✅ |
| `c6` | voice/name-place | four | ✅ | fourth | ✅ |
| `c7` | voice/name-place | six | ✅ | sixth | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 10.5s · audio: 574084 b64 bytes*
*note: voice item (name-place)*

> Hi! Time to line up and count! Find the one I name, then say its place out loud. Start counting at the engine. What place is the Whale in?

### wrong1:c1
*expect: turn · turn_ended: True · 20.7s · audio: 1246084 b64 bytes*
*note: student says "ten"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven, eight, nine, ten. Ten tells how many; tenth tells which one. The Whale is tenth. Your turn. What place is the Whale in?

### wrong2:c1
*expect: turn · turn_ended: True · 21.4s · audio: 1290884 b64 bytes*
*note: student says "ten"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven, eight, nine, ten. Ten tells how many; tenth tells which one. The Whale is tenth. Your turn. What place is the Whale in?

### wrong3:c1
*expect: turn · turn_ended: True · 22.2s · audio: 1326084 b64 bytes*
*note: student says "ten"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven, eight, nine, ten. Ten tells how many; tenth tells which one. The Whale is tenth. Your turn. What place is the Whale in?

### moveon:c1
*expect: turn · turn_ended: True · 6.0s · audio: 281640 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Start counting at the engine. What place is the Cloud in?

### wrong:c2
*expect: turn · turn_ended: True · 18.5s · audio: 1100164 b64 bytes*
*note: student says "eight"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven, eight. Eight tells how many; eighth tells which one. The Cloud is eighth. Your turn. What place is the Cloud in?

### right:c2
*expect: turn · turn_ended: True · 4.5s · audio: 119044 b64 bytes*
*note: student says "eighth"*

> Yes, the Cloud is eighth.

### ask:c3
*expect: turn · turn_ended: True · 5.1s · audio: 222724 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Beaver in?

### wrong:c3
*expect: turn · turn_ended: True · 16.6s · audio: 984324 b64 bytes*
*note: student says "five"*

> My turn: I start at the engine and count — one, two, three, four, five. Five tells how many; fifth tells which one. The Beaver is fifth. Your turn. What place is the Beaver in?

### right:c3
*expect: turn · turn_ended: True · 4.2s · audio: 119044 b64 bytes*
*note: student says "fifth"*

> Yes, the Beaver is fifth.

### ask:c4
*expect: turn · turn_ended: True · 5.2s · audio: 236840 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Sea Otter in?

### wrong:c4
*expect: turn · turn_ended: True · 15.1s · audio: 881924 b64 bytes*
*note: student says "three"*

> My turn: I start at the engine and count — one, two, three. Three tells how many; third tells which one. The Sea Otter is third. Your turn. What place is the Sea Otter in?

### right:c4
*expect: turn · turn_ended: True · 3.7s · audio: 129320 b64 bytes*
*note: student says "third"*

> Yes, the Sea Otter is third.

### ask:c5
*expect: turn · turn_ended: True · 5.1s · audio: 204804 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Sun in?

### wrong:c5
*expect: turn · turn_ended: True · 21.0s · audio: 1262120 b64 bytes*
*note: student says "nine"*

> My turn: I start at the engine and count — one, two, three, four, five, six, seven, eight, nine. Nine tells how many; ninth tells which one. The Sun is ninth. Your turn. What place is the Sun in?

### right:c5
*expect: turn · turn_ended: True · 4.0s · audio: 147204 b64 bytes*
*note: student says "ninth"*

> Yes, the Sun is ninth.

### ask:c6
*expect: turn · turn_ended: True · 5.8s · audio: 238084 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Frog in?

### wrong:c6
*expect: turn · turn_ended: True · 16.6s · audio: 967044 b64 bytes*
*note: student says "four"*

> My turn: I start at the engine and count — one, two, three, four. Four tells how many; fourth tells which one. The Frog is fourth. Your turn. What place is the Frog in?

### right:c6
*expect: turn · turn_ended: True · 4.4s · audio: 153000 b64 bytes*
*note: student says "fourth"*

> Yes, the Frog is fourth.

### ask:c7
*expect: turn · turn_ended: True · 5.5s · audio: 238724 b64 bytes*
*note: voice item (name-place)*

> Start counting at the engine. What place is the Heron in?

### wrong:c7
*expect: turn · turn_ended: True · 18.8s · audio: 1125124 b64 bytes*
*note: student says "six"*

> My turn: I start at the engine and count — one, two, three, four, five, six. Six tells how many; sixth tells which one. The Heron is sixth. Your turn. What place is the Heron in?

### right:c7
*expect: turn · turn_ended: True · 3.6s · audio: 155560 b64 bytes*
*note: student says "sixth"*

> Yes, the Heron is sixth.

### complete
*expect: turn · turn_ended: True · 6.6s · audio: 324484 b64 bytes*

> What great counting today! You found every place in the line. See you next time!
