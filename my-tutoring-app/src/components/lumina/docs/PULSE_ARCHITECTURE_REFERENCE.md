# Lumina Pulse — Architecture Reference

Living document covering key design themes, decisions, capabilities, and open questions.

---

## The Three Parallel Engines

Pulse runs three engines that are now **tightly coupled** via theta-based mastery gates. The calibration engine's theta/sigma estimates drive mastery gate advancement.

| Engine | Question it answers | Inputs | Output |
|--------|-------------------|--------|--------|
| **MasteryLifecycleEngine** | "Has this student durably mastered this skill?" | theta, sigma, skill_beta_median, calendar time | Gate 0-4, next_retest_eligible |
| **CalibrationEngine** | "What is this student's latent ability?" | score, item difficulty (beta), primitive_type + eval_mode | theta (0-10), earned_level, calibrated beta |
| **PulseEngine** | "What should this student practice next, and at what difficulty?" | gates, theta, DAG graph, frontier | Session items with band + target_mode |

### How they connect

```
Student submission (score, primitive_type, eval_mode)
        |
        v
CompetencyService
        |
        v  (1) FIRST
CalibrationEngine ──→ updates theta, sigma
        |
        v  (2) SECOND (receives fresh theta/sigma)
MasteryLifecycle ──→ checks theta > threshold AND sigma < max
        |                for gate advancement
        v
   Gate 0→1→2→3→4  +  spaced retests (3d/7d/14d)
        |
        v
PulseEngine (reads gates + theta to assemble next session)
```

**The design principle (ADAPT model):** Gates are driven by **statistical confidence in the latent ability estimate**, not by raw score counts. The instrument (which primitive, which eval mode) is interchangeable — what matters is whether theta is high enough and sigma is low enough. Spaced repetition retests ensure durability by verifying that theta holds over time.

**Execution order is critical:** CalibrationEngine MUST run before MasteryLifecycleEngine so that mastery sees the freshly-updated theta/sigma. This is enforced in both `competency.py` and `pulse_engine.py`.

---

## ADAPT Alignment

ADAPT (Actuarial Dynamic Adaptive Placement Testing) uses IRT ability estimates to make real-time placement decisions. Here's how Pulse maps:

### What we took from ADAPT

- **IRT calibration**: 1PL Rasch model for theta/beta estimation
- **Frontier probing**: Test untaught skills to find what students already know
- **Leapfrog inference**: Skip prerequisites when probe performance is high
- **Midpoint probing**: Binary-search convergence (cold start + normal sessions)
- **Actuarial credibility blending**: Completion factor uses Z = attempts/10

### Where we diverge from ADAPT

| ADAPT would... | Pulse does... | Why |
|----------------|---------------|-----|
| Use theta directly for gate advancement | Require 3 evals >= 9.0 + retest schedule | Behavioral evidence > probabilistic estimate for K-5 learners |
| Shorten retest intervals for high-theta students | Fixed 3d/7d/14d intervals | Simplicity; spaced repetition research supports fixed intervals |
| Trigger leapfrog on any high-ability observation | Only on explicit frontier-band probes scoring >= 75% | Conservative — wrong inference is costly for young learners |
| Skip to Gate 4 on strong inference | Skip to Gate 2 (requires 3-day retest verification) | Ensures inferred mastery gets verified |

### Open question: Should theta influence gate decisions?

Currently Phase 1 (parallel system) — theta is tracked but doesn't drive gates. Phase 2 options:

1. **Theta-accelerated gates**: If theta > gate threshold AND score >= 9.0, count 1 eval as 2 (faster Gate 0->1)
2. **Theta-shortened retests**: If theta is well above the skill's beta range, shorten the retest interval (e.g., 3d -> 1d)
3. **Theta-gated leapfrog**: Allow leapfrog to seed Gate 3 (not just Gate 2) when theta is very high
4. **Keep as-is**: Behavioral evidence is the right bar for young learners; theta informs content, not progression

---

## Math Academy Alignment

Math Academy uses a prerequisite knowledge graph where skills unlock based on mastery of dependencies.

### What we took from Math Academy

- **DAG prerequisite graph**: Skills have explicit dependencies; children unlock when parents are mastered
- **Knowledge graph inference**: Passing a downstream skill implies mastery of upstream prerequisites
- **Topological ordering**: Used for probe selection (midpoints of independent chains)
- **Soft gate blocking**: Gate 1 (not Gate 4) unlocks descendants — students don't wait for full mastery

### Where we diverge

| Math Academy does... | Pulse does... | Trade-off |
|---------------------|---------------|-----------|
| Deterministic knowledge state (mastered/not) | Continuous ability (theta 0-10) | We get richer signal but more complexity |
| Hard prerequisite blocking (must fully master before advancing) | Soft blocking (Gate 1 unlocks descendants) | Students move faster but may hit skills they're not fully ready for |
| Daily planner drives all activity | Session-based with band allocation (20/65/15) | More variety per session, less optimal long-term sequencing |

