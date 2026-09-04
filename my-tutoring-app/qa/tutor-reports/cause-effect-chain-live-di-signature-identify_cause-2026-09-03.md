# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "cause-effect-chain", "items": 10, "voice_items": 10, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `cec-1:cec-1-2` | voice/identify_cause | no, that was not the last thing that happened | ✅ | yes | ✅ |
| `cec-1:cec-1-1` | voice/identify_cause | no, that was not the last thing that happened | ✅ | yes | ✅ |
| `cec-1:cec-1-d1` | voice/identify_cause | yes, it is about the same thing | ✅ | no | ✅ |
| `cec-1:cec-1-d2` | voice/identify_cause | yes, that was true back then | ✅ | no | ✅ |
| `cec-2:cec-2-2` | voice/identify_cause | no, that was not the last thing that happened | ✅ | yes | ✅ |
| `cec-2:cec-2-1` | voice/identify_cause | no, that was not the last thing that happened | ✅ | yes | ✅ |
| `cec-2:cec-2-d2` | voice/identify_cause | yes, that was true back then | ✅ | no | ✅ |
| `cec-2:cec-2-d1` | voice/identify_cause | yes, it is about the same thing | ✅ | no | ✅ |
| `cec-3:cec-3-3` | voice/identify_cause | no, that was not the last thing that happened | ✅ | yes | ✅ |
| `cec-3:cec-3-d1` | voice/identify_cause | yes, it is about the same thing | ✅ | no | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:cec-1:cec-1-2
*expect: turn · turn_ended: True · 37.6s · audio: 2297604 b64 bytes*
*note: voice item (identify_cause)*

> Hi! Time to be a historian and work out what led to what! I tell you how something ended, then I read you one event at a time—you say yes if it helped cause the ending, or no if it did not, out loud! An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Listen. In the end: A new settlement appears beside the steel tracks. Here is one event: Construction crews lay heavy iron rails across the open prairie. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-1:cec-1-2
*expect: turn · turn_ended: True · 26.0s · audio: 1573764 b64 bytes*
*note: student says "no, that was not the last thing that happened" — a real cause refused because it is not the closest event to the ending*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: A new settlement appears beside the steel tracks. Here is one event: Construction crews lay heavy iron rails across the open prairie. Did this event help cause the ending—yes or no?

### right:cec-1:cec-1-2
*expect: turn · turn_ended: True · 5.8s · audio: 293764 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending—it came before, and the ending needed it.

### ask:cec-1:cec-1-1
*expect: turn · turn_ended: True · 16.3s · audio: 923524 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: A new settlement appears beside the steel tracks. Here is another event: Surveyors hammer wooden stakes into the flat grassland for a new depot. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-1:cec-1-1
*expect: turn · turn_ended: True · 27.1s · audio: 1628164 b64 bytes*
*note: student says "no, that was not the last thing that happened" — a real cause refused because it is not the closest event to the ending*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: A new settlement appears beside the steel tracks. Here is another event: Surveyors hammer wooden stakes into the flat grassland for a new depot. Did this event help cause the ending—yes or no?

### right:cec-1:cec-1-1
*expect: turn · turn_ended: True · 5.5s · audio: 279044 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending—it came before, and the ending needed it.

### ask:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 15.9s · audio: 928004 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: A new settlement appears beside the steel tracks. Here is another event: Children gather by the gravel platform to watch the conductor wave his pocket watch. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 27.7s · audio: 1656324 b64 bytes*
*note: student says "yes, it is about the same thing" — a consequence affirmed because it is connected — connected is not caused*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: A new settlement appears beside the steel tracks. Here is another event: Children gather by the gravel platform to watch the conductor wave his pocket watch. Did this event help cause the ending—yes or no?

### right:cec-1:cec-1-d1
*expect: turn · turn_ended: True · 7.0s · audio: 320644 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause—it could only happen once the ending had already happened.

### ask:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 16.8s · audio: 963844 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: A new settlement appears beside the steel tracks. Here is another event: Tall buffalo herds graze peacefully on the tallgrass plains before the builders arrive. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 27.2s · audio: 1663364 b64 bytes*
*note: student says "yes, that was true back then" — inert background affirmed because it was true at the time*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: A new settlement appears beside the steel tracks. Here is another event: Tall buffalo herds graze peacefully on the tallgrass plains before the builders arrive. Did this event help cause the ending—yes or no?

### right:cec-1:cec-1-d2
*expect: turn · turn_ended: True · 5.8s · audio: 296324 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause—it was true at the time, but it pushed nothing along.

### ask:cec-2:cec-2-2
*expect: turn · turn_ended: True · 17.5s · audio: 1010564 b64 bytes*
*note: voice item (identify_cause)*

