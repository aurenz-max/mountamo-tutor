# Curriculum Graph — Diagnostic & Improvement Skill

Analyze the curriculum knowledge graph for structural issues that affect Pulse engine diversity and adaptive learning quality. Uses the agentic graph analysis layer (GraphAnalysisEngine, SuggestionEngine, ScopedSuggestionService, CurriculumGraphAgentService) to diagnose, suggest, and improve the graph.

**Arguments:** `/curriculum-graph [command] [subject_id]`
- `/curriculum-graph diagnose Mathematics` — full structural diagnosis + health score
- `/curriculum-graph pulse-sim Mathematics` — simulate Pulse candidate pools across sessions
- `/curriculum-graph suggest Mathematics` — generate Gemini-powered edge suggestions (bulk pipeline)
- `/curriculum-graph scoped-suggest SKILL_ID1 SKILL_ID2` — lightweight scoped edge suggestions (1-2 Gemini calls, < 5s)
- `/curriculum-graph connect-skills SOURCE_SKILL TARGET_SKILL` — pairwise subskill connections (including cross-grade)
- `/curriculum-graph add-edge SOURCE TARGET [relationship]` — create a typed edge (with validation)
- `/curriculum-graph compare Mathematics` — before/after impact comparison

---

## Architecture Context

The curriculum-authoring-service (port 8001) stores the **knowledge graph** in BigQuery (`curriculum_edges` table) and caches it in Firestore. The graph has **typed edges** — prerequisite gating is one property of an edge, not the only kind of connection.

**Edge types (all navigable by Pulse BFS for discovery):**
| Type | Meaning | Pulse Use |
|------|---------|-----------|
| `prerequisite` | A must be mastered before B | BFS discovery + unlock gating |
| `builds_on` | A's concepts extend into B (no gate) | BFS discovery, affinity grouping |
| `reinforces` | Practicing A strengthens B | Review pairing, session variety |
| `parallel` | A and B are peers at similar difficulty | Cold-start breadth, subject interleaving |
| `applies` | A is abstract, B is applied context | Transfer assessment, contextual practice |

Only edges with `is_prerequisite: true` enforce mastery gates. All types are traversable for discovery.

**Key services:**
- `curriculum-authoring-service/app/services/edge_manager.py` — `EdgeManager`: edge CRUD, validation (cycle check on prereq subgraph only), parallel edge auto-reversal
- `curriculum-authoring-service/app/services/graph_analysis.py` — `GraphAnalysisEngine`: pure structural analysis (health metrics, anomalies, impact projection, validation)
- `curriculum-authoring-service/app/services/suggestion_engine.py` — `SuggestionEngine`: Gemini-powered bulk pipeline (embeddings + LLM refinement)
- `curriculum-authoring-service/app/services/scoped_suggestion_service.py` — `ScopedSuggestionService`: lightweight scoped suggestions (1-2 Gemini calls, inline authoring)
- `curriculum-authoring-service/app/services/graph_agent.py` — `CurriculumGraphAgentService`: orchestrator (health reports, suggestion workflow, event hooks)
- `curriculum-authoring-service/app/api/agent.py` — Agent REST endpoints
- `curriculum-authoring-service/app/api/edges.py` — Edge CRUD REST endpoints
- `backend/app/services/dag_analysis.py` — `DAGAnalysisEngine`: runtime graph algorithms + `compute_health_metrics()`, `bfs_reach()`
- `backend/app/services/pulse_engine.py` — Pulse session assembly (strength-weighted BFS on full graph)
- `backend/app/services/learning_paths.py` — `LearningPathsService`: prerequisite gating (`is_prerequisite` filter), `get_related_entities()`

**Graph data model (CurriculumEdge):**
- `source_entity_id`, `target_entity_id`, `source_entity_type`, `target_entity_type`
- `relationship`: prerequisite | builds_on | reinforces | parallel | applies
- `strength`: 0.0–1.0 (affinity signal for Pulse ranking)
- `is_prerequisite`: bool (only these enforce mastery gates)
- `threshold`: mastery threshold (when is_prerequisite)
- `rationale`: why this connection exists (human or agent-authored)
- `authored_by`: "human" | "agent"
- `confidence`: agent confidence (null for human)
- `pair_id`: links reverse edges for parallel relationships

