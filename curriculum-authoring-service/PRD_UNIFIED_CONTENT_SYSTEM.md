# Product Requirements Document: Unified Content Authoring & Evaluation System

**Version:** 1.0
**Date:** January 2025
**Status:** In Development
**Owner:** Content & Engineering Teams

---

## Executive Summary

The Unified Content Authoring & Evaluation System consolidates educational content creation, quality assessment, and publishing workflows into a single platform. This system eliminates the architectural gap between content creation and evaluation, enabling content teams to author, validate, and publish complete educational packages (reading materials + practice problems) in a safe staging environment before deployment to production.

**Primary Goal:** Provide content authors with a self-service platform to create, evaluate, and iteratively improve educational content without requiring engineering intervention, while ensuring all content meets quality standards before reaching students.

---

## Problem Statement

### Current State Pain Points

1. **Fragmented Architecture**
   - `curriculum-authoring-service`: Creates curriculum structure and reading content only
   - `content-pipeline`: Evaluates problems but only connects to production backend
   - `main backend`: Generates problems on-demand for live students
   - **Gap**: No ability to generate and evaluate problems before production deployment

2. **No Staging Environment**
   - Content goes directly from creation to live students
   - No opportunity to assess quality before publication
   - Difficult to iterate on content based on evaluation feedback
   - High risk of poor-quality content reaching production

3. **Incomplete Content Packages**
   - Reading content can be authored and reviewed
   - Problems must be generated in production environment
   - No unified view of complete learning package quality
   - Cannot publish "ready-to-use" curriculum units

4. **Limited Debugging Capability**
   - When generated content fails quality checks, difficult to determine root cause
   - No visibility into prompts used for generation
   - Cannot reproduce exact outputs for investigation
   - Iterative prompt improvement is manual and error-prone

5. **Parallel Problem Workflow Missing**
   - `content-pipeline` evaluates problems excellently (3-tier validation)
   - Reading content lacks equivalent evaluation framework
   - No comprehensive quality assessment across all content types

### Impact

- **Content Quality Risk**: Poor content reaches students without vetting
- **Team Productivity**: Content teams blocked waiting for engineering to test/iterate
- **Student Experience**: Inconsistent content quality affects learning outcomes
- **Operational Cost**: Manual QA processes don't scale
- **Audit Trail**: No compliance record of content creation decisions

---

## Solution Overview

### Vision

A unified platform where educators author, generate, evaluate, and publish complete educational content packages in a safe, iterative workflow with comprehensive quality gates.

### Core Principles

1. **Unified Authoring**: All content types (curriculum, reading, problems) managed in one system
2. **Quality-First**: Every piece of content evaluated before publication
3. **Full Replicability**: All AI-generated content traceable to exact prompts used
4. **Self-Service**: Content teams operate independently without engineering
5. **Safe Staging**: Draft/publish workflow prevents production contamination
6. **Continuous Improvement**: Data-driven prompt optimization over time

---

## User Personas

### Primary: Content Author (Educator)
- **Goal**: Create high-quality, engaging learning materials efficiently
- **Needs**:
  - Generate reading content and practice problems for subskills
  - Understand why content passed/failed quality checks
  - Iterate quickly on low-scoring content
  - Publish complete curriculum units confidently
- **Pain Points**:
  - No visibility into content quality before student exposure
  - Manual problem creation is time-consuming
  - Cannot test problem variations easily

### Secondary: Content Manager
- **Goal**: Oversee content quality and team productivity
- **Needs**:
  - Dashboard showing content readiness across curriculum
  - Metrics on content approval rates
  - Identify which prompts/approaches yield best results
- **Pain Points**:
  - No aggregated quality metrics
  - Cannot track team efficiency
  - Difficult to maintain consistent quality standards

### Tertiary: AI/ML Engineer
- **Goal**: Optimize content generation prompts and models
- **Needs**:
  - Access to all generation prompts and evaluation results
  - Performance metrics per prompt template
  - Ability to A/B test prompt variations
- **Pain Points**:
  - Cannot correlate prompts with quality outcomes
  - No systematic prompt versioning
  - Difficult to debug generation failures

