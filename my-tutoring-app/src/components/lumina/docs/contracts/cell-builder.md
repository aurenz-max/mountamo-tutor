# Cell Builder Contract

**Primitive:** `cell-builder`  
**Grades:** 4-8  
**Derived:** 2026-08-18 from component, generator, catalog, metrics, and QA records

## Student-facing requirements

1. The primitive must represent animal, plant, prokaryotic, and fungal cells and preserve grade-band vocabulary/content limits.
2. A valid organelle record must support every cell-builder task identity: membership, one best-fit model region, one function match, and relative-abundance reasoning.
3. No palette card, default label, analogy, prompt, or visible explanation may map an organelle to its answer before the learner commits.
4. Placement is a simplified relationship model, not a literal coordinate claim. Regions must be mutually exclusive in grading, and the UI must say that real organelles move in three dimensions.
5. `peripheral` and `scattered` are different claims: the first means an individual structure in the cytoplasm away from the core; the second means many copies distributed throughout.
6. Checking locks the first committed answer. Corrective reveals may teach the answer but must not rewrite the evidence submitted for that attempt.
7. Pinned eval modes render only their task identity. Curated blends render their selected missions in canonical order. Unpinned/legacy data renders all missions.
8. Evaluation accuracy is the mean of the active missions only; an inactive task must never silently contribute a zero.
9. Stock the cell shows its cards in an order that does not follow the key (alphabetical; the generator lists the needed structures first). No analogy or lever line on that board names a kind of cell, and the membrane and wall lines are hidden on it (they say what the cell has). Probe: `CellBuilder.workspace.test.tsx`.
10. Build the model leaves off a structure whose name shares a word with its own region's label ("Cytoplasm" into "Cytoplasm"); the large-central region reads "Main storage", not "Central storage" ("Large Central Vacuole"). Placement accuracy is scored over that board. Probe: same file.
11. Wire the jobs: no job card shows a word built on a structure's name (`jobCardText`).
12. On the teaching workspace a wrong board shows only the count right, never per-card marks or reveals; Try again keeps the work; the report scores each mission's first committed board (requirement 6, re-based: the session's first-response gate replaces the scripted lock). Levers (`cellBuilderLevers.ts`) carry their leak rules in code: a job line names no kind of cell (Stock) or region (Build); a hint shares no five-letter word with its own job card; the smaller board (simplify) keeps the mission and, on Stock, at least one structure that does not belong.

## Eval-mode identities

| Mode | Student act | Prior beta |
|------|-------------|------------|
| `cell_inventory` | Keep or reject structures for a target cell | 2.5 |
| `organelle_placement` | Assign structures to best-fit relationship regions | 3.5 |
| `structure_function` | Connect structures to scientific jobs | 5.0 |
| `cell_specialization` | Tune relative abundance from the cell mission | 6.5 |

## Generator invariants

- One `functionMatch` per valid organelle; IDs must resolve to valid organelles.
- Distractors have `belongsInCell: false` and a corrective explanation.
- Valid organelles have non-null `correctZone`, `expectedQuantity`, and causal `quantityReasoning`.
- Function-match wording must not copy the organelle name or the brief `function` wording as a giveaway.
- The frontend catalog and backend calibration registry use identical mode keys and beta priors.

## Compatibility ruling

The 2026-08-18 redesign is **compatible by eval-mode fork**. It preserves all former capabilities (sort, place, quantity, function match) but makes them independently routable. Legacy payloads without `challengeType(s)` receive the complete four-mission path. The former free-coordinate score is intentionally retired because overlapping rectangles produced non-discriminating IRT evidence; the replacement strengthens the existing spatial-reasoning requirement without removing a valid consumer capability.

## Verification

- Lumina typecheck: 0 errors.
- Focused generator/component suites: 10/10 passing.
- Real `/api/lumina/eval-test` draw is currently blocked before registry load by the unrelated missing `service/literacy/gemini-word-flip` module.

## History

- 2026-10-18: boss framework — `cellBuilder.card.ts` + `cellBuilder.boss.ts` (bespoke: board); levers as one `CELL_LEVERS` set (byte-identical to the old `cellLevers`/`leverFact` on all four saved payloads); workspace-only (`withWorkspaceOnly`: the scripted Next/Run cell report path is deleted, an unbound mount shows NeedsTutor); the board rules left `special` for the shared `FLOW.board` sentence, which changes the tutor's guidance (one replay sample owed).
- 2026-10-15: W1 workspace binding and levers (ROLLOUT C24, `/add-live-tutor-tools`, `/add-support-tiers`). Requirements 9-12 added; requirement 6 re-based for the workspace path (Try again exists there; the first committed board is still the scored evidence). Compatible: the scripted path keeps its lock, reveals, Next mission and Run cell report.
