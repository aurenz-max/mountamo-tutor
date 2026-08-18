# Tier-3 Live Tutor Report — genre-explorer — 2026-08-17

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "genre-explorer", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `feature::e1::f1` | voice/check-feature | give facts you could look up | ✅✅✅ | yes | ✅✅✅ |
| `feature::e1::f2` | voice/check-feature | use rhyme | ✅✅✅ | no | ✅✅✅ |
| `genre::e1` | voice/name-genre | Poem | ✅✅✅ | Informational | ✅✅✅ |
| `feature::e2::f2` | voice/check-feature | use rhyme | ✅✅✅ | yes | ✅✅✅ |
| `feature::e2::f1` | voice/check-feature | give facts you could look up | ✅✅✅ | no | ✅✅✅ |
| `genre::e2` | voice/name-genre | Informational | ✅✅✅ | Poem | ✅✅✅ |
| `feature::e3::f4` | voice/check-feature | teach a lesson at the end | ✅✅✅ | yes | ✅✅✅ |
| `feature::e3::f1` | voice/check-feature | give facts you could look up | ✅✅✅ | no | ✅✅✅ |
| `genre::e3` | voice/name-genre | Folktale | ✅✅✅ | Fable | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:feature::e1::f1
*expect: turn · turn_ended: True · 16.3s · audio: 942760 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you — you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Your turn. Does the first one give facts you could look up?

### wrong:feature::e1::f1
*expect: turn · turn_ended: True · 8.6s · audio: 469764 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does give facts you could look up. Your turn. Does the first one give facts you could look up?

### right:feature::e1::f1
*expect: turn · turn_ended: True · 5.5s · audio: 276484 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the first one does give facts you could look up.

### ask:feature::e1::f2
*expect: turn · turn_ended: True · 4.3s · audio: 172164 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the first one use rhyme?

### wrong:feature::e1::f2
*expect: turn · turn_ended: True · 7.2s · audio: 380164 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does not use rhyme. Your turn. Does the first one use rhyme?

### right:feature::e1::f2
*expect: turn · turn_ended: True · 4.8s · audio: 226564 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not use rhyme.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.9s · audio: 768004 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 11.6s · audio: 658564 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 4.2s · audio: 133764 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### ask:feature::e2::f2
*expect: turn · turn_ended: True · 4.8s · audio: 193924 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one use rhyme?

### wrong:feature::e2::f2
*expect: turn · turn_ended: True · 7.3s · audio: 385924 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does use rhyme. Your turn. Does the second one use rhyme?

### right:feature::e2::f2
*expect: turn · turn_ended: True · 4.8s · audio: 225284 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does use rhyme.

### ask:feature::e2::f1
*expect: turn · turn_ended: True · 5.7s · audio: 247684 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give facts you could look up?

### wrong:feature::e2::f1
*expect: turn · turn_ended: True · 8.9s · audio: 489640 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does not give facts you could look up. Your turn. Does the second one give facts you could look up?

### right:feature::e2::f1
*expect: turn · turn_ended: True · 5.5s · audio: 264324 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not give facts you could look up.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.4s · audio: 501124 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 12.0s · audio: 679720 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 3.7s · audio: 138884 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:feature::e3::f4
*expect: turn · turn_ended: True · 5.2s · audio: 234244 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one teach a lesson at the end?

### wrong:feature::e3::f4
*expect: turn · turn_ended: True · 8.4s · audio: 456324 b64 bytes*
*note: student says "teach a lesson at the end" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does teach a lesson at the end. Your turn. Does the third one teach a lesson at the end?

### right:feature::e3::f4
*expect: turn · turn_ended: True · 9.3s · audio: 256644 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the third one does teach a lesson at the end.

### ask:feature::e3::f1
*expect: turn · turn_ended: True · 5.2s · audio: 229124 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one give facts you could look up?

### wrong:feature::e3::f1
*expect: turn · turn_ended: True · 8.8s · audio: 480004 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does not give facts you could look up. Your turn. Does the third one give facts you could look up?

### right:feature::e3::f1
*expect: turn · turn_ended: True · 5.5s · audio: 261764 b64 bytes*
*note: student says "no"*

> Yes, that is right — the third one does not give facts you could look up.

### ask:genre::e3
*expect: turn · turn_ended: True · 9.2s · audio: 488324 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e3
*expect: turn · turn_ended: True · 11.8s · audio: 657284 b64 bytes*
*note: student says "Folktale" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Fable. Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e3
*expect: turn · turn_ended: True · 3.4s · audio: 137604 b64 bytes*
*note: student says "Fable"*

> Yes, that one is Fable.

