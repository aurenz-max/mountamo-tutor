# Curriculum Author — Operational Authoring & Graph Building Skill

Create, review, and manage curriculum content (subjects, units, skills, subskills) via the authoring service, then build and validate the prerequisite graph. This is the operational workhorse for hands-on authoring — `/curriculum` is the reference skill, this is the doing skill.

**Arguments:** `/curriculum-author [command] [args]`

## Commands

| Command | Example | Purpose |
|---------|---------|---------|
| `author` | `/curriculum-author author GRADE_01.md Language Arts` | Author units from a PRD |
| `add-skill` | `/curriculum-author add-skill LA001 "Digraphs" 3` | Add/append a skill with N subskills to an existing unit |
| `review` | `/curriculum-author review LANGUAGE_ARTS_G1` | Review all authored units — detect issues, suggest fixes |
| `graph` | `/curriculum-author graph LANGUAGE_ARTS_G1` | Build graph edges (pairwise) + validate |
| `status` | `/curriculum-author status LANGUAGE_ARTS_G1` | Show authoring progress and graph health |
| `publish` | `/curriculum-author publish MATHEMATICS_G1` | Publish drafts + deploy to curriculum_published |

---

## Architecture Quick Reference

**Authoring service:** `http://localhost:8001` (curriculum-authoring-service, FastAPI)

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/author-subject` | POST | Create/retrieve subject shell |
| `/api/ai/author-unit` | POST | Generate unit → pending in drafts |
| `/api/ai/author-unit/accept` | POST | Flip pending → accepted |
| `/api/ai/author-unit/reject` | POST | Flip pending → rejected + feedback |
| `/api/ai/author-unit/regenerate` | POST | Reject old + generate new with feedback |
| `/api/ai/author-previews/{subject_id}?grade=X` | GET | List all previews with status |
| `/api/ai/generate-skill` | POST | Generate subskills for a skill (append to existing unit) |
| `/api/ai/connect-skills` | POST | **Pairwise** subskill connections between two skills |
| `/api/ai/suggest-edges` | POST | Scoped multi-skill suggestions (use sparingly — see caveats) |
| `/api/ai/suggest-edges/accept` | POST | Accept suggestion IDs → create draft edges |
| `/api/edges/validate` | POST | Validate edge without creating (cycle check) |
| `/api/graph-agent/{subject_id}/health` | GET | Graph health report (score, anomalies) |
| `/api/publishing/subjects/{subject_id}/publish` | POST | Publish all draft changes (drafts → published) |
| `/api/publishing/subjects/{subject_id}/deploy` | POST | Deploy to `curriculum_published` + auto-flatten graph for Pulse |
| `/api/publishing/subjects/{subject_id}/deploy/status` | GET | Check deployment status |
| `/api/publishing/subjects/{subject_id}/active-version` | GET | Get currently active version |
| `/api/publishing/subjects/{subject_id}/flatten` | POST | Manually rebuild flat graph cache (auto-runs on deploy) |

### Key Models

```
AuthorUnitRequest: {subject_id, grade, unit_id, unit_title, unit_description, unit_order, prd_context, custom_instructions, num_skills, num_subskills_per_skill}
ConnectSkillsRequest: {source_skill_id, target_skill_id, source_subject_id, target_subject_id, relationship_types}
AcceptScopedSuggestionsRequest: {suggestion_ids, subject_id}
```

---

## Command: `author`

Author curriculum units for a subject from a PRD file.

### Phase 0: Setup

1. Read the PRD file to get unit definitions, skill areas, and primitive mappings.
2. Ensure subject exists via `POST /api/ai/author-subject`.
3. Check existing previews via `GET /api/ai/author-previews/{subject_id}?grade=X` to know which units are already done.

### Phase 1: Author Each Unit

For each unfinished unit from the PRD:

1. **Build a prescriptive request.** The `prd_context` field must spell out EVERY skill and subskill explicitly:
   ```
   The unit MUST contain exactly these N skills:

   1. UNIT-01: Skill Name (M subskills)
      - Subskill a: Description of what student practices
      - Subskill b: Description of what student practices
      Target primitive: primitive-name
   ```

2. **Set `custom_instructions`** to enforce output format:
   - Skill descriptions = SHORT UI TITLES (1-4 words)
   - Subskill descriptions = natural sentence + Focus: + Examples: (8-10) + Constraints:
   - Standards alignment codes

3. **Call `POST /api/ai/author-unit`** with `max_output_tokens: 65536`.

4. **Review the response** before accepting. Check:
   - Correct skill/subskill count matches PRD
   - 100% Lumina coverage (no empty `target_primitive`)
   - Skill descriptions are short titles, not paragraphs
   - Subskill descriptions have Focus/Examples/Constraints
   - Difficulty progression is monotonic within skill families
   - Standards alignment present

5. **Accept or reject.** If rejecting, provide specific feedback for regeneration.

### Phase 2: Post-Authoring Review

After all units are accepted, run the `review` command to catch structural issues.

### Phase 3: Publish & Deploy

After review passes, publish and deploy so the curriculum is live in Firestore:

1. **Publish** drafts → published:
   ```bash
   curl -s -X POST "http://localhost:8001/api/publishing/subjects/{subject_id}/publish" \
     -H "Content-Type: application/json" \
     --data-raw '{"subject_id":"{subject_id}","version_description":"...","change_summary":"..."}'
   ```

2. **Deploy** to `curriculum_published` (auto-flattens graph for Pulse/LearningPaths):
   ```bash
   curl -s -X POST "http://localhost:8001/api/publishing/subjects/{subject_id}/deploy"
   ```
   The deploy response includes a `flatten` key with node/edge counts confirming the graph cache was rebuilt.

3. **Verify** deployment:
   ```bash
   curl -s "http://localhost:8001/api/publishing/subjects/{subject_id}/deploy/status"
   ```

**IMPORTANT:** Publish promotes internal state. Deploy writes to `curriculum_published` AND auto-flattens the graph cache for Pulse/LearningPaths. Two steps only: publish → deploy.

---

## Command: `add-skill`

Add a new skill (with subskills) to an existing accepted unit, or append subskills to an existing skill.

### When to Use

- A skill has too few subskills (1-2) and needs more depth
- A new skill area needs to be added to a unit
- Review identified gaps in coverage

### Steps

1. Check existing unit structure via `GET /api/ai/author-previews/{subject_id}?grade=X`
2. Call `POST /api/ai/generate-skill` with:
   ```json
   {
     "subject_id": "...",
     "grade": "...",
     "unit_id": "LA001",
     "skill_id": "LA001-03",          // existing skill to append to, or new ID
     "skill_description": "Digraphs",
     "num_subskills": 3,
     "prd_context": "Specific instructions for what subskills to generate...",
     "custom_instructions": "..."
   }
   ```
3. Review generated subskills
4. Subskills are auto-appended to the unit in drafts

---

## Command: `review`

Run a comprehensive review of all authored units for a subject. This is the quality gate before graph building.

### Review Checklist

Run these checks in order, reporting findings as a table:

#### 1. Structural Completeness

```bash
curl -s "http://localhost:8001/api/ai/author-previews/{subject_id}?grade=X"
```

For each unit, check:
- [ ] All PRD-specified units are present and accepted
- [ ] Skill count matches PRD expectations
- [ ] Subskill count matches PRD expectations

Report as:
```
| Unit | Status | Skills (actual/expected) | Subskills (actual/expected) | Issues |
```

#### 2. Thin Skill Detection

**CRITICAL REVIEW PATTERN:** Skills with only 1-2 subskills are often too thin to stand alone. They should be:
- **Aggregated** into a related skill (if conceptually similar)
- **Expanded** with more subskills (if the concept warrants depth)
- **Left as-is** only if the concept is truly atomic (e.g., "Sight Word Fluency" with 1 timed-drill subskill)

For each unit, identify skills with <= 2 subskills and recommend:
```
| Skill | Subskills | Recommendation | Rationale |
|-------|-----------|----------------|-----------|
| LA004-02 Verbs | 1 | EXPAND to 2 | Verb identification is too narrow — add action vs. linking verbs |
| LA004-03 Adjectives | 1 | AGGREGATE into LA004-02 | Both are parts-of-speech identification |
| LA002-01 Vowel Discrimination | 1 | OK (atomic) | Single focused auditory task |
```

Decision criteria:
- **Aggregate** when two thin skills share the same cognitive task (e.g., both are "identify X in a sentence")
- **Expand** when the skill covers a broad concept but has too few practice variants
- **OK** when the skill is genuinely a single focused task with one clear primitive

#### 3. Lumina Coverage Gaps

Check every subskill has a non-empty `target_primitive`. Flag any with empty or missing primitives.

#### 4. Difficulty Progression

Within each unit, verify:
- Subskills within a skill progress in difficulty (a < b < c)
- Skills within a unit roughly progress in difficulty
- No skill starts above difficulty 4.0 for Grade 1

#### 5. Description Quality

Spot-check 3-5 subskills per unit:
- Subskill description starts with a natural sentence (not a label like "Title:")
- Contains Focus:, Examples:, and Constraints: sections
- Examples list has 8-10 concrete items
- Skill description is a short UI title (1-4 words)

#### 6. Standards Coverage

Check that key standards are covered:
- List all unique `standards_alignment` values
- Flag any null/missing standards

### Acting on Review Findings

After presenting the review table, ask the user which issues to fix:
- **Thin skills to aggregate:** Use the authoring service to merge subskills
- **Thin skills to expand:** Use `POST /api/ai/generate-skill` to add subskills
- **Missing primitives:** Flag for manual assignment
- **Description issues:** Use `POST /api/ai/improve-description` or manual edit

---

## Command: `publish`

Publish and deploy a subject's curriculum to Firestore so the backend can read it.

### Steps

1. **Check draft changes exist:**
   ```bash
   curl -s "http://localhost:8001/api/publishing/subjects/{subject_id}/draft-changes"
   ```
   Report total changes count. If 0, nothing to publish.

2. **Publish** (promotes drafts → published):
   ```bash
   curl -s -X POST "http://localhost:8001/api/publishing/subjects/{subject_id}/publish" \
     -H "Content-Type: application/json" \
     --data-raw '{"subject_id":"{subject_id}","version_description":"...","change_summary":"..."}'
   ```
   Log the version number returned.

3. **Deploy** (writes to `curriculum_published` + auto-flattens graph for Pulse/LearningPaths):
   ```bash
   curl -s -X POST "http://localhost:8001/api/publishing/subjects/{subject_id}/deploy"
   ```
   Log stats: units, skills, subskills deployed. The response includes a `flatten` key confirming the graph cache was rebuilt with node/edge counts. No separate flatten step needed.

4. **Verify:**
   ```bash
   curl -s "http://localhost:8001/api/publishing/subjects/{subject_id}/deploy/status"
   ```

**Note:** Deploy auto-flattens the graph — no backend or separate rebuild-cache call needed. Publish also triggers a non-blocking BQ sync in the background.

```
[PUBLISH] MATHEMATICS_G1 → version 2 published (366 changes)
[DEPLOY] MATHEMATICS_G1 → 5 units, 36 skills, 111 subskills deployed to curriculum_published
[FLATTEN] MATHEMATICS_G1 → 36 skills, 111 subskills, 85 edges flattened (auto)
```

---

## Command: `graph`

Build prerequisite graph edges for a subject, then validate the result.

### CRITICAL: Use Pairwise, Not Bulk

**DO NOT** pass large numbers of skill IDs to `POST /api/ai/suggest-edges`. This dumps too many subskills into a single Gemini call, causing:
- Output truncation (the "Recovered N items from truncated JSON" warning)
- Bias toward intra-unit edges over cross-unit edges
- Missed connections in the PRD prerequisite chains

**Instead, use `POST /api/ai/connect-skills` for each skill pair.** This gives Gemini focused context and reliable results.

### CRITICAL: connect-skills Creates Pending Suggestions, Not Edges

`POST /api/ai/connect-skills` stores results as **pending suggestions** in Firestore (status: `"pending"`), NOT as graph edges. The knowledge-graph and prerequisites endpoints will show 0 edges until suggestions are accepted.

**After each batch of connect-skills calls, you MUST bulk-accept:**

```bash
# Bulk-accept all pending suggestions → creates draft edges
curl -s -X POST "http://localhost:8001/api/agent/{subject_id}/suggestions/accept-all"
# Response: {"accepted": N, "edges_created": N, "parallel_reverses": 0, "version_id": "..."}
```

**Alternative: Accept individually** (if you need selective review):
```bash
# List all suggestions
curl -s "http://localhost:8001/api/agent/{subject_id}/suggestions"
# Accept one
curl -s -X POST "http://localhost:8001/api/agent/{subject_id}/suggestions/{suggestion_id}/accept"
```

**Verification after accept-all:**
```bash
# Health endpoint reads from hierarchical Firestore edge subcollections (authoritative)
curl -s "http://localhost:8001/api/agent/{subject_id}/health"
# Note: /api/subjects/{subject_id}/knowledge-graph may show 0 edges — it reads from a different collection.
# Use the health endpoint for edge counts and validation.
```

### Phase 1: Intra-Unit Edges

For each unit, generate edges between skills within the unit:

```
For unit LA001 with skills [LA001-01, LA001-02, ..., LA001-09]:
  For each pair (LA001-01, LA001-02), (LA001-01, LA001-03), ...:
    POST /api/ai/connect-skills
    {
      "source_skill_id": "LA001-01",
      "target_skill_id": "LA001-02",
      "source_subject_id": "LANGUAGE_ARTS_G1",
      "target_subject_id": "LANGUAGE_ARTS_G1",
      "relationship_types": ["prerequisite", "builds_on", "reinforces"]
    }