---

## Phase 0: Parse Arguments & Determine Command

### Step 1: Parse the command

| Command | Purpose |
|---------|---------|
| `diagnose` | Full structural analysis + health score via GraphAnalysisEngine |
| `pulse-sim` | Simulate Pulse sessions and measure candidate diversity |
| `suggest` | Generate Gemini-powered edge suggestions via bulk agent API |
| `scoped-suggest` | Lightweight scoped suggestions (1-2 Gemini calls, < 5s) |
| `connect-skills` | Pairwise subskill connections between two skills (cross-grade OK) |
| `add-edge` | Create a typed edge via EdgeManager API |
| `compare` | Before/after impact using agent's impact-preview |

Default: `diagnose` if only a subject_id is given.

### Step 2: Fetch the graph

**Primary: Use the agent health endpoint (if service is running):**
```bash
curl -s http://localhost:8001/api/agent/{subject_id}/health | python -m json.tool
```

**Graph data (for manual analysis):**
```bash
curl -s http://localhost:8001/api/subjects/{subject_id}/knowledge-graph | python -m json.tool > /tmp/graph.json
```

**Fallback:** If the service isn't running, read the cached graph from Firestore via the backend, or read graph JSON from prior reports. Can also use `GraphAnalysisEngine` or `DAGAnalysisEngine.compute_health_metrics()` directly on the graph data.

---

## Command: `diagnose`

Full structural analysis of the knowledge graph. Answers: "Is this graph rich enough to support diverse Pulse sessions?"

**Preferred approach:** Call the agent health endpoint which runs `GraphAnalysisEngine` server-side:
```bash
curl -s http://localhost:8001/api/agent/{subject_id}/health
```

This returns a `GraphHealthReport` with health_score, metrics, anomalies, and pending suggestion count.

**If service is not running**, compute locally using `GraphAnalysisEngine` or `DAGAnalysisEngine.compute_health_metrics()`:

### Step 1: Health metrics

From the `GraphHealthMetrics` (either via API or computed locally):

```
| Metric                    | Value | Assessment        |
|---------------------------|-------|-------------------|
| Total nodes               |       |                   |
| ├─ Skills                 |       |                   |
| └─ Subskills              |       |                   |
| Total edges               |       |                   |
| ├─ prerequisite           |       |                   |
| ├─ builds_on              |       |                   |
| ├─ reinforces             |       |                   |
| ├─ parallel               |       |                   |
| └─ applies                |       |                   |
| Edge density (edges/node) |       | < 1.0 = sparse    |
| Connected components      |       | > 5 = fragmented  |
| Cross-unit edge ratio     |       | < 10% = isolated  |
| Avg BFS reach (5 hops)    |       | < 6 = limited     |
| Dead-end ratio            |       | > 30% = many dead ends |
| Orphan count              |       | > 0 = invisible nodes |
| Bottleneck nodes          |       | single points of failure |
```

### Step 2: Anomaly analysis

From the `GraphAnomaly` list:

| Type | Severity | Description |
|------|----------|-------------|
| `orphan` | warning/critical | Nodes with no edges (invisible to Pulse) |
| `isolated_unit` | critical | Units with no cross-unit edges (unreachable) |
| `bottleneck` | warning | Nodes that are sole prereq for 3+ dependents |
| `dead_end_cluster` | warning | Subtrees with no forward progression |

### Step 3: Depth distribution

Using `DAGAnalysisEngine.compute_node_metrics()` on prerequisite subgraph:

```
Depth Distribution:
| Depth | Nodes | Cumulative | Visual          |
|-------|-------|------------|-----------------|
| 0     | 5     | 5          | ##### (roots)   |
| 1     | 8     | 13         | ########        |
| 2     | 12    | 25         | ############    |
```

