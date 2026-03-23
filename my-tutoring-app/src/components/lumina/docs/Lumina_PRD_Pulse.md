# Lumina Pulse — Adaptive Learning Loop

**Version:** 2.0
**Date:** 2026-03-22
**Status:** Phase 2 Polish + Retention Model Redesign

---

## 1. Problem Statement

### 1.1 The Velocity Problem

The current system produces a linear experience where a student who completes one problem set advances ~2.3% through the knowledge graph in ~6 minutes. At this rate, full coverage of 674 K-level subskills requires ~290 problem sets or ~29 hours of pure problem-solving time — before accounting for the 4-gate retest cycle that multiplies each skill by 4x.

The root cause: three nearly independent systems control a student's time, and none of them allow for acceleration.

| System | Purpose | Limitation |
|--------|---------|------------|
| Diagnostic Placement | One-time onboarding, binary-search the DAG | Only runs once; no continuous probing |
| Daily Learning Planner | Sequential lesson groups, 75-min daily budget | 100% of time is scheduled; no room for stretch |
| Difficulty Calibration (IRT) | Continuous θ/β estimation | Parallel system — θ doesn't drive gates or planning |

A student who already understands addition cannot skip to multiplication. They must complete every lesson, pass 3 evals at ≥9.0, wait for 3-day/7-day/14-day retests, and only then does the planner move forward. There is no mechanism for a student who "gets it" to vault ahead.

### 1.2 The Fragmentation Problem

Three frontend components (`DiagnosticSession`, `PlannerDashboard`, `PracticeModeEnhanced`) each have separate item selection logic, separate session management, and separate result pipelines. The lesson grouper for daily learning differs from practice mode's item selection, creating divergent student experiences for what should be the same underlying activity.

### 1.3 The Vision

**Practice becomes learning.** Every session is simultaneously diagnosis, instruction, and assessment. Students can jump 1-5 skills ahead on the knowledge graph. If they succeed, DAG inference triggers massive skips. If they fail, the system calibrates them to the right difficulty and provides scaffolded instruction. Spaced repetition handles the trailing edge automatically.

One component. One grouper. One loop.

---

## 2. Core Architecture — The Three-Band Model

Every Pulse session assembles items from three bands:

```
┌─────────────────────────────────────────────────────────┐
│                    PULSE SESSION                         │
│                                                          │
│   FRONTIER PROBES  (20%)  ← DAG walk 1-5 jumps ahead    │
│   CURRENT WORK     (65%)  ← IRT β ≈ θ+0.5, frontier     │
│   TRAILING REVIEW  (15%)  ← spaced rep, retests due      │
│                                                          │
│   All items use calibrated β → all update θ → all can    │
│   trigger gate transitions                               │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Frontier Probes (20% of session, ~3 items)

**Purpose:** Force multiplier. Test skills 1-5 DAG edges ahead of the student's current frontier — skills they have NOT been taught.

**Selection:** BFS walk from frontier nodes along DAG descendant edges. Skip already-mastered or already-in-frontier nodes. Pick 1-2 lesson groups from the ahead-of-frontier pool.

**Mode:** Fixed at mode 3 (pictorial, reduced prompts, β ≈ 3.5). Enough scaffolding to give a fair test, not so much that it's trivial.

**On pass (≥75% aggregate across lesson group):**
- Run DAG inference: all ancestor skills between probed node and current frontier → INFERRED_MASTERED
- Seed mastery_lifecycle for each inferred skill: Gate 2, completion_pct = 0.5, next_retest_eligible = now + 3 days
- Seed ability θ = 7.0 for each inferred skill (same conservative estimate as diagnostic inference)
- Refresh frontier via `LearningPathsService.recalculate_unlocks()`
- One 6-minute frontier probe can skip 5+ skills = weeks of lesson time saved

**On fail:** No penalty. θ was already at default (3.0) for untaught skills. The system simply learned where the student's ceiling is. Calibrate β for the probed items and move on.

### 2.2 Current Work (65% of session, ~9-10 items)

**Purpose:** Core learning at the zone of proximal development. This IS the lesson — scaffolding comes from mode selection, not a separate "lesson" flow.

**Selection:** Frontier skills (Gate 0 unlocked but not started, or Gate 1 still accumulating lesson evals). Grouped via `LessonGroupService.group_subskills_into_blocks()`.

**Mode:** Derived from student's θ per subskill (see §3.1 θ→Mode Mapping). Low θ → low modes with full scaffolding (concrete manipulatives). High θ → symbolic multi-step.

**Gate processing:** Gate 0 items → source="lesson" (needs 3 evals ≥ 9.0 for Gate 1 advancement). Gate 1+ items → source="practice" (retest logic).

### 2.3 Trailing Review (15% of session, ~2-3 items)

**Purpose:** Spaced repetition for retention. Ensure previously-learned skills don't decay.

**Selection:** For all subskills in `retention_state="active"`, compute `effective_theta` using the stability-based forgetting model (see §16.3). Items whose predicted P(correct) drops below `TARGET_RETENTION` (0.85) become review candidates. Sort by information value descending — most informative reviews first. Group via `LessonGroupService`.

**Mode:** Derived from effective_θ (accounts for time-based decay — a skill last reviewed 7 days ago may warrant a lower mode than its tested θ suggests).

**Retention processing:** On review completion, update stability: strong recall (≥9.0) → S×2.5, partial (≥7.0) → S×1.5, fail (<7.0) → S×0.5. When stability exceeds 30 days → `mastered` (no further reviews). See §16.4.

### 2.4 Unified Grouper

The same `LessonGroupService.group_subskills_into_blocks()` drives all three bands. The grouper clusters 2-5 related subskills by (subject, unit_title, skill_description), sorts by Bloom's taxonomy (Identify → Explain → Apply), and assigns block type + duration.

What was previously three separate concepts:
- **"Lesson"** = Current Work at low θ (mode 1-2, full scaffolding)
- **"Practice"** = Current Work at rising θ (mode 3-4, reduced scaffolding)
- **"Retest"** = Trailing Review at high θ (mode 5-6, symbolic)

All use the same grouper. The only variable is the mode, which is determined by θ.

---

## 3. IRT Integration

### 3.1 θ → Mode Mapping

Student ability (θ) determines the scaffolding mode for each item:

| θ Range | Mode | Description | Prior β |
|---------|------|-------------|---------|
| θ < 2.0 | 1 | Concrete manipulatives, full visual + haptic guidance | 1.5 |
| 2.0 ≤ θ < 3.0 | 2 | Pictorial with prompts | 2.5 |
| 3.0 ≤ θ < 4.5 | 3 | Pictorial, reduced prompts | 3.5 |
| 4.5 ≤ θ < 6.0 | 4 | Mixed symbolic/pictorial, transitional | 5.0 |
| 6.0 ≤ θ < 7.5 | 5 | Fully symbolic, single operation | 6.5 |
| θ ≥ 7.5 | 6 | Symbolic, multi-step / cross-concept | 8.0 |

Default θ for new skills: 3.0 (mode 3). Default σ: 2.0.

### 3.2 Per-Item IRT Update Cycle

Every item result triggers the full IRT update:

1. **β update** (item difficulty): `CalibrationEngine._update_item_beta()` — 1PL MLE with credibility blending (Z = min(1, sqrt(n/200)))
2. **θ update** (student ability): `CalibrationEngine._update_student_theta()` — Bayesian grid-approximation EAP over θ ∈ [0, 10] with 0.1 step
3. **EL update**: Earned Level = round(θ, 1), displayed to student as 0.0-10.0 trajectory

Score threshold: score ≥ 9.0 on 0-10 scale → "correct" for IRT purposes.

### 3.3 Leapfrog Logic

Leapfrog triggers when a frontier probe lesson group passes:

```
Condition:
  - Band = FRONTIER
  - All items in the lesson group have been scored
  - Aggregate score ≥ 75% (i.e., ≥ 7.5 on 0-10 scale average)

