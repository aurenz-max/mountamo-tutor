# Tier-3 Live Tutor Report — sentence-analyzer — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "sentence-analyzer", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "ch1-pos-0", "grade": "Grade 4"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:ch1-pos-0 1/1, wrong3:ch1-pos-0 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:ch1-pos-0 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ch1-pos-0` | voice/name-pos | Conjunction | ✅✅✅ | - | n/a |
| `ch1-pos-1` | voice/name-pos | Conjunction | ✅ | Noun | ✅ |
| `ch1-pos-2` | voice/name-pos | Conjunction | ✅ | Verb | ✅ |
| `ch1-pos-3` | voice/name-pos | Conjunction | ✅ | Adverb | ✅ |
| `ch2-pos-0` | voice/name-pos | Conjunction | ✅ | Noun | ✅ |
| `ch2-pos-1` | voice/name-pos | Conjunction | ✅ | Verb | ✅ |
| `ch2-pos-2` | voice/name-pos | Conjunction | ✅ | Adjective | ✅ |
| `ch2-pos-4` | voice/name-pos | Conjunction | ✅ | Preposition | ✅ |
| `ch3-pos-0` | voice/name-pos | Conjunction | ✅ | Adjective | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1-pos-0
*expect: turn · turn_ended: True · 14.6s · audio: 834564 b64 bytes*
*note: voice item (name-pos)*

> Hi! Let us look at some sentences together. I name one word, and you tell me what part of speech it is. Ask yourself what that word is DOING in this sentence, not what it could be somewhere else. Your turn. What part of speech is the word Solid?

### wrong1:ch1-pos-0
*expect: turn · turn_ended: True · 6.7s · audio: 353924 b64 bytes*
*note: student says "Conjunction"*

> My turn: Solid is an Adjective. Your turn. What part of speech is the word Solid?

### wrong2:ch1-pos-0
*expect: turn · turn_ended: True · 6.9s · audio: 352644 b64 bytes*
*note: student says "Conjunction"*

> My turn: Solid is an Adjective. Your turn. What part of speech is the word Solid?

### wrong3:ch1-pos-0
*expect: turn · turn_ended: True · 6.8s · audio: 351364 b64 bytes*
*note: student says "Conjunction"*

> My turn: Solid is an Adjective. Your turn. What part of speech is the word Solid?

### moveon:ch1-pos-0
*expect: turn · turn_ended: True · 6.5s · audio: 314244 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! Here comes the next one. Your turn. What part of speech is the word ice?

### wrong:ch1-pos-1
*expect: turn · turn_ended: True · 6.5s · audio: 332164 b64 bytes*
*note: student says "Conjunction"*

> My turn: ice is a Noun. Your turn. What part of speech is the word ice?

### right:ch1-pos-1
*expect: turn · turn_ended: True · 3.3s · audio: 132484 b64 bytes*
*note: student says "Noun"*

> Yes, ice is a Noun.

### ask:ch1-pos-2
*expect: turn · turn_ended: True · 4.4s · audio: 181764 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word melts?

### wrong:ch1-pos-2
*expect: turn · turn_ended: True · 6.4s · audio: 329604 b64 bytes*
*note: student says "Conjunction"*

> My turn: melts is a Verb. Your turn. What part of speech is the word melts?

### right:ch1-pos-2
*expect: turn · turn_ended: True · 3.3s · audio: 131844 b64 bytes*
*note: student says "Verb"*

> Yes, melts is a Verb.

### ask:ch1-pos-3
*expect: turn · turn_ended: True · 4.4s · audio: 180484 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word very?

### wrong:ch1-pos-3
*expect: turn · turn_ended: True · 6.6s · audio: 341764 b64 bytes*
*note: student says "Conjunction"*

> My turn: very is an Adverb. Your turn. What part of speech is the word very?

### right:ch1-pos-3
*expect: turn · turn_ended: True · 3.6s · audio: 149124 b64 bytes*
*note: student says "Adverb"*

> Yes, very is an Adverb.

### ask:ch2-pos-0
*expect: turn · turn_ended: True · 4.5s · audio: 190120 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word Heat?

### wrong:ch2-pos-0
*expect: turn · turn_ended: True · 6.4s · audio: 327684 b64 bytes*
*note: student says "Conjunction"*

> My turn: Heat is a Noun. Your turn. What part of speech is the word Heat?

### right:ch2-pos-0
*expect: turn · turn_ended: True · 3.5s · audio: 124804 b64 bytes*
*note: student says "Noun"*

> Yes, Heat is a Noun.

### ask:ch2-pos-1
*expect: turn · turn_ended: True · 4.6s · audio: 192644 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word turns?

### wrong:ch2-pos-1
*expect: turn · turn_ended: True · 6.7s · audio: 347524 b64 bytes*
*note: student says "Conjunction"*

> My turn: turns is a Verb. Your turn. What part of speech is the word turns?

### right:ch2-pos-1
*expect: turn · turn_ended: True · 3.7s · audio: 122244 b64 bytes*
*note: student says "Verb"*

> Yes, turns is a Verb.

### ask:ch2-pos-2
*expect: turn · turn_ended: True · 4.4s · audio: 183684 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word liquid?

### wrong:ch2-pos-2
*expect: turn · turn_ended: True · 6.7s · audio: 349444 b64 bytes*
*note: student says "Conjunction"*

> My turn: liquid is an Adjective. Your turn. What part of speech is the word liquid?

### right:ch2-pos-2
*expect: turn · turn_ended: True · 3.7s · audio: 136964 b64 bytes*
*note: student says "Adjective"*

> Yes, liquid is an Adjective.

### ask:ch2-pos-4
*expect: turn · turn_ended: True · 4.7s · audio: 183044 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word into?

### wrong:ch2-pos-4
*expect: turn · turn_ended: True · 7.0s · audio: 359044 b64 bytes*
*note: student says "Conjunction"*

> My turn: into is a Preposition. Your turn. What part of speech is the word into?

### right:ch2-pos-4
*expect: turn · turn_ended: True · 3.8s · audio: 140164 b64 bytes*
*note: student says "Preposition"*

> Yes, into is a Preposition.

### ask:ch3-pos-0
*expect: turn · turn_ended: True · 4.6s · audio: 193284 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word Cold?

### wrong:ch3-pos-0
*expect: turn · turn_ended: True · 6.8s · audio: 355204 b64 bytes*
*note: student says "Conjunction"*

> My turn: Cold is an Adjective. Your turn. What part of speech is the word Cold?

### right:ch3-pos-0
*expect: turn · turn_ended: True · 4.1s · audio: 134404 b64 bytes*
*note: student says "Adjective"*

> Yes, Cold is an Adjective.

### complete
*expect: turn · turn_ended: True · 8.2s · audio: 442884 b64 bytes*

> Great grammar work today! You worked out what every word was doing, and you told me each answer out loud. See you next time!
