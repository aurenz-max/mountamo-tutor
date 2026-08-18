# Tier-3 Live Tutor Report — sentence-analyzer — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "sentence-analyzer", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 4"}`
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
| `ch1-pos-0` | voice/name-pos | Adverb | ✅ | Adjective | ✅ |
| `ch1-pos-1` | voice/name-pos | Pronoun | ✅ | Noun | ✅ |
| `ch2-pos-1` | voice/name-pos | Noun | ✅ | Verb | ✅ |
| `ch2-pos-3` | voice/name-pos | Noun | ✅ | Preposition | ✅ |
| `ch3-pos-0` | voice/name-pos | Adverb | ✅ | Adjective | ✅ |
| `ch3-pos-1` | voice/name-pos | Pronoun | ✅ | Noun | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1-pos-0
*expect: turn · turn_ended: True · 16.1s · audio: 934404 b64 bytes*
*note: voice item (name-pos)*

> Hi! Let us look at some sentences together. I name one word, and you tell me what part of speech it is. Ask yourself what that word is DOING in this sentence, not what it could be somewhere else. Your turn. What part of speech is the word Solid?

### wrong:ch1-pos-0
*expect: turn · turn_ended: True · 7.5s · audio: 401284 b64 bytes*
*note: student says "Adverb" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: Solid is an Adjective. Your turn. What part of speech is the word Solid?

### right:ch1-pos-0
*expect: turn · turn_ended: True · 4.2s · audio: 163204 b64 bytes*
*note: student says "Adjective"*

> Yes, Solid is an Adjective.

### ask:ch1-pos-1
*expect: turn · turn_ended: True · 4.8s · audio: 206084 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word ice?

### wrong:ch1-pos-1
*expect: turn · turn_ended: True · 7.2s · audio: 362884 b64 bytes*
*note: student says "Pronoun" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: ice is a Noun. Your turn. What part of speech is the word ice?

### right:ch1-pos-1
*expect: turn · turn_ended: True · 3.3s · audio: 131844 b64 bytes*
*note: student says "Noun"*

> Yes, ice is a Noun.

### ask:ch2-pos-1
*expect: turn · turn_ended: True · 5.0s · audio: 219560 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word turns?

### wrong:ch2-pos-1
*expect: turn · turn_ended: True · 7.1s · audio: 376360 b64 bytes*
*note: student says "Noun" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: turns is a Verb. Your turn. What part of speech is the word turns?

### right:ch2-pos-1
*expect: turn · turn_ended: True · 3.8s · audio: 135044 b64 bytes*
*note: student says "Verb"*

> Yes, turns is a Verb.

### ask:ch2-pos-3
*expect: turn · turn_ended: True · 4.6s · audio: 196484 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word into?

### wrong:ch2-pos-3
*expect: turn · turn_ended: True · 7.2s · audio: 380164 b64 bytes*
*note: student says "Noun" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: into is a Preposition. Your turn. What part of speech is the word into?

### right:ch2-pos-3
*expect: turn · turn_ended: True · 4.6s · audio: 161960 b64 bytes*
*note: student says "Preposition"*

> Yes, into is a Preposition.

### ask:ch3-pos-0
*expect: turn · turn_ended: True · 4.7s · audio: 195204 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word Cold?

### wrong:ch3-pos-0
*expect: turn · turn_ended: True · 7.0s · audio: 370564 b64 bytes*
*note: student says "Adverb" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: Cold is an Adjective. Your turn. What part of speech is the word Cold?

### right:ch3-pos-0
*expect: turn · turn_ended: True · 3.9s · audio: 155524 b64 bytes*
*note: student says "Adjective"*

> Yes, Cold is an Adjective.

### ask:ch3-pos-1
*expect: turn · turn_ended: True · 4.5s · audio: 190084 b64 bytes*
*note: voice item (name-pos)*

> Your turn. What part of speech is the word air?

### wrong:ch3-pos-1
*expect: turn · turn_ended: True · 6.7s · audio: 348164 b64 bytes*
*note: student says "Pronoun" — the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, both are real vocabulary the child has been taught, one label literally contains the other, and separating them is the whole mode. The click era's own commonStruggles list opens with exactly these two pairs*

> My turn: air is a Noun. Your turn. What part of speech is the word air?

### right:ch3-pos-1
*expect: turn · turn_ended: True · 3.5s · audio: 125444 b64 bytes*
*note: student says "Noun"*

> Yes, air is a Noun.

### complete
*expect: turn · turn_ended: True · 8.6s · audio: 476200 b64 bytes*

> Great grammar work today! You worked out what every word was doing, and you told me each answer out loud. See you next time!
