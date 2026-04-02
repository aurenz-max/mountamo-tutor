# Curriculum-Lumina Audit — Primitive Coverage & Gap Analysis Loop

Bidirectional audit between curriculum content and Lumina primitives. Finds where curriculum is underusing available primitives, where primitives need development to serve curriculum goals, and drives the fix loop in both directions.

> **API Reference:** See `curriculum-authoring-service/README.md` for full endpoint docs, request/response schemas, Firestore collections, and known gotchas.

**Arguments:** `/curriculum-lumina-audit [command] [subject_id] [options]`

## Commands

| Command | Example | Purpose |
|---------|---------|---------|
| `audit` | `/curriculum-lumina-audit audit SCIENCE` | Full audit: pull curriculum, cross-ref catalog, classify every subskill |
| `audit` | `/curriculum-lumina-audit audit SCIENCE --unit SCI002` | Audit a single unit |
| `upgrade` | `/curriculum-lumina-audit upgrade SCIENCE` | Re-author RED/YELLOW subskills with better primitives |
| `gaps` | `/curriculum-lumina-audit gaps SCIENCE` | Generate primitive development requirements (EVAL_TRACKER format) |
| `unused` | `/curriculum-lumina-audit unused` | Show all catalog primitives not used by any curriculum |
| `full-loop` | `/curriculum-lumina-audit full-loop SCIENCE` | Run audit → upgrade → gaps → report in sequence |
| `lineage-check` | `/curriculum-lumina-audit lineage-check SCIENCE` | Pre-publish: verify all subskill ID changes have lineage records |

> **Subject IDs** are bare enums (e.g. `MATHEMATICS`, `LANGUAGE_ARTS`, `SCIENCE`, `SOCIAL_STUDIES`). Grade is a separate parameter, not embedded in the ID. Some subjects include a grade suffix (e.g. `MATHEMATICS_G1` for Grade 1, `MATHEMATICS` for Kindergarten). All write endpoints require both `grade` and `subject_id` as query params — the service validates the pair and gives clear error messages on mismatch. See README § "Subject ID Format" and "Grade Resolution".

---

## Architecture

### Data Sources

1. **Curriculum** — Two read paths available:

   **a. Published curriculum (preferred for audits)** — Backend at `http://localhost:8000`
   - `GET /api/curriculum/curriculum/{subject}` — full hierarchy with `target_primitive` on each subskill
   - `GET /api/curriculum/primitive-mappings/{subject}` — dedicated primitive summary:
     - `mappings`: `{subskill_id → target_primitive}`
     - `primitives`: `{primitive_name → count}` (how many subskills use each)
     - `mapped_count` / `unmapped_count` totals
   - No grade param needed — reads from `curriculum_published/{grade}/subjects/{subject_id}` in Firestore
   - `target_primitive` is available on every subskill in the curriculum tree
   - `target_eval_modes` (list of strings) is available on subskills that have curriculum-assigned eval modes

   **b. Draft curriculum (for auditing unpublished changes)** — Authoring service at `http://localhost:8001`
   - `GET /api/ai/author-previews/{subject_id}?grade={grade}` — all units with skills/subskills
   - `grade` query param is **required** (e.g. `?grade=K`, `?grade=1`)
   - Each subskill has `target_primitive`, `target_eval_modes`, `subskill_description`, `difficulty_start/end`, `standards_alignment`
   - See README § "AI Authoring" for response schema

   > **Which to use:** Default to the published path (a) for audits — it's what Lumina actually reads. Use the draft path (b) when auditing unpublished changes before publishing.

2. **Lumina Catalog** — TypeScript catalog files at `my-tutoring-app/src/components/lumina/service/manifest/catalog/`
   - Domain catalogs: `math.ts`, `literacy.ts`, `engineering.ts`, `science.ts`, `biology.ts`, `astronomy.ts`, `physics.ts`, `media.ts`, `core.ts`, `assessment.ts`
   - Each entry: `id`, `description`, `constraints`, `supportsEvaluation`, optional `tutoring` scaffold
   - Index: `index.ts` exports `UNIVERSAL_CATALOG` and `CATALOGS_BY_DOMAIN`

3. **Eval Tracker** — `my-tutoring-app/qa/EVAL_TRACKER.md`
   - Format for primitive development requirements and issue tracking

### Grade Resolution

To find the grade for a subject_id, call `GET /api/curriculum/subjects` and match. Common grades: `K` (Kindergarten), `1` (First Grade). See README § "Grade Resolution" for the caching mechanism.

### Generic Primitives (always flag for replacement)