Action:
  For each ancestor skill between probed node and current frontier:
    1. mastery_lifecycle → retention_state="active",
       stability=INITIAL_STABILITY (3.0 days), last_reviewed=now,
       lesson_eval_count=3, review_count=0
    2. ability → θ = 7.0, σ = 1.5, prior_source = "pulse_leapfrog"

  Then: recalculate_unlocks(student_id, subject)
```

The conservative bias matches diagnostic placement: inferred mastery enters the stability-based retention model with S=3.0 days — the same initial interval. The forgetting model will naturally surface these for review after ~3 days without blocking forward progress. If the inference was wrong, the review will fail, stability halves to 1.5 days, and a follow-up review surfaces quickly.

### 3.4 Per-Primitive Gate Thresholds

Each primitive has a different difficulty ceiling determined by its available evaluation modes (beta range). Gate thresholds are computed per-primitive using a proportional formula with a minimum spread floor. This ensures:

1. Easy primitives (Sorting Station β=1.5, Counting Board β=1.0–2.5) require ~5-8 correct answers for mastery, not 2-3.
2. Hard primitives (Ten Frame β=1.5–5.0, Area Model β=5.0) require proportionally more (~10-20 correct answers).
3. Gates are always monotonically increasing, even for single-mode primitives.

```
MIN_GATE_SPREAD = 2.5

spread = max(MIN_GATE_SPREAD, maxBeta + 1.0 - minBeta)
G1 = minBeta + spread × 0.20
G2 = minBeta + spread × 0.45
G3 = minBeta + spread × 0.75
G4 = minBeta + spread × 1.00
```

**This directly influences session assembly:** primitives with low beta ceilings (Counting Board G4=3.5) are naturally selected for students with low θ, while primitives with high ceilings (Ten Frame G4=6.0) are selected for students with higher θ. The gate threshold formula and the θ→mode mapping (§3.1) use the same underlying beta values, keeping difficulty selection and mastery assessment aligned.

See `lumina_difficulty_calibration_prd.md` §6.5.4 for the full per-primitive gate table, IRT ceiling effect analysis, and calibration simulator details.

---

## 4. Cold Start — First Session as Mini-Diagnostic

When a student has no mastery_lifecycle docs for a subject, Pulse enters **cold start mode**:

- **100% frontier probes** — no current work or reviews (nothing to review yet)
- **Probe selection:** Same topological midpoint strategy as DiagnosticService — select nodes at median depth of longest DAG chains
- **DAG inference on results:** Pass → ancestors INFERRED_MASTERED, Fail → descendants INFERRED_NOT_MASTERED
- **Coverage target:** After first session (~15 items), expect 40-60% of DAG classified via inference
- **Transition:** After first session completes and mastery docs are seeded, subsequent sessions use normal 3-band assembly

This eliminates the need for a separate diagnostic onboarding flow. The first Pulse session IS the diagnostic. Subsequent sessions are seamless — the bands gradually shift from mostly frontier probes (early sessions, still mapping the graph) to mostly current work (later sessions, settled frontier).

---

## 5. Session Assembly Algorithm

### 5.1 `assemble_session(student_id, subject, item_count=15)`

```
1. LOAD STUDENT STATE
   - mastery_lifecycle docs for subject → Dict[subskill_id, lifecycle]
   - ability docs for subject → Dict[skill_id, ability]
   - DAG graph → nodes[], edges[]

2. COLD START CHECK
   - If len(mastery_lifecycle_docs) == 0 → cold_start_mode
   - Select topological midpoints as probes (see §4)
   - Return all items as band=FRONTIER

3. COMPUTE FRONTIER
   - unlocked = LearningPathsService.get_unlocked_entities(student_id, subject)
   - gate_0 = { id for id, lc in lifecycles if lc.current_gate == 0 }
   - frontier = unlocked ∩ gate_0
   - If frontier is empty and gate_0 is empty:
       all mastered → enrichment mode (stretch only)

4. SELECT REVIEW ITEMS (15%) — stability-based (§16)
   - For each lifecycle with retention_state="active":
       compute effective_theta(θ_tested, days_since_last_review, stability)
       compute P(correct) and information from effective_theta
   - review_due = [lc where P(correct|effective_θ) < TARGET_RETENTION (0.85)]
   - Sort by: information value DESC (most informative first)
   - Take top ceil(item_count * 0.15) subskills
   - Group via LessonGroupService
   - Set mode per subskill: effective_θ → mode mapping

5. SELECT CURRENT ITEMS (65%)
   - candidates = unlocked subskills with retention_state="not_started"
                  or "active" with lesson_eval_count < 3
   - Filter out trivial items: skip if P(correct|θ) > 0.95 (§16.6B)
   - Group via LessonGroupService with type="new"
   - Set mode per subskill: θ→mode mapping
   - Take enough to fill ceil(item_count * 0.65)

6. SELECT FRONTIER PROBE ITEMS (20%)
   - BFS from frontier along descendant edges, depth 1-5
   - Skip nodes already mastered (gate ≥ 1) or in frontier
   - Collect candidate probe nodes
   - Group via LessonGroupService
   - Set mode = 3 (mid-range probe)
   - Take 1-2 lesson groups, ceil(item_count * 0.20) items

7. INTERLEAVE
   - Pattern: current → probe → current → current → review → current → probe → ...
   - Front-load current work (highest attention)
   - Space frontier probes evenly
   - Trailing reviews toward middle/end

8. PERSIST
   - Generate session_id (uuid)
   - Save to Firestore: pulse_sessions/{session_id}
   - Return PulseSessionResponse
```

### 5.2 Band Allocation Flexibility

The 20/65/15 split is a target, not a hard constraint:

| Scenario | Frontier | Current | Review |
|----------|----------|---------|--------|
| Normal session | 20% | 65% | 15% |
| Cold start (no mastery docs) | 100% | 0% | 0% |
| Early sessions (sparse frontier) | 40% | 50% | 10% |
| All reviews overdue | 10% | 40% | 50% |
| Near full mastery | 50% | 10% | 40% |

The engine adjusts proportions based on available candidates per band. If fewer than 2 review items are due, those slots go to current work. If the frontier has few unlocked skills, more slots go to frontier probes.

---

## 6. Result Processing

### 6.1 `process_result(student_id, session_id, result)`

Per-item processing pipeline:

```
1. LOAD SESSION
   - Fetch pulse_sessions/{session_id}
   - Find item spec by result.item_id
   - Validate item not already scored

2. IRT UPDATE
   - CalibrationEngine.process_submission(
       student_id, skill_id, subskill_id,
       result.primitive_type, result.eval_mode, result.score
     )
   - Returns: { calibrated_beta, student_theta, earned_level }

3. RETENTION UPDATE (replaces gate transitions — see §16.7)
   - If retention_state == "not_started" AND band == CURRENT:
       process as lesson eval (increment lesson_eval_count)
       if lesson_eval_count >= 3 and all scores >= 9.0:
         transition to retention_state="active"
         set stability = INITIAL_STABILITY (3.0 days)
         set last_reviewed = now
   - If retention_state == "active":
       update stability based on score:
         score >= 9.0 → stability *= 2.5
         score >= 7.0 → stability *= 1.5
         score < 7.0  → stability *= 0.5
       set last_reviewed = now
       if stability > MASTERY_STABILITY_THRESHOLD (30 days):
         transition to retention_state="mastered"

