# Curriculum-Fit Sweep: math — 2026-06-07

**Domain → Subject:** math → MATHEMATICS
**Published grades probed:** Kindergarten, 1 (← no Grade 2 published yet)
**Primitives:** 61 · **MATCH:** 55 · **ABSTAIN:** 6

> Engine: `backend/scripts/curriculum_fit_sweep.py` (single in-process matcher; embedding cache reused across all 61 primitives). Raw: `_sweep-math.json`. analog-clock probed separately (multi-line description; sweep regex dropped it) — clean MATCH (K telling-time @0.826, G1 half-hour @0.823).

> **Supersedes the earlier 25/35 sweep.** That run predates the in-flight retrieval changes (`curriculum_mapping_service.py` + `curriculum_retrieval_service.py`: family/unit-level coherence + soft grade scoping). The same catalog now matches 55/61 vs 25/60. Spot-check: `length-lab` was "homeless 1/5" in the old run, now MATCH 5/5. The old report's headline fix ("grade-aware retrieval") is effectively shipped — grade is now a soft scope and each grade is scored on its own coherent set.

## ABSTAINs (the only "homeless" primitives)

| Primitive | Best | Reason | Top-1 (not a real home) | Diagnosis |
|-----------|------|--------|--------------------------|-----------|
| number-line | 0.814 | scattered | OPS001-04 Subtraction Strategies | **Thin/omnibus description** — cross-cutting representation, legitimately spans units. Not a gap. |
| spatial-scene | 0.766 | diffuse | COUNT001-04 Ordinal numbers | Thin description **or** weak K/1 spatial-reasoning coverage. Read top-5 to classify. |
| multiplication-explorer | 0.745 | scattered | OPS001-09 Properties of Operations | **Curriculum gap — G2/3.** No multiplication skill in K/1. The one clean grade-2 seed. |
| ratio-table | 0.742 | diffuse | MEAS001-06 Interpreting Data | **Curriculum gap — G6.** Parking-lot (middle school). |
| coordinate-graph | 0.728 | diffuse | PTRN001-04 Hundreds Chart | **Curriculum gap — G5.** Parking-lot. |
| slope-triangle | 0.712 | diffuse | MEAS001-06 Interpreting Data | **Curriculum gap — G8.** Parking-lot. |

## The finding that matters: grade-2 primitives MATCHED to K/1

The loop is *primitive-anchored* — it answers "has a home y/n". These grade-2-flavored primitives all returned a K/1 home, so the loop is **silent** on them, even though each has an obvious grade-2 extension that K/1 curriculum does not contain:

| Primitive | Matched | Grade-2 extension the loop can't see |
|-----------|---------|--------------------------------------|
| regrouping-workbench | K COUNT001-05 (compose/decompose 11–19) | two-/three-digit add-sub **with regrouping** |
| skip-counting-runner | G1 PTRN001-04 (hundreds-chart) | skip-count by **5 / 10 / 100** |
| place-value-chart | G1 NBT001-02 (tens & ones) | place value **to 1000** |
| base-ten-blocks | G1 NBT001-03 (tens as a unit) | **three-digit** numbers |
| coin-counter | G1 MEAS001-07 (coin ID) | **counting money / making change** |
| array-grid | K COUNT001-02 (count objects) | **arrays → multiplication** |
| analog-clock | K/G1 (hour, half-hour) | time to **nearest 5 min** |

**Conclusion:** Grade 2 is largely the *same primitives at higher number ranges / new eval modes*, not new components. "Adding a grade" feels insurmountable because of **missing curriculum**, not missing primitives — the primitives already exist and already fit K/1.

## Recommended path to Grade 2

1. **Author a thin `MATHEMATICS_G2` draft** (bounded, standards-driven): place value to 1000, two/three-digit add-sub w/ regrouping, skip-counting by 5/10/100, money, arrays→multiplication intro, time to 5 min, standard-unit measurement, bar graphs. Nearly every skill already has a primitive to point at.
2. **Run `/curriculum-lumina-audit audit MATHEMATICS_G2`** on the draft → surfaces genuine PURPLE (no-primitive) gaps. From this sweep, very few — `multiplication-explorer` fills one.
3. **Real build work = eval modes, not components.** `/add-eval-modes` to extend regrouping-workbench (2/3-digit), skip-counting-runner (by 5/10/100), place-value-chart (hundreds), coin-counter (make change), analog-clock (5-min). New number ranges = new eval modes on built primitives.
4. **Description fixes (separate from grade 2):** tighten `number-line` (omnibus); inspect `spatial-scene`.
5. **Parking-lot:** ratio-table (G6), coordinate-graph (G5), slope-triangle (G8) — homeless because those grades aren't authored; correct to leave until then.