> Listen. In the end: Letters from eastern cities arrive in days instead of months. Here is one event: Machinist crews bolt a massive brass bell onto the front of the locomotive. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-2:cec-2-2
*expect: turn · turn_ended: True · 28.2s · audio: 1720360 b64 bytes*
*note: student says "no, that was not the last thing that happened" — a real cause refused because it is not the closest event to the ending*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Letters from eastern cities arrive in days instead of months. Here is one event: Machinist crews bolt a massive brass bell onto the front of the locomotive. Did this event help cause the ending—yes or no?

### right:cec-2:cec-2-2
*expect: turn · turn_ended: True · 5.8s · audio: 280964 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending—it came before, and the ending needed it.

### ask:cec-2:cec-2-1
*expect: turn · turn_ended: True · 17.2s · audio: 999080 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: Iron smelters pour molten metal into molds to forge steam engine boilers. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-2:cec-2-1
*expect: turn · turn_ended: True · 28.2s · audio: 1724804 b64 bytes*
*note: student says "no, that was not the last thing that happened" — a real cause refused because it is not the closest event to the ending*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: Iron smelters pour molten metal into molds to forge steam engine boilers. Did this event help cause the ending—yes or no?

### right:cec-2:cec-2-1
*expect: turn · turn_ended: True · 5.5s · audio: 277764 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending—it came before, and the ending needed it.

### ask:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 16.8s · audio: 967684 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: The mayor reads heavy leather law books inside the brick city hall. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 27.8s · audio: 1694084 b64 bytes*
*note: student says "yes, that was true back then" — inert background affirmed because it was true at the time*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: The mayor reads heavy leather law books inside the brick city hall. Did this event help cause the ending—yes or no?

### right:cec-2:cec-2-d2
*expect: turn · turn_ended: True · 6.3s · audio: 320004 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause—it was true at the time, but it pushed nothing along.

### ask:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 17.2s · audio: 994564 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: Town residents stand in a long line outside the wooden post office window. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 28.8s · audio: 1757444 b64 bytes*
*note: student says "yes, it is about the same thing" — a consequence affirmed because it is connected — connected is not caused*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Letters from eastern cities arrive in days instead of months. Here is another event: Town residents stand in a long line outside the wooden post office window. Did this event help cause the ending—yes or no?

### right:cec-2:cec-2-d1
*expect: turn · turn_ended: True · 6.6s · audio: 337284 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause—it could only happen once the ending had already happened.

### ask:cec-3:cec-3-3
*expect: turn · turn_ended: True · 17.2s · audio: 999044 b64 bytes*
*note: voice item (identify_cause)*

> Listen. In the end: Children walk down plank sidewalks to a newly built schoolhouse. Here is one event: Carpenters nail yellow pine boards together to wall the classroom. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-3:cec-3-3
*expect: turn · turn_ended: True · 27.8s · audio: 1646084 b64 bytes*
*note: student says "no, that was not the last thing that happened" — a real cause refused because it is not the closest event to the ending*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. In the end: Children walk down plank sidewalks to a newly built schoolhouse. Here is one event: Carpenters nail yellow pine boards together to wall the classroom. Did this event help cause the ending—yes or no?

### right:cec-3:cec-3-3
*expect: turn · turn_ended: True · 6.2s · audio: 311044 b64 bytes*
*note: student says "yes"*

> Yes, it helped cause the ending—it came before, and the ending needed it.

### ask:cec-3:cec-3-d1
*expect: turn · turn_ended: True · 16.6s · audio: 953604 b64 bytes*
*note: voice item (identify_cause)*

> Listen. Same ending: Children walk down plank sidewalks to a newly built schoolhouse. Here is another event: Students sharpen slate pencils at the teacher wooden desk. Your turn. Did this event help cause the ending—yes or no?

### wrong:cec-3:cec-3-d1
*expect: turn · turn_ended: True · 27.4s · audio: 1661444 b64 bytes*
*note: student says "yes, it is about the same thing" — a consequence affirmed because it is connected — connected is not caused*

> My turn: An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause. Your turn. Listen again. Same ending: Children walk down plank sidewalks to a newly built schoolhouse. Here is another event: Students sharpen slate pencils at the teacher wooden desk. Did this event help cause the ending—yes or no?

### right:cec-3:cec-3-d1
*expect: turn · turn_ended: True · 6.5s · audio: 329604 b64 bytes*
*note: student says "no"*

> Yes, that one is not a cause—it could only happen once the ending had already happened.

### complete
*expect: turn · turn_ended: True · 8.1s · audio: 430084 b64 bytes*

> What good history today! You worked out what had to happen before what, all by yourself. See you next time!
