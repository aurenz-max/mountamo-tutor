# Tier-3 Live Tutor Report — era-explorer — 2026-09-03

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "era-explorer", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 4", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 4 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `di-no-verdict` | right:era-era_compare-2 1/2 (1 beat) | answered "Early Colonial Days" and the tutor opened with neither sentinel — the loop stalls here: "rely on nearby ports for goods. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?" |
| note | WARN | `di-off-script-ask` | ask:era-era_compare-2 1/2 (1 beat) | only 31% of the scripted ask survived. SCRIPT: "Listen. Settlements cling tightly to the ocean coast and rely on nearby ports for goods. Your turn. Say which " SPOKE: "Listen. Settlements cling tightly to the ocean coast and rely on nearbyListen. Settlements" |
| note | WARN | `di-off-script-verdict` | wrong:era-era_compare-2 1/2 (1 beat) | verdict was right but only 50% of the scripted line survived. SCRIPT: "My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn." SPOKE: "My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn." |
| note | WARN | `di-sentinel-on-ask` | ask:era-era_compare-3 1/2 (1 beat) | the ask opens a sentence with a verdict sentinel — the reducer will read it as a verdict for the previous item: "Yes, that was true only in Early Colonial Days — you weighed the two old times. Listen. People work hard on farms and gr" |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `era-era_compare-1` | voice/era_compare | today | ✅✅ | Pioneer Times | ✅✅ |
| `era-era_compare-2` | voice/era_compare | today | ✅✅ | Early Colonial Days | —✅ |
| `era-era_compare-3` | voice/era_compare | today | ✅✅ | both | ✅✅ |
| `era-era_compare-4` | voice/era_compare | today | ✅✅ | Pioneer Times | ✅✅ |
| `era-era_compare-5` | voice/era_compare | today | ✅✅ | Early Colonial Days | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:era-era_compare-1
*expect: turn · turn_ended: True · 29.6s · audio: 1789480 b64 bytes*
*note: voice item (era_compare)*

> Hi! Time to be a historian and work out how life used to be! I read you something about life — you say which of the two old times it belongs to, out loud! Some things belong only to the earlier time, some only to the later one, and some to both. Listen. Travelers move along rough dirt roads carved through deep forests by wagon. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-1
*expect: turn · turn_ended: True · 22.5s · audio: 1351684 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Travelers move along rough dirt roads carved through deep forests by wagon. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-1
*expect: turn · turn_ended: True · 6.0s · audio: 301444 b64 bytes*
*note: student says "Pioneer Times"*

> Yes, that was true only in Pioneer Times — you weighed the two old times.

### ask:era-era_compare-2
*expect: turn · turn_ended: True · 20.0s · audio: 1224968 b64 bytes*
*note: voice item (era_compare)*

> Listen. Settlements cling tightly to the ocean coast and rely on nearbyListen. Settlements

### wrong:era-era_compare-2
*expect: turn · turn_ended: False · 60.3s · audio: 740484 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Settlements cling tightly to the ocean coast and

### right:era-era_compare-2
*expect: turn · turn_ended: True · 12.8s · audio: 622080 b64 bytes*
*note: student says "Early Colonial Days"*

> rely on nearby ports for goods. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### ask:era-era_compare-3
*expect: turn · turn_ended: True · 19.6s · audio: 1123844 b64 bytes*
*note: voice item (era_compare)*

> Yes, that was true only in Early Colonial Days — you weighed the two old times. Listen. People work hard on farms and grow their own food to survive. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-3
*expect: turn · turn_ended: True · 20.8s · audio: 1243524 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. People work hard on farms and grow their own food to survive. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-3
*expect: turn · turn_ended: True · 5.2s · audio: 241284 b64 bytes*
*note: student says "both"*

> Yes, that was true in both of those times — you weighed the two old times.

### ask:era-era_compare-4
*expect: turn · turn_ended: True · 15.2s · audio: 865284 b64 bytes*
*note: voice item (era_compare)*

> Listen. Children sit together in a single room with one teacher for all grades. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-4
*expect: turn · turn_ended: True · 21.3s · audio: 1279364 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Children sit together in a single room with one teacher for all grades. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-4
*expect: turn · turn_ended: True · 5.6s · audio: 277124 b64 bytes*
*note: student says "Pioneer Times"*