---

## Eval Modes: Are We Using Them Properly?

### The current flow

1. **Backend**: theta -> target_mode (1-6) via `theta_to_mode()`
2. **Frontend manifest**: Gemini receives target_mode and generates content at that scaffolding level
3. **Frontend primitive**: Student completes the activity, primitive reports `eval_mode` (e.g., "build", "subitize")
4. **Backend calibration**: Uses `(primitive_type, eval_mode)` to look up prior beta, updates theta
5. **Backend mastery**: Uses score >= 9.0, **ignores eval_mode entirely**

### How eval modes connect to mastery (via theta)

With theta-based gates, eval modes now influence mastery **indirectly but reliably**:

1. Each eval mode has a prior beta (item difficulty) in the `PROBLEM_TYPE_REGISTRY`
2. When a student passes a harder eval mode (higher beta), theta increases more
3. Higher theta → crosses gate thresholds faster
4. The sigma requirement ensures the estimate is confident (not just one lucky item)

**This resolves the old disconnect.** A student who only solves mode-1 items (beta ~1.5) would have theta capped around 2-3, never crossing the skill_beta_median for harder skills. They naturally need harder items to build theta high enough for gate advancement.

**The instrument is interchangeable** — different primitives testing the same skill all contribute to the same skill-level theta. Each observation from a different primitive is an independent measurement of the same latent trait, which improves the estimate faster than repeating the same problem type.

---

## Session Composition: The 20/65/15 Split

### Current band allocation

| Band | Target % | Purpose | Mode selection |
|------|----------|---------|----------------|
| **Frontier** (probe) | 20% | Test untaught skills ahead of frontier | Fixed mode 3 (fair assessment) |
| **Current** (learning) | 65% | Build toward mastery on active skills | theta -> mode (adaptive) |
| **Review** (retest) | 15% | Spaced repetition on gated skills | theta -> mode (adaptive) |

### Design decisions and trade-offs

**Why frontier probes use fixed mode 3:**
Frontier probes test skills the student hasn't been taught. Using their current theta-based mode would be unfair — a student with high theta on counting might get a mode-5 geometry probe, which tests symbolic reasoning they've never applied to geometry. Mode 3 (pictorial, reduced prompts) is the "fair assessment" level.

**Why 65% current, not more:**
65% current ensures the bulk of practice builds toward gate advancement (3 evals for Gate 1). But 35% for exploration + review prevents tunnel vision and maintains spaced repetition. If a student needs faster progression, the adaptive allocation expands current when frontier/review candidates are scarce.

**Interleaving pattern:**
```
current, current, current, FRONTIER, current, current, REVIEW, ...
```
Front-loads learning, spaces probes and reviews. This prevents the jarring experience of 3 probes in a row on unknown material.

---

## Leapfrog: When and Why

### The mechanism

1. Student gets a frontier probe (1-5 DAG edges ahead of frontier)
2. Scores >= 75% aggregate on the probe's lesson group
3. System walks DAG ancestors back to the current frontier
4. All intermediate unmastered skills get **inferred mastery** (seeded at Gate 2)
5. Those skills enter the retest pipeline (eligible in 3 days)

### Key design decisions

**Why >= 75% threshold (not 90%)?**
Frontier probes test untaught material. A 75% score on untaught content is strong evidence of prior knowledge. Requiring 90% would almost never trigger leapfrog.

**Why seed at Gate 2 (not Gate 1 or 4)?**
- Gate 1 would be too conservative — the student already proved they know the material
- Gate 4 would be too aggressive — no verification that the inference is correct
- Gate 2 means "we believe you know this, but verify in 3 days"

**Why midpoint probing (not depth-1)?**
Binary-search convergence. Testing at depth 1 every session is O(n) — need n sessions to discover a student knows n skills. Midpoint probing is O(log n). A student who knows 8 skills ahead gets placed in ~3 sessions instead of ~8.

### Aggressive leapfrog scenario

Student frontier has unexplored skills at depths 1-5:
```
Session 1: Probe depth 3 (midpoint). Pass -> infer skills at depth 1-2
Session 2: New frontier advanced. Probe depth 3 from new frontier. Pass -> infer more
Result: Skipped ~4-6 skills in 2 sessions
```

### Failed probe scenario

```
Session 1: Probe depth 3 (midpoint). Fail (score 60%)
Session 2: Candidates now depth 1-2. Probe depth 1. Pass -> small skip
Session 3: Probe depth 2. Pass -> skip 1 more
Result: Graceful degradation to linear progression
```

---

## Decisions We May Not Be Considering

### 1. Mode-aware mastery (the biggest gap)

Currently a student can reach Gate 4 without ever solving a symbolic problem. The natural theta progression usually prevents this, but it's not guaranteed. Consider:
- **Mode floor for retests** (see eval modes section above)
- **Coverage requirement**: Must have attempted N different eval modes before Gate 4