---

## Functional Requirements

### FR-1: Problem Generation

**Description**: Generate practice problems for any subskill using AI, with complete metadata tracking.

**User Story**: As a content author, I want to generate 5-10 practice problems for a subskill so that students have varied exercises to master the skill.

**Acceptance Criteria**:
- [x] Support all 8 problem types (multiple choice, true/false, fill-in-blank, matching, sequencing, categorization, scenario, short answer)
- [x] Generate 1-20 problems per request (configurable count)
- [x] Use subskill foundations (master context + primitives) for contextually appropriate problems
- [x] Store complete generation metadata: prompt, model, temperature, timestamp, duration
- [x] Support draft/publish workflow (problems default to draft status)
- [x] Enable manual editing after generation with edit history tracking
- [x] Allow regeneration with same or modified prompts

**API Endpoints**:
- `POST /api/subskills/{subskill_id}/problems/generate`
- `GET /api/subskills/{subskill_id}/problems`
- `PUT /api/problems/{problem_id}`
- `POST /api/problems/{problem_id}/regenerate`
- `DELETE /api/problems/{problem_id}`

**Database**: `curriculum_problems` table

**Dependencies**:
- Foundations service (for master context)
- Curriculum manager (for subskill metadata)
- Gemini API (for generation)

---

### FR-2: Problem Evaluation (3-Tier System)

**Description**: Automatically evaluate generated problems across structural, heuristic, and pedagogical dimensions.

**User Story**: As a content author, I want immediate feedback on problem quality so I can identify and fix issues before publishing.

**Acceptance Criteria**:
- [x] **Tier 1 - Structural Validation**:
  - Schema compliance checking using YAML definitions
  - Validate required fields, data types, enum values
  - Visual intent/data structure validation
  - Pass/fail with specific issue descriptions

- [x] **Tier 2 - Heuristic Validation**:
  - Readability scoring (Flesch-Kincaid grade level alignment)
  - Placeholder detection (TODO, FIXME, [INSERT], etc.)
  - Visual coherence checks (character limits, word length, line breaks)
  - Forbidden content patterns (HTML injection, scripts)
  - Pass/fail with warnings vs. fatal failures

- [x] **Tier 3 - LLM Judge (Pedagogical Assessment)**:
  - **Pedagogical Approach Score (1-10, 40% weight)**: Is the problem format appropriate for this skill?
  - **Alignment Score (1-10, 20% weight)**: Does content match the subskill description?
  - **Clarity Score (1-10, 10% weight)**: Age-appropriate language and clear instructions?
  - **Correctness Score (1-10, 20% weight)**: Factually accurate with sound rationale?
  - **Bias Score (1-10, 10% weight)**: Inclusive examples, culturally sensitive?
  - Chain-of-thought reasoning for transparency
  - Actionable improvement suggestions
  - Overall quality rating: excellent | good | needs_revision | unacceptable

- [x] Final recommendation algorithm:
  - **Approve**: All tiers passed, scores ≥ 7
  - **Revise**: Tier 1/2 passed but Tier 3 scores 4-6 or suggestions present
  - **Reject**: Structural failures, visual overflow risk, or Tier 3 scores ≤ 3

- [x] Store complete evaluation metadata: prompt, model, temperature, timestamp
- [x] Enable re-evaluation after edits
- [x] Support batch evaluation (all problems for a subskill)

**API Endpoints**:
- `POST /api/problems/{problem_id}/evaluation/evaluate`
- `GET /api/problems/{problem_id}/evaluation`
- `POST /api/subskills/{subskill_id}/problems/batch-evaluate`

**Database**: `problem_evaluations` table

**Dependencies**:
- Structural validator (schema registry)
- Heuristics validator (textstat library)
- LLM judge (Gemini API)

---

### FR-3: Reading Content Evaluation

**Description**: Evaluate reading content packages for pedagogical quality and technical compliance.

**User Story**: As a content author, I want to know if my reading content effectively teaches the learning objectives before publishing.

**Acceptance Criteria**:
- [x] **Tier 1 - Readability Validation**:
  - Flesch-Kincaid grade level per section
  - Aggregate readability score for package
  - Flag sections exceeding target grade ±2 levels