4. LEAPFROG CHECK (frontier band only)
   - If item.band == FRONTIER:
       - Record item score in session doc
       - Check: all items in this lesson group scored?
       - If yes AND aggregate ≥ 75%:
           - Walk DAG upstream from probed nodes
           - Collect ancestor skills not yet mastered
           - For each: seed mastery_lifecycle with
               retention_state="active", stability=3.0, last_reviewed=now
             + ability (θ=7.0)
           - recalculate_unlocks(student_id, subject)
           - Return leapfrog event

5. UPDATE SESSION DOC
   - Mark item completed with score, timestamp
   - Increment progress counters
   - Check if session complete (all items scored)

6. RETURN PulseResultResponse
   - theta_update: { skill_id, old_theta, new_theta, earned_level }
   - gate_update: { subskill_id, old_gate, new_gate } or null
   - leapfrog: { skills_advanced, inferences } or null
   - session_progress: { items_completed, items_total, bands_summary }
```

### 6.2 Eval Classification

```python
def _classify_eval(band: PulseBand, retention_state: str) -> str:
    """Classify evaluation for retention processing."""
    if band == PulseBand.REVIEW:
        return "review"         # stability update (§16.4)
    if band == PulseBand.FRONTIER:
        return "probe"          # leapfrog logic handles separately
    # CURRENT band:
    if retention_state == "not_started":
        return "lesson"         # counts toward initial mastery (3 evals ≥ 9.0)
    return "review"             # active subskill → stability update
```

---

## 7. Data Models

### 7.1 Firestore Schema

**New collection:**
```
pulse_sessions/{session_id}
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

      # Populated after completion:
      score: float | null (0-10)
      primitive_type: str | null
      eval_mode: str | null
      duration_ms: int | null
      completed_at: str | null
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
      timestamp: str
    }
  ]

  created_at: str
  updated_at: str
  completed_at: str | null
}
```

**Existing collections used (modified for retention model):**
- `students/{id}/mastery_lifecycle/{subskill_id}` — retention tracking (replaces gate transitions)
  - **New fields:**
    - `retention_state`: `"not_started" | "active" | "mastered"` (replaces `current_gate` 0-4)
    - `stability`: `float` — memory strength in days (grows with successful reviews)
    - `last_reviewed`: `str (ISO datetime)` — timestamp of last assessment
    - `review_count`: `int` — number of successful reviews completed
  - **Deprecated fields** (kept for migration, not used in new logic):
    - `current_gate` — superseded by `retention_state`
    - `next_retest_eligible` — superseded by stability-based scheduling
    - `retest_interval_days` — superseded by `stability`
- `students/{id}/ability/{skill_id}` — θ, σ, earned_level, theta_history
- `item_calibration/{primitive_type}_{eval_mode}` — calibrated β
- `curriculum_graphs/{subject}/published` — DAG nodes + edges

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

class CreatePulseSessionRequest(BaseModel):
    subject: str

class PulseSessionResponse(BaseModel):
    session_id: str
    student_id: int
    subject: str
    is_cold_start: bool
    items: List[PulseItemSpec]
    session_meta: Dict[str, Any]

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
    earned_level: float

class GateUpdate(BaseModel):
    subskill_id: str
    old_gate: int
    new_gate: int

class LeapfrogEvent(BaseModel):
    lesson_group_id: str
    probed_skills: List[str]
    inferred_skills: List[str]
    aggregate_score: float

class PulseResultResponse(BaseModel):
    item_id: str
    theta_update: ThetaUpdate
    gate_update: Optional[GateUpdate] = None
    leapfrog: Optional[LeapfrogEvent] = None
    session_progress: Dict[str, Any]

class PulseSessionSummary(BaseModel):
    session_id: str
    subject: str
    is_cold_start: bool
    items_completed: int
    items_total: int
    duration_ms: int
    bands: Dict[str, Dict[str, Any]]
    skills_advanced: List[GateUpdate]
    theta_changes: List[ThetaUpdate]
    leapfrogs: List[LeapfrogEvent]
    frontier_expanded: bool
    celebration_message: str
```

### 7.3 Frontend TypeScript Types

Mirror the backend models in `my-tutoring-app/src/components/lumina/pulse/types.ts`:

```typescript
type PulseBand = 'frontier' | 'current' | 'review'

interface PulseItemSpec {
  item_id: string
  band: PulseBand
  subskill_id: string
  skill_id: string
  subject: string
  description: string
  target_mode: number          // 1-6
  target_beta: number
  lesson_group_id: string
  primitive_affinity?: string
}

interface PulseSessionResponse {
  session_id: string
  student_id: number
  subject: string
  is_cold_start: boolean
  items: PulseItemSpec[]
  session_meta: Record<string, unknown>
}

interface PulseResultRequest {
  item_id: string
  score: number                // 0-10
  primitive_type: string
  eval_mode: string
  duration_ms: number
}

interface PulseResultResponse {
  item_id: string
  theta_update: { skill_id: string; old_theta: number; new_theta: number; earned_level: number }
  gate_update?: { subskill_id: string; old_gate: number; new_gate: number }
  leapfrog?: { lesson_group_id: string; probed_skills: string[]; inferred_skills: string[]; aggregate_score: number }
  session_progress: { items_completed: number; items_total: number; bands_summary: Record<string, unknown> }
}

interface PulseSessionSummary {
  session_id: string
  subject: string
  is_cold_start: boolean
  items_completed: number
  duration_ms: number
  bands: Record<string, unknown>
  skills_advanced: Array<{ subskill_id: string; old_gate: number; new_gate: number }>
  theta_changes: Array<{ skill_id: string; old_theta: number; new_theta: number; earned_level: number }>
  leapfrogs: Array<{ probed_skills: string[]; inferred_skills: string[] }>
  frontier_expanded: boolean
  celebration_message: string
}
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

Takes `PulseItemSpec[]` from the backend session response and hydrates each item via Gemini, streaming results as they complete. The key difference from `practice-stream`: items already have `target_mode` and `subskill_id` from the backend, so the manifest is pre-determined — only content generation (hydration) is needed.

Event stream format:
```json
{ "type": "progress", "message": "Preparing 15 practice items..." }
{ "type": "item", "index": 0, "total": 15, "item": { /* HydratedPracticeItem */ } }
{ "type": "item", "index": 1, "total": 15, "item": { /* HydratedPracticeItem */ } }
...
{ "type": "complete", "items": [ /* all HydratedPracticeItem[] */ ] }
```

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
    └── "Next Pulse" CTA
```

### 9.2 Session Hook: `usePulseSession`

Follows `useDiagnosticSession` pattern:

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

**Pre-generation:** While the student works on item N, items N+1 and N+2 are hydrated in the background via Gemini. This eliminates loading gaps between items. Same pattern proven in `useDiagnosticSession`.

**Leapfrog interruption:** When `process_result` returns a leapfrog event, the hook transitions to phase='leapfrog' briefly (2-3 seconds celebration) before resuming to the next item.

### 9.3 Item Hydration Flow

```
Backend: assemble_session() → PulseItemSpec[] (what to test, at what mode)
    ↓
Frontend: usePulseSession receives item specs
    ↓
Frontend: POST /api/lumina/pulse-stream with item specs
    ↓
Streaming route: For each PulseItemSpec:
    ├── Map target_mode + description → Gemini prompt
    ├── generateComponentContent(primitiveType, description, gradeLevel, { mode })
    └── Stream HydratedPracticeItem back
    ↓
Frontend: PracticeManifestRenderer renders each hydrated item
    ↓
Primitive: onEvaluationSubmit(PrimitiveEvaluationResult)
    ↓
Frontend: POST /api/pulse/sessions/{id}/result
    ↓
Backend: process_result() → θ update, gate update, leapfrog check
    ↓
Frontend: Update UI, advance to next item
```

