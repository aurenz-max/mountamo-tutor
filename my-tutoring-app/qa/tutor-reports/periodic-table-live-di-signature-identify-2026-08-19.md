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
| `pt-1-identify` | voice/name | Zinc | ✅✅✅ | Copper | ✅✅✅ |
| `pt-2-identify` | voice/name | Oxygen | ✅✅✅ | Nitrogen | ✅✅✅ |
| `pt-3-identify` | voice/name | X, e | ✅✅✅ | Xenon | ✅✅✅ |
| `pt-4-identify` | voice/name | Carbon | ✅✅✅ | Boron | ✅✅✅ |
| `pt-5-identify` | voice/name | Gallium | ✅✅✅ | Zinc | ✅✅✅ |
| `pt-6-identify` | voice/name | K | ✅✅✅ | Potassium | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:pt-1-identify
*expect: turn · turn_ended: True · 18.7s · audio: 1093124 b64 bytes*
*note: voice item (name)*

> Hi! Time to explore the periodic table! I tell you where an element lives — you find its box and say its name out loud! Every box shows its element — the number on top, the symbol in big letters, the name underneath. Look at group 11, period 4. Your turn. Say that element's name.

### wrong:pt-1-identify
*expect: turn · turn_ended: True · 11.2s · audio: 608004 b64 bytes*
*note: student says "Zinc" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 11, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-1-identify
*expect: turn · turn_ended: True · 3.6s · audio: 126084 b64 bytes*
*note: student says "Copper"*

> Yes, that element is Copper.

### ask:pt-2-identify
*expect: turn · turn_ended: True · 5.2s · audio: 229764 b64 bytes*
*note: voice item (name)*

> Find element number 7. Your turn. Say its name.

### wrong:pt-2-identify
*expect: turn · turn_ended: True · 8.9s · audio: 496004 b64 bytes*
*note: student says "Oxygen" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 7 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-2-identify
*expect: turn · turn_ended: True · 3.4s · audio: 133764 b64 bytes*
*note: student says "Nitrogen"*

> Yes, that element is Nitrogen.

### ask:pt-3-identify
*expect: turn · turn_ended: True · 6.2s · audio: 288644 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is X, e. your turn. Say its name.

### wrong:pt-3-identify
*expect: turn · turn_ended: True · 8.9s · audio: 488964 b64 bytes*
*note: student says "X, e" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters X, e — the name is written under them. Your turn. Say that element's name.

### right:pt-3-identify
*expect: turn · turn_ended: True · 3.2s · audio: 129924 b64 bytes*
*note: student says "Xenon"*

> Yes, that element is Xenon.

### ask:pt-4-identify
*expect: turn · turn_ended: True · 6.3s · audio: 307240 b64 bytes*
*note: voice item (name)*

> Look at group 13, period 2. Your turn. Say that element's name.

### wrong:pt-4-identify
*expect: turn · turn_ended: True · 10.9s · audio: 601604 b64 bytes*
*note: student says "Carbon" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 13, then down to period 2 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-4-identify
*expect: turn · turn_ended: True · 3.8s · audio: 126084 b64 bytes*
*note: student says "Boron"*

> Yes, that element is Boron.

### ask:pt-5-identify
*expect: turn · turn_ended: True · 4.9s · audio: 220200 b64 bytes*
*note: voice item (name)*

> Find element number 30. Your turn. Say its name.

### wrong:pt-5-identify
*expect: turn · turn_ended: True · 9.6s · audio: 509444 b64 bytes*
*note: student says "Gallium" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 30 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-5-identify
*expect: turn · turn_ended: True · 3.6s · audio: 124164 b64 bytes*
*note: student says "Zinc"*

> Yes, that element is Zinc.

### ask:pt-6-identify
*expect: turn · turn_ended: True · 6.8s · audio: 250884 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is K. Your turn. Say its name.

