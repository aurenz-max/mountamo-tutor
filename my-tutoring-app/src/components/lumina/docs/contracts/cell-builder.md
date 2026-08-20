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