### 9.4 Session-Aware Hydration (Primitive Diversity + Difficulty Calibration)

Each item is hydrated independently via Gemini, which creates a repetition risk — for similar math topics, Gemini defaults to the same "best" primitive (e.g., ten-frame). The session hook maintains a running history of completed primitives with scores and passes it as context to each subsequent hydration call.

**Session history record (per completed item):**
```typescript
{ componentId: string; difficulty: 'easy' | 'medium' | 'hard'; score: number }
```

**How it flows:**
```
usePulseSession.sessionPrimitiveHistory (ref, accumulated per item)
    ↓ passed as options.sessionHistory
generatePracticeManifestAndHydrateStreaming()
    ↓ POST body
/api/lumina/practice-stream route
    ↓ options.sessionHistory
generatePracticeManifest() → injected into Gemini prompt
```

**What Gemini sees in the prompt:**
> "Earlier in this session the student completed: ten-frame (easy, scored 92%), counting-board (medium, scored 64%). Use this to calibrate: if they scored high on an easy primitive, step up the difficulty or try a different angle. Vary primitives when possible, but repeating at a harder level is fine."

**Design principles:**
- **Soft guidance, not hard blocking.** Repeating a primitive at a different difficulty is pedagogically valid (easy ten-frame → multiple choice → hard ten-frame is a strong progression).
- **Scores inform difficulty.** A student who scored 92% on easy mode should get medium or hard next — Gemini sees this and calibrates.
- **No post-generation swap.** If Gemini decides the same primitive is genuinely the best fit at a harder level, that's correct behavior.

### 9.5 Primitive Coverage as Mastery Signal

**Problem:** For a given subskill, there may only be 4-5 applicable visual primitives. If a student demonstrates competence across all of them (high scores at increasing difficulty), that's strong evidence of mastery — potentially stronger than completing N lesson evals at ≥9.0.

**Primitive coverage mastery** treats the set of applicable primitives for a subskill as a coverage checklist. When a student passes all available primitives at or above a difficulty threshold, this can accelerate gate transitions.

**Coverage model:**
```
For subskill S with applicable primitives P = {ten-frame, counting-board, number-line, ...}:

coverage_set = { p ∈ P : student scored ≥ 7.5/10 on p for subskill S }
coverage_ratio = |coverage_set| / |P|

If coverage_ratio ≥ 0.8 AND avg_score ≥ 8.0:
  → Signal: "primitive_coverage_mastery"
  → Effect: counts as equivalent to 2 lesson evals (accelerates Gate 0 → Gate 1)
  → Rationale: demonstrating competence across diverse representations
    is stronger evidence than repeating the same representation 3 times
```

**Where this lives:**
- **Backend:** `PulseEngine.process_result()` — after IRT + gate updates, check primitive coverage for the subskill
- **Data source:** `item_calibration` collection already tracks (primitive_type, eval_mode) per subskill; coverage can be computed from session history + historical evals
- **Gate interaction:** Coverage mastery doesn't skip gates — it accelerates the lesson eval count toward Gate 1. A student who covers 4/5 primitives at ≥8.0 avg gets credit for 2 lesson evals, so they need only 1 more traditional eval to advance.

**Why not full gate skip:** Primitive coverage tests breadth (can the student do it many ways?) but not depth (can they do it consistently over time?). The retest cycle (Gates 2-4) still verifies retention. Coverage mastery accelerates initial recognition (Gate 0 → 1), not final mastery.

**Applicable primitive mapping:** Each subskill needs a set of applicable primitives. This can be:
1. **Inferred from historical data** — which primitives has Gemini actually generated for this subskill? If ten-frame, counting-board, and number-line have all been generated before, those are the applicable set.
2. **Curated in curriculum metadata** — a `primitive_affinity` list per subskill in the DAG node data.
3. **Hybrid** — start with inference, allow curriculum authors to override.

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

    async def assemble_session(
        self, student_id: int, subject: str, item_count: int = 15
    ) -> PulseSessionResponse:
        """Compose a Pulse session from 3 bands."""

    async def process_result(
        self, student_id: int, session_id: str, result: PulseResultRequest
    ) -> PulseResultResponse:
        """Process a single item result. Update θ, β, gates, check leapfrog."""

    async def get_session(self, session_id: str) -> dict:
        """Get session state for resume."""

    async def get_session_summary(self, session_id: str) -> PulseSessionSummary:
        """Aggregate completed session into summary."""
```

### 10.2 Dependency Injection

```python
# dependencies.py
_pulse_engine: Optional[PulseEngine] = None

async def get_pulse_engine(
    firestore_service: FirestoreService = Depends(get_firestore_service),
    calibration_engine: CalibrationEngine = Depends(get_calibration_engine),
    mastery_lifecycle_engine: MasteryLifecycleEngine = Depends(get_mastery_lifecycle_engine),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service),
) -> PulseEngine:
    global _pulse_engine
    if _pulse_engine is None:
        _pulse_engine = PulseEngine(
            firestore_service=firestore_service,
            calibration_engine=calibration_engine,
            mastery_lifecycle_engine=mastery_lifecycle_engine,
            learning_paths_service=learning_paths_service,
        )
    return _pulse_engine
```

### 10.3 Service Interaction Diagram

```
PulseEngine.assemble_session()
    ├── FirestoreService.get_all_mastery_lifecycles()    → gate state per subskill
    ├── FirestoreService.get_all_student_abilities()     → θ per skill
    ├── LearningPathsService._get_graph()                → DAG nodes + edges
    ├── LearningPathsService.get_unlocked_entities()     → frontier computation
    └── LessonGroupService.group_subskills_into_blocks() → group into lesson blocks

PulseEngine.process_result()
    ├── CalibrationEngine.process_submission()            → update θ and β
    ├── MasteryLifecycleEngine.process_eval_result()      → update gate
    ├── [If leapfrog]:
    │   ├── FirestoreService.batch_write_mastery_lifecycles()  → seed inferred skills
    │   ├── FirestoreService.upsert_student_ability()          → seed θ for inferred
    │   └── LearningPathsService.recalculate_unlocks()         → refresh frontier
    └── FirestoreService.save_pulse_session()              → update session doc
