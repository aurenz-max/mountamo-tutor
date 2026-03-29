# Pulse Agent — Synthetic Student Journey Simulator

Run synthetic student profiles through the Pulse adaptive loop to validate progression logic (IRT-derived mastery, unified item selection, leapfrog unlock propagation) without a real student or browser.

**Architecture note:** The engine uses a unified model where θ+σ are the single source of truth for mastery state. Gates are derived from `derive_gate_from_irt(θ, σ)` — no stability multipliers or fast-track. Item selection uses a single utility function (pure Fisher information) — no 3-band allocation percentages, no depth_preference multipliers. Frontier probes use a **transfer prior** (student's average θ across known skills) instead of the global default, so strong students' frontier info is realistically low and review items compete fairly via forgetting-driven info rise. Band labels (frontier/current/review) are derived from state for frontend display. Leapfrog only seeds competency docs for unlock propagation — no fabricated θ/σ/lifecycle docs.

**Arguments:** `/pulse-agent [command] [options]`
- `/pulse-agent` or `/pulse-agent list` — list available profiles
- `/pulse-agent gifted` — run a single profile (in-memory, ~3s)
- `/pulse-agent all` — run all profiles with comparison report (in-memory, ~5s)
- `/pulse-agent gifted --sessions 3` — quick smoke test (fewer sessions)
- `/pulse-agent gifted --firestore` — run against real Firestore (slow, for production validation)
- `/pulse-agent gifted --clean` — wipe Firestore data before running (Firestore mode only)
- `/pulse-agent gifted --graph` — include curriculum DAG analysis in the report
- `/pulse-agent gifted --subject Science` — run against a specific subject (default: Mathematics)
- `/pulse-agent gifted --grade 1` — run against 1st grade (default: K)
- `/pulse-agent gifted --subject Science --grade 1` — 1st grade Science
- `/pulse-agent gifted --subject Science --subject "Language Arts" --grade 1` — multiple 1st grade subjects

## Required Reading

Before modifying the framework, read:
- `backend/docs/PULSE_AGENT_TESTING.md` — full documentation
- `backend/tests/pulse_agent/profiles.py` — student definitions
- `backend/tests/pulse_agent/scenarios.py` — score strategies

## When to Use This Skill

- Testing Pulse engine changes (IRT-derived mastery, unified selection, leapfrog)
- Validating that student archetypes progress as expected after code changes
- Smoke-testing the adaptive loop before deploying
- Comparing progression behavior before vs after a change
- Investigating unexpected student trajectories

**DO NOT use this skill for:**
- Testing frontend/UI rendering (use `/eval-test` instead)
- Testing individual primitives or generators
- Non-Pulse backend changes

## Workflow

### Step 1: Parse Arguments

Parse the user's command. Map to CLI flags:

| User says | CLI command |
|-----------|------------|
| `/pulse-agent` or `/pulse-agent list` | `--list` |
| `/pulse-agent gifted` | `--profile gifted --in-memory --output ./reports` → `reports/GK/` |
| `/pulse-agent all` | `--all --in-memory --output ./reports` → `reports/GK/` |
| `/pulse-agent steady --sessions 5` | `--profile steady --sessions 5 --in-memory --output ./reports` |
| `/pulse-agent gifted --graph` | `--profile gifted --graph --in-memory --output ./reports` |
| `/pulse-agent gifted --firestore` | `--profile gifted --clean --output ./reports` |
| `/pulse-agent gifted --subject Science` | `--profile gifted --subject Science --in-memory --output ./reports` |
| `/pulse-agent gifted --grade 1` | `--profile gifted --grade 1 --in-memory --output ./reports` → `reports/G1/` |
| `/pulse-agent gifted --subject Science --grade 1` | `--profile gifted --subject Science --grade 1 --in-memory --output ./reports` → `reports/G1/` |
| `/pulse-agent all --subject "Language Arts" --grade 1` | `--all --subject "Language Arts" --grade 1 --in-memory --output ./reports` → `reports/G1/` |

Default behavior:
- Always use `--in-memory` unless user says `--firestore` (500x faster, fetches graph once then runs locally)
- Always use `--output ./reports` (reports saved to `reports/<grade>/`, e.g. `reports/GK/`)
- Only use `--clean` in Firestore mode (in-memory always starts fresh)
- Default seed is 42 (reproducible)
- Default subject is Mathematics (backward compatible)

### Step 2: Check Prerequisites

Before running, verify:

1. **Backend can import cleanly:**
```bash
cd backend && python -c "from app.services.pulse_engine import PulseEngine; print('OK')"
```

2. **Firestore credentials are configured** (needed even in --in-memory mode for the one-time graph fetch):
```bash
cd backend && python -c "from app.core.config import settings; print(settings.FIREBASE_PROJECT_ID)"
```

If either fails, tell the user what's missing and stop.

### Step 3: Run the Agent

For `list`:
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --list
```

For a single profile (in-memory, ~3s):
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> --subject <Subject> --grade <N> --in-memory --sessions <N> --seed 42 --output ./reports
```

For a single profile with graph analysis:
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> --subject <Subject> --grade <N> --in-memory --graph --sessions <N> --seed 42 --output ./reports
```

For all profiles (in-memory, ~5s):
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --all --subject <Subject> --grade <N> --in-memory --seed 42 --output ./reports
```

For Firestore mode (production validation, slow):
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> --subject <Subject> --grade <N> --clean --sessions <N> --seed 42 --output ./reports
```

**Note:** `--subject` defaults to `Mathematics`, `--grade` defaults to `K` (kindergarten). The grade and subject are combined to form the Firestore subject_id: `Mathematics` + grade `1` → `MATHEMATICS_G1`. Repeat `--subject` to load multiple graphs for the same grade.

Show the user the real-time output as sessions run. Each session logs:
```
Session 3/15: avg=9.2, leapfrogs=1, gate_advances=2, bands={'frontier': 1, 'current': 4, 'review': 1}
```

### Step 4: Present Results

After the run completes, present a clear summary:

**For single profile:**
1. Show the assertion results (PASS/FAIL table)
2. Read the generated report file and show the Session Timeline table
3. Highlight any notable events (leapfrogs, rapid theta growth, stuck skills)
4. If `--graph` was used, read the Curriculum DAG Analysis section and discuss:
   - Whether the nodes/edges in the DAG match expected skill progression
   - Whether leapfrog ancestor chains follow valid prerequisite paths
   - What the next-step candidates are and whether they make sense
   - Any orphan inferences (skills inferred that aren't in the DAG ancestor chain)
5. If any assertions failed, explain what went wrong and what to investigate

**For all profiles:**
1. Show the comparison table from the comparison report
2. Flag any profiles where assertions failed
3. Summarize the overall health of the Pulse engine

### Step 5: Investigate Failures (if any)

If assertions fail or the user wants to dig deeper:

1. Read the full journey report: `backend/reports/<Grade>/journey_report_<ProfileName>_<SUBJECT_ID>.md`
2. Check the theta progression table — is theta trending correctly?
3. Check the gate progression table — are gates advancing at the right pace?
4. Check leapfrog events — did they fire when expected?
5. Look at band distribution — are bands emergent from utility ranking as expected?

Offer to:
- Re-run with more sessions (`--sessions 30`) for a longer journey
- Re-run with a different seed to check if the failure is seed-dependent
- Read PulseEngine source to diagnose the root cause

### Step 6: Save Results Summary

After presenting results, offer to update the eval tracker or save a dated summary:

```
backend/reports/<Grade>/pulse-agent-<YYYY-MM-DD>.md
```

## Available Profiles

| Profile | Archetype | What it tests |
|---------|-----------|---------------|
| `gifted` | High scores (9-10) | IRT-derived gate progression, leapfrog unlock propagation |
| `steady` | Mid scores (7-8) | Linear IRT convergence, gradual gate advancement |
| `struggling` | Low scores (4-6) | IRT convergence stability, stuck at gate 0 |
| `fraction_weakness` | Mixed (high + low on subject-specific cluster) | Selective weakness detection (fractions/forces/grammar by subject) |
| `cold_start` | No history | Cold-start frontier probe assembly |
| `forgetful` | Good scores, 20% review forgetting | Retention/stability model |
| `accelerating` | Improving over time | Growth trajectory, accelerating gate advances |
| `shallow_roots` | Aces frontier, fails prereqs | Leapfrog unlock + natural validation via utility scoring |
| `regressing` | Starts strong, declines | θ decline, gate regression |
| `volatile` | Alternating high/low sessions | σ convergence under noisy data |
| `plateau` | Ramps to ~7.5 then flatlines | Mid-gate stall behavior |
| `bursty` | Good scores, 7-day gaps | Effective θ decay formula |

All profiles are **subject-agnostic** — the same archetype works against any curriculum graph. Subject is set at runtime via `--subject`.

## Expected Behaviors (Quick Reference)

| Archetype | Leapfrogs | Theta Trend | Gates (IRT-derived) | Cold Start | Band Mix |
|-----------|-----------|-------------|---------------------|------------|----------|
| gifted | Few (transfer prior keeps frontier info low) | Rising fast (+0.75 over 60s) | G4 ~13% by session 60 | N/A | Mostly current/review (0/6/0) |
| steady | 0-2 | Rising slow | G1 via IRT convergence | N/A | Current-heavy |
| struggling | 0 | Flat/stable | Stuck at G0 — P(correct) too low | N/A | Current-heavy |
| cold_start | N/A | N/A | N/A | 80%+ frontier | All frontier (session 1 only) |
| accelerating | Few, late | Rising (concave-up, +2.0 over 60s) | G3 by session 60, G4 needs more time | N/A | Frontier early → current/review late |
| shallow_roots | >= 1 | Mixed | Ancestors unlocked, tested naturally | N/A | Mixed |

## Red Flags

| Signal | Likely Issue |
|--------|-------------|
| Theta never changes | CalibrationEngine not writing abilities |
| Gates stuck despite high θ and low σ | `derive_gate_from_irt()` thresholds misconfigured |
| All items same band (e.g., 6/0/0 frontier every session) | Transfer prior not working — check `transfer_prior` computation in `_assemble_unified()`. Frontier info should be low for strong students. |
| Gifted student not mastering (low G4 count) | Review items losing to frontier in utility ranking — verify no multipliers on frontier info (depth_preference was removed for this reason) |
| Leapfrogs on low scores | Frontier pass threshold bug |
| Leapfrog-unlocked skills never appear | Competency docs not propagating unlocks |
| Zero frontier on cold start | Cold-start detection broken |
| Session errors (Firestore mode) | Firestore connectivity or missing curriculum data |
| Session errors (in-memory mode) | Missing method on InMemoryFirestoreService — add it |

## Key Files

| File | Purpose |
|------|---------|
| `backend/tests/pulse_agent/agent.py` | Core runner — drives sessions |
| `backend/tests/pulse_agent/in_memory_firestore.py` | In-memory FirestoreService (500x faster) |
| `backend/tests/pulse_agent/profiles.py` | Synthetic student definitions |
| `backend/tests/pulse_agent/scenarios.py` | Score strategies per archetype |
| `backend/tests/pulse_agent/journey_recorder.py` | Firestore state snapshots |
| `backend/tests/pulse_agent/assertions.py` | Progression validation rules |
| `backend/tests/pulse_agent/reports.py` | Markdown report generation |
| `backend/tests/pulse_agent/run_scenarios.py` | CLI entry point (`--in-memory` flag) |
| `backend/docs/PULSE_AGENT_TESTING.md` | Full documentation |
| `backend/app/services/pulse_engine.py` | The engine being tested |