These are filler — they indicate curriculum was authored without considering what Lumina can do:

```
multiple-choice, design-challenge, free-response, matching, fill-in-the-blank,
drag-and-drop, true-false, short-answer
```

### Subject-to-Catalog Domain Mapping

When auditing a subject, load the relevant catalog domains for primitive matching:

| Subject ID | Primary Catalogs | Secondary Catalogs |
|------------|-----------------|-------------------|
| `MATHEMATICS` | math | core, assessment |
| `LANGUAGE_ARTS` | literacy | core, media, assessment |
| `SCIENCE` | science, engineering, biology, astronomy, physics | core, assessment |
| `SOCIAL_STUDIES` | core, media | assessment |
| `ABC123` | literacy, math | core, assessment |
| `ARTS` | media, core | assessment |

---

## Command: `audit`

Pull curriculum and classify every subskill by primitive quality.

### Phase 1: Load Data

1. **Pull curriculum:**

   **Published (default)** — use the backend at `http://localhost:8000`:
   ```bash
   # Full hierarchy with target_primitive on each subskill
   curl -s "http://localhost:8000/api/curriculum/curriculum/{subject}"
   # Dedicated primitive summary (mappings, counts, coverage)
   curl -s "http://localhost:8000/api/curriculum/primitive-mappings/{subject}"
   ```
   - `subject` = subject name (e.g. `Mathematics`) or subject_id
   - `primitive-mappings` returns `mappings` (subskill→primitive), `primitives` (primitive→count), `mapped_count`/`unmapped_count`

   **Drafts (unpublished)** — use authoring service at `http://localhost:8001`:
   ```bash
   curl -s "http://localhost:8001/api/ai/author-previews/{subject_id}?grade={grade}"
   ```
   - `subject_id` = bare enum (e.g. `SCIENCE`), `grade` = grade code (e.g. `1`)

   Default to published path — it's what Lumina actually reads. Use drafts when auditing unpublished changes.
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
1. If target_primitive is empty/null → scan catalog for matching primitive by subskill description:
     a. If a matching primitive is found → RED (GENERIC — not assigned, but one exists; treat like a missing assignment)
     b. If no match in any catalog domain → PURPLE (NO_PRIMITIVE)
2. If target_primitive is in GENERIC_LIST → RED (GENERIC)
3. If target_primitive exists in catalog AND matches subskill pedagogy → GREEN (STRONG)
4. If target_primitive exists but a MORE SPECIFIC primitive exists for this concept → YELLOW (UPGRADEABLE)
5. If target_primitive is "ai-tutor-session" → BLUE (AI_TUTOR)
```

> **Important:** Empty `target_primitive` means the *author didn't assign one* — it does NOT mean no primitive exists. Always scan the catalog before classifying as PURPLE. A subskill whose concept clearly maps to an existing primitive (e.g., ordinal position → `ordinal-line`) is RED/upgradeable, not a gap.

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

### Eval Mode Coverage

| Metric | Value |
|--------|-------|
| Subskills with target_primitive in registry | 78 |
| With target_eval_modes assigned | 52 (67%) |
| Missing target_eval_modes | 26 (33%) |
| Using single eval mode (locked) | 40 |
| Using multiple eval modes (IRT-constrained) | 12 |
```

> **Eval mode coverage** measures how many subskills have curriculum-assigned `target_eval_modes`. When present, Pulse selects the IRT-optimal mode *within* the allowed set instead of searching all modes. Missing eval modes means Pulse falls back to unconstrained IRT selection (which may pick a pedagogically wrong mode).

#### Per-Unit Breakdown

```
### SCI001: Physical Sciences — Sound and Light

| Subskill | Current Primitive | Eval Modes | Class | Recommended | Rationale |
|----------|------------------|------------|-------|-------------|-----------|
| SCI001-01-a | sound-wave-explorer | [observe] | GREEN | — | Purpose-built for vibration observation |
| SCI001-01-c | multiple-choice | — | RED | knowledge-check | MC about sound properties → knowledge-check has richer assessment |
| SCI001-03-b | multiple-choice | — | RED | sorting-station | Classifying materials by transparency → sorting-station with material categories |
| SCI001-04-d | multiple-choice | — | RED | vehicle-comparison-lab | Comparing communication devices → vehicle-comparison-lab with device data |
```

> **Eval Modes column:** Shows the subskill's `target_eval_modes` list. "—" means no eval modes assigned (Pulse uses unconstrained IRT selection). Flag GREEN subskills with missing eval modes — they have a primitive but Pulse may pick the wrong mode.

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

