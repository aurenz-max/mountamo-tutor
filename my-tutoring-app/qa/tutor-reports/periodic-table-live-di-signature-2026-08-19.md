# Tier-3 Live Tutor Report — periodic-table — 2026-08-19

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "periodic-table", "items": 6, "voice_items": 6, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `pt-1-trend` | voice/compare | Helium | ✅✅✅ | Krypton | ✅✅✅ |
| `pt-2-trend` | voice/valence | 14 | ✅✅✅ | four | ✅✅✅ |
| `pt-3-trend` | voice/compare | Potassium | ✅✅✅ | Cesium | ✅✅✅ |
| `pt-4-trend` | voice/compare | Oxygen | ✅✅✅ | Tellurium | ✅✅✅ |
| `pt-5-trend` | voice/valence | three | ✅✅✅ | two | ✅✅✅ |
| `pt-6-trend` | voice/compare | Lithium | ✅✅✅ | Sodium | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pt-1-trend
*expect: turn · turn_ended: True · 21.0s · audio: 1241640 b64 bytes*
*note: voice item (compare)*

> Hi! Time to explore the periodic table! I name two elements — you look at where they sit on the table, and answer out loud! Going down a column, atoms get bigger — each row down adds a whole shell. Find Krypton and Helium — same group. Your turn. Which atom is bigger — Krypton, or Helium?

### wrong:pt-1-trend
*expect: turn · turn_ended: True · 11.8s · audio: 683524 b64 bytes*
*note: student says "Helium"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Krypton, or Helium?

### right:pt-1-trend
*expect: turn · turn_ended: True · 5.2s · audio: 210564 b64 bytes*
*note: student says "Krypton"*

> Yes, Krypton is the bigger atom — it has more shells.

### ask:pt-2-trend
*expect: turn · turn_ended: True · 17.2s · audio: 1006084 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Lead on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-2-trend
*expect: turn · turn_ended: True · 13.5s · audio: 711044 b64 bytes*
*note: student says "14" — the printed column label — the group number read off the table instead of the outer-electron count, the exact confusion this mode teaches through*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Lead stands is its outer electrons. Your turn. Say how many electrons are in Lead's outer shell.

### right:pt-2-trend
*expect: turn · turn_ended: True · 4.7s · audio: 190084 b64 bytes*
*note: student says "four"*

> Yes, Lead has four electrons in its outer shell.

### ask:pt-3-trend
*expect: turn · turn_ended: True · 16.7s · audio: 945924 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Cesium and Potassium — same family. Your turn. Which one is more reactive — Cesium, or Potassium?

### wrong:pt-3-trend
*expect: turn · turn_ended: True · 10.0s · audio: 568324 b64 bytes*
*note: student says "Potassium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Cesium, or Potassium?

### right:pt-3-trend
*expect: turn · turn_ended: True · 4.4s · audio: 195844 b64 bytes*
*note: student says "Cesium"*

> Yes, Cesium is the more reactive one in this family.

### ask:pt-4-trend
*expect: turn · turn_ended: True · 8.5s · audio: 448004 b64 bytes*
*note: voice item (compare)*

> Find Oxygen and Tellurium — same group. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### wrong:pt-4-trend
*expect: turn · turn_ended: True · 12.8s · audio: 714280 b64 bytes*
*note: student says "Oxygen"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### right:pt-4-trend
*expect: turn · turn_ended: True · 4.8s · audio: 216964 b64 bytes*
*note: student says "Tellurium"*

> Yes, Tellurium is the bigger atom — it has more shells.

### ask:pt-5-trend
*expect: turn · turn_ended: True · 18.3s · audio: 1049640 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Magnesium on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-5-trend
*expect: turn · turn_ended: True · 13.6s · audio: 792964 b64 bytes*
*note: student says "three"*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Magnesium stands is its outer electrons. Your turn. Say how many electrons are in Magnesium's outer shell.

### right:pt-5-trend
*expect: turn · turn_ended: True · 4.4s · audio: 206084 b64 bytes*
*note: student says "two"*

> Yes, Magnesium has two electrons in its outer shell.

### ask:pt-6-trend
*expect: turn · turn_ended: True · 16.8s · audio: 926728 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Lithium and Sodium — same family. Your turn. Which one is more reactive — Lithium, or Sodium?

