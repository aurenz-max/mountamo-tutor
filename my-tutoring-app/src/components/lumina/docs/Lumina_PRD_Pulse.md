# Lumina Pulse — Adaptive Learning Loop

**Version:** 3.0
**Date:** 2026-03-27
**Status:** Phase 7 — IRT-Driven Mastery + Unified Item Selection

---

## 1. Problem Statement

### 1.1 The Velocity Problem

The original system produced a linear experience where a student who completes one problem set advances ~2.3% through the knowledge graph in ~6 minutes. At this rate, full coverage of 674 K-level subskills requires ~290 problem sets or ~29 hours of pure problem-solving time — before accounting for the retest cycle that multiplies each skill by 4x.

The root cause: three nearly independent systems controlled a student's time, and none allowed acceleration.

| System | Purpose | Limitation |
|--------|---------|------------|
| Diagnostic Placement | One-time onboarding, binary-search the DAG | Only runs once; no continuous probing |
| Daily Learning Planner | Sequential lesson groups, 75-min daily budget | 100% of time is scheduled; no room for stretch |
| Difficulty Calibration (IRT) | Continuous θ/β estimation | Parallel system — θ didn't drive gates or planning |

### 1.2 The Fragmentation Problem

Three frontend components (`DiagnosticSession`, `PlannerDashboard`, `PracticeModeEnhanced`) each had separate item selection logic, separate session management, and separate result pipelines.

### 1.3 The Vision

**Practice becomes learning.** Every session is simultaneously diagnosis, instruction, and assessment. Students can jump 1-5 skills ahead on the knowledge graph. If they succeed, DAG inference triggers massive skips. If they fail, the system calibrates them to the right difficulty. Spaced retention handles the trailing edge automatically.

One component. One selection function. One loop.

---

## 2. Core Architecture — Unified Information-Maximizing Selection

### 2.1 Design Principle

Every Pulse session assembles items from a single ranking function. All candidate skills — new, in-progress, and review — compete on the same utility score:

```
utility = Fisher_information(θ_eff, a, β) × urgency(state, decay, stability)
```

**Band labels (frontier/current/review) are derived from student state for frontend display, not used for selection.** The information-maximizing utility function naturally produces the right mix:
- New skills have high prior σ → high information → selected early
- Overdue reviews have decayed θ → high information → selected when informative
- Trivial items have P→1 → near-zero information → naturally filtered out

```
┌──────────────────────────────────────────────────────────────────┐
│                    PULSE SESSION                                  │
│                                                                   │
│   Every candidate skill scored by:                                │
│     utility = information(θ_eff, a, β) × urgency                 │
│                                                                   │
│   Band labels derived from state (for frontend display):          │
│     FRONTIER  ← not yet unlocked, discovered via BFS             │
│     CURRENT   ← not_started or active without decay              │
│     REVIEW    ← active with elapsed time > 0.5 × stability       │
│                                                                   │
│   All items use calibrated β → all update θ → all can            │
│   trigger gate transitions                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Urgency Multipliers

Urgency modulates Fisher information without overriding it:

| State | Urgency | Rationale |
|-------|---------|-----------|
| `not_started` | 1.5 | Mild boost for new skills — exploration is valuable |
| `active`, not overdue | 1.0 | Default — let information drive |
| `active`, overdue | `1.0 + min(2.0, days_elapsed / stability)` | Peaks at 3.0 when review is 2× overdue. Caps to avoid runaway dominance over frontier items |
| Frontier probe | `2.0 / (1.0 + 0.2 × depth)` | Closer probes slightly preferred; decays with DAG distance |

### 2.3 Band Derivation Rules

Band labels are assigned after utility ranking, based on student state:

```python
if retention_state == "not_started":
    band = CURRENT
elif retention_state == "active" and days_since > stability * 0.5:
    band = REVIEW
else:
    band = CURRENT

# Frontier probes (not yet unlocked, discovered via BFS):
band = FRONTIER
```

### 2.4 Diversity Cap

To prevent a single skill from monopolizing a session:

```python
MAX_CURRENT_ITEMS_PER_SKILL = 3  # per skill_id
```

Items are selected in utility-descending order; once a skill_id hits the cap, remaining items for that skill are skipped.

---

## 3. IRT Integration

### 3.1 Max-Information Mode Selection

Instead of a fixed θ→mode mapping table, the engine selects the eval mode that maximizes Fisher information for the student's current θ:

```python
@staticmethod
def select_best_mode(theta: float, primitive_type: str) -> tuple[int, float, str]:
    """Select the eval mode that gives maximum Fisher information.

    Returns (mode_number, target_beta, eval_mode_name).
    Falls back to theta_to_mode() for primitives not in the registry.
    """
    modes = PROBLEM_TYPE_REGISTRY.get(primitive_type)
    if not modes:
        mode = theta_to_mode(theta)
        return mode, mode_to_beta(mode), "default"

    # Sort eval modes by beta ascending, assign mode numbers 1, 2, 3, ...
    sorted_modes = sorted(modes.items(), key=lambda x: x[1].prior_beta)
    best = max(sorted_modes, key=lambda m: item_information(theta, a, m.prior_beta, c))
    return best_mode_num, best_beta, best_eval_mode_name
```

Each primitive type registers its eval modes in the `ProblemTypeRegistry` with per-mode discrimination (a) and guessing floor (c). The engine picks the mode where the student's θ lands closest to the inflection point of the ICC curve — maximum information extraction per item.

**Fallback θ→mode table** (used when primitive not in registry):

| θ Range | Mode | Description | Prior β |
|---------|------|-------------|---------|
| θ < 2.0 | 1 | Concrete manipulatives | 1.5 |
| 2.0 ≤ θ < 3.0 | 2 | Pictorial with prompts | 2.5 |
| 3.0 ≤ θ < 4.5 | 3 | Pictorial, reduced prompts | 3.5 |
| 4.5 ≤ θ < 6.0 | 4 | Mixed symbolic/pictorial | 5.0 |
| 6.0 ≤ θ < 7.5 | 5 | Fully symbolic, single operation | 6.5 |
| θ ≥ 7.5 | 6 | Symbolic, multi-step | 8.0 |

### 3.2 Per-Item IRT Update Cycle

Every item result triggers the full 2PL/3PL IRT update:

1. **β update** (item difficulty): `CalibrationEngine._update_item_beta()` — MLE with credibility blending
2. **θ update** (student ability): `CalibrationEngine._update_student_theta()` — Bayesian EAP over θ ∈ [0, 10]
3. **σ update** (uncertainty): posterior variance from the EAP grid
4. **P(correct)** and **Fisher information** returned per item

Core formulas:
```
P(correct) = c + (1 - c) / (1 + exp(-a(θ - b)))
I(θ) = a² × (P - c)² × (1 - P) / (P × (1 - c)²)
```

**Continuous scoring model:** Scores are normalized to a response weight `x = score / 10.0 ∈ [0, 1]` and used directly in the Bayesian likelihood via the Beta response model:
```
L(x|θ) = P(θ)^x × (1 - P(θ))^(1 - x)
```
This replaces the prior binary threshold (score ≥ 9.0 = "correct"). A score of 8.5 (x=0.85) now produces a mostly-correct likelihood, pushing θ upward proportionally. Item β estimation uses the same continuous weights — `total_correct` accumulates fractional weights, not integer counts.

### 3.3 Leapfrog Logic — Lightweight Unlock

Leapfrog triggers when a frontier probe lesson group passes. **Key design decision: leapfrog only seeds competency docs for unlock propagation — no fabricated θ, σ, lifecycle, or ability docs.**

```
Condition:
  - Band = FRONTIER
  - All items in the lesson group have been scored
  - Aggregate score ≥ 75% (≥ 7.5 on 0-10 scale average)