```

---

## 11. Key Parameters & Thresholds

| Parameter | Value | Source |
|-----------|-------|--------|
| Default session size | 15 items | Configurable per session |
| Frontier band allocation | 20% (~3 items) | Adjusts based on available candidates |
| Current band allocation | 65% (~9-10 items) | Fills remaining after review + frontier |
| Review band allocation | 15% (~2-3 items) | Capped; excess deferred |
| Frontier probe mode | 3 (pictorial, reduced prompts) | Fixed for fair probing |
| Frontier pass threshold | 75% aggregate (≥7.5/10 avg) | Matches diagnostic threshold |
| Inferred mastery state | `active`, stability=3.0 days | Conservative; requires verification via retention model |
| Inferred mastery θ | 7.0 | Same as diagnostic inference |
| Default θ (new skill) | 3.0 | From CalibrationEngine |
| IRT correct threshold | 9.0 / 10 | From CalibrationEngine |
| Cold start detection | 0 mastery_lifecycle docs for subject | First session = all probes |
| θ → mode mapping | See §3.1 | 6 tiers matching prior β scale |
| **Retention model (§16)** | | |
| INITIAL_STABILITY | 3.0 days | First review surfaces after ~3 days |
| DECAY_RATE | 1.5 | Calibrated for P≈0.85 at t=S |
| TARGET_RETENTION | 0.85 | P(correct) threshold for review candidacy |
| TRIVIAL_THRESHOLD | 0.95 | Current-band items above this P are skipped |
| STABILITY_GROWTH_STRONG | ×2.5 | Score ≥ 9.0 |
| STABILITY_GROWTH_PARTIAL | ×1.5 | Score 7.0-8.9 |
| STABILITY_SHRINK_FAIL | ×0.5 | Score < 7.0 |
| MASTERY_STABILITY_THRESHOLD | 30 days | Stability above this → mastered |

---

## 12. Relationship to Existing Systems

### 12.1 What Pulse Replaces

| Component | Replaced By | Notes |
|-----------|-------------|-------|
| `PracticeModeEnhanced.tsx` | `PulseSession.tsx` | Pulse becomes the main practice entry |
| Separate "lesson" vs "practice" modes | Unified via θ→mode | Same grouper, mode determines scaffolding |
| PlanningService daily queue | PulseEngine session assembly | Pulse assembles per-session, not per-day |

### 12.2 What Pulse Keeps

| Component | Relationship | Notes |
|-----------|-------------|-------|
| `CalibrationEngine` | Called per item result | θ/β updates unchanged |
| `MasteryLifecycleEngine` | Called per item result | Gate transitions unchanged; leapfrog adds new path |
| `LearningPathsService` | Called for DAG + frontier | Graph traversal unchanged |
| `LessonGroupService` | Called for grouping | Same grouper for all bands |
| `PracticeManifestRenderer` | Renders items | Completely unchanged |
| All visual primitives | Rendered as before | No changes needed |
| `DiagnosticSession` | Optional for existing students | Can still run; Pulse handles cold start for new students |
| `PlannerDashboard` | Parallel (for parents/teachers) | Weekly/monthly views still useful for planning visibility |

### 12.3 Migration Path

1. **Phase 1:** Build Pulse alongside existing systems. New entry point, existing backend services.
2. **Phase 2:** Pulse replaces PracticeModeEnhanced as default practice mode.
3. **Phase 3:** Cold start mode replaces mandatory diagnostic for new students.
4. **Future:** PlannerDashboard reads from Pulse session history for planning visibility. Daily Learning planner becomes optional "structured mode" for parent-directed learning.

---

## 13. Student Experience

### 13.1 Session Flow

```
1. Open app → Dashboard
2. Tap "Practice" → PulseWelcome
3. Select subject (Math) → "Start Pulse"
4. Loading: "Preparing your session..." (items hydrating)
5. Item 1 (Current): Addition problem at mode 2 (pictorial)
   → Solve → Submit → θ updates → "Nice work!"
6. Item 2 (Current): Number bonds at mode 3
   → Solve → Submit → θ updates
7. Item 3 (Frontier): Multiplication probe at mode 3
   → Student gets it right! → Leapfrog celebration!
   → "You just jumped ahead 3 skills!"
   → Knowledge map animates expansion
8. Item 4 (Current): Next skill at frontier
   → Continue...
9. Item 12 (Review): Quick addition retest at mode 5
   → Pass → Gate advances 2 → 3
10. ...
15. Session complete → PulseSummary
    → "You advanced 7 skills, including 3 leapfrogs!"
    → EL trajectory shows growth
    → "Start another Pulse?" or "Done for today"
