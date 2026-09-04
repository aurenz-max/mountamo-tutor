# Tier-3 Live Tutor Report — matter-explorer — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "matter-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "undrivable_items": []}`
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
| `chal-1` | voice/name_undo | solid | ✅ | go back | ✅ |
| `chal-3` | voice/name_undo | solid | ✅ | for ever | ✅ |
| `chal-2` | voice/name_undo | liquid | ✅ | go back | ✅ |
| `chal-4` | voice/name_undo | solid | ✅ | for ever | ✅ |
| `chal-5` | voice/name_undo | solid | ✅ | for ever | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 23.7s · audio: 1416324 b64 bytes*
*note: voice item (name_undo)*

> Hi! Time to find out what everything around us is made of! I tell you what happened to something — you say if we could put it back the way it was, out loud! Some changes can go back the way they were, and some changes are for ever. We left the ice somewhere warm until it melted. Your turn. Tell me — can it go back the way it was, or is it changed for ever?

### wrong:chal-1
*expect: turn · turn_ended: True · 12.5s · audio: 727720 b64 bytes*
*note: student says "solid" — the STATE named instead of whether the change undoes — the answer this pack has been asking for all session, arriving on the one mode that does not want it*

> My turn: Some changes can go back the way they were, and some changes are for ever. Your turn. Think about the ice again — can it go back the way it was, or is it changed for ever?

### right:chal-1
*expect: turn · turn_ended: True · 7.1s · audio: 367364 b64 bytes*
*note: student says "go back"*

> Yes, the ice can go back the way it was — we can make it cold and get it just how it was.

### ask:chal-3
*expect: turn · turn_ended: True · 9.1s · audio: 478084 b64 bytes*
*note: voice item (name_undo)*

> We tore the paper into little pieces. Your turn. Tell me — can it go back the way it was, or is it changed for ever?

### wrong:chal-3
*expect: turn · turn_ended: True · 12.7s · audio: 732164 b64 bytes*
*note: student says "solid" — the STATE named instead of whether the change undoes — the answer this pack has been asking for all session, arriving on the one mode that does not want it*

> My turn: Some changes can go back the way they were, and some changes are for ever. Your turn. Think about the paper again — can it go back the way it was, or is it changed for ever?

### right:chal-3
*expect: turn · turn_ended: True · 6.9s · audio: 347524 b64 bytes*
*note: student says "for ever"*

> Yes, the paper is changed for ever — the pieces will not join up into one whole piece.

### ask:chal-2
*expect: turn · turn_ended: True · 9.4s · audio: 494084 b64 bytes*
*note: voice item (name_undo)*

> We put the water in the freezer until it went hard. Your turn. Tell me — can it go back the way it was, or is it changed for ever?

### wrong:chal-2
*expect: turn · turn_ended: True · 12.5s · audio: 720644 b64 bytes*
*note: student says "liquid" — the STATE named instead of whether the change undoes — the answer this pack has been asking for all session, arriving on the one mode that does not want it*

> My turn: Some changes can go back the way they were, and some changes are for ever. Your turn. Think about the water again — can it go back the way it was, or is it changed for ever?

### right:chal-2
*expect: turn · turn_ended: True · 7.2s · audio: 373800 b64 bytes*
*note: student says "go back"*

> Yes, the water can go back the way it was — we can let it warm up and get it just how it was.

### ask:chal-4
*expect: turn · turn_ended: True · 9.9s · audio: 487684 b64 bytes*
*note: voice item (name_undo)*

> We put the bread dough in a hot oven and baked it. Your turn. Tell me — can it go back the way it was, or is it changed for ever?

### wrong:chal-4
*expect: turn · turn_ended: True · 13.6s · audio: 770564 b64 bytes*
*note: student says "solid" — the STATE named instead of whether the change undoes — the answer this pack has been asking for all session, arriving on the one mode that does not want it*

> My turn: Some changes can go back the way they were, and some changes are for ever. Your turn. Think about the bread dough again — can it go back the way it was, or is it changed for ever?

### right:chal-4
*expect: turn · turn_ended: True · 7.9s · audio: 404484 b64 bytes*
*note: student says "for ever"*

> Yes, the bread dough is changed for ever — what comes out of the oven is a new thing, and it stays that way.

### ask:chal-5
*expect: turn · turn_ended: True · 10.5s · audio: 476164 b64 bytes*
*note: voice item (name_undo)*

> We cooked the egg in a hot pan. Your turn. Tell me — can it go back the way it was, or is it changed for ever?

### wrong:chal-5
*expect: turn · turn_ended: True · 12.9s · audio: 743044 b64 bytes*
*note: student says "solid" — the STATE named instead of whether the change undoes — the answer this pack has been asking for all session, arriving on the one mode that does not want it*

> My turn: Some changes can go back the way they were, and some changes are for ever. Your turn. Think about the egg again — can it go back the way it was, or is it changed for ever?

### right:chal-5
*expect: turn · turn_ended: True · 7.6s · audio: 391684 b64 bytes*
*note: student says "for ever"*

> Yes, the egg is changed for ever — a cooked thing does not turn raw again, however cold it gets.

### complete
*expect: turn · turn_ended: True · 8.1s · audio: 441000 b64 bytes*

> What great science today! You looked at ordinary things and worked out what they are made of. See you next time!
