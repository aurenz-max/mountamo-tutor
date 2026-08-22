# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 1, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `chal-1` | voice/predict-population-change | Tadpole | ✅ | Green Algae | ✅ |
| `chal-2` | voice/predict-population-change | Dragonfly Nymph | ✅ | Tadpole | ✅ |
| `chal-3` | voice/predict-population-change | Green Algae | ✅ | Dragonfly Nymph | ✅ |
| `chal-5` | voice/predict-population-change | Great Blue Heron | ✅ | Pond Snail and Bacteria | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 1.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 18.2s · audio: 1053444 b64 bytes*
*note: voice item (predict-population-change)*

> Hi! Let's make this habitat come alive. Picture the ecosystem after the change, then answer with a living thing's name. Imagine this change: Nutrient runoff enters the aquatic environment. Which population will increase? Say its name.

### wrong:chal-1
*expect: turn · turn_ended: True · 20.0s · audio: 1209604 b64 bytes*
*note: student says "Tadpole" — a visible population chosen without tracing the disruption through the food web*

> My turn: the answer is Green Algae. Extra nutrients cause algae to multiply rapidly because they are primary producers that thrive on available sunlight and minerals. Your turn. Imagine this change: Nutrient runoff enters the aquatic environment. Which population will increase? Say its name.

### right:chal-1
*expect: turn · turn_ended: True · 10.6s · audio: 598404 b64 bytes*
*note: student says "Green Algae"*

> Yes, Green Algae. Extra nutrients cause algae to multiply rapidly because they are primary producers that thrive on available sunlight and minerals.

### ask:chal-2
*expect: turn · turn_ended: True · 10.2s · audio: 562564 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: A surge of microscopic plant growth occurs across the pond surface. Which population will increase? Say its name.

### wrong:chal-2
*expect: turn · turn_ended: True · 20.2s · audio: 1202564 b64 bytes*
*note: student says "Dragonfly Nymph" — a visible population chosen without tracing the disruption through the food web*

> My turn: the answer is Tadpole. With an abundance of food available, herbivorous consumers have more resources to grow and reproduce successfully. Your turn. Imagine this change: A surge of microscopic plant growth occurs across the pond surface. Which population will increase? Say its name.

### right:chal-2
*expect: turn · turn_ended: True · 9.1s · audio: 492840 b64 bytes*
*note: student says "Tadpole"*

> Yes, Tadpole. With an abundance of food available, herbivorous consumers have more resources to grow and reproduce successfully.

### ask:chal-3
*expect: turn · turn_ended: True · 9.6s · audio: 453124 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: A sudden illness sweeps through the pond larvae. Which population will decrease? Say its name.

### wrong:chal-3
*expect: turn · turn_ended: True · 19.1s · audio: 1135364 b64 bytes*
*note: student says "Green Algae" — a visible population chosen without tracing the disruption through the food web*

> My turn: the answer is Dragonfly Nymph. When prey numbers drop sharply, secondary hunters experience food scarcity, causing their population to decline. Your turn. Imagine this change: A sudden illness sweeps through the pond larvae. Which population will decrease? Say its name.

### right:chal-3
*expect: turn · turn_ended: True · 9.7s · audio: 543364 b64 bytes*
*note: student says "Dragonfly Nymph"*

> Yes, Dragonfly Nymph. When prey numbers drop sharply, secondary hunters experience food scarcity, causing their population to decline.

### ask:chal-5
*expect: turn · turn_ended: True · 9.7s · audio: 522884 b64 bytes*
*note: voice item (predict-population-change)*

> Imagine this change: Warmer water temperatures accelerate seasonal plant decay. Which population will increase? Say its name.

### wrong:chal-5
*expect: turn · turn_ended: True · 21.1s · audio: 1246724 b64 bytes*
*note: student says "Great Blue Heron" — a visible population chosen without tracing the disruption through the food web*

> My turn: the answer is Pond Snail and Bacteria. An increase in dead plant and animal matter provides more food sources, allowing decomposers and scavengers to thrive. Your turn. Imagine this change: Warmer water temperatures accelerate seasonal plant decay. Which population will increase? Say its name.

### right:chal-5
*expect: turn · turn_ended: True · 10.3s · audio: 570884 b64 bytes*
*note: student says "Pond Snail and Bacteria"*

> Yes, Pond Snail and Bacteria. An increase in dead plant and animal matter provides more food sources, allowing decomposers and scavengers to thrive.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 364164 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