### wrong:pt-6-trend
*expect: turn · turn_ended: True · 10.6s · audio: 606724 b64 bytes*
*note: student says "Lithium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Lithium, or Sodium?

### right:pt-6-trend
*expect: turn · turn_ended: True · 4.4s · audio: 198440 b64 bytes*
*note: student says "Sodium"*

> Yes, Sodium is the more reactive one in this family.

### complete
*expect: turn · turn_ended: True · 15.2s · audio: 405764 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!


## Run 2 — beat-by-beat transcript

### ask:pt-1-trend
*expect: turn · turn_ended: True · 19.3s · audio: 1139204 b64 bytes*
*note: voice item (compare)*

> Hi! Time to explore the periodic table! I name two elements — you look at where they sit on the table, and answer out loud! Going down a column, atoms get bigger — each row down adds a whole shell. Find Krypton and Helium — same group. Your turn. Which atom is bigger — Krypton, or Helium?

### wrong:pt-1-trend
*expect: turn · turn_ended: True · 11.9s · audio: 665640 b64 bytes*
*note: student says "Helium"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Krypton, or Helium?

### right:pt-1-trend
*expect: turn · turn_ended: True · 4.9s · audio: 212484 b64 bytes*
*note: student says "Krypton"*

> Yes, Krypton is the bigger atom — it has more shells.

### ask:pt-2-trend
*expect: turn · turn_ended: True · 16.7s · audio: 975364 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Lead on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-2-trend
*expect: turn · turn_ended: True · 12.2s · audio: 697604 b64 bytes*
*note: student says "14" — the printed column label — the group number read off the table instead of the outer-electron count, the exact confusion this mode teaches through*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Lead stands is its outer electrons. Your turn. Say how many electrons are in Lead's outer shell.

### right:pt-2-trend
*expect: turn · turn_ended: True · 4.2s · audio: 191400 b64 bytes*
*note: student says "four"*

> Yes, Lead has four electrons in its outer shell.

### ask:pt-3-trend
*expect: turn · turn_ended: True · 16.1s · audio: 935684 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Cesium and Potassium — same family. Your turn. Which one is more reactive — Cesium, or Potassium?

### wrong:pt-3-trend
*expect: turn · turn_ended: True · 9.9s · audio: 542084 b64 bytes*
*note: student says "Potassium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Cesium, or Potassium?

### right:pt-3-trend
*expect: turn · turn_ended: True · 5.1s · audio: 205480 b64 bytes*
*note: student says "Cesium"*

> Yes, Cesium is the more reactive one in this family.

### ask:pt-4-trend
*expect: turn · turn_ended: True · 8.1s · audio: 410884 b64 bytes*
*note: voice item (compare)*

> Find Oxygen and Tellurium — same group. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### wrong:pt-4-trend
*expect: turn · turn_ended: True · 11.5s · audio: 644484 b64 bytes*
*note: student says "Oxygen"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### right:pt-4-trend
*expect: turn · turn_ended: True · 4.5s · audio: 204804 b64 bytes*
*note: student says "Tellurium"*

> Yes, Tellurium is the bigger atom — it has more shells.

### ask:pt-5-trend
*expect: turn · turn_ended: True · 17.1s · audio: 983684 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Magnesium on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-5-trend
*expect: turn · turn_ended: True · 12.8s · audio: 741764 b64 bytes*
*note: student says "three"*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Magnesium stands is its outer electrons. Your turn. Say how many electrons are in Magnesium's outer shell.

### right:pt-5-trend
*expect: turn · turn_ended: True · 4.3s · audio: 198404 b64 bytes*
*note: student says "two"*

> Yes, Magnesium has two electrons in its outer shell.

### ask:pt-6-trend
*expect: turn · turn_ended: True · 15.6s · audio: 904964 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Lithium and Sodium — same family. Your turn. Which one is more reactive — Lithium, or Sodium?

### wrong:pt-6-trend
*expect: turn · turn_ended: True · 9.7s · audio: 526724 b64 bytes*
*note: student says "Lithium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Lithium, or Sodium?

### right:pt-6-trend
*expect: turn · turn_ended: True · 4.5s · audio: 202244 b64 bytes*
*note: student says "Sodium"*

> Yes, Sodium is the more reactive one in this family.

### complete
*expect: turn · turn_ended: True · 7.5s · audio: 392964 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!


## Run 3 — beat-by-beat transcript

