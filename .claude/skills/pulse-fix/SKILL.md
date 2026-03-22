# Pulse Fix — Structured Fix Workflow for Pulse Agent Findings

Fix bugs identified by `/pulse-agent` reports, with deep root-cause analysis before code changes. Follows the Pulse Agent's diagnostic trail through the engine to understand *what happened*, *why it's a problem*, and *how to fix it* without breaking other archetypes.

**Arguments:** `/pulse-fix [report-file | finding-number]`
- `/pulse-fix` — load the most recent report from `backend/reports/`
- `/pulse-fix 2` — fix only Finding 2 from the most recent report
- `/pulse-fix backend/reports/pulse-agent-2026-03-21.md` — load a specific report
- `/pulse-fix backend/reports/pulse-agent-2026-03-21.md 1,2` — fix Findings 1 and 2 from that report

## Core Principles

1. **Trace before fixing.** Follow the code path the Pulse Agent identified. Read every file and line reference in the finding before writing code.
2. **Understand the archetype.** Different student archetypes stress different code paths. A fix for "gifted" must not break "struggling" or "steady."
3. **Targeted over broad.** Fix the specific code path that fails, not a rewrite of the engine. Pulse is tightly coupled — broad changes cascade.
4. **Propose before coding.** Describe the fix strategy; wait for user approval.
5. **Verify with the agent.** Re-run `/pulse-agent` on the affected profile after fixing — the agent is the test suite.

---

## Phase 0: Parse Arguments & Load Report

### Step 1: Find the report

- If a file path is given, read it directly.
- If no path, find the most recent report:
  ```bash
  ls -t backend/reports/pulse-agent-*.md | head -1
  ```
- If a finding number is given, note it for Phase 1 filtering.

### Step 2: Parse the report structure

Read the report and extract for each finding:

| Field | Source |
|-------|--------|
| Finding number | `## Finding N:` heading |
| Title | Heading text |
| Severity | `**Severity:**` line |
| File + lines | `**File:**` line |
| What happens | `### What happens` section |
| Evidence | `### Evidence` section (logs, tables, data) |
| Root cause | `### Root cause` or `### Likely root cause` section |
| Suggested fix | `### Suggested fix` section |
| Debugging steps | `### Debugging steps` section (if present) |

### Step 3: Parse report metadata

From the report header, extract:
- **Profile:** Which archetype was tested (e.g., "Gifted Grace")
- **Sessions:** How many sessions were run
- **Verdict:** Overall pass/fail count
- **Reproduction command:** From the `## Reproduction` section

### Step 4: Display summary to user

```
Pulse Fix: <report file>
Profile:   <archetype> (<N> sessions)
Verdict:   <X/Y assertions FAIL>

Findings:
| #  | Severity | Title                              | File                  | Lines     |
|----|----------|------------------------------------|-----------------------|-----------|
| 1  | HIGH     | Zero Frontier Probes After Cold... | pulse_engine.py       | 327-349   |
| 2  | HIGH     | Gate-0 Trap — High Scores, Zero... | pulse_engine.py       | 1458-1467 |

Fixing: <all | specific numbers>
```

---

## Phase 1: Deep Trace — Understand What Pulse Did

For each finding being fixed, perform a **full code trace**. This is the most important phase — do not skip steps.

### Step 1: Read the engine source at the cited lines

Read `backend/app/services/pulse_engine.py` at the lines referenced in the finding. Read generously — include 30-50 lines of surrounding context to understand the function boundaries.

### Step 2: Trace the call chain

Starting from the cited code, trace **upstream** (what calls this?) and **downstream** (what does this call?):

```
Entry point (e.g., run_session)
  → Which assembly method? (_assemble_normal, _assemble_cold_start, etc.)
    → Which selection method? (_select_current_items, _select_frontier_items, etc.)
      → Which helper? (_gather_probe_candidates, _get_eval_source, etc.)
        → What data does it read? (gate_map, lifecycle docs, theta, etc.)
```

Use Grep to find call sites:
```bash
# Find all callers of the cited function
grep -n "function_name" backend/app/services/pulse_engine.py
```

### Step 3: Trace the data flow

For each finding, identify:

1. **Input data:** What state drives this code path? (gate_map, mastery lifecycle docs, theta values, band allocations)
2. **Decision points:** What conditions determine the behavior? (if/else, thresholds, filters)
3. **Output effects:** What does this code produce? (session items, gate updates, eval sources)
4. **Side effects:** Does it write to Firestore, update lifecycle docs, trigger other services?

### Step 4: Reproduce the agent's logic

Map the finding's evidence to the code path:

```
Agent observed: "Bands 0/6/0 (F/C/R) — no frontier"
  → This means _assemble_normal() allocated frontier=0
    → Because _gather_probe_candidates() returned empty
      → Because mastered_ids excluded everything within BFS range
        → Because gate >= 1 treats leapfrog-inferred skills as mastered
```

### Step 5: Confirm root cause

After tracing, answer these questions explicitly:

1. **Is the report's root cause analysis correct?** (Sometimes the agent's diagnosis is close but not exact)
2. **Is this a data issue or a logic issue?** (Wrong data flowing in vs. wrong decision on correct data)
3. **What's the minimal code path that needs to change?**
4. **Which other archetypes use this same code path?** (Will the fix affect them?)

Display the trace summary:

```
## Trace: Finding <N> — <title>

Call chain:
  run_session() → _assemble_normal() → _gather_probe_candidates()
  Lines: 327-349, 591-620

Data flow:
  gate_map (from lifecycle docs) → mastered_ids (gate >= 1) → BFS exclusion set

Root cause confirmed: YES/MODIFIED
  <If modified, explain how the actual root cause differs from the report>

Impact on other archetypes:
  - steady: Uses same code path, but has fewer gate-2 skills → less affected
  - struggling: Same path, but almost nothing at gate >= 1 → not affected
  - cold_start: Uses _assemble_cold_start() instead → not affected
```

---

## Phase 2: Classify & Plan Fixes

### Fix Category Decision Tree

For each finding, classify the fix:

```
Is the bug in DATA FLOW (wrong values reaching correct logic)?
├── YES → Is the data wrong at source (Firestore, lifecycle docs)?
│   ├── YES → FIX: DATA-SOURCE — fix how data is written/seeded
│   └── NO  → Is the data filtered/transformed incorrectly before use?
│       ├── YES → FIX: DATA-TRANSFORM — fix filter/map/exclusion logic
│       └── NO  → FIX: DATA-PROPAGATION — fix how data passes between methods
└── NO → Bug is in DECISION LOGIC (correct data, wrong behavior)
    ├── Wrong threshold/condition? → FIX: THRESHOLD — adjust gate/score/count threshold
    ├── Missing code path? → FIX: MISSING-PATH — add branch for unhandled case
    ├── Wrong method called? → FIX: METHOD-DISPATCH — call correct method for context
    ├── Enum/string mismatch? → FIX: TYPE-MISMATCH — fix comparison types
    └── Algorithm insufficient? → FIX: ALGORITHM — improve BFS depth, selection, etc.
```

### Severity-Driven Priority

Fix in this order:
1. **HIGH findings that block progression** — gate traps, zero allocations
2. **HIGH findings that waste capacity** — wrong items selected, no information gain
3. **MEDIUM findings** — suboptimal behavior but not blocking
4. **LOW findings** — cosmetic, reporting accuracy

### Cross-Archetype Impact Check

Before proposing any fix, check which archetypes share the affected code path:

| Code Path | Archetypes That Use It |
|-----------|----------------------|
| `_assemble_cold_start()` | cold_start only |
| `_assemble_normal()` | all post-cold-start sessions |
| `_gather_probe_candidates()` | all (via frontier allocation) |
| `_select_current_items()` | all with current-band items |
| `_get_eval_source()` | all (maps band+gate to eval source) |
| `_handle_leapfrog()` | gifted, accelerating (high scorers) |
| `select_best_mode()` / `theta_to_mode()` | all (eval mode selection) |

---

## Phase 3: Propose Fix Strategy — STOP AND WAIT

**Do NOT start coding.** Present the fix plan and wait for user approval.

### Fix Proposal Template

For each finding:

```
## Proposed Fix: Finding <N> — <title>

**Category:** <DATA-TRANSFORM | THRESHOLD | MISSING-PATH | ALGORITHM | etc.>
**File:** backend/app/services/pulse_engine.py
**Lines:** <specific line range>
**Severity:** <from report>

**What the code does now:**
<2-3 sentences describing current behavior, referencing specific lines>

**Why it's wrong:**
<2-3 sentences explaining the mismatch between intended and actual behavior>

**Proposed change:**
<Specific code change description — what lines change, what the new logic does>

**Report's suggested fix vs. our approach:**
<Compare the report's suggestion with what we're actually doing. Explain if we chose
a different approach and why.>

**Preserves:**
<What existing behavior is explicitly NOT touched>

**Cross-archetype impact:**
<Which archetypes are affected, and expected behavior change for each>

**Risk:**
<What could break — be specific about edge cases>
```

### Ordering Fixes

If multiple findings are interdependent (common in Pulse reports), note the dependency:

```
Dependency: Finding 2 (gate-0 trap) should be fixed before Finding 1 (zero frontier),
because the frontier probe logic depends on correct gate values from eval processing.
```

**Wait for user approval before proceeding to Phase 4.**

---

## Phase 4: Implement Fixes

### Implementation Rules

1. **Read the full function before editing.** PulseEngine methods are long (50-200 lines). Understand the complete function before making surgical edits.

2. **Use Edit tool for surgical changes.** Unlike component rewrites, engine fixes should be minimal and targeted. Use Edit with enough context to make `old_string` unique.

3. **Preserve logging.** The engine has extensive logging for debugging. Don't remove log lines. Add new ones if the fix introduces new decision points.

4. **Add comments for non-obvious changes.** If the fix involves a subtle distinction (e.g., "inferred mastery vs. tested mastery"), add a brief comment explaining why.

5. **Don't change method signatures.** Other services call PulseEngine methods. Changing signatures cascades.

