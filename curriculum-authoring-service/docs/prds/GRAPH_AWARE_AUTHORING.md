# Graph-Aware Authoring — Scoped Edge Suggestions During Curriculum Creation

**Status:** Proposed
**Parent:** [K-12 Curriculum Expansion](K12_CURRICULUM_EXPANSION.md)
**Created:** 2026-03-28

---

## Problem

Today, curriculum authoring and graph building are two disconnected exercises:

1. **Author hierarchy** — generate units, skills, subskills via `/api/ai/generate-unit`
2. **Wait** until a large batch of content exists
3. **Run bulk suggestion pipeline** — `/api/agent/{subject}/suggest` runs 5 heavy phases across the entire subject graph

This creates several problems:

- **Lost context.** The author knows prerequisite relationships at authoring time. Recovering them later from descriptions via embeddings and LLM triage is strictly worse.
- **All-or-nothing cost.** The suggestion pipeline embeds every skill, triages every pair, and drills into every subskill. For a subject with 150+ subskills, this takes minutes and hundreds of Gemini calls. There is no way to say "just connect these 2 skills."
- **Retroactive friction.** After authoring 8 units, the suggestion engine produces 50+ suggestions. Reviewing them without the authoring context is tedious and error-prone.
- **No cross-grade integration path.** When authoring Grade 2, there is no workflow to say "connect OPS002 to Grade 1's OPS001" without running the bulk pipeline across both grades.

## Solution

Add a lightweight, scoped edge suggestion capability that integrates directly into the authoring workflow. Instead of 5 phases across the entire subject, this runs 1-2 targeted Gemini calls against a narrow scope the author defines.

### Design Principles

1. **Scope-first.** The author defines exactly which skills/subskills to analyze. No full-subject sweeps.
2. **Fast.** Single LLM call per request (< 5 seconds), not a multi-phase pipeline.
3. **Integrated.** Can be called immediately after `generate-unit` or `generate-skill` — same authoring session.
4. **Non-destructive.** Returns suggestions, not edges. Same accept/reject workflow as the bulk pipeline.
5. **Composable.** Works within a unit, across units, or across grades.

## New API Endpoints

### 1. `POST /api/ai/suggest-edges` — Scoped Edge Suggestions

Given a set of skill or subskill IDs, generate edge suggestions between them.

```
POST /api/ai/suggest-edges
{
  "subject_id": "MATHEMATICS",
  "scope": {
    "skill_ids": ["OPS002-01", "OPS002-02"],
    "subskill_ids": [],                        // optional: narrow further
    "include_existing_graph": true,             // include already-graphed nodes for cross-connections
    "cross_grade_subject_ids": ["MATHEMATICS"]  // look at other grades' published curriculum
  },
  "options": {
    "relationship_types": ["prerequisite", "builds_on"],  // filter suggestions to these types
    "max_suggestions": 10,
    "depth": "subskill"   // "skill" = skill-level only, "subskill" = drill to subskill pairs
  }
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "suggestion_id": "uuid",
      "source_entity_id": "OPS001-01-D",
      "source_entity_type": "subskill",
      "source_label": "Write equations to represent addition/subtraction within 10",
      "source_context": "Grade 1 > Operations and Algebraic Thinking > OPS001-01",
      "target_entity_id": "OPS002-01-A",
      "target_entity_type": "subskill",
      "target_label": "Use concrete objects to model addition within 100",
      "target_context": "Grade 2 > Operations and Algebraic Thinking > OPS002-01",
      "relationship": "prerequisite",
      "strength": 0.9,
      "is_prerequisite": true,
      "rationale": "Symbolic equation writing within 10 is a developmental prerequisite for extending addition to 100 with concrete models.",
      "confidence": 0.85
    }
  ],
  "scope_summary": {
    "source_nodes_analyzed": 12,
    "target_nodes_analyzed": 8,
    "cross_grade_nodes_included": 15,
    "gemini_calls": 1,
    "elapsed_ms": 3200
  }
}
```

**Implementation approach:** Skip Phases 1-3 of the bulk pipeline entirely. The author has already scoped the nodes. Go directly to a single LLM call equivalent to Phase 4 (subskill refinement) but with richer context.