- [x] **Tier 2 - Content Heuristics**:
  - Section word count compliance (per section type: INTRODUCTION_MOTIVATION 150-250, INTUITIVE_EXPLANATION 300-500, etc.)
  - Interactive primitive count (minimum 2-3 per package)
  - Visual snippet presence for key concepts
  - Forbidden patterns (placeholders, HTML)

- [x] **Tier 3 - LLM Pedagogical Assessment**:
  - **Coverage Score (1-10)**: Do sections address all learning objectives?
  - **Engagement Score (1-10)**: Age-appropriate examples and scenarios?
  - **Coherence Score (1-10)**: Logical flow between sections?
  - **Accuracy Score (1-10)**: Factually correct content?
  - **Inclusivity Score (1-10)**: Diverse, bias-free examples?
  - Reasoning and improvement suggestions

- [x] Store evaluation metadata with prompts
- [x] Section-level and package-level metrics
- [x] Final recommendation (approve/revise/reject)

**API Endpoints**:
- `POST /api/subskills/{subskill_id}/content/evaluation/evaluate`
- `GET /api/subskills/{subskill_id}/content/evaluation`

**Database**: `content_evaluations` table

**Dependencies**:
- Content service (to retrieve reading packages)
- Readability library (textstat)
- LLM judge (Gemini API)

---

### FR-4: Prompt Template Management

**Description**: Version and track performance of AI prompts used for content generation and evaluation.

**User Story**: As an AI engineer, I want to track which prompts produce the best content so I can continuously improve generation quality.

**Acceptance Criteria**:
- [x] **Prompt Template CRUD**:
  - Create new prompt templates with variables
  - Update templates (creates new version)
  - Activate/deactivate specific versions
  - Only one active version per template name

- [x] **Template Types**:
  - `problem_generation` - Prompts for generating problems
  - `content_generation` - Prompts for reading content sections
  - `problem_evaluation` - Prompts for LLM judge (problems)
  - `content_evaluation` - Prompts for LLM judge (content)

- [x] **Performance Tracking**:
  - Usage count per template
  - Average evaluation score (aggregate from evaluations)
  - Approval rate (% of content approved using this prompt)
  - Dimension-specific scores (pedagogical, alignment, etc.)

- [x] **Versioning**:
  - Sequential version numbers
  - Change notes for audit trail
  - Creator tracking
  - Performance comparison across versions

- [x] **Variable Substitution**:
  - Templates define required variables: `["subskill_id", "grade_level", ...]`
  - Runtime substitution when generating content
  - Validation that all variables provided

**API Endpoints**:
- `POST /api/prompts` - Create template
- `GET /api/prompts` - List all templates
- `GET /api/prompts/{template_id}` - Get specific template
- `PUT /api/prompts/{template_id}` - Update (new version)
- `POST /api/prompts/{template_id}/activate` - Activate version
- `GET /api/prompts/performance` - Performance analytics

**Database**: `prompt_templates` table

**Dependencies**: None (standalone service)

---

### FR-5: Unified Content Review Dashboard

**Description**: Single interface showing complete content package status (reading + problems) with evaluation results.

**User Story**: As a content manager, I want to see at a glance which curriculum units are ready to publish and which need work.

**Acceptance Criteria**:
- [ ] **Content Quality Dashboard View**:
  - List all subskills with content status
  - Reading content score and recommendation
  - Problem count and approval status (X/10 approved)
  - Overall readiness indicator:
    - ✅ **Ready to Publish**: Reading approved + ≥5 problems approved
    - ⚠️ **Needs Work**: Reading or problems need revision
    - 🚧 **Incomplete**: Missing reading or problems
    - ⏳ **In Progress**: Content exists but not evaluated

- [ ] **Filtering and Sorting**:
  - Filter by status (ready/needs work/incomplete)
  - Filter by subject, grade level, unit
  - Sort by overall score, approval rate, last updated

- [ ] **Drill-Down Details**:
  - Click subskill → view reading sections with scores
  - View all problems with individual evaluation results
  - Quick actions: regenerate, edit, publish