6. **If adding a new field to lifecycle docs:** update `backend/app/models/mastery_lifecycle.py` and any Firestore read/write sites.

7. **If changing thresholds:** define them as named constants, not magic numbers inline.

### Fix Order

Apply fixes in dependency order (from Phase 3 analysis), defaulting to:
1. Data source / type mismatch fixes (foundational)
2. Threshold / condition fixes
3. Algorithm improvements
4. Agent-side fixes (lowest priority, reporting only)

---

## Phase 5: Verify

### 5a. Syntax & Import Check

```bash
cd backend && python -c "from app.services.pulse_engine import PulseEngine; print('Import OK')"
```

### 5b. Run Affected Profile

Re-run the Pulse Agent on the profile from the report:

```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> --clean --sessions <N> --seed 42 --output ./reports
```

Use the **same parameters** as the original report (same seed, same session count, same --clean flag).

### 5c. Check Assertions

Read the new report and compare:

```
Verification: <profile name>
| Assertion           | Before | After  | Notes |
|---------------------|--------|--------|-------|
| theta_trending_up   | PASS   | PASS   | No regression |
| gates_advancing     | FAIL   | PASS   | Fixed: Finding 2 |
| leapfrog_triggered  | FAIL   | PASS   | Fixed: Finding 1 |
| frontier_allocation | FAIL   | PASS   | Fixed: Finding 1 |
```

### 5d. Cross-Archetype Regression Check

Run at least 2 other profiles to check for regressions, prioritizing profiles that share the fixed code path:

```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile steady --clean --sessions 3 --seed 42 --output ./reports
cd backend && python -m tests.pulse_agent.run_scenarios --profile struggling --clean --sessions 3 --seed 42 --output ./reports
```

Check that previously-passing assertions still pass.

### 5e. If Verification Fails

1. Read the new report's evidence for the failing assertion
2. Check if the fix introduced the failure or if it's a pre-existing issue
3. If the fix caused it: adjust the fix and re-run
4. If pre-existing: note it as a separate finding, don't block the current fix

---

## Phase 6: Update Report & Summary

### 6a. Generate Updated Report

Create or update: `backend/reports/pulse-fix-<YYYY-MM-DD>.md`

```markdown
# Pulse Fix Report — <YYYY-MM-DD>

**Source report:** <original report file>
**Profile:** <archetype>
**Findings fixed:** <N of M>

## Fixes Applied

### Finding <N>: <title>
- **Category:** <fix category>
- **Change:** <1-2 sentence description>
- **Lines modified:** <file:lines>
- **Verified:** PASS/FAIL

## Verification Results

| Profile     | Before (assertions) | After (assertions) |
|-------------|--------------------|--------------------|
| gifted      | 2/4 PASS           | 4/4 PASS           |
| steady      | (not run before)   | 4/4 PASS           |
| struggling  | (not run before)   | 3/3 PASS           |

## Files Modified
- `backend/app/services/pulse_engine.py` — <summary of changes>
- `backend/app/models/mastery_lifecycle.py` — <if modified>
```

### 6b. Summary to User

```
Pulse Fix Complete: <N> findings addressed

Fixed:
  + Finding <N>: <title> (<fix category>)

Deferred:
  ~ Finding <N>: <title> — <reason>

Verification:
  - <profile>: <X/Y> assertions pass (was <A/Y>)
  - <profile2>: <X/Y> assertions pass (regression check)

Files Modified:
  - backend/app/services/pulse_engine.py (lines X-Y, A-B)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/reports/pulse-agent-*.md` | Pulse Agent findings — read first |
| `backend/reports/journey_report_*.md` | Full journey details per profile |
| `backend/reports/journey_*.json` | Raw session data |
| `backend/app/services/pulse_engine.py` | The engine — where most fixes go |
| `backend/app/models/mastery_lifecycle.py` | Mastery lifecycle data model |
| `backend/app/services/mastery_lifecycle_engine.py` | Gate transitions, eval processing |
| `backend/app/services/calibration_engine.py` | IRT theta/sigma updates |
| `backend/tests/pulse_agent/agent.py` | Agent runner (for agent-side bugs) |
| `backend/tests/pulse_agent/profiles.py` | Student archetype definitions |
| `backend/tests/pulse_agent/assertions.py` | Pass/fail assertion logic |
| `backend/docs/PULSE_AGENT_TESTING.md` | Full agent documentation |

## Checklist

- [ ] Read pulse agent report and parsed all findings
- [ ] Read engine source at every cited line reference
- [ ] Traced call chain for each finding (upstream + downstream)
- [ ] Traced data flow (inputs, decision points, outputs)
- [ ] Confirmed or corrected the report's root cause analysis
- [ ] Checked cross-archetype impact for each fix
- [ ] Classified each finding with decision tree → fix category
- [ ] Proposed fix strategy to user and received approval
- [ ] Applied fixes in dependency order
- [ ] Import check passes
- [ ] Re-ran affected profile with same parameters — assertions pass
- [ ] Ran 2+ other profiles for regression check
- [ ] Generated fix report
- [ ] Reported summary to user
