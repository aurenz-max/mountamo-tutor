# Tier-3 Live Tutor Report — story-bridge — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "story-bridge", "items": 3, "voice_items": 0, "gesture_items": 3, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Kindergarten", "undrivable_items": []}`
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
| `story-bridge-1-1` | gesture/match_character | (placement) | ✅ | (placement) | ✅ |
| `story-bridge-1-2` | gesture/match_character | (placement) | ✅ | (placement) | ✅ |
| `story-bridge-1-3` | gesture/match_character | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:story-bridge-1-1
*expect: turn · turn_ended: True · 50.1s · audio: 3100804 b64 bytes*
*note: gesture item (match_character)*

> Hi! Story time — two stories today! Here are two stories. I read both. Then I name a friend from one story, and you find the friend in the other story who is like them — and tap that friend! Story one, The Rainy Day Rescue: Water pooled in the muddy yard. Dog shared a warm towel. Ant carried a big twig. Frog sang a song to make Toad smile. Everyone felt warm and dry. Story two, The Sunny Park Games: The grass felt soft at the park. Cat shared a sweet snack. Bear carried a heavy log. Owl told a funny joke to make Fox laugh. Everyone felt happy and proud. Think about Dog in The Rainy Day Rescue. Find the friend in The Sunny Park Games who is like Dog. Your turn. Tap that friend.

### hands-hold:story-bridge-1-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:story-bridge-1-1
*expect: turn · turn_ended: True · 12.8s · audio: 721924 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: in The Rainy Day Rescue, Dog shared a warm towel. One friend in The Sunny Park Games did the same — both shared something to help a friend. Your turn. Tap that friend.

### commit-right:story-bridge-1-1
*expect: turn · turn_ended: True · 9.9s · audio: 533160 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Dog and Cat are alike — both shared something to help a friend. Dog shared a warm towel. Cat shared a sweet snack.

### ask:story-bridge-1-2
*expect: turn · turn_ended: True · 9.4s · audio: 498564 b64 bytes*
*note: gesture item (match_character)*

> Think about Bear in The Sunny Park Games. Find the friend in The Rainy Day Rescue who is like Bear. Your turn. Tap that friend.

### hands-hold:story-bridge-1-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:story-bridge-1-2
*expect: turn · turn_ended: True · 12.2s · audio: 702724 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: in The Sunny Park Games, Bear carried a heavy log. One friend in The Rainy Day Rescue did the same — both carried something heavy. Your turn. Tap that friend.

### commit-right:story-bridge-1-2
*expect: turn · turn_ended: True · 9.4s · audio: 501124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Bear and Ant are alike — both carried something heavy. Bear carried a heavy log. Ant carried a big twig.

### ask:story-bridge-1-3
*expect: turn · turn_ended: True · 9.1s · audio: 473640 b64 bytes*
*note: gesture item (match_character)*

> Think about Frog in The Rainy Day Rescue. Find the friend in The Sunny Park Games who is like Frog. Your turn. Tap that friend.

### hands-hold:story-bridge-1-3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:story-bridge-1-3
*expect: turn · turn_ended: True · 12.6s · audio: 736644 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: in The Rainy Day Rescue, Frog sang a song to make Toad smile. One friend in The Sunny Park Games did the same — both cheered up a friend who was sad. Your turn. Tap that friend.

### commit-right:story-bridge-1-3
*expect: turn · turn_ended: True · 11.0s · audio: 606120 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes! Frog and Owl are alike — both cheered up a friend who was sad. Frog sang a song to make Toad smile. Owl told a funny joke to make Fox laugh.

### complete
*expect: turn · turn_ended: True · 6.5s · audio: 345640 b64 bytes*

> What great story work! You found the friends who are alike in both stories. See you next time!
