# Curriculum Knowledge Graph PRD

**Status:** Draft
**Date:** 2026-03-22
**Depends on:** Mastery Lifecycle (unified-mastery-lifecycle-prd.md), Planning Architecture (PLANNING_ARCHITECTURE.md)

---

## 1. Problem Statement

The curriculum graph today is a **prerequisite-only DAG** — every edge means "A must be mastered before B unlocks." This conflates two distinct concepts:

1. **Connectedness** — "these skills are related, adjacent, or build on each other"
2. **Gating** — "this specific skill must be mastered before that one can begin"

### Consequences

**Pulse is blind to most content.** Pulse discovers new content via BFS on the prerequisite graph. Skills with no prerequisite path from the student's current position are invisible. The Mathematics graph today has 46 connected components — GEOM (15 nodes, 0 edges) and TIME (19 nodes, 2 small chains) are completely unreachable from the main COUNT/OPS/MEAS cluster.

**Authors can't express relationships without creating gates.** To tell the system that counting relates to geometry, the only option is making one a prerequisite of the other — which creates a false pedagogical constraint. So authors don't add the connection, and the skills remain isolated.

**Graph sparsity limits diversity.** 188 nodes, 160 edges, 0.85 avg edges/node. Only 5% of edges cross units. 88% of entry points reach fewer than 6 nodes in 5 hops. Pulse exhausts candidate pools by session 4-5 for advanced students.

### Root Cause

The data model has one edge type. The system needs a **knowledge graph** with typed relationships, where prerequisite gating is one property of a connection — not the only kind of connection.

---

## 2. Proposed Model: Curriculum Knowledge Graph

### 2.1 Core Concepts

**Nodes** remain as they are: skills and subskills with their existing metadata (subject, unit, difficulty bands, ordering).

**Edges** gain a richer model:

```
CurriculumEdge {
  id: string                    // unique edge identifier
  source: string                // source entity ID
  target: string                // target entity ID
  source_type: "skill" | "subskill"
  target_type: "skill" | "subskill"

  // --- Relationship layer ---
  relationship: RelationshipType
  strength: float (0.0–1.0)    // how strongly related (for ranking)
  rationale: string             // why this connection exists (human or agent-authored)

  // --- Gating layer (only when is_prerequisite = true) ---
  is_prerequisite: bool         // does source gate target?
  threshold: float              // mastery threshold (default 0.8)

  // --- Metadata ---
  authored_by: "human" | "agent"
  confidence: float             // agent confidence if auto-suggested
  created_at: datetime
  version_id: string
  is_draft: bool
}
```

### 2.2 Relationship Types

| Type | Meaning | Example | Pulse Use |
|------|---------|---------|-----------|
| `prerequisite` | A must be mastered before B | COUNT001-01-A → COUNT001-01-B | BFS discovery + unlock gating |
| `builds_on` | A's concepts extend into B (no gate) | COUNT001-03-B → GEOM001-01-A (comparing → shape comparison) | BFS discovery, affinity grouping |
| `reinforces` | Practicing A strengthens B | OPS001-01-C → COUNT001-02-E (addition equations → counting practice) | Review pairing, session variety |
| `parallel` | A and B are peers at similar difficulty | GEOM001-01-A ↔ TIME001-01-A (both entry-level, different domains) | Cold-start breadth, subject interleaving |
| `applies` | A is abstract, B is applied context | COUNT001-02-B → MEAS001-02-B (counting objects → counting per category) | Transfer assessment, contextual practice |

The key insight: **all relationship types are navigable by Pulse for discovery**. Only edges with `is_prerequisite: true` enforce mastery gates.

### 2.3 Graph Properties

**Directional semantics:** `source → target` means "source relates forward to target." For `prerequisite` edges, this means source must be mastered first. For `builds_on`, this means target extends source concepts. For `parallel`, direction is arbitrary (effectively bidirectional for BFS).

