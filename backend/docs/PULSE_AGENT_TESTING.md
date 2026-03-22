# Pulse Agent Testing Framework

> **Purpose:** This document explains the Pulse Agent testing framework — a programmatic
> harness for simulating student journeys through the Pulse adaptive loop without
> requiring a real student, a browser, or Firebase authentication. It covers the
> motivation, architecture, how to run scenarios, how to interpret results, and how
> to extend the framework with new profiles and strategies.
>
> **Audience:** Developers, QA, and anyone validating Pulse progression logic.
>
> **Location:** `backend/tests/pulse_agent/`

---

## 1. Why Agent Testing?

### 1.1 The Problem

Pulse is a tightly coupled adaptive engine: IRT calibration, mastery gates,
DAG-based leapfrogging, and spaced-repetition review all interact to determine
a student's trajectory. Testing this end-to-end previously required:

- A real Firebase-authenticated user
- A browser running the React frontend
- Manual problem-solving to generate scores
- ~6 minutes per session (real-time pacing)
- No way to reproduce or compare runs

A single 20-session journey would take **2+ hours of manual work** and produce
no structured data for analysis.

### 1.2 The Solution

The Pulse Agent framework calls `PulseEngine` **directly** — below the HTTP layer,
below Firebase auth. It creates synthetic students with isolated Firestore data,
generates scores via pluggable strategies, and records every state change into
a structured timeline.

```
                     What we skip              What we test
                     ─────────────             ─────────────
                     Browser / React           PulseEngine.assemble_session()
                     Firebase Auth             PulseEngine.process_result()
                     HTTP / FastAPI            CalibrationEngine (IRT)
                     WebSocket                 MasteryLifecycleEngine (gates)
                     UI rendering              LearningPathsService (DAG)
                                               Leapfrog inference
                                               Band allocation (F/C/R)
                                               Spaced repetition scheduling
```

A 20-session journey runs in **seconds**, produces full Markdown reports, and
is reproducible via random seeds.

---

## 2. Architecture

### 2.1 Module Overview

```
backend/tests/pulse_agent/
├── __init__.py
├── agent.py              # PulseAgentRunner — orchestrates sessions
├── profiles.py           # Synthetic student definitions
├── scenarios.py          # Score strategies (how each archetype answers)
├── journey_recorder.py   # Snapshots Firestore state into timelines
├── assertions.py         # Validates progression makes sense
├── reports.py            # Generates Markdown reports
└── run_scenarios.py      # CLI entry point
```

### 2.2 Data Flow

```
SyntheticProfile ──> PulseAgentRunner ──> PulseEngine
       │                    │                  │
       │                    │          assemble_session()
       │                    │                  │
       │              ScoreStrategy            │
       │              scores each item         │
       │                    │          process_result()
       │                    │                  │
       │                    │           Firestore writes:
       │                    │           - mastery_lifecycles
       │                    │           - abilities (theta)
       │                    │           - pulse_sessions
       │                    │           - pulse_state
       │                    │                  │
       │              JourneyRecorder          │
       │              snapshots state   <──────┘
       │                    │
       │              JourneyTimeline
       │                    │
       ├──> Assertions (pass/fail checks)
       └──> Reports (Markdown output)
```

### 2.3 Firestore Isolation

Synthetic students use IDs in the **900,000+ range** (900001, 900002, etc.)
so their data never collides with real student records. The `--clean` flag
deletes all Firestore documents for a synthetic student before re-running,
giving a guaranteed clean slate.

**Collections written to:**

| Collection | Path |
|------------|------|
| Mastery lifecycles | `students/{student_id}/mastery_lifecycles/{subskill_id}` |
| Abilities | `students/{student_id}/abilities/{skill_id}` |
| Pulse sessions | `pulse_sessions/{session_id}` |
| Primitive history | `students/{student_id}/pulse_state/primitive_history` |

---

## 3. Profiles — Who Are the Synthetic Students?

Each profile represents a student archetype with predictable behavior so you
can validate that the Pulse engine responds correctly.

