# Contract: classification-sorter

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C14) for the workspace and lever requirements only. A full `/primitive-contract classification-sorter` derivation (consumers per curriculum skill, the K-2 reader-fit stage, the generator's band rules) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/biology/ClassificationSorter.tsx` · **Workspace:** `classificationSorterWorkspace.ts` · **Levers:** `classificationSorterLevers.ts` · **Adapter:** `components/live-activity/adapters/classificationSorterLive.ts` · **Generator:** `service/biology/gemini-classification-sorter.ts` · **Catalog:** `service/manifest/catalog/biology.ts` (`classification-sorter`)

## Requirements

### R0 — the reader-fit stage at K-2 is kept · OBSERVED (before this contract)
- **Property:** at K-2 one item is staged at a time and a tap on a group places it; no progress fraction, no debug readout, no group description; `imagePrompt` is never rendered; the scripted cues never name an item's group.
- **Probe:** `__tests__/ClassificationSorter.reader-fit.test.tsx` (11, unchanged and passing after the binding).

### R1 — one mode, `sort`, binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** the catalog's single eval mode `sort` (β 2.5, the backend's existing `default` prior; `problem_type_registry.py` keeps `default` for earlier sessions). Under a live tutor each item is one challenge, staged alone at every band (3-8 lose the free-order drag on this path only); a tap on a group card is the checked answer (`sortMatches`), and each wrong tap names a `SortMiss` (`repeated_group`, `parent_group`, `sibling_group`, `wrong_group`). Scene facts carry the rule, the group names, the card on stage and the credited cards in their bins, never the card's group. The generated hint is not shown on a miss (it can name the answer); Try again reopens the same card. The scripted path keeps its drag, its Submit and its cues.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C14.
- **Evidence:** `ClassificationSorter.workspace.test.tsx` 5; sweep J1-J13 on the K payload, 0 findings, 8/8 misses named; replay `qa/tutor-reports/replay/classification-sorter-2026-10-09-r2.json`.
- **Probe:** `ClassificationSorter.workspace.test.tsx`; `journeySweep -t classification-sorter`.

### R2 — the levers show more about the groups or the card, never the card's group · OBSERVED (2026-10-09)
- **Property:** three help levers (`classificationSorterLevers.ts`), no simplify: `group_meaning` (the group descriptions, only where the band hides them and none names the card; a group's own name reads "this group"), `card_clue` (the card's hint with every word built on a group-name stem blanked; offered only if three words remain), `sorted_marks` (rings the credited cards; only once one exists). Every `SortMiss` is answered by `group_meaning` or `card_clue` on every saved payload item. The meaning fact lists descriptions by group position, not beside the group names. No simplify: fewer groups on the learner's own card leaves a two-way choice that hands over the answer, and any other card is a later graded item.
- **Demanded by:** /add-support-tiers, C14 lever pass.
- **Evidence:** `classificationSorterLevers.test.ts` 20, `ClassificationSorter.levers.workspace.test.tsx` 3; sweep J1-J13, 0 findings; replay `qa/tutor-reports/replay/classification-sorter-2026-10-09-r3.json`.
- **Probe:** the two lever tests; `journeySweep -t classification-sorter`.

## Changelog

- 2026-10-09: created with R0-R2 (eval mode `sort`, W1 plain-shape binding, levers).
