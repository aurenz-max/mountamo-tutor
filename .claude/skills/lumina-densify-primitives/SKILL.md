# Lumina Densify Primitives

Audit, revise, and densify eval mode difficulty ladders across Lumina primitives. The goal: **every adjacent pair of eval modes within a primitive must differ by ≤1.0 beta**, and every beta must accurately reflect the mode's actual difficulty.

## Decision Hierarchy

The skill follows a **lightest-touch-first** approach:

```
Audit → find gaps/mispricing
  ├─ Fix: Reorder     (catalog array out of beta order — 1-file fix)
  ├─ Fix: Revise      (beta values are wrong — 2-file fix: catalog + backend registry)
  ├─ Fix: Densify     (gap is real, need a new intermediate mode — 3+ file fix)
  └─ OK: No action    (gap ≤1.0 and betas are accurate)
```

**Revise before densify.** If two modes are β 3.5 and β 5.0 but the actual difficulty difference doesn't justify a 1.5 gap, the right fix is often to move the higher one to β 4.5 — not to invent a new mode at β 4.0. New modes are expensive (generator changes, differentiation logic, ongoing maintenance). Beta revision is a 2-file edit.

## When to Use

- A primitive has adjacent eval modes with >1.0 beta gap
- The PRD or `/pulse-agent` identifies a difficulty cliff
- You suspect beta values don't reflect actual difficulty (mispricing)
- Cross-primitive transitions feel too steep
- Batch audit across a whole domain

## Arguments

**Audit a domain:**
```
/lumina-densify-primitives --audit math
/lumina-densify-primitives --audit all
```

**Fix a specific primitive:**
```
/lumina-densify-primitives regrouping-workbench
```

**Batch from PRD:**
```
/lumina-densify-primitives PRD_K3_CONTENT_DENSITY.md section=4.2 priority=HIGH
```

---

## Architecture

```
Phase 1: Audit           (main agent — read catalog + registry, compute gaps, diagnose)
Phase 2: Propose fixes   (main agent — classify each issue, present plan to user)
Phase 3: Implement       (subagents — reorder/revise/densify as needed)
Phase 4: Type check      (main agent — compile)
Phase 5: Eval test       (focused agent — verify, with G3 differentiation for new modes)
Phase 6: Report          (main agent — updated ladder, gap invariant confirmation)
```

---

## Phase 1: Audit

### 1a. Read the catalog

Read the catalog file for the primitive's domain:
`my-tutoring-app/src/components/lumina/service/manifest/catalog/<domain>.ts`

For each primitive with `evalModes`, extract:
- `evalMode` key
- `beta` value
- `scaffoldingMode`
- `challengeTypes`
- `description`

### 1b. Read the backend registry

Read `backend/app/services/calibration/problem_type_registry.py`

For each primitive found in 1a, extract its registry entries. Flag:
- **Missing entries** — mode in catalog but not in registry. These MUST be added to the registry before the audit is complete.
- **Beta mismatches** — catalog beta ≠ registry beta. **The registry is the source of truth for intentional beta edits.** When a mismatch is found, assume the registry value is correct and revise the catalog to match — unless the user explicitly says otherwise.
- **Orphan entries** — mode in registry but not in catalog

**Critical: Beta mismatches are always bugs.** Every REVISE or DENSIFY action MUST edit both files in the same pass. Never edit the catalog without updating the registry, and never edit the registry without updating the catalog.

### 1c. Compute the gap table

Sort each primitive's modes by beta (ascending). For each adjacent pair, compute the gap:

```
regrouping-workbench
Mode              β     Gap   Catalog Order  Status
────────────────  ────  ────  ─────────────  ──────
add_no_regroup    1.5   —     1              —
subtract_no_reg   2.5   1.0   2              OK
add_regroup       3.5   1.0   3              OK
subtract_regroup  5.0   1.5   4              GAP >1.0
```

### 1d. Check ordering

Verify eval modes appear in beta-ascending order in the catalog array. Non-monotonic ordering is always a bug (the IRT engine reads them in array order for some operations).

### 1e. Cross-primitive transition check (if auditing a domain)

For primitives that feed into each other (e.g., `time-sequencer:read-schedule` → `analog-clock:read`), check that the exit beta of the feeder is within 1.0 of the entry beta of the receiver. Flag transitions where a student would experience a cliff jumping between primitives.

---

## Phase 2: Propose Fixes

For each issue found in the audit, classify it and propose the lightest-touch fix:

### Fix Type: Reorder

**When:** Catalog array has modes out of beta order.
**Cost:** 1 file (catalog).
**Action:** Move the entry to its correct position. No beta changes.

### Fix Type: Revise

**When:** The beta gap between two modes is >1.0, but the actual pedagogical/cognitive distance doesn't warrant a whole new mode. The existing beta values are just mispriced.

**How to decide "revise vs densify":**
Ask: *"Is there a meaningful intermediate skill or scaffolding step between these two modes that a student would need to practice separately?"*

- **No** → Revise. One or both betas are wrong. Adjust them so the gap ≤1.0.
- **Yes** → Densify. The gap represents a real skill jump that needs its own practice mode.

**Cost:** 2 files (catalog beta + backend registry beta).
**Action:** Change the `beta` value on one or both adjacent modes. Present the reasoning:

```
REVISE: multiplication-explorer
  distributive: β 5.0 → β 4.5
  Rationale: distributive with visual arrays is closer to commutative (β 3.5) than
  the current 1.5 gap suggests. Students who understand commutative property can
  handle distributive with array support — it's a 1.0 step, not 1.5.
```

**Rules for beta revision:**
- Revisions ripple: if you lower `distributive` from 5.0→4.5, check that its gap to `missing_factor` (6.5) is still ≤1.0. It would be 2.0 — so `missing_factor` might also need revision or a densify.
- Always check the full ladder after revisions for new gaps.
- Update BOTH catalog and backend registry in the same pass.

### Fix Type: Densify

**When:** There is a genuine intermediate skill/scaffolding step that students need to practice. Revision alone can't close the gap without mispricing the existing modes.

**Cost:** 2-4 files (catalog + backend registry + possibly generator + possibly component).

**For each proposed new mode, specify:**

| Field | Value |
|-------|-------|
| `evalMode` | New mode key |
| `beta` | Target beta (must create ≤1.0 gaps on both sides) |
| `scaffoldingMode` | 1-6, matching pedagogical scaffolding level |
| `challengeTypes` | Array of challenge types |
| `description` | What this mode tests |
| **Shares types with** | Which existing mode(s) share the same challengeTypes |
| **Differentiation** | How the generator will distinguish this from shared modes |

**Differentiation strategies** (only needed when the new mode shares challengeTypes with an existing mode):

| Strategy | When | Example | Reliability |
|----------|------|---------|-------------|
| **post-filter** | Constrain output by data properties | `elapsed_hour`: filter to whole-hour intervals | High (deterministic) |
| **prompt-constrain** | Tell Gemini to generate differently | `fluency_small`: "factors ≤5 only" | Medium (~70% compliance) |
| **config-param** | Generator already has a narrowing config | `add_regroup_3digit`: set `digitCount: 3` | High (if config exists) |

Prefer post-filter for reliability. Gemini ignores prompt constraints ~30% of the time.

**If the mode has unique challengeTypes** (not shared with any other mode), no differentiation is needed — the existing `constrainChallengeTypeEnum` machinery handles it automatically.

### Present the full plan

Show the user a summary table:

```
## Proposed Fixes — regrouping-workbench

| Issue | Fix Type | Change | New Gap |
|-------|----------|--------|---------|
| add_regroup→subtract_regroup: 1.5 gap | REVISE | subtract_regroup β 5.0→4.5 | 1.0 |

Updated ladder after fixes:
| Mode | β (before) | β (after) | Gap |
|------|-----------|-----------|-----|
| add_no_regroup | 1.5 | 1.5 | — |
| subtract_no_regroup | 2.5 | 2.5 | 1.0 |
| add_regroup | 3.5 | 3.5 | 1.0 |
| subtract_regroup | 5.0 | **4.5** | **1.0** ✅ |
```

Or for a densify:

```
| Issue | Fix Type | Change | New Gap |
|-------|----------|--------|---------|
| commutative→distributive: 1.5 gap | DENSIFY | +distributive_visual β 4.0 | 0.5 + 1.0 |
```

**Get user confirmation before proceeding.** The user may disagree with revise vs densify classification or with specific beta targets.

---

## Phase 3: Implement

### For REORDER fixes

Single edit: move the eval mode entry to its correct position in the catalog array. No subagent needed.

### For REVISE fixes

Launch **1 parallel batch** of 2 edits:

**Edit 1: Catalog** — Change the `beta:` value on the target eval mode entry.
**Edit 2: Backend registry** — Change the matching `PriorConfig(beta, ...)` value.

