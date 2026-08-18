# Tier-3 Live Tutor Report — sentence-analyzer — 2026-08-17

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "sentence-analyzer", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 5"}`
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
| `ch1-side-0` | voice/name-side | predicate | ✅ | subject | ✅ |
| `ch1-side-1` | voice/name-side | predicate | ✅ | subject | ✅ |
| `ch1-side-2` | voice/name-side | subject | ✅ | predicate | ✅ |
| `ch1-type` | voice/name-type | Exclamatory | ✅ | Declarative | ✅ |
| `ch2-side-0` | voice/name-side | predicate | ✅ | subject | ✅ |
| `ch2-side-1` | voice/name-side | predicate | ✅ | subject | ✅ |
| `ch2-side-2` | voice/name-side | subject | ✅ | predicate | ✅ |
| `ch3-side-0` | voice/name-side | predicate | ✅ | subject | ✅ |
| `ch3-side-1` | voice/name-side | predicate | ✅ | subject | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:ch1-side-0
*expect: turn · turn_ended: True · 16.6s · audio: 959364 b64 bytes*
*note: voice item (name-side)*

> Hi! Let us look at some sentences together. I name one word, and you tell me whether it is in the subject or in the predicate. The subject is who or what the sentence is about; everything else is the predicate. Your turn. Is the word Solid in the subject or in the predicate?

### wrong:ch1-side-0
*expect: turn · turn_ended: True · 7.2s · audio: 385284 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: Solid is in the subject. Your turn. Is the word Solid in the subject or in the predicate?

### right:ch1-side-0
*expect: turn · turn_ended: True · 4.0s · audio: 149764 b64 bytes*
*note: student says "subject"*

> Yes, Solid is in the subject.

### ask:ch1-side-1
*expect: turn · turn_ended: True · 5.0s · audio: 227204 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word ice in the subject or in the predicate?

### wrong:ch1-side-1
*expect: turn · turn_ended: True · 7.3s · audio: 374404 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: ice is in the subject. Your turn. Is the word ice in the subject or in the predicate?

### right:ch1-side-1
*expect: turn · turn_ended: True · 3.7s · audio: 132484 b64 bytes*
*note: student says "subject"*

> Yes, ice is in the subject.

### ask:ch1-side-2
*expect: turn · turn_ended: True · 5.1s · audio: 218884 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word melts in the subject or in the predicate?

### wrong:ch1-side-2
*expect: turn · turn_ended: True · 7.0s · audio: 365444 b64 bytes*
*note: student says "subject" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: melts is in the predicate. Your turn. Is the word melts in the subject or in the predicate?

### right:ch1-side-2
*expect: turn · turn_ended: True · 3.4s · audio: 132484 b64 bytes*
*note: student says "predicate"*

> Yes, melts is in the predicate.

### ask:ch1-type
*expect: turn · turn_ended: True · 9.9s · audio: 529924 b64 bytes*
*note: voice item (name-type)*

> Now you tell me what kind of sentence it is. Listen to how the sentence ends, and to what it is trying to do. Your turn. What kind of sentence is this?

### wrong:ch1-type
*expect: turn · turn_ended: True · 6.5s · audio: 333444 b64 bytes*
*note: student says "Exclamatory" — the DEFAULT. Every sentence looks declarative if you do not read its ending, so this is what a child says when they have not looked — and on the many sentences that really are declarative it is right for the wrong reason, which is why the drive says it on the ones that are not*

> My turn: that is a Declarative sentence. Your turn. What kind of sentence is this?

### right:ch1-type
*expect: turn · turn_ended: True · 3.6s · audio: 151044 b64 bytes*
*note: student says "Declarative"*

> Yes, that is a Declarative sentence.

### ask:ch2-side-0
*expect: turn · turn_ended: True · 4.9s · audio: 215684 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word Hot in the subject or in the predicate?

### wrong:ch2-side-0
*expect: turn · turn_ended: True · 7.3s · audio: 369924 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: Hot is in the subject. Your turn. Is the word Hot in the subject or in the predicate?

### right:ch2-side-0
*expect: turn · turn_ended: True · 3.4s · audio: 135684 b64 bytes*
*note: student says "subject"*

> Yes, Hot is in the subject.

### ask:ch2-side-1
*expect: turn · turn_ended: True · 4.9s · audio: 218244 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word steam in the subject or in the predicate?

### wrong:ch2-side-1
*expect: turn · turn_ended: True · 7.2s · audio: 378884 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: steam is in the subject. Your turn. Is the word steam in the subject or in the predicate?

### right:ch2-side-1
*expect: turn · turn_ended: True · 3.9s · audio: 142084 b64 bytes*
*note: student says "subject"*

> Yes, steam is in the subject.

### ask:ch2-side-2
*expect: turn · turn_ended: True · 5.1s · audio: 225924 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word rises in the subject or in the predicate?

### wrong:ch2-side-2
*expect: turn · turn_ended: True · 7.2s · audio: 386564 b64 bytes*
*note: student says "subject" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: rises is in the predicate. Your turn. Is the word rises in the subject or in the predicate?

### right:ch2-side-2
*expect: turn · turn_ended: True · 3.8s · audio: 142724 b64 bytes*
*note: student says "predicate"*

> Yes, rises is in the predicate.

### ask:ch3-side-0
*expect: turn · turn_ended: True · 5.2s · audio: 236804 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word Cold in the subject or in the predicate?

### wrong:ch3-side-0
*expect: turn · turn_ended: True · 8.5s · audio: 373764 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: Cold is in the subject. Your turn. Is the word Cold in the subject or in the predicate?

### right:ch3-side-0
*expect: turn · turn_ended: True · 3.7s · audio: 155524 b64 bytes*
*note: student says "subject"*

> Yes, Cold is in the subject.

### ask:ch3-side-1
*expect: turn · turn_ended: True · 5.7s · audio: 248964 b64 bytes*
*note: voice item (name-side)*

> Your turn. Is the word temperatures in the subject or in the predicate?

### wrong:ch3-side-1
*expect: turn · turn_ended: True · 7.8s · audio: 424964 b64 bytes*
*note: student says "predicate" — the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the click era's own key produced (role.includes('subject') put "The" and "clever" in the predicate). The judge must refuse the wrong side even where the primitive itself used to assert it, which makes this the drive that proves the key fix landed*

> My turn: temperatures is in the subject. Your turn. Is the word temperatures in the subject or in the predicate?

### right:ch3-side-1
*expect: turn · turn_ended: True · 4.2s · audio: 176040 b64 bytes*
*note: student says "subject"*

> Yes, temperatures is in the subject.

### complete
*expect: turn · turn_ended: True · 8.4s · audio: 456964 b64 bytes*

> Great grammar work today! You worked out what every word was doing, and you told me each answer out loud. See you next time!
