# Tier-3 Live Tutor Report — genre-explorer — 2026-08-17

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "genre-explorer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `contrast::f1` | voice/pick-excerpt | both of them | ✅✅✅ | the first one | ✅✅✅ |
| `contrast::f2` | voice/pick-excerpt | both of them | ✅✅✅ | the second one | ✅✅✅ |
| `contrast::f5` | voice/pick-excerpt | both of them | ✅✅✅ | the first one | ✅✅✅ |
| `contrast::f6` | voice/pick-excerpt | both of them | ✅✅✅ | the second one | ✅✅✅ |
| `genre::e1` | voice/name-genre | Informational | ✅✅✅ | Poem | ✅✅✅ |
| `genre::e2` | voice/name-genre | Poem | ✅✅✅ | Informational | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:contrast::f1
*expect: turn · turn_ended: True · 17.8s · audio: 1032324 b64 bytes*
*note: voice item (pick-excerpt)*

> Hi! Let us look at some writing together. You have two texts. I name one thing to look for, and you tell me which one has it. Only one of the two has it — so hold it in your head and check them both. Your turn. Does the first one use rhyme at the end of lines, or does the second one?

### wrong:contrast::f1
*expect: turn · turn_ended: True · 11.2s · audio: 520964 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use rhyme at the end of lines. Your turn. Does the first one use rhyme at the end of lines, or does the second one?

### right:contrast::f1
*expect: turn · turn_ended: True · 4.5s · audio: 209960 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use rhyme at the end of lines.

### ask:contrast::f2
*expect: turn · turn_ended: True · 7.0s · audio: 348804 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one give scientific facts you could look up, or does the second one?

### wrong:contrast::f2
*expect: turn · turn_ended: True · 10.3s · audio: 577924 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does give scientific facts you could look up. Your turn. Does the first one give scientific facts you could look up, or does the second one?

### right:contrast::f2
*expect: turn · turn_ended: True · 5.0s · audio: 219524 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does give scientific facts you could look up.

### ask:contrast::f5
*expect: turn · turn_ended: True · 8.0s · audio: 333444 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use stanzas and short lines, or does the second one?

### wrong:contrast::f5
*expect: turn · turn_ended: True · 10.0s · audio: 557444 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use stanzas and short lines. Your turn. Does the first one use stanzas and short lines, or does the second one?

### right:contrast::f5
*expect: turn · turn_ended: True · 6.2s · audio: 206724 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use stanzas and short lines.

### ask:contrast::f6
*expect: turn · turn_ended: True · 7.0s · audio: 345608 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use bold headings and definitions, or does the second one?

### wrong:contrast::f6
*expect: turn · turn_ended: True · 10.4s · audio: 585604 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does use bold headings and definitions. Your turn. Does the first one use bold headings and definitions, or does the second one?

### right:contrast::f6
*expect: turn · turn_ended: True · 4.6s · audio: 213124 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does use bold headings and definitions.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.3s · audio: 736644 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 10.8s · audio: 588804 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 3.4s · audio: 115204 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.1s · audio: 480644 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 11.3s · audio: 641924 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 3.4s · audio: 133800 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### complete
*expect: turn · turn_ended: True · 8.1s · audio: 437124 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!


## Run 2 — beat-by-beat transcript

### ask:contrast::f1
*expect: turn · turn_ended: True · 18.1s · audio: 1070120 b64 bytes*
*note: voice item (pick-excerpt)*

> Hi! Let us look at some writing together. You have two texts. I name one thing to look for, and you tell me which text has it. Only one of the two has it — so hold it in your head and check them both. Your turn. Does the first one use rhyme at the end of lines, or does the second one?

### wrong:contrast::f1
*expect: turn · turn_ended: True · 10.0s · audio: 562564 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use rhyme at the end of lines. Your turn. Does the first one use rhyme at the end of lines, or does the second one?

### right:contrast::f1
*expect: turn · turn_ended: True · 4.6s · audio: 211204 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use rhyme at the end of lines.

### ask:contrast::f2
*expect: turn · turn_ended: True · 7.2s · audio: 357124 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one give scientific facts you could look up, or does the second one?

### wrong:contrast::f2
*expect: turn · turn_ended: True · 10.8s · audio: 613124 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does give scientific facts you could look up. Your turn. Does the first one give scientific facts you could look up, or does the second one?

### right:contrast::f2
*expect: turn · turn_ended: True · 5.8s · audio: 240644 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does give scientific facts you could look up.

