# Pulse IRT Probability System — Project Plan

## Status: Phases 1–6 + Mastery Convergence Fix Implemented

**Last updated:** 2026-03-21

Phases 1–3 (backend core), Phase 4 (Pulse engine infrastructure), Phase 5 (frontend integration), and Phase 6 (empirical calibration) are implemented and type-checked. The CalibrationEngine now runs the full 2PL/3PL model with empirical parameter learning. Mastery gates use P(correct) thresholds. The Pulse UI surfaces probability data, confidence indicators, and session-level IRT insights.

**Phase 6 implemented.** The "P(correct) plateau" problem (§6.0) is now addressed by three interlocking fixes: adaptive σ floor with model-mismatch detection (6.3), 2PL-adjusted β MLE (6.1), and empirical discrimination calibration via point-biserial correlation (6.2). Item parameters now learn from observed student performance.

**Mastery convergence fix (§6.7).** Simulator testing revealed that even with Phase 6 fixes, students who clearly demonstrate mastery (e.g., 10+ correct on hardest items) still required too many items to reach Gate 4. Three additional fixes now accelerate convergence for demonstrated mastery: stored-prediction mismatch detection (6.7a), proportional process noise with streak acceleration (6.7b), and calibrated gate betas (6.7c). See §6.7 below.

---

## Architecture Overview

### Previous State (1PL Rasch)
```
Student answers → CalibrationEngine (1PL: a=1 for everything)
  → θ update via Bayesian grid EAP
  → Gate check: "θ > threshold AND σ < max"
  → MasteryLifecycleEngine: gate transitions
```

**Problem:** Without discrimination (a), every item moves θ equally. A clean number-bond item and a noisy multi-step word problem carry identical weight. Gate thresholds are arbitrary θ cutoffs, not probability statements. There is no way to compute P(correct) or select items by measurement value.

### Current State (2PL/3PL) — IMPLEMENTED
```
Student answers → CalibrationEngine (2PL/3PL: per-mode a, c)
  → θ update via Bayesian grid EAP with 2PL likelihood
  → P(correct) computed for gate reference items
  → Gate check: "P(correct | ref_difficulty) > threshold AND σ < max"
  → Item information available for adaptive selection
  → MasteryLifecycleEngine: probability-based gate transitions
  → Frontend: P(correct) pill, confidence indicator, gate readiness bar
  → Session summary: σ reduction, predicted vs actual, avg measurement signal
```

### The Key Formulas

```
P(correct) = c + (1 - c) / (1 + exp(-a(θ - b)))

I(θ) = a² × (P - c)² × (1 - P) / (P × (1 - c)²)

Gate pass: P(correct | ref_b, avg_a) ≥ p_threshold  AND  σ ≤ σ_max
```

---

## Phase 1: Add Discrimination Priors to Eval Modes — DONE

**Goal:** Every `(primitive_type, eval_mode)` pair has a, b, and c parameters.

### 1.1 Categorical Priors Config — DONE

Created `backend/app/config/discrimination_priors.py` with:
- `DiscriminationPrior` NamedTuple (a, c)
- Interaction-pattern constants (e.g., `PATTERN_DIRECT_MANIPULATION = (a=1.8, c=0.0)`)
- `DISCRIMINATION_REGISTRY` with per-(primitive_type, eval_mode) overrides
- `get_discrimination_prior()` with fallback chain: exact → default → infer from mode name → global default
- `_infer_from_mode_name()` heuristic for unregistered modes

| Interaction Pattern | Default a | c | Rationale |
|---|---|---|---|
| Direct manipulation (ten-frame build, counting-board count) | 1.8 | 0 | Single operation, no guessing, clean signal |
| Constructed response (plot, predict, equation balance) | 1.6 | 0 | Single skill, unambiguous answer |
| Procedural / drag-and-drop (sort, sequence, jump) | 1.4 | 0 | Motor noise, ordering ambiguity |
| Pattern recognition / inference (discover rule, translate) | 1.2 | 0 | Multiple cognitive paths |
| Open-ended / creative (create function, create pattern) | 1.0 | 0 | Scoring ambiguity, multiple valid answers |
| MC — Recall (easy, 4-option) | 1.6 | 0.25 | Fact retrieval, obvious distractors, strong discrimination |
| MC — Apply (medium, 4-option) | 1.4 | 0.25 | Standard application, moderate distractors |
| MC — Analyze (hard, 4–5 option) | 1.6 | 0.20 | Multi-step reasoning, plausible distractors reduce effective guessing |
| MC — Evaluate (expert, 5-option) | 1.8 | 0.15 | Actuarial-exam style, strong distractors make guessing nearly impossible |
| True/false | 1.0 | 0.50 | c=0.50 guessing floor, very noisy |

**MC tier rationale (§6.8):** The original flat MC prior (a=1.2, c=0.25) was overly punitive — it required 23 consecutive correct answers to reach Gate 4's σ threshold. Simulator testing showed this is because peak Fisher information for flat MC (I=0.223) is less than half that of constructed response (I=0.490). The fix is to recognize that **MC quality varies by cognitive demand**, not just format. A recall question with obvious distractors discriminates well (a=1.6); an expert analysis question with carefully crafted traps discriminates as well as direct manipulation (a=1.8) and has a lower effective guessing floor (c=0.15) because students who don't know are drawn to plausible distractors rather than guessing randomly. With tiered MC, expert-level items reach Gate 4 in 10 items — identical to constructed response. See §6.8 for full details.