Flag issues:
- **Flat graph:** Max depth < 5 → "Most content reachable in 2-3 sessions"
- **Top-heavy:** >50% at depth 0-1 → "Few prerequisite chains"
- **Narrow bottleneck:** Any depth with only 1-2 nodes

### Step 4: Cross-unit connectivity

```
Cross-Unit Edges:
| From Unit        | To Unit          | Edge Count | Types                    |
|------------------|------------------|------------|--------------------------|
| Counting         | Geometry         | 3          | 1 prerequisite, 2 builds_on |
| Counting         | Measurement      | 1          | 1 prerequisite           |

Isolated Units (no cross-unit edges): [Time, Data]
```

### Step 5: Pulse impact summary

```
## Pulse Impact Assessment

Health Score: X/10

Strengths:
  + <what works well>

Weaknesses:
  - <structural issues>

Critical Issues:
  ! <things directly causing repetitive sessions>

BFS Probe Reach (full knowledge graph, 5 hops):
  - Average reachable nodes: N (need >= 6 for frontier probes)
  - Worst case entry: NODE_ID reaches only N nodes
  - Best case entry: NODE_ID reaches N nodes

Pending Agent Suggestions: N
```

---

## Command: `pulse-sim`

Simulate what Pulse would see across sessions. Same logic as before, but now BFS traverses ALL edge types (not just prerequisites) with strength-weighted sorting.

### Step 1: Choose archetype
Same as before: `gifted` (default), `steady`, or `struggling`.

### Step 2: Simulate gate progression
Same simulation logic, but note:
- **Discovery BFS** now traverses all edge types → broader candidate pools
- **Gating** still uses `is_prerequisite` edges only → unchanged unlock logic
- **Strength-weighted sorting** prefers higher-strength connections as tiebreaker

### Step 3: Display results
Same format. Key difference: diversity cliff should be later with rich knowledge-graph edges.

---

## Command: `suggest`

**Preferred approach:** Use the agent suggestion endpoint:
```bash
curl -s -X POST http://localhost:8001/api/agent/{subject_id}/suggest?max_suggestions=10
```

This runs the full Gemini-powered pipeline:
1. Structural gap analysis (orphans, isolated units, dead ends)
2. Semantic similarity via Gemini embeddings
3. LLM refinement (pedagogical coherence, relationship typing)
4. Impact simulation (BFS reach delta, health score delta)
5. Validation (cycle check, redundancy)

Returns ranked `EdgeSuggestion` objects with:
- Suggested relationship type and strength
- Whether it should be a prerequisite gate
- Rationale (human-readable explanation)
- Confidence score
- Impact projection (before/after metrics delta)

**If service is not running**, fall back to manual structural analysis using `GraphAnalysisEngine.identify_opportunities()` and present suggestions for human review.

### Present results

```
## Suggested Edges (ranked by confidence * impact)

### 1. GEOM001-02-G → DATA001-01-A (builds_on, strength: 0.8, HIGH impact)
   Confidence: 0.92
   Rationale: Geometry measurement concepts support data interpretation.
   Impact: BFS reach +6, health score +1.2
   Is prerequisite: No (discovery only)

   Create: POST /api/edges
   {"source_entity_id": "GEOM001-02-G", "source_entity_type": "subskill",
    "target_entity_id": "DATA001-01-A", "target_entity_type": "subskill",
    "relationship": "builds_on", "strength": 0.8, "is_prerequisite": false}

### 2. TIME001-01-A ↔ GEOM001-01-A (parallel, strength: 0.7, MEDIUM impact)
   Confidence: 0.85
   Rationale: Both entry-level, different domains. Enables cross-domain cold-start.
   Impact: Components -1, cross-unit ratio +0.03
   Note: Parallel edges auto-create bidirectional (A→B + B→A)

   Create: POST /api/edges
   {"source_entity_id": "TIME001-01-A", "source_entity_type": "subskill",
    "target_entity_id": "GEOM001-01-A", "target_entity_type": "subskill",
    "relationship": "parallel", "strength": 0.7, "is_prerequisite": false}
```