> Yes, that was true only in Pioneer Times — you weighed the two old times.

### ask:era-era_compare-5
*expect: turn · turn_ended: True · 16.5s · audio: 920324 b64 bytes*
*note: voice item (era_compare)*

> Listen. Families travel mostly by foot or horseback because cleared roads are very rare. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-5
*expect: turn · turn_ended: True · 22.9s · audio: 1347844 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Families travel mostly by foot or horseback because cleared roads are very rare. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-5
*expect: turn · turn_ended: True · 6.0s · audio: 280324 b64 bytes*
*note: student says "Early Colonial Days"*

> Yes, that was true only in Early Colonial Days — you weighed the two old times.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 353924 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!


## Run 2 — beat-by-beat transcript

### ask:era-era_compare-1
*expect: turn · turn_ended: True · 30.2s · audio: 1836804 b64 bytes*
*note: voice item (era_compare)*

> Hi! Time to be a historian and work out how life used to be! I read you something about life — you say which of the two old times it belongs to, out loud! Some things belong only to the earlier time, some only to the later one, and some to both. Listen. Travelers move along rough dirt roads carved through deep forests by wagon. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-1
*expect: turn · turn_ended: True · 21.6s · audio: 1292804 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Travelers move along rough dirt roads carved through deep forests by wagon. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-1
*expect: turn · turn_ended: True · 6.5s · audio: 325764 b64 bytes*
*note: student says "Pioneer Times"*

> Yes, that was true only in Pioneer Times — you weighed the two old times.

### ask:era-era_compare-2
*expect: turn · turn_ended: True · 15.4s · audio: 873604 b64 bytes*
*note: voice item (era_compare)*

> Listen. Settlements cling tightly to the ocean coast and rely on nearby ports for goods. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-2
*expect: turn · turn_ended: True · 21.5s · audio: 1260804 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Settlements cling tightly to the ocean coast and rely on nearby ports for goods. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-2
*expect: turn · turn_ended: True · 6.5s · audio: 328964 b64 bytes*
*note: student says "Early Colonial Days"*

> Yes, that was true only in Early Colonial Days — you weighed the two old times.

### ask:era-era_compare-3
*expect: turn · turn_ended: True · 14.8s · audio: 846084 b64 bytes*
*note: voice item (era_compare)*

> Listen. People work hard on farms and grow their own food to survive. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-3
*expect: turn · turn_ended: True · 21.3s · audio: 1235204 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. People work hard on farms and grow their own food to survive. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-3
*expect: turn · turn_ended: True · 5.7s · audio: 275204 b64 bytes*
*note: student says "both"*

> Yes, that was true in both of those times — you weighed the two old times.

### ask:era-era_compare-4
*expect: turn · turn_ended: True · 15.3s · audio: 868484 b64 bytes*
*note: voice item (era_compare)*

> Listen. Children sit together in a single room with one teacher for all grades. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-4
*expect: turn · turn_ended: True · 21.2s · audio: 1269768 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Children sit together in a single room with one teacher for all grades. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-4
*expect: turn · turn_ended: True · 6.1s · audio: 281604 b64 bytes*
*note: student says "Pioneer Times"*

> Yes, that was true only in Pioneer Times — you weighed the two old times.

### ask:era-era_compare-5
*expect: turn · turn_ended: True · 15.4s · audio: 881284 b64 bytes*
*note: voice item (era_compare)*

> Listen. Families travel mostly by foot or horseback because cleared roads are very rare. Your turn. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### wrong:era-era_compare-5
*expect: turn · turn_ended: True · 21.7s · audio: 1289604 b64 bytes*
*note: student says "today" — the era weighed against TODAY instead of against the era before it — not one of the three choices at all, and the documented struggle for this mode*

> My turn: Some things belong only to the earlier time, some only to the later one, and some to both. Your turn. Listen again. Families travel mostly by foot or horseback because cleared roads are very rare. Say which time that belongs to — was it only in Early Colonial Days, only in Pioneer Times, or true in both of those times?

### right:era-era_compare-5
*expect: turn · turn_ended: True · 6.5s · audio: 318084 b64 bytes*
*note: student says "Early Colonial Days"*

> Yes, that was true only in Early Colonial Days — you weighed the two old times.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 384004 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!