### 1.2 Schema Update — DONE

Added to `ItemCalibration` in `backend/app/models/calibration.py`:
- `discrimination_a: float = 1.4` — categorical prior
- `guessing_c: float = 0.0` — 0 for constructed response
- `a_source: str = "categorical_prior"` — categorical_prior | empirical
- `a_credibility: float = 0.0` — 0–1, increases with observations

Added `get_item_discrimination()` to `problem_type_registry.py` for lookups.

### 1.3 Seed Existing Items — DONE

Created `backend/scripts/seed_discrimination_priors.py`:
- Scans all `item_calibration` Firestore docs
- Backfills `discrimination_a`, `guessing_c`, `a_source`, `a_credibility`
- Supports `--dry-run` flag
- Idempotent — safe to re-run

**Run with:** `python -m scripts.seed_discrimination_priors [--dry-run]`

---

## Phase 2: Upgrade CalibrationEngine to 2PL/3PL — DONE

**Goal:** The Bayesian θ update uses the item's actual discrimination, and P(correct) can be computed for any (θ, item) pair.

### 2.1 Core Functions — DONE

Added as module-level functions in `calibration_engine.py` (importable by other services):

```python
def p_correct(theta: float, a: float, b: float, c: float = 0.0) -> float:
    """3PL probability of correct response."""
    logit = max(-20, min(20, a * (theta - b)))
    return c + (1 - c) / (1 + math.exp(-logit))

def item_information(theta: float, a: float, b: float, c: float = 0.0) -> float:
    """Fisher information — higher = more measurement value."""
    p = p_correct(theta, a, b, c)
    q = 1 - p
    if p <= c or q <= 0:
        return 0.0
    return (a ** 2) * ((p - c) ** 2) * q / (p * ((1 - c) ** 2))
```

### 2.2 Update `_update_student_theta()` — DONE

Likelihood upgraded from 1PL to 2PL/3PL. Method now accepts `item_a` and `item_c` parameters:

```python
# Was: p_correct = 1.0 / (1.0 + math.exp(-(theta - item_beta)))
# Now: p = p_correct(theta, item_a, item_beta, item_c)
```

### 2.3 Update `process_submission()` — DONE

- Looks up `discrimination_a` and `guessing_c` from `ItemCalibration` doc
- Passes `item_a`/`item_c` to `_update_student_theta()`
- Return dict now includes: `p_correct`, `item_information`, `discrimination_a`, `guessing_c`
- New item docs are created with `a`/`c` from categorical priors

### 2.4 Empirical `a` Calibration — DEFERRED (Phase 6)

---

## Phase 3: Probability-Based Mastery Gates — DONE

**Goal:** Gate transitions use P(correct) at a reference difficulty, not arbitrary θ cutoffs.

### 3.1 Gate Definitions — DONE

Added to `backend/app/models/mastery_lifecycle.py`:

```python
GATE_P_THRESHOLDS = {1: 0.70, 2: 0.75, 3: 0.80, 4: 0.90}
GATE_REF_FRACTIONS = {1: 0.0, 2: 0.5, 3: 0.8, 4: 1.0}
GATE_SIGMA_THRESHOLDS = {1: 1.5, 2: 1.2, 3: 1.0, 4: 0.8}
```

| Gate | P(correct) threshold | Reference difficulty | σ max | Meaning |
|---|---|---|---|---|
| G1: Emerging | ≥ 70% | Easiest mode (min β) | ≤ 1.5 | "Probably passes easy items" |
| G2: Developing | ≥ 75% | Mid difficulty (50% of β range) | ≤ 1.2 | "Likely passes medium items" |
| G3: Proficient | ≥ 80% | Hard difficulty (80% of β range) | ≤ 1.0 | "Strong chance at hard items" |
| G4: Mastered | ≥ 90% | Hardest mode (max β) | ≤ 0.8 | "Near-certain at everything" |

### 3.2 Gate Check Implementation — DONE

Added `_check_probability_gate()` static method to `MasteryLifecycleEngine`:

```python
ref_beta = min_beta + (max_beta - min_beta) * GATE_REF_FRACTIONS[target_gate]
p = p_correct(theta, avg_a, ref_beta)
passed = p >= GATE_P_THRESHOLDS[target_gate] and sigma <= GATE_SIGMA_THRESHOLDS[target_gate]
```

Three gate modes are now supported with graceful fallback:
1. **`"probability"`** (new) — 2PL/3PL P(correct) at reference difficulty
2. **`"theta"`** (legacy) — θ > skill_beta_median + offset
3. **Score-based** (legacy) — 3 lesson evals ≥ 9.0

Callers updated:
- `CompetencyService.update_competency_from_problem()` now passes `primitive_type` and `avg_a` (from `discrimination_a` in calibration result)
- `PulseEngine.process_result()` passes `primitive_type` and `avg_a`

---

## Phase 4: Wire Into Pulse Item Selection — PARTIALLY DONE