| Profile | ID | Archetype | Behavior | Sessions |
|---------|------|-----------|----------|----------|
| **Gifted Grace** | 900001 | `gifted` | Scores 9.0-10.0 on everything. Frontier probes pass. | 15 |
| **Steady Sam** | 900002 | `steady` | Scores 7-8 consistently. Linear progression. | 20 |
| **Struggling Sofia** | 900003 | `struggling` | Scores 4-6. Stalls at gate 0-1. | 15 |
| **Fraction-Weak Finn** | 900004 | `selective_weakness` | Strong everywhere except fraction/decimal skills. | 20 |
| **Cold-Start Cleo** | 900005 | `cold_start` | Zero history. Tests cold-start band allocation. | 5 |
| **Accelerator Alex** | 900006 | `accelerating` | Starts at ~5, improves +0.3/session. Models growth. | 20 |

### 3.1 Creating a Custom Profile

Add a new `SyntheticProfile` to `profiles.py`:

```python
MY_CUSTOM_STUDENT = SyntheticProfile(
    student_id=900_010,           # Must be in 900,000+ range
    name="Custom Casey",
    description="What you expect this student to do",
    archetype="steady",           # Links to a ScoreStrategy
    subject="Mathematics",
    target_sessions=10,
    items_per_session=6,
)
```

Then register it in `ALL_PROFILES`:

```python
ALL_PROFILES["custom"] = MY_CUSTOM_STUDENT
```

---

## 4. Scenarios — How Synthetic Students Answer

Each archetype maps to a `ScoreStrategy` that decides what score (0-10) the
synthetic student gives for each Pulse item. Strategies receive the full
`PulseItemSpec` (band, subskill, mode, description) so they can make
context-aware scoring decisions.

### 4.1 Built-in Strategies

| Strategy | Base Scores (Frontier / Current / Review) | Notes |
|----------|-------------------------------------------|-------|
| `GiftedStrategy` | 9.0 / 9.5 / 9.5 | Passes frontier probes, triggers leapfrogs |
| `SteadyStrategy` | 6.0 / 7.5 / 8.0 | Fails frontier, steady current-band progress |
| `StrugglingStrategy` | 3.0 / 5.0 / 5.5 | Below gate thresholds on most items |
| `SelectiveWeaknessStrategy` | Varies | 9.0 on most skills, 4.5 on fraction/decimal/ratio/percent keywords |
| `ColdStartStrategy` | 6.5 / 6.5 / 6.5 | Middling across the board |
| `AcceleratingStrategy` | Starts 4-5, grows +0.3/session | Models a student gaining fluency over time |

All strategies add random jitter (+/- 0.5-1.5) so scores aren't perfectly
deterministic. The `--seed` flag controls the RNG for reproducibility.

### 4.2 Creating a Custom Strategy

Subclass `ScoreStrategy` in `scenarios.py`:

```python
class MyStrategy(ScoreStrategy):
    def score_item(self, item: PulseItemSpec) -> float:
        # Your logic here — use item.band, item.description,
        # item.target_mode, item.subskill_id, self.session_number, etc.
        if item.band == PulseBand.FRONTIER:
            return self._jitter(8.0, spread=1.0)
        return self._jitter(7.0, spread=0.5)
```

Register it in `STRATEGY_MAP`:

```python
STRATEGY_MAP["my_strategy"] = MyStrategy
```

Then set `archetype="my_strategy"` on your profile.

### 4.3 Using a Custom Strategy at Runtime

You can also override the strategy in code without modifying the profile:

```python
from tests.pulse_agent.scenarios import MyStrategy

timeline = await runner.run_profile(
    profile,
    strategy_override=MyStrategy(profile, seed=42),
)
```

---

## 5. Running Scenarios

### 5.1 Prerequisites

The agent connects to **live Firestore** using your backend config (same
credentials as `uvicorn app.main:app`). Make sure your `.env` or environment
has `FIREBASE_PROJECT_ID` and credentials configured.

```bash
cd backend
```

### 5.2 CLI Commands

