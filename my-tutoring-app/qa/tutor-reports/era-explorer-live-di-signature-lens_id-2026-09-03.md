# Tier-3 Live Tutor Report — era-explorer — 2026-09-03

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "era-explorer", "items": 3, "voice_items": 3, "gesture_items": 0, "dropped_challenges": 2, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 1", "undrivable_items": []}`
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
| `era-lens_id-1` | voice/lens_id | children walked to | ✅✅ | School & Work | ✅✅ |
| `era-lens_id-2` | voice/lens_id | families built small | ✅✅ | Daily Life | ✅✅ |
| `era-lens_id-3` | voice/lens_id | farmers hitched strong | ✅✅ | Technology | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 2.

## Run 1 — beat-by-beat transcript

### ask:era-lens_id-1
*expect: turn · turn_ended: True · 31.1s · audio: 1885444 b64 bytes*
*note: voice item (lens_id)*

> Hi! Time to be a historian and work out how life used to be! I read you something from the era cards — you say which lens it came from, out loud! Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Listen. Children walked to a single classroom where a single teacher helped students of many different ages. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-1
*expect: turn · turn_ended: True · 22.8s · audio: 1365124 b64 bytes*
*note: student says "children walked to" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Children walked to a single classroom where a single teacher helped students of many different ages. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-1
*expect: turn · turn_ended: True · 5.8s · audio: 280324 b64 bytes*
*note: student says "School & Work"*

> Yes, that detail came from the School & Work lens — you found where it lives.

### ask:era-lens_id-2
*expect: turn · turn_ended: True · 15.9s · audio: 912644 b64 bytes*
*note: voice item (lens_id)*

> Listen. Families built small wooden houses and used open flames to keep warm during cold winter nights. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-2
*expect: turn · turn_ended: True · 23.5s · audio: 1397124 b64 bytes*
*note: student says "families built small" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Families built small wooden houses and used open flames to keep warm during cold winter nights. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-2
*expect: turn · turn_ended: True · 5.6s · audio: 260484 b64 bytes*
*note: student says "Daily Life"*

> Yes, that detail came from the Daily Life lens — you found where it lives.

### ask:era-lens_id-3
*expect: turn · turn_ended: True · 15.2s · audio: 868484 b64 bytes*
*note: voice item (lens_id)*

> Listen. Farmers hitched strong horses to heavy wooden tools to break up the thick prairie dirt. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-3
*expect: turn · turn_ended: True · 22.7s · audio: 1372164 b64 bytes*
*note: student says "farmers hitched strong" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Farmers hitched strong horses to heavy wooden tools to break up the thick prairie dirt. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-3
*expect: turn · turn_ended: True · 5.2s · audio: 244484 b64 bytes*
*note: student says "Technology"*

> Yes, that detail came from the Technology lens — you found where it lives.

### complete
*expect: turn · turn_ended: True · 7.4s · audio: 386564 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!


## Run 2 — beat-by-beat transcript

### ask:era-lens_id-1
*expect: turn · turn_ended: True · 30.1s · audio: 1825284 b64 bytes*
*note: voice item (lens_id)*

> Hi! Time to be a historian and work out how life used to be! I read you something from the era cards — you say which lens it came from, out loud! Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Listen. Children walked to a single classroom where a single teacher helped students of many different ages. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-1
*expect: turn · turn_ended: True · 21.9s · audio: 1322884 b64 bytes*
*note: student says "children walked to" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Children walked to a single classroom where a single teacher helped students of many different ages. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-1
*expect: turn · turn_ended: True · 5.3s · audio: 256644 b64 bytes*
*note: student says "School & Work"*

> Yes, that detail came from the School & Work lens — you found where it lives.

### ask:era-lens_id-2
*expect: turn · turn_ended: True · 15.0s · audio: 846084 b64 bytes*
*note: voice item (lens_id)*

> Listen. Families built small wooden houses and used open flames to keep warm during cold winter nights. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-2
*expect: turn · turn_ended: True · 21.9s · audio: 1313924 b64 bytes*
*note: student says "families built small" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Families built small wooden houses and used open flames to keep warm during cold winter nights. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-2
*expect: turn · turn_ended: True · 5.2s · audio: 250244 b64 bytes*
*note: student says "Daily Life"*

> Yes, that detail came from the Daily Life lens — you found where it lives.

### ask:era-lens_id-3
*expect: turn · turn_ended: True · 14.4s · audio: 805124 b64 bytes*
*note: voice item (lens_id)*

> Listen. Farmers hitched strong horses to heavy wooden tools to break up the thick prairie dirt. Your turn. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### wrong:era-lens_id-3
*expect: turn · turn_ended: True · 21.6s · audio: 1301764 b64 bytes*
*note: student says "farmers hitched strong" — the THING named instead of the lens — the child says what the sentence is about, which is fluent, confident, and answers a question that was not asked*

> My turn: Every detail on these cards comes from one of the three lenses: Daily Life, Technology, School & Work. Your turn. Listen again. Farmers hitched strong horses to heavy wooden tools to break up the thick prairie dirt. Say which lens that came from — was it the Daily Life lens, the Technology lens, or the School & Work lens?

### right:era-lens_id-3
*expect: turn · turn_ended: True · 5.4s · audio: 251524 b64 bytes*
*note: student says "Technology"*

> Yes, that detail came from the Technology lens — you found where it lives.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 377604 b64 bytes*

> What good history today! You read what life was like and worked out the rest yourself. See you next time!