Action:
  For each ancestor skill between probed node and current frontier:
    1. Seed ONLY competency doc:
       - score = aggregate_score
       - credibility = 0.1 (minimal — just enough for unlock propagation)
       - total_attempts = 0
    2. NO lifecycle doc — student hasn't been tested yet
    3. NO ability doc — no fabricated θ/σ
    4. Track inferred skills in session-level dedup set
       (_session_inferred_skills) to avoid redundant writes

  Then: mark subject for deferred unlock refresh
        (recalculate_unlocks batched once per session, not per leapfrog)

Why lightweight:
  The unified selector will see newly-unlocked skills as:
    - not_started (no lifecycle)
    - DEFAULT_STUDENT_THETA (3.0, high uncertainty)
    - Max prior σ → high Fisher information
  → Naturally prioritized for testing without fabricated state.

  If the inference was wrong, the student will score poorly when
  actually tested → low θ, no gate advance, skill stays at frontier.
```

**Deduplication:** Multiple frontier probes in the same session often share ancestors. The engine tracks `_session_inferred_skills` (a set on the in-memory session dict) and skips already-inferred skills on subsequent leapfrogs.

### 3.4 IRT-Derived Gate System (replaces stability multipliers)

Mastery gates are derived directly from IRT state (θ + σ) via probability thresholds at reference difficulty levels. This is the single source of truth for mastery progression:

```python
def derive_gate_from_irt(theta, sigma, min_beta, max_beta, avg_a=1.4):
    """Check gates 4→3→2→1 (highest first), return highest passed."""
    for gate in (4, 3, 2, 1):
        ref_beta = min_beta + (max_beta - min_beta) * GATE_REF_FRACTIONS[gate]
        p = p_correct(theta, avg_a, ref_beta)
        if p >= GATE_P_THRESHOLDS[gate] and sigma <= GATE_SIGMA_THRESHOLDS[gate]:
            return gate, retention_state, p
    return 0, "not_started", p
```

| Gate | P(correct) Threshold | Reference β Fraction | σ Max | Meaning |
|------|---------------------|---------------------|-------|---------|
| 1 | ≥ 0.70 | 0.0 (easiest mode) | ≤ 1.5 | "Probably passes easy items" |
| 2 | ≥ 0.75 | 0.5 (mid difficulty) | ≤ 1.2 | "Likely passes medium items" |
| 3 | ≥ 0.80 | 0.8 (hard difficulty) | ≤ 1.0 | "Strong chance at hard items" |
| 4 | ≥ 0.90 | 1.0 (hardest mode) | ≤ 0.8 | "Near-certain at everything" |

**Gate can only advance or hold — never regress on a single eval.** A bad score lowers θ (via CalibrationEngine), which naturally lowers the derived gate on the NEXT eval. This prevents jarring gate drops from momentary slips.

---

## 4. Cold Start — First Session as Mini-Diagnostic

When a student has no mastery_lifecycle docs for a subject, Pulse enters **cold start mode**:

- **100% frontier probes** — no current work or reviews (nothing to review yet)
- **Probe selection:** `DAGAnalysisEngine.select_initial_probes()` — topological sort, compute node metrics, select midpoints of independent chains
- **Only prerequisite edges** used for topo sort (non-prerequisite edges can have cycles)
- **DAG inference on results:** Pass → ancestors unlocked via leapfrog; Fail → calibrate β
- **Coverage target:** After first session (~15 items), expect 40-60% of DAG classified via inference
- **Transition:** After first session completes and mastery docs are seeded, subsequent sessions use unified selection

---

## 5. Session Assembly Algorithm

### 5.1 `assemble_session(student_id, subject, item_count=15)`

```
1. LOAD STUDENT STATE (parallel Firestore reads)
   - mastery_lifecycle docs for subject → lifecycle_map
   - ability docs → theta_map
   - primitive history → recent_primitives (rolling window)

2. BUILD LOOKUP MAPS
   - gate_map: subskill_id → current_gate
   - retention_map: subskill_id → retention_state (via derive_retention_state)
   - lifecycle_map: subskill_id → full lifecycle dict

3. LOAD DAG
   - LearningPathsService._get_graph(subject) → nodes, edges
   - Filter to subskill nodes only

4. COLD START CHECK
   - If len(lifecycles) == 0 → cold_start_mode
   - DAGAnalysisEngine.select_initial_probes() for midpoint selection
   - Return all items as band=FRONTIER

5. UNIFIED SELECTION (non-cold-start)
   a. Compute unlocked entities
      - LearningPathsService.get_unlocked_entities()
      - Intersect with graph node IDs
      - Identify mastered_ids (retention_state == "mastered")

   b. BFS forward to discover frontier probes
      - Seed: (unlocked ∪ mastered) - mastered
      - Traverse ALL edge types (not just prerequisites) for broad discovery
      - Sort candidates by midpoint proximity + edge strength
      - Max depth: FRONTIER_MAX_JUMP (5)

   c. Score ALL candidates with unified utility function:
      For each unlocked (non-mastered) subskill:
        - Use DEFAULT_STUDENT_THETA for not_started (not inherited parent θ)
        - select_best_mode(theta, primitive_type) → mode, beta, eval_mode
        - Compute decay-adjusted effective_theta for active skills
        - info = item_information(eff_theta, a, beta, c)
        - urgency = state-based multiplier (see §2.2)
        - utility = info × urgency
        - Derive band label from state (see §2.3)

      For each frontier probe candidate:
        - Use DEFAULT_STUDENT_THETA (no θ data)
        - info at prior → high because high uncertainty
        - urgency = 2.0 / (1.0 + 0.2 × depth)
        - band = FRONTIER

   d. Sort by utility descending, select top items with diversity cap
      - MAX_CURRENT_ITEMS_PER_SKILL per skill_id

6. COMPUTE FRONTIER CONTEXT
   - Per-item: unit progress, DAG distance, ancestor count, next skill name
   - Session-level: frontier depth, total mastered, units in progress
   - Uses DAGAnalysisEngine for topological depth computation

