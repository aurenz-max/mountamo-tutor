# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | voice/predict-population-change | I do not know | ✅ | Pond Snail | ✅ |
| `chal-2` | voice/predict-population-change | I do not know | ✅ | Green Frog | ✅ |
| `chal-3` | voice/predict-population-change | I do not know | ✅ | Frog Tadpole | ✅ |
| `chal-4` | voice/predict-population-change | I do not know | ✅ | Great Blue Heron | ✅ |
| `chal-5` | voice/predict-population-change | I do not know | ✅ | Pond Decomposer Bacteria | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 18.1s · audio: 1063720 b64 bytes*
*note: voice item (predict-population-change)*

> Hi! Let's make this habitat come alive. Picture the ecosystem after the change, then answer with a living thing's name. Imagine this change: Prolonged cloudy weather sharply reduces floating green growth. Which population will decrease? Say its name.

### wrong:chal-1
*expect: turn · turn_ended: True · 23.0s · audio: 1343364 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Pond Snail. When producers like microscopic algae decrease, primary consumers such as pond snails have less food available, causing their population to drop. Your turn. Imagine this change: Prolonged cloudy weather sharply reduces floating green growth. Which population will decrease? Say its name.

### right:chal-1
*expect: turn · turn_ended: True · 12.1s · audio: 652808 b64 bytes*
*note: student says "Pond Snail"*

> Yes, Pond Snail. When producers like microscopic algae decrease, primary consumers such as pond snails have less food available, causing their population to drop.

### ask:chal-2
*expect: turn · turn_ended: True · 10.2s · audio: 510084 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: A flock of wading predators migrates into the wetland area. Which population will decrease? Say its name.

### wrong:chal-2
*expect: turn · turn_ended: True · 21.2s · audio: 1264004 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Green Frog. An increase in tertiary predators like great blue herons leads to higher predation pressure on green frogs, causing the frog population to decrease. Your turn. Imagine this change: A flock of wading predators migrates into the wetland area. Which population will decrease? Say its name.

### right:chal-2
*expect: turn · turn_ended: True · 11.9s · audio: 638084 b64 bytes*
*note: student says "Green Frog"*

> Yes, Green Frog. An increase in tertiary predators like great blue herons leads to higher predation pressure on green frogs, causing the frog population to decrease.

### ask:chal-3
*expect: turn · turn_ended: True · 11.3s · audio: 602884 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: Nutrient runoff enters the water, causing a massive bloom of floating green matter. Which population will increase? Say its name.

### wrong:chal-3
*expect: turn · turn_ended: True · 20.4s · audio: 1235204 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Frog Tadpole. More food in the form of algae allows tadpoles to thrive and grow, resulting in an increase in their population. Your turn. Imagine this change: Nutrient runoff enters the water, causing a massive bloom of floating green matter. Which population will increase? Say its name.

### right:chal-3
*expect: turn · turn_ended: True · 9.3s · audio: 512644 b64 bytes*
*note: student says "Frog Tadpole"*

> Yes, Frog Tadpole. More food in the form of algae allows tadpoles to thrive and grow, resulting in an increase in their population.

### ask:chal-4
*expect: turn · turn_ended: True · 10.1s · audio: 556804 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: An amphibian illness sweeps through the wetland, reducing middle-tier predators. Which population will decrease? Say its name.

### wrong:chal-4
*expect: turn · turn_ended: True · 20.2s · audio: 1223044 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Great Blue Heron. With fewer green frogs available as food, great blue herons face a food shortage, causing their population to decrease. Your turn. Imagine this change: An amphibian illness sweeps through the wetland, reducing middle-tier predators. Which population will decrease? Say its name.

### right:chal-4
*expect: turn · turn_ended: True · 9.8s · audio: 540804 b64 bytes*
*note: student says "Great Blue Heron"*

> Yes, Great Blue Heron. With fewer green frogs available as food, great blue herons face a food shortage, causing their population to decrease.

### ask:chal-5
*expect: turn · turn_ended: True · 10.3s · audio: 565124 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: Runoff brings a large volume of fallen leaves and organic debris to the bottom. Which population will increase? Say its name.

### wrong:chal-5
*expect: turn · turn_ended: True · 22.1s · audio: 1257604 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Pond Decomposer Bacteria. More dead matter and organic waste provide extra food for decomposer bacteria, causing their population to increase. Your turn. Imagine this change: Runoff brings a large volume of fallen leaves and organic debris to the bottom. Which population will increase? Say its name.

### right:chal-5
*expect: turn · turn_ended: True · 10.3s · audio: 579204 b64 bytes*
*note: student says "Pond Decomposer Bacteria"*

> Yes, Pond Decomposer Bacteria. More dead matter and organic waste provide extra food for decomposer bacteria, causing their population to increase.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 325764 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
