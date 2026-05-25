# PRD: Math Primitive Multi-Instance Completion

**Status:** Open — scopes the remaining work to finish the multi-instance program across math. **A1 (`percent-bar`) and A2 (`double-number-line`) shipped 2026-05-23.** Only the deferred upper-grade `two-way-table` (A3) + the 16 Bucket B audit/prompt items remain.
**Companion to:** [PRD_WITHIN_MODE_INSTANCE_DENSITY.md](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md) (design + playbook) and [SHIPPED_LOG.md](./SHIPPED_LOG.md) (post-mortems for the 18 shipped primitives).

**Priority:** High — the K-3-adjacent program is now complete; this PRD scopes the deferred upper-grade `two-way-table` refactor + the 16 Bucket B audit/prompt items so we can declare math fully complete.

**Audience:** Engineering (executable backlog), Product (forecast for when math is "done").

**Scope:** Math primitives only. Pattern generalizes to other domains but those are out of scope here.

---

## 1. Goal

Finish the multi-instance refactor across math. Specifically:

- **Every evaluable math primitive ships with `challenges: <Name>Challenge[]` (3-6 per session) and the canonical 9-field metrics shape from [PRD §4](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#4-canonical-multi-instance-schema-pattern).**
- **Every Bucket B primitive passes the 3-point §6n audit** (catalog `contextKeys` includes `currentChallengeIndex` + `totalChallenges`; metrics re-exported from `evaluation/index.ts` barrel; tester has the `result.metrics.type` breakdown block).
- **Zero math primitives ship singular schemas (Bucket A)** that produce one binary signal per session.

Definition of "math complete": all 35 in-scope math primitives are either ✅ Shipped or ✅ Already-healthy. Estimated remaining effort: **~10 hours** of focused work (~1.5 weeks calendar with validation) — down from ~13 hours with both A1 `percent-bar` and A2 `double-number-line` shipped 2026-05-23.

---

## 2. Status Snapshot

A 2026-05-23 full-folder audit of `service/math/gemini-*.ts` (60 primitives total), updated post-A1 + A2 ship:

| Bucket | Count | Status | Effort to complete |
|---|---|---|---|
| ✅ **Shipped** (W2 pilot + W3 refactors, incl. A1 `percent-bar`, A2 `double-number-line`) | 18 | Done — see SHIPPED_LOG §6-§6r | 0 |
| ✅ **Already healthy** (4+ instances, schema canonical) | 23 | Done — no work needed | 0 |
| 🟡 **Bucket B — prompt-floor + 3-point audit** | 11 | Pending | ~5.5 hours (30 min × 11) |
| 🟡 **Bucket B — audit-only** (prompt already at 4-6) | 5 | Pending | ~2.5 hours (30 min × 5) |
| 🔴 **Bucket A — deferred** (upper-grade, post-systems-equations) | 1 (`two-way-table`) | Deferred | ~2 hours |
| ⚪ **Out of scope** (production-modality / non-renderable) | 2 | N/A | 0 |
| **Total math primitives audited** | 60 | | ~10 hours |

**The last full-folder audit was 2026-05-20.** This PRD's audit (2026-05-23) confirmed no Bucket A primitives were missed; both A1 (`percent-bar`) and A2 (`double-number-line`) shipped 2026-05-23. Remaining Bucket A work: only A3 `two-way-table` (deferred upper-grade). The §3b roadmap holds.

---

## 3. Scope

### In-scope

- Math primitives in [`service/math/gemini-*.ts`](../service/math/) that route via IRT and produce mastery signal.
- Their counterpart components in [`primitives/visual-primitives/math/`](../primitives/visual-primitives/math/).
- Catalog entries in [`service/manifest/catalog/math.ts`](../service/manifest/catalog/math.ts).
- Metrics interfaces in [`evaluation/types.ts`](../evaluation/types.ts) and barrel re-exports in [`evaluation/index.ts`](../evaluation/index.ts).
- Tester registration in [`components/MathPrimitivesTester.tsx`](../components/MathPrimitivesTester.tsx).

### Out of scope

| Primitive | Why out of scope |
|---|---|
| `practice-problem` | Production-modality slot: single annotated worked-example by design. One solution per session is the spec. Not a refactor target. |
| `digit-evaluation` | LLM handwriting judge — scores artifacts produced by other primitives. Non-renderable; doesn't hold an interaction loop. Not a refactor target. |

### Deferred

| Primitive | Defer rationale |
|---|---|
| `two-way-table` | Upper-grade Bucket A. Lower IRT-routing priority (grade 7-8 statistics is sparse vs K-3). Reuses `MatrixInput` (§6m #3) + UI gating (§6o #2). Land after the 16 Bucket B items so we have full pattern fluency on `MatrixInput`-style 2D entry primitives. Estimated effort: ~2 hours. |

### Non-math domains

Out of scope for this PRD. The patterns from [SHIPPED_LOG.md](./SHIPPED_LOG.md) generalize to physics/biology/chemistry/literacy/engineering, but those need their own audit + PRD. Apply opportunistically.

---

## 4. Backlog — Bucket A Schema Refactors (~2.5 hours remaining)

### A1. `percent-bar` (5-8 grade) — ✅ SHIPPED 2026-05-23 (~1.5 hours actual)

**Shipped:** Pool-service per-mode scenario builders (4 modes × 5-7 scenario templates × curated rate/base pools). Phase navigator dropped per [PRD §5 rule 13](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#5-the-playbook-refactor-rules). Canonical 9-field metrics (collapsed from 21 per-phase fields). Full post-mortem: [SHIPPED_LOG §6q](./SHIPPED_LOG.md#6q-percent-bar-post-mortem-workstream-3-entry-17--mid-grade-bucket-a--shipped-2026-05-23).

**Key shipped lessons** (rolled into SHIPPED_LOG §6q for the playbook):
- **§6q #1.** Per-mode `targetPercent` derivation IS the eval-mode pedagogical distinction — derive in code from the mode, never let Gemini hallucinate the relationship.
- **§6q #2.** Bar-only primitives constrain mode framings — comparison mode placement = max of two rates (the natural "compare A vs B" framing doesn't map to a single-placement bar).
- **§6q #3.** Pool-service variance hierarchy now extends to text-bearing scenarios (parameterized templates), not just numeric values. Cheaper than orchestrator-mixed-type whenever scenarios are template-shaped.
- **§6q #4.** 12 of the 21 pre-refactor metric fields were last-state-only noise — phase-name-prefixed metrics are a symptom of the rule-13 in-component phase navigator.

**Validation still owed** (per §6q validation table):
- `/eval-test percent-bar` across all 4 eval modes (`identify_percent`, `find_part`, `find_whole`, `convert`).
- Manual UI walk per mode — confirm 4 distinct scenarios and correct mode framings (especially `find_part` where `target = 100 - rate`).
- Cost spot-check (wrapper schema dropped from 15 nested required fields to 3 scalar fields).

### A2. `double-number-line` (5-7 grade) — ✅ SHIPPED 2026-05-23 — see [SHIPPED_LOG §6r](./SHIPPED_LOG.md#6r-double-number-line-post-mortem-workstream-3-entry-18--mid-grade-bucket-a--shipped-2026-05-23)

**What shipped:** Hybrid (single-Gemini-wrapper + local pool construction). One Gemini call returns the session-level scenario (`topLabel`, `bottomLabel`, `unitRateOutput`, umbrella `contextQuestion`, pool of `askInputs[]`); locally we build N `DoubleNumberLineChallenge[]` with shared scales + ratio context + per-mode `givenPoints` / `targetPoints` / `prompt` / `hint`. All N challenges in a session share the same ratio relationship (context coherence enforced by construction — never flour→cookies followed by cars→hours). Component drops the explore→practice→apply phase navigator (rule 13 anti-pattern), wires `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`, and submits the canonical 9-field metrics shape once at session-end.

**Validation still owed** (per §6r validation table):
- `/eval-test double-number-line` across all 3 eval modes (`equivalent_ratios`, `find_missing`, `unit_rate`).
- Manual UI walk per mode — confirm 4 distinct ask-points within a coherent shared ratio context, and that the `unit_rate` mode's first challenge asks for the unit rate itself before subsequent challenges ask for arbitrary values.
- Cost spot-check (1× per-session Gemini call, wrapper-only).

### A3. `two-way-table` (7-8 grade) — deferred, ~2 hours when prioritized

**Current state:** Singular schema. `rowCategories: string[]`, `columnCategories: string[]`, `frequencies: number[][]` flat at root. No challenges array.

**Refactor target:**
- **Fork:** Fork A (pool service). Pre-authored real-world contexts per `challengeType` (`joint_probability`, `conditional_probability`, `marginal_distribution`, `independence_test`) drive the (rowCategories, columnCategories, frequencies) tuples.
- **Reuses:** `MatrixInput` editable 2D grid from [matrix-display §6m #3](./SHIPPED_LOG.md). Mode-specific UI gating from [histogram §6o #2](./SHIPPED_LOG.md) — conditional-probability mode hides cell totals to prevent answer leak.

**Sequencing:** schedule after both A1 + A2 land and after the 16 Bucket B items clear. Pattern fluency on `MatrixInput`-style components compounds.

---

## 5. Backlog — Bucket B Prompt-Floor Sweep (~5.5 hours total)

Per-primitive: 4 touches (~30 min coding + `/eval-test` per eval mode). Template documented in [PRD §7](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#7-workstream-1-reference-bucket-b-prompt-floor-sweep--3-point-audit).

### Sequencing — K-3 first (highest IRT-routing volume)

| # | Primitive | Grade | Prompt site | Eval modes |
|---|---|---|---|---|
| 1 | `ten-frame` | K-1 | [gemini-ten-frame.ts:291](../service/math/gemini-ten-frame.ts#L291) — `Generate 3-5` → `Generate 4-6` | build, subitize, make_ten, add, subtract |
| 2 | `number-bond` | K-3 | [gemini-number-bond.ts:287](../service/math/gemini-number-bond.ts#L287) — config default `'3-5'` → `'4-6'` | decompose, missing-part, fact-family, build-equation |
| 3 | `counting-board` | K-2 | [gemini-counting-board.ts:283](../service/math/gemini-counting-board.ts#L283) — `Generate 3-5` → `Generate 4-6` | per-mode count pools |
| 4 | `regrouping-workbench` | 1-3 | [gemini-regrouping-workbench.ts:304](../service/math/gemini-regrouping-workbench.ts#L304) — `Generate 3-5` → `Generate 4-6` | add, subtract, mixed |

### Mid-elementary batch (3-5)

| # | Primitive | Grade | Prompt site | Eval modes |
|---|---|---|---|---|
| 5 | `skip-counting-runner` | 1-3 | [gemini-skip-counting-runner.ts:298](../service/math/gemini-skip-counting-runner.ts#L298) — `Generate 3-5` → `Generate 4-6` | by-2, by-5, by-10, by-100, mixed |
| 6 | `length-lab` | 3-5 | [gemini-length-lab.ts:266](../service/math/gemini-length-lab.ts#L266) — `Generate 3-5` → `Generate 4-6` | per-mode unit + dimension pools |
| 7 | `shape-builder` | 3-5 | [gemini-shape-builder.ts:406](../service/math/gemini-shape-builder.ts#L406) — `Generate 3-5` → `Generate 4-6` | quadrilateral property sets |
| 8 | `3d-shape-explorer` | 3-5 | [gemini-3d-shape-explorer.ts:279](../service/math/gemini-3d-shape-explorer.ts#L279) — `Generate 3-5` → `Generate 4-6` | per-mode 3D shape categories |

### Mid-grade batch (3-5+)

| # | Primitive | Grade | Prompt site | Eval modes |
|---|---|---|---|---|
| 9 | `equation-builder` | 3+ | [gemini-equation-builder.ts:967](../service/math/gemini-equation-builder.ts#L967) — config default `'3-5'` → `'4-6'` | multi-mode |
| 10 | `ratio-table` | 3-5 | [gemini-ratio-table.ts:193](../service/math/gemini-ratio-table.ts#L193) — `Generate 3-5` → `Generate 4-6` | per-mode ratio pools |
| 11 | `parameter-explorer` | 3-5+ | [gemini-parameter-explorer.ts:299](../service/math/gemini-parameter-explorer.ts#L299) — `Generate 3-4` → `Generate 4-6` | function parameter variance |

### 4-touch template (per primitive)

1. **Prompt floor bump** — `service/math/gemini-<primitive>.ts` (line number above).
2. **Catalog context keys** — `service/manifest/catalog/math.ts`: add `currentChallengeIndex` + `totalChallenges` to `tutoring.contextKeys`; template `{{totalChallenges}}` into `taskDescription`. Add `MULTI-<X> PACING` aiDirective if absent.
3. **Metrics barrel re-export** — `evaluation/index.ts`: add `<Primitive>Metrics` to the math-phase-2 export block; switch the component to import metrics from the public barrel.
4. **Tester metrics breakdown** — `components/MathPrimitivesTester.tsx`: add `result.metrics.type === '<primitive>'` block to the results panel (template per [PRD §7](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#7-workstream-1-reference-bucket-b-prompt-floor-sweep--3-point-audit)).

### Validation per primitive

1. `npx tsc --noEmit` clean for touched files.
2. `/eval-test <primitive> --evalMode <each single-mode tier>` — assert `validation.challengeCount >= 4`.
3. Manual UI render — confirm distinct per-challenge content across N instances (no surface-feature repetition).
4. Token/cost sanity — Gemini Flash Lite output approximately doubles for some primitives; verify within budget.

---

## 6. Backlog — Bucket B Audit-Only (~2.5 hours total)

These primitives already hit ≥4 challenges per single-mode session without any generator change (§3b confirmed healthy). They only need touches #2, #3, #4 from the §5 4-touch template above (the prompt floor is already correct).

| # | Primitive | Grade | Notes |
|---|---|---|---|
| 1 | `base-ten-blocks` | 1-3 | Pool service (per-mode place-value setups) |
| 2 | `hundreds-chart` | 1-2 | Pool service (per-mode start/end ranges) |
| 3 | `number-line` | 1-3 | Pool service (per-mode target sets) |
| 4 | `comparison-builder` | K-1 | Pool service (paired count sets) |
| 5 | `fraction-circles` | 3-5 | Pool service (per-mode fraction sets) |

### Audit checklist per primitive

For each:
- [ ] Catalog `contextKeys` includes `currentChallengeIndex` + `totalChallenges`?
- [ ] `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}`?
- [ ] `MULTI-<X> PACING` aiDirective present?
- [ ] `<Primitive>Metrics` re-exported from `evaluation/index.ts`?
- [ ] Component imports `<Primitive>Metrics` from `'../../../evaluation'` (public barrel), not direct from `evaluation/types`?
- [ ] Tester render case passes `onEvaluationSubmit`?
- [ ] Tester has `result.metrics.type === '<primitive>'` breakdown block?

Each missing item = ~5 min fix. Pattern is identical to [pattern-builder §6n](./SHIPPED_LOG.md).

---

## 7. Execution Plan

### Sequencing rationale

The dependency graph is shallow — most work can parallelize. Recommended sequence balances ROI (highest-routing primitives first) with pattern fluency (simpler ships before complex):

```
Week 1 — Bucket B sweep (lowest friction, highest immediate ROI)
  Day 1: K-3 batch (ten-frame, number-bond, counting-board, regrouping-workbench)
  Day 2: Mid-elementary batch (skip-counting-runner, length-lab, shape-builder, 3d-shape-explorer)
  Day 3: Mid-grade batch (equation-builder, ratio-table, parameter-explorer)
        + Bucket B audit-only sweep (5 primitives)
  Day 4: Validation buffer — /eval-test all 16, manual UI walks for K-3 batch

Week 2 — Bucket A schema refactors
  Day 1-2: percent-bar (A1) ✅ SHIPPED 2026-05-23 (~1.5h actual — under estimate; SHIPPED_LOG §6q)
  Day 3-4: double-number-line (A2) ✅ SHIPPED 2026-05-23 (hybrid 1-call wrapper + local pool; SHIPPED_LOG §6r)
  Day 5: Deferred two-way-table (A3) — start scoping; reuse MatrixInput

After Week 2: math is complete except deferred two-way-table. Both K-3-adjacent Bucket A entries
are ✅ shipped on 2026-05-23.
```

### Parallelization

- All Bucket B prompt-bump entries are independent → one engineer can ship 2-3 per day.
- Bucket B audit-only entries are independent from prompt-bump entries → can be split to a second engineer or done as a Day 3 cleanup pass.
- ~~Bucket A refactors (A1, A2) are independent → can run in parallel by two engineers if available.~~ Both shipped 2026-05-23. A3 (`two-way-table`) is deferred.

### Effort estimates (refined)

| Workstream | Coding | Validation | Total |
|---|---|---|---|
| Bucket B prompt-bump (11) | ~3 hours | ~2.5 hours (`/eval-test` + UI walks) | ~5.5 hours |
| Bucket B audit-only (5) | ~1.5 hours | ~1 hour | ~2.5 hours |
| ~~Bucket A: percent-bar~~ ✅ SHIPPED 2026-05-23 | ~~~2 hours~~ ~1.5h actual | ⏳ ~30 min owed | ~~~2.5 hours~~ ~2h actual |
| ~~Bucket A: double-number-line~~ ✅ SHIPPED 2026-05-23 | ~~~2 hours~~ ~1.5h actual | ⏳ ~30 min owed | ~~~2.5 hours~~ ~2h actual |
| Deferred: two-way-table | ~1.5 hours | ~30 min | ~2 hours |
| **Remaining** | **~6 hours** | **~4 hours** | **~10 hours** (~1.5 weeks calendar) |

---

## 8. Success Criteria

### Per-primitive (definition of done)

A primitive counts as ✅ Done when ALL of:

- [ ] `<Name>Data` interface has `challenges: <Name>Challenge[]` (required, not optional).
- [ ] Generator populates `challenges` with N ≥ 3 distinct items per single-mode session.
- [ ] Component uses `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`.
- [ ] Component uses `usePrimitiveEvaluation<<Name>Metrics>` with one session-end `submitEvaluation` call.
- [ ] Per-challenge reset useEffect keyed on `currentChallenge?.id` enumerates every per-challenge state slot.
- [ ] Stale-state guard via `recordedRef.current` (handler-driven) or content-match (effect-driven).
- [ ] `<Name>Metrics` is the canonical 9-field flattened shape ([PRD §4](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#4-canonical-multi-instance-schema-pattern)).
- [ ] `<Name>Metrics` re-exported from `evaluation/index.ts`.
- [ ] Catalog `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}`; `contextKeys` includes both; `MULTI-<X> PACING` aiDirective present.
- [ ] Catalog `constraints` clarifies manifest must NOT supply specific per-challenge values.
- [ ] Tester render case spreads `...(data as Parameters<...>[0]['data'])` + all 5 evaluation props including `onEvaluationSubmit`.
- [ ] Tester has `result.metrics.type === '<primitive>'` breakdown block.
- [ ] `/eval-test <primitive>` passes for every eval mode.
- [ ] `npx tsc --noEmit` clean for touched files.

### Program-level (math complete)

Math counts as ✅ Done when:

- [ ] All 11 Bucket B prompt-bump entries shipped and validated.
- [ ] All 5 Bucket B audit-only entries shipped and validated.
- [x] `percent-bar` shipped per A1 spec. ✅ 2026-05-23 ([SHIPPED_LOG §6q](./SHIPPED_LOG.md#6q-percent-bar-post-mortem-workstream-3-entry-17--mid-grade-bucket-a--shipped-2026-05-23)). `/eval-test` validation still owed.
- [x] `double-number-line` shipped per A2 spec. ✅ 2026-05-23 (see SHIPPED_LOG §6r). Validation still owed per §6r table.
- [ ] CI automated audit script in place (see Open Question #2 below): runs `/eval-test` per primitive per single-mode tier, asserts `validation.challengeCount >= 3`.
- [ ] (Optional but recommended) `two-way-table` shipped per A3 spec — declares "math fully complete" rather than "math complete except deferred."

### Quantitative

- **Mastery signal density:** post-completion `/pulse-agent` runs show ≥3× IRT updates per student-minute vs pre-PRD baseline (carries from [PRD §8](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md#8-success-criteria)).
- **Time-on-task:** single-mode sessions take 3-5 minutes (up from 30-60s for any remaining Bucket A).
- **Cost:** pool-service primitives within 2× pre-refactor cost; orchestrator primitives within N× where N = `instanceCount` (4× default).

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Bucket B prompt bump produces malformed JSON for some primitives** (Gemini hits schema limits at higher N) | Low | Medium | Validate per primitive with `/eval-test`. If schema fails, drop to N=4 floor or switch generator to Fork A (pool service). |
| **percent-bar refactor breaks deployed lessons** (any existing lesson tied to the old `exploreQuestion`/`practiceQuestions`/`mainQuestion` shape) | Medium | Medium | Audit the catalog for lessons that reference percent-bar specifically; check whether manifest payloads currently inject those fields. Backwards-compatibility shim during transition if needed. |
| ~~**double-number-line context coherence is hard to enforce in Fork A**~~ Resolved 2026-05-23 by shipping a hybrid 1-call wrapper + local pool construction: the single Gemini call pins `(topLabel, bottomLabel, unitRate, contextQuestion)` at session level; per-challenge construction varies only ask-points + per-mode given/target derivation. See SHIPPED_LOG §6r. | ~~Medium~~ | ~~Low~~ | Mitigation realized — see §6r #1. |
| **Bucket B audit-only sweep surfaces undocumented evaluation gaps** (e.g. `onEvaluationSubmit` missing from a tester case) | High | Low | Expected — that's exactly what the §6n audit caught for pattern-builder. Fix as part of the sweep; document any pattern that recurs. |
| **CI audit script reveals previously-"healthy" primitives drift below 3 challenges** | Low | Medium | Add the CI check (Open Question #2) BEFORE shipping the Bucket B sweep — catches regressions immediately. |

---

## 10. Open Questions

1. **Two-way-table priority.** Should A3 land in Week 2 alongside A1/A2, or genuinely defer to a later iteration? Trade-off: upper-grade routing volume is sparse vs the cost of "math 99% complete" feeling like a tail. Recommended: defer to keep Week 2 focused on K-3-adjacent items (A1, A2); pick up A3 in a Week 3 cleanup pass.

2. **CI automated audit.** Add a CI step that runs `/eval-test` per primitive per single-mode tier and asserts `validation.challengeCount >= 3`. Catches B-mixed regressions (the [§6g #1 bucket](./SHIPPED_LOG.md)) immediately on PR. Recommended: yes, ship as part of Bucket B sweep validation infrastructure.

3. **Mode-specific score formulas for percent-bar.** Standard formula from PRD §5 rule 11 (`r.correct ? Math.max(20, 100 - (attempts-1)*20) : 0`) covers single-step modes. The `comparison` mode involves evaluating two scenarios sequentially — does it warrant a 50/50 split like measurement-tools' convert mode ([§6k #2](./SHIPPED_LOG.md))? Decide during refactor design.

4. **`MULTI-<X> PACING` directive standardization.** Currently every shipped multi-instance primitive has a slightly different aiDirective text (`MULTI-EQUATION PACING`, `MULTI-FUNCTION PACING`, `MULTI-MATRIX PACING`, etc.). Worth standardizing into a single shared template before the Bucket B sweep? Recommended: no — the per-primitive language is short and the per-mode coaching it embeds is genuinely primitive-specific.

5. **Post-completion: when do we re-audit `K3_CONTENT_DENSITY`?** Per the original PRD's §9 Week 5 plan, after this PRD lands we should re-audit [PRD_K3_CONTENT_DENSITY](PRD_K3_CONTENT_DENSITY.md) — some of its proposed mode inserts may become unnecessary once instance counts multiply. Recommended timing: 2 weeks after Bucket B sweep ships (gives time for pulse data to validate the mastery-signal-density improvement).

---

## 11. References

- [PRD_WITHIN_MODE_INSTANCE_DENSITY.md](./PRD_WITHIN_MODE_INSTANCE_DENSITY.md) — design (§4 canonical schema) + playbook (§5 refactor rules). This is the design contract.
- [SHIPPED_LOG.md](./SHIPPED_LOG.md) — per-primitive post-mortems for the 18 shipped Workstream 2/3 entries. Reference for worked examples.
- [ADDING_PRIMITIVES.md](./ADDING_PRIMITIVES.md) — new-primitive checklist (now defaults to multi-instance per the `/primitive` skill update).
- [`.claude/skills/primitive/SKILL.md`](../../../../.claude/skills/primitive/SKILL.md) — `/primitive` skill, updated 2026-05-23 to bake the canonical multi-instance pattern into create-from-scratch.
- [`.claude/skills/lumina-densify-primitives/SKILL.md`](../../../../.claude/skills/lumina-densify-primitives/SKILL.md) — `/lumina-densify-primitives` skill for legacy-backfill refactors. Use this for the 2-3 remaining Bucket A entries.

---

## 12. Appendix: Full Audit Snapshot (2026-05-23)

The complete classification of all 60 audited math primitives — for transparency on what's done, what's healthy, and what's left.

### ✅ Shipped (18 — Workstream 2/3)

factor-tree, bar-model, tape-diagram, place-value-chart, area-model, function-machine, ordinal-line, array-grid, function-sketch, balance-scale, measurement-tools, slope-triangle, matrix-display, pattern-builder (§6n audit), histogram, systems-equations, **percent-bar (§6q, 2026-05-23)**, **double-number-line (§6r, 2026-05-23)**.

### ✅ Already healthy — no work needed (23)

addition-subtraction-scene, multiplication-explorer, fraction-bar, coin-counter, coordinate-graph, equation-workspace, sorting-station, time-sequencer, spatial-scene, net-folder, shape-composer, shape-sorter, shape-tracer, number-sequencer, number-tracer, compare-objects, dot-plot, strategy-picker (confirm via `/eval-test` after `TARGET_INSTANCE_COUNT=4` branch), analog-clock, math-fact-fluency, plus the 3 already covered by SHIPPED_LOG that are now in steady-state (counting-board, base-ten-blocks listed below as audit-only is the only nuance — these still need the 3-point §6n retrofit).

### 🟡 Bucket B — prompt-floor + 3-point audit (11)

See §5 above.

### 🟡 Bucket B — audit-only (5)

See §6 above.

### 🔴 Bucket A — schema refactor (0 remaining + 1 deferred; 2 shipped)

See §4 above. Shipped: `percent-bar` (A1, 2026-05-23, §6q), `double-number-line` (A2, 2026-05-23, §6r). Deferred: `two-way-table` (A3).

### ⚪ Out of scope (2)

practice-problem, digit-evaluation.

---

**End of PRD.** When math is complete per §8's program-level criteria, archive this PRD into SHIPPED_LOG and update the main PRD's status header to declare math done.