7. PERSIST
   - Generate session_id (uuid)
   - Save to Firestore: pulse_sessions/{session_id}
   - Return PulseSessionResponse with frontier_context + recent_primitives
```

### 5.2 Key Design Decisions

**Why unified ranking instead of fixed band allocation:**
- Fixed 20/65/15 splits force items into bands regardless of information value
- A gifted student with all reviews trivial (P>0.95) wastes 15% of session on busywork
- The unified function naturally shifts proportions based on student state:
  - New student: mostly frontier + current (no reviews exist)
  - Advanced student: mostly frontier (current items are trivial)
  - Overdue student: mostly review (high urgency from decay)

**Why not_started skills use DEFAULT_STUDENT_THETA (not parent skill θ):**
- Leapfrog-inferred skills share a parent skill_id whose θ was elevated by the probe
- Using inherited θ would make info ≈ 0, starving inferred skills of selection despite high uncertainty
- DEFAULT_STUDENT_THETA + max prior σ = high Fisher information = naturally prioritized

**Why BFS traverses all edge types (not just prerequisites):**
- Non-prerequisite edges (parallel, reinforces, builds_on, applies) reveal related skills
- Broader discovery prevents the engine from getting stuck in narrow prerequisite chains
- Candidate sorting by midpoint proximity + edge strength balances depth and relevance

---

## 6. Result Processing

### 6.1 `process_result(student_id, session_id, result)`

Per-item processing pipeline:

```
1. LOAD SESSION
   - Fetch pulse_sessions/{session_id} (or use prefetched)
   - Find item spec by result.item_id
   - Validate item not already scored

2. PRE-FETCH (parallel)
   - ability doc for skill_id
   - lifecycle doc for subskill_id

3. IRT UPDATE
   - CalibrationEngine.process_submission()
   - Returns: calibrated_beta, student_theta, sigma, earned_level,
              p_correct, item_information, discrimination_a

4. MASTERY UPDATE
   - Classify eval source: gate 0 → "lesson", gate ≥ 1 → "practice"
   - MasteryLifecycleEngine.process_eval_result()
     with theta, sigma, primitive_type, avg_a for IRT-derived gate check
   - Returns: updated lifecycle dict

5. LEAPFROG CHECK (frontier band only)
   - Check all items in lesson group scored
   - Aggregate score ≥ FRONTIER_PASS_THRESHOLD (7.5)
   - If pass: seed competency docs (credibility=0.1), mark for unlock refresh
   - Dedup via _session_inferred_skills set

6. UPDATE SESSION DOC (in-memory)
   - Mark item: score, primitive_type, eval_mode, duration_ms, completed_at
   - Attach theta_update, irt_data, gate_update per item
   - Increment progress counters

7. COMPETENCY WRITE
   - update_competency() for prerequisite-unlock propagation
   - Without this, get_student_proficiency_map() returns 0
     → depth-1+ children never unlock → students stuck at root skills

8. PRIMITIVE HISTORY
   - Record primitive_type + eval_mode + score in rolling window

9. RETURN PulseResultResponse
   - theta_update: { skill_id, old_theta, new_theta, sigma, earned_level }
   - gate_update: { subskill_id, old_gate, new_gate } or null
   - leapfrog: { probed_skills, inferred_skills, aggregate_score } or null
   - irt: { p_correct, item_information, discrimination_a, guessing_c }
   - session_progress: { items_completed, items_total, is_complete, bands_summary }
```

### 6.2 Eval Source Classification

Simplified from the original band+state matrix to a gate-only check:

```python
@staticmethod
def _get_eval_source(band: str, gate: int) -> str:
    """
    Gate 0 → "lesson" (probability gate check runs regardless of band)
    Gate ≥ 1 → "practice" (IRT-derived gate update via stability)
    """
    if gate == 0:
        return "lesson"
    return "practice"
```

**Why gate-only:** At gate 0, ALL bands route to "lesson" so the probability gate check (`derive_gate_from_irt`) runs regardless of whether the item was a frontier probe, review, or current-band item. This ensures a frontier probe on an untested skill can trigger activation just as well as a current-band item. After activation (gate ≥ 1), everything is "practice" for IRT-derived gate updates.

### 6.3 Deferred Write Optimization

For batch callers (Pulse Agent, high-throughput sessions), the engine supports deferred writes to minimize Firestore round-trips:

| Parameter | Effect | Flush Method |
|-----------|--------|--------------|
| `prefetched_session` | Skip session read; dict mutated in-place | `save_deferred_session()` |
| `defer_session_save` | Skip per-item session write | `save_deferred_session()` |
| `defer_primitive_history` | Skip per-item history read+write | `flush_primitive_history()` |
| `defer_competency` | Skip per-item competency write | `save_deferred_session()` (batched) |
| `prefetched_global_pass_rate` | Skip per-item global rate read | — |
| `item_calibration_cache` | Shared dict, skip duplicate item cal reads | — |

Typical optimization: session loaded once, global rate prefetched once, item calibration cached across items sharing same primitive+mode. Saves ~3N Firestore reads per session where N = item count.

---

## 7. Data Models

### 7.1 Firestore Schema

**pulse_sessions/{session_id}**
```
{
  session_id: str
  student_id: int
  subject: str
  status: "in_progress" | "completed" | "abandoned"
  is_cold_start: bool

  items: [
    {
      item_id: str
      band: "frontier" | "current" | "review"
      subskill_id: str
      skill_id: str
      description: str
      target_mode: int (1-6)
      target_beta: float
      lesson_group_id: str
      primitive_affinity: str | null
      eval_mode_name: str | null        # max-info mode name from registry

      # Populated after completion:
      score: float | null (0-10)
      primitive_type: str | null
      eval_mode: str | null
      duration_ms: int | null
      completed_at: str | null
      theta_update: { skill_id, old_theta, new_theta, sigma, earned_level } | null
      irt: { p_correct, item_information, discrimination_a, guessing_c } | null
      gate_update: { subskill_id, old_gate, new_gate } | null
    }
  ]

  band_counts: { frontier: int, current: int, review: int }
  items_completed: int
  items_total: int

  leapfrogs: [
    {
      lesson_group_id: str
      probed_skills: [str]
      inferred_skills: [str]
      aggregate_score: float
    }
  ]

  created_at: str
  updated_at: str
  completed_at: str | null
}
```

**students/{id}/mastery_lifecycle/{subskill_id}**
```
{
  student_id: int
  subskill_id: str
  subject: str
  skill_id: str

  # Gate state (IRT-derived via derive_gate_from_irt)
  current_gate: int (0-4)

  # Retention model
  retention_state: "not_started" | "active" | "mastered"
  stability: float           # days — derived from gate for backward compat
  last_reviewed: str | null  # ISO-8601
  review_count: int

  # Completion factor (actuarial model)
  completion_pct: float (0.0-1.0)
  passes: int
  fails: int
  subskill_pass_rate: float
  blended_pass_rate: float
  credit_per_pass: float
  estimated_remaining_attempts: int

  # Gate transition tracking
  gate_mode: "legacy" | "probability"
  theta_at_gate_entry: float | null
  sigma_at_gate_entry: float | null
  gate_theta_threshold: float | null

  # Legacy fields (kept for backward compat, not driving logic)
  next_retest_eligible: str | null
  retest_interval_days: int
  lesson_eval_count: int

  gate_history: [GateHistoryEntry]
  created_at: str
  updated_at: str
}
```

**students/{id}/ability/{skill_id}** — θ, σ, earned_level, theta_history

**students/{id}/pulse_state/primitive_history** — rolling window of recent primitive usage

**item_calibration/{primitive_type}_{eval_mode}** — calibrated β per item type

**curriculum_graphs/{subject}/published** — DAG nodes + edges

### 7.2 Backend Pydantic Models

```python
class PulseBand(str, Enum):
    FRONTIER = "frontier"
    CURRENT = "current"
    REVIEW = "review"