**Goal:** Pulse selects items by maximum information, not just difficulty matching.

### 4.1 Max-Information Mode Selection — DONE (infrastructure)

Added `PulseEngine.select_best_mode()` static method:

```python
@staticmethod
def select_best_mode(theta: float, primitive_type: str) -> tuple[int, float]:
    """Select eval mode with max Fisher information. Falls back to theta_to_mode()."""
```

Iterates all registered modes for a primitive, computes `item_information()` for each, and returns the mode with highest I(θ).

**Not yet wired into session assembly** — session assembly doesn't know the primitive_type at item selection time (primitives are chosen by the frontend after receiving the session). The `theta_to_mode()` fallback remains for session assembly. `select_best_mode()` is available for future use when the frontend can communicate primitive preferences.

### 4.2 Frontier Info-Weighted Probing — NOT YET STARTED

### 4.3 Hybrid Two-Phase Selection — NOT YET STARTED

### 4.4 Guard Against Ceiling Effects — NOT YET STARTED

**Files changed:**
- `backend/app/services/pulse_engine.py` — `select_best_mode()` added, `IrtProbabilityData` wired into result response, `sigma` added to `ThetaUpdate`, IRT data stored per session item

---

## Phase 5: Frontend Integration — DONE

**Goal:** Surface probability data in the Pulse UI so students understand their position.

### 5.1 FrontierContextCard Enhancement — DONE

Added to `FrontierContextCard.tsx`:
- **`ProbabilityPill`** — color-coded P(correct)% badge (green ≥70%, amber 40-70%, red <40%)
- **`ConfidenceIndicator`** — sigma → "Confidence: High/Medium/Low" label
- **`GateReadiness`** — animated progress bar showing "X% ready for [Gate Name]"
- All three band content renderers (Frontier, Current, Review) display the probability pill
- Current band also shows confidence indicator and gate readiness bar

New props: `irt?: IrtProbabilityData`, `gateProgress?: GateProgress`, `sigma?: number`

### 5.2 PulseActivityRenderer — DONE

Updated `PulseActivityRenderer.tsx`:
- Added `latestIrt` and `latestSigma` to reducer state
- `SUBMIT_COMPLETE` handler captures `irt` from response and `sigma` from `ThetaUpdate`
- Passes IRT data to `FrontierContextCard` on every item

### 5.3 Post-Session Summary — DONE

Updated types and backend:
- **`IrtProbabilityData`** type — `p_correct`, `item_information`, `discrimination_a`, `guessing_c`
- **`SessionIrtSummary`** type — `start_sigma`, `end_sigma`, `sigma_reduction`, `predicted_correct`, `actual_correct`, `total_items`, `avg_information`
- **`ThetaUpdate`** — added optional `sigma` field (backend + frontend)
- **`PulseResultResponse`** — added optional `irt` field
- **`PulseSessionSummary`** — added optional `irt_summary` field

Backend `get_session_summary()` computes `SessionIrtSummary` from per-item IRT data stored on session items.

Added `IrtInsightsSection` component to `PulseSession.tsx` summary card:
- **Uncertainty reduced** — sigma delta across session
- **Predicted vs actual** — "X above/below predicted" accuracy comparison
- **Avg measurement signal** — mean Fisher information across session

**Files changed:**
- `my-tutoring-app/src/components/lumina/pulse/types.ts` — new types
- `my-tutoring-app/src/components/lumina/pulse/FrontierContextCard.tsx` — probability UI
- `my-tutoring-app/src/components/lumina/pulse/PulseActivityRenderer.tsx` — IRT state tracking
- `my-tutoring-app/src/components/lumina/pulse/PulseSession.tsx` — IRT insights in summary
- `backend/app/models/pulse.py` — `IrtProbabilityData`, `SessionIrtSummary`, `sigma` on `ThetaUpdate`
- `backend/app/services/pulse_engine.py` — IRT data in results and summary

---

## Phase 6: Empirical Calibration — DONE

**Goal:** Item parameters learn from observed student performance so that P(correct) reflects reality, not just categorical priors.

**Priority elevated:** Simulator testing revealed a concrete "P(correct) plateau" problem (see §6.0 below) that cannot be solved by Phases 1–5 alone. This phase is now the next implementation priority.

### 6.0 The P(correct) Plateau Problem — OBSERVED

**Observed in CalibrationSimulator:** A student answers 10+ "Show jumps" items (b=3.5, a=1.2) correctly in a row, but P(correct) stays stuck at ~85%. The student's θ converges to ~4.96 with σ=0.238.

**Root cause — three interlocking issues:**

1. **σ death spiral.** Once σ shrinks below ~0.3, each correct answer barely nudges θ. The Bayesian update says "I already know where you are" — even when the student is clearly outperforming the model. At σ=0.238, a correct answer on a b=3.5 item with a=1.2 moves θ by less than 0.02. The system becomes overconfident too early.

2. **Item β is frozen at categorical prior.** "Show jumps" is permanently assigned b=3.5. Even though `_update_item_beta()` exists and tracks `empirical_beta`, it uses a 1PL MLE formula (`mean(θ) - ln(correct/incorrect)`) that doesn't account for discrimination. And `ITEM_CREDIBILITY_STANDARD = 200` means the prior dominates until 200+ observations. Meanwhile, the 2PL likelihood in `_update_student_theta()` is using the still-mostly-prior β, creating a mismatch.

