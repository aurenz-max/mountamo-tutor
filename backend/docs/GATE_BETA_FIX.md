# Gate 4 Beta Mismatch — Diagnosis & Fix Plan

**Date:** 2026-04-02
**Context:** Pulse agent gifted profile (K Mathematics, 50 sessions) reaches only 65% mastery despite scoring 9+ on every item. Skills get stuck at G3 indefinitely.

---

## The Problem

The gate check uses the β of the mode Fisher-info selected, not the β the curriculum actually assigned to that subskill.

The flow today:

1. `select_best_mode()` picks the mode with max Fisher info (θ ≈ β, so P ≈ 0.5–0.7)
2. Student answers, CalibrationEngine returns `calibrated_beta` for that hard mode
3. `derive_gate_from_irt()` checks `P(correct) ≥ 0.90` at that same hard β → **fails**

Fisher-info item selection and gate advancement are working at cross purposes. The engine always tests at the difficulty where it learns the most about the student, but that's exactly the difficulty where the student can't demonstrate 90% mastery.

### Evidence (Session 50, Gifted Grace, MATHEMATICS_GK)

| Subskill | Primitive | Curriculum Modes (β) | θ | Hardest Assigned β | P at Hardest | Engine Tested β | P at Tested |
|---|---|---|---|---|---|---|---|
| COUNT001-03-G | comparison-builder | compare_numbers (3.5), order (5.0) | 5.58 | 5.0 | **0.69** | 5.0 | 0.69 |
| GEOM001-02-G | pattern-builder | extend (1.5), create (5.0) | 6.29 | 5.0 | **0.86** | 5.0 | 0.86 |
| MEAS001-06-E | knowledge-check | apply (3.0), analyze (4.5) | 5.04 | 4.5 | **0.68** | 4.5 | 0.68 |
| PTRN001-01-E | pattern-builder | find_rule (6.5) | 6.31 | 6.5 | **0.43** | 6.5 | 0.43 |
| MEAS001-07-F | ordinal-line | build_sequence (6.5), sequence_story (5.0) | 6.46 | 6.5 | **0.49** | 6.5 | 0.49 |

None hit 0.90, so G4 never fires — even though the student aces every attempt.

---

## What's Working (No Changes Needed)

- All 166 MATHEMATICS_GK subskills have `target_primitive` and `target_eval_modes` in the published curriculum
- Graph nodes carry both fields through to the pulse engine (`node.get("primitive_type")`, `node.get("eval_modes")`)
- 165/166 primitives are in `PROBLEM_TYPE_REGISTRY` (only `number-tracer` missing, 1 subskill)
- `select_best_mode()` already accepts and filters by `allowed_modes` — **item selection is correct**
- Credibility blending with empirical pass rate works but is too slow to compensate (needs many observations)

---

## The Fix

**Item selection: no change.** Keep using Fisher info to pick the most informative mode for measurement.

**Gate 4 check: use the hardest curriculum-assigned β**, not the tested item's calibrated β. The question the gate should answer is: "Can this student demonstrate ≥90% predicted success at the hardest thing this subskill's curriculum asks them to do?" — not "at the hardest thing this primitive is capable of."

---

## Implementation Steps

### 1. Compute `max_curriculum_beta` in the pulse engine

The pulse engine already has `prim_type` and `allowed_modes` from the graph node (lines 435–437). After selecting the best mode for testing, also compute the max β across curriculum-assigned modes:

```python
# Already exists:
prim_type = node.get("primitive_type", "ten-frame")
allowed_modes = node.get("eval_modes")
_, beta, eval_mode_name = self.select_best_mode(theta, prim_type, allowed_modes)

# New: compute max curriculum beta for gate checks
max_curriculum_beta = _max_beta_for_modes(prim_type, allowed_modes)
```

Helper function (in pulse_engine.py or calibration utils):

```python
def _max_beta_for_modes(primitive_type: str, allowed_modes: list[str] | None) -> float | None:
    """Return the highest prior β across the curriculum-assigned eval modes."""
    modes = PROBLEM_TYPE_REGISTRY.get(primitive_type)
    if not modes or not allowed_modes:
        return None
    betas = [modes[m].prior_beta for m in allowed_modes if m in modes]
    return max(betas) if betas else None
```

### 2. Thread `max_curriculum_beta` to the mastery engine