### wrong:pt-6-identify
*expect: turn · turn_ended: True · 8.7s · audio: 465284 b64 bytes*
*note: student says "K" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters K — the name is written under them. Your turn. Say that element's name.

### right:pt-6-identify
*expect: turn · turn_ended: True · 4.0s · audio: 131204 b64 bytes*
*note: student says "Potassium"*

> Yes, that element is Potassium.

### complete
*expect: turn · turn_ended: True · 7.6s · audio: 395524 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!


## Run 2 — beat-by-beat transcript

### ask:pt-1-identify
*expect: turn · turn_ended: True · 18.3s · audio: 1069444 b64 bytes*
*note: voice item (name)*

> Hi! Time to explore the periodic table! I tell you where an element lives — you find its box and say its name out loud! Every box shows its element — the number on top, the symbol in big letters, the name underneath. Look at group 11, period 4. Your turn. Say that element's name.

### wrong:pt-1-identify
*expect: turn · turn_ended: True · 9.6s · audio: 530564 b64 bytes*
*note: student says "Zinc" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 11, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-1-identify
*expect: turn · turn_ended: True · 3.5s · audio: 140164 b64 bytes*
*note: student says "Copper"*

> Yes, that element is Copper.

### ask:pt-2-identify
*expect: turn · turn_ended: True · 5.2s · audio: 224680 b64 bytes*
*note: voice item (name)*

> Find element number 7. Your turn. Say its name.

### wrong:pt-2-identify
*expect: turn · turn_ended: True · 8.5s · audio: 458244 b64 bytes*
*note: student says "Oxygen" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 7 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-2-identify
*expect: turn · turn_ended: True · 3.7s · audio: 153604 b64 bytes*
*note: student says "Nitrogen"*

> Yes, that element is Nitrogen.

### ask:pt-3-identify
*expect: turn · turn_ended: True · 5.8s · audio: 272644 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is X, e. Your turn. Say its name.

### wrong:pt-3-identify
*expect: turn · turn_ended: True · 7.7s · audio: 408324 b64 bytes*
*note: student says "X, e" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters X, e — the name is written under them. Your turn. Say that element's name.

### right:pt-3-identify
*expect: turn · turn_ended: True · 3.9s · audio: 133124 b64 bytes*
*note: student says "Xenon"*

> Yes, that element is Xenon.

### ask:pt-4-identify
*expect: turn · turn_ended: True · 7.1s · audio: 280324 b64 bytes*
*note: voice item (name)*

> Look at group 13, period 2. Your turn. Say that element's name.

### wrong:pt-4-identify
*expect: turn · turn_ended: True · 10.0s · audio: 544644 b64 bytes*
*note: student says "Carbon" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 13, then down to period 2 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-4-identify
*expect: turn · turn_ended: True · 3.5s · audio: 136964 b64 bytes*
*note: student says "Boron"*

> Yes, that element is Boron.

### ask:pt-5-identify
*expect: turn · turn_ended: True · 4.8s · audio: 200360 b64 bytes*
*note: voice item (name)*

> Find element number 30. Your turn. Say its name.

### wrong:pt-5-identify
*expect: turn · turn_ended: True · 8.3s · audio: 435844 b64 bytes*
*note: student says "Gallium" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 30 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-5-identify
*expect: turn · turn_ended: True · 3.7s · audio: 129924 b64 bytes*
*note: student says "Zinc"*

> Yes, that element is Zinc.

### ask:pt-6-identify
*expect: turn · turn_ended: True · 5.4s · audio: 234244 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is K. Your turn. Say its name.

### wrong:pt-6-identify
*expect: turn · turn_ended: True · 7.4s · audio: 380804 b64 bytes*
*note: student says "K" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters K — the name is written under them. Your turn. Say that element's name.

### right:pt-6-identify
*expect: turn · turn_ended: True · 3.6s · audio: 146564 b64 bytes*
*note: student says "Potassium"*

> Yes, that element is Potassium.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 385924 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!


