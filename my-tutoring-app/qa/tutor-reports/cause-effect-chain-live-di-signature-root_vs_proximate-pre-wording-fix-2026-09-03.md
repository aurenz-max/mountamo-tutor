# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "cause-effect-chain", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 5", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**FAIL** — 1 HIGH + 0 WARN mechanism(s) confirmed (2 + 0 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | HIGH | `di-false-completion-claim` | right:cec-2 1/1, right:cec-4 1/1 (2 beats) | told the child the work is over with items still queued: "...that was the last..." in "Yes, that was the last thing to happen before the ending." |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `cec-1` | voice/root_vs_proximate | operators | ✅ | blacksmiths | ✅ |
| `cec-2` | voice/root_vs_proximate | workshops | ✅ | teachers | ✅ |
| `cec-3` | voice/root_vs_proximate | couriers | ✅ | inventors | ✅ |
| `cec-4` | voice/root_vs_proximate | scholars | ✅ | workers | ✅ |
| `cec-5` | voice/root_vs_proximate | printers | ✅ | astronomers | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:cec-1
*expect: turn · turn_ended: True · 30.5s · audio: 1843844 b64 bytes*
*note: voice item (root_vs_proximate)*

> Hi! Time to be a historian and work out what led to what! I tell you how something ended and show you the events — you say which ONE event the question is after, out loud! The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Listen. In the end: Workers printed thousands of identical books in just a few weeks. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-1
*expect: turn · turn_ended: True · 20.4s · audio: 1233960 b64 bytes*
*note: student says "operators" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Your turn. Listen again. In the end: Workers printed thousands of identical books in just a few weeks. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-1
*expect: turn · turn_ended: True · 6.4s · audio: 318724 b64 bytes*
*note: student says "blacksmiths"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### ask:cec-2
*expect: turn · turn_ended: True · 11.4s · audio: 631044 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Children learned how to read books in village schoolrooms. The events are on the cards. Your turn. Say which event happened last — the one right before the ending.

### wrong:cec-2
*expect: turn · turn_ended: True · 19.8s · audio: 1187844 b64 bytes*
*note: student says "workshops" — the ROOT named when the last event was asked for — "the biggest" mistaken for "the last"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Your turn. Listen again. In the end: Children learned how to read books in village schoolrooms. The events are on the cards. Say which event happened last — the one right before the ending.

### right:cec-2
*expect: turn · turn_ended: True · 4.2s · audio: 193284 b64 bytes*
*note: student says "teachers"*

> Yes, that was the last thing to happen before the ending.

### ask:cec-3
*expect: turn · turn_ended: True · 12.9s · audio: 718084 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Citizens read printed broadsheets about distant government laws. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-3
*expect: turn · turn_ended: True · 21.6s · audio: 1256324 b64 bytes*
*note: student says "couriers" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Your turn. Listen again. In the end: Citizens read printed broadsheets about distant government laws. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-3
*expect: turn · turn_ended: True · 6.0s · audio: 305284 b64 bytes*
*note: student says "inventors"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### ask:cec-4
*expect: turn · turn_ended: True · 11.8s · audio: 656004 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Believers studied religious scripture in their native languages. The events are on the cards. Your turn. Say which event happened last — the one right before the ending.

### wrong:cec-4
*expect: turn · turn_ended: True · 20.2s · audio: 1200004 b64 bytes*
*note: student says "scholars" — the ROOT named when the last event was asked for — "the biggest" mistaken for "the last"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Your turn. Listen again. In the end: Believers studied religious scripture in their native languages. The events are on the cards. Say which event happened last — the one right before the ending.

### right:cec-4
*expect: turn · turn_ended: True · 4.5s · audio: 201604 b64 bytes*
*note: student says "workers"*

> Yes, that was the last thing to happen before the ending.

### ask:cec-5
*expect: turn · turn_ended: True · 12.3s · audio: 684804 b64 bytes*
*note: voice item (root_vs_proximate)*

> Listen. In the end: Scientists shared star charts across different countries. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

### wrong:cec-5
*expect: turn · turn_ended: True · 20.9s · audio: 1255684 b64 bytes*
*note: student says "printers" — the LAST event named when the root was asked for — "the closest" mistaken for "the root"*

> My turn: The root is the event nothing else could have happened without. The one right before the ending is simply the last thing to happen. Your turn. Listen again. In the end: Scientists shared star charts across different countries. The events are on the cards. Say which event is the root — the one that had to happen before any of the others could.

### right:cec-5
*expect: turn · turn_ended: True · 6.0s · audio: 290564 b64 bytes*
*note: student says "astronomers"*

> Yes, that is the root — take that event away and none of the rest could have happened.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 381444 b64 bytes*

> What good history today! You worked out what had to happen before what, all by yourself. See you next time!
