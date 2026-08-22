# Tier-3 Live Tutor Report — habitat-diorama — 2026-08-21

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "habitat-diorama", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "obs-1", "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:obs-1 1/1, wrong3:obs-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `obs-1` | voice/name-from-ecological-evidence | I do not know | ✅✅✅ | - | n/a |
| `obs-2` | voice/name-from-ecological-evidence | I do not know | ✅ | Water Flea | ✅ |
| `obs-3` | voice/name-from-ecological-evidence | I do not know | ✅ | Dragonfly Nymph | ✅ |
| `obs-4` | voice/name-from-ecological-evidence | I do not know | ✅ | Pond Snail | ✅ |
| `obs-5` | voice/name-from-ecological-evidence | I do not know | ✅ | Pond Detritus Bacteria | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:obs-1
*expect: turn · turn_ended: True · 18.5s · audio: 1083524 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Hi! Let's make this habitat come alive. Use the clues in the living scene, then answer with a living thing's name. Look across the habitat. Look for the microscopic producer that floats in the water column and uses sunlight to make food. Which living thing fits that evidence? Say its name.

### wrong1:obs-1
*expect: turn · turn_ended: True · 21.3s · audio: 1264004 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Green Phytoplankton. Green Phytoplankton absorbs sunlight and serves as the primary food producer for microscopic grazers. Your turn. Look across the habitat. Look for the microscopic producer that floats in the water column and uses sunlight to make food. Which living thing fits that evidence? Say its name.

### wrong2:obs-1
*expect: turn · turn_ended: True · 21.7s · audio: 1276804 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Green Phytoplankton. Green Phytoplankton absorbs sunlight and serves as the primary food producer for microscopic grazers. Your turn. Look across the habitat. Look for the microscopic producer that floats in the water column and uses sunlight to make food. Which living thing fits that evidence? Say its name.

### wrong3:obs-1
*expect: turn · turn_ended: True · 21.4s · audio: 1288324 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Green Phytoplankton. Green Phytoplankton absorbs sunlight and serves as the primary food producer for microscopic grazers. Your turn. Look across the habitat. Look for the microscopic producer that floats in the water column and uses sunlight to make food. Which living thing fits that evidence? Say its name.

### moveon:obs-1
*expect: turn · turn_ended: True · 12.0s · audio: 668804 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try. Look across the habitat. Find the tiny translucent crustacean that filters microscopic algae out of the water. Which living thing fits that evidence? Say its name.

### wrong:obs-2
*expect: turn · turn_ended: True · 19.5s · audio: 1166724 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Water Flea. The Water Flea acts as a primary consumer by filtering and eating suspended algae. Your turn. Look across the habitat. Find the tiny translucent crustacean that filters microscopic algae out of the water. Which living thing fits that evidence? Say its name.

### right:obs-2
*expect: turn · turn_ended: True · 7.8s · audio: 401284 b64 bytes*
*note: student says "Water Flea"*

> Yes, Water Flea. The Water Flea acts as a primary consumer by filtering and eating suspended algae.

### ask:obs-3
*expect: turn · turn_ended: True · 11.5s · audio: 632360 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Identify the underwater ambush hunter equipped with a hinged jaw for catching small swimming prey. Which living thing fits that evidence? Say its name.

### wrong:obs-3
*expect: turn · turn_ended: True · 19.8s · audio: 1188484 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Dragonfly Nymph. The Dragonfly Nymph uses specialized mouthparts to snap up small invertebrates underwater. Your turn. Look across the habitat. Identify the underwater ambush hunter equipped with a hinged jaw for catching small swimming prey. Which living thing fits that evidence? Say its name.

### right:obs-3
*expect: turn · turn_ended: True · 7.9s · audio: 417284 b64 bytes*
*note: student says "Dragonfly Nymph"*

> Yes, Dragonfly Nymph. The Dragonfly Nymph uses specialized mouthparts to snap up small invertebrates underwater.

### ask:obs-4
*expect: turn · turn_ended: True · 10.8s · audio: 584964 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Locate the slow-moving spiral-shelled mollusk that scrapes algae off submerged rocks. Which living thing fits that evidence? Say its name.

### wrong:obs-4
*expect: turn · turn_ended: True · 19.0s · audio: 1107204 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Pond Snail. The Pond Snail uses a specialized tongue called a radula to graze on algae. Your turn. Look across the habitat. Locate the slow-moving spiral-shelled mollusk that scrapes algae off submerged rocks. Which living thing fits that evidence? Say its name.

### right:obs-4
*expect: turn · turn_ended: True · 7.1s · audio: 369284 b64 bytes*
*note: student says "Pond Snail"*

> Yes, Pond Snail. The Pond Snail uses a specialized tongue called a radula to graze on algae.

### ask:obs-5
*expect: turn · turn_ended: True · 11.0s · audio: 597764 b64 bytes*
*note: voice item (name-from-ecological-evidence)*

> Look across the habitat. Spot the microscopic decomposer living in the bottom mud that breaks down dead organic matter. Which living thing fits that evidence? Say its name.

### wrong:obs-5
*expect: turn · turn_ended: True · 20.3s · audio: 1209604 b64 bytes*
*note: student says "I do not know"*

> My turn: the answer is Pond Detritus Bacteria. Pond Detritus Bacteria recycle nutrients by breaking down dead plant and animal material. Your turn. Look across the habitat. Spot the microscopic decomposer living in the bottom mud that breaks down dead organic matter. Which living thing fits that evidence? Say its name.

### right:obs-5
*expect: turn · turn_ended: True · 8.9s · audio: 466564 b64 bytes*
*note: student says "Pond Detritus Bacteria"*

> Yes, Pond Detritus Bacteria. Pond Detritus Bacteria recycle nutrients by breaking down dead plant and animal material.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 330244 b64 bytes*

> You thought like an ecologist today — you looked for connections and consequences. See you next time!