Pass it through `process_eval_result()` → `_handle_unified_eval()` → `derive_gate_from_irt()`. Add a new parameter rather than overloading `item_beta`:

```python
# In _handle_unified_eval / process_eval_result:
mastery_result = await self.mastery.process_eval_result(
    ...
    item_beta=cal_result.get("calibrated_beta"),      # for gates 1-3 (as today)
    gate_reference_beta=max_curriculum_beta,            # NEW: for gate 4 check
    ...
)
```

### 3. Update `derive_gate_from_irt()`

Add an optional `gate_reference_beta` parameter. When checking G4, use it instead of `item_beta`:

```python
def derive_gate_from_irt(
    theta: float,
    sigma: float,
    item_beta: float,
    avg_a: float = 1.4,
    empirical_p: Optional[float] = None,
    n_observations: int = 0,
    gate_reference_beta: Optional[float] = None,   # NEW
) -> tuple[int, str, float]:
    # For G4: check P at the hardest curriculum-assigned mode
    # For G1-G3: continue using item_beta (the tested mode)
    for gate in (4, 3, 2, 1):
        check_beta = gate_reference_beta if (gate == 4 and gate_reference_beta is not None) else item_beta
        p_irt = p_correct(theta, avg_a, check_beta)
        # ... credibility blend, threshold check as before
```

### 4. Handle the non-Pulse path

`process_eval_result` is also called from `CompetencyService` outside Pulse. Those callers need to either:
- Pass `primitive_type` + `eval_modes` so the mastery engine can compute `max_curriculum_beta` itself, or
- Accept that gate 4 checks fall back to `item_beta` when curriculum context is unavailable (graceful degradation)

### 5. Clean up dead code

- `_check_probability_gate()` (line 540) implements per-gate reference β using `GATE_REF_FRACTIONS` but is **never called**. Either revive its logic into the new flow or delete it.
- `GATE_REF_FRACTIONS` in `mastery_lifecycle.py` are defined but unused. After the fix, decide whether gates 1–3 should also use curriculum-scoped reference betas, or remove the constants.
- The lesson-eval path (`_handle_lesson_eval`, line 349) has a parameter mismatch: `derive_gate_from_irt(theta, sigma, min_beta, max_beta, avg_a)` passes `min_beta` as `item_beta` and `max_beta` as `avg_a`. Fix or remove since lesson evals only handle `not_started → active`.

### 6. Re-run pulse agent to validate

```bash
cd backend
python -m tests.pulse_agent.run_scenarios --profile gifted --subject Mathematics --grade K --in-memory --sessions 50 --seed 42 --output ./reports
```

Expected changes:
- G4 mastery should reach ~90%+ in 50 sessions (up from 65%)
- Frontier exploration should increase (skills reach G4 faster → engine moves on)
- Science should still exhaust its 88-node graph quickly

---

## Key Files

| File | What to change |
|------|----------------|
| `backend/app/services/pulse_engine.py` | Compute `max_curriculum_beta` at lines 435–437, 504–506, 529–537; pass to mastery engine at line 969 |
| `backend/app/services/mastery_lifecycle_engine.py` | Update `derive_gate_from_irt()` (line 106) to accept `gate_reference_beta`; update `_handle_unified_eval()` (line 459) to pass it; fix lesson-eval param mismatch (line 349); decide fate of `_check_probability_gate()` (line 540) |
| `backend/app/models/mastery_lifecycle.py` | Decide fate of `GATE_REF_FRACTIONS` (line 215) |
| `backend/app/services/calibration/problem_type_registry.py` | Source of per-mode β values (read-only, no changes) |
| `backend/tests/pulse_agent/` | Re-run validation after fix |

---

## Open Questions

1. **Should gates 1–3 also use curriculum-scoped reference betas?** Currently they check against `item_beta` (the tested mode). This works fine because lower gates have lower P thresholds (0.70–0.80) that are easier to hit. But for consistency, they could also use curriculum-assigned betas at their respective fractions.

2. **What about PTRN001-01-E?** Its only curriculum mode is `find_rule` (β=6.5). Even with the fix, θ=6.31 gives P=0.43 at β=6.5 — nowhere near 0.90. This subskill genuinely needs more θ growth, or the curriculum assignment may be too aggressive for kindergarten.

3. **`number-tracer` is missing from the registry.** 1 subskill (COUNT001-01-B) uses it with modes `[trace, write]`. Needs a registry entry added.