3. **Discrimination `a` never updates.** This is the biggest gap. The `discrimination_a` field was added (Phase 1.2) but is permanently set to the categorical prior. If the true discrimination for "Show jumps" is actually 1.8 (not 1.2), the ICC curve should be much steeper, and P(correct) for a θ=5 student at b=3.5 would be ~94% instead of ~85%. The system has no mechanism to discover this.

**The combined effect:** The model says "85% likely" but the student passes 10 in a row (probability of that at 85%: 0.85^10 = 20%). The model should update — either θ should rise faster, or the item parameters should adjust. Currently neither happens fast enough.

### 6.1 Fix 1: Upgrade `_update_item_beta()` to 2PL MLE

The existing β update uses a 1PL formula, but the θ update now uses 2PL likelihood. This creates an inconsistency. Upgrade the item β estimate to use the item's current `a` parameter:

```python
# BEFORE (1PL MLE):
empirical_beta = mean_theta - math.log(correct / incorrect)

# AFTER (2PL-adjusted):
# For 2PL, the MLE for β when a is known:
# β_mle = mean_theta - (1/a) × ln(correct / incorrect)
empirical_beta = mean_theta - (1 / item.discrimination_a) * math.log(correct / incorrect)
```

With a=1.2: the correction factor is 1/1.2 = 0.83, making β shift ~17% less per observation. With a=1.8: the factor is 1/1.8 = 0.56, making β more stable (high-discrimination items need fewer observations to converge).

**File:** `calibration_engine.py` — `_update_item_beta()`

### 6.2 Fix 2: Empirical `a` Calibration via Point-Biserial Correlation

Compute empirical discrimination from observed response patterns. The classic approach: point-biserial correlation between θ and correctness, scaled to discrimination units.

**Data needed per item** (already partially tracked):
- `total_observations`, `total_correct` — already on `ItemCalibration`
- `sum_respondent_theta` — already on `ItemCalibration`
- **NEW:** `sum_correct_theta` — sum of θ for correct responses only
- **NEW:** `sum_theta_squared` — sum of θ² for variance computation

```python
# Empirical a via point-biserial approximation
if n >= 20 and 0.1 < p_obs < 0.9:
    mean_correct = sum_correct_theta / total_correct
    mean_incorrect = (sum_respondent_theta - sum_correct_theta) / (n - total_correct)
    theta_variance = (sum_theta_squared / n) - (sum_respondent_theta / n) ** 2
    if theta_variance > 0:
        r_pb = (mean_correct - mean_incorrect) / math.sqrt(theta_variance) * math.sqrt(p_obs * (1 - p_obs))
        # Convert correlation to IRT discrimination (Lord's formula approximation)
        a_empirical = r_pb * 1.7 / math.sqrt(1 - r_pb ** 2)
        a_empirical = max(0.3, min(3.0, a_empirical))  # clamp to reasonable range
```

**Credibility blending** (Bühlmann):
```python
Z = n / (n + k),  k = 30 responses
a_updated = Z * a_empirical + (1 - Z) * a_prior
```

**Schema additions to `ItemCalibration`:**
- `sum_correct_theta: float = 0.0`
- `sum_theta_squared: float = 0.0`

**File:** `calibration_engine.py` — `_update_item_beta()` (renamed to `_update_item_parameters()`)

### 6.3 Fix 3: Adaptive σ Floor (Model-Mismatch Detection)

When a student consistently outperforms the model's predictions, the system should **not** let σ collapse. A collapsed σ with systematic over-performance is a signal that θ is underestimated.

```python
# After θ update, check for model-mismatch
# Track rolling accuracy vs predicted P(correct) over last N items
recent_items = ability.theta_history[-10:]  # last 10
if len(recent_items) >= 5:
    predicted_correct = sum(p_correct(h.theta, item_a, item_beta) for h in recent_items) / len(recent_items)
    actual_correct = sum(1 for h in recent_items if h.score >= 9.0) / len(recent_items)
    mismatch = actual_correct - predicted_correct

    if mismatch > 0.15:  # student outperforming model by 15%+
        # Inflate σ to allow faster θ movement
        sigma_floor = max(new_sigma, 0.5)
        new_sigma = sigma_floor
        logger.info(f"[CALIBRATION] Model-mismatch detected: actual={actual_correct:.2f} vs predicted={predicted_correct:.2f}, inflating sigma to {sigma_floor}")
```

This prevents the "σ death spiral" — when the model is wrong about a student, uncertainty should increase, not decrease.

**File:** `calibration_engine.py` — `_update_student_theta()`

### 6.4 How These Three Fixes Work Together

Consider the "10 correct Show Jumps in a row" scenario:

| Fix | What Changes | Effect on P(correct) |
|---|---|---|
| 6.1: 2PL β MLE | β drifts from 3.5→~3.0 faster (2PL-corrected) | P rises from 85%→89% |
| 6.2: Empirical `a` | `a` rises from 1.2→~1.6 (steeper ICC) | P rises from 89%→93% |
| 6.3: σ inflation | σ stays ≥0.5 instead of collapsing to 0.24 | θ moves faster: 4.96→5.3+ |
| Combined | β≈3.0, a≈1.6, θ≈5.3 | **P ≈ 97%** (matches reality) |