### complete
*expect: turn · turn_ended: True · 9.0s · audio: 480644 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!


## Run 2 — beat-by-beat transcript

### ask:feature::e1::f1
*expect: turn · turn_ended: True · 15.9s · audio: 926724 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you — you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Your turn. Does the first one give facts you could look up?

### wrong:feature::e1::f1
*expect: turn · turn_ended: True · 8.6s · audio: 464040 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does give facts you could look up. Your turn. Does the first one give facts you could look up?

### right:feature::e1::f1
*expect: turn · turn_ended: True · 5.2s · audio: 257924 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the first one does give facts you could look up.

### ask:feature::e1::f2
*expect: turn · turn_ended: True · 4.2s · audio: 170884 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the first one use rhyme?

### wrong:feature::e1::f2
*expect: turn · turn_ended: True · 7.2s · audio: 374404 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does not use rhyme. Your turn. Does the first one use rhyme?

### right:feature::e1::f2
*expect: turn · turn_ended: True · 4.5s · audio: 208644 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not use rhyme.

### ask:genre::e1
*expect: turn · turn_ended: True · 13.3s · audio: 739240 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 11.5s · audio: 641284 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 3.9s · audio: 129924 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### ask:feature::e2::f2
*expect: turn · turn_ended: True · 4.3s · audio: 169604 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one use rhyme?

### wrong:feature::e2::f2
*expect: turn · turn_ended: True · 7.3s · audio: 359044 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does use rhyme. Your turn. Does the second one use rhyme?

### right:feature::e2::f2
*expect: turn · turn_ended: True · 4.2s · audio: 191364 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does use rhyme.

### ask:feature::e2::f1
*expect: turn · turn_ended: True · 5.2s · audio: 229764 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give facts you could look up?

### wrong:feature::e2::f1
*expect: turn · turn_ended: True · 9.0s · audio: 494724 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does not give facts you could look up. Your turn. Does the second one give facts you could look up?

### right:feature::e2::f1
*expect: turn · turn_ended: True · 6.2s · audio: 266884 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not give facts you could look up.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.8s · audio: 503720 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 11.6s · audio: 664964 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 3.7s · audio: 120964 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:feature::e3::f4
*expect: turn · turn_ended: True · 5.1s · audio: 226564 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one teach a lesson at the end?

### wrong:feature::e3::f4
*expect: turn · turn_ended: True · 7.9s · audio: 428804 b64 bytes*
*note: student says "teach a lesson at the end" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does teach a lesson at the end. Your turn. Does the third one teach a lesson at the end?

### right:feature::e3::f4
*expect: turn · turn_ended: True · 5.5s · audio: 251524 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the third one does teach a lesson at the end.

### ask:feature::e3::f1
*expect: turn · turn_ended: True · 5.3s · audio: 240680 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one give facts you could look up?

### wrong:feature::e3::f1
*expect: turn · turn_ended: True · 9.5s · audio: 472964 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does not give facts you could look up. Your turn. Does the third one give facts you could look up?

### right:feature::e3::f1
*expect: turn · turn_ended: True · 5.1s · audio: 250884 b64 bytes*
*note: student says "no"*

> Yes, that is right — the third one does not give facts you could look up.

### ask:genre::e3
*expect: turn · turn_ended: True · 9.5s · audio: 499240 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e3
*expect: turn · turn_ended: True · 13.8s · audio: 665604 b64 bytes*
*note: student says "Folktale" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Fable. Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e3
*expect: turn · turn_ended: True · 3.6s · audio: 127364 b64 bytes*
*note: student says "Fable"*

> Yes, that one is Fable.

### complete
*expect: turn · turn_ended: True · 9.1s · audio: 478724 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!


## Run 3 — beat-by-beat transcript

### ask:feature::e1::f1
*expect: turn · turn_ended: True · 16.2s · audio: 942724 b64 bytes*
*note: voice item (check-feature)*

> Hi! Let us look at some writing together. I ask you one thing about the writing in front of you — you tell me yes or no. Answer from the words in front of you, not from what you expect to be there. Your turn. Does the first one give facts you could look up?

### wrong:feature::e1::f1
*expect: turn · turn_ended: True · 9.3s · audio: 501768 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does give facts you could look up. Your turn. Does the first one give facts you could look up?

### right:feature::e1::f1
*expect: turn · turn_ended: True · 5.2s · audio: 245764 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the first one does give facts you could look up.

### ask:feature::e1::f2
*expect: turn · turn_ended: True · 4.2s · audio: 165124 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the first one use rhyme?

### wrong:feature::e1::f2
*expect: turn · turn_ended: True · 7.3s · audio: 394884 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the first one does not use rhyme. Your turn. Does the first one use rhyme?