### ask:pt-1-trend
*expect: turn · turn_ended: True · 20.1s · audio: 1195524 b64 bytes*
*note: voice item (compare)*

> Hi! Time to explore the periodic table! I name two elements — you look at where they sit on the table, and answer out loud! Going down a column, atoms get bigger — each row down adds a whole shell. Find Krypton and Helium — same group. Your turn. Which atom is bigger — Krypton, or Helium?

### wrong:pt-1-trend
*expect: turn · turn_ended: True · 12.1s · audio: 682244 b64 bytes*
*note: student says "Helium"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Krypton, or Helium?

### right:pt-1-trend
*expect: turn · turn_ended: True · 4.6s · audio: 217604 b64 bytes*
*note: student says "Krypton"*

> Yes, Krypton is the bigger atom — it has more shells.

### ask:pt-2-trend
*expect: turn · turn_ended: True · 17.8s · audio: 986884 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Lead on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-2-trend
*expect: turn · turn_ended: True · 12.9s · audio: 747524 b64 bytes*
*note: student says "14" — the printed column label — the group number read off the table instead of the outer-electron count, the exact confusion this mode teaches through*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Lead stands is its outer electrons. Your turn. Say how many electrons are in Lead's outer shell.

### right:pt-2-trend
*expect: turn · turn_ended: True · 4.8s · audio: 200324 b64 bytes*
*note: student says "four"*

> Yes, Lead has four electrons in its outer shell.

### ask:pt-3-trend
*expect: turn · turn_ended: True · 16.9s · audio: 983684 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Cesium and Potassium — same family. Your turn. Which one is more reactive — Cesium, or Potassium?

### wrong:pt-3-trend
*expect: turn · turn_ended: True · 10.4s · audio: 591364 b64 bytes*
*note: student says "Potassium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Cesium, or Potassium?

### right:pt-3-trend
*expect: turn · turn_ended: True · 5.2s · audio: 203524 b64 bytes*
*note: student says "Cesium"*

> Yes, Cesium is the more reactive one in this family.

### ask:pt-4-trend
*expect: turn · turn_ended: True · 8.8s · audio: 442244 b64 bytes*
*note: voice item (compare)*

> Find Oxygen and Tellurium — same group. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### wrong:pt-4-trend
*expect: turn · turn_ended: True · 12.5s · audio: 712964 b64 bytes*
*note: student says "Oxygen"*

> My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — Oxygen, or Tellurium?

### right:pt-4-trend
*expect: turn · turn_ended: True · 4.7s · audio: 225320 b64 bytes*
*note: student says "Tellurium"*

> Yes, Tellurium is the bigger atom — it has more shells.

### ask:pt-5-trend
*expect: turn · turn_ended: True · 16.9s · audio: 980484 b64 bytes*
*note: voice item (valence)*

> I name an element — you find its column and say how many outer electrons it has! Count the tall columns only, left to right — that count is the outer electrons. Find Magnesium on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.

### wrong:pt-5-trend
*expect: turn · turn_ended: True · 14.1s · audio: 809604 b64 bytes*
*note: student says "three"*

> My turn: count the tall columns only, left to right, and skip the middle block — the count where Magnesium stands is its outer electrons. Your turn. Say how many electrons are in Magnesium's outer shell.

### right:pt-5-trend
*expect: turn · turn_ended: True · 4.5s · audio: 215684 b64 bytes*
*note: student says "two"*

> Yes, Magnesium has two electrons in its outer shell.

### ask:pt-6-trend
*expect: turn · turn_ended: True · 16.1s · audio: 929284 b64 bytes*
*note: voice item (compare)*

> I name two elements — you look at where they sit on the table, and answer out loud! In this family, elements lower down are more reactive. Find Lithium and Sodium — same family. Your turn. Which one is more reactive — Lithium, or Sodium?

### wrong:pt-6-trend
*expect: turn · turn_ended: True · 10.1s · audio: 572804 b64 bytes*
*note: student says "Lithium"*

> My turn: in this family, the lower an element sits, the more reactive it is. Your turn. Which one is more reactive — Lithium, or Sodium?

### right:pt-6-trend
*expect: turn · turn_ended: True · 4.4s · audio: 194564 b64 bytes*
*note: student says "Sodium"*

> Yes, Sodium is the more reactive one in this family.

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 419844 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!
