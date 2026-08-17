# Tier-3 Live Tutor Report — text-structure-analyzer — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "text-structure-analyzer", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "signal::1::because", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:signal::1::because 1/1, wrong3:signal::1::because 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:signal::1::because 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `signal::1::because` | voice/find-signal | solid | ✅✅✅ | - | n/a |
| `signal::3::therefore` | voice/find-signal | steam | ✅ | Therefore | ✅ |
| `signal::5::as-a-result` | voice/find-signal | rain | ✅ | As a result | ✅ |
| `structure::cause-effect` | voice/name-structure | Problem and Solution | ✅ | Cause and Effect | ✅ |
| `idea::idea_1` | voice/place-idea | Effect | ✅ | Cause | ✅ |
| `idea::idea_2` | voice/place-idea | Cause | ✅ | Effect | ✅ |
| `idea::idea_3` | voice/place-idea | Cause | ✅ | Effect | ✅ |
| `idea::idea_4` | voice/place-idea | Effect | ✅ | Cause | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:signal::1::because
*expect: turn · turn_ended: True · 18.5s · audio: 1077764 b64 bytes*
*note: voice item (find-signal)*

> Hi! Let us take a close look at this passage together. I point you at one sentence — you read it and tell me which word links the ideas. A linking word joins one idea to another — it does not name a thing. Your turn. Read sentence two. Which word links the ideas?

### wrong1:signal::1::because
*expect: turn · turn_ended: True · 9.2s · audio: 496004 b64 bytes*
*note: student says "solid"*

> My turn: because is the word that links the ideas there. Your turn. Read sentence two. Which word links the ideas?

### wrong2:signal::1::because
*expect: turn · turn_ended: True · 9.2s · audio: 494724 b64 bytes*
*note: student says "solid"*

> My turn: because is the word that links the ideas there. Your turn. Read sentence two. Which word links the ideas?

### wrong3:signal::1::because
*expect: turn · turn_ended: True · 9.1s · audio: 501124 b64 bytes*
*note: student says "solid"*

> My turn: because is the word that links the ideas there. Your turn. Read sentence two. Which word links the ideas?

### moveon:signal::1::because
*expect: turn · turn_ended: True · 7.9s · audio: 405160 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. Read sentence four. Which word links the ideas?

### wrong:signal::3::therefore
*expect: turn · turn_ended: True · 9.4s · audio: 485764 b64 bytes*
*note: student says "steam"*

> My turn: Therefore is the word that links the ideas there. Your turn. Read sentence four. Which word links the ideas?

### right:signal::3::therefore
*expect: turn · turn_ended: True · 4.4s · audio: 177924 b64 bytes*
*note: student says "Therefore"*

> Yes, Therefore is the word that links them.

### ask:signal::5::as-a-result
*expect: turn · turn_ended: True · 5.7s · audio: 251524 b64 bytes*
*note: voice item (find-signal)*

> Your turn. Read sentence six. Which word links the ideas?

### wrong:signal::5::as-a-result
*expect: turn · turn_ended: True · 9.0s · audio: 491524 b64 bytes*
*note: student says "rain"*

> My turn: As a result is the word that links the ideas there. Your turn. Read sentence six. Which word links the ideas?

### right:signal::5::as-a-result
*expect: turn · turn_ended: True · 4.1s · audio: 179880 b64 bytes*
*note: student says "As a result"*

> Yes, As a result is the word that links them.

### ask:structure::cause-effect
*expect: turn · turn_ended: True · 15.2s · audio: 867880 b64 bytes*
*note: voice item (name-structure)*

> Now you tell me how the whole passage is put together. Think about what your linking words were doing. Your turn. Think about the whole passage. How is it put together? Cause and Effect, Time Order, Description, or Problem and Solution?

### wrong:structure::cause-effect
*expect: turn · turn_ended: True · 13.6s · audio: 746884 b64 bytes*
*note: student says "Problem and Solution"*

> My turn: this passage is put together as Cause and Effect. Your turn. Think about the whole passage. How is it put together? Cause and Effect, Time Order, Description, or Problem and Solution?

### right:structure::cause-effect
*expect: turn · turn_ended: True · 4.5s · audio: 209284 b64 bytes*
*note: student says "Cause and Effect"*

> Yes, this passage is put together as Cause and Effect.

### ask:idea::idea_1
*expect: turn · turn_ended: True · 15.5s · audio: 881924 b64 bytes*
*note: voice item (place-idea)*

> I read you one idea from the passage — you tell me where it belongs. Read the labels, then ask which one the idea answers. Your turn. Listen: heat makes the molecules move faster. Does that go with Cause, or Effect?

### wrong:idea::idea_1
*expect: turn · turn_ended: True · 10.5s · audio: 589444 b64 bytes*
*note: student says "Effect"*

> My turn: that idea belongs with Cause. Your turn. Listen: heat makes the molecules move faster. Does that go with Cause, or Effect?

### right:idea::idea_1
*expect: turn · turn_ended: True · 4.0s · audio: 138244 b64 bytes*
*note: student says "Cause"*

> Yes, that one belongs with Cause.

### ask:idea::idea_2
*expect: turn · turn_ended: True · 8.6s · audio: 432680 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Solid ice turns into liquid water. Does that go with Cause, or Effect?

### wrong:idea::idea_2
*expect: turn · turn_ended: True · 11.9s · audio: 634920 b64 bytes*
*note: student says "Cause"*

> My turn: that idea belongs with Effect. Your turn. Listen: Solid ice turns into liquid water. Does that go with Cause, or Effect?

### right:idea::idea_2
*expect: turn · turn_ended: True · 4.0s · audio: 135044 b64 bytes*
*note: student says "Effect"*

> Yes, that one belongs with Effect.

### ask:idea::idea_3
*expect: turn · turn_ended: True · 7.7s · audio: 380164 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: steam rises into the air. Does that go with Cause, or Effect?

### wrong:idea::idea_3
*expect: turn · turn_ended: True · 10.4s · audio: 574724 b64 bytes*
*note: student says "Cause"*

> My turn: that idea belongs with Effect. Your turn. Listen: steam rises into the air. Does that go with Cause, or Effect?

### right:idea::idea_3
*expect: turn · turn_ended: True · 3.6s · audio: 151080 b64 bytes*
*note: student says "Effect"*

> Yes, that one belongs with Effect.

### ask:idea::idea_4
*expect: turn · turn_ended: True · 8.8s · audio: 409604 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: the temperature keeps climbing. Does that go with Cause, or Effect?

### wrong:idea::idea_4
*expect: turn · turn_ended: True · 10.4s · audio: 567684 b64 bytes*
*note: student says "Effect"*

> My turn: that idea belongs with Cause. Your turn. Listen: the temperature keeps climbing. Does that go with Cause, or Effect?

### right:idea::idea_4
*expect: turn · turn_ended: True · 4.8s · audio: 158084 b64 bytes*
*note: student says "Cause"*

> Yes, that one belongs with Cause.

### complete
*expect: turn · turn_ended: True · 8.6s · audio: 452484 b64 bytes*

> Great reading today! You worked out how that whole passage was built, and you told me every answer out loud. See you next time!