- [ ] **Batch Operations**:
  - Regenerate all rejected problems
  - Re-evaluate all content for a unit
  - Publish multiple subskills at once

**UI Components**:
- `UnifiedContentReview.tsx` - Main dashboard
- `ContentQualityCard.tsx` - Per-subskill summary card
- `BatchActionsPanel.tsx` - Bulk operations

**API Endpoint**:
- `GET /api/content-quality-dashboard?subject={}&status={}`

**Database View**: `content_quality_dashboard`

---

### FR-6: Problem Generation UI

**Description**: User interface for generating practice problems with configuration options.

**User Story**: As a content author, I want to generate different types and quantities of problems easily.

**Acceptance Criteria**:
- [ ] **Generation Form**:
  - Select problem count (1-20, default 5)
  - Select problem types (multi-select or "variety" option)
  - Temperature slider (0.0-1.0, default 0.7)
  - Auto-evaluate checkbox (default true)

- [ ] **Problem Display**:
  - Grid/list view of generated problems
  - Preview problem content (question, options, rationale)
  - Evaluation status badges (🟢 approved, 🟡 revise, 🔴 reject)

- [ ] **Quick Actions**:
  - Edit problem inline
  - Regenerate specific problem
  - Delete problem
  - View full evaluation report

- [ ] **Prompt Visibility**:
  - Expandable "View Generation Prompt" section
  - Copy prompt to clipboard
  - See model and temperature used

**UI Component**: `ProblemGeneratorPanel.tsx`

---

### FR-7: Evaluation Results Viewer

**Description**: Detailed view of evaluation results with actionable insights.

**User Story**: As a content author, I want to understand why content failed evaluation and how to improve it.

**Acceptance Criteria**:
- [ ] **3-Tier Results Display**:
  - Tier 1: ✅/❌ with issue list
  - Tier 2: ✅/❌ with warnings vs. failures
  - Tier 3: Score bars (1-10) for each dimension with justifications

- [ ] **Overall Recommendation**:
  - Large badge (approve/revise/reject)
  - Overall score (0-10)
  - Clear explanation of why this recommendation

- [ ] **Improvement Suggestions**:
  - Bulleted list of actionable suggestions from LLM judge
  - Prioritized by importance

- [ ] **Prompt Debugging**:
  - View generation prompt
  - View evaluation prompt
  - Copy prompts for external testing
  - Comparison tool (if regenerated)

**UI Components**:
- `ProblemEvaluationView.tsx` - For problems
- `ContentEvaluationView.tsx` - For reading content
- `EvaluationScoreBar.tsx` - Reusable score visualization

---

### FR-8: Prompt Performance Analytics

**Description**: Analytics dashboard showing which prompts produce highest-quality content.

**User Story**: As an AI engineer, I want to identify which prompt templates perform best so I can standardize on effective approaches.

**Acceptance Criteria**:
- [ ] **Template Performance Table**:
  - Template name, type, active version
  - Usage count
  - Average overall score
  - Approval rate (%)
  - Breakdown by dimension scores

- [ ] **Trend Analysis**:
  - Performance over time (line chart)
  - Version comparison (version N vs N-1)
  - Statistical significance indicators

- [ ] **Prompt Comparison**:
  - Side-by-side view of two prompts
  - Performance metrics comparison
  - Recommended "winner"

- [ ] **Export Functionality**:
  - Export prompt history to CSV
  - Download performance reports
  - Copy high-performing prompts

**UI Component**: `PromptDebugger.tsx`

**API Endpoints**:
- `GET /api/prompts/performance?template_type={}`
- `GET /api/prompts/{id}/performance-history`
- `GET /api/prompts/{id1}/compare/{id2}`

---

## Non-Functional Requirements

### NFR-1: Performance

- Problem generation: ≤ 30 seconds for 10 problems
- Structural validation: ≤ 1 second per problem
- Heuristic validation: ≤ 2 seconds per problem
- LLM evaluation: ≤ 10 seconds per problem (Gemini Flash)
- Dashboard load: ≤ 2 seconds for 100 subskills
- BigQuery query response: ≤ 3 seconds for complex joins

