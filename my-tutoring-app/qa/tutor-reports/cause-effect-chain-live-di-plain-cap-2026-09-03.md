# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "cause-effect-chain", "items": 10, "voice_items": 10, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "cec-1:cec-1-1", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:cec-1:cec-1-1 1/1, wrong3:cec-1:cec-1-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:cec-1:cec-1-1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `cec-1:cec-1-1` | voice/identify_cause | no | ✅✅✅ | - | n/a |
| `cec-1:cec-1-2` | voice/identify_cause | no | ✅ | yes | ✅ |
| `cec-1:cec-1-d2` | voice/identify_cause | yes | ✅ | no | ✅ |
| `cec-1:cec-1-d1` | voice/identify_cause | yes | ✅ | no | ✅ |
| `cec-2:cec-2-d2` | voice/identify_cause | yes | ✅ | no | ✅ |
| `cec-2:cec-2-1` | voice/identify_cause | no | ✅ | yes | ✅ |
| `cec-2:cec-2-3` | voice/identify_cause | no | ✅ | yes | ✅ |
| `cec-2:cec-2-d1` | voice/identify_cause | yes | ✅ | no | ✅ |
| `cec-3:cec-3-3` | voice/identify_cause | no | ✅ | yes | ✅ |
| `cec-3:cec-3-d2` | voice/identify_cause | yes | ✅ | no | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:cec-1:cec-1-1
*expect: turn · turn_ended: True · 33.6s · audio: 2050564 b64 bytes*
*note: voice item (identify_cause)*

> Hi! Time to be a historian and work out what led to what! I tell you how something ended, then I read you one event at a time — you say yes if it helped cause the ending, or no if it did not, out loud! An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Listen. In the end: Letters arrive from eastern cities in days instead of months. Here is one event: Railway crews lay heavy iron rails across the open prairie. Your turn. Did this event help cause the ending — yes or no?

### wrong1:cec-1:cec-1-1
*expect: turn · turn_ended: True · 23.6s · audio: 1424644 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Letters arrive from eastern cities in days instead of months. Here is one event: Railway crews lay heavy iron rails across the open prairie. Did this event help cause the ending — yes or no?

### wrong2:cec-1:cec-1-1
*expect: turn · turn_ended: True · 24.1s · audio: 1457284 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Letters arrive from eastern cities in days instead of months. Here is one event: Railway crews lay heavy iron rails across the open prairie. Did this event help cause the ending — yes or no?

### wrong3:cec-1:cec-1-1
*expect: turn · turn_ended: True · 24.4s · audio: 1484164 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Letters arrive from eastern cities in days instead of months. Here is one event: Railway crews lay heavy iron rails across the open prairie. Did this event help cause the ending — yes or no?

### moveon:cec-1:cec-1-1
*expect: turn · turn_ended: True · 20.2s · audio: 1187204 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! That one did help cause the ending. Here comes the next one. Listen. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Steam locomotives pull loaded mail cars directly into the new station. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-1:cec-1-2
*expect: turn · turn_ended: True · 24.8s · audio: 1510404 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Steam locomotives pull loaded mail cars directly into the new station. Did this event help cause the ending — yes or no?

### right:cec-1:cec-1-2
*expect: turn · turn_ended: True · 5.8s · audio: 284164 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending — it came before, and the ending needed it.

### ask:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 15.5s · audio: 888324 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Farmers hitch tired oxen to heavy wooden plows every morning. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 25.1s · audio: 1502724 b64 bytes*
*note: student says "yes"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Farmers hitch tired oxen to heavy wooden plows every morning. Did this event help cause the ending — yes or no?

### right:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 6.0s · audio: 296324 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause — it was true at the time, but it pushed nothing along.

### ask:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 15.5s · audio: 885764 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Children run down to the wooden platform to wave at the passengers. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 25.0s · audio: 1501444 b64 bytes*
*note: student says "yes"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters arrive from eastern cities in days instead of months. Here is another event: Children run down to the wooden platform to wave at the passengers. Did this event help cause the ending — yes or no?