**Prerequisite is a property, not a type.** An edge can be `relationship: "builds_on", is_prerequisite: true` — meaning "B builds on A's concepts AND A must be mastered first." Or `relationship: "builds_on", is_prerequisite: false` — meaning "B builds on A's concepts but students can attempt B without mastering A."

**Strength as a signal.** A `strength: 0.9` connection means skills are tightly coupled. Pulse can use strength to prefer higher-affinity transitions between session items (smoother cognitive flow). Strength also ranks agent suggestions.

---

## 3. Agentic Graph Service

The curriculum-authoring-service gains an **agentic analysis layer** that continuously monitors graph health and suggests improvements. This is not a fire-and-forget script — it's an always-available service that authors interact with.

### 3.1 Capabilities

#### Structural Analysis (what the diagnosis skill does today, but automated)

- **Health metrics:** Node count, edge density, depth distribution, branching factor, component fragmentation, cross-unit connectivity ratio
- **Pulse impact scoring:** BFS reach from each entry point, candidate pool projections across sessions, diversity cliff detection
- **Anomaly detection:** Orphan nodes, isolated units, bottleneck nodes (single point of failure in prerequisite chains), dead-end clusters

Runs on every graph mutation (edge add/remove, node add/remove). Results cached and surfaced in the visualization layer.

#### Connection Suggestion

Given the curriculum content (skill descriptions, learning objectives, difficulty bands), the agent suggests edges that would improve graph health:

**Input signals:**
- Semantic similarity between skill/subskill descriptions (embedding-based)
- Difficulty band adjacency (similar difficulty_start/end → likely peers or builds_on)
- Unit/subject structure (skills in the same unit are likely connected)
- Graph structural gaps (isolated nodes, low-reach entry points, missing cross-unit bridges)
- Pedagogical heuristics (e.g., concrete → abstract progression, single-attribute → multi-attribute)

**Output:** Ranked list of suggested edges with:
- Suggested relationship type and strength
- Whether it should be a prerequisite gate
- Rationale (human-readable explanation)
- Confidence score
- Projected impact on Pulse diversity metrics (before/after)

#### Prerequisite Inference

For `builds_on` and `applies` edges, the agent can suggest which ones should also be prerequisite gates based on:
- Difficulty gap between source and target (large gap → likely needs gating)
- Pedagogical dependency analysis (does target's learning objective assume source's concepts?)
- Existing student performance data (if available): do students who skip A consistently fail B?

#### Validation