### Approval workflow

Suggestions are stored in Firestore and can be accepted/rejected:
```bash
# List pending
curl -s http://localhost:8001/api/agent/{subject_id}/suggestions

# Accept (creates draft edge)
curl -s -X POST http://localhost:8001/api/agent/{subject_id}/suggestions/{id}/accept

# Reject
curl -s -X POST http://localhost:8001/api/agent/{subject_id}/suggestions/{id}/reject

# Preview cumulative impact of all pending
curl -s http://localhost:8001/api/agent/{subject_id}/impact-preview
```

---

## Command: `scoped-suggest`

Lightweight scoped edge suggestions — the primary inline authoring tool. Runs 1-2 Gemini calls against a narrow, author-defined scope instead of the bulk 5-phase pipeline.

**Syntax:** `/curriculum-graph scoped-suggest SKILL_ID1 [SKILL_ID2 ...] [--subject SUBJECT_ID]`

Defaults: `subject_id` inferred from skill ID prefix if possible.

### Step 1: Call the scoped suggestion endpoint

```bash
curl -s -X POST http://localhost:8001/api/ai/suggest-edges \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "MATHEMATICS",
    "scope": {
      "skill_ids": ["OPS002-01", "OPS002-02"],
      "include_existing_graph": true
    },
    "options": {
      "max_suggestions": 10,
      "depth": "subskill"
    }
  }'
```

Returns `ScopedSuggestionResponse` with suggestions and scope_summary (nodes analyzed, Gemini calls, elapsed_ms).

### Step 2: Present suggestions

```
## Scoped Suggestions (2.8s, 1 Gemini call)

### 1. OPS001-01-D → OPS002-01-A (builds_on, strength: 0.85)
   Confidence: 0.90
   Rationale: Equation writing within 10 extends to modeling at higher range.
   Source: Grade 1 > Operations > OPS001-01
   Target: Grade 2 > Operations > OPS002-01

### 2. OPS001-01-B → OPS002-01-B (builds_on, strength: 0.75)
   Confidence: 0.82
   Rationale: Part-whole modeling extends to comparison at higher range.
```

### Step 3: Accept selected suggestions

```bash
curl -s -X POST http://localhost:8001/api/ai/suggest-edges/accept \
  -H "Content-Type: application/json" \
  -d '{"suggestion_ids": ["uuid1", "uuid2"], "subject_id": "MATHEMATICS"}'
```

Creates draft edges via EdgeManager (same dual-write, same on_mutation hooks).

---

## Command: `connect-skills`

Find all subskill-level connections between exactly two skills. Supports cross-grade connections.

**Syntax:** `/curriculum-graph connect-skills SOURCE_SKILL TARGET_SKILL [--source-subject SID] [--target-subject SID]`

### Step 1: Call the connect-skills endpoint

```bash
curl -s -X POST http://localhost:8001/api/ai/connect-skills \
  -H "Content-Type: application/json" \
  -d '{
    "source_skill_id": "OPS001-01",
    "source_subject_id": "MATHEMATICS",
    "target_skill_id": "OPS002-01",
    "target_subject_id": "MATHEMATICS"
  }'
```

Returns `ConnectSkillsResponse` with connections and skill_summary.

### Step 2: Present connections

```
## Skill Connections: OPS001-01 → OPS002-01 (3.1s, 1 Gemini call)

Source: 6 subskills | Target: 5 subskills | Connections found: 4

### 1. OPS001-01-D → OPS002-01-A (prerequisite, strength: 0.9)
   "Write equations for add/subtract within 10" → "Model addition within 100"
   Rationale: Equation writing within 10 gates concrete modeling at higher range.

### 2. OPS001-01-B → OPS002-01-B (builds_on, strength: 0.75)
   "Model word problems within 10" → "Model comparison word problems within 100"
   Rationale: Part-whole modeling extends to comparison at higher range.
```