```

### 13.2 Contextual Band Labels

Students see encouraging, non-technical labels:

| Band | Student-Facing Label | Color |
|------|---------------------|-------|
| Frontier | "Exploring new territory" | Purple/violet (discovery) |
| Current | "Building skills" | Blue (steady growth) |
| Review | "Quick review" | Green (confidence) |

### 13.3 Leapfrog Celebration

When a frontier probe triggers leapfrog:
- Brief pause (500ms)
- Animated overlay: skills unlocked fan out from the probed node
- Knowledge map mini-view shows frontier expanding
- Message: "You just jumped ahead N skills!"
- Auto-dismiss after 3 seconds, resume next item

---

## 14. Implementation Phases

### Phase 1 — MVP ✅ Core Loop Complete (2026-03-04 → 2026-03-05)

**Backend — ALL COMPLETE:**
- ✅ `backend/app/models/pulse.py` — all Pydantic models
- ✅ `backend/app/services/pulse_engine.py` — assemble_session + process_result + get_session_summary
- ✅ `backend/app/api/endpoints/pulse.py` — REST endpoints (POST sessions, POST result, GET summary)
- ✅ `backend/app/dependencies.py` — PulseEngine singleton + `get_pulse_engine()` getter
- ✅ `backend/app/main.py` — router registered at `/api/pulse`
- ✅ `backend/app/services/firestore_service.py` — added `save_pulse_session()`, `get_pulse_session()` methods

**Frontend — ALL COMPLETE:**
- ✅ `my-tutoring-app/src/components/lumina/pulse/types.ts` — TypeScript types
- ✅ `my-tutoring-app/src/components/lumina/pulse/pulseApi.ts` — API client
- ✅ `my-tutoring-app/src/components/lumina/pulse/usePulseSession.ts` — session hook with pre-gen cache
- ✅ `my-tutoring-app/src/components/lumina/pulse/PulseSession.tsx` — main component with subject picker

**Integration — COMPLETE:**
- ✅ `App.tsx` updated: PulseSession replaces PracticeModeEnhanced as main practice entry
- ✅ End-to-end loop working: session assembly → item hydration → result submission → θ/gate updates
- ✅ Cold start mode tested and working (100% frontier probes, DAG inference)
- ✅ Leapfrog triggers correctly and seeds inferred mastery + ability docs
- ✅ TypeScript compiles clean (0 errors in Pulse files)

**Bugs Fixed:**
- ✅ Leapfrog `GateHistoryEntry.source` — changed from `"pulse_leapfrog"` (invalid literal) to `"diagnostic"` (valid)

**Known Limitations (Phase 1):**
- Items hydrated one-at-a-time via existing `generatePracticeManifestAndHydrateStreaming` — no dedicated `/api/lumina/pulse-stream` SSE bulk route yet
- Leapfrog celebration is a simple overlay (no animated knowledge map)
- Summary screen shows basic stats only (no EL trajectory chart or knowledge map delta)

### Phase 2 — Polish (In Progress, 2026-03-05)

**Completed:**
- [x] LessonGroupService integration — `_select_current_items` now calls `LessonGroupService.group_subskills_into_blocks()` with Bloom's-sorted grouping; falls back to skill-based grouping on failure
- [x] Session resume — `usePulseSession` detects saved sessions on mount via localStorage (2-hour expiry), fetches state from backend via `GET /api/pulse/sessions/{id}`, resumes at first uncompleted item. Amber "Unfinished session" banner with Resume/Dismiss in `PulseSession.tsx`
- [x] Populate `skills_advanced` and `theta_changes` in summary — `process_result` now persists `theta_update` and `gate_update` per item in session doc; `get_session_summary` aggregates them
- [x] Adaptive band proportions — `_assemble_normal` gathers all candidates first, caps each band to available count, redistributes surplus (priority: current > frontier > review)

**Remaining:**
- [ ] Dedicated `/api/lumina/pulse-stream` SSE route for bulk item hydration
- [x] Leapfrog celebration animation — framer-motion staggered skill chips (probed + inferred), animated score ring SVG, ambient glow, spring animations with 3s auto-dismiss
- [x] EL trajectory visualization in PulseSummary — `ThetaGrowthSection`: horizontal bars (1-3 skills) with animated old→new theta, or recharts `LineChart` (4+ skills) with before/after lines; color-coded by mode tier
- [x] Knowledge map delta — `FrontierDeltaSection`: gate advances + leapfrog skips breakdown, "+N skills unlocked" badge with motion animation, frontier expanded message
- [x] Session-aware hydration — `usePulseSession` tracks `{ componentId, difficulty, score }` per completed item, passes as `sessionHistory` through practice-stream → manifest generator prompt. Soft guidance (no hard blocking): Gemini sees what was done + scores to calibrate variety and difficulty. See §9.4.
- [ ] Pre-generation cache optimization (handle failures gracefully, retry logic)

### Phase 3 — Advanced Features

- [ ] Primitive coverage mastery — when a student demonstrates competence (≥7.5/10) across ≥80% of applicable primitives for a subskill, count as 2 lesson evals to accelerate Gate 0→1. See §9.5.
- [ ] Difficulty slider (student agency, θ-2.0 to θ+4.0 range)
- [ ] Cross-skill leapfrog (high θ on downstream skill → infer prerequisites)
- [ ] Parent dashboard integration (Pulse session history in PlannerDashboard)
- [ ] Adaptive band proportions (ML-driven, based on student trajectory)
- [ ] Session length adaptation (shorter for young students, longer for engaged)

### Phase 4 — System Consolidation

- [ ] Deprecate PracticeModeEnhanced (replaced by Pulse) — **already removed from App.tsx**
- [ ] Deprecate mandatory diagnostic onboarding (cold start handles it)
- [ ] PlanningService reads Pulse session history for weekly/monthly projections
- [ ] Unified telemetry: all learning data flows through Pulse sessions

---

## 15. Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Skills advanced per session | ~1 (sequential) | 3-5 (with leapfrogs) | Gate changes per pulse_session |
| Completion velocity (% per hour) | ~23% per hour | ~60% per hour | mastery_lifecycle gate changes / time |
| Time to first mastery (Gate 4) | ~4 weeks per skill | ~1-2 weeks per skill | Gate 4 timestamp - Gate 0 timestamp |
| Student engagement (session completion rate) | Baseline TBD | +20% vs practice mode | Sessions completed / sessions started |
| Leapfrog rate | N/A (not possible) | 15-25% of frontier probes trigger leapfrog | leapfrogs / frontier items probed |
| Cold start coverage | 90% in 20-30 min (diagnostic) | 50-60% in first 15-item session | classified_count / total_nodes |

---

## 16. Retention Model — Stability-Based Forgetting (replaces Gates 1-4)

### 16.1 Why Gates Failed

The 4-gate retest cycle (Gate 1 → wait 3d → Gate 2 → wait 7d → Gate 3 → wait 14d → Gate 4) is a calendar-based checkpoint system, not a spaced repetition algorithm. It has three fatal flaws:

1. **It blocks forward progress.** A gifted student who masters addition instantly still waits 24 calendar days of retests before the system considers it "mastered." During the wait, the engine has nothing better to serve — it feeds P(correct)=0.99 busywork.

2. **It doesn't model forgetting.** A 3-day wait is the same whether the student barely passed or aced it. Real memory decay is continuous and student-dependent — strong learners retain longer, weak learners need sooner review.

3. **It wastes session capacity.** Trivial items (P > 0.95, Info < 0.05) consume 60-80% of session slots for advanced students. A static worksheet would provide more variety.

**Evidence:** Pulse Agent testing (Gifted Grace, 15 sessions) showed 48% of all items were P(correct)=0.989 busywork. The student touched 7/163 skills in 90 items. The engine served the same 6 items for 14 consecutive sessions.

### 16.2 The Replacement: Stability + Effective Theta

Instead of calendar gates, model forgetting directly in the IRT probability estimate. Every mastered subskill gets a **stability** value (S) — how many days the memory is expected to last before retrieval probability drops below target. Theta decays over time, and the engine's existing information-maximizing logic automatically schedules reviews when items become informative again.

```
┌──────────────────────────────────────────────────────────────────┐
│                    RETENTION MODEL                               │
│                                                                  │
│   theta_tested ─────┐                                            │
│                      ├─► effective_theta(t) = θ - d·√(t/S)       │
│   days_since_test ──┘                                            │
│   stability ────────┘                                            │
│                                                                  │
│   P(correct) computed from effective_theta → if P < 0.85,        │
│   item becomes a review candidate automatically                  │
│                                                                  │
│   On successful review: S *= growth_factor (memory strengthens)  │
│   On failed review:     S *= shrink_factor (review sooner)       │
│   When S > 30 days:     mastered = true (stop reviewing)         │
└──────────────────────────────────────────────────────────────────┘
```

**No gates block forward progress.** Reviews are pulled by the engine when informative, not pushed by a calendar.

### 16.3 Effective Theta — The Forgetting Function

At session assembly time, compute the **effective theta** for every subskill that has been mastered (post-Gate 1):

```python
def effective_theta(theta_tested: float, days_since_test: float, stability: float) -> float:
    """
    Model memory decay as theta erosion over time.

    Uses power-law decay (√t) rather than exponential — matches Ebbinghaus
    forgetting curve research showing memory decays quickly at first,
    then plateaus. Stability (S) controls the rate: higher S = slower decay.

    Args:
        theta_tested: θ at last successful assessment
        days_since_test: calendar days since last assessment
        stability: memory strength in days (higher = more durable)

    Returns:
        effective θ reflecting predicted current ability
    """
    if days_since_test <= 0:
        return theta_tested

    decay = DECAY_RATE * math.sqrt(days_since_test / stability)
    floor = max(DEFAULT_STUDENT_THETA, theta_tested * 0.5)
    return max(floor, theta_tested - decay)
```

**Parameters:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `DECAY_RATE` | 1.5 | Calibrated so that at t=S days, a student with θ=7.0 and β=5.0 drops to P≈0.85 — the target retention threshold |
| `DEFAULT_STUDENT_THETA` | 3.0 | Floor — never decay below "untaught" level |
| `theta * 0.5` floor | — | Prevents high-θ students from decaying to absurdly low values |

**Example — Grace (θ=7.7, β=5.0, S=3 days):**

| Day | effective_θ | P(correct) | Information | Engine action |
|-----|------------|------------|-------------|---------------|
| 0 | 7.70 | 0.989 | 0.028 (negligible) | **Skip** — trivial |
| 1 | 6.83 | 0.943 | 0.090 | Skip — still above target |
| 3 | 6.20 | 0.858 | 0.183 | **Review candidate** — informative |
| 5 | 5.76 | 0.788 | 0.241 | High-priority review |
| 7 | 5.41 | 0.724 | 0.280 | Urgent review |

After successful review on day 3: S = 3 × 2.5 = 7.5 days. The next review naturally surfaces around day 10-11.

**Example — Sam (θ=4.0, β=3.5, S=3 days):**

| Day | effective_θ | P(correct) | Information | Engine action |
|-----|------------|------------|-------------|---------------|
| 0 | 4.00 | 0.622 | 0.356 | **Serve** — already informative |
| 1 | 3.13 | 0.411 | 0.365 | Serve — current work |
| 3 | 2.50 | 0.269 | 0.296 | Review candidate |

Sam's items are already informative at θ=4.0 — the decay model doesn't change his experience, it just handles review scheduling naturally.

### 16.4 Stability Lifecycle

Stability starts low and grows with each successful review, modeling the well-established finding that memories strengthen with spaced retrieval practice.

```
Initial mastery (Gate 0 → Gate 1):
  stability = S₀ = 3.0 days
  last_reviewed = now

After each review:
  if score >= 9.0:    stability *= 2.5   (strong recall → much longer interval)
  elif score >= 7.0:  stability *= 1.5   (partial recall → modest increase)
  else:               stability *= 0.5   (failed recall → halve interval, review sooner)

  last_reviewed = now
  review_count += 1