```bash
# List all available profiles
python -m tests.pulse_agent.run_scenarios --list

# Run a single profile
python -m tests.pulse_agent.run_scenarios --profile gifted

# Run with fewer sessions (quick smoke test)
python -m tests.pulse_agent.run_scenarios --profile gifted --sessions 3

# Clean Firestore data first, then run
python -m tests.pulse_agent.run_scenarios --profile gifted --clean

# Run all profiles with reports saved to disk
python -m tests.pulse_agent.run_scenarios --all --clean --output ./reports

# Reproducible run with explicit seed
python -m tests.pulse_agent.run_scenarios --profile steady --seed 42
```

### 5.3 CLI Flags Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--profile NAME` | Run a single named profile | — |
| `--all` | Run all 6 built-in profiles | — |
| `--sessions N` | Override session count per profile | Profile's `target_sessions` |
| `--clean` | Delete all Firestore data for the synthetic student before running | Off |
| `--output DIR` | Save Markdown reports + JSON timelines to this directory | Console only |
| `--seed N` | Random seed for reproducible score generation | 42 |
| `--list` | Print available profiles and exit | — |

### 5.4 What Happens During a Run

For each profile, the agent:

1. **(Optional) Cleanup** — Deletes all mastery_lifecycles, abilities, pulse_sessions,
   and pulse_state for the synthetic student_id
2. **Loop N sessions:**
   - Calls `PulseEngine.assemble_session()` — gets items with bands (frontier/current/review)
   - For each item, the `ScoreStrategy` generates a score
   - Calls `PulseEngine.process_result()` — IRT updates theta, mastery engine checks gates,
     leapfrog logic checks frontier probes
   - `JourneyRecorder` snapshots all mastery_lifecycles and abilities from Firestore
3. **Assertions** — Runs archetype-specific checks (see section 6)
4. **Reports** — Generates Markdown with timeline tables, theta progression, gate progression

---

## 6. Assertions — What "Correct" Looks Like

After a journey completes, assertions validate that the Pulse engine behaved
sensibly for the given archetype. These catch regressions in the adaptive logic.

### 6.1 Assertion Catalog

| Assertion | What it checks |
|-----------|---------------|
| `leapfrog_count` | Number of leapfrog events is within expected range |
| `gate_progression` | At least N gate advances occurred across the journey |
| `theta_trend` | Average theta across skills is increasing/stable/decreasing as expected |
| `no_stuck_skills` | No subskill stays at gate 0 for more than N sessions after first encounter |
| `cold_start_frontier_heavy` | First session of a cold-start student has 80%+ frontier probes |
| `struggling_no_leapfrog` | Struggling students never trigger leapfrogs |
| `skill_diversity` | Student encountered at least N distinct skills |

### 6.2 Assertions per Archetype

| Archetype | Assertions Applied |
|-----------|-------------------|
| **gifted** | leapfrog_count >= 1, gate_progression >= 3, theta increasing, skill diversity |
| **steady** | leapfrog_count 0-2, gate_progression >= 1, theta increasing, skill diversity |
| **struggling** | no leapfrogs, theta stable (not rising), skill diversity |
| **cold_start** | first session 80%+ frontier probes, skill diversity |
| **accelerating** | theta increasing, gate_progression >= 2, skill diversity |
| **selective_weakness** | theta increasing overall, skill diversity |

### 6.3 Reading Assertion Output

```
============================================================
  Gifted Grace (gifted)
============================================================
  Sessions: 15
  Items:    90
  Leapfrogs: 3
  Gate advances: 12
  Skills touched: 8

  [PASS] skill_diversity: Unique skills touched: 8 (expected >= 2)
  [PASS] leapfrog_count: Leapfrogs: 3 (expected 1-inf)
  [PASS] gate_progression: Gate advances: 12 (expected >= 3)
  [PASS] theta_trend: theta trend: increasing, delta=+2.31

  >> ALL ASSERTIONS PASSED
```

If an assertion fails, it means the Pulse engine did something unexpected for
that student type — investigate the journey report for details.

---

## 7. Reports — Understanding the Output

When you pass `--output DIR`, the framework generates two types of files per profile:

### 7.1 Journey Report (Markdown)

**File:** `journey_report_{ProfileName}.md`

Contains:

| Section | What it shows |
|---------|--------------|
| **Header** | Profile metadata, total stats |
| **Assertions** | Pass/fail table |
| **Session Timeline** | Per-session table: avg score, band counts (F/C/R), leapfrogs, gate advances |
| **Theta Progression** | Table tracking theta per skill across sessions |
| **Gate Progression** | Table tracking gate level per subskill across sessions |
| **Leapfrog Events** | Details of each leapfrog: which skill was probed, what was inferred |
| **Last Session Detail** | Item-by-item breakdown of the final session |

### 7.2 Journey Timeline (JSON)

**File:** `journey_{ProfileName}_{StudentId}.json`

Raw structured data for programmatic analysis. Contains the full `JourneyTimeline`
with every `SessionSnapshot`, every `ItemResult`, and every Firestore state snapshot.

Useful for:
- Custom analysis scripts
- Comparing runs across code changes
- Feeding into dashboards or notebooks

### 7.3 Comparison Report (Markdown)

**File:** `comparison_report.md` (generated with `--all`)

Side-by-side table of all profiles plus per-profile assertion summaries. Shows
at a glance whether all archetypes are progressing as expected.

---

## 8. Interpreting Results — What to Look For

### 8.1 Healthy Gifted Journey

- **Leapfrogs:** At least 1-2 leapfrog events in early sessions
- **Theta:** Starts ~3.0 (default), rises to 7.0+ rapidly
- **Gates:** Multiple skills reach gate 1-2 by session 5
- **Bands:** Frontier probes appear and pass; subsequent sessions shift to more current-band items
- **DAG movement:** Unique skills touched should grow quickly (leapfrog skips ancestors)

### 8.2 Healthy Steady Journey

- **Leapfrogs:** 0-2 (frontier probes at score ~6 usually fail the 7.5 threshold)
- **Theta:** Gradual increase from 3.0 to 5-6 over 20 sessions
- **Gates:** Gate 0 -> 1 transitions after 3 passing lesson evals (score >= 9.0 is hard at 7.5 avg)
- **Bands:** Mostly current-band items; review items appear after gate 1 retests become eligible

### 8.3 Healthy Struggling Journey

- **Leapfrogs:** Zero (scores 3-5 never pass frontier threshold)
- **Theta:** Stays flat around 3-4 or even drifts slightly down
- **Gates:** Stuck at gate 0; few if any gate advances
- **Bands:** Mostly current-band items at low modes (1-2, concrete scaffolding)
- **Red flag if:** Theta somehow rises above 5.0, or leapfrogs occur

### 8.4 Healthy Cold-Start Journey

- **Session 1:** 80-100% frontier probes (the `is_cold_start` flag triggers this)
- **Theta:** Seeded from probe results, should settle around 5-7 depending on scores
- **Subsequent sessions:** Shift from frontier to current-band as mastery data accumulates

### 8.5 Healthy Accelerating Journey

- **Early sessions (1-5):** Low scores, no gate advances, theta near default
- **Mid sessions (6-12):** Scores crossing 7-8, theta climbing, first gate advances
- **Late sessions (13-20):** Scores hitting 9+, rapid gate advancement, possible leapfrogs
- **Theta curve:** Should look roughly linear or slightly concave-up

### 8.6 Red Flags (Any Archetype)

| Signal | Possible Issue |
|--------|---------------|
| Theta never changes | CalibrationEngine not updating abilities |
| Gates never advance despite high scores | MasteryLifecycleEngine gate thresholds misconfigured |
| Leapfrogs on low scores | Frontier pass threshold too low or aggregate scoring broken |
| Zero frontier probes on cold start | Cold-start detection in PulseEngine broken |
| Same items repeated every session | Primitive history / diversity tracking broken |
| All sessions fail with errors | Service dependency issue (Firestore, DAG data missing) |

---

## 9. Extending the Framework

### 9.1 Adding a New Archetype

