# Contract: story-ribbon

- **Derived:** 2026-09-28 · evidence window: workspace rollout C3 + w1 payloads + `StoryRibbon.workspace.test.tsx` + `storyRibbonSupport.test.ts` + git
- **Component:** `primitives/visual-primitives/literacy/StoryRibbon.tsx` (workspace only) + `storyRibbonWorkspace.ts` + `storyRibbonSupport.ts` + `storyRibbonLevers.ts` · **Generator:** `service/literacy/gemini-story-ribbon.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`story-ribbon`)
- **Status:** ACTIVE · one open finding (R5)

Static derivation for the story-ribbon slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 oral retell: connected, present, future, past accounts | catalog evalModes | `literacy.ts` story-ribbon entry | live |
| K-1 story-to-experience connection | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `storyRibbonWorkspace.ts`; w1 payloads | 2026-09-28 |

## Requirements

### R1 — Only the spoken account is judged; the card order is a planning aid · OBSERVED
- **Probe:** `npm test -- StoryRibbon.workspace`.

### R2 — Event sentences stay private until credit; the cards start mixed · OBSERVED
- **Property:** picture labels are short, time-neutral nouns; the scene lists them alphabetically; `mixedEventIds` never deals the story order.
- **Probe:** `npm test -- StoryRibbon.workspace storyRibbonScript`.

### R3 — Three events per graded item; the support tier never changes the story, order, time or task · OBSERVED
- **Probe:** `npm test -- storyRibbonSupport`.

### R4 — In-item levers · OBSERVED
- **Property:** `sequence_labels` (answers `events_missing`) and `flow_arrows` (answers `labels_listed`) mark the three SLOTS, never a card, so they stay put when cards swap; `connection_frame` (answers `event_only`, `no_connection`) on story_to_experience. All help, shown, offered only where the tier withdrew the aid. `out_of_order` and `tense_drift` have no lever by decision (catalog `unanswered`). No simplify.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- storyRibbonLevers StoryRibbon.levers`.

### R5 — The live order self-check is not a lever · OPEN FINDING
- **Property:** the easy tier's self-check turns green on the story order, so a learner can swap until it lights and read the order off it. It is kept as the easy tier's starting position (unchanged here) and is never offered as a lever. Whether easy should keep it is queued (`levers-literacy-L4-2026-09-28.md`).
