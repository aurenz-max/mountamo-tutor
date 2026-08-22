# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
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
| `obs_1` | voice/name-from-ecological-evidence | Pond Snail | ✅ | Green Algae | ✅ |
| `obs_2` | voice/name-from-ecological-evidence | Mallard Duck | ✅ | Pond Snail | ✅ |
| `obs_3` | voice/name-from-ecological-evidence | Garter Snake | ✅ | Mallard Duck | ✅ |
| `obs_4` | voice/name-from-ecological-evidence | Green Algae | ✅ | Dragonfly Nymph | ✅ |
| `obs_5` | voice/name-from-ecological-evidence | Mallard Duck | ✅ | Aquatic Fungi | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:obs_1
*expect: turn · turn_ended: True · 18.3s · audio: 1045764 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Hi! Let's make this habitat come alive. Use the clues in the living scene, then answer with a living thing's name. Look across the habitat. Which organism uses sunlight to produce its own food through photosynthesis? Which living thing fits that evidence? Say its name.

### wrong:obs_1
*expect: turn · turn_ended: True · 20.9s · audio: 1231364 b64 bytes*
*note: student says "Pond Snail" — a plausible living thing or model move that does not match the ecological evidence*

> My turn: the answer is Green Algae. Green Algae acts as a producer by capturing sunlight to create food for the whole pond ecosystem. Your turn. Look across the habitat. Which organism uses sunlight to produce its own food through photosynthesis? Which living thing fits that evidence? Say its name.

### right:obs_1
*expect: turn · turn_ended: True · 9.2s · audio: 497284 b64 bytes*
*note: student says "Green Algae"*

> Yes, Green Algae. Green Algae acts as a producer by capturing sunlight to create food for the entire pond ecosystem.

### ask:obs_2
*expect: turn · turn_ended: True · 12.3s · audio: 655364 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which organism crawls along plant stems and scrapes algae using a rasping radula? Which living thing fits that evidence? Say its name.

### wrong:obs_2
*expect: turn · turn_ended: True · 19.8s · audio: 1179524 b64 bytes*
*note: student says "Mallard Duck" — a plausible living thing or model move that does not match the ecological evidence*

> My turn: the answer is Pond Snail. The Pond Snail scrapes microscopic algae from submerged surfaces to feed. Your turn. Look across the habitat. Which organism crawls along plant stems and scrapes algae using a rasping radula? Which living thing fits that evidence? Say its name.

### right:obs_2
*expect: turn · turn_ended: True · 7.7s · audio: 401284 b64 bytes*
*note: student says "Pond Snail"*

> Yes, Pond Snail. The Pond Snail scrapes microscopic algae from submerged surfaces to feed.

### ask:obs_3
*expect: turn · turn_ended: True · 12.1s · audio: 647684 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which organism is a dabbling bird with waterproof feathers and a flat bill for filtering food? Which living thing fits that evidence? Say its name.

### wrong:obs_3
*expect: turn · turn_ended: True · 20.7s · audio: 1208964 b64 bytes*
*note: student says "Garter Snake" — a plausible living thing or model move that does not match the ecological evidence*

> My turn: the answer is Mallard Duck. The Mallard Duck filters seeds, plants, and small invertebrates from the water's surface. Your turn. Look across the habitat. Which organism is a dabbling bird with waterproof feathers and a flat bill for filtering food? Which living thing fits that evidence? Say its name.

### right:obs_3
*expect: turn · turn_ended: True · 8.5s · audio: 414724 b64 bytes*
*note: student says "Mallard Duck"*

> Yes, Mallard Duck. The Mallard Duck filters seeds, plants, and small invertebrates from the water's surface.

### ask:obs_4
*expect: turn · turn_ended: True · 12.9s · audio: 648324 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which organism waits in the mud with a specialized hinged jaw to ambush aquatic prey? Which living thing fits that evidence? Say its name.

### wrong:obs_4
*expect: turn · turn_ended: True · 20.1s · audio: 1128968 b64 bytes*
*note: student says "Green Algae" — a plausible living thing or model move that does not match the ecological evidence*

> My turn: the answer is Dragonfly Nymph. The Dragonfly Nymph is an ambush hunter in the underwater zone. Your turn. Look across the habitat. Which organism waits in the mud with a specialized hinged jaw to ambush aquatic prey? Which living thing fits that evidence? Say its name.

### right:obs_4
*expect: turn · turn_ended: True · 7.1s · audio: 339844 b64 bytes*
*note: student says "Dragonfly Nymph"*

> Yes, Dragonfly Nymph. The Dragonfly Nymph is an ambush hunter in the underwater zone.

### ask:obs_5
*expect: turn · turn_ended: True · 12.1s · audio: 640004 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Which organism breaks down dead organic matter and returns nutrients to the pond sediment? Which living thing fits that evidence? Say its name.

### wrong:obs_5
*expect: turn · turn_ended: True · 20.4s · audio: 1198088 b64 bytes*
*note: student says "Mallard Duck" — a plausible living thing or model move that does not match the ecological evidence*

> My turn: the answer is Aquatic Fungi. Aquatic Fungi act as decomposers that recycle nutrients from dead matter. Your turn. Look across the habitat. Which organism breaks down dead organic matter and returns nutrients to the pond sediment? Which living thing fits that evidence? Say its name.

### right:obs_5
*expect: turn · turn_ended: True · 7.9s · audio: 389764 b64 bytes*
*note: student says "Aquatic Fungi"*

> Yes, Aquatic Fungi. Aquatic Fungi act as decomposers that recycle nutrients from dead matter.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 353284 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