These are simple find-and-replace edits. No subagent needed for small batches; use a subagent if revising 5+ modes across multiple files.

### For DENSIFY fixes

Launch **parallel subagents** grouped by file:

#### Subagent A: "Catalog entries"

```
Add eval mode(s) to existing primitive catalog entries.

<for each primitive being densified>
Primitive ID: `<id>`
Catalog file: `my-tutoring-app/src/components/lumina/service/manifest/catalog/<domain>.ts`

Insert in beta-ascending position within the existing evalModes array:
{
  evalMode: '<mode_key>',
  label: '<Mode Label>',
  beta: <value>,
  scaffoldingMode: <1-6>,
  challengeTypes: ['<type>'],
  description: '<description>',
}
</for each>

Rules:
1. Insert at correct position to maintain beta-ascending order
2. Match existing code style (indentation, trailing commas)
3. Do NOT change any existing eval mode entries
```

#### Subagent B: "Backend registry entries"

```
Add eval mode prior betas to the backend calibration registry.

Registry file: `backend/app/services/calibration/problem_type_registry.py`

<for each primitive being densified>
Primitive ID: `<id>`
Add inside the "<id>" dict:
"<mode_key>": PriorConfig(<beta>, "<description>"),
</for each>

Rules:
1. Beta values MUST exactly match the catalog entry
2. Insert in beta-ascending order within each primitive's dict
3. If a primitive dict doesn't exist, create it with a comment header matching existing style
4. Do NOT modify any existing entries
```

#### Subagent C: "Generator differentiation" (one per primitive that needs it)

Only launch this for new modes that **share challengeTypes with an existing mode**.

```
Add eval mode differentiation to a Lumina generator.

Primitive ID: `<id>`
Generator file: `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<id>.ts`

Modes requiring differentiation:
<for each>
Mode: `<mode_key>` (β <value>)
Shares challengeType `<type>` with: `<existing_mode>` (β <existing_beta>)
Strategy: <post-filter | prompt-constrain | config-param>
Rule: <specific differentiation rule>
</for each>

## Tasks

### Task 1: Read the generator
Understand how it handles eval modes:
- Look for `resolveEvalModeConstraint`, `constrainChallengeTypeEnum`
- Find where post-validation happens
- Note existing CHALLENGE_TYPE_DOCS entries

### Task 2: Implement differentiation

**For post-filter:**
Add AFTER challenge generation, BEFORE return:
```typescript
// ── Semantic differentiation for <mode_key> ──
if (config?.targetEvalMode === '<mode_key>') {
  const before = challenges.length;
  challenges = challenges.filter(ch => {
    return <condition>;
  });
  if (challenges.length < before) {
    console.log(`[<Name>] ${config.targetEvalMode}: filtered ${before - challenges.length} challenges`);
  }
  if (challenges.length < 3) {
    console.warn(`[<Name>] ${config.targetEvalMode}: only ${challenges.length} after filter`);
  }
}
```

**For prompt-constrain:**
Add to the prompt construction:
```typescript
let modeConstraint = '';
if (config?.targetEvalMode === '<mode_key>') {
  modeConstraint = `\nIMPORTANT: <specific constraint>`;
}
```
Inject `modeConstraint` into the Gemini prompt.

### Task 3: Verify mentally
Trace a generation call with `targetEvalMode='<mode_key>'`:
1. Schema constrains to correct challengeTypes?
2. Post-filter narrows output correctly?
3. ≥3 challenges survive filtering?
```

---

## Phase 4: Type Check

```bash
cd my-tutoring-app && npx tsc --noEmit
```

Fix any errors. **Known pre-existing error to IGNORE:** `ManifestViewer.tsx` incomplete `Record<ComponentId, string>`.

---

## Phase 5: Eval Test (Focused Agent)

**Skip this phase for revise-only and reorder-only changes** — no new generation logic was added.

**Run for all densify changes.** Launch a focused QA agent:

```
Verify new eval modes produce valid, differentiated output.

Primitive ID: `<id>`
New modes: <list>
Adjacent existing modes: <list of modes immediately above/below>

## Task 1: Run eval-test

For each mode (new AND adjacent):
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>"

If connection refused, STOP and report: "Dev server not running."

## Task 2: G3 Semantic Differentiation Check

For each new mode that shares challengeTypes with an adjacent mode:
1. Compare generated challenges between the new and existing mode
2. Verify SYSTEMATIC difference (not just random variation)
3. If indistinguishable → CRITICAL

Example:
- `elapsed_hour` (β 4.0) vs `elapsed` (β 5.0) — both use 'elapsed' type
- elapsed_hour should ONLY produce whole-hour intervals
- If elapsed_hour contains "1 hour and 30 minutes" → post-filter is broken

## Task 3: Gap invariant

Recompute the full ladder. Every adjacent pair ≤1.0 beta.

## Task 4: Report

Densification Results — <id>
| Mode (new=*) | β | Gap | Eval | G3 Diff | Verdict |
|--------------|---|-----|------|---------|---------|
| existing_low | 3.5 | — | PASS | — | — |
| *new_mode | 4.0 | 0.5 | PASS | PASS | OK |
| existing_high | 5.0 | 1.0 | PASS | — | — |

## Task 5: Fix issues

If G3 fails: read generator → tighten filter → re-test → re-check.
```

---

## Phase 6: Report

Present the final state:

```
## Difficulty Ladder Update — <primitive>

### Changes
| Mode | Change | β Before | β After |
|------|--------|----------|---------|
| subtract_regroup | REVISED | 5.0 | 4.5 |
| *distributive_visual | NEW | — | 4.0 |

### Files Modified
- `catalog/<domain>.ts` — revised N betas, added N modes
- `problem_type_registry.py` — matching changes
- `gemini-<id>.ts` — added differentiation for N modes (if any)

### Updated Ladder
| Mode | β | Gap | Status |
|------|---|-----|--------|
| ... (full ladder) |

### Gap Invariant: PASS ✅ (max gap: X.X)
```

**Batch summary** (when processing multiple primitives):

```
| Primitive | Reorders | Revisions | New Modes | Max Gap Before | Max Gap After |
|-----------|----------|-----------|-----------|---------------|--------------|
| regrouping-workbench | 0 | 1 | 0 | 1.5 | 1.0 |
| multiplication-explorer | 0 | 2 | 1 | 1.5 | 1.0 |
| coin-counter | 1 | 0 | 0 | — | — |
```

---

## Batch Mode

When processing multiple primitives (from PRD or domain audit):

1. **Phase 1-2** run for ALL primitives — present the full audit + proposed fixes together
2. **Phase 3** groups subagents by file (one catalog subagent per domain, one backend subagent total, one generator subagent per primitive needing differentiation)
3. **Phase 4** runs once after all subagents complete
4. **Phase 5** runs eval-test for all new modes (skip for revise-only primitives)
5. **Phase 6** shows batch summary

---

## Key Rules

1. **Revise before densify.** Only add new modes when beta adjustment can't close the gap.
2. **Bilateral edits are mandatory.** Every beta change MUST touch both `catalog/<domain>.ts` AND `problem_type_registry.py` in the same pass. The registry is the source of truth — when mismatches exist, align the catalog to the registry. Missing registry entries for a primitive are always a bug; add them.
3. **Maintain beta-ascending order** in catalog evalModes arrays.
4. **Differentiation is mandatory** when two modes share challengeTypes. The IRT model can't distinguish modes that produce identical output.
5. **Post-filter > prompt-constrain** for reliability (deterministic vs ~70% Gemini compliance).
6. **Minimum 3 challenges** must survive any post-filter. Below 3 = generation failure.
7. **Check ripple effects.** Revising one beta can create a new gap elsewhere in the ladder. Always recompute the full ladder after revisions.
8. **Cross-primitive transitions matter.** A student finishing `time-sequencer:read-schedule` (β 4.0) starting `analog-clock:read` (β 1.5) is a 2.5 drop — that's fine (easier). But the reverse (graduating from a β 1.5 mode into a β 4.0 mode on another primitive) is a cliff.

## Reference Files

| File | Purpose |
|------|---------|
| `service/evalMode/index.ts` | Shared eval mode utilities (resolveEvalModeConstraint, constrainChallengeTypeEnum) |
| `service/manifest/catalog/<domain>.ts` | Eval mode definitions (single source of truth for frontend) |
| `backend/app/services/calibration/problem_type_registry.py` | Backend beta priors (must match catalog) |
| `docs/PRD_K3_CONTENT_DENSITY.md` § 4 | Full audit + densification plan for K-3 math |
| `docs/lumina_difficulty_calibration_prd.md` § 5.3 | Beta value guidelines by scaffolding mode |
