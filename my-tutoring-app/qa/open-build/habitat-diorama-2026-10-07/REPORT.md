# habitat-diorama — `build_habitat` open build (OB-3S), 2026-10-07

Built in an agent worktree from e8e0191d, merged into the main tree with `tools/merge_wt.py` and re-gated there.

## Was `restore` already this task? No

`restore` is one tap: one missing organism, one right zone out of six. `build_habitat` starts from an empty scene
and the learner assembles a whole habitat for a named animal. Many habitats pass. It is a new challenge type; the
other five modes are unchanged.

## Design

- **Task.** "Build a habitat where a frog can live. Give it everything it needs." The ask names the animal and never
  the needs; knowing the needs is the task. K-2: food, water, shelter. Grade 3+: also the right weather.
- **Judge (code, at "I'm done!").** Every asked need met by a piece in the animal's `meets` list; no piece in its
  `harmedBy` list. Extra pieces do not fail.
- **Misses** (none names the need): `harmful_piece`, `several_needs_unmet`, `other_animals_piece` (right kind of
  piece, wrong animal: salty sea for a frog), `one_need_unmet`. The animal's explanation appears only after a pass.
- **Levers** (bare at start): `needs_list` (help: the kinds of need every animal has, nothing ticked), `piece_tags`
  (help: a `data-aid` tag on each placed piece), `fewer_needs` (simplify: food and water only, ungraded, empty scene).
- **Tray.** Per need up to 2 pieces that meet it, 1 same-kind distractor, any harmful weather; seeded shuffle.
  Distractors skip pieces the animal sometimes uses in nature (`contested`; a bullfrog eats mice). Bear was
  replaced by deer because a bear eats nearly every food piece.
- **Scene facts:** `piecesPlaced`, `needsMet`, `harmfulPieces` (tested: `workHistory` records `harmfulPieces 0 → 1 → 0`).
- **Generator.** Pinned: no model call, 4 distinct animals, needs by band. In a blend, code appends 2 build items for
  animals not in the generated scene. Unpinned mixed sessions do not include it.
- **Watcher.** `numbers: 'allowed'`, `neverSay` need words (eat/drink, hide, home, cold/warm...). The scene note
  says the animal and backdrop were not made by the child.
- Catalog β 6.6 (restore + 0.1), `answers: ['build']`; backend prior; oracle `habitat-diorama` (searches every
  tray subset: ≥2 passing habitats, ≥1 wrong piece, no contested distractor, no need word in the ask).

Size: ~600 production lines, oracle 87, tests ~280, probe scripts 162.

## Gates

| Gate | Result |
|---|---|
| vitest (worktree): biology, generator, oracles, build-layer | 51 files, 888/888 |
| vitest (main tree after merge): biology, chemistry, oracles, build-layer, live-activity | 94 files, 1 failure = peer's in-progress `cvc-speller.make_word` payload |
| `typecheck:lumina` | 0 (main tree after merge) |
| full tsc | 770 = baseline (worktree) |
| journey sweep `build_habitat` | 4 items, 0 findings, 4/4 misses named; clean 100 / recovery 67 |
| real generator + oracle | 4 sessions, 14 build items, 0 violations, 0 adapter rejections |
| real watcher | 12 builds × 2 flash-lite lines from the real scene in headless Chromium: 24/24 kept, 0 leaks |

Artifacts here: `generator-run.json`, `pinned-3-5.json`, `pinned-K-2.json`, `blend-3-5.json`, `intent-3-5.json`,
`journey-sweep.json`, `watcher-lines.json`. Probes: `scripts/habitat-build-probe.mjs`, `habitat-build-watch-probe.mjs`.

## Not verified

- No browser drive in the running app (tap feel, tray wrap, phone width, needs panel layout, emoji size on device).
- No Live run or text replay of the tutor on the build verdict; rides the family's next class Live gate.
- No contract doc existed; requirements were taken from the component, script and tests.

## Rulings owed

1. β 6.6 is high for K-3 content on this primitive's scale.
2. Pinned build makes no model call and uses a neutral "Habitat Builder" header (same question as R8).
3. Animal facts are simplified (penguin vs warm sun is true for emperors, not Galápagos); `contested` lists are
   judgment calls. Wants a science review.
4. In an intent-routed blend, build items sit under a generated header with its own climate text (R4/R7).
5. `needs_list` names the categories after a miss; knowing them is part of K-LS1. Acceptable as help?