Without these fixes, P stays stuck at ~85%. With all three, the system converges to the student's actual performance within ~15–20 observations.

### 6.5 Fix 4: Process Noise (Dynamic θ Model) — DONE

The static-θ assumption treats every observation — past and present — with equal weight. A student who fails 4 times then succeeds 8 times is *learning*, but the model sees 4 failures and 8 successes as an unordered bag. Failures from 10 items ago drag down the estimate even when the student has clearly improved.

**Fix:** Add Kalman-style process noise τ before each Bayesian update, but **only when model mismatch is detected** (student outperforming predictions by >15%). When the model is accurate, let σ converge normally.

```python
# Before building the prior for this update:
if has_model_mismatch:
    prior_sigma = sqrt(σ² + τ²)    # τ = 0.1
else:
    prior_sigma = σ                 # no inflation — let σ converge
```

**Why conditional?** Unconditional process noise causes σ to increase even when the model is accurate (e.g., student at P=95% getting everything right). At low information (I≈0.1), τ²=0.01 overwhelms the posterior variance reduction, so σ drifts up indefinitely. This makes mastery confirmation take 30+ items. By only applying τ during mismatch, we get fast recovery from failures *without* stalling mastery convergence.

**Effect on the "4 wrong, 8 right" pattern:**
- Without process noise: old failures lock θ down, 8 correct answers can't overcome them because σ is tiny
- With conditional τ=0.1: mismatch detection fires during the recovery phase, τ loosens the prior so new correct answers carry real weight. Once the model catches up, τ stops and σ converges normally.

**Why not full time-series logistic?** A state-space model where θ(t) = θ(t-1) + drift + noise is the formal version of what process noise does. But it requires fitting a regression model at each step, doesn't integrate cleanly with grid EAP, and the conditional-τ approach achieves the same effect within the existing framework.

**Files:** `calibration_engine.py` — `_update_student_theta()`, `_has_model_mismatch()`, `models/calibration.py` — `THETA_PROCESS_NOISE = 0.1`

### 6.7 Mastery Convergence Fix — DONE

**Observed in CalibrationSimulator:** Even with Phase 6 fixes (6.1–6.5), a student who answers 10+ items correctly on the hardest mode still converges too slowly toward Gate 4. The model forces students to prove what's already demonstrated, wasting learning time.

**Root cause — three interlocking issues:**

1. **Retrospective mismatch detection fails as θ rises.** `computeMismatch()` retroactively computed P(correct | θ_after, current_a, current_b) for each historical item. As θ rose, the retroactive P also rose, so mismatch "disappeared" before θ reached the Gate 4 threshold. The model would say "I predicted 87%, student got 100%, that's only 13% mismatch (under 15% threshold)" — even though the ORIGINAL prediction was 50% when the item was actually administered.

2. **Fixed process noise τ=0.1 is too small.** With σ floored at 0.5 and τ=0.1: prior_sigma = √(0.25+0.01) = 0.51 — barely wider than without τ. Each correct answer still moves θ by small increments.

3. **Gate reference betas use priors, not calibrated values.** Even when β for the hardest mode drifts from 3.5→2.95 through calibration, the gate still checks P(correct) at 3.5. The calibration effort doesn't feed back into gate accessibility.

#### 6.7a Stored-Prediction Mismatch Detection

Replace retrospective P calculation with stored `pCorrectBefore` from each submission record. Each item's predicted P is captured at submission time, ensuring mismatch detection reflects the model's ACTUAL accuracy, not a retroactive reconstruction.

```python
# BEFORE: retroactive P that shrinks as θ rises
predicted = pCorrect(h.theta_after, item_a, item_beta, item_c)

# AFTER: stored P from when the item was actually administered
predicted = h.p_correct_before
```

#### 6.7b Proportional Process Noise with Streak Acceleration

Replace fixed τ=0.1 with mismatch-proportional τ + consecutive-correct streak bonus:

```python
if is_mismatch:
    mismatch_scale = min(3.0, mismatch_value / threshold)  # bigger mismatch → bigger τ
    effective_tau = base_tau * mismatch_scale

    if streak >= MASTERY_STREAK_THRESHOLD:  # 5+ consecutive correct
        streak_bonus = 1 + (streak - 5) * 0.4
        effective_tau *= min(3.0, streak_bonus)

    effective_tau = min(TAU_CAP, effective_tau)  # cap at 0.5
```

**Effect:** With mismatch=0.30 and streak=8:
- mismatch_scale = 0.30/0.15 = 2.0
- effective_tau = 0.15 × 2.0 = 0.30
- streak_bonus = 1 + 3×0.4 = 2.2
- effective_tau = 0.30 × 2.2 = 0.50 (capped)
- prior_sigma = √(0.25 + 0.25) = 0.707 (vs 0.51 before)

This ~40% wider prior allows θ to jump significantly more per correct answer.

#### 6.7c Calibrated Gate Betas