class PulseItemSpec(BaseModel):
    item_id: str
    band: PulseBand
    subskill_id: str
    skill_id: str
    subject: str
    description: str
    target_mode: int = Field(ge=1, le=6)
    target_beta: float
    lesson_group_id: str
    primitive_affinity: Optional[str] = None
    eval_mode_name: Optional[str] = None
    frontier_context: Optional[ItemFrontierContext] = None

class ItemFrontierContext(BaseModel):
    """Per-item graph position context for frontend display."""
    unit_name: str = ""
    unit_mastered: int = 0
    unit_total: int = 0
    dag_distance: Optional[int] = None        # frontier only
    ancestors_if_passed: Optional[int] = None  # frontier only
    ancestor_skill_names: List[str] = []       # frontier only (max 5)
    next_skill_name: Optional[str] = None      # current only
    last_tested_ago: Optional[str] = None      # review only

class SessionFrontierContext(BaseModel):
    """Session-level graph summary."""
    frontier_depth: int = 0
    max_depth: int = 0
    total_mastered: int = 0
    total_nodes: int = 0
    units_in_progress: List[UnitProgress] = []

class PulseSessionResponse(BaseModel):
    session_id: str
    student_id: int
    subject: str
    is_cold_start: bool
    items: List[PulseItemSpec]
    recent_primitives: List[RecentPrimitive] = []
    session_meta: Dict[str, Any]
    frontier_context: Optional[SessionFrontierContext] = None

class PulseResultRequest(BaseModel):
    item_id: str
    score: float = Field(ge=0, le=10)
    primitive_type: str
    eval_mode: str
    duration_ms: int = Field(ge=0)

class ThetaUpdate(BaseModel):
    skill_id: str
    old_theta: float
    new_theta: float
    sigma: Optional[float] = None
    earned_level: float

class GateUpdate(BaseModel):
    subskill_id: str
    old_gate: int
    new_gate: int
    skill_id: str = ""
    skill_description: str = ""

class IrtProbabilityData(BaseModel):
    p_correct: float
    item_information: float
    discrimination_a: float
    guessing_c: float = 0.0

class LeapfrogEvent(BaseModel):
    lesson_group_id: str
    probed_skills: List[str]
    inferred_skills: List[str]
    aggregate_score: float
    probed_details: List[SkillDetail] = []
    inferred_details: List[SkillDetail] = []

class PulseResultResponse(BaseModel):
    item_id: str
    theta_update: ThetaUpdate
    gate_update: Optional[GateUpdate] = None
    leapfrog: Optional[LeapfrogEvent] = None
    irt: Optional[IrtProbabilityData] = None
    gate_progress: Optional[Any] = None
    session_progress: Dict[str, Any]

class PulseSessionSummary(BaseModel):
    session_id: str
    subject: str
    is_cold_start: bool
    items_completed: int
    items_total: int
    duration_ms: int
    bands: Dict[str, PulseBandSummary]
    skills_advanced: List[GateUpdate]
    theta_changes: List[ThetaUpdate]
    leapfrogs: List[LeapfrogEvent]
    skill_progress: List[SkillUnlockProgress] = []
    frontier_expanded: bool
    celebration_message: str
    irt_summary: Optional[SessionIrtSummary] = None
```

---

## 8. API Endpoints

### 8.1 REST API

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| POST | `/api/pulse/sessions` | `{ subject: str }` | `PulseSessionResponse` | Assemble and return a new Pulse session |
| GET | `/api/pulse/sessions/{id}` | — | `PulseSessionResponse` | Get session state (for resume) |
| POST | `/api/pulse/sessions/{id}/result` | `PulseResultRequest` | `PulseResultResponse` | Submit one item result |
| GET | `/api/pulse/sessions/{id}/summary` | — | `PulseSessionSummary` | Get completed session summary |

All endpoints require Firebase authentication via `get_user_context` dependency.

### 8.2 Streaming Route (Frontend)

`POST /api/lumina/pulse-stream` — SSE streaming route for item hydration.

Takes `PulseItemSpec[]` from the backend session response and hydrates each item via Gemini, streaming results as they complete.

---

## 9. Frontend Architecture

### 9.1 Component Hierarchy

```
PulseSession (replaces PracticeModeEnhanced)
├── PulseWelcome
│   ├── Subject selector (card grid)
│   ├── Knowledge map preview (mini frontier visualization)
│   └── "Start Pulse" CTA
├── PulseActivity (one item at a time)
│   ├── Band indicator — contextual label
│   │   ├── Frontier: "Exploring new territory"
│   │   ├── Current:  "Building skills"
│   │   └── Review:   "Quick review"
│   ├── PracticeManifestRenderer (REUSED — visual primitives or KnowledgeCheck)
│   └── Progress bar (items completed / total, colored by band)
├── PulseLeapfrog (celebration overlay)
│   └── "You just jumped ahead 4 skills!" with animated knowledge map
└── PulseSummary
    ├── Session stats (items, duration, bands breakdown)
    ├── Skills advanced (gate changes)
    ├── EL trajectory chart (θ history sparklines)
    ├── Knowledge map delta (before/after frontier)
    ├── IRT session summary (σ reduction, predicted vs actual, avg information)
    ├── Skill progress bars (per-skill unlock progress)
    └── "Next Pulse" CTA