### right:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 6.0s · audio: 304004 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause — it could only happen once the ending had already happened.

### ask:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 15.1s · audio: 860804 b64 bytes*
*note: voice item (identify_cause)*

> Listen. In the end: Children attend classes inside a brand new brick schoolhouse. Here is one event: Windmills pump cold water from deep underground into watering troughs. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 24.3s · audio: 1468804 b64 bytes*
*note: student says "yes"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Children attend classes inside a brand new brick schoolhouse. Here is one event: Windmills pump cold water from deep underground into watering troughs. Did this event help cause the ending — yes or no?

### right:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 5.9s · audio: 291844 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause — it was true at the time, but it pushed nothing along.

### ask:cec-2:cec-2-1
*expect: turn · turn_ended: True · 15.8s · audio: 904324 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Carpenters unload cut timber and glass windows from freight wagons. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-2:cec-2-1
*expect: turn · turn_ended: True · 25.0s · audio: 1517444 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Carpenters unload cut timber and glass windows from freight wagons. Did this event help cause the ending — yes or no?

### right:cec-2:cec-2-1
*expect: turn · turn_ended: True · 5.8s · audio: 286724 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending — it came before, and the ending needed it.

### ask:cec-2:cec-2-3
*expect: turn · turn_ended: True · 15.2s · audio: 865284 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Families pack slate boards and chalk into small woven satchels. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-2:cec-2-3
*expect: turn · turn_ended: True · 25.3s · audio: 1532164 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Families pack slate boards and chalk into small woven satchels. Did this event help cause the ending — yes or no?

### right:cec-2:cec-2-3
*expect: turn · turn_ended: True · 5.9s · audio: 290564 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending — it came before, and the ending needed it.

### ask:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 15.7s · audio: 901124 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Students play tag in the dusty dirt yard during the afternoon recess. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 25.7s · audio: 1557124 b64 bytes*
*note: student says "yes"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Children attend classes inside a brand new brick schoolhouse. Here is another event: Students play tag in the dusty dirt yard during the afternoon recess. Did this event help cause the ending — yes or no?

### right:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 6.6s · audio: 335400 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause — it could only happen once the ending had already happened.

### ask:cec-3:cec-3-3
*expect: turn · turn_ended: True · 16.3s · audio: 937000 b64 bytes*
*note: voice item (identify_cause)*

> Listen. In the end: Town residents pump fresh drinking water from a deep metal well. Here is one event: Workers bolt a heavy iron handle onto the concrete pump base. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-3:cec-3-3
*expect: turn · turn_ended: True · 26.3s · audio: 1589800 b64 bytes*
*note: student says "no"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Town residents pump fresh drinking water from a deep metal well. Here is one event: Workers bolt a heavy iron handle onto the concrete pump base. Did this event help cause the ending — yes or no?

### right:cec-3:cec-3-3
*expect: turn · turn_ended: True · 6.4s · audio: 309124 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending — it came before, and the ending needed it.

### ask:cec-3:cec-3-d2
*expect: turn · turn_ended: True · 17.3s · audio: 985640 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Town residents pump fresh drinking water from a deep metal well. Here is another event: Town council members write new rules about keeping stray horses out of yards. Your turn. Did this event help cause the ending — yes or no?

### wrong:cec-3:cec-3-d2
*expect: turn · turn_ended: True · 26.9s · audio: 1635844 b64 bytes*
*note: student says "yes"*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Town residents pump fresh drinking water from a deep metal well. Here is another event: Town council members write new rules about keeping stray horses out of yards. Did this event help cause the ending — yes or no?

### right:cec-3:cec-3-d2
*expect: turn · turn_ended: True · 6.7s · audio: 316804 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause — it was true at the time, but it pushed nothing along.

### complete
*expect: turn · turn_ended: True · 12.8s · audio: 782088 b64 bytes*

> What good history today! You worked out what had to happen before what, all by yourself. See you next time!What good history today! You worked out what had to happen before what, all by yourself. See you next time!