```

**Optimization:** Not every pair needs analysis. Use difficulty ordering to skip unlikely pairs:
- Only analyze pairs where source difficulty <= target difficulty
- Skip pairs where the skills are unrelated by topic (use skill descriptions to judge)
- For a unit with N skills, aim for ~N*1.5 pairwise calls, not N*(N-1)/2

**CRITICAL: Maximize parallelism for speed.** The connect-skills API is stateless per call — fire ALL pairs for a unit simultaneously in one tool-call batch. For a unit with 6 skill pairs, send 6 parallel curl calls, not 6 sequential ones. This cuts wall-clock time by ~5x per unit.

**Batch phases together when possible.** Intra-unit work for different units is independent — run SS003 and SS004 intra-unit calls in the same parallel batch. Similarly, SS005 intra-unit calls can run alongside the first cross-unit calls.

**After each connect-skills call:**
1. Log: source_skill → target_skill, connections found
2. Track running connection count

**Defer accept-all to phase boundaries, not per-unit.**  Suggestions accumulate harmlessly — run a single `accept-all` after ALL intra-unit phases complete, then one more after all cross-unit phases. This avoids N intermediate health checks and reduces total API calls.

1. Run `POST /api/agent/{subject_id}/suggestions/accept-all` to convert pending suggestions → draft edges
2. Verify with `GET /api/agent/{subject_id}/health` — check edge count increased

### Phase 2: Cross-Unit Edges

Use the PRD's prerequisite chain to determine which unit pairs to connect. For Language Arts G1:

```
LA002 (Phonological Awareness) → LA001 (Phonics and Decoding)
LA001 (Phonics and Decoding) → LA003 (Reading Fluency)
LA005 (Vocabulary) → LA003 (Reading Fluency and Comprehension)
LA004 (Grammar) → LA006 (Writing and Composition)
LA003 (Reading Fluency) → LA006 (Writing and Composition)
LA007 (Listening) → LA003 (Reading Comprehension)
```

For each cross-unit pair, identify the most relevant skill pairs and run `connect-skills` on each:

```
Example: LA002 → LA001
  connect-skills(LA002-02 "Phoneme Blending", LA001-01 "Short/Long Vowel Decoding")
  connect-skills(LA002-03 "Phoneme Segmenting", LA001-01 "Short/Long Vowel Decoding")
  connect-skills(LA002-05 "Phoneme Substitution", LA001-02 "Consonant Blends")
  connect-skills(LA002-06 "Syllable Awareness", LA001-08 "Multi-Syllable Decoding")
