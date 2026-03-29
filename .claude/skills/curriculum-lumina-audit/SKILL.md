# Curriculum-Lumina Audit — Primitive Coverage & Gap Analysis Loop

Bidirectional audit between curriculum content and Lumina primitives. Finds where curriculum is underusing available primitives, where primitives need development to serve curriculum goals, and drives the fix loop in both directions.

**Arguments:** `/curriculum-lumina-audit [command] [subject_id] [options]`

## Commands

| Command | Example | Purpose |
|---------|---------|---------|
| `audit` | `/curriculum-lumina-audit audit SCIENCE_G1` | Full audit: pull curriculum, cross-ref catalog, classify every subskill |
| `audit` | `/curriculum-lumina-audit audit SCIENCE_G1 --unit SCI002` | Audit a single unit |
| `upgrade` | `/curriculum-lumina-audit upgrade SCIENCE_G1` | Re-author RED/YELLOW subskills with better primitives |
| `gaps` | `/curriculum-lumina-audit gaps SCIENCE_G1` | Generate primitive development requirements (EVAL_TRACKER format) |
| `unused` | `/curriculum-lumina-audit unused` | Show all catalog primitives not used by any curriculum |
| `full-loop` | `/curriculum-lumina-audit full-loop SCIENCE_G1` | Run audit → upgrade → gaps → report in sequence |

---

## Architecture

### Data Sources

1. **Curriculum** — Authoring service at `http://localhost:8001`
   - `GET /api/ai/author-previews/{subject_id}?grade=X` — all units with skills/subskills
   - Each subskill has `target_primitive`, `subskill_description`, `difficulty_start/end`, `standards_alignment`

2. **Lumina Catalog** — TypeScript catalog files at `my-tutoring-app/src/components/lumina/service/manifest/catalog/`
   - Domain catalogs: `math.ts`, `literacy.ts`, `engineering.ts`, `science.ts`, `biology.ts`, `astronomy.ts`, `physics.ts`, `media.ts`, `core.ts`, `assessment.ts`
   - Each entry: `id`, `description`, `constraints`, `supportsEvaluation`, optional `tutoring` scaffold
   - Index: `index.ts` exports `UNIVERSAL_CATALOG` and `CATALOGS_BY_DOMAIN`

3. **Eval Tracker** — `my-tutoring-app/qa/EVAL_TRACKER.md`
   - Format for primitive development requirements and issue tracking

### Generic Primitives (always flag for replacement)

These are filler — they indicate curriculum was authored without considering what Lumina can do:

```
multiple-choice, design-challenge, free-response, matching, fill-in-the-blank,
drag-and-drop, true-false, short-answer
```

### Subject-to-Catalog Domain Mapping

When auditing a subject, load the relevant catalog domains for primitive matching:

| Subject Pattern | Primary Catalogs | Secondary Catalogs |
|----------------|-----------------|-------------------|
| `MATHEMATICS_*` | math | core, assessment |
| `LANGUAGE_ARTS_*` | literacy | core, media, assessment |
| `SCIENCE_*` | science, engineering, biology, astronomy, physics | core, assessment |
| `SOCIAL_STUDIES_*` | core, media | assessment |

---

## Command: `audit`

Pull curriculum and classify every subskill by primitive quality.

### Phase 1: Load Data

1. **Pull curriculum:**
   ```bash
   curl -s "http://localhost:8001/api/ai/author-previews/{subject_id}?grade={grade}"
   ```
   Parse all units → skills → subskills. If `--unit` specified, filter to that unit only.

2. **Load catalog primitives:**
   Read the relevant catalog `.ts` files based on subject-to-catalog mapping.
   Extract all primitive IDs with their descriptions and constraints.
   Build a lookup: `primitive_id → { description, constraints, supportsEvaluation, hasTutoring, catalogDomain }`

### Phase 2: Classify Every Subskill

For each subskill, assign a classification:

| Class | Color | Meaning | Action |
|-------|-------|---------|--------|
| **STRONG** | GREEN | Using a domain-specific primitive that matches the pedagogical goal | None |
| **UPGRADEABLE** | YELLOW | Using a primitive, but a better/more specific one exists in the catalog | Propose swap |
| **GENERIC** | RED | Using a generic primitive (multiple-choice, etc.) when domain primitives exist | Must replace |
| **NO_PRIMITIVE** | PURPLE | Pedagogical concept has no suitable primitive in ANY catalog | Primitive dev needed |
| **AI_TUTOR** | BLUE | Targets an AI tutoring session (no primitive needed) | Review if primitive could enhance |

#### Classification Logic