### ask:contrast::f5
*expect: turn · turn_ended: True · 6.5s · audio: 317444 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use stanzas and short lines, or does the second one?

### wrong:contrast::f5
*expect: turn · turn_ended: True · 10.0s · audio: 560004 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use stanzas and short lines. Your turn. Does the first one use stanzas and short lines, or does the second one?

### right:contrast::f5
*expect: turn · turn_ended: True · 5.0s · audio: 238084 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use stanzas and short lines.

### ask:contrast::f6
*expect: turn · turn_ended: True · 6.9s · audio: 348168 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use bold headings and definitions, or does the second one?

### wrong:contrast::f6
*expect: turn · turn_ended: True · 11.1s · audio: 618884 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does use bold headings and definitions. Your turn. Does the first one use bold headings and definitions, or does the second one?

### right:contrast::f6
*expect: turn · turn_ended: True · 5.2s · audio: 259844 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does use bold headings and definitions.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.1s · audio: 739204 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 12.3s · audio: 677800 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 3.5s · audio: 146564 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.0s · audio: 485124 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 12.2s · audio: 701444 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 4.2s · audio: 166404 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 433284 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!


## Run 3 — beat-by-beat transcript

### ask:contrast::f1
*expect: turn · turn_ended: True · 18.5s · audio: 1071364 b64 bytes*
*note: voice item (pick-excerpt)*

> Hi! Let us look at some writing together. You have two texts. I name one thing to look for, and you tell me which text has it. Only one of the two has it — so hold it in your head and check them both. Your turn. Does the first one use rhyme at the end of lines, or does the second one?"

### wrong:contrast::f1
*expect: turn · turn_ended: True · 10.3s · audio: 579204 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use rhyme at the end of lines. Your turn. Does the first one use rhyme at the end of lines, or does the second one?

### right:contrast::f1
*expect: turn · turn_ended: True · 4.9s · audio: 219524 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use rhyme at the end of lines.

### ask:contrast::f2
*expect: turn · turn_ended: True · 7.4s · audio: 339844 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one give scientific facts you could look up, or does the second one?

### wrong:contrast::f2
*expect: turn · turn_ended: True · 11.1s · audio: 628484 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does give scientific facts you could look up. Your turn. Does the first one give scientific facts you could look up, or does the second one?

### right:contrast::f2
*expect: turn · turn_ended: True · 4.9s · audio: 216324 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does give scientific facts you could look up.

### ask:contrast::f5
*expect: turn · turn_ended: True · 6.5s · audio: 316164 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use stanzas and short lines, or does the second one?

### wrong:contrast::f5
*expect: turn · turn_ended: True · 10.2s · audio: 566404 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the first one does use stanzas and short lines. Your turn. Does the first one use stanzas and short lines, or does the second one?

### right:contrast::f5
*expect: turn · turn_ended: True · 5.6s · audio: 211880 b64 bytes*
*note: student says "the first one"*

> Yes, the first one does use stanzas and short lines.

### ask:contrast::f6
*expect: turn · turn_ended: True · 6.8s · audio: 331524 b64 bytes*
*note: voice item (pick-excerpt)*

> Your turn. Does the first one use bold headings and definitions, or does the second one?

### wrong:contrast::f6
*expect: turn · turn_ended: True · 10.9s · audio: 617604 b64 bytes*
*note: student says "both of them" — the hedge of a child who has not actually contrasted the two texts. It sounds generous and cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is the only reason this question is decidable at all*

> My turn: the second one does use bold headings and definitions. Your turn. Does the first one use bold headings and definitions, or does the second one?

### right:contrast::f6
*expect: turn · turn_ended: True · 4.7s · audio: 219524 b64 bytes*
*note: student says "the second one"*

> Yes, the second one does use bold headings and definitions.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.0s · audio: 723880 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?"

### wrong:genre::e1
*expect: turn · turn_ended: True · 10.5s · audio: 586248 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the first one? Poem, Informational, Fable, Myth, or Folktale?"

### right:genre::e1
*expect: turn · turn_ended: True · 3.5s · audio: 108804 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:genre::e2
*expect: turn · turn_ended: True · 8.7s · audio: 449284 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?"

### wrong:genre::e2
*expect: turn · turn_ended: True · 11.0s · audio: 618888 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the second one? Poem, Informational, Fable, Myth, or Folktale?"

### right:genre::e2
*expect: turn · turn_ended: True · 4.2s · audio: 126084 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### complete
*expect: turn · turn_ended: True · 8.1s · audio: 433924 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!