```

**Log every cross-unit call** with: source_unit → target_unit, skills connected, edges created.

### Phase 3: Graph Validation

After all edges are created, run comprehensive validation:

#### 3a. Health Check

**IMPORTANT:** Use `/api/agent/` not `/api/graph-agent/` — the latter returns 404.

```bash
curl -s "http://localhost:8001/api/agent/{subject_id}/health"
```

**Note on endpoints:** The health endpoint reads from hierarchical Firestore edge subcollections and is the **authoritative** source for edge counts. The `/api/subjects/{subject_id}/knowledge-graph` endpoint reads from a different flat collection and may show 0 edges even after accept-all.

Report the health score and all anomalies. Target:
- Health score >= 6.0
- Zero orphan **subskill** nodes
- Zero isolated units
- Edge density >= 1.5

**Known: skill-level nodes will always be orphans.** `connect-skills` creates subskill-to-subskill edges only. Skill nodes (e.g., SS001-01, SS002-03) have no edges and inflate the orphan count and component count. This is structural, not a graph quality issue. When reviewing orphan anomalies, filter out skill-level IDs (no letter suffix) — only subskill orphans (IDs ending in `-a`, `-b`, etc.) are actionable.

**Density-boost pass:** After the first accept-all, check edge density. If below 1.5, run one targeted round of ~6 additional connect-skills pairs (skip-one connections like SS001-01→SS001-04, or map→features bridges). This is cheaper than adding pairs during the initial phase when you don't yet know the density gap. In the SOCIAL_STUDIES_G1 run, 6 extra pairs added 22 edges and pushed density from 1.34→1.53.

#### 3b. Cycle Detection

The edge creation endpoint validates individual edges for cycles. But after bulk creation, verify the full prerequisite subgraph:

```bash
curl -s "http://localhost:8001/subjects/{subject_id}/knowledge-graph?include_drafts=true"
```

Parse the response and check:
- Extract all edges where `is_prerequisite: true`
- Build adjacency list and run DFS cycle detection
- Report any cycles found with the full path

#### 3c. Orphan Detection

From the health report's anomaly list, extract all orphan node IDs. For each:
- Identify which unit/skill it belongs to
- Suggest which existing connected node it should link to
- Offer to auto-create edges via `connect-skills`

#### 3d. Cross-Unit Coverage

Verify every PRD prerequisite chain has at least one edge:
```
| Chain | Edges Found | Status |
|-------|------------|--------|
| LA002 → LA001 | 4 | OK |
| LA001 → LA003 | 0 | MISSING |
| LA005 → LA003 | 2 | OK |
```

For any MISSING chains, run `connect-skills` on the most relevant skill pairs.

#### 3e. Edge Density per Unit

```
| Unit | Subskills | Edges | Density | Status |
|------|-----------|-------|---------|--------|
| LA001 | 23 | 23 | 1.0 | LOW — target 1.5+ |
```

### Phase 4: Validation Report

Present a final summary:

```
## Graph Validation Report — LANGUAGE_ARTS_G1

