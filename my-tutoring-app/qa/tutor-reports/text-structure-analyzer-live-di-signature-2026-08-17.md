# Tier-3 Live Tutor Report — text-structure-analyzer — 2026-08-17

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "text-structure-analyzer", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `signal::1::the-problem-is` | voice/find-signal | quickly | ✅✅ | The problem is | ✅✅ |
| `signal::2::one-solution` | voice/find-signal | inside | ✅✅ | One solution | ✅✅ |
| `signal::4::as-a-result` | voice/find-signal | frozen | ✅✅ | As a result | ✅✅ |
| `structure::problem-solution` | voice/name-structure | Cause and Effect | ✅✅ | Problem and Solution | ✅✅ |
| `idea::idea1` | voice/place-idea | Cold treats turn into messy liquid very quickly | ✅✅ | Trouble | ✅✅ |
| `idea::idea2` | voice/place-idea | Put the cups inside a larger bowl filled with ice | ✅✅ | Fix | ✅✅ |
| `idea::idea3` | voice/place-idea | Store owners keep storage freezers at very low temperatures | ✅✅ | Fix | ✅✅ |
| `idea::idea4` | voice/place-idea | Frozen snacks stay hard and tasty | ✅✅ | Fix | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:signal::1::the-problem-is
*expect: turn · turn_ended: True · 18.1s · audio: 1026600 b64 bytes*
*note: voice item (find-signal)*

> Hi! Let us take a close look at this passage together. I point you at one sentence — you read it and tell me which word links the ideas. A linking word joins one idea to another — it does not name a thing. Your turn. Read sentence two. Which word links the ideas?

### wrong:signal::1::the-problem-is
*expect: turn · turn_ended: True · 9.4s · audio: 517124 b64 bytes*
*note: student says "quickly" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: The problem is is the word that links the ideas there. Your turn. Read sentence two. Which word links the ideas?

### right:signal::1::the-problem-is
*expect: turn · turn_ended: True · 5.1s · audio: 218884 b64 bytes*
*note: student says "The problem is"*

> Yes, The problem is is the word that links them.

### ask:signal::2::one-solution
*expect: turn · turn_ended: True · 5.9s · audio: 259204 b64 bytes*
*note: voice item (find-signal)*

> Your turn. Read sentence three. Which word links the ideas?

### wrong:signal::2::one-solution
*expect: turn · turn_ended: True · 9.8s · audio: 524164 b64 bytes*
*note: student says "inside" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: One solution is the word that links the ideas there. Your turn. Read sentence three. Which word links the ideas?

### right:signal::2::one-solution
*expect: turn · turn_ended: True · 4.5s · audio: 197764 b64 bytes*
*note: student says "One solution"*

> Yes, One solution is the word that links them.

### ask:signal::4::as-a-result
*expect: turn · turn_ended: True · 6.4s · audio: 267524 b64 bytes*
*note: voice item (find-signal)*

> Your turn. Read sentence five. Which word links the ideas?

### wrong:signal::4::as-a-result
*expect: turn · turn_ended: True · 9.3s · audio: 506244 b64 bytes*
*note: student says "frozen" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: As a result is the word that links the ideas there. Your turn. Read sentence five. Which word links the ideas?

### right:signal::4::as-a-result
*expect: turn · turn_ended: True · 4.1s · audio: 178564 b64 bytes*
*note: student says "As a result"*

> Yes, As a result is the word that links them.

### ask:structure::problem-solution
*expect: turn · turn_ended: True · 16.2s · audio: 926724 b64 bytes*
*note: voice item (name-structure)*

> Now you tell me how the whole passage is put together. Think about what your linking words were doing. Your turn. Think about the whole passage. How is it put together? Problem and Solution, Cause and Effect, Compare and Contrast, or Time Order?

### wrong:structure::problem-solution
*expect: turn · turn_ended: True · 15.0s · audio: 862084 b64 bytes*
*note: student says "Cause and Effect" — the NEAREST structure — the sibling axis-2 deliberately puts in the menu at hard because both mean "this leads to that" (cause-effect against problem-solution). It is a real option, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: this passage is put together as Problem and Solution. Your turn. Think about the whole passage. How is it put together? Problem and Solution, Cause and Effect, Compare and Contrast, or Time Order?

### right:structure::problem-solution
*expect: turn · turn_ended: True · 5.2s · audio: 235524 b64 bytes*
*note: student says "Problem and Solution"*

> Yes, this passage is put together as Problem and Solution.

### ask:idea::idea1
*expect: turn · turn_ended: True · 16.2s · audio: 919684 b64 bytes*
*note: voice item (place-idea)*