### right:feature::e1::f2
*expect: turn · turn_ended: True · 6.4s · audio: 230404 b64 bytes*
*note: student says "no"*

> Yes, that is right — the first one does not use rhyme.

### ask:genre::e1
*expect: turn · turn_ended: True · 14.3s · audio: 816680 b64 bytes*
*note: voice item (name-genre)*

> Now you tell me what kind of writing it is. Think about what you just found in it. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e1
*expect: turn · turn_ended: True · 12.2s · audio: 698244 b64 bytes*
*note: student says "Poem" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Informational. Your turn. What kind of writing is the first one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e1
*expect: turn · turn_ended: True · 3.7s · audio: 161924 b64 bytes*
*note: student says "Informational"*

> Yes, that one is Informational.

### ask:feature::e2::f2
*expect: turn · turn_ended: True · 4.5s · audio: 190724 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one use rhyme?

### wrong:feature::e2::f2
*expect: turn · turn_ended: True · 7.6s · audio: 398084 b64 bytes*
*note: student says "use rhyme" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does use rhyme. Your turn. Does the second one use rhyme?

### right:feature::e2::f2
*expect: turn · turn_ended: True · 4.8s · audio: 220164 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the second one does use rhyme.

### ask:feature::e2::f1
*expect: turn · turn_ended: True · 5.1s · audio: 229124 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the second one give facts you could look up?

### wrong:feature::e2::f1
*expect: turn · turn_ended: True · 9.5s · audio: 492804 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the second one does not give facts you could look up. Your turn. Does the second one give facts you could look up?

### right:feature::e2::f1
*expect: turn · turn_ended: True · 5.9s · audio: 277764 b64 bytes*
*note: student says "no"*

> Yes, that is right — the second one does not give facts you could look up.

### ask:genre::e2
*expect: turn · turn_ended: True · 9.4s · audio: 507524 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e2
*expect: turn · turn_ended: True · 12.3s · audio: 699524 b64 bytes*
*note: student says "Informational" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Poem. Your turn. What kind of writing is the second one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e2
*expect: turn · turn_ended: True · 3.7s · audio: 122244 b64 bytes*
*note: student says "Poem"*

> Yes, that one is Poem.

### ask:feature::e3::f4
*expect: turn · turn_ended: True · 5.1s · audio: 224644 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one teach a lesson at the end?

### wrong:feature::e3::f4
*expect: turn · turn_ended: True · 8.5s · audio: 474244 b64 bytes*
*note: student says "teach a lesson at the end" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does teach a lesson at the end. Your turn. Does the third one teach a lesson at the end?

### right:feature::e3::f4
*expect: turn · turn_ended: True · 5.4s · audio: 247684 b64 bytes*
*note: student says "yes"*

> Yes, that is right — the third one does teach a lesson at the end.

### ask:feature::e3::f1
*expect: turn · turn_ended: True · 6.3s · audio: 240680 b64 bytes*
*note: voice item (check-feature)*

> Your turn. Does the third one give facts you could look up?

### wrong:feature::e3::f1
*expect: turn · turn_ended: True · 9.2s · audio: 503684 b64 bytes*
*note: student says "give facts you could look up" — the thing they were asked about, said straight back — a real phrase the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. It is not a verdict, so it is not an answer, and the contract names this miss by name*

> My turn: the third one does not give facts you could look up. Your turn. Does the third one give facts you could look up?

### right:feature::e3::f1
*expect: turn · turn_ended: True · 5.7s · audio: 258564 b64 bytes*
*note: student says "no"*

> Yes, that is right — the third one does not give facts you could look up.

### ask:genre::e3
*expect: turn · turn_ended: True · 11.0s · audio: 502404 b64 bytes*
*note: voice item (name-genre)*

> Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### wrong:genre::e3
*expect: turn · turn_ended: True · 12.2s · audio: 684804 b64 bytes*
*note: student says "Folktale" — the SIBLING genre — the one that shares the answer's whole shape and differs on a single feature (folktale for fable, autobiography for biography, persuasive for informational). It is a real option on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: that one is Fable. Your turn. What kind of writing is the third one? Informational, Poem, Fable, Myth, or Folktale?

### right:genre::e3
*expect: turn · turn_ended: True · 3.6s · audio: 129924 b64 bytes*
*note: student says "Fable"*

> Yes, that one is Fable.

### complete
*expect: turn · turn_ended: True · 8.5s · audio: 463364 b64 bytes*

> Great reading today! You worked out what kind of writing each one was, and you told me every answer out loud. See you next time!