### 2. `POST /api/ai/connect-skills` — Pairwise Skill Connection

Given exactly two skills, find all subskill-level connections between them.

```
POST /api/ai/connect-skills
{
  "source_skill_id": "OPS001-01",
  "source_subject_id": "MATHEMATICS",     // needed for cross-grade
  "target_skill_id": "OPS002-01",
  "target_subject_id": "MATHEMATICS",
  "relationship_types": ["prerequisite", "builds_on"]
}
```

**Response:**
```json
{
  "connections": [
    {
      "source_subskill_id": "OPS001-01-D",
      "source_label": "Write equations for addition/subtraction within 10",
      "target_subskill_id": "OPS002-01-A",
      "target_label": "Model addition within 100 with concrete objects",
      "relationship": "prerequisite",
      "strength": 0.9,
      "is_prerequisite": true,
      "rationale": "Equation writing within 10 gates concrete modeling at higher range."
    },
    {
      "source_subskill_id": "OPS001-01-B",
      "source_label": "Model word problems within 10 (put together, take apart)",
      "target_subskill_id": "OPS002-01-B",
      "target_label": "Model comparison word problems within 100",
      "relationship": "builds_on",
      "strength": 0.75,
      "is_prerequisite": false,
      "rationale": "Part-whole modeling extends naturally to comparison at higher range."
    }
  ],
  "skill_summary": {
    "source_subskills": 6,
    "target_subskills": 5,
    "connections_found": 4,
    "gemini_calls": 1,
    "elapsed_ms": 2800
  }
}
```

**Use case:** After generating a new unit, the author says "how does this connect to the prior grade's equivalent unit?" and gets an immediate, complete answer.

### 3. `POST /api/ai/suggest-edges/accept` — Inline Accept

Accept suggestions from the scoped endpoints without going through the full agent workflow. Persists as draft edges (same as bulk accept).

```
POST /api/ai/suggest-edges/accept
{
  "suggestion_ids": ["uuid1", "uuid2"],
  "subject_id": "MATHEMATICS"
}
```

Uses existing `EdgeManager.create_edge()` under the hood.

## Architecture

### Where This Lives

```
app/
├── api/
│   └── ai.py                          # Add 3 new endpoints
├── services/
│   ├── ai_assistant.py                 # Add scoped suggestion methods
│   ├── scoped_suggestion_service.py    # NEW: lightweight suggestion logic
│   └── suggestion_engine.py            # Existing bulk pipeline (unchanged)
├── models/
│   └── edges.py                        # Reuse EdgeSuggestion, add ScopedSuggestionRequest
```

### New Service: `ScopedSuggestionService`

Separate from `SuggestionEngine` because the design goals are fundamentally different:

| Concern | SuggestionEngine (bulk) | ScopedSuggestionService (new) |
|---------|------------------------|-------------------------------|
| Input | Entire subject graph | 1-10 specific skills/subskills |
| Phases | 5 (embed → triage → drill → refine → validate) | 1-2 (context build → single LLM call) |
| Gemini calls | 20-100+ | 1-2 |
| Latency | 2-10 minutes | 2-5 seconds |
| Checkpointing | Required (Firestore) | Not needed |
| Use case | Retroactive gap-filling | Inline authoring |

### How the LLM Call Works

Instead of the bulk pipeline's embedding-then-triage approach, the scoped service:

1. **Loads context.** Fetches full metadata for scoped nodes (descriptions, difficulty, unit context, existing edges).
2. **Builds a single, rich prompt.** Includes all source and target subskills with their context, plus any existing edges (to avoid duplicates).
3. **Makes one Gemini call** with JSON structured output (same schema as Phase 4 of the bulk pipeline).
4. **Validates** (cycle check on prerequisites) and returns.