> I read you one idea from the passage — you tell me where it belongs. Read the labels, then ask which one the idea answers. Your turn. Listen: Cold treats turn into messy liquid very quickly. Does that go with Trouble, or Fix?

### wrong:idea::idea1
*expect: turn · turn_ended: True · 11.5s · audio: 648324 b64 bytes*
*note: student says "Cold treats turn into messy liquid very quickly" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Trouble. Your turn. Listen: Cold treats turn into messy liquid very quickly. Does that go with Trouble, or Fix?

### right:idea::idea1
*expect: turn · turn_ended: True · 4.0s · audio: 163204 b64 bytes*
*note: student says "Trouble"*

> Yes, that one belongs with Trouble.

### ask:idea::idea2
*expect: turn · turn_ended: True · 9.1s · audio: 457604 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Put the cups inside a larger bowl filled with ice. Does that go with Trouble, or Fix?

### wrong:idea::idea2
*expect: turn · turn_ended: True · 11.9s · audio: 655364 b64 bytes*
*note: student says "Put the cups inside a larger bowl filled with ice" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Put the cups inside a larger bowl filled with ice. Does that go with Trouble, or Fix?

### right:idea::idea2
*expect: turn · turn_ended: True · 4.3s · audio: 146600 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### ask:idea::idea3
*expect: turn · turn_ended: True · 9.4s · audio: 485124 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Store owners keep storage freezers at very low temperatures. Does that go with Trouble, or Fix?

### wrong:idea::idea3
*expect: turn · turn_ended: True · 12.7s · audio: 698884 b64 bytes*
*note: student says "Store owners keep storage freezers at very low temperatures" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Store owners keep storage freezers at very low temperatures. Does that go with Trouble, or Fix?

### right:idea::idea3
*expect: turn · turn_ended: True · 4.4s · audio: 170884 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### ask:idea::idea4
*expect: turn · turn_ended: True · 8.1s · audio: 410884 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Frozen snacks stay hard and tasty. Does that go with Trouble, or Fix?

### wrong:idea::idea4
*expect: turn · turn_ended: True · 11.5s · audio: 632360 b64 bytes*
*note: student says "Frozen snacks stay hard and tasty" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Frozen snacks stay hard and tasty. Does that go with Trouble, or Fix?

### right:idea::idea4
*expect: turn · turn_ended: True · 4.1s · audio: 165764 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### complete
*expect: turn · turn_ended: True · 8.9s · audio: 456360 b64 bytes*

> Great reading today! You worked out how that whole passage was built, and you told me every answer out loud. See you next time!


## Run 2 — beat-by-beat transcript

### ask:signal::1::the-problem-is
*expect: turn · turn_ended: True · 18.4s · audio: 1066244 b64 bytes*
*note: voice item (find-signal)*

> Hi! Let us take a close look at this passage together. I point you at one sentence — you read it and tell me which word links the ideas. A linking word joins one idea to another — it does not name a thing. Your turn. Read sentence two. Which word links the ideas?

### wrong:signal::1::the-problem-is
*expect: turn · turn_ended: True · 9.9s · audio: 551044 b64 bytes*
*note: student says "quickly" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: The problem is is the word that links the ideas there. Your turn. Read sentence two. Which word links the ideas?

### right:signal::1::the-problem-is
*expect: turn · turn_ended: True · 4.8s · audio: 215684 b64 bytes*
*note: student says "The problem is"*

> Yes, The problem is is the word that links them.

### ask:signal::2::one-solution
*expect: turn · turn_ended: True · 5.6s · audio: 253448 b64 bytes*
*note: voice item (find-signal)*

> Your turn. Read sentence three. Which word links the ideas?

### wrong:signal::2::one-solution
*expect: turn · turn_ended: True · 9.4s · audio: 527368 b64 bytes*
*note: student says "inside" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: One solution is the word that links the ideas there. Your turn. Read sentence three. Which word links the ideas?

### right:signal::2::one-solution
*expect: turn · turn_ended: True · 4.8s · audio: 217640 b64 bytes*
*note: student says "One solution"*

> Yes, One solution is the word that links them.

### ask:signal::4::as-a-result
*expect: turn · turn_ended: True · 5.6s · audio: 256004 b64 bytes*
*note: voice item (find-signal)*

> Your turn. Read sentence five. Which word links the ideas?

### wrong:signal::4::as-a-result
*expect: turn · turn_ended: True · 9.7s · audio: 535048 b64 bytes*
*note: student says "frozen" — a CONTENT word read straight off the sentence the child was pointed at — this primitive's own documented commonest error (naming words instead of linking words). It is a real word, clearly read from the line, so a judge grading on "did they say a word from that sentence" affirms it*