### NFR-2: Scalability

- Support 10,000+ subskills in curriculum
- Handle 100,000+ problems stored
- Enable 50,000+ evaluations per month
- Concurrent users: 20 content authors
- Batch operations: up to 100 problems at once

### NFR-3: Reliability

- 99.5% uptime for authoring service
- Automatic retry for transient AI API failures (3 retries, exponential backoff)
- Graceful degradation if LLM judge unavailable (Tier 1+2 still run)
- Data consistency: All writes to BigQuery must succeed or rollback

### NFR-4: Security

- Firebase authentication required for all endpoints
- Role-based access control:
  - **Designer role**: Create/edit drafts, generate content, view evaluations
  - **Admin role**: Publish content, manage prompts, access analytics
- Audit logging for all content modifications
- No PII or student data in generation prompts

### NFR-5: Auditability

- Every generation stores: prompt, model, temperature, timestamp, duration
- Every evaluation stores: prompt, model, temperature, timestamp
- Edit history tracked for manual changes
- Version control for prompts with change notes
- Immutable audit trail (updates create new rows, old rows preserved)

### NFR-6: Cost Efficiency

- Use Gemini Flash (cheaper) instead of Pro for evaluations
- Cache prompt templates to minimize API calls
- Batch visual generation to reduce AI calls
- Partition BigQuery tables by date for query cost optimization
- Target: ≤ $0.10 per problem evaluated (all 3 tiers)

### NFR-7: Maintainability

- Schema-driven validation (add new problem types via YAML only)
- Service-oriented architecture (each service testable independently)
- Comprehensive logging with structured fields
- API documentation via OpenAPI/Swagger
- Unit test coverage ≥ 80%

---

## Success Metrics

### Content Quality Metrics

- **Approval Rate**: % of generated content receiving "approve" recommendation
  - **Target**: ≥ 70% approval rate for problems, ≥ 80% for reading content

- **Average Quality Score**: Mean overall score across all evaluations
  - **Target**: ≥ 7.5/10 across all content

- **Dimension-Specific Scores**:
  - Pedagogical Approach: ≥ 7/10
  - Alignment: ≥ 8/10
  - Correctness: ≥ 9/10

### Operational Efficiency Metrics

- **Time to Complete Package**: Time from curriculum creation to ready-to-publish
  - **Baseline**: Unknown (manual process)
  - **Target**: ≤ 2 hours per subskill (including iterations)

- **Iteration Cycles**: Average number of regenerations before approval
  - **Target**: ≤ 2 iterations per problem

- **Content Team Velocity**: Subskills completed per week per author
  - **Target**: 5 subskills/week (1 per day)

### System Health Metrics

- **Generation Success Rate**: % of generation requests that complete successfully
  - **Target**: ≥ 95%

- **Evaluation Coverage**: % of generated content that gets evaluated
  - **Target**: 100% (auto-evaluate enabled by default)

- **False Positive Rate**: % of approved content that fails in production
  - **Measurement**: Track student performance on approved vs. revised problems
  - **Target**: ≤ 5% false positives

### Adoption Metrics

- **Daily Active Users**: Content authors using the system daily
  - **Target**: 5 DAU within first month

