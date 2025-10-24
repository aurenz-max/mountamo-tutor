# Curriculum Graph Integration Guide

**Complete Guide to Using Prerequisite Graphs in Your Student Learning App**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Graph Structure](#graph-structure)
4. [API Reference](#api-reference)
5. [Frontend Integration](#frontend-integration)
6. [Use Cases & Examples](#use-cases--examples)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is the Curriculum Graph?

The curriculum graph is a **directed acyclic graph (DAG)** that represents prerequisite relationships between skills and subskills in your curriculum. It enables:

- **Adaptive learning paths**: Show students what they can learn next based on mastered skills
- **Prerequisite checking**: Lock content until prerequisites are met
- **Progress visualization**: Display skill trees and learning progression
- **Personalized recommendations**: Suggest optimal next skills based on student proficiency

### Key Features

- ✅ **Cached for performance**: Graphs are pre-generated and cached in Firestore (~50ms response time)
- ✅ **Version-aware**: Separate draft and published graphs for safe curriculum editing
- ✅ **Enriched metadata**: Full hierarchical context (subject → unit → skill → subskill)
- ✅ **Proficiency thresholds**: Configure mastery requirements for unlocking content (default: 80%)
- ✅ **Cycle-free**: System prevents circular dependencies during authoring

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Student Learning App                         │
│  (Next.js - my-tutoring-app)                                    │
│                                                                  │
│  Components:                                                     │
│  • Learning Path Visualizer                                     │
│  • Skill Tree UI                                                │
│  • Progress Tracker                                             │
│  • Adaptive Content Router                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTPS / REST API
                 │
┌────────────────▼────────────────────────────────────────────────┐
│           Curriculum Authoring Service                          │
│  (FastAPI - Port 8001)                                          │
│                                                                  │
│  Endpoints:                                                     │
│  • GET  /api/graph/{subject_id}                                │
│  • POST /api/graph/{subject_id}/regenerate                     │
│  • GET  /api/graph/{subject_id}/status                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Reads from cache
                 │
┌────────────────▼────────────────────────────────────────────────┐
│              Firebase Firestore (Graph Cache)                   │
│                                                                  │
│  Collections:                                                   │
│  • curriculum_graphs/{subject_id}/versions/{version_id}        │
│                                                                  │
│  Cache TTL: Updated on curriculum changes                       │
│  Performance: ~50ms average response time                       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Student loads learning dashboard
   ↓
2. App fetches curriculum graph for subject (e.g., MATHEMATICS)
   ↓
3. Curriculum service returns cached graph from Firestore
   ↓
4. App combines graph with student's proficiency data from BigQuery
   ↓
5. App calculates unlocked skills and recommended next steps
   ↓
6. UI displays personalized learning path
```

---

## Graph Structure

### Graph Response Format

```typescript
interface PrerequisiteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  // Identity
  id: string;                    // skill_id or subskill_id
  type: "skill" | "subskill";
  label: string;                  // Human-readable description

  // Hierarchy
  subject_id: string;
  unit_id: string;
  unit_title: string;
  unit_order: number;

  // Skill-specific fields (if type === "skill")
  skill_order?: number;

  // Subskill-specific fields (if type === "subskill")
  skill_id?: string;              // Parent skill
  skill_description?: string;     // Parent skill description
  skill_order?: number;           // Parent skill order
  subskill_order?: number;
  difficulty_start?: number;      // 0.0 - 1.0
  difficulty_end?: number;        // 0.0 - 1.0
  target_difficulty?: number;     // 0.0 - 1.0
}

interface GraphEdge {
  // Identity
  id: string;                     // prerequisite_id

  // Connection
  source: string;                 // prerequisite_entity_id
  source_type: "skill" | "subskill";
  target: string;                 // unlocks_entity_id
  target_type: "skill" | "subskill";

  // Requirement
  threshold: number;              // Min proficiency to unlock (0.0 - 1.0, default 0.8)
  version_id: string;
}
```

### Example Graph

```json
{
  "nodes": [
    {
      "id": "COUNT001-01-A",
      "type": "subskill",
      "label": "Count and recognize numbers 0-10",
      "subject_id": "MATHEMATICS",
      "unit_id": "counting-cardinality-k",
      "unit_title": "Counting and Cardinality",
      "unit_order": 1,
      "skill_id": "KNOW-NUM-NAMES-K",
      "skill_description": "Know number names and count sequence",
      "skill_order": 1,
      "subskill_order": 1,
      "difficulty_start": 0.1,
      "difficulty_end": 0.3,
      "target_difficulty": 0.2
    },
    {
      "id": "COUNT001-01-C",
      "type": "subskill",
      "label": "Count, recognize, and write numbers 11-20",
      "subject_id": "MATHEMATICS",
      "unit_id": "counting-cardinality-k",
      "unit_title": "Counting and Cardinality",
      "unit_order": 1,
      "skill_id": "KNOW-NUM-NAMES-K",
      "skill_description": "Know number names and count sequence",
      "skill_order": 1,
      "subskill_order": 3,
      "difficulty_start": 0.3,
      "difficulty_end": 0.5,
      "target_difficulty": 0.4
    }
  ],
  "edges": [
    {
      "id": "prereq-12345",
      "source": "COUNT001-01-A",
      "source_type": "subskill",
      "target": "COUNT001-01-C",
      "target_type": "subskill",
      "threshold": 0.8,
      "version_id": "208bf195-c257-4112-908f-2e51efe7eba9"
    }
  ]
}
```

**This means**: To unlock "Count 11-20" (COUNT001-01-C), student must achieve 80% proficiency in "Count 0-10" (COUNT001-01-A).

---

## API Reference

### Base URL

```
http://localhost:8001/api
# or
https://your-production-domain.com/api
```

### Endpoints

#### 1. Get Curriculum Graph

**GET** `/graph/{subject_id}`

Fetches the cached curriculum graph for a subject.

**Parameters:**
- `subject_id` (path): Subject identifier (e.g., "MATHEMATICS", "LANGUAGE_ARTS")
- `include_drafts` (query, optional): Include draft entities (default: false)
- `force_refresh` (query, optional): Force regeneration (default: false)

**Response:** `PrerequisiteGraph` (see structure above)

**Example:**
```typescript
const response = await fetch(
  'http://localhost:8001/api/graph/MATHEMATICS?include_drafts=false'
);
const graph: PrerequisiteGraph = await response.json();
```

**Performance:**
- Cached: ~50ms
- Force refresh: ~2-5 seconds

---

#### 2. Get Cache Status

**GET** `/graph/{subject_id}/status`

Get cache status and metadata for a subject's graphs.

**Response:**
```typescript
{
  subject_id: string;
  cached_versions: {
    draft?: {
      version_id: string;
      generated_at: string;
      last_accessed_at: string;
      metadata: {
        entity_counts: {
          skills: number;
          subskills: number;
          total: number;
        };
        edge_count: number;
      };
    };
    published?: { ... }  // Same structure
  };
}
```

**Example:**
```typescript
const status = await fetch(
  'http://localhost:8001/api/graph/MATHEMATICS/status'
).then(r => r.json());

console.log(`Published graph has ${status.cached_versions.published.metadata.edge_count} prerequisites`);
```

---

#### 3. Regenerate Graph (Admin)

**POST** `/graph/{subject_id}/regenerate-all`

Force regeneration of both draft and published graphs. Use this after curriculum changes.

**Response:**
```typescript
{
  message: string;
  subject_id: string;
  published: {
    node_count: number;
    edge_count: number;
  };
  draft: {
    node_count: number;
    edge_count: number;
  };
}
```

---

## Frontend Integration

### Step 1: Create API Client

Create `src/lib/curriculumGraphApi.ts`:

```typescript
import { authApiClient } from './authApiClient';

export interface GraphNode {
  id: string;
  type: "skill" | "subskill";
  label: string;
  subject_id: string;
  unit_id: string;
  unit_title: string;
  unit_order: number;
  skill_id?: string;
  skill_order?: number;
  subskill_order?: number;
  difficulty_start?: number;
  difficulty_end?: number;
  target_difficulty?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  source_type: "skill" | "subskill";
  target: string;
  target_type: "skill" | "subskill";
  threshold: number;
  version_id: string;
}

export interface PrerequisiteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const CURRICULUM_SERVICE_URL = process.env.NEXT_PUBLIC_CURRICULUM_SERVICE_URL || 'http://localhost:8001';

export const curriculumGraphApi = {
  /**
   * Fetch curriculum graph for a subject
   */
  async getGraph(
    subjectId: string,
    options?: {
      includeDrafts?: boolean;
      forceRefresh?: boolean;
    }
  ): Promise<PrerequisiteGraph> {
    const params = new URLSearchParams();
    if (options?.includeDrafts) params.set('include_drafts', 'true');
    if (options?.forceRefresh) params.set('force_refresh', 'true');

    const url = `${CURRICULUM_SERVICE_URL}/api/graph/${subjectId}${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get cache status for a subject
   */
  async getCacheStatus(subjectId: string) {
    const response = await fetch(`${CURRICULUM_SERVICE_URL}/api/graph/${subjectId}/status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch cache status: ${response.statusText}`);
    }
    return response.json();
  }
};
```

---

### Step 2: Create React Hook

Create `src/lib/useCurriculumGraph.ts`:

```typescript
import { useState, useEffect } from 'react';
import { curriculumGraphApi, PrerequisiteGraph, GraphNode, GraphEdge } from './curriculumGraphApi';

export interface UseGraphOptions {
  subjectId: string;
  includeDrafts?: boolean;
  enabled?: boolean;  // Set to false to prevent auto-fetching
}

export function useCurriculumGraph({ subjectId, includeDrafts = false, enabled = true }: UseGraphOptions) {
  const [graph, setGraph] = useState<PrerequisiteGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !subjectId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchGraph = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await curriculumGraphApi.getGraph(subjectId, { includeDrafts });

        if (isMounted) {
          setGraph(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch graph'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchGraph();

    return () => {
      isMounted = false;
    };
  }, [subjectId, includeDrafts, enabled]);

  return { graph, loading, error };
}
```

---

### Step 3: Build Graph Helper Functions

Create `src/lib/graphHelpers.ts`:

```typescript
import { PrerequisiteGraph, GraphNode, GraphEdge } from './curriculumGraphApi';

/**
 * Student proficiency data from BigQuery
 */
export interface StudentProficiency {
  skill_id?: string;
  subskill_id?: string;
  proficiency: number;  // 0.0 - 1.0
}

/**
 * Check if a node is unlocked for a student based on their proficiency
 */
export function isNodeUnlocked(
  nodeId: string,
  graph: PrerequisiteGraph,
  studentProficiencies: StudentProficiency[]
): boolean {
  // Find all prerequisites (edges where this node is the target)
  const prerequisites = graph.edges.filter(edge => edge.target === nodeId);

  // If no prerequisites, node is unlocked
  if (prerequisites.length === 0) {
    return true;
  }

  // Check if ALL prerequisites are met
  return prerequisites.every(prereq => {
    const proficiency = studentProficiencies.find(p =>
      (p.skill_id === prereq.source || p.subskill_id === prereq.source)
    );

    // If no proficiency data, assume not met
    if (!proficiency) {
      return false;
    }

    // Check if proficiency meets threshold
    return proficiency.proficiency >= prereq.threshold;
  });
}

/**
 * Get all unlocked nodes for a student
 */
export function getUnlockedNodes(
  graph: PrerequisiteGraph,
  studentProficiencies: StudentProficiency[]
): GraphNode[] {
  return graph.nodes.filter(node =>
    isNodeUnlocked(node.id, graph, studentProficiencies)
  );
}

/**
 * Get prerequisite nodes for a target node
 */
export function getPrerequisites(
  nodeId: string,
  graph: PrerequisiteGraph
): { node: GraphNode; edge: GraphEdge }[] {
  const prerequisiteEdges = graph.edges.filter(edge => edge.target === nodeId);

  return prerequisiteEdges.map(edge => {
    const node = graph.nodes.find(n => n.id === edge.source);
    return { node: node!, edge };
  }).filter(item => item.node);  // Filter out missing nodes
}

/**
 * Get nodes that this node unlocks
 */
export function getUnlocks(
  nodeId: string,
  graph: PrerequisiteGraph
): { node: GraphNode; edge: GraphEdge }[] {
  const unlockEdges = graph.edges.filter(edge => edge.source === nodeId);

  return unlockEdges.map(edge => {
    const node = graph.nodes.find(n => n.id === edge.target);
    return { node: node!, edge };
  }).filter(item => item.node);
}

/**
 * Get recommended next skills for a student
 * (Unlocked skills that student hasn't mastered yet)
 */
export function getRecommendedNextSkills(
  graph: PrerequisiteGraph,
  studentProficiencies: StudentProficiency[],
  masteryThreshold: number = 0.8
): GraphNode[] {
  const unlockedNodes = getUnlockedNodes(graph, studentProficiencies);

  // Filter to nodes student hasn't mastered
  return unlockedNodes.filter(node => {
    const proficiency = studentProficiencies.find(p =>
      (p.skill_id === node.id || p.subskill_id === node.id)
    );

    // Include if no proficiency data or below mastery threshold
    return !proficiency || proficiency.proficiency < masteryThreshold;
  });
}

/**
 * Build adjacency list for graph traversal
 */
export function buildAdjacencyList(graph: PrerequisiteGraph): Map<string, string[]> {
  const adjacencyList = new Map<string, string[]>();

  // Initialize all nodes
  graph.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  // Add edges
  graph.edges.forEach(edge => {
    const neighbors = adjacencyList.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacencyList.set(edge.source, neighbors);
  });

  return adjacencyList;
}

/**
 * Get all skills in a learning path (all prerequisites recursively)
 */
export function getLearningPath(
  targetNodeId: string,
  graph: PrerequisiteGraph
): GraphNode[] {
  const visited = new Set<string>();
  const path: GraphNode[] = [];

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Get prerequisites
    const prerequisites = getPrerequisites(nodeId, graph);

    // Visit prerequisites first (depth-first)
    prerequisites.forEach(({ node }) => {
      dfs(node.id);
    });

    // Add current node to path
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      path.push(node);
    }
  }

  dfs(targetNodeId);
  return path;
}

/**
 * Group nodes by unit for organized display
 */
export function groupNodesByUnit(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const grouped = new Map<string, GraphNode[]>();

  nodes.forEach(node => {
    const key = node.unit_id;
    const group = grouped.get(key) || [];
    group.push(node);
    grouped.set(key, group);
  });

  // Sort within each group
  grouped.forEach((group, key) => {
    group.sort((a, b) => {
      // Sort by skill_order first, then subskill_order
      const skillOrderDiff = (a.skill_order || 0) - (b.skill_order || 0);
      if (skillOrderDiff !== 0) return skillOrderDiff;
      return (a.subskill_order || 0) - (b.subskill_order || 0);
    });
  });

  return grouped;
}
```

---

## Use Cases & Examples

### Use Case 1: Adaptive Learning Dashboard

Show students their available learning options based on mastered prerequisites.

```typescript
'use client';

import { useCurriculumGraph } from '@/lib/useCurriculumGraph';
import { getRecommendedNextSkills, getUnlockedNodes } from '@/lib/graphHelpers';
import { useStudentProficiencies } from '@/lib/useStudentProficiencies';

export function AdaptiveLearningDashboard({ studentId, subjectId }) {
  const { graph, loading: graphLoading } = useCurriculumGraph({ subjectId });
  const { proficiencies, loading: profLoading } = useStudentProficiencies(studentId, subjectId);

  if (graphLoading || profLoading) {
    return <div>Loading your personalized learning path...</div>;
  }

  if (!graph) {
    return <div>Unable to load curriculum</div>;
  }

  const recommendedSkills = getRecommendedNextSkills(graph, proficiencies);
  const unlockedSkills = getUnlockedNodes(graph, proficiencies);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Recommended for You</h2>
        <p className="text-muted-foreground">
          Based on your progress, we recommend these skills:
        </p>
        <div className="grid gap-4 mt-4">
          {recommendedSkills.slice(0, 3).map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              unlocked={true}
              studentId={studentId}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">All Available Skills</h2>
        <p className="text-muted-foreground">
          You have {unlockedSkills.length} skills available to practice
        </p>
        <div className="grid gap-4 mt-4">
          {unlockedSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              unlocked={true}
              studentId={studentId}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

### Use Case 2: Skill Tree Visualization

Display an interactive skill tree showing locked and unlocked content.

```typescript
'use client';

import { useCurriculumGraph } from '@/lib/useCurriculumGraph';
import { isNodeUnlocked, getPrerequisites } from '@/lib/graphHelpers';
import { useStudentProficiencies } from '@/lib/useStudentProficiencies';
import { Lock, CheckCircle, Circle } from 'lucide-react';

export function SkillTreeVisualization({ studentId, subjectId }) {
  const { graph, loading: graphLoading } = useCurriculumGraph({ subjectId });
  const { proficiencies, loading: profLoading } = useStudentProficiencies(studentId, subjectId);

  if (graphLoading || profLoading || !graph) {
    return <div>Loading skill tree...</div>;
  }

  const groupedNodes = groupNodesByUnit(graph.nodes);

  return (
    <div className="space-y-8">
      {Array.from(groupedNodes.entries()).map(([unitId, nodes]) => {
        const unit = nodes[0];  // Get unit info from first node

        return (
          <div key={unitId} className="border rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">
              {unit.unit_title}
            </h3>

            <div className="space-y-2">
              {nodes.map(node => {
                const unlocked = isNodeUnlocked(node.id, graph, proficiencies);
                const proficiency = proficiencies.find(p =>
                  p.skill_id === node.id || p.subskill_id === node.id
                );
                const mastered = proficiency && proficiency.proficiency >= 0.8;
                const prerequisites = getPrerequisites(node.id, graph);

                return (
                  <div
                    key={node.id}
                    className={`
                      flex items-center gap-3 p-4 rounded-lg border
                      ${unlocked ? 'bg-white hover:bg-gray-50' : 'bg-gray-100'}
                      ${mastered ? 'border-green-500' : ''}
                    `}
                  >
                    <div className="flex-shrink-0">
                      {mastered ? (
                        <CheckCircle className="text-green-500" />
                      ) : unlocked ? (
                        <Circle className="text-blue-500" />
                      ) : (
                        <Lock className="text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="font-medium">{node.label}</div>

                      {!unlocked && prerequisites.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Requires: {prerequisites.map(p => p.node.label).join(', ')}
                        </div>
                      )}

                      {proficiency && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Progress: {Math.round(proficiency.proficiency * 100)}%
                        </div>
                      )}
                    </div>

                    {unlocked && (
                      <button
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        onClick={() => startPractice(node.id)}
                      >
                        {mastered ? 'Review' : 'Practice'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

### Use Case 3: Content Router with Prerequisite Checking

Prevent students from accessing locked content.

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurriculumGraph } from '@/lib/useCurriculumGraph';
import { isNodeUnlocked } from '@/lib/graphHelpers';
import { useStudentProficiencies } from '@/lib/useStudentProficiencies';

export function ProtectedSkillPage({ studentId, subjectId, skillId }) {
  const router = useRouter();
  const { graph, loading: graphLoading } = useCurriculumGraph({ subjectId });
  const { proficiencies, loading: profLoading } = useStudentProficiencies(studentId, subjectId);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (graphLoading || profLoading || !graph) return;

    const unlocked = isNodeUnlocked(skillId, graph, proficiencies);

    if (!unlocked) {
      // Redirect to learning dashboard with message
      router.push(`/dashboard?message=skill_locked&skill=${skillId}`);
    } else {
      setCheckingAccess(false);
    }
  }, [graph, proficiencies, graphLoading, profLoading, skillId, router]);

  if (checkingAccess) {
    return <div>Checking access...</div>;
  }

  return (
    <div>
      {/* Render skill practice content */}
      <SkillPracticeContent skillId={skillId} studentId={studentId} />
    </div>
  );
}
```

---

### Use Case 4: Learning Path Preview

Show students what skills they'll unlock as they progress.

```typescript
'use client';

import { getLearningPath, getUnlocks } from '@/lib/graphHelpers';
import { useCurriculumGraph } from '@/lib/useCurriculumGraph';

export function LearningPathPreview({ subjectId, targetSkillId }) {
  const { graph, loading } = useCurriculumGraph({ subjectId });

  if (loading || !graph) return <div>Loading...</div>;

  const path = getLearningPath(targetSkillId, graph);
  const targetNode = graph.nodes.find(n => n.id === targetSkillId);
  const unlocks = getUnlocks(targetSkillId, graph);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Learning Path to: {targetNode?.label}</h2>
        <p className="text-muted-foreground">
          Master these {path.length} skills in order:
        </p>

        <div className="mt-4 space-y-2">
          {path.map((node, index) => (
            <div key={node.id} className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                {index + 1}
              </div>
              <div>
                <div className="font-medium">{node.label}</div>
                <div className="text-sm text-muted-foreground">{node.unit_title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {unlocks.length > 0 && (
        <section>
          <h3 className="text-xl font-bold">What You'll Unlock</h3>
          <p className="text-muted-foreground">
            Mastering this skill will unlock:
          </p>
          <div className="mt-4 grid gap-2">
            {unlocks.map(({ node }) => (
              <div key={node.id} className="p-3 border rounded-lg bg-green-50">
                ✨ {node.label}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

---

## Performance Optimization

### Caching Strategy

1. **Graph Caching**: Graphs are cached in Firestore and only regenerated when curriculum changes
2. **Client-side Caching**: Use React Query or SWR for additional caching:

```typescript
import useSWR from 'swr';
import { curriculumGraphApi } from './curriculumGraphApi';

export function useCurriculumGraphSWR(subjectId: string) {
  const { data, error, isLoading } = useSWR(
    subjectId ? `graph-${subjectId}` : null,
    () => curriculumGraphApi.getGraph(subjectId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    graph: data,
    loading: isLoading,
    error
  };
}
```

### Lazy Loading

For large curricula, load graph data on-demand:

```typescript
export function LazySkillTree({ subjectId }) {
  const [loadGraph, setLoadGraph] = useState(false);
  const { graph } = useCurriculumGraph({
    subjectId,
    enabled: loadGraph
  });

  return (
    <div>
      <button onClick={() => setLoadGraph(true)}>
        View Skill Tree
      </button>
      {graph && <SkillTreeVisualization graph={graph} />}
    </div>
  );
}
```

### Memoization

Memoize expensive graph calculations:

```typescript
import { useMemo } from 'react';

export function OptimizedLearningDashboard({ subjectId, studentId }) {
  const { graph } = useCurriculumGraph({ subjectId });
  const { proficiencies } = useStudentProficiencies(studentId, subjectId);

  const recommendedSkills = useMemo(() => {
    if (!graph || !proficiencies) return [];
    return getRecommendedNextSkills(graph, proficiencies);
  }, [graph, proficiencies]);

  const unlockedNodes = useMemo(() => {
    if (!graph || !proficiencies) return [];
    return getUnlockedNodes(graph, proficiencies);
  }, [graph, proficiencies]);

  // ... render UI
}
```

---

## Troubleshooting

### Issue: Graph Returns 0 Edges

**Symptoms**: Graph has nodes but no edges (prerequisites).

**Causes**:
1. Version mismatch between `curriculum_subjects` and `curriculum_versions`
2. Prerequisites have different `version_id` than published curriculum

**Solution**:
```sql
-- Check version consistency
SELECT
  s.subject_id,
  s.version_id as subject_version,
  v.version_id as active_version,
  v.is_active
FROM curriculum_subjects s
JOIN curriculum_versions v
  ON s.subject_id = v.subject_id
  AND v.is_active = true
WHERE s.subject_id = 'MATHEMATICS';

-- If mismatched, update subjects table
UPDATE curriculum_subjects
SET version_id = (
  SELECT version_id
  FROM curriculum_versions
  WHERE subject_id = 'MATHEMATICS' AND is_active = true
)
WHERE subject_id = 'MATHEMATICS';

-- Then regenerate graph
curl -X POST "http://localhost:8001/api/graph/MATHEMATICS/regenerate-all"
```

---

### Issue: Slow Graph Loading

**Symptoms**: Graph takes >2 seconds to load.

**Causes**:
1. Cache not populated
2. Force refresh being used unnecessarily
3. Large curriculum (>500 nodes)

**Solutions**:
1. Pre-generate cache: `POST /api/graph/{subject_id}/regenerate-all`
2. Remove `force_refresh=true` parameter
3. Implement pagination or lazy loading for large graphs

---

### Issue: Student Can't Access Unlocked Content

**Symptoms**: `isNodeUnlocked()` returns false despite prerequisites being met.

**Debug Steps**:
```typescript
// Log proficiency data
console.log('Student proficiencies:', proficiencies);

// Log prerequisites for the node
const prereqs = getPrerequisites(nodeId, graph);
console.log('Prerequisites:', prereqs);

// Check each prerequisite
prereqs.forEach(({ node, edge }) => {
  const prof = proficiencies.find(p =>
    p.skill_id === node.id || p.subskill_id === node.id
  );
  console.log(`${node.label}: ${prof?.proficiency || 0} vs threshold ${edge.threshold}`);
});
```

**Common Causes**:
1. Proficiency data not synced from BigQuery
2. Threshold too high (consider lowering from 0.8 to 0.7)
3. Student proficiency recorded with wrong ID format

---

## Summary

You now have a complete prerequisite graph system that enables:

✅ **Adaptive learning paths** - Students see personalized recommendations
✅ **Content gating** - Lock skills until prerequisites are met
✅ **Progress visualization** - Show skill trees and learning progression
✅ **Performance-optimized** - Cached graphs load in ~50ms
✅ **Version-aware** - Draft and published graphs for safe curriculum editing

### Next Steps

1. **Implement basic graph fetching** in your learning app
2. **Add prerequisite checking** to lock content
3. **Build a skill tree UI** for visualization
4. **Add recommended skills section** to dashboard
5. **Monitor performance** and optimize as needed

### Additional Resources

- [Curriculum Authoring Service README](../curriculum-authoring-service/README.md)
- [Graph Cache Panel Component](../curriculum-designer-app/components/curriculum-designer/graph/GraphCachePanel.tsx)
- [BigQuery Analytics Integration](../backend/scripts/CURRICULUM_INTEGRATION_GUIDE.md)

---

**Questions?** Check the troubleshooting section or review the code examples above.