> **API details:** See README § "Curriculum CRUD — Subskills" for `PUT` body schema and § "AI Authoring" for `generate-skill`. See README § "Gotchas" item 1 for why `subject_id` query param is required.

### Steps

0. **Smoke test** — Before any bulk operations, verify one read→write→publish roundtrip:
   ```bash
   # 1. Read a subskill (short grade OK here)
   curl -s "http://localhost:8001/api/curriculum/subskills/{any_id}?grade=K&subject_id={subject_id}"
   # 2. Write it back (MUST use long-form grade: Kindergarten, 1st Grade, etc.)
   curl -s -X PUT "http://localhost:8001/api/curriculum/subskills/{any_id}?grade=Kindergarten&subject_id={subject_id}" \
     -H "Content-Type: application/json" -d '{"target_primitive": "same-value"}'
   # 3. Publish
   curl -s -X POST "http://localhost:8001/api/publishing/subjects/{subject_id}/publish?grade=Kindergarten"
   ```
   If any step fails, fix the endpoint formatting before proceeding. See README § "Gotchas" item 1 for the long-form grade requirement.

1. **Run audit** (or use cached audit results from same conversation)
2. **Present upgrade plan** to user for approval:
   ```
   ## Upgrade Plan: SCIENCE (Grade 1)

   Will re-author 10 subskills:
   | Subskill | From | To | Confidence |
   |----------|------|----|------------|
   | SCI001-01-C | multiple-choice | knowledge-check | HIGH |
   | SCI001-03-B | multiple-choice | sorting-station | HIGH |
   ...

   Approve? (y/n/select specific ones)
   ```

3. **Flag compound subskills for splitting.** If a subskill covers two distinct pedagogical concepts (e.g., "compare quantities AND count backward"), it cannot get a clean primitive assignment. Split it into two subskills before upgrading — each gets its own primitive, `subskill_order`, and difficulty range. Use `POST /api/curriculum/subskills?grade={grade}&subject_id={subject_id}` for the new subskill.

4. **For each approved upgrade**, call `POST /api/ai/generate-skill` to regenerate the subskill with the new target primitive, OR if the subskill description just needs the `target_primitive` field swapped (description already fits), patch it directly:
   ```bash
   curl -X PUT "http://localhost:8001/api/curriculum/subskills/{subskill_id}?grade={grade}&subject_id={subject_id}" \
     -H "Content-Type: application/json" \
     -d '{"target_primitive": "new-primitive", "target_eval_modes": ["mode1", "mode2"]}'
   ```
   > **Both `grade` and `subject_id` are required** on all write endpoints. The service validates the pair and returns a clear error on mismatch (README § "Gotchas" item 1).