```

### 9.2 Session Hook: `usePulseSession`

```typescript
function usePulseSession(options: { gradeLevel: string }) {
  // State
  phase: 'ready' | 'loading' | 'practicing' | 'leapfrog' | 'summary'
  sessionId: string | null
  items: PulseItemSpec[]
  hydratedItems: HydratedPracticeItem[]
  currentItemIndex: number
  results: PulseResultResponse[]
  leapfrogs: LeapfrogEvent[]
  progress: { completed: number; total: number; bandsSummary: object }

  // Pre-generation cache (background hydration of next 2-3 items)
  pregenCache: Map<string, HydratedPracticeItem>

  // Actions
  startSession(subject: string): Promise<void>
  handleItemComplete(result: PracticeItemResult): Promise<void>
  handleNextItem(): void
  finishSession(): Promise<void>

  // Resume support
  resumeSession(sessionId: string): Promise<void>
}
```

### 9.3 Session-Aware Hydration (Primitive Diversity + Difficulty Calibration)

Each item is hydrated independently via Gemini. The session hook maintains a running history of completed primitives with scores and passes it as context to each subsequent hydration call.

**Session history record (per completed item):**
```typescript
{ componentId: string; difficulty: 'easy' | 'medium' | 'hard'; score: number }
```

Gemini sees: "Earlier in this session the student completed: ten-frame (easy, scored 92%), counting-board (medium, scored 64%). Vary primitives when possible, but repeating at a harder level is fine."

---

## 10. Backend Service Architecture

### 10.1 PulseEngine

```python
class PulseEngine:
    """
    Unified session assembly + result processing orchestrator.
    Composes existing services — does not replace them.
    """

    def __init__(
        self,
        firestore_service: FirestoreService,
        calibration_engine: CalibrationEngine,
        mastery_lifecycle_engine: MasteryLifecycleEngine,
        learning_paths_service: LearningPathsService,
    ):
        ...

    # Max-information mode selection
    @staticmethod
    def select_best_mode(theta, primitive_type) -> (mode, beta, eval_mode_name)

    # Session assembly
    async def assemble_session(student_id, subject, item_count=15) -> PulseSessionResponse
    def _assemble_cold_start(...) -> List[PulseItemSpec]
    async def _assemble_unified(...) -> List[PulseItemSpec]

    # Graph exploration
    def _bfs_forward(seed_ids, mastered_ids, all_edges, node_map) -> [(node_id, depth)]
    def _compute_frontier_context(...) -> SessionFrontierContext

    # Result processing
    async def process_result(student_id, session_id, result, ...) -> PulseResultResponse
    async def _check_leapfrog(...) -> Optional[LeapfrogEvent]

    # Deferred write helpers (for batch callers)
    async def save_deferred_session(session_id, session, student_id)
    async def flush_primitive_history(student_id, entries)
    async def flush_competency_writes(session)

    # Session queries
    async def get_session(session_id) -> dict
    async def get_session_summary(session_id) -> PulseSessionSummary
```

### 10.2 Service Interaction Diagram

```
PulseEngine.assemble_session()
    ├── FirestoreService.get_all_mastery_lifecycles()    → lifecycle state
    ├── FirestoreService.get_all_student_abilities()     → θ per skill
    ├── FirestoreService.get_pulse_primitive_history()   → recent primitives
    ├── LearningPathsService._get_graph()                → DAG nodes + edges
    ├── LearningPathsService.get_unlocked_entities()     → frontier computation
    ├── DAGAnalysisEngine.topological_sort()             → depth metrics
    ├── DAGAnalysisEngine.select_initial_probes()        → cold start only
    └── ProblemTypeRegistry (select_best_mode)           → max-info mode per item

PulseEngine.process_result()
    ├── CalibrationEngine.process_submission()            → update θ, β, σ, p, info
    ├── MasteryLifecycleEngine.process_eval_result()      → IRT-derived gate check
    ├── [If leapfrog]:
    │   ├── DAGAnalysisEngine.get_ancestors()             → find inferrable skills
    │   ├── FirestoreService.get_mastery_lifecycles_batch()→ filter already-active
    │   └── FirestoreService.update_competency() × N      → seed for unlock propagation
    ├── FirestoreService.update_competency()              → prerequisite propagation
    └── FirestoreService.save_pulse_session()             → update session doc
```

---

## 11. Key Parameters & Thresholds

| Parameter | Value | Source |
|-----------|-------|--------|
| Default session size | 15 items | `DEFAULT_PULSE_ITEM_COUNT` |
| Frontier max BFS depth | 5 jumps | `FRONTIER_MAX_JUMP` |
| Frontier probe mode | 3 (pictorial) | `FRONTIER_PROBE_MODE` |
| Frontier pass threshold | 7.5/10 avg | `FRONTIER_PASS_THRESHOLD` |
| Diversity cap per skill | 3 items | `MAX_CURRENT_ITEMS_PER_SKILL` |
| Primitive history window | configurable | `PRIMITIVE_HISTORY_WINDOW` |
| Default θ (new skill) | 3.0 | `DEFAULT_STUDENT_THETA` |
| Default σ (new skill) | 2.0 | `DEFAULT_THETA_SIGMA` |
| IRT correct threshold | 9.0 / 10 | `IRT_CORRECT_THRESHOLD` |
| **IRT Gate Thresholds** | | |
| Gate 1: P ≥ 0.70 at β_min, σ ≤ 1.5 | | `GATE_P_THRESHOLDS`, `GATE_SIGMA_THRESHOLDS` |
| Gate 2: P ≥ 0.75 at β_50%, σ ≤ 1.2 | | |
| Gate 3: P ≥ 0.80 at β_80%, σ ≤ 1.0 | | |
| Gate 4: P ≥ 0.90 at β_max, σ ≤ 0.8 | | |
| **Retention Model** | | |
| INITIAL_STABILITY | 3.0 days | First review surfaces after ~3 days |
| DECAY_RATE | 1.5 | Calibrated for P≈0.85 at t=S |
| TARGET_RETENTION | 0.85 | P(correct) threshold for review candidacy |
| THETA_DECAY_FLOOR_FACTOR | 0.5 | Never decay below 50% of tested θ |
| MASTERY_STABILITY_THRESHOLD | 30 days | Stability above this → mastered |
| Gate → stability mapping | {0:0, 1:3, 2:7.5, 3:18.75, 4:47} | `GATE_TO_STABILITY` |

---

## 12. Mastery Lifecycle — IRT-Derived Gate System

### 12.1 State Model

```
not_started ──IRT gate check──► active ──IRT gate advance──► mastered
                                  │
                                  └─ never blocks forward progress
                                     reviews surface by information value
```

| State | Meaning | Transition |
|-------|---------|------------|
| `not_started` | Student hasn't demonstrated competence | → `active` when `derive_gate_from_irt()` returns gate ≥ 1 (IRT path) |
| `active` | Initial mastery achieved; retention tracked | → `mastered` when `derive_gate_from_irt()` returns gate 4 |
| `mastered` | Long-term competence verified | Terminal (can regress if θ drops on future evidence) |

### 12.2 Lesson-Mode Handler (not_started → active)

When a lesson-mode eval arrives for a `not_started` subskill:

```python
def _handle_lesson_eval(self, lifecycle, score, ...):
    if lifecycle.retention_state != "not_started":
        return  # no effect on already-active skills

    if passed:
        lifecycle.lesson_eval_count += 1

    # IRT-derived gate check (primary path)
    if theta and sigma and min_beta and max_beta:
        irt_gate, irt_rs, irt_p = derive_gate_from_irt(theta, sigma, min_beta, max_beta)
        if irt_gate >= 1:
            _activate_retention(lifecycle, timestamp, theta, sigma)
    else:
        # No IRT data → no lifecycle effect (logged as warning)
        pass