Prompt structure:
```
You are a curriculum architect analyzing connections between specific skills
in a K-12 educational curriculum.

## Source Skills
[Full context: unit > skill > subskills with difficulty ranges]

## Target Skills
[Full context: unit > skill > subskills with difficulty ranges]

## Existing Edges
[Any edges already connecting these nodes — avoid duplicating]

## Task
Identify pedagogically meaningful connections between the source and target
subskills. For each connection, specify:
- relationship type (prerequisite | builds_on | reinforces | parallel | applies)
- strength (0.0-1.0)
- whether it gates progression (is_prerequisite)
- brief rationale (max 20 words)

## Constraints
- prerequisite: true developmental dependency (student CANNOT succeed at target without source mastery)
- builds_on: conceptual extension (most common)
- Use prerequisite sparingly — most connections are builds_on
- Consider difficulty ranges: higher difficulty source should not be prerequisite for lower difficulty target
```

### Integration with Existing Systems

- **Suggestions stored in same Firestore collection** (`edge_suggestions/{subject_id}/pending`) with `origin: "scoped"` field to distinguish from bulk.
- **Accept/reject uses same `EdgeManager.create_edge()`** with same `on_mutation` callback.
- **Graph health cache invalidated** on accept (same event-driven pattern).
- **Bulk pipeline still works** alongside scoped suggestions. They're complementary: scoped for authoring-time, bulk for periodic audits.

## Workflow Integration

### Authoring Flow (the primary use case)

```
1. Author generates Grade 2 Math Unit: OPS002 (Operations)
   POST /api/ai/generate-unit
   → Returns OPS002-01, OPS002-02 with subskills

2. Author asks: "How does this connect to Grade 1 OPS001?"
   POST /api/ai/connect-skills
   { source: "OPS001-01", target: "OPS002-01" }
   → Returns 4-6 subskill-level connections with rationale

3. Author reviews, accepts 3, rejects 1
   POST /api/ai/suggest-edges/accept
   { suggestion_ids: ["a", "b", "c"] }
   → 3 draft edges created

4. Author moves to next unit, already graphed
   Repeat steps 1-3 for each unit

5. Periodic: run bulk pipeline for gap-filling
   POST /api/agent/MATHEMATICS/suggest
   → Catches connections the author missed
```

### Cross-Grade Flow

```
1. Author is working on Grade 3 Math
   They just generated NF001 (Fractions — new in Grade 3)

2. Author wants to connect to Grade 2 geometry (partitioning shapes)
   POST /api/ai/connect-skills
   {
     source: "GEOM002-04",           // Grade 2: partition into halves/thirds/fourths
     source_subject_id: "MATHEMATICS",
     target: "NF001-01",             // Grade 3: unit fractions
     target_subject_id: "MATHEMATICS"
   }
   → Returns connections like: "partition into equal parts" → "understand unit fractions as 1/n"

3. Author accepts prerequisite chain
   → Cross-grade prerequisite created
```

## Estimated Scope

### New Files
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `app/services/scoped_suggestion_service.py` | 200-250 | Core scoped suggestion logic |
| `app/models/scoped_suggestions.py` | 60-80 | Request/response models |

### Modified Files
| File | Changes |
|------|---------|
| `app/api/ai.py` | Add 3 endpoints (~80 lines) |
| `app/services/ai_assistant.py` | Wire to scoped service (minimal) |
| `app/main.py` | Register scoped service in dependency injection |

### Not Modified
| File | Reason |
|------|--------|
| `suggestion_engine.py` | Bulk pipeline unchanged |
| `graph_agent.py` | Agent orchestrator unchanged |
| `edge_manager.py` | Reused as-is for edge creation |

**Total new code:** ~350-400 lines
**Total modified:** ~100 lines

## Implementation Plan

### Phase 1: Core Scoped Suggestion Service

**Goal:** `POST /api/ai/suggest-edges` working end-to-end

1. Create `app/models/scoped_suggestions.py`
   - `ScopedSuggestionRequest` (scope, options)
   - `ScopedSuggestionResponse` (suggestions, scope_summary)
   - `ConnectSkillsRequest` / `ConnectSkillsResponse`

2. Create `app/services/scoped_suggestion_service.py`
   - `ScopedSuggestionService.__init__(edge_manager, db, gemini_client)`
   - `async suggest_edges(request) → ScopedSuggestionResponse`
     - Load node metadata from BigQuery (scoped query, not full graph)
     - Load existing edges between scoped nodes (dedup)
     - Build prompt with full context
     - Single Gemini call (JSON structured output, same schema as Phase 4)
     - Validate (cycle check via `GraphAnalysisEngine.validate_edge`)
     - Store suggestions in Firestore (`origin: "scoped"`)
     - Return response