Health Score: 7.2 / 10

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total nodes | 102 | — | — |
| Total edges | 151 | — | — |
| Edge density | 1.48 | >= 1.5 | WARN |
| Components | 1 | 1 | OK |
| Cross-unit ratio | 0.19 | >= 0.15 | OK |
| Orphan nodes | 0 | 0 | OK |
| Dead-end ratio | 0.45 | < 0.50 | OK |
| Bottleneck nodes | 2 | < 5 | OK |

### Anomalies
- None

### Missing PRD Chains
- LA001 → LA003: 0 edges (CRITICAL)

### Recommendations
1. Run connect-skills for LA001-01 → LA003-01 to establish phonics→fluency chain
2. Edge density is borderline — consider adding reinforces edges within thin units
```

---

## Command: `status`

Quick status check — combines authoring progress and graph health.

### Steps

1. Fetch previews: `GET /api/ai/author-previews/{subject_id}?grade=X`
2. Fetch graph health: `GET /api/graph-agent/{subject_id}/health`
3. Present combined summary:

```
## LANGUAGE_ARTS_G1 — Grade 1 Language Arts

### Authoring Progress
| Unit | Title | Skills | Subskills | Status |
|------|-------|--------|-----------|--------|
| LA001 | Phonics and Decoding | 9 | 23 | accepted |
| LA002 | Phonological Awareness | 7 | 10 | accepted |
| ... | | | | |
Total: 7/7 units, 65 skills, 102 subskills