```
1. If target_primitive is empty/null → PURPLE (NO_PRIMITIVE)
2. If target_primitive is in GENERIC_LIST → RED (GENERIC)
3. If target_primitive exists in catalog AND matches subskill pedagogy → GREEN (STRONG)
4. If target_primitive exists but a MORE SPECIFIC primitive exists for this concept → YELLOW (UPGRADEABLE)
5. If target_primitive is "ai-tutor-session" → BLUE (AI_TUTOR)
```

For YELLOW classification, use this heuristic:
- Read the subskill description (Focus/Examples/Constraints)
- Read the assigned primitive's `description` and `constraints`
- Scan the full catalog for primitives whose description better matches the subskill's Focus
- A primitive is "better" if it:
  - Is purpose-built for the exact concept (e.g., `lever-lab` for lever concepts vs generic `design-challenge`)
  - Has grade-band constraints matching the subskill's difficulty
  - Has `supportsEvaluation: true` (can be assessed)
  - Has a `tutoring` scaffold (richer AI integration)

### Phase 3: Present Audit Report

#### Summary Dashboard

```
## Curriculum-Lumina Audit: {SUBJECT_ID}

| Metric | Value |
|--------|-------|
| Total subskills | 92 |
| GREEN (strong match) | 64 (70%) |
| YELLOW (upgradeable) | 12 (13%) |
| RED (generic → replace) | 10 (11%) |
| PURPLE (no primitive) | 4 (4%) |
| BLUE (AI tutor) | 2 (2%) |
| Unique primitives used | 28 / 153 |
| Catalog utilization | 18% |
```

#### Per-Unit Breakdown

```
### SCI001: Physical Sciences — Sound and Light

| Subskill | Current Primitive | Class | Recommended | Rationale |
|----------|------------------|-------|-------------|-----------|
| SCI001-01-a | sound-wave-explorer | GREEN | — | Purpose-built for vibration observation |
| SCI001-01-c | multiple-choice | RED | knowledge-check | MC about sound properties → knowledge-check has richer assessment |
| SCI001-03-b | multiple-choice | RED | sorting-station | Classifying materials by transparency → sorting-station with material categories |
| SCI001-04-d | multiple-choice | RED | vehicle-comparison-lab | Comparing communication devices → vehicle-comparison-lab with device data |
```

#### Primitive Recommendations

For each RED/YELLOW subskill, provide:

```
#### SCI001-01-c → knowledge-check (RED → GREEN)
- **Current:** multiple-choice — "Identify the relationship between a vibrating object and sound"
- **Proposed:** knowledge-check — Multi-phase knowledge assessment with scaffolded hints
- **Why better:** knowledge-check supports MC + short-answer + explain phases, has eval modes, has AI tutoring scaffold
- **Confidence:** HIGH — direct conceptual match, same grade band
- **Subskill description change needed:** No — current description works with new primitive
```

#### PURPLE Items (Primitive Development Needed)

For each PURPLE subskill, generate an EVAL_TRACKER-style requirement:

```
#### PRIM-REQ-001: Sound Recording Studio
- **Curriculum need:** SCI001-07-c — "Design a device that uses light or sound to send a signal"
- **Pedagogical goal:** Students build a simple communication device (flashlight morse code, tin-can phone)
- **Why no existing primitive fits:** Closest is `design-challenge` (too generic) or `construction-sequence-planner` (sequencing only, no signal testing)
- **Proposed primitive:** `signal-designer` — students pick signal type (light/sound), build a sender/receiver, test message transmission
- **Grade band:** K-2
- **Eval modes needed:** design (build device), test (send message), compare (which signal travels farther)
- **Complexity estimate:** MEDIUM — needs signal animation, sender/receiver model, message verification
- **Catalog domain:** science or engineering
```

---

## Command: `upgrade`

Re-author RED and YELLOW subskills to use better primitives.

### Steps

1. **Run audit** (or use cached audit results from same conversation)
2. **Present upgrade plan** to user for approval:
   ```
   ## Upgrade Plan: SCIENCE_G1

   Will re-author 10 subskills:
   | Subskill | From | To | Confidence |
   |----------|------|----|------------|
   | SCI001-01-c | multiple-choice | knowledge-check | HIGH |
   | SCI001-03-b | multiple-choice | sorting-station | HIGH |
   ...

   Approve? (y/n/select specific ones)
   ```

3. **For each approved upgrade**, call `POST /api/ai/generate-skill` to regenerate the subskill with the new target primitive, OR if the subskill description just needs the `target_primitive` field swapped (description already fits), use a direct Firestore update if available.

