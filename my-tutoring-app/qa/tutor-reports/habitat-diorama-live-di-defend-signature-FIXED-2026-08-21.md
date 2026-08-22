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
| `chal-1` | voice/choose-supporting-evidence | Herons stand motionless near the shoreline for hours waiting for larger fish to swim past. | ✅ | Water fleas and tadpoles decline rapidly when sunlight is blocked and algae populations fail to grow. | ✅ |
| `chal-2` | voice/choose-supporting-evidence | Mallard ducks preen their wing feathers regularly to maintain buoyancy while floating. | ✅ | Microscopic green algae cells are found inside the digestive tracts of collected water fleas. | ✅ |
| `chal-3` | voice/choose-supporting-evidence | Green algae form thick floating green mats across the sunlit shallow areas of the wetland. | ✅ | Stomach content analysis of sampled mallards reveals remains of aquatic dragonfly nymphs. | ✅ |
| `chal-4` | voice/choose-supporting-evidence | Tiny translucent crustaceans filter single-celled particles from the surrounding water column. | ✅ | Large wading birds hunt smaller vertebrate animals and waterfowl without being preyed upon themselves. | ✅ |
| `chal-5` | voice/choose-supporting-evidence | Adult dragonflies capture flying midges in mid-air using their spiky basket-like legs. | ✅ | Nutrient levels and algae growth recover when benthic bacteria process accumulated organic detritus. | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:chal-1
*expect: turn · turn_ended: True · 17.8s · audio: 1047684 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Hi! Let's make this habitat come alive. Read or listen to the evidence cards, then say the evidence that best supports the claim. Evaluate the role of microscopic producers in maintaining the food web stability within this wetland habitat. Say the evidence that fits.

### wrong:chal-1
*expect: turn · turn_ended: True · 28.2s · audio: 1721604 b64 bytes*
*note: student says "Herons stand motionless near the shoreline for hours waiting for larger fish to swim past." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Water fleas and tadpoles decline rapidly when sunlight is blocked and algae populations fail to grow. Green algae serve as the primary foundational producer, capturing solar energy to support all grazing herbivores like water fleas and tadpoles. Your turn. Evaluate the role of microscopic producers in maintaining the food web stability within this wetland habitat. Say the evidence that fits.

### right:chal-1
*expect: turn · turn_ended: True · 17.2s · audio: 1025284 b64 bytes*
*note: student says "Water fleas and tadpoles decline rapidly when sunlight is blocked and algae populations fail to grow."*

> Yes, Water fleas and tadpoles decline rapidly when sunlight is blocked and algae populations fail to grow. Green algae serve as the primary foundational producer, capturing solar energy to support all grazing herbivores like water fleas and tadpoles.

### ask:chal-2
*expect: turn · turn_ended: True · 10.0s · audio: 549764 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Determine the direct trophic dependency linking primary consumers to their energy sources in the water column. Say the evidence that fits.

### wrong:chal-2
*expect: turn · turn_ended: True · 24.6s · audio: 1487364 b64 bytes*
*note: student says "Mallard ducks preen their wing feathers regularly to maintain buoyancy while floating." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Microscopic green algae cells are found inside the digestive tracts of collected water fleas. Water fleas directly filter and ingest microscopic green algae suspended in the water to gain metabolic energy. Your turn. Determine the direct trophic dependency linking primary consumers to their energy sources in the water column. Say the evidence that fits.

### right:chal-2
*expect: turn · turn_ended: True · 14.8s · audio: 865284 b64 bytes*
*note: student says "Microscopic green algae cells are found inside the digestive tracts of collected water fleas."*

> Yes, Microscopic green algae cells are found inside the digestive tracts of collected water fleas. Water fleas directly filter and ingest microscopic green algae suspended in the water to gain metabolic energy.

### ask:chal-3
*expect: turn · turn_ended: True · 9.7s · audio: 521000 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Identify the evidence demonstrating energy transfer from aquatic insect predators to dabbling waterfowl. Say the evidence that fits.

### wrong:chal-3
*expect: turn · turn_ended: True · 24.3s · audio: 1465604 b64 bytes*
*note: student says "Green algae form thick floating green mats across the sunlit shallow areas of the wetland." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Stomach content analysis of sampled mallards reveals remains of aquatic dragonfly nymphs. Mallard ducks actively forage on benthic and stem-dwelling insect nymphs such as dragonfly larvae for protein. Your turn. Identify the evidence demonstrating energy transfer from aquatic insect predators to dabbling waterfowl. Say the evidence that fits.

### right:chal-3
*expect: turn · turn_ended: True · 13.8s · audio: 794884 b64 bytes*
*note: student says "Stomach content analysis of sampled mallards reveals remains of aquatic dragonfly nymphs."*

> Yes, Stomach content analysis of sampled mallards reveals remains of aquatic dragonfly nymphs. Mallard ducks actively forage on benthic and stem-dwelling insect nymphs such as dragonfly larvae for protein.

### ask:chal-4
*expect: turn · turn_ended: True · 9.0s · audio: 478760 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Select the observation supporting the position of wading birds at the apex of this aquatic food chain. Say the evidence that fits.

### wrong:chal-4
*expect: turn · turn_ended: True · 26.0s · audio: 1584004 b64 bytes*
*note: student says "Tiny translucent crustaceans filter single-celled particles from the surrounding water column." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Large wading birds hunt smaller vertebrate animals and waterfowl without being preyed upon themselves. Great blue herons occupy the highest trophic tier, preying upon secondary consumers like ducks and large frogs without facing local predation. Your turn. Select the observation supporting the position of wading birds at the apex of this aquatic food chain. Say the evidence that fits.

### right:chal-4
*expect: turn · turn_ended: True · 17.3s · audio: 965124 b64 bytes*
*note: student says "Large wading birds hunt smaller vertebrate animals and waterfowl without being preyed upon themselves."*

> Yes, Large wading birds hunt smaller vertebrate animals and waterfowl without being preyed upon themselves. Great blue herons occupy the highest trophic tier, preying upon secondary consumers like ducks and large frogs without facing local predation.

### ask:chal-5
*expect: turn · turn_ended: True · 9.6s · audio: 482564 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Determine how benthic decomposers contribute to nutrient recycling in the wetland ecosystem. Say the evidence that fits.

### wrong:chal-5
*expect: turn · turn_ended: True · 25.4s · audio: 1546884 b64 bytes*
*note: student says "Adult dragonflies capture flying midges in mid-air using their spiky basket-like legs." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Nutrient levels and algae growth recover when benthic bacteria process accumulated organic detritus. Pond bacteria break down dead plant and animal matter at the bottom sediment, returning vital nutrients back into the water for producers. Your turn. Determine how benthic decomposers contribute to nutrient recycling in the wetland ecosystem. Say the evidence that fits.

### right:chal-5
*expect: turn · turn_ended: True · 15.9s · audio: 940840 b64 bytes*
*note: student says "Nutrient levels and algae growth recover when benthic bacteria process accumulated organic detritus."*

> Yes, Nutrient levels and algae growth recover when benthic bacteria process accumulated organic detritus. Pond bacteria break down dead plant and animal matter at the bottom sediment, returning vital nutrients back into the water for producers.

### complete
*expect: turn · turn_ended: True · 7.3s · audio: 391044 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