### Graph Health
Score: 7.2 / 10
Edges: 151 (density: 1.48)
Anomalies: 0 orphans, 0 isolated units
Cross-unit ratio: 19%
```

---

## Logging Standards

All API calls in this skill MUST be logged with enough detail to debug issues:

### Authoring Calls
```
[AUTHOR] LA002 Phonological Awareness: 7 skills, 10 subskills, 100% coverage → ACCEPTED (preview_id: xxx)
```

### Graph Calls — connect-skills (pairwise)
```
[GRAPH] connect-skills LA002-02 → LA001-01: 3 connections found
  LA002-02-a --(prerequisite)--> LA001-01-a (strength: 0.9, confidence: 0.85)
  LA002-02-b --(builds_on)--> LA001-01-b (strength: 0.8, confidence: 0.75)
  LA002-02-a --(reinforces)--> LA001-01-c (strength: 0.7, confidence: 0.70)
[GRAPH] Accepted 3 edges (IDs: e1, e2, e3)
```

### Graph Calls — suggest-edges (scoped, use sparingly)
```
[GRAPH-SCOPED] suggest-edges for [LA001-01, LA001-02, LA001-03]:
  Nodes loaded: 8 subskills
  Gemini response: 12 items (raw), 10 validated, 2 rejected (unknown IDs)
  Rejected IDs: ["LA001-99-z", "UNKNOWN-01-a"]