Mastery threshold:
  if stability > MASTERY_STABILITY_THRESHOLD (30 days):
    mastered = true
    → Stop scheduling reviews
    → Equivalent to old Gate 4
```

**Typical progression for a strong learner:**

| Review # | Stability (days) | Approx. review interval | Cumulative days |
|----------|-----------------|------------------------|-----------------|
| 0 (initial mastery) | 3.0 | — | 0 |
| 1 | 7.5 | ~3 days | 3 |
| 2 | 18.75 | ~8 days | 11 |
| 3 | 46.9 → **mastered** | ~19 days | 30 |

Three successful reviews over ~30 days → mastered. Compare to the old gate model: 4 retests over 24 days, but **blocking forward progress the entire time**. The stability model achieves the same verification in roughly the same calendar time, but never blocks.

**Typical progression for a struggling learner:**

| Review # | Score | Stability | Next review |
|----------|-------|-----------|-------------|
| 0 | — | 3.0 | — |
| 1 | 6.5 (fail) | 1.5 | ~1-2 days |
| 2 | 7.2 (partial) | 2.25 | ~2 days |
| 3 | 8.0 (partial) | 3.4 | ~3 days |
| 4 | 9.5 (strong) | 8.4 | ~8 days |
| 5 | 9.0 (strong) | 21.0 | ~21 days |
| 6 | 9.2 (strong) | 52.5 → **mastered** | done |

More reviews, shorter intervals, same destination. The model adapts to the learner.

### 16.5 Simplified State Model

The 5-gate state machine (Gate 0/1/2/3/4) reduces to 3 states:

```
OLD:  Gate 0 ──3 evals──► Gate 1 ──3d──► Gate 2 ──7d──► Gate 3 ──14d──► Gate 4
                                    ▲ BLOCKS FORWARD PROGRESS ▲

NEW:  not_started ──3 evals──► active ──stability grows──► mastered
                                  │
                                  └─ never blocks forward progress
                                     reviews surface by information value
```

| State | Meaning | Transition |
|-------|---------|------------|
| `not_started` | Student hasn't been introduced to this subskill | → `active` when 3 lesson evals ≥ 9.0 (same as old Gate 0→1) |
| `active` | Student has initial mastery; retention is being tracked | → `mastered` when stability > 30 days |
| `mastered` | Long-term retention verified; no more reviews scheduled | Terminal state (can regress if future evidence contradicts) |

Gate 0 → 1 transition is preserved because it serves a different purpose: **introduction verification** ("has the student been taught this and demonstrated basic competence?"). This is not spaced repetition — it's curriculum progress. The stability model handles everything after.

### 16.6 Impact on Session Assembly

The `_assemble_normal()` method changes in two ways:

**A. Review candidate selection (replaces gate-based retest queries)**

```python
# OLD: query lifecycle for next_retest_eligible <= now AND gate 1-3
# NEW: compute effective_theta for all active subskills, select by information

def _gather_review_candidates(self, lifecycle_map, theta_map, node_map, subject, now):
    candidates = []
    for sid, lc in lifecycle_map.items():
        state = lc.get("retention_state", "not_started")
        if state != "active":
            continue

        stability = lc.get("stability", INITIAL_STABILITY)
        last_reviewed = lc.get("last_reviewed")
        if not last_reviewed:
            continue

        days_elapsed = (now - parse_datetime(last_reviewed)).total_seconds() / 86400
        theta_tested = theta_map.get(lc.get("skill_id", ""), DEFAULT_STUDENT_THETA)

        eff_theta = effective_theta(theta_tested, days_elapsed, stability)

        node = node_map.get(sid, {})
        prim_type = node.get("primitive_type", "ten-frame")
        a = get_item_discrimination(prim_type)
        _, beta, _ = self.select_best_mode(eff_theta, prim_type)
        p = p_correct(eff_theta, beta, a)
        info = item_information(eff_theta, beta, a)

        if p < TARGET_RETENTION:  # 0.85
            candidates.append((sid, lc, eff_theta, info, days_elapsed))

    # Sort by information value descending — most informative reviews first
    candidates.sort(key=lambda x: -x[3])
    return candidates
```

**B. Current band trivial-item filter**

```python
# When selecting current-band items, skip any with P > 0.95
# This prevents the engine from serving busywork when all current items are trivial

for sid in current_candidate_ids:
    node = node_map.get(sid, {})
    skill_id = node.get("skill_id", "")
    theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
    prim_type = node.get("primitive_type", "ten-frame")
    _, beta, _ = self.select_best_mode(theta, prim_type)
    a = get_item_discrimination(prim_type)
    p = p_correct(theta, beta, a)
    if p > TRIVIAL_THRESHOLD:  # 0.95
        continue  # Skip — no pedagogical value
    filtered_current.add(sid)
```

Freed slots flow to frontier probes via existing surplus redistribution. Gifted students get more exploration; no busywork.

### 16.7 Impact on Result Processing

When `process_result()` runs after a student completes an item:

```
OLD flow:
  1. IRT update (θ, β)
  2. Gate transition check (score >= 9.0? increment lesson_eval_count, check gate thresholds)
  3. Leapfrog check (frontier only)

NEW flow:
  1. IRT update (θ, β) — unchanged
  2. Retention update:
     - If subskill is "not_started" and this is a lesson eval:
         increment lesson_eval_count; if count >= 3 and all scores >= 9.0:
           transition to "active", set stability = S₀, last_reviewed = now
     - If subskill is "active":
         update stability based on score (see §16.4)
         update last_reviewed = now
         check mastery threshold (stability > 30 → "mastered")
  3. Leapfrog check — unchanged, except inferred skills start at
     retention_state="active", stability=INITIAL_STABILITY
