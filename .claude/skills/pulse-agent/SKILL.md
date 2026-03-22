# Pulse Agent — Synthetic Student Journey Simulator

Run synthetic student profiles through the Pulse adaptive loop to validate progression logic (IRT, mastery gates, leapfrog, band allocation) without a real student or browser.

**Arguments:** `/pulse-agent [command] [options]`
- `/pulse-agent` or `/pulse-agent list` — list available profiles
- `/pulse-agent gifted` — run a single profile
- `/pulse-agent all` — run all 6 profiles with comparison report
- `/pulse-agent gifted --sessions 3` — quick smoke test (fewer sessions)
- `/pulse-agent gifted --clean` — wipe Firestore data before running

## Required Reading

Before modifying the framework, read:
- `backend/docs/PULSE_AGENT_TESTING.md` — full documentation
- `backend/tests/pulse_agent/profiles.py` — student definitions
- `backend/tests/pulse_agent/scenarios.py` — score strategies

## When to Use This Skill

- Testing Pulse engine changes (IRT, mastery gates, leapfrog, band allocation)
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
| `/pulse-agent gifted` | `--profile gifted --clean --output ./reports` |
| `/pulse-agent all` | `--all --clean --output ./reports` |
| `/pulse-agent steady --sessions 5` | `--profile steady --sessions 5 --clean --output ./reports` |

Default behavior:
- Always use `--clean` (clean slate is safer for reproducibility)
- Always use `--output ./reports` (save reports for review)
- Default seed is 42 (reproducible)

### Step 2: Check Prerequisites

Before running, verify:

1. **Backend can import cleanly:**
```bash
cd backend && python -c "from app.services.pulse_engine import PulseEngine; print('OK')"
```

2. **Firestore credentials are configured** (the agent uses live Firestore):
```bash
cd backend && python -c "from app.core.config import settings; print(settings.FIREBASE_PROJECT_ID)"
```

If either fails, tell the user what's missing and stop.

### Step 3: Run the Agent

For `list`:
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --list
```

For a single profile:
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> --clean --sessions <N> --seed 42 --output ./reports
```

For all profiles:
```bash
cd backend && python -m tests.pulse_agent.run_scenarios --all --clean --seed 42 --output ./reports
```

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
4. If any assertions failed, explain what went wrong and what to investigate

**For all profiles:**
1. Show the comparison table from the comparison report
2. Flag any profiles where assertions failed
3. Summarize the overall health of the Pulse engine

### Step 5: Investigate Failures (if any)

If assertions fail or the user wants to dig deeper:

1. Read the full journey report: `backend/reports/journey_report_<ProfileName>.md`
2. Check the theta progression table — is theta trending correctly?
3. Check the gate progression table — are gates advancing at the right pace?
4. Check leapfrog events — did they fire when expected?
5. Look at band allocation — does the F/C/R split match expectations?

Offer to:
- Re-run with more sessions (`--sessions 30`) for a longer journey
- Re-run with a different seed to check if the failure is seed-dependent
- Read PulseEngine source to diagnose the root cause

### Step 6: Save Results Summary

After presenting results, offer to update the eval tracker or save a dated summary:

```
backend/reports/pulse-agent-<YYYY-MM-DD>.md
```

## Available Profiles

| Profile | Archetype | What it tests |
|---------|-----------|---------------|
| `gifted` | High scores (9-10) | Leapfrog triggers, rapid DAG traversal |
| `steady` | Mid scores (7-8) | Linear gate progression, no leapfrogs |
| `struggling` | Low scores (4-6) | Gate stalls, no leapfrogs, theta stability |
| `fraction_weakness` | Mixed (high + low on fractions) | Selective weakness detection |
| `cold_start` | No history | Cold-start band allocation (80%+ frontier) |
| `accelerating` | Improving over time | Growth trajectory, late-stage leapfrogs |

## Expected Behaviors (Quick Reference)

| Archetype | Leapfrogs | Theta Trend | Gates | Cold Start |
|-----------|-----------|-------------|-------|------------|
| gifted | >= 1 | Rising fast | Multiple to G2+ | N/A |
| steady | 0-2 | Rising slow | Some to G1 | N/A |
| struggling | 0 | Flat/stable | Stuck at G0 | N/A |
| cold_start | N/A | N/A | N/A | 80%+ frontier |
| accelerating | Late | Rising (concave-up) | Mid-late advances | N/A |

## Red Flags

| Signal | Likely Issue |
|--------|-------------|
| Theta never changes | CalibrationEngine not writing abilities |
| Gates stuck despite high scores | Mastery gate thresholds misconfigured |
| Leapfrogs on low scores | Frontier pass threshold bug |
| Zero frontier on cold start | Cold-start detection broken |
| Session errors | Firestore connectivity or missing curriculum data |

## Key Files

| File | Purpose |
|------|---------|
| `backend/tests/pulse_agent/agent.py` | Core runner — drives sessions |
| `backend/tests/pulse_agent/profiles.py` | Synthetic student definitions |
| `backend/tests/pulse_agent/scenarios.py` | Score strategies per archetype |
| `backend/tests/pulse_agent/journey_recorder.py` | Firestore state snapshots |
| `backend/tests/pulse_agent/assertions.py` | Progression validation rules |
| `backend/tests/pulse_agent/reports.py` | Markdown report generation |
| `backend/tests/pulse_agent/run_scenarios.py` | CLI entry point |
| `backend/docs/PULSE_AGENT_TESTING.md` | Full documentation |
| `backend/app/services/pulse_engine.py` | The engine being tested |
