# volcano-island levers (2026-10-31, `/add-support-tiers`, SB-7)

| Lever | Type | What the screen does | Answers |
|---|---|---|---|
| `fizz_pairs` | layout | once both erupted: each volcano's spoons drawn beside the cups they fizzed with, leftovers set apart (the pairs are the foam marks) | `kept_prediction`, `misread_result` |
| `changes_marked` | marks | in volcano B's panel, each amount different from A is marked "changed" | `changed_both`, `no_change` |
| `one_step_less` | easier | an ungraded test: change the soda (1 spoon, 3 cups), vinegar locked; none when the item is already that | all |

Easy items start with `fizz_pairs` drawn (after both erupt). Card `unanswered` removed, `levers: true`; boss
`levers: VOLCANO_LEVERS`, `drive.current` rebuilds the practice item.

**Verification:** `volcanoLevers.test.ts` 6 + workspace tests; `test:primitive volcano-island` 725/725;
`typecheck:lumina` 0; full tsc 770. Browser G1 `drive-vlevers.mjs` 7/7 (fizz pairs drawn for A and B; the changed
amount marked; practice opens). $0 Gemini.
