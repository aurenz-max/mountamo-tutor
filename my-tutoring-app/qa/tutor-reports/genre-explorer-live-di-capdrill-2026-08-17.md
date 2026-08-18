# Tier-3 Live Tutor Report — genre-explorer — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "genre-explorer", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "feature::e1::rhyme", "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong3:feature::e1::rhyme 1/1 (1 beat) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:feature::e1::rhyme 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `feature::e1::rhyme` | voice/check-feature | no | ✅✅✅ | - | n/a |
| `feature::e1::facts` | voice/check-feature | yes | ✅ | no | ✅ |
| `genre::e1` | voice/name-genre | Folktale | ✅ | Poem | ✅ |
| `feature::e2::facts` | voice/check-feature | no | ✅ | yes | ✅ |
| `feature::e2::rhyme` | voice/check-feature | yes | ✅ | no | ✅ |
| `genre::e2` | voice/name-genre | Folktale | ✅ | Informational | ✅ |
| `feature::e3::lesson` | voice/check-feature | no | ✅ | yes | ✅ |
| `feature::e3::rhyme` | voice/check-feature | yes | ✅ | no | ✅ |
| `genre::e3` | voice/name-genre | Folktale | ✅ | Fable | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:feature::e1::rhyme
*expect: turn · turn_ended: True · 16.2s · audio: 925444 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you – you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Your turn. Does the first one use rhyme and rhythm?

### wrong1:feature::e1::rhyme
*expect: turn · turn_ended: True · 7.9s · audio: 423044 b64 bytes*
*note: student says "no"*

> My turn: the first one does use rhyme and rhythm. Your turn. Does the morning sun warm your face?

### wrong2:feature::e1::rhyme
*expect: turn · turn_ended: True · 8.2s · audio: 446084 b64 bytes*
*note: student says "no"*

> My turn: the first one does use rhyme and rhythm. Your turn. Does the first one use rhyme and rhythm?

### wrong3:feature::e1::rhyme
*expect: turn · turn_ended: True · 7.9s · audio: 421124 b64 bytes*
*note: student says "no"*

> My turn: the first one does use rhyme and rhythm. Your turn. Does the first one use rhyme and rhythm?

### moveon:feature::e1::rhyme
*expect: turn · turn_ended: True · 8.2s · audio: 421764 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. Does the first one give real facts and science details?

### wrong:feature::e1::facts
*expect: turn · turn_ended: True · 10.0s · audio: 540164 b64 bytes*
*note: student says "yes"*

> My turn: the first one does not give real facts and science details. Your turn. Does the first one give real facts and science details?

### right:feature::e1::facts
*expect: turn · turn_ended: True · 6.3s · audio: 318724 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not give real facts and science details.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.4s · audio: 748164 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 12.3s · audio: 631044 b64 bytes*
*note: student says "Folktale"*

> My turn: that one is Poem. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 3.4s · audio: 112004 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:feature::e2::facts
*expect: turn · turn_ended: True · 5.5s · audio: 255364 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give real facts and science details?

### wrong:feature::e2::facts
*expect: turn · turn_ended: True · 9.4s · audio: 515844 b64 bytes*
*note: student says "no"*

> My turn: the second one does give real facts and science details. Your turn. Does the second one give real facts and science details?

### right:feature::e2::facts
*expect: turn · turn_ended: True · 6.1s · audio: 306564 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does give real facts and science details.

### ask:feature::e2::rhyme
*expect: turn · turn_ended: True · 4.7s · audio: 199044 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one use rhyme and rhythm?

### wrong:feature::e2::rhyme
*expect: turn · turn_ended: True · 8.3s · audio: 442244 b64 bytes*
*note: student says "yes"*

> My turn: the second one does not use rhyme and rhythm. Your turn. Does the second one use rhyme and rhythm?

### right:feature::e2::rhyme
*expect: turn · turn_ended: True · 5.6s · audio: 281000 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not use rhyme and rhythm.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.0s · audio: 476804 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 11.7s · audio: 652804 b64 bytes*
*note: student says "Folktale"*

> My turn: that one is Informational. Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 3.3s · audio: 129284 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### ask:feature::e3::lesson
*expect: turn · turn_ended: True · 5.3s · audio: 234884 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one teach a moral lesson at the end?

### wrong:feature::e3::lesson
*expect: turn · turn_ended: True · 8.4s · audio: 442244 b64 bytes*
*note: student says "no"*

> My turn: the third one does teach a moral lesson at the end. Your turn. Does the third one teach a moral lesson at the end?

### right:feature::e3::lesson
*expect: turn · turn_ended: True · 5.7s · audio: 273284 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the third one does teach a moral lesson at the end.

### ask:feature::e3::rhyme
*expect: turn · turn_ended: True · 4.9s · audio: 209924 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one use rhyme and rhythm?

### wrong:feature::e3::rhyme
*expect: turn · turn_ended: True · 7.9s · audio: 424324 b64 bytes*
*note: student says "yes"*

> My turn: the third one does not use rhyme and rhythm. Your turn. Does the third one use rhyme and rhythm?

### right:feature::e3::rhyme
*expect: turn · turn_ended: True · 5.7s · audio: 279684 b64 bytes*
*note: student says "no"*

> Yes, that is right — the third one does not use rhyme and rhythm.

### ask:genre::e3
*expect: turn · turn_ended: True · 9.3s · audio: 492164 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the third one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e3
*expect: turn · turn_ended: True · 11.6s · audio: 636804 b64 bytes*
*note: student says "Folktale"*

> My turn: that one is Fable. Your turn. What kind of writing is the third one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e3
*expect: turn · turn_ended: True · 3.6s · audio: 104324 b64 bytes*
*note: student says "Fable"*

> Yes, that one is Fable.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 416644 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!