```

### 16.8 Impact on Leapfrog Inference

When leapfrog seeds inferred skills, the seeded state changes:

```
OLD: Gate 2, completion_pct=0.5, next_retest_eligible=now+3d
NEW: retention_state="active", stability=3.0, last_reviewed=now
```

This means inferred skills don't block anything. Their effective_theta will naturally decay, and when they become informative, the engine will surface them as review candidates. If the inference was wrong (student doesn't actually know this), the review will fail, stability halves, and the engine schedules a quicker follow-up.

### 16.9 Migration from Gates

Existing mastery_lifecycle documents with gate values can be migrated:

| Current Gate | New State | Stability | Rationale |
|-------------|-----------|-----------|-----------|
| 0 | `not_started` | — | Not yet mastered |
| 1 | `active` | 3.0 | Just cleared initial mastery |
| 2 | `active` | 7.5 | Survived one retest |
| 3 | `active` | 18.75 | Survived two retests |
| 4 | `mastered` | 47.0 | Fully verified |

Migration is a one-time batch update on existing lifecycle documents. New documents use the retention model from creation.

### 16.10 New Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `INITIAL_STABILITY` | 3.0 days | Matches old Gate 1→2 interval; first review surfaces after ~3 days |
| `DECAY_RATE` | 1.5 | At t=S, drops high-θ students to P≈0.85 |
| `TARGET_RETENTION` | 0.85 | Items below this P become review candidates. Standard in spaced repetition literature (Anki default: 0.90, FSRS default: 0.90). We use 0.85 for fewer, more informative reviews |
| `TRIVIAL_THRESHOLD` | 0.95 | Current-band items above this P are skipped — zero pedagogical value |
| `STABILITY_GROWTH_STRONG` | 2.5 | Score ≥ 9.0 — strong recall, large interval increase |
| `STABILITY_GROWTH_PARTIAL` | 1.5 | Score 7.0-8.9 — partial recall, modest increase |
| `STABILITY_SHRINK_FAIL` | 0.5 | Score < 7.0 — failed recall, halve interval |
| `MASTERY_STABILITY_THRESHOLD` | 30 days | Stability above this → mastered (predicted retention > 90% at 30 days) |
| `THETA_DECAY_FLOOR_FACTOR` | 0.5 | Never decay below 50% of tested theta |

### 16.11 Cross-Archetype Behavior

| Archetype | Old Behavior | New Behavior |
|-----------|-------------|-------------|
| **Gifted Grace** | Trapped on P=0.989 busywork for 14 sessions. 7/163 skills in 90 items. | Trivial items skipped immediately. Freed slots go to frontier probes. Races through DAG. Reviews surface naturally after ~3 days. |
| **Steady Sam** | Can't clear gates because P(correct) stuck at 0.22 vs 0.7 threshold (IRT-gate mismatch). | No gate thresholds to clear. Stability grows based on score alone. Items are already informative (P≈0.5-0.7), so the engine serves them correctly. |
| **Struggling Sophia** | Gets stuck at Gate 0 indefinitely — can't score 9.0 three times. | Gate 0→active transition unchanged (still needs 3 evals ≥ 9.0). But once active, stability model handles reviews with shorter intervals (failed reviews → S×0.5). |
| **Cold Start** | Uses `_assemble_cold_start()` — 100% frontier probes. | **Unchanged.** Cold start doesn't use the retention model. |

### 16.12 Comparison to Established Systems

| Property | Lumina Gates (old) | Anki/SM-2 | FSRS | Lumina Stability (new) |
|----------|-------------------|-----------|------|----------------------|
| Forgetting model | None (fixed calendar) | Exponential intervals | Power-law (optimized) | Power-law (√t/S) |
| Blocks forward progress | Yes | No | No | No |
| Per-student adaptation | None | Ease factor per card | Per-card stability + difficulty | Per-subskill stability, leverages IRT θ |
| Review trigger | Calendar date | Calendar date | Calendar date | Information value (P < target) |
| Integration with ability model | Separate (gates ≠ θ) | N/A (no ability model) | N/A | Unified (decay modifies θ directly) |
| Mastery definition | Gate 4 (3 retests passed) | Mature interval > N days | Stability > threshold | Stability > 30 days |

The key innovation over Anki/FSRS: **reviews are triggered by information value, not calendar dates.** Because we have a full IRT model, we can compute exactly how informative a review would be and let the engine's existing selection logic handle scheduling. No separate scheduler needed.

---

## Appendix A: Existing Service Interfaces Used

### CalibrationEngine
```python
async def process_submission(
    student_id: int, skill_id: str, subskill_id: str,
    primitive_type: str, eval_mode: str, score: float, source: str = "practice"
) -> Dict[str, Any]
# Returns: { item_key, calibrated_beta, credibility_z, student_theta, earned_level }
```

### MasteryLifecycleEngine
```python
async def process_eval_result(
    student_id: int, subskill_id: str, subject: str, skill_id: str,
    score: float, source: Literal["lesson", "practice"], timestamp: Optional[str] = None
) -> Dict[str, Any]
# Returns: updated MasteryLifecycle dict
```

### LearningPathsService
```python
async def _get_graph(subject_id: str, version_type: str = "published") -> Dict[str, Any]
# Returns: { graph: { nodes: [...], edges: [...] }, version_id: ... }

async def get_unlocked_entities(student_id: int, entity_type?: str, subject?: str) -> Set[str]
# Returns: set of unlocked skill/subskill IDs

async def recalculate_unlocks(student_id: int, subject_id: str) -> None
```

### LessonGroupService
```python
@classmethod
def group_subskills_into_blocks(cls, candidates: List[Dict[str, Any]]) -> List[LessonBlock]
# Candidate dict: { skill_id, subject, type, mastery_gate, unit_title, skill_description, subskill_description, days_overdue?, completion_factor? }
```

### ProblemTypeRegistry
```python
def get_prior_beta(primitive_type: str, eval_mode: str) -> float
# Returns: prior β for the (primitive_type, eval_mode) pair
```

---

## Appendix B: Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-04 | 1.0 | Initial PRD — design complete |
| 2026-03-05 | 1.1 | Phase 1 MVP implemented end-to-end. All backend + frontend files created. Wired into App.tsx. Fixed leapfrog GateHistoryEntry source literal bug. Updated §3.3 leapfrog gate_history source to "diagnostic". Added known limitations and Phase 2 checklist. |
| 2026-03-05 | 1.2 | Phase 2 progress: LessonGroupService integrated into band assembly, adaptive band proportions, session resume flow (localStorage + backend fetch), summary now populates skills_advanced and theta_changes from per-item data. |
| 2026-03-05 | 1.3 | Phase 2 UI polish: Enhanced leapfrog celebration with framer-motion staggered skill chips, animated SVG score ring, probed/inferred skill breakdown. Added ThetaGrowthSection (recharts line chart or animated bars based on skill count). Added FrontierDeltaSection with gate advance + leapfrog skip breakdown and frontier expansion message. |
| 2026-03-05 | 1.4 | Added §9.4 Session-Aware Hydration: sessionHistory (componentId + difficulty + score) passed to Gemini for diversity + difficulty calibration. Soft guidance, no hard blocking. Added §9.5 Primitive Coverage as Mastery Signal: breadth across applicable primitives accelerates Gate 0→1 (Phase 3). |
| 2026-03-22 | 2.0 | **Retention model redesign.** Replaced Gates 1-4 with stability-based forgetting model (§16). Gates blocked forward progress and served P=0.989 busywork to gifted students. New model: effective_theta decays over time via power-law forgetting; reviews surface by information value, never blocking progression. Stability grows with successful reviews (×2.5/×1.5/×0.5), mastery at S>30 days. Updated §2.3 (review selection), §3.3 (leapfrog seeding), §5.1 (assembly algorithm), §6 (result processing), §7 (data model — new retention_state/stability/last_reviewed fields), §11 (parameters). Gate 0→1 transition preserved for initial mastery verification. Identified via Pulse Agent — Gifted Grace stagnation (48% trivial items, 7/163 skills in 90 items). |
| 2026-03-22 | 2.1 | **§16 implemented.** All backend changes complete: `mastery_lifecycle.py` — added retention_state/stability/last_reviewed/review_count fields + 10 retention constants (INITIAL_STABILITY, DECAY_RATE, TARGET_RETENTION, TRIVIAL_THRESHOLD, growth multipliers, MASTERY_STABILITY_THRESHOLD, GATE_TO_STABILITY migration map). `mastery_lifecycle_engine.py` — full rewrite: added `effective_theta()` power-law forgetting function, `derive_retention_state()` lazy migration helper, `_activate_retention()` for Gate 0→1 transition, replaced `_handle_practice_eval()` with stability updates (×2.5/×1.5/×0.5), removed `_handle_retest_pass()`/`_handle_retest_fail()`, updated forecasting to stability-based projections. `pulse_engine.py` — replaced `_gather_review_candidates()` with information-value selection (effective_theta decay → P < 0.85 → review candidate), added trivial-item filter (P > 0.95 → skip), updated band logic to use retention_map, updated leapfrog seeding to retention_state="active" + stability=3.0. `planning_service.py` — added `_derive_retention_state()` with legacy gate fallback, updated `_count_by_gate_status()`, monthly projection (stability-based closure pipeline), daily planner blocking. All backward-compat gate fields kept in sync for consumers. Lazy migration — no batch script needed. Verified: effective_theta matches PRD §16.3 examples, derive_retention_state handles all gate values, stability growth reaches mastery in 3 reviews. |