1. **Define the profile** in `profiles.py` (student_id in 900,000+ range)
2. **Create a strategy** in `scenarios.py` (subclass `ScoreStrategy`)
3. **Register both** in `ALL_PROFILES` and `STRATEGY_MAP`
4. **Add assertions** in `assertions.py` — add a case to `run_assertions_for_archetype()`
5. **Run it:** `python -m tests.pulse_agent.run_scenarios --profile your_name --clean`

### 9.2 Adding New Assertions

Write a function in `assertions.py` that takes a `JourneyTimeline` and returns
an `AssertionResult`:

```python
def assert_review_band_appears(
    timeline: JourneyTimeline,
    by_session: int = 5,
) -> AssertionResult:
    """Review items should appear by session N (after gate 1 retests are due)."""
    for s in timeline.sessions:
        if s.session_number <= by_session and s.band_counts.get("review", 0) > 0:
            return AssertionResult(
                name="review_band_appears",
                passed=True,
                message=f"Review band first appeared in session {s.session_number}",
            )
    return AssertionResult(
        name="review_band_appears",
        passed=False,
        message=f"No review items appeared in first {by_session} sessions",
    )
```

Then add it to the relevant archetype case in `run_assertions_for_archetype()`.

### 9.3 Programmatic Use (Without CLI)

You can drive the agent from any Python async context:

```python
import asyncio
from tests.pulse_agent.run_scenarios import build_engine
from tests.pulse_agent.agent import PulseAgentRunner
from tests.pulse_agent.profiles import GIFTED_STUDENT
from tests.pulse_agent.assertions import run_assertions_for_archetype

async def main():
    pulse_engine, firestore_service = build_engine()
    runner = PulseAgentRunner(pulse_engine, firestore_service, seed=42)

    # Clean slate
    await runner.cleanup_student(GIFTED_STUDENT.student_id)

    # Run 5 sessions
    timeline = await runner.run_profile(GIFTED_STUDENT, session_limit=5)

    # Inspect results
    print(f"Leapfrogs: {timeline.total_leapfrogs}")
    print(f"Skills: {timeline.unique_skills_touched}")

    # Check theta for a specific skill
    for skill_id, ability in timeline.latest_abilities().items():
        print(f"  {skill_id}: theta={ability['theta']:.2f}")

    # Run assertions
    results = run_assertions_for_archetype(timeline, "gifted")
    for r in results:
        print(f"  [{'PASS' if r.passed else 'FAIL'}] {r.name}: {r.message}")

asyncio.run(main())
```

### 9.4 Comparing Runs Across Code Changes

1. Run `--all --clean --output ./reports_before` on the current branch
2. Make your Pulse engine changes
3. Run `--all --clean --output ./reports_after` on the updated branch
4. Diff the JSON timelines or Markdown reports to see how behavior shifted

The `--seed` flag ensures identical score sequences, so differences in the
journey are entirely due to engine changes.

---

## 10. Troubleshooting

### "Failed to create pulse session" errors

The PulseEngine needs curriculum data (DAG nodes, subskill definitions) in
Firestore. If your Firestore is empty or missing the `curriculum_graphs` /
`curriculum_published` collections, session assembly will fail.

**Fix:** Ensure your Firestore has been seeded with curriculum data before running
the agent. This is the same data the production frontend needs.

### Sessions complete but assertions all fail

Check the journey report's Session Timeline table. If avg_score is reasonable
but gates never advance, the mastery threshold (9.0) may be too high for
the strategy's score range. Adjust the strategy's base scores or the assertion
expectations.

### Cleanup doesn't fully reset

The `cleanup_student()` method deletes documents from known collections. If the
Pulse engine writes to a new collection that cleanup doesn't know about, you
may see stale data. Update `agent.py:cleanup_student()` to include the new
collection.

### Reproducibility issues

Different runs with the same `--seed` should produce identical score sequences.
If results differ, check whether:
- The PulseEngine's item ordering changed (different items = different strategy scores)
- Firestore had leftover data (use `--clean`)
- A non-deterministic service (e.g., Gemini API) is being called in the engine path
