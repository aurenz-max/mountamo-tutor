# Contract: story-bridge

- **Derived:** 2026-09-29 · evidence window: workspace rollout C3 + w1 payloads + `StoryBridge.workspace.test.tsx` + `storyBridgeScript.test.ts` + git
- **Component:** `primitives/visual-primitives/literacy/StoryBridge.tsx` (workspace only) + `storyBridgeScript.ts` (build gates) + `storyBridgeWorkspace.ts` + `storyBridgeLevers.ts` · **Generator:** `service/literacy/gemini-story-bridge.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`story-bridge`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the story-bridge slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 compare characters, settings, events across two read-alouds (taps) | catalog evalModes | `literacy.ts` story-bridge entry | live |
| K-1 spoken comparisons: say_alike, say_different, main_idea_compare | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `storyBridgeWorkspace.ts`; w1 payloads | 2026-09-29 |

## Requirements

### R1 — Story text is heard, not printed, before credit; evidence prints only after · OBSERVED
- **Probe:** `npm test -- StoryBridge.workspace`.

### R2 — A tap key never reaches the tutor; taps are checked by the activity · OBSERVED
- **Probe:** `npm test -- StoryBridge.workspace` ("a tap key never reaches the tutor").

### R3 — Candidates carry no action picture · OBSERVED
- **Property:** story-two candidates show a face and a name only; an action icon on a candidate turns comprehension into picture matching.
- **Probe:** `npm test -- StoryBridge.levers` (only the anchor card gets `anchor-action`).

### R4 — In-item levers (tap modes) · OBSERVED
- **Property:** one help lever per tap mode, built from story ONE's material or a split of the question: `anchor_action` (match_character), `setting_focus` (match_setting), `two_questions` (venn_place, two empty checks), `anchor_timeline` (sequence_two, story one in order). Each answers every tap miss of its mode. Leak rule `leverLeak`: no lever text names the correct choice or quotes story two's matching sentence. No simplify.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- storyBridgeLevers StoryBridge.levers`.

### R5 — In-item levers (spoken modes) · OBSERVED
- **Property:** spoken misses come from `storyBridgeSpokenMisses` (never sent to the tutor): say_alike `one_friend_only`, `told_difference`; say_different `one_friend_only`, `told_likeness`; main_idea_compare `one_story_only`. Help levers, all on every item: `friend_events` (each named friend's own event picture on its card; the tutor re-reads the two friends' sentences), `ask_sign` (both faces with the ask's alike/different sign in the bridge), `two_ideas` (an empty "mostly about?" check under each story). Leak rule `leverLeak` (spoken branch): the lever's own words, less quoted story sentences and the "Do not" fence, carry no reference comparison, shared behaviour, unique detail or big idea. No simplify (a choice would be a tap mode).
- **Demanded by:** `/add-support-tiers` spoken-mode sweep 2026-10-09.
- **Probe:** `npm test -- storyBridgeLevers storyBridgeWorkspace StoryBridge.levers`.