```

### Validation
```
[VALIDATE] Health score: 7.2, edges: 151, orphans: 0, components: 1
[VALIDATE] Cycle check: PASS (0 cycles in prerequisite subgraph)
[VALIDATE] Cross-unit chains: 5/6 present, MISSING: LA001→LA003
```

---

## Anti-Patterns (DO NOT)

1. **DO NOT pass 10+ skill IDs to suggest-edges.** Use connect-skills pairwise instead. The single-call approach truncates output and misses cross-unit connections.

2. **DO NOT accept edges without reviewing them.** Always log what was generated and let the user see the connections before accepting.

3. **DO NOT skip the review command after authoring.** Thin skills compound into graph sparsity problems. Catch them before building edges.

4. **DO NOT create skills with vague descriptions.** Skill descriptions are UI titles ("Nouns", "Verb Tense"), not paragraphs. Subskill descriptions are rich content instructions with Focus/Examples/Constraints.

5. **DO NOT author units without reading the PRD first.** The PRD defines exact skill counts, primitive mappings, and subskill expectations. Vague prd_context produces garbage output.

6. **DO NOT hardcode test data.** All content is generated by Gemini via the authoring service.

---

## Checklist

- [ ] Parsed command and arguments
- [ ] For `author`: read PRD, ensured subject, authored units one-by-one, reviewed and accepted each, published + deployed
- [ ] For `publish`: checked drafts, published, deployed (auto-flattens graph), verified
- [ ] For `add-skill`: checked existing structure, generated skill, verified quality
- [ ] For `review`: ran all 6 review checks, presented findings table, offered fixes
- [ ] For `graph`: used pairwise connect-skills (not bulk suggest-edges), validated result
- [ ] For `status`: showed authoring progress + graph health
- [ ] All API calls logged with detail level specified above
- [ ] No orphan nodes, no cycles, all PRD chains present
