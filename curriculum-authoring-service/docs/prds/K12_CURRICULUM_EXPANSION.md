# K-12 Curriculum Expansion -- Master PRD

**Document ID:** PRD-CURRICULUM-K12-MASTER
**Status:** Draft
**Created:** 2026-03-28
**Last Updated:** 2026-03-28
**Owner:** Curriculum Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State](#2-current-state)
3. [Subjects by Grade Band](#3-subjects-by-grade-band)
4. [Scope Per Grade](#4-scope-per-grade)
5. [Lumina-First Design Principle](#5-lumina-first-design-principle)
6. [Authoring Workflow](#6-authoring-workflow-per-grade)
7. [ID Convention](#7-id-convention)
8. [Difficulty Calibration](#8-difficulty-calibration)
9. [Rollout Strategy](#9-rollout-strategy)
10. [Quality Gates](#10-quality-gates-per-grade)
11. [Risks and Mitigations](#11-risks-and-mitigations)
12. [Success Metrics](#12-success-metrics)

---

## 1. Executive Summary

This PRD defines the strategy and execution plan for building a complete K-12 curriculum across all core subjects on the Lumina AI tutoring platform. The curriculum powers the Pulse adaptive learning engine, which uses a typed knowledge graph with five edge relationships to drive personalized instruction.

**Goal:** Author production-ready curriculum for all 13 grades (K through 12), covering every core academic subject appropriate to each grade band.

**Approach:**

- Leverage the existing Gemini-powered AI agent scaffolding to accelerate curriculum authoring at scale.
- Execute a two-phase workflow per grade: (1) author the curriculum hierarchy (subjects, units, skills, subskills), then (2) build the knowledge graph edges that connect them.
- A third integration phase connects each grade to its neighbors via cross-grade prerequisite chains.
- Roll out in four waves ordered by business value and dependency chain, starting with the early elementary grades where the platform already has traction.

**Estimated total scope:** 7,000--10,000 subskills across K-12, authored and graph-connected, with adaptive learning validated end-to-end.

Individual grade PRDs will reference this document as their parent and inherit its conventions, quality gates, and workflow definitions.

---

## 2. Current State

| Grade | Subskills | Subjects | Hierarchy | Knowledge Graph | Status |
|-------|-----------|----------|-----------|-----------------|--------|
| Kindergarten | 805 | 6 (Math, Language Arts, Science, Social Studies, Arts, ABC123) | Complete | Partially built; decision trees authored | In production |
| Grade 1 | ~496 | 4 (Math, Language Arts, Science, Social Studies) | CSV authored | Not started | Needs graph build and possible hierarchy refinement |
| Grades 2--12 | -- | -- | Not started | Not started | Not started |

**Existing tooling available:**

- AI agent endpoint (`POST /api/ai/generate-unit`) for scaffolding skills and subskills from unit topics
- `/curriculum-graph diagnose` for graph health assessment
- `/curriculum-graph suggest` for Gemini-powered edge suggestions with approval workflow
- CSV export pipeline matching established schema conventions
- Authoring service for publishing to Firestore

---

## 3. Subjects by Grade Band

### K--2 (Primary)

| Subject | Notes |
|---------|-------|
| Mathematics | Number sense, basic operations, measurement, geometry, patterns |
| Language Arts | Phonics, phonemic awareness, early reading, handwriting, vocabulary |
| Science | Observation-based; animals, plants, weather, materials |
| Social Studies | Community, family, maps, holidays, rules |
| Arts | Visual arts, music fundamentals, creative expression |
| ABC123 | Kindergarten only -- letter/number recognition and formation |

### 3--5 (Upper Elementary)

| Subject | Notes |
|---------|-------|
| Mathematics | Multi-digit operations, fractions, decimals, measurement, data |
| English Language Arts (ELA) | Reading comprehension, writing process, grammar, speaking/listening |
| Science | Earth science, life science, physical science (NGSS-aligned) |
| Social Studies | State/US history, geography, government basics, economics intro |
| Arts (optional) | Expanded visual arts, music theory, drama |

Note: "Language Arts" transitions to "ELA" branding starting at Grade 3.

### 6--8 (Middle School)

| Subject | Notes |
|---------|-------|
| Mathematics | Pre-Algebra (6), Algebra foundations (7--8), ratios, proportions, statistics |
| ELA | Literature analysis, argumentative writing, research skills, media literacy |
| Science | Earth Science (6), Life Science (7), Physical Science (8) -- or integrated |
| Social Studies | World History (6), Civics/Geography (7), US History (8) |
| Electives | Technology, world languages, advanced arts (scope TBD per grade PRD) |

### 9--12 (High School)

| Subject / Course | Typical Grade | Notes |
|------------------|---------------|-------|
| Algebra I | 9 | Linear equations, inequalities, systems, polynomials |
| Geometry | 10 | Proofs, congruence, similarity, circles, coordinate geometry |
| Algebra II | 11 | Quadratics, exponentials, logarithms, sequences |
| Pre-Calculus / Calculus | 12 | Trigonometry, limits, derivatives, integrals |
| ELA: Literature | 9--10 | Fiction/nonfiction analysis, literary criticism |
| ELA: Composition | 10--11 | Essay writing, research papers, rhetoric |
| ELA: Rhetoric / AP Prep | 11--12 | Argumentation, synthesis, advanced analysis |
| Biology | 9--10 | Cell biology, genetics, ecology, evolution |
| Chemistry | 10--11 | Atomic structure, reactions, stoichiometry, thermodynamics |
| Physics | 11--12 | Mechanics, waves, electricity, magnetism |
| US History | 9--11 | Founding through modern era |
| World History | 9--10 | Ancient civilizations through globalization |
| Government | 11--12 | Constitution, branches, civil rights, political systems |
| Economics | 11--12 | Micro/macro fundamentals, markets, fiscal/monetary policy |
| Electives | 9--12 | AP courses, world languages, fine arts (scope TBD) |

---

## 4. Scope Per Grade

| Grade Band | Subskills per Subject | Subjects per Grade | Total per Grade |
|------------|----------------------|-------------------|-----------------|
| K--2 | 100--200 | 4--6 | 500--800 |
| 3--5 | 120--180 | 4--5 | 500--800 |
| 6--8 | 100--160 | 4--5 core | 500--700 |
| 9--12 | 80--150 per course | 4--6 courses | 400--700 |

**Total estimated across K-12:** 7,000--10,000 subskills.

The cap of approximately 800 subskills per grade serves as a hard ceiling to prevent scope creep. Grades that naturally require fewer subskills (especially in high school where content is more specialized) should not be padded to meet minimums.

---

## 5. Lumina-First Design Principle

**Every subskill must have a clear path to interactive practice in Lumina.**

This is the single most important constraint on curriculum authoring. A subskill that cannot be rendered, practiced, and evaluated through a Lumina primitive or the AI tutoring scaffold is not a valid subskill — it must be rewritten or removed.

### The Problem: Standards-First vs Lumina-First

Traditional curriculum authoring starts from standards documents (Common Core, NGSS, C3) and breaks them into observable classroom behaviors: "participate in collaborative conversations," "use props and costumes in dramatic play," "track print with a finger during independent reading." These are valid pedagogical goals but they describe **teacher-mediated classroom activities**, not interactive digital experiences.

Lumina is not a classroom. It is an adaptive AI tutoring platform with:
- **168+ interactive primitives** spanning math, literacy, science, and engineering
- **AI tutoring scaffold** (Gemini Live) for real-time conversational coaching
- **Problem-type primitives** (multiple-choice, fill-in-blanks, matching, sequencing, categorization, short-answer) for assessment
- **Eval modes** with IRT-calibrated difficulty tiers

Every subskill must target one of these three delivery channels:

| Channel | What It Is | Example |
|---------|-----------|---------|
| **Primitive** | An interactive Lumina component that teaches/practices the skill | `phonics-blender` for decoding consonant blends |
| **Problem type** | A structured assessment primitive | `matching-activity` for synonym/antonym pairs |
| **AI tutor session** | A Gemini Live conversation with scaffolded prompts | Oral reading fluency practice with real-time feedback |

### Renderability Test

Before adding any subskill to the curriculum, apply this test:

> **"Can a 6-year-old (or age-appropriate student) practice this skill by interacting with a screen and/or talking to the AI tutor?"**

- If **yes** → valid subskill. Note the target primitive/channel in the description.
- If **no** → rewrite the subskill to target what IS digitally practicable, or remove it.

### What Gets Cut

These categories of subskills are **not valid** for Lumina and must be removed or restructured:

| Category | Example | Why It Fails |
|----------|---------|-------------|
| Physical performance | "Track print with a finger" | Requires physical book |
| Peer collaboration | "Participate in collaborative conversations" | Requires other students |
| Teacher-mediated | "With guidance and support from adults" | Requires a teacher |
| Physical materials | "Use props, costumes, and scenery" | Requires physical objects |
| Vague process outcomes | "Plan, draft, revise, and edit writing" | Too broad; break into discrete primitive-backed steps |
| Classroom behaviors | "Follow agreed-upon rules for discussions" | Social norm, not a skill |

### What Gets Rewritten

Many standards-based skills have a valid digital core buried inside classroom language:

| Standards Language | Lumina-First Rewrite | Target Primitive |
|-------------------|---------------------|-----------------|
| "Identify the role of the author and illustrator" | "Match labels (author, illustrator, title, publisher) to parts of a book cover" | `matching-activity` |
| "Retell stories including key details" | "Sequence story events in chronological order" | `sequencing-activity` or `story-map` |
| "Produce complete sentences appropriate to task" | "Build grammatically correct sentences by arranging word tiles" | `sentence-builder` |
| "Use context clues to determine word meaning" | "Read a sentence with a missing word and select the best-fit vocabulary word" | `context-clues-detective` |
| "Give simple oral presentations" | "Describe a picture to the AI tutor using complete sentences" | AI tutor session |

### Existing Primitive Inventory (by subject area)

Authors must consult the current primitive inventory before writing subskills. Key literacy primitives available today:

**Phonics & Decoding:** `phonics-blender`, `decodable-reader`, `cvc-speller`, `letter-spotter`, `letter-sound-link`
**Phonological Awareness:** `rhyme-studio`, `syllable-clapper`, `phoneme-explorer`, `sound-swap`
**Word Study & Vocabulary:** `word-builder`, `spelling-pattern-explorer`, `vocabulary-explorer`, `context-clues-detective`, `word-workout`
**Writing & Grammar:** `sentence-builder`, `sentence-analyzer`, `paragraph-architect`, `revision-workshop`, `opinion-builder`
**Comprehension:** `story-map`, `story-planner`, `character-web`, `evidence-finder`, `text-structure-analyzer`
**Fluency:** `read-aloud-studio`, `listen-and-respond`, `decodable-reader`
**Advanced Literacy:** `figurative-language-finder`, `genre-explorer`, `poetry-lab`
**General Problem Types:** `multiple-choice`, `true-false`, `fill-in-blanks`, `matching-activity`, `sequencing-activity`, `categorization-activity`, `short-answer`

**Math, Science, and Engineering** primitives are similarly extensive (42 math, 17 biology, 13 chemistry, 19 engineering, 8 astronomy). See the primitive catalog for the full list.

If no existing primitive covers a needed skill, the subskill description should note `[NEW PRIMITIVE NEEDED: brief description]` so it enters the primitive development backlog.

### AI Tutor as a Channel

The Gemini Live AI tutor scaffold is a first-class delivery channel, not a fallback. Skills that are inherently conversational or oral — reading fluency, storytelling, oral vocabulary use, listening comprehension — should target the AI tutor directly. The subskill description should specify:
- What the AI tutor prompts the student to do
- What constitutes success (e.g., "student reads passage aloud with <5% error rate")
- The scaffolding level (guided → independent)

---

## 6. Authoring Workflow (Per Grade)

Each grade follows a three-phase workflow. Phases 1 and 2 are self-contained per grade; Phase 3 requires the adjacent grade(s) to also be authored.

### Phase 1 -- Curriculum Hierarchy

1. **Define subjects and unit structure.** Align with established standards:
   - Mathematics: Common Core State Standards (CCSS-M)
   - ELA: Common Core State Standards (CCSS-ELA)
   - Science: Next Generation Science Standards (NGSS)
   - Social Studies: C3 Framework (College, Career, and Civic Life)
2. **AI-assisted scaffolding.** Use `POST /api/ai/generate-unit` to generate skills and subskills from unit topics. The AI agent proposes granular breakdowns; authors review and adjust.
3. **Lumina-first renderability pass.** Apply the renderability test from §5 to every subskill. Tag each with its target delivery channel (primitive name, problem type, or AI tutor session). Remove or rewrite any subskill that fails the test. Flag `[NEW PRIMITIVE NEEDED]` where gaps exist.
4. **Review and refine.** Verify pedagogical soundness, adjust difficulty ranges, ensure appropriate granularity (not too coarse, not too fine).
5. **Export to CSV.** Output must match the existing CSV schema convention used by Kindergarten and Grade 1.
6. **Publish via authoring service.** Push the finalized hierarchy to Firestore through the curriculum authoring service.

### Phase 2 -- Knowledge Graph

1. **Baseline assessment.** Run `/curriculum-graph diagnose` to see the starting state. All nodes will be orphans initially.
2. **AI-suggested edges.** Run `/curriculum-graph suggest` to get Gemini-powered edge recommendations across the five typed relationships.
3. **Review and approve.** Use the approval workflow to accept, reject, or modify each suggested edge. Prioritize prerequisite (`REQUIRES`) and reinforcement (`REINFORCES`) edges.
4. **Manual critical paths.** Hand-author prerequisite chains for foundational skill progressions that the AI may not correctly infer (e.g., counting to 20 before addition to 20).
5. **Cross-unit connections.** Ensure cross-unit edge ratio exceeds 20% to prevent the flat/narrow graph problem that degrades Pulse session diversity.
6. **Validate.** Run `/curriculum-graph diagnose` again. Target a health score of 7.0 or higher before proceeding.

### Phase 3 -- Cross-Grade Integration

1. **Define cross-grade prerequisite chains.** Map terminal skills of grade N to entry skills of grade N+1. These are `REQUIRES` edges that span grade boundaries.
2. **Validate connectivity.** Confirm no orphan grades exist -- every grade must be reachable from the prior grade through at least one prerequisite chain per subject.
3. **Pulse simulation.** Run the Pulse simulator across grade transitions to verify that the adaptive engine produces coherent sessions spanning the boundary.

---

## 7. ID Convention

The existing ID convention is preserved across all grades:

```
{UnitID}-{SkillNumber}-{SubskillLetter}
```

**Grade is NOT encoded in the ID.** Grade is stored as metadata on the subject/unit. This means the same UnitID prefixes are reusable across grades without collision.

### Unit ID Prefixes by Subject

| Subject | Prefixes | Description |
|---------|----------|-------------|
| Mathematics | `OPS` | Operations |
| | `NBT` | Number and base ten |
| | `NF` | Number and fractions |
| | `MD` | Measurement and data |
| | `GEOM` | Geometry |
| | `RP` | Ratios and proportional relationships |
| | `EE` | Expressions and equations |
| | `SP` | Statistics and probability |
| | `FUNC` | Functions |
| | `ALG` | Algebra |
| | `CALC` | Calculus |
| | `TRIG` | Trigonometry |
| ELA | `LA` | Language Arts (general) |
| | `RL` | Reading -- Literature |
| | `RI` | Reading -- Informational text |
| | `W` | Writing |
| | `SL` | Speaking and listening |
| | `L` | Language (grammar, vocabulary) |
| Science | `SCI` | Science (general) |
| | `PS` | Physical science |
| | `LS` | Life science |
| | `ESS` | Earth and space science |
| | `ETS` | Engineering, technology, and applications of science |
| Social Studies | `SS` | Social studies (general) |
| | `CIV` | Civics and government |
| | `ECON` | Economics |
| | `GEO` | Geography |
| | `HIST` | History |
| Arts | `ART` | Arts (general) |
| | `VA` | Visual arts |
| | `MUS` | Music |
| | `DRA` | Drama |

**Example IDs:**
- `OPS-3-a` -- Operations, skill 3, subskill a
- `RL-2-c` -- Reading Literature, skill 2, subskill c
- `ESS-1-b` -- Earth and Space Science, skill 1, subskill b

---

## 8. Difficulty Calibration

Difficulty values are **within-grade relative**, not absolute across the K-12 span. A difficulty of 5 in Kindergarten represents a mid-difficulty Kindergarten task, not the same absolute challenge as a difficulty 5 in Grade 8.

| Grade Band | difficulty_start | difficulty_end | Target Range |
|------------|-----------------|----------------|--------------|
| K--2 | 1--3 | 3--7 | 2--5 |
| 3--5 | 2--4 | 4--8 | 3--6 |
| 6--8 | 3--5 | 5--9 | 4--7 |
| 9--12 | 4--6 | 6--10 | 5--8 |

Each subskill defines a `difficulty_start` (entry point) and `difficulty_end` (mastery-level challenge). The Pulse engine uses IRT-calibrated item parameters to select problems within this range based on the student's estimated ability.

---

## 9. Rollout Strategy

Grades are rolled out in four waves, ordered by business value, dependency chain, and authoring complexity.

| Wave | Grades | Rationale | Target Timeline |
|------|--------|-----------|-----------------|
| Wave 1 | 1, 2 | Complete Grade 1 graph; author Grade 2. Strongest near-term value. | Immediate |
| Wave 2 | 3, 4, 5 | Upper elementary. High market demand. Standards well-defined. | After Wave 1 |
| Wave 3 | 6, 7, 8 | Middle school. Subject specialization begins. More complex graph. | After Wave 2 |
| Wave 4 | 9, 10, 11, 12 | High school. Course-based structure. Most complex authoring. | After Wave 3 |

**Wave 1 details:**
- Grade 1: CSV hierarchy exists (~496 subskills). Primary work is Phase 2 (graph build) and Phase 3 (cross-grade edges to K).
- Grade 2: Full authoring from scratch. First grade to be authored entirely with the AI agent pipeline.

**Parallelization:** Within each wave, grades can be authored in parallel once the workflow is validated. Wave 2 grades (3--5) can begin simultaneously if staffing allows.

---

## 10. Quality Gates (Per Grade)

A grade is not considered production-ready until all of the following gates are passed:

| Gate | Criteria |
|------|----------|
| Hierarchy completeness | All subjects have complete hierarchy with no empty units or skills |
| **Lumina renderability** | **Every subskill targets a named primitive, problem type, or AI tutor session. Zero un-renderable subskills.** |
| Difficulty validity | All subskills have valid difficulty ranges within the grade band's calibration |
| Graph health | Score >= 7.0 on `/curriculum-graph diagnose` |
| No orphan nodes | Every subskill has at least one graph edge (no isolated nodes) |
| Cross-grade chains | Prerequisite chains defined to the prior grade (except K) |
| Pulse simulation | Pulse simulator runs successfully with no dead-end sessions |
| CSV export | Export matches the established schema convention |
| Publication | Published via authoring service to Firestore |

**Sign-off process:** Each grade PRD will include a quality gate checklist. The checklist must be completed and reviewed before the grade is marked as shipped.

---

## 11. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep -- too many subskills per grade | Delays authoring; overwhelming for Pulse engine | Medium | Hard cap at ~800 subskills per grade. Resist pressure to over-granularize. |
| Knowledge graph becomes flat or narrow | Poor Pulse session diversity; repetitive practice | High | Use `/curriculum-graph diagnose` throughout authoring. Target cross-unit edge ratio > 20%. |
| AI-generated content lacks pedagogical rigor | Incorrect skill progressions; inappropriate difficulty | Medium | Human review of all AI-generated suggestions. No auto-accept. |
| Cross-grade transitions break Pulse sessions | Students stuck at grade boundaries; dead-end sessions | Medium | Integration testing across grade boundaries with Pulse simulator before publication. |
| ID collisions across grades | Data corruption; incorrect skill references | Low | Grade is metadata, not encoded in ID. Same UnitID prefixes are explicitly allowed across grades. Validate uniqueness within grade at publish time. |
| Standards alignment drift | Curriculum does not match Common Core / NGSS / C3 | Medium | Use standards documents as primary source during Phase 1. Cross-reference during review. |
| **Standards-first anti-pattern** | Subskills describe classroom activities (dramatic play, peer discussion, physical book navigation) that cannot be rendered in Lumina | **High** | Apply Lumina-first renderability test (§5) to every subskill. Grade 1 LA is the cautionary example — 150 subskills authored, many un-renderable. |
| Authoring bottleneck at high school | Course-based structure is significantly more complex | High | Defer to Wave 4. Use lessons from Waves 1--3 to refine the AI agent pipeline first. |

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to author one grade | < 2 weeks with AI agent assistance | Clock time from Phase 1 start to Phase 3 completion |
| Graph health score | >= 7.0 for all published grades | `/curriculum-graph diagnose` output |
| Subskill coverage | Aligned with grade-level standards (CCSS, NGSS, C3) | Standards crosswalk audit per grade |
| Pulse session diversity | >= 4 unique subskills per 10-item session | Pulse simulator output across 100 simulated sessions |
| Cross-grade flow | No dead-end grades | Pulse simulation spanning consecutive grades |
| Orphan node rate | 0% at publication | `/curriculum-graph diagnose` orphan count |
| Cross-unit edge ratio | > 20% of all edges | `/curriculum-graph diagnose` edge analysis |

---

## Appendix: Related Documents

| Document | Location | Description |
|----------|----------|-------------|
| Grade-specific PRDs | `docs/prds/GRADE_{N}_PRD.md` | Individual grade authoring plans (reference this document) |
| Adding Primitives | `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md` | Primitive authoring checklist |
| Planning Architecture | `backend/docs/PLANNING_ARCHITECTURE.md` | Pulse engine and mastery lifecycle |
| Curriculum Graph Skill | `.claude/skills/curriculum-graph/` | Graph diagnostic and suggestion tooling |

---

*Individual grade PRDs should reference this document as:*
`Parent PRD: docs/prds/K12_CURRICULUM_EXPANSION.md (PRD-CURRICULUM-K12-MASTER)`