Gate reference difficulties now use calibrated (not prior) item betas. When a student repeatedly aces a mode and its β drifts downward through empirical calibration, the gate threshold follows.

```python
# BEFORE: gate always checks against original prior betas
ref_beta = min_prior_beta + (max_prior_beta - min_prior_beta) * fraction

# AFTER: gate uses calibrated betas (which drift with evidence)
ref_beta = min_calibrated_beta + (max_calibrated_beta - min_calibrated_beta) * fraction
```

#### 6.7d Combined Effect

| Fix | What Changes | Impact |
|---|---|---|
| 6.7a: Stored predictions | Mismatch stays detected longer | σ floor + τ active for more updates |
| 6.7b: Proportional τ | Prior widens to σ≈0.7 (from 0.51) | θ jumps ~40% more per correct |
| 6.7c: Calibrated gates | G4 ref_beta drops as β calibrates | P(correct) threshold met sooner |
| Combined | All three compound | Gate 4 reachable in ~10 items instead of 15+ |

**Constants:** `THETA_PROCESS_NOISE=0.15`, `MASTERY_STREAK_THRESHOLD=5`, `TAU_CAP=0.5`

**Files:** `CalibrationSimulator.tsx`, `calibration-sim/route.ts`

### 6.8 MC Difficulty Tiers — DONE

**Problem:** The original flat MC configuration (single mode, a=1.2, c=0.25) required 23 consecutive correct answers to reach Gate 4. At peak (near b), MC gave only 44% of the Fisher information of constructed response (0.223 vs 0.490). This was overly punitive — hard MC items like actuarial exam questions can be as discriminating as any constructed-response format.

**Root cause:** Treating all MC as one interaction pattern conflates recall questions (where wrong answers are obvious and a is high) with analysis questions (where distractors are plausible and c is actually lower than the theoretical 0.25 random-guess rate).

**Fix: Bloom's taxonomy-aligned MC tiers**

| Tier | Eval Mode | β | a | c | Cognitive Level | Items to G4 (solo) |
|---|---|---|---|---|---|---|
| Recall | `recall` | 1.5 | 1.6 | 0.25 | "What is X?" — fact retrieval | n/a (too easy for G4) |
| Apply | `apply` | 3.0 | 1.4 | 0.25 | "Use X to solve Y" — standard | ~20 |
| Analyze | `analyze` | 4.5 | 1.6 | 0.20 | "Why does X happen?" — multi-step | ~12 |
| Evaluate | `evaluate` | 6.0 | 1.8 | 0.15 | "Which approach is best?" — expert | **10** |

**Why `c` decreases at higher tiers:** Random guessing gives c=0.25 for 4-option MC. But well-designed distractors at higher cognitive levels *attract* students who don't know the material — they're wrong for specific, predictable reasons. A student who doesn't understand the concept will pick the plausible-looking distractor, not guess randomly. This makes effective c lower than the random baseline. Expert-level items with 5 options and strong distractors operate at c≈0.15.

**Why `a` increases at higher tiers:** Easy recall items with obvious distractors already separate "knows" from "doesn't know" well (a=1.6). Medium application items have more cognitive paths to the answer, adding noise (a=1.4). But at the analyze/evaluate level, the items are testing a specific deep understanding — students either have the mental model or they don't. Combined with the lower guessing floor, this produces clean, high-signal measurements.

**Information comparison at peak (near respective β):**

| Format | Peak I(θ) | Relative to direct manipulation |
|---|---|---|
| Direct manipulation (a=1.8, c=0) | 0.810 | 100% |
| MC Evaluate (a=1.8, c=0.15) | 0.710 | 88% |
| MC Analyze (a=1.6, c=0.20) | 0.436 | 54% |
| MC Apply (a=1.4, c=0.25) | 0.303 | 37% |
| MC Recall (a=1.6, c=0.25) | 0.396 | 49% |
| Old flat MC (a=1.2, c=0.25) | 0.223 | 28% |

**Key insight: the format isn't the bottleneck, the item quality is.** A well-crafted MC item at a=1.8 with c=0.15 carries 88% of the information of direct manipulation — enough to reach Gate 4 in the same number of items. The original flat MC prior dramatically undervalued what good MC can measure.

**Escalation pattern:** When the system selects MC items, it should prefer higher tiers as θ rises — recall items have maximum information near θ=1.5, while evaluate items peak near θ=6.0. This aligns naturally with the existing `select_best_mode()` information-maximizing logic.

**Files:** `CalibrationSimulator.tsx`, `calibration-sim/route.ts`, `config/discrimination_priors.py`, `problem_type_registry.py`, `gemini-knowledge-check.ts`, `practice-manifest.ts`, `practice-content-hydrator.ts`, `PulseActivityRenderer.tsx`

### 6.6 Response Time as Signal (Future)

A correct answer in 2 seconds vs 30 seconds carries different information. Consider modulating θ update magnitude:
- Fast correct → higher effective θ (fluency signal)
- Slow correct → lower confidence boost (struggling but succeeded)

This remains deferred — the three fixes above address the immediate plateau problem.

### 6.6 Implementation Order for Phase 6

