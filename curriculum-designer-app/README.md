# Curriculum Designer

Visual editor for the educational knowledge graph. Connects to the [curriculum-authoring-service](../curriculum-authoring-service/) backend.

## Purpose

A local-only admin tool for curriculum designers to build and manage the knowledge graph that defines what students need to master. Not part of the student-facing application.

## Features

- **Grade-scoped curriculum** — grade is a first-class dimension; subjects are organized by canonical grade codes (PK, K, 1-12)
- **Curriculum tree** — navigate and edit Grade / Subject / Unit / Skill / Subskill hierarchy
- **Entity editor** — forms for creating and editing all curriculum entities with grade dropdown
- **Prerequisite management** — define learning paths and dependencies
- **Graph visualization** — visualize the prerequisite graph
- **AI generation** — create complete units with AI assistance
- **Lumina primitive assignment** — link subskills to teaching primitives
- **Draft/publish workflow** — review changes before publishing
- **Version control** — full version history with rollback

## Grade System

Grade is a structural dimension of the curriculum. Subjects are scoped by grade, allowing multiple grades of the same subject to coexist (e.g., Kindergarten Mathematics and 1st Grade Mathematics).

**Canonical grade codes**: `PK`, `K`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`

**Firestore structure**: `curriculum_published/{grade}/subjects/{subject_id}`

This enables O(1) grade-scoped lookups — querying "what subjects exist for Kindergarten?" reads only `curriculum_published/K/subjects/` without scanning other grades.

## Quick Start

```bash
# 1. Start the backend
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001

# 2. Start the frontend
cd curriculum-designer-app
npm install
npm run dev    # http://localhost:3001
```

### Environment

```env
NEXT_PUBLIC_AUTHORING_API_URL=http://localhost:8001
NEXT_PUBLIC_REQUIRE_AUTH=false
```

## Architecture

| Tech | Purpose |
|------|---------|
| Next.js 14 | App Router framework |
| React Query | Server state management |
| React Hook Form | Form state |
| Radix UI + Tailwind | UI components |

## Directory Structure

```
app/
├── layout.tsx                    # Root layout with React Query
└── page.tsx                      # Main curriculum designer page

components/curriculum-designer/
├── tree/                         # Tree view (CurriculumTreeView, UnitNode, SkillNode, SubskillNode)
├── editor/                       # Entity forms (SubjectForm, UnitForm, SkillForm, SubskillForm)
├── prerequisites/                # Prerequisite panel + add dialog
├── publishing/                   # Draft summary + version history
├── graph/                        # Graph visualization + cache panel
├── ai/                           # AI unit generator
└── primitives/                   # Lumina primitive selector

lib/curriculum-authoring/
├── api.ts                        # API client
├── hooks.ts                      # React Query hooks
├── graphApi.ts                   # Graph cache API
└── constants.ts                  # Canonical grade codes and labels

types/
└── curriculum-authoring.ts       # TypeScript types
```

## Usage

1. **Select a subject** from the grade-grouped dropdown (or create one)
2. **Navigate the tree** — click to select, chevrons to expand
3. **Edit entities** in the right panel editor tab — grade uses a dropdown with canonical codes
4. **Manage prerequisites** via the Prerequisites tab
5. **AI Generate** — click the toolbar button to scaffold a unit from a topic
6. **Publish** — review draft changes, then publish a new version

## Scripts

```bash
npm run dev       # dev server on port 3001
npm run build     # production build
npm run start     # production server
npm run lint      # ESLint
```
