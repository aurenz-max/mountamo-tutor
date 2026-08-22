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
| `obs-1` | voice/name-from-ecological-evidence | I do not know | ✅ | Green Algae | ✅ |
| `obs-2` | voice/name-from-ecological-evidence | I do not know | ✅ | Water Flea | ✅ |
| `obs-3` | voice/name-from-ecological-evidence | I do not know | ✅ | Dragonfly Nymph | ✅ |
| `obs-4` | voice/name-from-ecological-evidence | I do not know | ✅ | Mallard Duck | ✅ |
| `obs-5` | voice/name-from-ecological-evidence | I do not know | ✅ | Pond Snail | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:obs-1
*expect: turn · turn_ended: True · 18.5s · audio: 1079720 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Hi! Let's make this habitat come alive. Use the clues in the living scene, then answer with a living thing's name. Look across the habitat. Which organism uses sunlight to produce its own food at the base of the food web? Which living thing fits that evidence? Say its name.

### wrong:obs-1
*expect: turn · turn_ended: True · 21.2s · audio: 1251880 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Green Algae. Green Algae captures energy from sunlight to make food through photosynthesis, serving as a primary producer. Your turn. Look across the habitat. Which organism uses sunlight to produce its own food at the base of the food web? Which living thing fits that evidence? Say its name.

### right:obs-1
*expect: turn · turn_ended: True · 9.7s · audio: 509444 b64 bytes*
*note: student says "Green Algae"*

> Yes, Green Algae. Green Algae captures energy from sunlight to make food through photosynthesis, serving as a primary producer.

### ask:obs-2
*expect: turn · turn_ended: True · 12.2s · audio: 654724 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which organism is a microscopic crustacean that drifts in the water and grazes on algae? Which living thing fits that evidence? Say its name.

### wrong:obs-2
*expect: turn · turn_ended: True · 20.1s · audio: 1201924 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Water Flea. Water Flea is a primary consumer that feeds directly on microscopic green algae. Your turn. Look across the habitat. Which organism is a microscopic crustacean that drifts in the water and grazes on algae? Which living thing fits that evidence? Say its name.

### right:obs-2
*expect: turn · turn_ended: True · 8.0s · audio: 421800 b64 bytes*
*note: student says "Water Flea"*

> Yes, Water Flea. Water Flea is a primary consumer that feeds directly on microscopic green algae.

### ask:obs-3
*expect: turn · turn_ended: True · 11.6s · audio: 651560 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which aquatic insect larva uses a hinged jaw to hunt small animals underwater? Which living thing fits that evidence? Say its name.

### wrong:obs-3
*expect: turn · turn_ended: True · 19.8s · audio: 1185288 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Dragonfly Nymph. Dragonfly Nymph is an agile underwater predator that catches small swimming prey. Your turn. Look across the habitat. Which aquatic insect larva uses a hinged jaw to hunt small animals underwater? Which living thing fits that evidence? Say its name.

### right:obs-3
*expect: turn · turn_ended: True · 7.9s · audio: 427524 b64 bytes*
*note: student says "Dragonfly Nymph"*

> Yes, Dragonfly Nymph. Dragonfly Nymph is an agile underwater predator that catches small swimming prey.

### ask:obs-4
*expect: turn · turn_ended: True · 11.2s · audio: 621444 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which water bird uses a flat bill with comb-like edges to dabble for food? Which living thing fits that evidence? Say its name.

### wrong:obs-4
*expect: turn · turn_ended: True · 18.9s · audio: 1130884 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Mallard Duck. Mallard Duck paddles in the shallows, filtering plants and small animals from the water. Your turn. Look across the habitat. Which water bird uses a flat bill with comb-like edges to dabble for food? Which living thing fits that evidence? Say its name.

### right:obs-4
*expect: turn · turn_ended: True · 7.3s · audio: 392964 b64 bytes*
*note: student says "Mallard Duck"*

> Yes, Mallard Duck. Mallard Duck paddles in the shallows, filtering plants and small animals from the water.

### ask:obs-5
*expect: turn · turn_ended: True · 11.5s · audio: 641924 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which shelled animal crawls on decaying matter and recycles nutrients back into the ecosystem? Which living thing fits that evidence? Say its name.

### wrong:obs-5
*expect: turn · turn_ended: True · 20.3s · audio: 1215364 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Pond Snail. Pond Snail acts as a decomposer, scraping up decaying organic material from the pond floor. Your turn. Look across the habitat. Which shelled animal crawls on decaying matter and recycles nutrients back into the ecosystem? Which living thing fits that evidence? Say its name.

### right:obs-5
*expect: turn · turn_ended: True · 8.4s · audio: 453764 b64 bytes*
*note: student says "Pond Snail"*

> Yes, Pond Snail. Pond Snail acts as a decomposer, scraping up decaying organic material from the pond floor.

### complete
*expect: turn · turn_ended: True · 8.0s · audio: 371204 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