```

**Key change from PRD v2.0:** The legacy "3 lesson evals ≥ 9.0" path is gone. Activation is now purely IRT-derived — `derive_gate_from_irt()` checks P(correct) at the easiest mode. If P ≥ 0.70 and σ ≤ 1.5, the student activates. This can happen on the very first eval if θ rises fast enough.

### 12.3 Practice-Mode Handler (active → mastered)

When a practice-mode eval arrives for an `active` or `mastered` subskill:

```python
def _handle_practice_eval(self, lifecycle, score, ...):
    if lifecycle.retention_state == "not_started":
        return  # need initial mastery first

    # Track pass/fail for actuarial completion
    if score >= 7.0:
        lifecycle.passes += 1
    else:
        lifecycle.fails += 1

    lifecycle.last_reviewed = timestamp
    lifecycle.review_count += 1

    # IRT-derived gate (primary path)
    if theta and sigma and primitive_type:
        irt_gate, irt_rs, irt_p = derive_gate_from_irt(theta, sigma, min_beta, max_beta)

        # Gate can only advance or hold — never regress on single eval
        if irt_gate >= lifecycle.current_gate:
            lifecycle.current_gate = irt_gate
            lifecycle.retention_state = irt_rs

        # Stability derived FROM gate (backward compat), not driving it
        lifecycle.stability = GATE_TO_STABILITY[lifecycle.current_gate]

    # Recalculate actuarial completion factor
    _recalculate_completion_factor(lifecycle, global_pass_rate)
```

**Key change from PRD v2.0:** No stability multipliers (×2.5/×1.5/×0.5) driving gate transitions. The IRT model IS the mastery signal. `derive_gate_from_irt()` checks θ+σ against probability thresholds at each gate's reference β. Stability is derived from the gate for backward-compat consumers, not the other way around.

### 12.4 Divergence Logging (Phase A)

After each eval, the engine compares what the IRT-derived gate says vs. what the stability-based system says, and logs divergences:

```
[MASTERY_DIVERGENCE] MATH-ADD-01-A: IRT says gate=3/state=active (P=0.823, σ=0.95),
  stability system says gate=2/state=active (stability=7.5). θ=6.20, score=9.0
```

This dual-track logging prepares for the eventual removal of stability-based state (Phase B).

### 12.5 Effective Theta — The Forgetting Function

At session assembly time, compute the **effective theta** for every active subskill to determine review urgency:

```python
def effective_theta(theta_tested: float, days_since_test: float, stability: float) -> float:
    """Power-law decay (√t) — matches Ebbinghaus forgetting curve."""
    if days_since_test <= 0 or stability <= 0:
        return theta_tested
    decay = DECAY_RATE * math.sqrt(days_since_test / stability)
    floor = max(DEFAULT_STUDENT_THETA, theta_tested * THETA_DECAY_FLOOR_FACTOR)
    return max(floor, theta_tested - decay)
```

This feeds into the unified selection: decayed θ → higher information → higher utility → selected as review. No separate review scheduler needed.

### 12.6 Actuarial Completion Factor

The completion factor uses credibility blending, computed after every practice eval:

```
Z = min(attempts / CREDIBILITY_STANDARD, 1.0)    # CREDIBILITY_STANDARD = 10
blended_rate = Z × subskill_rate + (1-Z) × global_rate
credit_per_pass = blended_rate × 0.25
completion_pct = gate_1_credit (0.25) + passes × credit_per_pass
```

For mastered subskills, completion is forced to 1.0. For not_started, gate_1_credit = 0.

### 12.7 Migration from Legacy Gates

Existing Firestore documents with gate values are lazily migrated via `derive_retention_state()`:

| Current Gate | New State | Stability | Rationale |
|-------------|-----------|-----------|-----------|
| 0 | `not_started` | 0.0 | Not yet mastered |
| 1 | `active` | 3.0 | Just cleared initial mastery |
| 2 | `active` | 7.5 | Survived one retest |
| 3 | `active` | 18.75 | Survived two retests |
| 4 | `mastered` | 47.0 | Fully verified |

No batch migration script needed — `derive_retention_state()` runs lazily on read when `retention_state` is not set.

---

## 13. Pulse Agent — Synthetic Student Test Harness

### 13.1 Purpose

The Pulse Agent runs synthetic students through multi-session journeys, calling PulseEngine directly (no HTTP layer, no auth) with isolated student IDs. It validates:
- Gate progression over time
- Leapfrog triggers and coverage
- Band distribution patterns
- Skill diversity across sessions
- IRT θ/σ evolution

### 13.2 Architecture

```
PulseAgentRunner (agent.py)
├── PulseEngine (direct call, no HTTP)
├── JourneyRecorder (journey_recorder.py)
│   ├── JourneyTimeline — full journey state
│   └── SessionSnapshot — per-session metrics
├── SyntheticProfile (profiles.py)
│   ├── student_id, name, archetype
│   ├── subject, items_per_session, target_sessions
│   └── ability_range, pass_threshold
├── ScoreStrategy (scenarios.py)
│   ├── ArchetypeStrategy — archetype-driven scoring
│   └── get_strategy(profile) → ScoreStrategy
└── Assertions (assertions.py)
    ├── check_gate_advance()
    ├── check_no_stagnation()
    ├── check_skill_diversity()
    └── check_leapfrog_triggers()
```

### 13.3 Virtual Clock

Each session advances by `session_gap_days` (default 1.0) to simulate realistic pacing. The virtual clock is passed to `assemble_session(now_override=)` and `process_result(now_override=)` so decay calculations use virtual time, not wall time.

### 13.4 Cleanup

`cleanup_student()` deletes ALL Firestore data for a synthetic student before re-running scenarios: mastery_lifecycle, abilities, pulse_state subcollections + pulse_sessions filtered by student_id.

---

## 14. LearningPathsService Integration

### 14.1 Role in Pulse

LearningPathsService provides the curriculum graph and prerequisite-based unlock logic that Pulse depends on:

| Method | Pulse Usage |
|--------|-------------|
| `_get_graph(subject)` | Load DAG nodes + edges (in-memory cached) |
| `get_unlocked_entities(student_id, "subskill", subject)` | Determine which skills the student can access |
| `recalculate_unlocks(student_id, subject)` | Refresh unlock state after leapfrog (deferred to session end) |

### 14.2 Unlock Determination

`get_unlocked_entities()` reads the curriculum graph and student proficiency map in real-time:

```
For each node in the graph:
  - If no prerequisite edges → always unlocked
  - If ALL prerequisites meet their thresholds → unlocked
  - Otherwise → locked