5. **For subskills needing description rewrites** (the Focus/Examples/Constraints need to match the new primitive's capabilities):
   - Read the new primitive's `description` and `constraints` from the catalog
   - Generate a new subskill description that leverages the primitive's specific features
   - Use `PUT /api/curriculum/subskills/{id}?grade={grade}&subject_id={subject_id}` with the full `SubskillUpdate` body

6. **Log all changes:**
   ```
   [UPGRADE] SCI001-01-C: multiple-choice → knowledge-check (description updated)
   [UPGRADE] SCI001-03-B: multiple-choice → sorting-station (description rewritten)
   [SPLIT] COUNT001-02-E → COUNT001-02-E (comparison-builder) + COUNT001-02-H (number-line)
   ```

7. **Re-run audit** on upgraded subskills to verify they now classify as GREEN.

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
| GAP-001 | SCIENCE | 3 | signal-designer | MEDIUM | OPEN |
| GAP-002 | LANGUAGE_ARTS | 5 | vocabulary-map | SMALL | OPEN |

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

1. Pull all subjects: `GET /api/curriculum/subjects` from backend (`localhost:8000`)
2. For each subject, pull primitive mappings: `GET /api/curriculum/primitive-mappings/{subject}`
   - Returns `primitives` (primitive→count) directly — no need to walk the tree
   - Fallback: `GET /api/ai/author-previews/{subject_id}?grade={grade}` from authoring service
3. Collect all `target_primitive` values across all subjects
4. Read all catalog `.ts` files, extract all primitive IDs
5. Diff: catalog - used = unused

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
1. AUDIT   → classify all subskills
2. REVIEW  → present findings, get user approval on upgrade plan
3. UPGRADE → re-author approved RED/YELLOW subskills
4. GAPS    → generate PRIMITIVE_GAPS.md for PURPLE items
5. UNUSED  → flag catalog primitives with no curriculum home
6. REPORT  → final summary with before/after metrics
7. PUBLISH → if user approves, publish changes (deploys + flattens automatically)
```

> **Publishing is a single action:**
> `POST /api/publishing/subjects/{subject_id}/publish` — creates version snapshot, deploys to `curriculum_published`, and rebuilds graph cache in one step.

### Final Report

```
## Full Loop Report: SCIENCE

### Before → After
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| GREEN subskills | 64 | 82 | +18 |
| RED (generic) | 10 | 0 | -10 |
| YELLOW (upgradeable) | 12 | 4 | -8 |
| PURPLE (needs primitive) | 4 | 4 | — |
| Unique primitives | 28 | 41 | +13 |
| Catalog utilization | 18% | 27% | +9% |
| Eval mode coverage | 52% | 88% | +36% |

### Primitive Development Backlog (from PURPLE items)
Written to: my-tutoring-app/qa/PRIMITIVE_GAPS.md
- GAP-001: signal-designer (3 subskills blocked, MEDIUM)
- GAP-002: experiment-recorder (2 subskills blocked, SMALL)

### Unused Primitives Report
- 71 primitives still unused (most are grade 2-5 content not yet authored)
- 8 quick-win primitives could replace generic types in other subjects

### Next Steps
1. `/primitive signal-designer` — build the highest-impact gap primitive
2. `/curriculum-lumina-audit audit LANGUAGE_ARTS` — audit next subject
3. `/curriculum-graph suggest SCIENCE` — rebuild graph edges after subskill changes
```

---

## Command: `lineage-check`

Pre-publish validation: diff published vs draft subskill_index and verify every removed subskill_id has a lineage record in the `curriculum_lineage` Firestore collection.

### Steps

1. Call `GET /api/lineage/check/{subject_id}` — returns `{total_removed, total_added, covered, missing, is_valid}`
2. If `is_valid == true`: all removed IDs have lineage records. Safe to publish.
3. If `is_valid == false`: list the `missing` IDs and their old descriptions. These **BLOCK publishing**.

### For Each Missing ID

Determine the operation type and create the lineage record:

1. **Was it renamed?** Check if a new subskill with similar description exists in the draft.
   ```bash
   curl -X POST "http://localhost:8001/api/lineage/" \
     -H "Content-Type: application/json" \
     -d '{"old_id": "OLD_ID", "canonical_id": "NEW_ID", "operation": "rename", "subject_id": "SCIENCE"}'
   ```

2. **Was it merged?** Multiple old IDs consolidated into one new ID.
   ```bash
   curl -X POST "http://localhost:8001/api/lineage/" \
     -d '{"old_id": "OLD_ID_1", "canonical_id": "MERGED_ID", "operation": "merge", "subject_id": "SCIENCE", "merge_sources": ["OLD_ID_1", "OLD_ID_2"]}'
   ```

3. **Was it split?** One old ID became multiple new IDs.
   ```bash
   curl -X POST "http://localhost:8001/api/lineage/" \
     -d '{"old_id": "OLD_ID", "canonical_id": "NEW_A", "canonical_ids": ["NEW_A", "NEW_B"], "operation": "split", "subject_id": "SCIENCE"}'
   ```

4. **Was it retired?** No successor.
   ```bash
   curl -X POST "http://localhost:8001/api/lineage/" \
     -d '{"old_id": "OLD_ID", "operation": "retire", "subject_id": "SCIENCE"}'
   ```

5. Re-run `lineage-check` to confirm `is_valid == true`.

### Output

```
## Lineage Check: SCIENCE

| Status | Count |
|--------|-------|
| Removed subskill IDs | 4 |
| With lineage records | 3 |
| MISSING (blocking) | 1 |

### Missing Lineage Records (BLOCKING)
| Old ID | Description | Likely Operation |
|--------|-------------|-----------------|
| SCI001-03-b | "Classify materials by transparency" | rename? (SCI001-03-c has similar description) |
```

---

## Lineage Enforcement Rules

These rules apply to ALL commands that modify subskill IDs (`upgrade`, `full-loop`, or any direct CRUD).

### Mandatory Lineage Gate

**Before any subskill ID change (rename, delete, merge, split):**
1. Identify the old subskill_id(s) being affected
2. Determine the operation type (rename/merge/split/retire)
3. Determine the target canonical_id(s)
4. Create the lineage record via `POST /api/lineage/` **BEFORE** modifying the draft
5. Only then proceed with the draft CRUD operation

### Draft-First Rule

**NEVER edit `curriculum_published` directly.** All changes go through the draft → publish flow:
1. Edit the draft via curriculum CRUD endpoints
2. Run `lineage-check` to validate all ID changes are tracked
3. Publish via `POST /api/publishing/subjects/{subject_id}/publish` (deploys + flattens in one step)

The publish pipeline in `draft_curriculum_service.py` is the **ONLY** writer to `curriculum_published`. If published data is wrong, fix it by editing the draft and re-publishing — never patch in place.

### Logging

```
[LINEAGE] {old_id} → {canonical_id} ({operation}) — lineage record created
[LINEAGE-MISSING] {old_id} removed from draft but NO lineage record found — BLOCKING
[LINEAGE-CHECK] {subject_id}: {N} changes, {M} with lineage, {K} missing
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

### Eval Mode Assignment Rules

When upgrading or auditing a subskill that has a `target_primitive` in `PROBLEM_TYPE_REGISTRY`:

1. **Read the subskill description** — what pedagogical action does it describe?
2. **Look up the primitive's eval modes** in the registry (see `EVAL_MODE_ENRICHMENT.md` for the full reference)
3. **Pick 1-3 modes** that match the subskill's intent:
   - **Single mode** (`["subitize"]`) — lock when the subskill IS that mode (e.g. "subitize dot patterns")
   - **Multiple modes** (`["subitize", "build"]`) — allow when the subskill spans several activities (e.g. "explore ten-frame representations")
   - **All modes** (omit field / `null`) — only for assessment-focused subskills where IRT should freely select
4. **Validate** that every mode in the list is a valid key in `PROBLEM_TYPE_REGISTRY[target_primitive]`
5. **Include `target_eval_modes` in the PATCH body** alongside `target_primitive`:
   ```bash
   curl -X PUT "http://localhost:8001/api/curriculum/subskills/{id}?grade={grade}&subject_id={subject_id}" \
     -H "Content-Type: application/json" \
     -d '{"target_primitive": "ten-frame", "target_eval_modes": ["subitize", "build"]}'
   ```

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

3. **DO NOT generate PRIMITIVE_GAPS for concepts that existing primitives already cover.** Check the FULL catalog (all domains) before declaring a gap. Also glob `my-tutoring-app/src/components/lumina/primitives/**/*.tsx` — a component can exist without being top-of-mind in the catalog text. If a `.tsx` file name matches the concept, read its header to confirm before declaring PURPLE.

4. **DO NOT upgrade subskills without checking the primitive's grade-band constraints.** A primitive that's perfect for Grade 5 is wrong for Grade 1.

5. **DO NOT batch-upgrade without user approval.** Present the plan, get a yes, then execute.

6. **DO NOT forget to re-run audit after upgrades.** The whole point is a closed loop — verify the changes actually improved coverage.

7. **DO NOT recommend non-evaluable primitives for mastery-gated subskills.** Check `supportsEvaluation` before recommending.

8. **DO NOT delete or rename a subskill without creating a lineage record first.** Student data (competencies, mastery lifecycle, reviews) is keyed by subskill_id. Without a lineage record, all student progress for that subskill is orphaned. The lineage record must exist BEFORE the draft change, not after.

9. **DO NOT edit `curriculum_published` directly.** All changes go through the draft → publish flow. Published data is immutable — only the publish pipeline writes to it. If published data is wrong, fix it by editing the draft and re-publishing.

10. **DO NOT publish without running `lineage-check` first.** The publish pipeline will block if removed subskill IDs lack lineage records, but catching this early via `lineage-check` is faster than debugging a blocked publish.

---

## Checklist

- [ ] Parsed command and arguments (subject_id, optional --unit filter)
- [ ] For `audit`: loaded curriculum + catalog, classified all subskills, presented dashboard (incl. eval mode coverage) + per-unit tables
- [ ] For `upgrade`: presented upgrade plan (incl. target_eval_modes), got user approval, re-authored subskills, re-audited
- [ ] For `gaps`: generated PRIMITIVE_GAPS.md with blocked subskills and proposed primitives
- [ ] For `unused`: showed unused primitives by domain with recommendations
- [ ] For `full-loop`: ran all phases in sequence, presented before/after report
- [ ] All classifications include rationale and confidence level
- [ ] PURPLE items have EVAL_TRACKER-compatible requirements
- [ ] No primitives recommended without reading their catalog entry
- [ ] User approved all changes before execution
- [ ] For `lineage-check`: called `/api/lineage/check/{subject_id}`, resolved all missing IDs
- [ ] For `upgrade`/`full-loop`: lineage records created BEFORE any subskill ID changes
- [ ] No direct edits to `curriculum_published` — all changes via draft then publish
