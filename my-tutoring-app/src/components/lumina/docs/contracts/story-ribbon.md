# Contract: story-ribbon

- **Derived:** 2026-09-28 · evidence window: workspace rollout C3 + w1 payloads + `StoryRibbon.workspace.test.tsx` + `storyRibbonSupport.test.ts` + git
- **Component:** `primitives/visual-primitives/literacy/StoryRibbon.tsx` (workspace only) + `storyRibbon.card.ts` + `storyRibbon.boss.ts` + `storyRibbonDomain.ts` + `storyRibbonSupport.ts` + `storyRibbonLevers.ts` · **Generator:** `service/literacy/gemini-story-ribbon.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`story-ribbon`)
- **Status:** ACTIVE · one open finding (R5)

Static derivation for the story-ribbon slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 oral retell: connected, present, future, past accounts | catalog evalModes | `literacy.ts` story-ribbon entry | live |
| K-1 story-to-experience connection | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `storyRibbon.boss.ts` (spoken preset); w1 payloads | 2026-10-19 |

## Requirements

### R1 — Only the spoken account is judged; the card order is a planning aid · OBSERVED
- **Probe:** `npm test -- StoryRibbon.workspace`.

### R2 — Event sentences stay private until credit; the cards start mixed · OBSERVED
- **Property:** picture labels are short, time-neutral nouns; the scene lists them alphabetically; `mixedEventIds` never deals the story order.
- **Probe:** `npm test -- StoryRibbon.workspace storyRibbonDomain`.

### R3 — Three events per graded item; the support tier never changes the story, order, time or task · OBSERVED
- **Probe:** `npm test -- storyRibbonSupport`.

### R4 — In-item levers · OBSERVED
- **Property:** `sequence_labels` (answers `events_missing`) and `flow_arrows` (answers `labels_listed`) mark the three SLOTS, never a card, so they stay put when cards swap; `connection_frame` (answers `event_only`, `no_connection`) on story_to_experience. All help, shown, offered only where the tier withdrew the aid. `out_of_order` and `tense_drift` have no lever by decision (catalog `unanswered`). No simplify. One lever set (`STORY_RIBBON_LEVERS`): labels and arrows are `marks`, the frame is `custom`.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- storyRibbonLevers StoryRibbon.levers`.

### R5 — The live order self-check is not a lever · OPEN FINDING
- **Property:** the easy tier's self-check turns green on the story order, so a learner can swap until it lights and read the order off it. It is kept as the easy tier's starting position (unchanged here) and is never offered as a lever. Whether easy should keep it is queued (`levers-literacy-L4-2026-09-28.md`).

### R6 — listen_retell and tell_own · OBSERVED (generation 11-10)
- **Property:** listen_retell reads its event sentences aloud in the ask (an eval-mode split from R2: here the story is the stimulus) and starts the cards mixed; three events on easy, four on medium and hard, alternating when untiered; the live order self-check never shows (it would light on the remembered order). Credit: events in order with an order word on two; misses out_of_order, one_event, no_order_words (the `order_words` lever answers the last). tell_own is code-only: six library cards (two animals, three carryable things, one place), any pick of up to three, never graded; credit: a connected story with a beginning, something that happens and an end; misses describes_cards, one_event, both unanswered by decision. Mixed sessions still schedule only the five original modes.
- **Demanded by:** handoff H2 (K LA audit SP6: #61, #186, #187, #189).
- **Probe:** `npm test -- storyRibbonLevers gemini-story-ribbon.shape journeySweep -t story-ribbon` (w1 payloads `story-ribbon.{listen_retell,tell_own}.json`).

## History

- 2026-11-10: listen_retell and tell_own (R6), handoff H2.

- 2026-10-19: moved onto a boss (spoken preset, boss migration wave 1). The key is a `SpokenKey` judged on meaning (the three events in order, the tense modes' time; story to experience: an event, another experience, the connection, never judging a memory). R1-R5 unchanged. The script module became `storyRibbonDomain.ts`; its cue builders and pack went with the scripted runner.
