# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "cause-effect-chain", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 5", "undrivable_items": []}`
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
| `cec-1` | voice/root_vs_proximate | shop | ✅ | metal | ✅ |
| `cec-2` | voice/root_vs_proximate | craftsmen | ✅ | local | ✅ |
| `cec-3` | voice/root_vs_proximate | print | ✅ | artists | ✅ |
| `cec-4` | voice/root_vs_proximate | scholars | ✅ | press | ✅ |
| `cec-5` | voice/root_vs_proximate | binders | ✅ | writers | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:cec-1
*expect: turn · turn_ended: True · 33.0s · audio: 2018564 b64 bytes*
*note: voice item (root_vs_proximate)*

> Hi! Time to be a historian and work out what led to what! I tell you how something ended and show you the events — you say which ONE event the question is after, out loud! The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Listen. In the end: Workers print thousands of identical books in just a few weeks. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-1
*expect: turn · turn_ended: True · 23.4s · audio: 1408644 b64 bytes*
*note: student says "shop" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Your turn. Listen again. In the end: Workers print thousands of identical books in just a few weeks. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-1
*expect: turn · turn_ended: True · 6.3s · audio: 325124 b64 bytes*
*note: student says "metal"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### ask:cec-2
*expect: turn · turn_ended: True · 14.6s · audio: 830724 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Ordinary children learn how to read in neighborhood village classrooms. The events are on the cards. Your turn. Say which event came right before the ending — the final step before it.

### wrong:cec-2
*expect: turn · turn_ended: True · 22.0s · audio: 1331240 b64 bytes*
*note: student says "craftsmen" — the ROOT named when the last event was asked for — "the biggest" mistaken for "the last"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Your turn. Listen again. In the end: Ordinary children learn how to read in neighborhood village classrooms. The events are on the cards. Say which event came right before the ending — the final step before it.

### right:cec-2
*expect: turn · turn_ended: True · 5.1s · audio: 252164 b64 bytes*
*note: student says "local"*

> Yes, that one came right before the ending — nothing else happened in between.

### ask:cec-3
*expect: turn · turn_ended: True · 17.4s · audio: 1000964 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Doctors across different countries share surgical techniques using identical illustrated manuals. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-3
*expect: turn · turn_ended: True · 25.1s · audio: 1507204 b64 bytes*
*note: student says "print" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Your turn. Listen again. In the end: Doctors across different countries share surgical techniques using identical illustrated manuals. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-3
*expect: turn · turn_ended: True · 6.7s · audio: 328324 b64 bytes*
*note: student says "artists"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### ask:cec-4
*expect: turn · turn_ended: True · 15.6s · audio: 883844 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Ordinary believers read holy scriptures in their own spoken languages at home. The events are on the cards. Your turn. Say which event came right before the ending — the final step before it.

### wrong:cec-4
*expect: turn · turn_ended: True · 23.5s · audio: 1422084 b64 bytes*
*note: student says "scholars" — the ROOT named when the last event was asked for — "the biggest" mistaken for "the last"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Your turn. Listen again. In the end: Ordinary believers read holy scriptures in their own spoken languages at home. The events are on the cards. Say which event came right before the ending — the final step before it.

### right:cec-4
*expect: turn · turn_ended: True · 5.5s · audio: 274564 b64 bytes*
*note: student says "press"*

> Yes, that one came right before the ending — nothing else happened in between.

### ask:cec-5
*expect: turn · turn_ended: True · 16.2s · audio: 940164 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Political debates spread quickly across city squares through short paper leaflets. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-5
*expect: turn · turn_ended: True · 24.1s · audio: 1456004 b64 bytes*
*note: student says "binders" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it. Your turn. Listen again. In the end: Political debates spread quickly across city squares through short paper leaflets. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-5
*expect: turn · turn_ended: True · 6.3s · audio: 310404 b64 bytes*
*note: student says "writers"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### complete
*expect: turn · turn_ended: True · 7.1s · audio: 377604 b64 bytes*

> What good history today! You worked out what had to happen before what, all by yourself. See you next time!