Before any edge is committed:
- **Cycle detection** on the prerequisite subgraph (non-prerequisite edges can form cycles — that's fine)
- **Pedagogical coherence check:** Does the relationship type make sense given the skill descriptions?
- **Redundancy check:** Is this edge implied by transitivity? (A→B→C already exists, adding A→C is redundant for prerequisites but may be valid for `reinforces`)
- **Impact simulation:** How does this edge change Pulse behavior? (BFS reach delta, candidate pool change)

### 3.2 Agent Authority Model

The agent **suggests, humans approve.** No auto-commit of edges.

```
Agent Workflow:
  1. Agent analyzes graph → generates suggestions
  2. Suggestions appear in visualization as "proposed edges" (dashed lines)
  3. Author reviews: accept, modify, or reject
  4. Accepted edges enter draft state
  5. Author publishes draft → edges go live
  6. Pulse picks up new graph on next session assembly
```

Exception: **structural validation** (cycle detection, anomaly flagging) is automatic and blocking. You cannot publish a graph with prerequisite cycles.

### 3.3 Continuous Monitoring

The agent watches for:
- **Graph staleness:** New skills/subskills added via curriculum authoring but not connected to the graph
- **Performance signals:** Student mastery data that contradicts prerequisite assumptions (e.g., students consistently mastering B without A → maybe A isn't truly prerequisite)
- **Diversity regression:** Pulse session logs showing increasing repetition → trigger re-analysis and new suggestions

---

## 4. Consumer Changes

### 4.1 Pulse Engine

**Discovery BFS:** Navigates ALL edge types (not just prerequisites). This is the core change — Pulse can now reach GEOM and TIME through `builds_on` or `parallel` edges from COUNT/MEAS.

```python
# Current: BFS only follows prerequisite edges
for edge in edges:
    if edge['source'] == current_node:
        candidates.append(edge['target'])

# New: BFS follows all edges, with strength-weighted preference
for edge in edges:
    if edge['source'] == current_node:
        candidates.append({
            'target': edge['target'],
            'strength': edge['strength'],
            'is_prerequisite': edge['is_prerequisite'],
            'relationship': edge['relationship']
        })
# Sort candidates by strength (prefer tightly related skills)
# For frontier probes: prefer builds_on/applies edges (forward progression)
# For session variety: prefer parallel/reinforces edges (breadth)
```

**Band assembly refinements:**
- **CURRENT band:** Still uses prerequisite gating (only unlocked subskills). Unchanged.
- **FRONTIER band:** BFS on full graph. Probe candidates can now come from any related domain. Frontier probes on non-prerequisite edges don't require prior mastery — they're exploratory.
- **REVIEW band:** Can use `reinforces` edges to pair review items with complementary practice (e.g., review counting alongside a measurement task that uses counting).

**Session coherence:** Use `strength` and `relationship` type to build sessions that feel thematically connected rather than random. A session about "comparing" could flow: compare numbers (COUNT) → compare shapes (GEOM) → compare measurements (MEAS) via `parallel` edges.

### 4.2 LearningPathsService

**Unlock logic filters to `is_prerequisite: true` edges only.** This is critical — non-prerequisite connections must never block a student.

```python
# Current
async def check_prerequisites_met(student_id, target_entity_id, ...):
    for edge in edges_to_target:
        if proficiency < edge['threshold']:
            return unlocked=False

# New: identical, but filters first
async def check_prerequisites_met(student_id, target_entity_id, ...):
    prereq_edges = [e for e in edges_to_target if e['is_prerequisite']]
    for edge in prereq_edges:
        if proficiency < edge['threshold']:
            return unlocked=False
```

**New capability:** `get_related_entities(entity_id)` — returns all connected entities regardless of prerequisite status, with relationship metadata. Used by Pulse for discovery and by the frontend for "related skills" display.

### 4.3 DAGAnalysisEngine

**Prerequisite algorithms** (topological sort, cycle detection, inference propagation) operate on the **prerequisite subgraph** — the filtered subset of edges where `is_prerequisite: true`.

**Discovery algorithms** (BFS reach, probe candidates, coverage) operate on the **full graph** — all edges.

New algorithms:
- **Cluster detection:** Find groups of tightly connected nodes (community detection on the full graph). These become "topic clusters" for session theming.
- **Bridge identification:** Edges that connect otherwise-separated clusters. High-value connections for graph health.
- **Strength propagation:** If A→B is strong and B→C is strong, A→C has implied strength (transitive affinity). Useful for suggesting missing edges.

### 4.4 PlanningService

**Weekly/monthly planning** uses prerequisite subgraph for forecasting (gate blocking, completion estimates). Unchanged in logic, but benefits from better Pulse diversity → more skills progressing → better forecast accuracy.

**Daily plan interleaving** can use relationship types for smarter ordering. Instead of purely alternating subjects, interleave by thematic cluster (connected skills from different subjects in sequence).

---

## 5. Visualization

### 5.1 Graph Explorer (Primary View)

**Interactive force-directed graph** showing the full knowledge graph for a subject.

**Visual encoding:**
- **Nodes:** Circles sized by depth (deeper = smaller), colored by unit/subject
- **Edges:** Solid lines for prerequisites, dashed for other relationship types. Thickness = strength. Color = relationship type.
- **Student overlay (optional):** Node color shifts to reflect mastery gate (gray=gate 0, yellow=gate 1, green=gate 2+, gold=gate 4). Locked nodes dimmed.
- **Agent suggestions:** Proposed edges shown as pulsing dashed lines with confidence badge

**Interactions:**
- Click node → see skill details, all connections, mastery status
- Click edge → see relationship type, prerequisite status, threshold, rationale
- Drag to rearrange layout
- Filter by: unit, relationship type, prerequisite only, depth range, mastery gate
- Toggle: show/hide skill-level nodes, show/hide agent suggestions

### 5.2 Health Dashboard

**Sidebar or overlay** showing live graph health metrics:

```
Graph Health Score: 7/10

Metrics:
  Connectedness:    ████████░░  82%
  Cross-unit ratio: ███░░░░░░░  28%
  BFS avg reach:    ██████░░░░  62%
  Dead-end ratio:   ██░░░░░░░░  18% (lower is better)

Issues (3):
  ⚠ GEOM001 cluster has 2 orphan subskills
  ⚠ TIME → MEAS bridge has only 1 edge (fragile)
  ℹ Agent has 5 pending suggestions
```

### 5.3 Session Simulator

**Overlay** that shows what Pulse would produce given the current graph state:

- Pick an archetype (gifted/steady/struggling)
- Watch Pulse assemble sessions 1-6
- See which nodes light up as candidates at each step
- See where the diversity cliff hits
- See how proposed edges (agent suggestions) would change the simulation

### 5.4 Diff View

When reviewing agent suggestions or draft changes:
- Split view: current published graph vs. proposed graph
- Highlighted additions/removals
- Delta metrics panel showing before/after health scores

---

## 6. Data Model Changes

### 6.1 BigQuery Schema

**`curriculum_edges` table** (replaces or extends `curriculum_prerequisites`):

| Column | Type | Description |
|--------|------|-------------|
| edge_id | STRING | Unique identifier |
| source_entity_id | STRING | Source node ID |
| source_entity_type | STRING | "skill" or "subskill" |
| target_entity_id | STRING | Target node ID |
| target_entity_type | STRING | "skill" or "subskill" |
| relationship | STRING | "prerequisite", "builds_on", "reinforces", "parallel", "applies" |
| strength | FLOAT | 0.0–1.0 |
| is_prerequisite | BOOL | Whether this edge gates mastery |
| threshold | FLOAT | Mastery threshold (only when is_prerequisite) |
| rationale | STRING | Why this connection exists |
| authored_by | STRING | "human" or "agent" |
| confidence | FLOAT | Agent confidence (null for human) |
| version_id | STRING | Curriculum version |
| is_draft | BOOL | Draft vs published |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.2 Firestore Cache

**`curriculum_graphs/{subject_id}`** cached document gains:

```json
{
  "graph": {
    "nodes": [...],
    "edges": [
      {
        "id": "edge_001",
        "source": "COUNT001-03-B",
        "target": "GEOM001-01-A",
        "relationship": "builds_on",
        "strength": 0.7,
        "is_prerequisite": false,
        "threshold": null,
        "rationale": "Comparing groups of objects (counting) supports comparing shape properties (geometry)"
      }
    ]
  },
  "metadata": {
    "entity_counts": {...},
    "edge_counts": {
      "total": 200,
      "prerequisite": 120,
      "builds_on": 45,
      "reinforces": 20,
      "parallel": 10,
      "applies": 5
    },
    "health_score": 7,
    "health_metrics": {...}
  }
}
```

### 6.3 Migration

The existing `curriculum_prerequisites` data migrates cleanly:

```
For each existing edge:
  relationship = "prerequisite"   (inferred — all existing edges are prerequisites)
  strength = 1.0                  (strong — explicitly authored)
  is_prerequisite = true
  threshold = existing threshold
  rationale = null                (to be backfilled by agent or human)
  authored_by = "human"
  confidence = null
```

No data loss. All existing behavior preserved. New relationship types are purely additive.

---

## 7. Implementation Phases

### Phase 1: Data Model & Migration
- Extend edge model in curriculum-authoring-service with new fields
- Migrate existing prerequisites (all become `relationship: "prerequisite", is_prerequisite: true`)
- Update graph cache to include new fields
- Update APIs to accept and return enriched edges
- **Consumer changes: none.** Pulse/LearningPaths continue working — they just see extra fields they ignore.

### Phase 2: Consumer Separation
- LearningPathsService: filter to `is_prerequisite: true` for unlock checks
- DAGAnalysisEngine: separate prerequisite-subgraph algorithms from full-graph algorithms
- Pulse: BFS on full graph for discovery, prerequisite filter for gating
- PlanningService: prerequisite subgraph for forecasting (unchanged logic, explicit filter)
- **Result:** System correctly handles mixed edge types. No new edges yet, but infrastructure ready.

### Phase 3: Agentic Analysis
- Structural analysis engine (health metrics, anomaly detection, BFS reach scoring)
- Connection suggestion engine (semantic similarity, structural gap analysis, pedagogical heuristics)
- Prerequisite inference (which `builds_on` edges should also gate?)
- Validation pipeline (cycles, coherence, impact simulation)
- API endpoints for suggestions, approval workflow
- **Result:** Agent can suggest edges. Humans review and approve.

### Phase 4: Visualization
- Graph explorer with force-directed layout
- Health dashboard
- Session simulator
- Diff view for draft review
- Agent suggestion overlay
- **Result:** Authors can see and interact with the full knowledge graph.

### Phase 5: Continuous Learning
- Performance signal integration (student mastery data → validate/challenge prerequisite assumptions)
- Automatic re-analysis on graph mutations
- Diversity regression alerts from Pulse session logs
- **Result:** The graph improves over time based on real student data.

---

## 8. Success Metrics

| Metric | Current | Phase 2 Target | Phase 5 Target |
|--------|---------|----------------|----------------|
| Connected components | 46 | ≤ 5 | 1-2 |
| Cross-unit edge ratio | 5% | ≥ 20% | ≥ 30% |
| Avg BFS reach (5 hops) | 3.3 nodes | ≥ 10 | ≥ 20 |
| Roots with < 6 reachable | 88% | ≤ 30% | ≤ 10% |
| Pulse diversity cliff | Session 4-5 | Session 8+ | Session 12+ |
| Graph health score | 4/10 | 7/10 | 9/10 |
| Dead-end leaf ratio | 41% | ≤ 25% | ≤ 15% |

---

## 9. Open Questions

1. **Bidirectional edges.** Should `parallel` relationships create two directed edges (A→B and B→A) or a single undirected edge? Undirected is cleaner semantically but BFS implementations assume directed graphs.

2. **Strength decay.** Should edge strength decay if the connection isn't validated by student performance data over time? Or is strength purely an authoring-time signal?

3. **Cross-subject edges.** The current model is per-subject. Should the knowledge graph span subjects? (e.g., Mathematics counting → Language Arts number words). This would dramatically expand Pulse's reach but adds complexity.

4. **Agent model selection.** What LLM/embedding model powers the semantic similarity analysis for connection suggestions? Gemini (already integrated) is the natural choice. Cost/latency tradeoffs for continuous analysis.

5. **Granularity.** Should the knowledge graph connect skill-level nodes, subskill-level nodes, or both? Today skill-level nodes are disconnected orphans. Making them cluster headers (skill contains subskills, skill-to-skill edges create inter-cluster bridges) could simplify authoring.

6. **Retroactive gating.** If the agent discovers (from student data) that a `builds_on` edge should be a prerequisite, how do we handle students already past that point? Grandfather them or re-evaluate?

---

## 10. Appendix: Diagnosis That Prompted This PRD

Full diagnosis of Mathematics graph (2026-03-22):

- 188 nodes (25 skills, 163 subskills), 160 edges
- 46 connected components (largest: 129 nodes spanning COUNT/MEAS/OPS/PTRN)
- GEOM: 15 nodes, 0 edges (entirely disconnected)
- TIME: 19 nodes split across 2 small chains + 5 singletons
- 88% of root nodes reach < 6 nodes in 5 hops
- 41% of nodes are dead-end leaves
- 5% cross-unit edge ratio (all from COUNT outbound)
- 25 skill-level nodes completely disconnected from the subskill graph
- Graph Diversity Score: 4/10