```

Only edges where `is_prerequisite=True` count. Non-prerequisite edges (parallel, reinforces, builds_on, applies) are used by PulseEngine's BFS for discovery but don't block unlocks.

### 14.3 Edge Types

The curriculum graph supports multiple edge types:

| Edge Type | `is_prerequisite` | Blocks Unlock | Pulse BFS Uses |
|-----------|-------------------|---------------|----------------|
| `prerequisite` | true | Yes | Yes |
| `parallel` | false | No | Yes (discovery) |
| `reinforces` | false | No | Yes (discovery) |
| `builds_on` | false | No | Yes (discovery) |
| `applies` | false | No | Yes (discovery) |

---

## 15. Implementation Phases

### Phase 1 — MVP (Complete, 2026-03-04)
- ✅ Core PulseEngine: assemble_session + process_result
- ✅ Cold start mode with DAG inference
- ✅ Leapfrog logic with ancestor walking
- ✅ Frontend: PulseSession, usePulseSession, types, API client
- ✅ Replaced PracticeModeEnhanced in App.tsx

### Phase 2 — Polish (Complete, 2026-03-05)
- ✅ LessonGroupService integration with Bloom's sorting
- ✅ Session resume (localStorage + backend fetch)
- ✅ Adaptive band proportions (surplus redistribution)
- ✅ Leapfrog celebration (framer-motion animations)
- ✅ EL trajectory visualization (ThetaGrowthSection)
- ✅ Frontier delta section (gate advances + leapfrog breakdown)
- ✅ Session-aware hydration (primitive diversity via Gemini context)

### Phase 3 — Retention Model (Complete, 2026-03-22)
- ✅ Stability-based forgetting model (effective_theta, decay function)
- ✅ Replaced Gates 1-4 with retention_state + stability
- ✅ Information-value review scheduling (P < 0.85 → review candidate)
- ✅ Trivial-item filter (P > 0.95 → skip)
- ✅ Lazy migration from legacy gates (derive_retention_state)
- ✅ Updated forecasting to stability-based projections

### Phase 4 — 2PL/3PL IRT + Probability Gates (Complete, 2026-03-23)
- ✅ CalibrationEngine upgraded to 2PL/3PL model
- ✅ ProblemTypeRegistry with per-primitive a, c parameters
- ✅ Gate thresholds computed via P(correct) at reference β levels
- ✅ CalibrationSimulator.tsx validated model

### Phase 5 — Curriculum Knowledge Graph (Complete, 2026-03-24)
- ✅ Multi-edge-type graph (prerequisite, parallel, reinforces, builds_on, applies)
- ✅ LearningPathsService supports non-prerequisite edges
- ✅ DAGAnalysisEngine for topological analysis

### Phase 6 — Unified Item Selection (Complete, 2026-03-26)
- ✅ Replaced 3-band allocation with unified utility function
- ✅ `utility = information × urgency` ranking
- ✅ Band labels derived from state (emergent, not enforced)
- ✅ BFS traverses all edge types for broader discovery
- ✅ MAX_CURRENT_ITEMS_PER_SKILL diversity cap

### Phase 7 — IRT-Derived Gates + Lightweight Leapfrog (Complete, 2026-03-27)
- ✅ `derive_gate_from_irt()` — gates derived directly from θ+σ
- ✅ Practice evals use IRT-derived gate (no stability multipliers)
- ✅ Lesson evals use IRT gate check (no 3-eval count requirement)
- ✅ Gate can only advance or hold, never regress on single eval
- ✅ Leapfrog seeds only competency docs (credibility=0.1)
- ✅ No fabricated θ/σ/lifecycle/ability — unified selector handles naturally
- ✅ Session-level leapfrog deduplication
- ✅ Deferred write optimization (batch Firestore round-trips)
- ✅ Divergence logging (IRT vs stability comparison)
- ✅ Pulse Agent test harness with virtual clock

### Future
- [ ] Primitive coverage mastery (§9.5 from v2.0 — breadth → accelerated activation)
- [ ] Difficulty slider (student agency)
- [ ] Cross-skill leapfrog (high θ downstream → infer prerequisites)
- [ ] Parent dashboard integration
- [ ] Session length adaptation
- [ ] Phase B: Remove stability-based state entirely (IRT-derived gate is sole authority)
- [ ] Phase C: Per-item σ tracking (currently per-skill)

---

## 16. Testability Requirement — In-Memory Execution

### 16.1 The Problem

Pulse sessions hit Firestore ~120 times per 15-item session. With network latency, a single session takes 10-30 seconds. Running the Pulse Agent (5 archetypes × 15 sessions = 75 sessions) takes 15-30 minutes. This makes iterative development on selection algorithms, gate thresholds, and retention parameters impractical.

### 16.2 The Solution: InMemoryFirestoreService

`backend/tests/pulse_agent/in_memory_firestore.py` provides a drop-in replacement for FirestoreService that stores everything in Python dicts. Zero network calls.

**Performance (measured):**

| Metric | Firestore | In-Memory | Speedup |
|--------|-----------|-----------|---------|
| Single 15-item session | 10-30s | **31ms** | ~500x |
| Per item (process_result) | 200-600ms | **2.9ms** | ~150x |
| 60 sessions (3 students × 20 sessions) | ~20 min | **2.6s** | ~500x |
| Full agent suite (5 archetypes × 15 sessions) | ~25 min | **~3s** (projected) | ~500x |

### 16.3 Usage

```bash
# Fetch graph once from Firestore, then run everything in-memory
python -m tests.pulse_agent.run_scenarios --profile gifted --sessions 15 --in-memory

# Run all archetypes (< 5 seconds total)
python -m tests.pulse_agent.run_scenarios --all --in-memory

# Still works with real Firestore (default, for production validation)
python -m tests.pulse_agent.run_scenarios --profile gifted --sessions 5
```

### 16.4 Architecture

```python
# One-time bootstrap: fetch curriculum graph from real Firestore
pulse_engine, mem_fs = await build_engine_in_memory("Mathematics")

# From here on, 0 network calls:
session = await pulse_engine.assemble_session(student_id=1, subject="Mathematics")
for item in session.items:
    await pulse_engine.process_result(student_id=1, session_id=..., result=...)

# Stats tracking for debugging:
print(mem_fs.stats)  # {'reads': 54, 'writes': 63}