> My turn: As a result is the word that links the ideas there. Your turn. Read sentence five. Which word links the ideas?

### right:signal::4::as-a-result
*expect: turn · turn_ended: True · 4.3s · audio: 179204 b64 bytes*
*note: student says "As a result"*

> Yes, As a result is the word that links them.

### ask:structure::problem-solution
*expect: turn · turn_ended: True · 16.2s · audio: 937604 b64 bytes*
*note: voice item (name-structure)*

> Now you tell me how the whole passage is put together. Think about what your linking words were doing. Your turn. Think about the whole passage. How is it put together? Problem and Solution, Cause and Effect, Compare and Contrast, or Time Order?

### wrong:structure::problem-solution
*expect: turn · turn_ended: True · 14.9s · audio: 860164 b64 bytes*
*note: student says "Cause and Effect" — the NEAREST structure — the sibling axis-2 deliberately puts in the menu at hard because both mean "this leads to that" (cause-effect against problem-solution). It is a real option, semantically adjacent, and telling the two apart is the entire skill being measured*

> My turn: this passage is put together as Problem and Solution. Your turn. Think about the whole passage. How is it put together? Problem and Solution, Cause and Effect, Compare and Contrast, or Time Order?

### right:structure::problem-solution
*expect: turn · turn_ended: True · 4.6s · audio: 215044 b64 bytes*
*note: student says "Problem and Solution"*

> Yes, this passage is put together as Problem and Solution.

### ask:idea::idea1
*expect: turn · turn_ended: True · 15.6s · audio: 901124 b64 bytes*
*note: voice item (place-idea)*

> I read you one idea from the passage — you tell me where it belongs. Read the labels, then ask which one the idea answers. Your turn. Listen: Cold treats turn into messy liquid very quickly. Does that go with Trouble, or Fix?

### wrong:idea::idea1
*expect: turn · turn_ended: True · 11.6s · audio: 631684 b64 bytes*
*note: student says "Cold treats turn into messy liquid very quickly" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Trouble. Your turn. Listen: Cold treats turn into messy liquid very quickly. Does that go with Trouble, or Fix?

### right:idea::idea1
*expect: turn · turn_ended: True · 3.5s · audio: 135684 b64 bytes*
*note: student says "Trouble"*

> Yes, that one belongs with Trouble.

### ask:idea::idea2
*expect: turn · turn_ended: True · 8.8s · audio: 448644 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Put the cups inside a larger bowl filled with ice. Does that go with Trouble, or Fix?

### wrong:idea::idea2
*expect: turn · turn_ended: True · 11.6s · audio: 647044 b64 bytes*
*note: student says "Put the cups inside a larger bowl filled with ice" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Put the cups inside a larger bowl filled with ice. Does that go with Trouble, or Fix?

### right:idea::idea2
*expect: turn · turn_ended: True · 3.6s · audio: 138920 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### ask:idea::idea3
*expect: turn · turn_ended: True · 9.2s · audio: 488324 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Store owners keep storage freezers at very low temperatures. Does that go with Trouble, or Fix?

### wrong:idea::idea3
*expect: turn · turn_ended: True · 12.4s · audio: 697604 b64 bytes*
*note: student says "Store owners keep storage freezers at very low temperatures" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Store owners keep storage freezers at very low temperatures. Does that go with Trouble, or Fix?

### right:idea::idea3
*expect: turn · turn_ended: True · 4.8s · audio: 159364 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### ask:idea::idea4
*expect: turn · turn_ended: True · 8.3s · audio: 430724 b64 bytes*
*note: voice item (place-idea)*

> Your turn. Listen: Frozen snacks stay hard and tasty. Does that go with Trouble, or Fix?

### wrong:idea::idea4
*expect: turn · turn_ended: True · 11.0s · audio: 626564 b64 bytes*
*note: student says "Frozen snacks stay hard and tasty" — the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. The contract names this miss by name*

> My turn: that idea belongs with Fix. Your turn. Listen: Frozen snacks stay hard and tasty. Does that go with Trouble, or Fix?

### right:idea::idea4
*expect: turn · turn_ended: True · 3.8s · audio: 158724 b64 bytes*
*note: student says "Fix"*

> Yes, that one belongs with Fix.

### complete
*expect: turn · turn_ended: True · 8.7s · audio: 465320 b64 bytes*

> Great reading today! You worked out how that whole passage was built, and you told me every answer out loud. See you next time!