## Run 3 — beat-by-beat transcript

### ask:pt-1-identify
*expect: turn · turn_ended: True · 19.0s · audio: 1127044 b64 bytes*
*note: voice item (name)*

> Hi! Time to explore the periodic table! I tell you where an element lives — you find its box and say its name out loud! Every box shows its element — the number on top, the symbol in big letters, the name underneath. Look at group 11, period 4. Your turn. Say that element's name.

### wrong:pt-1-identify
*expect: turn · turn_ended: True · 10.2s · audio: 577284 b64 bytes*
*note: student says "Zinc" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 11, then down to period 4 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-1-identify
*expect: turn · turn_ended: True · 3.4s · audio: 146564 b64 bytes*
*note: student says "Copper"*

> Yes, that element is Copper.

### ask:pt-2-identify
*expect: turn · turn_ended: True · 5.2s · audio: 226564 b64 bytes*
*note: voice item (name)*

> Find element number 7. Your turn. Say its name.

### wrong:pt-2-identify
*expect: turn · turn_ended: True · 8.7s · audio: 478724 b64 bytes*
*note: student says "Oxygen" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 7 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-2-identify
*expect: turn · turn_ended: True · 3.6s · audio: 161284 b64 bytes*
*note: student says "Nitrogen"*

> Yes, that element is Nitrogen.

### ask:pt-3-identify
*expect: turn · turn_ended: True · 6.2s · audio: 289284 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is X, e. Your turn. Say its name.

### wrong:pt-3-identify
*expect: turn · turn_ended: True · 8.1s · audio: 439044 b64 bytes*
*note: student says "X, e" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters X, e — the name is written under them. Your turn. Say that element's name.

### right:pt-3-identify
*expect: turn · turn_ended: True · 3.6s · audio: 148484 b64 bytes*
*note: student says "Xenon"*

> Yes, that element is Xenon.

### ask:pt-4-identify
*expect: turn · turn_ended: True · 6.1s · audio: 295044 b64 bytes*
*note: voice item (name)*

> Look at group 13, period 2. Your turn. Say that element's name.

### wrong:pt-4-identify
*expect: turn · turn_ended: True · 10.3s · audio: 584964 b64 bytes*
*note: student says "Carbon" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: count across to group 13, then down to period 2 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-4-identify
*expect: turn · turn_ended: True · 3.4s · audio: 144004 b64 bytes*
*note: student says "Boron"*

> Yes, that element is Boron.

### ask:pt-5-identify
*expect: turn · turn_ended: True · 5.5s · audio: 221444 b64 bytes*
*note: voice item (name)*

> Find element number 30. Your turn. Say its name.

### wrong:pt-5-identify
*expect: turn · turn_ended: True · 8.8s · audio: 485124 b64 bytes*
*note: student says "Gallium" — the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names*

> My turn: follow the little numbers up to 30 — the name is written right in that box. Your turn. Say that element's name.

### right:pt-5-identify
*expect: turn · turn_ended: True · 3.6s · audio: 128644 b64 bytes*
*note: student says "Zinc"*

> Yes, that element is Zinc.

### ask:pt-6-identify
*expect: turn · turn_ended: True · 5.8s · audio: 261124 b64 bytes*
*note: voice item (name)*

> Find the element whose symbol is K. Your turn. Say its name.

### wrong:pt-6-identify
*expect: turn · turn_ended: True · 7.7s · audio: 408964 b64 bytes*
*note: student says "K" — the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss*

> My turn: match the big letters K — the name is written under them. Your turn. Say that element's name.

### right:pt-6-identify
*expect: turn · turn_ended: True · 3.5s · audio: 152324 b64 bytes*
*note: student says "Potassium"*

> Yes, that element is Potassium.

### complete
*expect: turn · turn_ended: True · 7.6s · audio: 408324 b64 bytes*

> What great work on the periodic table today! You are learning your way around all those boxes. See you next time!