### 2. Theta-informed retest scheduling

Fixed 3d/7d/14d intervals ignore ability. A student with theta well above the skill's beta range could safely retest sooner. A student with theta barely above could benefit from more time. Options:
- **Theta-shortened intervals**: If theta > skill_max_beta + 1.0, halve the interval
- **Theta-extended intervals**: If theta < skill_min_beta, extend by 50%

### 3. Cross-skill theta transfer

When a student masters "addition within 20" (theta = 6.0), their initial theta for "addition within 100" starts at the default (3.0). But these skills are related — prior knowledge should transfer. Options:
- **Ancestor theta seeding**: Initialize theta from the weighted average of prerequisite skill thetas
- **DAG-informed priors**: Use the prerequisite graph to set informative priors

### 4. Session-level difficulty adaptation

Currently each item's mode is set at session assembly time and doesn't change. If a student aces the first 3 items, the remaining items are still at the original mode. Options:
- **Intra-session theta update**: After each item, update theta and re-derive mode for remaining items
- **Difficulty escalation**: If first 2 items score >= 9.5, bump remaining items up one mode

### 5. Engagement signals beyond score

Score >= 9.0 is the only mastery signal. But engagement matters:
- **Time on task**: A student who solves mode-3 items in 10 seconds vs 2 minutes has different mastery profiles
- **Hint usage**: Students who use AI hints to reach 9.0 may not have the same mastery as those who don't
- **Attempt patterns**: First-attempt success vs third-attempt success signal different levels

### 6. Frontier probe diversity

Currently probes are selected by BFS depth. But two probes at the same depth might test the same cognitive skill (e.g., two counting subskills). Consider:
- **Cross-unit probing**: Spread probes across different parent skills/units
- **Bloom's diversity**: Probe at different cognitive levels (recall vs application vs analysis)

### 7. The "almost mastered" problem

A student at Gate 0 with 2/3 lesson evals at >= 9.0 is one eval away from Gate 1. But Pulse might assign them a frontier probe or review instead of a current-band item. Consider:
- **Priority boosting**: When a student is 1 eval away from a gate transition, prioritize current-band items for that skill
- **Gate proximity weighting**: Weight current candidates by proximity to gate transition

---

## Key Constants Reference

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `MASTERY_THRESHOLD` | 9.0 | mastery_lifecycle.py | Score to pass gate eval |
| `GATE_1_MIN_LESSON_EVALS` | 3 | mastery_lifecycle.py | Evals needed for Gate 0->1 |
| `FRONTIER_PASS_THRESHOLD` | 7.5 | pulse.py | Aggregate score for leapfrog trigger |
| `FRONTIER_MAX_JUMP` | 5 | pulse.py | Max DAG edges for frontier probes |
| `FRONTIER_PROBE_MODE` | 3 | pulse.py | Fixed scaffolding mode for probes |
| `DEFAULT_STUDENT_THETA` | 3.0 | calibration.py | Prior theta for new students |
| `IRT_CORRECT_THRESHOLD` | 9.0 | calibration.py | Score treated as "correct" for IRT |
| `CREDIBILITY_STANDARD` | 10 | mastery_lifecycle.py | Attempts for full actuarial credibility |
| `ITEM_CREDIBILITY_STANDARD` | 200 | calibration.py | Observations for full item calibration |
| `RETEST_INTERVALS` | 3d/7d/14d | mastery_lifecycle.py | Spaced repetition schedule |
| `LEAPFROG_INFERRED_GATE` | 2 | pulse.py | Gate seeded for leapfrog-inferred skills |
| `LEAPFROG_RETEST_DAYS` | 3 | pulse.py | Days until inferred skill retest |

## Key Files

| Component | Path |
|-----------|------|
| Pulse engine | `backend/app/services/pulse_engine.py` |
| Mastery lifecycle | `backend/app/services/mastery_lifecycle_engine.py` |
| Calibration engine | `backend/app/services/calibration_engine.py` |
| Problem type registry | `backend/app/services/calibration/problem_type_registry.py` |
| Pulse models | `backend/app/models/pulse.py` |
| Mastery models | `backend/app/models/mastery_lifecycle.py` |
| Calibration models | `backend/app/models/calibration.py` |
| DAG analysis | `backend/app/services/dag_analysis.py` |
| Learning paths | `backend/app/services/learning_paths.py` |
| Frontend eval types | `my-tutoring-app/src/components/lumina/evaluation/types.ts` |
| Pulse types (frontend) | `my-tutoring-app/src/components/lumina/pulse/types.ts` |
| Pulse PRD | `my-tutoring-app/src/components/lumina/docs/Lumina_PRD_Pulse.md` |
| Planning architecture | `backend/docs/PLANNING_ARCHITECTURE.md` |
