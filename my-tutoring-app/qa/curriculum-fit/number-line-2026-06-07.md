# Curriculum-Fit: number-line — 2026-06-07

**Domain → Subject:** math → MATHEMATICS
**Query (embedded):** "Interactive number line with drag-to-plot, animated jump arcs, ordering, and zoom. Supports integers, fractions, decimals…"
**Triggered by:** live `/api/problems/submit` (eval_mode=`plot`, score 10.0) — production logged `best grade=1 best=0.837 (tau=0.6), coherent=1/5 (min=3) — diffuse, no curriculum home`. This probe reproduces that verdict (0.814 verbatim-description vs 0.837 live, because the live `_build_retrieval_query` also appends topic + objective + `Skill focus: plot`). Same verdict either way.

## Results

| Grade | Verdict | Best cosine | Coherence | Top-1 (not a real single home) |
|-------|---------|-------------|-----------|--------------------------------|
| 1 | ABSTAIN (diffuse) | 0.814 | 1/5 | OPS001-04 "Subtract within 20… on a number line" |
| Kindergarten | ABSTAIN (diffuse) | 0.762 | 1/5 | OPS001-03 "add and subtract within 5" |

**Grade 1 top-5** (note: *every* one references a number line, across **four different skill families**):
- 0.814 `OPS001-04` Subtraction Strategies — count back on a number line
- 0.804 `OPS001-03` Addition Strategies — count on on a number line
- 0.769 `NBT001-07` Subtract Multiples of 10 — on a linear number scale
- 0.751 `NBT001-04` Compare Two-Digit Numbers — order on a line
- 0.744 `OPS001-01` Addition within 10 — ten-frame

## Diagnosis & Recommendation

**This abstain is CORRECT. No curriculum or catalog action.** number-line is none of the three standard miss-causes — it is a fourth pattern: a **cross-cutting representation primitive**.

- **Not a curriculum gap.** The home isn't missing — it's *everywhere*. Best cosine is 0.74–0.85; literally every top-5 subskill embeds "on a number line." The curriculum uses the number line as a *medium* across the whole number-sense strand (OPS addition, OPS subtraction, NBT place-value/compare, COUNT counting). That breadth is exactly what makes it diffuse.
- **Not a thin description.** The omnibus catalog description is rich. I re-probed with *tightened, mode-scoped* queries and it still abstains:
  - PLOT-scoped ("place a number at its position") → best 0.712, coherent 1/5.
  - JUMP-scoped ("add/subtract as movement, count on / count back") → **best 0.850 on `OPS001-03`, 0.817 on `OPS001-04`**, coherent 1/5.
- **Not a scoping/data issue.** 111 published candidates @ G1, 166 @ K — all present.

### Why even a perfect query abstains (the precise mechanism)
The JUMP probe finds two *genuinely correct* homes — `OPS001-03` (add by counting on, 0.85) and `OPS001-04` (subtract by counting back, 0.817). But the curriculum models add and subtract as **separate skill_ids**, and the coherence test requires ≥3 of the top-5 to share the **exact same skill_id**. A number-line "jump" attempt legitimately spans both → coherence reads 1/5 → abstain. The home isn't absent; it's *split across sibling skills*. Force-attributing a generic plot/jump attempt to any single one (e.g. "Subtraction Strategies") would be the exact misattribution this system exists to prevent (see `QA_curriculum_mapping_misattribution.md`). The pedagogically-safe abstain → fallback IDs is working as designed.

### Actual product cost (worth surfacing, not a bug in this skill)
Because it abstained, the submission accrued mastery to the synthetic fallback node **`general / math-number-line / number-line-operations`** (the competency log confirms `Subject: general`). That subskill is an **orphan** — disconnected from the real `OPS001` / `COUNT001` / `NBT001` graph, so this "mastered" signal never feeds adaptive routing through the real number-sense strand.

### Recommendations (report-only — owners noted)
1. **Mark number-line as an expected-abstain cross-cutting primitive** so future sweeps don't re-flag it as a gap. (Same class as `ordinal-line`-style edge cases, but intra-subject rather than cross-domain.)
2. **If we want number-line mastery to land on real skills** (the interesting lever): the fix is *not* curriculum authoring — it's two coordinated changes, both in `backend/app/services/curriculum_retrieval_service.py` / `curriculum_mapping_service.py`, per Key Rule #4 (change the abstain logic there, never in the skill):
   - **Per-eval-mode retrieval:** embed the *mode-scoped* description (+ the live challenge) rather than the omnibus catalog description. The JUMP probe (0.85 on `OPS001-03`) proves the home is findable when the query is scoped to the mode actually exercised.
   - **Skill-cluster coherence:** relax the coherence test from exact-`skill_id` match to a shared **skill-family prefix** (e.g. all `OPS001-*`), so a primitive whose natural home is a cluster (add **and** subtract on a number line) can MATCH instead of abstaining on the add/subtract split.
   - Do these together: mode-scoping alone still abstains under exact-skill_id coherence; cluster-coherence alone still drowns under the omnibus query.
3. **Out of scope but noted:** the repeated `POST /api/evaluations/submit-batch → 404` in the logs is the dead evaluations batch route, unrelated to curriculum-fit.

**Bottom line:** number-line has a curriculum home in spirit (the number line saturates the K-1 number-sense strand) but no *single* home the live retrieval can honestly name. The abstain is the correct, safe outcome today. Closing the orphan-mastery gap is a retrieval-engine enhancement (per-mode query + cluster coherence), not a curriculum or catalog edit.