4. **For subskills needing description rewrites** (the Focus/Examples/Constraints need to match the new primitive's capabilities):
   - Read the new primitive's `description` and `constraints` from the catalog
   - Generate a new subskill description that leverages the primitive's specific features
   - Use the authoring service to update

5. **Log all changes:**
   ```
   [UPGRADE] SCI001-01-c: multiple-choice → knowledge-check (description updated)
   [UPGRADE] SCI001-03-b: multiple-choice → sorting-station (description rewritten)
   ```

6. **Re-run audit** on upgraded subskills to verify they now classify as GREEN.

---

## Command: `gaps`

Generate primitive development requirements for PURPLE subskills.

### Output Format

Write requirements to `my-tutoring-app/qa/PRIMITIVE_GAPS.md` in EVAL_TRACKER-compatible format:

```markdown
# Primitive Gap Tracker

> Primitives needed by curriculum but not yet built.
> Generated by `/curriculum-lumina-audit gaps`.
> Pick up requirements with `/primitive` skill.

## Gap Dashboard

| ID | Subject | Subskills Blocked | Proposed Primitive | Complexity | Status |
|----|---------|-------------------|-------------------|------------|--------|
| GAP-001 | SCIENCE_G1 | 3 | signal-designer | MEDIUM | OPEN |
| GAP-002 | LANGUAGE_ARTS_G1 | 5 | vocabulary-map | SMALL | OPEN |

---

## GAP-001: signal-designer

**Blocked subskills:** SCI001-07-c, SCI001-07-d, SCI003-02-a
**Pedagogical goal:** Students design and test devices that use light or sound to communicate
**Why no existing primitive fits:** `design-challenge` is too generic, `construction-sequence-planner` is sequencing-only
**Proposed features:**
- Signal type selection (light flash, sound pattern, flag semaphore)
- Sender/receiver builder with components
- Message encoding (simple morse-like patterns)
- Test phase: send a message, verify receiver got it
**Grade band:** K-2 (simple) to 3-5 (morse code, encoding)
**Eval modes:**
- `design` — build a sender from parts
- `test` — transmit a 3-symbol message
- `compare` — which signal type works best for distance/noise
**Catalog domain:** science
**Complexity:** MEDIUM — signal animation, sender/receiver model, message verification
**Standards:** 1-PS4-4 (design a device that uses light or sound to solve the problem of communicating)
```

### Also Flag: Eval Mode Gaps

Sometimes a primitive EXISTS but lacks the eval mode needed for a subskill. These aren't new primitives — they're enhancements:

```markdown
## Eval Mode Gaps

| Primitive | Current Modes | Needed Mode | Blocked Subskills | Complexity |
|-----------|--------------|-------------|-------------------|------------|
| species-profile | (display only) | identify_parts | BIO-SCI002-03-a | SMALL |
| machine-profile | (display only) | identify_components | SCI005-04-d | SMALL |
```

---

## Command: `unused`

Show all catalog primitives not referenced by any curriculum subject.

### Steps

1. Pull all subjects from authoring service
2. Collect all `target_primitive` values across all subjects
3. Read all catalog files, extract all primitive IDs
4. Diff: catalog - used = unused

### Output

```
## Unused Primitives by Domain

### Math (18 unused / 42 total = 57% idle)
| Primitive | Description (truncated) | Eval Support | Best For |
|-----------|------------------------|-------------|----------|
| area-model | Interactive area model for multiplication... | Yes | G3-5 multiplication |
| bar-model | Singapore math bar model... | Yes | G2-5 word problems |
...

### Science (8 unused / 12 total = 67% idle)
...

### Recommendations
- **Quick wins:** 12 primitives that match existing curriculum subskills using generic types
- **Future curriculum:** 15 primitives for grades 2-5 (not yet authored)
- **Questionable:** 5 primitives with no clear curriculum alignment (consider deprecating)
```

---

## Command: `full-loop`

Runs the complete bidirectional audit and improvement cycle.

### Sequence

```
1. AUDIT  → classify all subskills
2. REVIEW → present findings, get user approval on upgrade plan
3. UPGRADE → re-author approved RED/YELLOW subskills
4. GAPS   → generate PRIMITIVE_GAPS.md for PURPLE items
5. UNUSED → flag catalog primitives with no curriculum home
6. REPORT → final summary with before/after metrics
7. PUBLISH → if user approves, publish + deploy changes
```

### Final Report

```
## Full Loop Report: SCIENCE_G1

### Before → After
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| GREEN subskills | 64 | 82 | +18 |
| RED (generic) | 10 | 0 | -10 |
| YELLOW (upgradeable) | 12 | 4 | -8 |
| PURPLE (needs primitive) | 4 | 4 | — |
| Unique primitives | 28 | 41 | +13 |
| Catalog utilization | 18% | 27% | +9% |

### Primitive Development Backlog (from PURPLE items)
Written to: my-tutoring-app/qa/PRIMITIVE_GAPS.md
- GAP-001: signal-designer (3 subskills blocked, MEDIUM)
- GAP-002: experiment-recorder (2 subskills blocked, SMALL)

### Unused Primitives Report
- 71 primitives still unused (most are grade 2-5 content not yet authored)
- 8 quick-win primitives could replace generic types in other subjects

### Next Steps
1. `/primitive signal-designer` — build the highest-impact gap primitive
2. `/curriculum-lumina-audit audit LANGUAGE_ARTS_G1` — audit next subject
3. `/curriculum-author graph SCIENCE_G1` — rebuild graph edges after subskill changes
```

---

## Classification Heuristics — Detailed

### How to Match Subskills to Primitives

When evaluating whether a catalog primitive is a good match for a subskill, check these in order:

1. **Concept alignment** (most important)
   - Does the primitive's `description` cover the same educational concept?
   - e.g., subskill about "sorting objects by properties" → `sorting-station` (direct match)

2. **Interaction model**
   - Does the primitive's interaction style match what the subskill needs?
   - e.g., subskill says "drag items into categories" → needs a sorting/categorization primitive, not a quiz

3. **Grade band fit**
   - Check the primitive's `constraints` for grade-band guidance
   - e.g., `lever-lab` says "seesaw for K-2, excavator/crowbar for 3-5" → use seesaw theme for Grade 1

4. **Eval support**
   - Does the primitive have `supportsEvaluation: true`?
   - Subskills in the mastery pipeline NEED evaluable primitives

5. **Tutoring scaffold**
   - Does the primitive have a `tutoring` object with scaffolding levels?
   - Richer tutoring = better adaptive learning

### Red Flags in Current Assignments

Watch for these patterns that indicate a bad primitive match:

- **Generic primitive for a concept that has a dedicated primitive** — e.g., `multiple-choice` for "identify shapes" when `shape-sorter` exists
- **Wrong domain primitive** — e.g., using a math primitive for a science concept
- **Primitive too advanced** — e.g., `vehicle-design-studio` (grades 2-5) assigned to a Grade 1 subskill
- **Primitive too simple** — e.g., `knowledge-check` for a hands-on building activity
- **Display-only primitive for an assessed subskill** — e.g., `machine-profile` (no eval) for a mastery-gated skill

---

## Logging Standards

```
[AUDIT] {subject_id}: {total} subskills — {green} GREEN, {yellow} YELLOW, {red} RED, {purple} PURPLE
[AUDIT] {subskill_id}: {current_primitive} → {classification} (recommended: {new_primitive}, confidence: {HIGH/MEDIUM/LOW})
[UPGRADE] {subskill_id}: {old_primitive} → {new_primitive} (description {updated|rewritten|unchanged})
[GAP] {gap_id}: {proposed_primitive} — {N} subskills blocked, {complexity}
[UNUSED] {domain}: {N} unused / {total} total ({pct}% idle)
```

---

## Anti-Patterns (DO NOT)

1. **DO NOT recommend primitives you haven't read.** Always read the catalog entry's `description` and `constraints` before recommending it as a replacement.

2. **DO NOT classify subskills as YELLOW without a specific better primitive.** YELLOW means "I found a concrete better option" — not "this could theoretically be improved."

3. **DO NOT generate PRIMITIVE_GAPS for concepts that existing primitives already cover.** Check the FULL catalog (all domains) before declaring a gap.

4. **DO NOT upgrade subskills without checking the primitive's grade-band constraints.** A primitive that's perfect for Grade 5 is wrong for Grade 1.

5. **DO NOT batch-upgrade without user approval.** Present the plan, get a yes, then execute.

6. **DO NOT forget to re-run audit after upgrades.** The whole point is a closed loop — verify the changes actually improved coverage.

7. **DO NOT recommend non-evaluable primitives for mastery-gated subskills.** Check `supportsEvaluation` before recommending.

---

## Checklist

- [ ] Parsed command and arguments (subject_id, optional --unit filter)
- [ ] For `audit`: loaded curriculum + catalog, classified all subskills, presented dashboard + per-unit tables
- [ ] For `upgrade`: presented upgrade plan, got user approval, re-authored subskills, re-audited
- [ ] For `gaps`: generated PRIMITIVE_GAPS.md with blocked subskills and proposed primitives
- [ ] For `unused`: showed unused primitives by domain with recommendations
- [ ] For `full-loop`: ran all phases in sequence, presented before/after report
- [ ] All classifications include rationale and confidence level
- [ ] PURPLE items have EVAL_TRACKER-compatible requirements
- [ ] No primitives recommended without reading their catalog entry
- [ ] User approved all changes before execution