# Clean slate between runs:
mem_fs.clear_student(1)  # or mem_fs.clear_all()
```

All services (PulseEngine, CalibrationEngine, MasteryLifecycleEngine, LearningPathsService) take `firestore_service` as a constructor arg — the in-memory implementation is injected without any code changes to the services.

### 16.5 Baseline Requirement

> A 15-item synthetic session MUST complete in < 200ms in test mode (in-memory storage). The Pulse Agent MUST be able to run 100 sessions across 5 archetypes in < 30 seconds. This enables rapid iteration on selection algorithms, gate thresholds, and retention parameters.

Current performance exceeds this requirement by ~5x.

### 16.6 What It Enables

- **Rapid algorithm iteration:** Change `derive_gate_from_irt()` thresholds, re-run 75 sessions in 3 seconds, see the impact
- **Regression detection:** Run full suite on every commit — if Grace stagnates or Sam never advances, catch it immediately
- **Parameter sweeps:** Test DECAY_RATE values 0.5-3.0 in 10 steps × 5 archetypes = 50 runs = ~25 seconds
- **Divergence analysis:** The MASTERY_DIVERGENCE logs (IRT vs stability) are now cheap to generate at scale

---

## 17. Success Metrics

| Metric | Original | Target | How Measured |
|--------|---------|--------|--------------|
| Skills advanced per session | ~1 (sequential) | 3-5 (with leapfrogs) | Gate changes per pulse_session |
| Completion velocity (% per hour) | ~23% per hour | ~60% per hour | mastery_lifecycle gate changes / time |
| Time to first mastery (Gate 4) | ~4 weeks per skill | ~1-2 weeks per skill | Gate 4 timestamp - Gate 0 timestamp |
| Trivial item ratio | 48% (Gifted Grace pre-fix) | < 5% | Items with P > 0.95 served |
| Session information density | Low (P≈0.99 items) | High (P≈0.5-0.8 items) | avg Fisher information per session |
| Leapfrog rate | N/A | 15-25% of frontier probes | leapfrogs / frontier items probed |

---

## Appendix A: Existing Service Interfaces Used

### CalibrationEngine
```python
async def process_submission(
    student_id: int, skill_id: str, subskill_id: str,
    primitive_type: str, eval_mode: str, score: float,
    source: str = "practice",
    prefetched_ability: Optional[Dict] = None,
    prefetched_item_calibration: Optional[Dict] = None,
) -> Dict[str, Any]
# Returns: { item_key, calibrated_beta, student_theta, sigma, earned_level,
#            p_correct, item_information, discrimination_a, guessing_c,
#            ability_doc, item_calibration_doc, gate_progress }
```

### MasteryLifecycleEngine
```python
async def process_eval_result(
    student_id: int, subskill_id: str, subject: str, skill_id: str,
    score: float, source: Literal["lesson", "practice"],
    timestamp: Optional[str] = None,
    *,
    prefetched_lifecycle: Optional[Dict] = None,
    prefetched_ability: Optional[Dict] = None,
    prefetched_global_pass_rate: Optional[float] = None,
    theta: Optional[float] = None,
    sigma: Optional[float] = None,
    primitive_type: Optional[str] = None,
    avg_a: Optional[float] = None,
) -> Dict[str, Any]
# Returns: updated MasteryLifecycle dict

# Pure functions (module-level, used by PulseEngine directly):
def effective_theta(theta_tested, days_since_test, stability) -> float
def derive_retention_state(lifecycle_dict) -> (retention_state, stability)
def derive_gate_from_irt(theta, sigma, min_beta, max_beta, avg_a) -> (gate, state, p)
```

### LearningPathsService
```python
async def _get_graph(subject_id: str, version_type: str = "published") -> Dict[str, Any]
# Returns: { graph: { nodes: [...], edges: [...] }, version_id: ... }

async def get_unlocked_entities(student_id: int, entity_type?: str, subject?: str) -> Set[str]
# Returns: set of unlocked skill/subskill IDs

async def recalculate_unlocks(student_id: int, subject_id: str) -> None

async def get_related_entities(entity_id: str, subject: str) -> List[Dict]
# Returns: edge metadata for all connections to entity_id
```

### DAGAnalysisEngine
```python
@staticmethod
def topological_sort(nodes, edges) -> List[str]
@staticmethod
def compute_node_metrics(nodes, edges, topo_order) -> Dict[str, NodeMetrics]
@staticmethod
def select_initial_probes(metrics, nodes, edges, max_probes) -> List[ProbeCandidate]
@staticmethod
def get_ancestors(node_id, edges) -> Set[str]
```

### ProblemTypeRegistry
```python
PROBLEM_TYPE_REGISTRY: Dict[str, Dict[str, EvalModeConfig]]
# primitive_type → { eval_mode_name → EvalModeConfig(prior_beta, a, c) }

def get_item_discrimination(primitive_type: str, eval_mode: str) -> (a, c)
def get_item_key(primitive_type: str, eval_mode: str) -> str
def get_primitive_beta_range(primitive_type: str) -> (min_beta, max_beta)
def get_prior_beta(primitive_type: str, eval_mode: str) -> float
```

---

## Appendix B: Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-04 | 1.0 | Initial PRD — design complete |
| 2026-03-05 | 1.1 | Phase 1 MVP implemented end-to-end |
| 2026-03-05 | 1.2 | Phase 2: LessonGroupService, session resume, adaptive band proportions |
| 2026-03-05 | 1.3 | Phase 2 UI: leapfrog celebration, theta growth, frontier delta |
| 2026-03-05 | 1.4 | Session-aware hydration (§9.4), primitive coverage mastery (§9.5) |
| 2026-03-22 | 2.0 | Retention model redesign — replaced Gates 1-4 with stability-based forgetting |
| 2026-03-22 | 2.1 | §16 implemented — effective_theta, derive_retention_state, stability lifecycle |
| 2026-03-27 | 3.0 | **Major PRD rewrite to match implementation.** Added §16 Testability Requirement with InMemoryFirestoreService (500x speedup: 31ms/session vs 10-30s). |
| 2026-03-27 | 3.0 | **Architecture changes documented:** Key changes: (1) §2 rewritten — unified utility-based item selection replaces 3-band allocation; band labels are emergent from state, not enforced allocation targets. (2) §3.1 rewritten — max-Fisher-information mode selection via ProblemTypeRegistry replaces static θ→mode table. (3) §3.3 rewritten — leapfrog seeds only competency docs (credibility=0.1), no fabricated lifecycle/ability/θ/σ; unified selector handles naturally via high Fisher information. (4) §3.4 new — IRT-derived gate system: `derive_gate_from_irt()` checks P(correct) at reference βs per gate; gates can only advance, never regress on single eval. (5) §5 rewritten — assembly algorithm now `_assemble_unified()` with BFS across all edge types, midpoint-proximity sorting. (6) §6 rewritten — eval source simplified to gate-only check; deferred write optimization documented. (7) §12 new — comprehensive mastery lifecycle section: IRT-derived practice handler (no stability multipliers), IRT-derived lesson handler (no 3-eval count), divergence logging, actuarial completion factor. (8) §13 new — Pulse Agent test harness. (9) §14 new — LearningPathsService integration details. (10) Removed obsolete sections: stability multiplier tables (×2.5/×1.5/×0.5 no longer drive gates), fixed band allocation tables, LessonGroupService grouper (replaced by utility ranking), primitive coverage mastery (not yet implemented). |