### Step 3: Accept connections

Use the same accept endpoint — connections are stored as scoped suggestions in Firestore:
```bash
curl -s -X POST http://localhost:8001/api/ai/suggest-edges/accept \
  -H "Content-Type: application/json" \
  -d '{"suggestion_ids": ["uuid1", "uuid2"], "subject_id": "MATHEMATICS"}'
```

### Cross-Grade Example

```bash
curl -s -X POST http://localhost:8001/api/ai/connect-skills \
  -H "Content-Type: application/json" \
  -d '{
    "source_skill_id": "GEOM002-04",
    "source_subject_id": "MATHEMATICS",
    "target_skill_id": "NF001-01",
    "target_subject_id": "MATHEMATICS"
  }'
```

The LLM receives grade context and considers developmental progression when suggesting cross-grade connections.

---

## Command: `add-edge`

Create a typed edge via the EdgeManager API. Now supports all relationship types.

**Syntax:** `/curriculum-graph add-edge SOURCE TARGET [relationship] [strength] [is_prerequisite]`

Defaults: `relationship=builds_on`, `strength=0.8`, `is_prerequisite=false`

### Step 1: Validate

```bash
curl -s -X POST http://localhost:8001/api/edges/validate \
  -H "Content-Type: application/json" \
  -d '{"source_entity_id": "SOURCE", "source_entity_type": "subskill",
       "target_entity_id": "TARGET", "target_entity_type": "subskill",
       "relationship": "builds_on", "strength": 0.8,
       "is_prerequisite": false}'
```

Validation checks:
- **Prerequisite edges:** cycle detection on prerequisite subgraph
- **Non-prerequisite edges:** always valid (cycles OK in full graph)
- **All edges:** self-loop check, duplicate check

### Step 2: Confirm with user

```
Adding edge: SOURCE → TARGET
  Type: builds_on (strength: 0.8, NOT a prerequisite gate)
  SOURCE: "Count objects to 20" (COUNT001-05-C)
  TARGET: "Compare measurements" (MEAS001-02-A)

  This creates a discovery connection — Pulse BFS can traverse it,
  but students are NOT blocked from attempting MEAS001-02-A.

  Proceed? [y/n]
```

For prerequisite edges, warn more strongly:
```
  WARNING: is_prerequisite=true — students MUST master SOURCE before TARGET unlocks.
```

For parallel edges, note:
```
  Note: Parallel edges auto-create both directions (A→B and B→A).
```

### Step 3: Create the edge

```bash
curl -s -X POST http://localhost:8001/api/edges \
  -H "Content-Type: application/json" \
  -d '{"source_entity_id": "SOURCE", "source_entity_type": "subskill",
       "target_entity_id": "TARGET", "target_entity_type": "subskill",
       "relationship": "builds_on", "strength": 0.8,
       "is_prerequisite": false,
       "rationale": "Counting concepts support measurement comparison"}'
```

### Step 4: Regenerate the graph cache

```bash
curl -s -X POST http://localhost:8001/api/graph/{subject_id}/regenerate
```

### Step 5: Verify

Re-fetch the graph and show updated health metrics. The agent's `on_graph_mutation` hook automatically triggers re-analysis.

---

## Command: `compare`

Before/after comparison showing how edge changes affect graph health and Pulse behavior.

**Preferred:** Use the agent's impact-preview for pending suggestions:
```bash
curl -s http://localhost:8001/api/agent/{subject_id}/impact-preview
```

**For manual comparison:**

### Step 1: Load baseline
Fetch the published graph (`include_drafts=false`).

### Step 2: Load current state
Fetch including drafts (`include_drafts=true`).

### Step 3: Diff