- **Draft-to-Publish Ratio**: % of drafted content that gets published
  - **Target**: ≥ 60% (indicates confidence in evaluation system)

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  - Problem Generator UI                                      │
│  - Evaluation Viewers                                        │
│  - Content Quality Dashboard                                 │
│  - Prompt Debugger                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS/REST
┌──────────────────▼──────────────────────────────────────────┐
│        Curriculum Authoring Service (FastAPI)                │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ API Layer                                            │   │
│  │ - /api/subskills/{id}/problems/*                    │   │
│  │ - /api/problems/{id}/evaluation/*                   │   │
│  │ - /api/subskills/{id}/content/evaluation/*          │   │
│  │ - /api/prompts/*                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Services                                             │   │
│  │ - ProblemGeneratorService                           │   │
│  │ - ProblemEvaluationService                          │   │
│  │ - ContentEvaluationService                          │   │
│  │ - PromptManagerService                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Evaluation Framework                                 │   │
│  │ - StructuralValidator (schema registry)             │   │
│  │ - HeuristicsValidator (textstat)                    │   │
│  │ - LLMJudge (Gemini)                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
│ BigQuery  │ │Firestore│ │  Gemini  │
│ (Storage) │ │ (Cache) │ │   API    │
│           │ │         │ │          │
│ 4 new     │ │ Graph   │ │ Content  │
│ tables    │ │ Cache   │ │ Gen +    │
│ + 4 views │ │         │ │ Eval     │
└───────────┘ └─────────┘ └──────────┘
```

### Data Flow: Problem Generation → Evaluation → Publishing

```
1. User triggers problem generation
   ↓
2. ProblemGeneratorService:
   - Fetch subskill foundations
   - Build prompt from template + variables
   - Call Gemini API with structured schema
   - Store problem + generation metadata to BigQuery
   ↓
3. [Auto-evaluate enabled] ProblemEvaluationService:
   - Tier 1: StructuralValidator.validate(problem)
   - Tier 2: HeuristicsValidator.validate(problem)
   - Tier 3: LLMJudge.evaluate(problem, context)
   - Store evaluation + prompt to BigQuery
   ↓
4. User reviews results:
   - View problem + evaluation in UI
   - If revise: Edit or regenerate
   - If approve: Mark ready to publish
   ↓
5. Content Manager publishes:
   - Set is_draft=false, is_active=true
   - Update Firestore cache
   - Main backend consumes via API
```

### Database Schema Overview

**Core Tables**:
1. `curriculum_problems` - Generated problems with prompt metadata
2. `problem_evaluations` - 3-tier evaluation results
3. `content_evaluations` - Reading content evaluation results
4. `prompt_templates` - Versioned prompts with performance tracking

**Analytical Views**:
1. `problems_with_latest_evaluation` - Problems + most recent eval
2. `content_with_latest_evaluation` - Content + most recent eval
3. `prompt_performance_summary` - Prompt effectiveness metrics
4. `content_quality_dashboard` - Overall readiness by subskill

---

## Dependencies

### Internal Dependencies

- **Curriculum Manager**: Fetch subskill/skill/unit/subject metadata
- **Foundations Service**: Retrieve master context and primitives
- **Content Service**: Retrieve reading content for evaluation
- **Version Control**: Draft/publish workflow management
- **Firebase Auth**: User authentication and authorization

### External Dependencies

- **Google BigQuery**: Primary data storage
- **Google Firestore**: Graph caching (prerequisite relationships)
- **Google Gemini API**: Content generation and evaluation
- **textstat**: Readability scoring (Python library)
- **PyYAML**: Schema file parsing

---

## Risks and Mitigations

### Risk 1: AI Generation Quality Variance
**Description**: Gemini outputs may vary unpredictably despite same prompt
**Impact**: High - Could generate poor content intermittently
**Mitigation**:
- Use temperature ≤ 0.7 for consistency
- 3-tier evaluation catches quality issues
- Prompt templates versioned with performance tracking
- A/B test prompts to find stable formulations

### Risk 2: Evaluation False Negatives
**Description**: LLM judge approves poor content (false positive)
**Impact**: High - Bad content reaches students
**Mitigation**:
- Tier 1+2 (deterministic) provide safety net
- Monitor student performance on approved content
- Continuous calibration of LLM judge prompts
- Manual spot-checking of approved content

### Risk 3: Cost Overruns (AI API Calls)
**Description**: High evaluation volume could exceed budget
**Impact**: Medium - Operational cost increase
**Mitigation**:
- Use Gemini Flash (cheaper) instead of Pro
- Batch operations to reduce API calls
- Cache evaluation results (avoid re-eval of unchanged content)
- Tiered evaluation allows skipping LLM judge if Tier 1/2 fail

### Risk 4: BigQuery Query Costs
**Description**: Complex analytical queries could be expensive
**Impact**: Low - Incremental cost increase
**Mitigation**:
- Partitioned tables by date
- Clustered indexes on high-cardinality fields
- Materialized views for common dashboards
- Query result caching

### Risk 5: Adoption Resistance
**Description**: Content teams may not trust AI evaluations
**Impact**: Medium - Low system usage
**Mitigation**:
- Transparent evaluation (show reasoning, not just scores)
- Manual override capability (authors can approve despite "revise")
- Training and documentation
- Gradual rollout with champion users

---

## Implementation Phases

### Phase 1: Foundation (✅ COMPLETED)
**Scope**: Database schema, data models, evaluation framework
**Duration**: 1 week
**Deliverables**:
- ✅ 4 BigQuery tables + 4 views
- ✅ Pydantic models (591 lines)
- ✅ Evaluation framework (5 Python files + 8 YAML schemas)

### Phase 2: Core Services (🔄 IN PROGRESS)
**Scope**: Business logic for generation, evaluation, prompts
**Duration**: 2 weeks
**Deliverables**:
- [ ] ProblemGeneratorService
- [ ] PromptManagerService
- [ ] ProblemEvaluationService
- [ ] ContentEvaluationService

### Phase 3: API Layer
**Scope**: RESTful endpoints for all operations
**Duration**: 1 week
**Deliverables**:
- [ ] Problem CRUD endpoints
- [ ] Evaluation endpoints
- [ ] Prompt management endpoints
- [ ] Dashboard data endpoints
- [ ] OpenAPI documentation

### Phase 4: Frontend UI
**Scope**: React components for authoring and evaluation
**Duration**: 2 weeks
**Deliverables**:
- [ ] ProblemGeneratorPanel.tsx
- [ ] ProblemEvaluationView.tsx
- [ ] ContentEvaluationView.tsx
- [ ] UnifiedContentReview.tsx
- [ ] PromptDebugger.tsx

### Phase 5: Testing & QA
**Scope**: Unit tests, integration tests, load testing
**Duration**: 1 week
**Deliverables**:
- [ ] Unit tests (≥80% coverage)
- [ ] Integration tests (end-to-end workflows)
- [ ] Load tests (100 concurrent problem generations)
- [ ] QA sign-off

### Phase 6: Production Deployment
**Scope**: Deploy to staging and production environments
**Duration**: 1 week
**Deliverables**:
- [ ] Staging deployment
- [ ] User acceptance testing (UAT)
- [ ] Production deployment
- [ ] Monitoring and alerting setup
- [ ] User training

**Total Duration**: 8 weeks

---

## Open Questions

1. **Prompt Template Ownership**: Who has permission to create/modify prompt templates? (Proposal: Admin role only)

2. **Evaluation Re-run Policy**: Should we re-evaluate all existing content after updating LLM judge prompts? (Proposal: No, only new content uses new prompts)

3. **Manual Override**: Can content authors publish content despite "reject" recommendation? (Proposal: Admin approval required for overrides)

4. **Batch Size Limits**: What's the maximum number of problems to generate in one batch? (Proposal: 20, to prevent long wait times)

5. **Historical Evaluation Data**: How long to retain old evaluations after re-evaluation? (Proposal: Retain indefinitely for audit trail)

6. **Integration with Main Backend**: Should main backend also start storing generation prompts? (Proposal: Yes, gradual migration)

---

## Appendix

### Glossary

- **Subskill**: Granular learning objective (e.g., "Identify main topic using picture clues")
- **Foundation**: AI-generated master context and primitives for a subskill
- **Problem Type**: Category of practice problem (e.g., multiple choice, true/false)
- **Tier 1/2/3**: Levels of evaluation (structural, heuristic, LLM judge)
- **Prompt Template**: Reusable AI prompt with variable placeholders
- **Draft**: Content created but not published to students
- **Approve/Revise/Reject**: Final recommendation from evaluation system

### References

- [content-pipeline repository](../content-pipeline) - Original evaluation framework
- [Backend problem generation](../backend/app/services/problems.py) - Current implementation
- [CLAUDE.md](../CLAUDE.md) - Architecture overview

---

**Document Status**: Draft v1.0
**Next Review**: After Phase 2 completion
**Approvals Needed**: Content Manager, Engineering Lead, Product Owner