| Step | What | Complexity | Impact |
|---|---|---|---|
| 6.1 | Upgrade β MLE to 2PL | S | Medium — β converges faster |
| 6.2a | Add `sum_correct_theta`, `sum_theta_squared` to schema | S | Prerequisite for 6.2b |
| 6.2b | Empirical `a` computation + credibility blending | M | High — `a` learns from data |
| 6.3 | σ floor with mismatch detection | S | High — breaks the σ death spiral |
| 6.4 | Seed script to backfill new schema fields | S | Prerequisite for 6.2 on existing data |
| 6.5 | Process noise τ (dynamic θ model) | S | High — faster recovery from failures |

**Recommended order:** 6.3 (immediate impact, smallest change) → 6.1 (quick win) → 6.2a → 6.2b (biggest payoff) → 6.5 (recovery speed)

---

## Implementation Order

| Step | What | Files | Status |
|---|---|---|---|
| 1.1 | Discrimination priors config | `config/discrimination_priors.py` | DONE |
| 1.2 | Schema update (a, c fields) | `models/calibration.py` | DONE |
| 1.3 | Seed existing items | `scripts/seed_discrimination_priors.py` | DONE |
| 2.1 | p_correct + item_information | `calibration_engine.py` | DONE |
| 2.2 | Update θ likelihood to 2PL | `calibration_engine.py` | DONE |
| 2.3 | Unit tests | `tests/test_calibration_2pl.py` | TODO |
| 3.1 | Probability-based gate constants | `models/mastery_lifecycle.py` | DONE |
| 3.2 | Gate check → P(correct) based | `mastery_lifecycle_engine.py` | DONE |
| 4.1 | Max-info mode selection (infra) | `pulse_engine.py` | DONE |
| 4.2 | Frontier info-weighted probing | `pulse_engine.py` | TODO |
| 4.3 | Hybrid two-phase selection | `pulse_engine.py` | TODO |
| 4.4 | Ceiling effect guard | `pulse_engine.py` | TODO |
| 5.1 | FrontierContextCard P(correct) | `FrontierContextCard.tsx` | DONE |
| 5.2 | Activity renderer IRT tracking | `PulseActivityRenderer.tsx` | DONE |
| 5.3 | Post-session IRT summary | `PulseSession.tsx` | DONE |
| **6.3** | **σ floor with mismatch detection** | `calibration_engine.py` | **DONE** |
| **6.1** | **Upgrade β MLE to 2PL** | `calibration_engine.py` | **DONE** |
| **6.2a** | **Schema: sum_correct_theta, sum_theta_squared** | `models/calibration.py` | **DONE** |
| **6.2b** | **Empirical `a` via point-biserial** | `calibration_engine.py` | **DONE** |
| 6.4 | Seed script for new schema fields | `scripts/seed_empirical_a_fields.py` | **DONE** |
| **6.5** | **Process noise τ (dynamic θ)** | `calibration_engine.py`, `models/calibration.py` | **DONE** |
| **6.7a** | **Stored-prediction mismatch detection** | `CalibrationSimulator.tsx`, `route.ts` | **DONE** |
| **6.7b** | **Proportional τ + streak acceleration** | `CalibrationSimulator.tsx`, `route.ts` | **DONE** |
| **6.7c** | **Calibrated gate betas** | `CalibrationSimulator.tsx`, `route.ts` | **DONE** |
| **6.8** | **MC difficulty tiers (Bloom's-aligned)** | `CalibrationSimulator.tsx`, `route.ts` | **DONE** |
| 6.6 | Response time signal | `calibration_engine.py` | DEFERRED |

**Critical path completed:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 (probability gates live)

**Phase 6 complete.** Four fixes address the P(correct) plateau and recovery speed:
- 6.3: σ floor with model-mismatch detection (prevents σ death spiral)
- 6.1: 2PL-adjusted β MLE (β converges faster with discrimination-aware formula)
- 6.2: Empirical `a` via point-biserial correlation with Bühlmann credibility blending
- 6.4: Seed script for backfilling new schema fields on existing data
- 6.5: Process noise τ=0.15 (Kalman-style drift — old failures lose weight, faster recovery)

**Mastery convergence + MC tiers complete.** Three fixes accelerate mastery for demonstrated ability:
- 6.7a: Stored-prediction mismatch (prevents premature mismatch disappearance)
- 6.7b: Proportional τ with streak acceleration + σ correction (θ moves faster, σ still converges)
- 6.7c: Calibrated gate betas (gate references track empirical item difficulty)
- 6.8: MC difficulty tiers — Bloom's-aligned recall/apply/analyze/evaluate with tier-specific a and c values. Expert MC (a=1.8, c=0.15) reaches Gate 4 in 10 items, matching constructed response.

**Remaining:**
- 2.3: Unit tests for 2PL calibration functions
- 4.2–4.4: Full Pulse item selection upgrade (frontier probing, hybrid selection, ceiling guards)

---

## Resolved Design Decisions

1. **`a` is at the `(primitive_type, eval_mode)` level**, not per-item or per-skill. This matches how generators work — each eval mode is a distinct interaction pattern with consistent measurement properties. Per-item refinement happens in Phase 6 via empirical calibration.

2. **Gate model stays 4-gate with spaced repetition retests.** The change is in the *pass condition*, not the gate structure. Retest intervals (3d/7d/14d) remain — they test durability, which P(correct) alone can't measure.

3. **Theta-to-mode lookup table coexists with max-information selection.** `theta_to_mode()` remains as the fallback for session assembly (where primitive_type is unknown). `select_best_mode()` is available for contexts where primitive type is known. Full replacement is deferred to Phase 4.2+.

4. **Guessing floor (c) varies by format and cognitive tier.** All constructed-response primitives use c=0 (you can't guess your way through dragging counters). MC uses tiered c values: recall/apply at c=0.25 (random 4-option baseline), analyze at c=0.20 (plausible distractors attract wrong answers), evaluate at c=0.15 (expert distractors make random guessing nearly impossible). T/F remains c=0.50. The key insight: effective c is a property of distractor quality, not just option count.

5. **The instrument is interchangeable (ADAPT model).** A student measured with ten-frame and number-line on the same skill produces a single coherent θ estimate. Different primitives are different instruments measuring the same latent trait. The rotating variety is a *feature*, not a bug — each independent observation improves the estimate.

6. **Three gate modes with graceful fallback.** New lifecycle docs use `gate_mode="probability"`. Existing docs in `"theta"` or `"legacy"` mode continue to work with their original gate check logic. No migration needed — the system is backwards-compatible.

7. **MC discrimination is a function of item quality, not format.** The format (MC vs constructed response) is not the measurement bottleneck — item quality is. Expert-level MC with strong distractors (a=1.8, c=0.15) carries 88% of the Fisher information of direct manipulation (a=1.8, c=0) and reaches Gate 4 in the same number of items (10). The original flat MC prior (a=1.2, c=0.25) undervalued MC by treating all items identically regardless of cognitive demand. Bloom's taxonomy-aligned tiers (recall/apply/analyze/evaluate) fix this by matching discrimination and guessing parameters to the item's cognitive level.

---

## Open Questions

1. **σ floor threshold tuning.** The mismatch detection in §6.3 uses a 15% threshold and σ floor of 0.5. These may need tuning per-primitive or per-skill. High-a items (a≥1.6) converge faster, so their σ floor could be lower. Low-a items (a≤1.0) are inherently noisy and may need a higher floor. Should the floor be a function of the item's discrimination?

2. **Correlation propagation with `a`.** When transferring θ priors across correlated skills (e.g., leapfrog seeding), should the transferred estimate carry a discount based on the average `a` of the items that measured it? A θ estimated from low-a items is inherently noisier.

3. **~~Adaptive `c` for mixed formats.~~** RESOLVED (§6.8). MC now has tiered c values (0.25/0.20/0.15) based on cognitive level. Information-maximizing selection (`select_best_mode()`) will naturally pick the format with highest I(θ) at the student's current ability — for low θ, recall MC (peak near b=1.5) may outperform constructed response; for high θ, evaluate MC (a=1.8, c=0.15) approaches constructed response in information. No need to enforce format diversity — let information guide it.

4. **Response time integration.** Deferred but worth designing now — does response time modulate the θ update, or is it a separate signal tracked alongside θ?

5. **Full `theta_to_mode` replacement.** Session assembly currently doesn't know the primitive_type. Options: (a) frontend sends preferred primitive in session request, (b) backend infers from subskill → primitive affinity mapping, (c) keep theta_to_mode as coarse initial pick and refine after frontend selects primitive.

6. **Empirical `a` stability.** Point-biserial correlation requires variance in both θ and correctness. If all students at similar θ levels get an item right, r_pb is undefined. Need a minimum variance threshold and fallback to prior when data is too homogeneous. The k=30 credibility standard may need to be higher (k=50?) for `a` vs `β` since discrimination estimation is inherently noisier.

---

## Reference

- **Simulator:** `my-tutoring-app/src/components/lumina/components/CalibrationSimulator.tsx`
- **Discrimination Priors:** `backend/app/config/discrimination_priors.py`
- **CalibrationEngine:** `backend/app/services/calibration_engine.py` — `p_correct()`, `item_information()`, 2PL likelihood
- **MasteryLifecycleEngine:** `backend/app/services/mastery_lifecycle_engine.py` — `_check_probability_gate()`
- **PulseEngine:** `backend/app/services/pulse_engine.py` — `select_best_mode()`, IRT in results/summary
- **Models:** `backend/app/models/calibration.py`, `mastery_lifecycle.py`, `pulse.py`
- **Seed Script:** `backend/scripts/seed_discrimination_priors.py`
- **Frontend Types:** `my-tutoring-app/src/components/lumina/pulse/types.ts`
- **Frontend UI:** `FrontierContextCard.tsx`, `PulseActivityRenderer.tsx`, `PulseSession.tsx`
- **Pulse PRD:** `my-tutoring-app/src/components/lumina/docs/Lumina_PRD_Pulse.md`
- **Eval Modes PRD:** `my-tutoring-app/src/components/lumina/docs/PRD_EVAL_MODES_ROLLOUT.md`
- **Architecture Reference:** `my-tutoring-app/src/components/lumina/docs/PULSE_ARCHITECTURE_REFERENCE.md`
