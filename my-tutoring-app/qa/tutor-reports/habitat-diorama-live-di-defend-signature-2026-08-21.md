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
| `defend-1` | voice/choose-supporting-evidence | Herons have blue feathers that help them blend into the morning sky above the pond. | ✅ | Water samples show abundant green algae containing chlorophyll that is consumed directly by grazing tadpoles. | ✅ |
| `defend-2` | voice/choose-supporting-evidence | Snails possess a hard spiral shell that protects them from bottom-dwelling predators. | ✅ | Underwater camera footage records immature aquatic insects striking and eating live tadpoles. | ✅ |
| `defend-3` | voice/choose-supporting-evidence | Phytoplankton float freely in the water column without needing any physical attachment. | ✅ | Field observations reveal ducks successfully hiding ducklings among thick stalks of emergent reeds. | ✅ |
| `defend-4` | voice/choose-supporting-evidence | Herons fly between different wetlands searching for fish and amphibians during migration. | ✅ | Examinations of snail radulae show specialized teeth scraping decaying plant detritus off submerged wood. | ✅ |
| `defend-5` | voice/choose-supporting-evidence | Tadpoles grow legs and eventually transform into air-breathing adult frogs. | ✅ | Stomach content analysis of wading herons confirms they consume adult mallards and large fish. | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:defend-1
*expect: turn · turn_ended: True · 19.1s · audio: 1123880 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Hi! Let's make this habitat come alive. Read or listen to the evidence cards, then say the evidence that best supports the claim. Which evidence best supports this claim: Evaluate the claim that energy transfer begins with microscopic producers in the water column.? Say the evidence that fits.

### wrong:defend-1
*expect: turn · turn_ended: True · 26.8s · audio: 1635204 b64 bytes*
*note: student says "Herons have blue feathers that help them blend into the morning sky above the pond." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Water samples show abundant green algae containing chlorophyll that is consumed directly by grazing tadpoles.. Phytoplankton capture sunlight through photosynthesis, creating the base energy for primary consumers like tadpoles. Your turn. Which evidence best supports this claim: Evaluate the claim that energy transfer begins with microscopic producers in the water column.? Say the evidence that fits.

### right:defend-1
*expect: turn · turn_ended: True · 15.4s · audio: 901764 b64 bytes*
*note: student says "Water samples show abundant green algae containing chlorophyll that is consumed directly by grazing tadpoles."*

> Yes, Water samples show abundant green algae containing chlorophyll that is consumed directly by grazing tadpoles.. Phytoplankton capture sunlight through photosynthesis, creating the base energy for primary consumers like tadpoles.

### ask:defend-2
*expect: turn · turn_ended: True · 11.9s · audio: 645764 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Which evidence best supports this claim: Evaluate the claim that dragonfly nymphs act as active secondary consumers in the aquatic food web.? Say the evidence that fits.

### wrong:defend-2
*expect: turn · turn_ended: True · 26.2s · audio: 1602564 b64 bytes*
*note: student says "Snails possess a hard spiral shell that protects them from bottom-dwelling predators." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Underwater camera footage records immature aquatic insects striking and eating live tadpoles.. Dragonfly nymphs possess specialized hinged mouthparts used to capture and consume small moving primary consumers. Your turn. Which evidence best supports this claim: Evaluate the claim that dragonfly nymphs act as active secondary consumers in the aquatic food web.? Say the evidence that fits.

### right:defend-2
*expect: turn · turn_ended: True · 14.5s · audio: 856324 b64 bytes*
*note: student says "Underwater camera footage records immature aquatic insects striking and eating live tadpoles."*

> Yes, Underwater camera footage records immature aquatic insects striking and eating live tadpoles.. Dragonfly nymphs possess specialized hinged mouthparts used to capture and consume small moving primary consumers.

### ask:defend-3
*expect: turn · turn_ended: True · 11.1s · audio: 600964 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Which evidence best supports this claim: Evaluate the claim that cattail stands provide essential structural shelter for nesting waterfowl.? Say the evidence that fits.

### wrong:defend-3
*expect: turn · turn_ended: True · 25.2s · audio: 1537924 b64 bytes*
*note: student says "Phytoplankton float freely in the water column without needing any physical attachment." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Field observations reveal ducks successfully hiding ducklings among thick stalks of emergent reeds.. Dense emergent vegetation protects vulnerable bird species and their nests from terrestrial and aerial predators. Your turn. Which evidence best supports this claim: Evaluate the claim that cattail stands provide essential structural shelter for nesting waterfowl.? Say the evidence that fits.

### right:defend-3
*expect: turn · turn_ended: True · 13.8s · audio: 806404 b64 bytes*
*note: student says "Field observations reveal ducks successfully hiding ducklings among thick stalks of emergent reeds."*

> Yes, Field observations reveal ducks successfully hiding ducklings among thick stalks of emergent reeds.. Dense emergent vegetation protects vulnerable bird species and their nests from terrestrial and aerial predators.

### ask:defend-4
*expect: turn · turn_ended: True · 10.4s · audio: 566404 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Which evidence best supports this claim: Evaluate the claim that pond snails play a vital recycling role as benthic decomposers.? Say the evidence that fits.

### wrong:defend-4
*expect: turn · turn_ended: True · 25.8s · audio: 1559684 b64 bytes*
*note: student says "Herons fly between different wetlands searching for fish and amphibians during migration." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Examinations of snail radulae show specialized teeth scraping decaying plant detritus off submerged wood.. Snails scrape away dead organic matter and waste, helping return essential nutrients back into the ecosystem. Your turn. Which evidence best supports this claim: Evaluate the claim that pond snails play a vital recycling role as benthic decomposers.? Say the evidence that fits.

### right:defend-4
*expect: turn · turn_ended: True · 14.7s · audio: 864004 b64 bytes*
*note: student says "Examinations of snail radulae show specialized teeth scraping decaying plant detritus off submerged wood."*

> Yes, Examinations of snail radulae show specialized teeth scraping decaying plant detritus off submerged wood.. Snails scrape away dead organic matter and waste, helping return essential nutrients back into the ecosystem.

### ask:defend-5
*expect: turn · turn_ended: True · 10.7s · audio: 579204 b64 bytes*
*note: voice item (choose-supporting-evidence)*

> Which evidence best supports this claim: Evaluate the claim that great blue herons occupy the top tier of this wetland food chain.? Say the evidence that fits.

### wrong:defend-5
*expect: turn · turn_ended: True · 25.5s · audio: 1543044 b64 bytes*
*note: student says "Tadpoles grow legs and eventually transform into air-breathing adult frogs." — a true-looking detail that does not support the ecological claim*

> My turn: the answer is Stomach content analysis of wading herons confirms they consume adult mallards and large fish.. Herons are apex predators with no regular natural predators within the pond habitat, feeding on large fish and birds. Your turn. Which evidence best supports this claim: Evaluate the claim that great blue herons occupy the top tier of this wetland food chain.? Say the evidence that fits.

### right:defend-5
*expect: turn · turn_ended: True · 14.4s · audio: 831364 b64 bytes*
*note: student says "Stomach content analysis of wading herons confirms they consume adult mallards and large fish."*

> Yes, Stomach content analysis of wading herons confirms they consume adult mallards and large fish.. Herons are apex predators with no regular natural predators within the pond habitat, feeding on large fish and birds.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 358404 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