3. Add endpoints to `app/api/ai.py`
   - `POST /ai/suggest-edges`
   - Wire to `ScopedSuggestionService`

4. Register service in `app/main.py`

**Test:** Generate a unit, then call `suggest-edges` with the new skill IDs. Verify suggestions returned in < 5 seconds.

### Phase 2: Connect-Skills Endpoint

**Goal:** `POST /api/ai/connect-skills` working, including cross-grade

1. Add `async connect_skills(request) → ConnectSkillsResponse` to `ScopedSuggestionService`
   - Fetch both skills' full subskill trees (may be different subjects/grades)
   - Fetch existing edges between these skill families
   - Build pairwise prompt
   - Single Gemini call
   - Return connections

2. Add endpoint to `app/api/ai.py`
   - `POST /ai/connect-skills`

3. Add cross-grade resolution
   - When `source_subject_id != target_subject_id`, fetch from both BigQuery datasets
   - When cross-grade, include grade context in prompt ("Grade 1" vs "Grade 2")

**Test:** Connect Grade 1 OPS001-01 to a newly generated Grade 2 OPS002-01. Verify cross-grade prerequisite suggestions.

### Phase 3: Inline Accept + Polish

**Goal:** Complete authoring workflow with accept/reject

1. Add `POST /api/ai/suggest-edges/accept` endpoint
   - Reuse `EdgeManager.create_edge()` with `on_mutation` callback
   - Mark suggestions as accepted in Firestore
   - Return created edge IDs

2. Add `origin` field to suggestion storage
   - `"scoped"` for scoped suggestions
   - `"bulk"` for existing pipeline
   - `"manual"` for connect-skills

3. Update `/api/agent/{subject}/suggestions` to include scoped suggestions in listing
   - Filter by `origin` if desired

4. Add error handling / edge cases
   - Duplicate edge detection (suggestion for existing edge)
   - Stale scope (skill deleted between suggest and accept)
   - Cross-grade version coordination

**Test:** Full authoring flow: generate → suggest → accept → verify graph health improves.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM suggests low-quality edges for small scope | Medium | Include existing edges as context to prevent duplicates; author reviews all suggestions |
| Cross-grade resolution adds complexity | Medium | Phase 2 handles this explicitly; clear subject_id parameters |
| Scoped and bulk suggestions conflict | Low | `origin` field distinguishes them; bulk pipeline deduplicates against existing edges |
| Gemini structured output malformed | Low | Same fallback pattern as Phase 4: accept as builds_on with 0.7 strength |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scoped suggestion latency | < 5 seconds | API response time |
| Gemini calls per suggestion request | 1-2 | Logged |
| Author acceptance rate (scoped) | > 60% | Accepted / total suggestions |
| Graph health after scoped authoring | >= 7.0 | `/curriculum-graph diagnose` |
| Orphan nodes at publish time | 0 | Quality gate |
| Time to author + graph one unit | < 30 minutes | End-to-end workflow |

## Appendix: Comparison to Bulk Pipeline

```
BULK PIPELINE (existing)                    SCOPED AUTHORING (new)
========================                    =====================

Input: entire subject                       Input: 1-10 skill/subskill IDs

Phase 1: Embed ALL skills (25+)            (skipped — author already scoped)
Phase 2: Triage ALL pairs (300+)           (skipped — author already scoped)
Phase 3: Drill ALL approved pairs          (skipped — scope IS the drill-down)
Phase 4: LLM refine candidates             Single LLM call with full context
Phase 5: Validate + rank                   Validate (cycle check only)

Cost: 20-100 Gemini calls                  Cost: 1-2 Gemini calls
Time: 2-10 minutes                         Time: 2-5 seconds
Use: periodic audit                        Use: during authoring

Both produce EdgeSuggestion objects → same accept/reject workflow
Both write to same Firestore collection → unified suggestion management
Both use same EdgeManager → same dual-write, same on_mutation hooks
```