```
## Graph Changes

Added edges: 3
  + GEOM001-02-G → DATA001-01-A (builds_on, strength: 0.8, agent-authored)
  + TIME001-01-A ↔ GEOM001-01-A (parallel, strength: 0.7, agent-authored)
  + COUNT001-05-C → MEAS001-02-A (reinforces, strength: 0.6, human-authored)

Removed edges: 0

## Impact on Metrics

| Metric                 | Before | After  | Change |
|------------------------|--------|--------|--------|
| Total edges            | 160    | 165    | +5     |
| Edge density           | 0.85   | 0.88   | +0.03  |
| Connected components   | 46     | 42     | -4     |
| Cross-unit ratio       | 5%     | 8%     | +3%    |
| Avg BFS reach (5 hops) | 3.3    | 5.8    | +2.5   |
| Dead-end ratio         | 41%    | 38%    | -3%    |
| Health score           | 4/10   | 5.5/10 | +1.5   |
```

---

## Key Files

| File | Purpose |
|------|---------|
| `curriculum-authoring-service/app/models/edges.py` | Edge data model (5 relationship types, strength, authorship) |
| `curriculum-authoring-service/app/models/suggestions.py` | Suggestion, health report, anomaly models |
| `curriculum-authoring-service/app/services/edge_manager.py` | Edge CRUD, validation, parallel auto-reversal |
| `curriculum-authoring-service/app/services/graph_analysis.py` | `GraphAnalysisEngine` — pure structural analysis |
| `curriculum-authoring-service/app/services/suggestion_engine.py` | `SuggestionEngine` — Gemini embeddings + LLM refinement (bulk) |
| `curriculum-authoring-service/app/services/scoped_suggestion_service.py` | `ScopedSuggestionService` — lightweight scoped suggestions (inline authoring) |
| `curriculum-authoring-service/app/models/scoped_suggestions.py` | Request/response models for scoped suggestions |
| `curriculum-authoring-service/app/services/graph_agent.py` | `CurriculumGraphAgentService` — orchestrator + event hooks |
| `curriculum-authoring-service/app/services/graph_cache_manager.py` | Graph caching in Firestore (enriched edge metadata) |
| `curriculum-authoring-service/app/api/edges.py` | Edge CRUD endpoints |
| `curriculum-authoring-service/app/api/agent.py` | Agent endpoints (health, suggest, accept/reject, impact) |
| `backend/app/services/dag_analysis.py` | `DAGAnalysisEngine` — runtime algorithms + `compute_health_metrics()` |
| `backend/app/services/pulse_engine.py` | Pulse session assembly (strength-weighted BFS on full graph) |
| `backend/app/services/learning_paths.py` | `LearningPathsService` — prerequisite gating + `get_related_entities()` |

## Checklist

- [ ] Parsed command and arguments
- [ ] Fetched graph (via agent API, knowledge-graph API, or fallback)
- [ ] For `diagnose`: retrieved or computed health report (metrics + anomalies + score)
- [ ] For `diagnose`: identified Pulse-specific impact and BFS reach stats
- [ ] For `pulse-sim`: simulated N sessions with archetype using strength-weighted BFS
- [ ] For `pulse-sim`: identified diversity cliff point
- [ ] For `suggest`: called agent suggest endpoint (or manual structural analysis)
- [ ] For `suggest`: presented ranked suggestions with relationship type, impact, rationale
- [ ] For `scoped-suggest`: called POST /api/ai/suggest-edges with scoped skill IDs
- [ ] For `scoped-suggest`: presented suggestions with context, rationale, and confidence
- [ ] For `scoped-suggest`: offered accept workflow via POST /api/ai/suggest-edges/accept
- [ ] For `connect-skills`: called POST /api/ai/connect-skills with source/target skills
- [ ] For `connect-skills`: presented pairwise connections with source→target labels
- [ ] For `connect-skills`: offered accept workflow (same endpoint as scoped-suggest)
- [ ] For `add-edge`: validated (cycle check on prereq subgraph), confirmed with user, created via edges API
- [ ] For `add-edge`: noted parallel auto-reversal if applicable
- [ ] For `compare`: showed before/after health metrics and Pulse impact delta
- [ ] Presented actionable summary to user
