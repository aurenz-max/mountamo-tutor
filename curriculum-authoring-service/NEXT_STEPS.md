# Next Steps: Unified Content Authoring & Evaluation System

**Last Updated**: January 2025
**Current Phase**: Phase 2 - Core Services Implementation
**Status**: Foundation Complete, Services In Progress

---

## Quick Reference: What's Done, What's Next

### ✅ Completed (Phases 1)

- [x] Database schema design (4 new tables + 4 views)
- [x] Pydantic models (problems, evaluations, prompts)
- [x] Evaluation framework (3-tier validation system)
- [x] Schema registry (8 YAML problem type definitions)
- [x] Documentation (PRD, implementation summary)

### 🔄 Current Focus (Phase 2)

- [ ] Implement ProblemGeneratorService
- [ ] Implement PromptManagerService
- [ ] Implement ProblemEvaluationService
- [ ] Implement ContentEvaluationService

### ⏳ Upcoming (Phases 3-6)

- [ ] API endpoints (RESTful layer)
- [ ] Frontend UI components
- [ ] Testing and QA
- [ ] Production deployment

---

## Immediate Next Steps (Week 1-2)

### Step 1: Set Up BigQuery Tables (Day 1)

**Objective**: Create database tables in BigQuery

**Tasks**:
1. **Run SQL scripts in BigQuery console**:
   ```bash
   # Navigate to BigQuery console: https://console.cloud.google.com/bigquery
   # Select your project: mountamo-tutor-h7wnta
   # Select dataset: analytics
   ```

2. **Create new tables**:
   ```bash
   # Copy and execute the following files in order:

   # File 1: Main tables
   docs/bigquery_problem_evaluation_tables.sql
   # This creates:
   # - curriculum_problems
   # - problem_evaluations
   # - content_evaluations
   # - prompt_templates
   # - 4 analytical views

   # File 2: Alter existing table
   docs/alter_content_table_for_prompts.sql
   # This adds prompt tracking to subskill_reading_content
   ```

3. **Verify tables created successfully**:
   ```sql
   -- Run these queries to verify:
   SELECT table_name, row_count
   FROM `mountamo-tutor-h7wnta.analytics.__TABLES__`
   WHERE table_name IN (
     'curriculum_problems',
     'problem_evaluations',
     'content_evaluations',
     'prompt_templates'
   );
   ```

**Expected Output**: 4 new tables with 0 rows (newly created)

**Time Estimate**: 30 minutes

**Dependencies**: BigQuery access with write permissions

---

### Step 2: Implement ProblemGeneratorService (Day 1-3)

**Objective**: Create service that generates practice problems using Gemini

**File to Create**: `app/services/problem_generator_service.py`

**Key Methods to Implement**:

```python
class ProblemGeneratorService:
    async def generate_problems(
        self,
        subskill_id: str,
        version_id: str,
        count: int = 5,
        problem_types: Optional[List[str]] = None,
        temperature: float = 0.7,
        auto_evaluate: bool = True
    ) -> List[ProblemInDB]:
        """
        Generate N problems for a subskill with prompt tracking.

        Steps:
        1. Fetch subskill foundations (master context + primitives)
        2. Get/build prompt template for problem generation
        3. Call Gemini API with structured schema
        4. Store problems in BigQuery with generation metadata
        5. [Optional] Auto-trigger evaluation
        6. Return list of generated problems
        """
        pass

    async def regenerate_problem(
        self,
        problem_id: str,
        modified_prompt: Optional[str] = None
    ) -> ProblemInDB:
        """
        Regenerate a specific problem with same or modified prompt.
        """
        pass

    async def get_problem(self, problem_id: str) -> Optional[ProblemInDB]:
        """Retrieve a problem by ID"""
        pass

    async def update_problem(
        self,
        problem_id: str,
        updates: ProblemUpdate,
        user_id: str
    ) -> ProblemInDB:
        """
        Update problem manually and track edit history.
        """
        pass

    async def delete_problem(self, problem_id: str) -> bool:
        """Soft delete a problem"""
        pass

    async def list_problems_for_subskill(
        self,
        subskill_id: str,
        version_id: str
    ) -> List[ProblemInDB]:
        """Get all problems for a subskill"""
        pass
```

**Implementation Guide**:

1. **Reference existing code**:
   - Copy generation logic from `backend/app/services/problems.py`
   - Adapt to use authoring service architecture
   - Remove student-specific personalization (this is for content authoring, not tutoring)

2. **Prompt building**:
   ```python
   # Use PromptManager to fetch active template
   template = await self.prompt_manager.get_active_template(
       template_type="problem_generation"
   )

   # Substitute variables
   prompt = template.render({
       "subskill_id": subskill_id,
       "subskill_description": subskill.description,
       "grade_level": subject.grade_level,
       "master_context": foundations.master_context,
       "primitives": foundations.context_primitives
   })
   ```

3. **Gemini API call**:
   ```python
   # Use structured schema (from backend/app/generators/content_schemas.py)
   from app.generators.content_schemas import PRACTICE_PROBLEMS_SCHEMA

   response = await self.client.models.generate_content(
       model="gemini-2.5-flash",
       contents=prompt,
       config=GenerateContentConfig(
           temperature=temperature,
           response_mime_type="application/json",
           response_schema=PRACTICE_PROBLEMS_SCHEMA
       )
   )
   ```

4. **Store in BigQuery with metadata**:
   ```python
   problem_data = {
       "problem_id": str(uuid.uuid4()),
       "subskill_id": subskill_id,
       "version_id": version_id,
       "problem_type": problem["problem_type"],
       "problem_json": json.dumps(problem),

       # Generation metadata
       "generation_prompt": prompt,
       "generation_model": "gemini-2.5-flash",
       "generation_temperature": temperature,
       "generation_timestamp": datetime.utcnow(),
       "generation_duration_ms": duration_ms,

       # Status
       "is_draft": True,
       "is_active": False,

       "created_at": datetime.utcnow(),
       "updated_at": datetime.utcnow()
   }

   await db.insert("curriculum_problems", problem_data)
   ```

**Testing Checklist**:
- [ ] Generate 5 multiple choice problems for a test subskill
- [ ] Verify problems stored in BigQuery with all metadata fields
- [ ] Confirm generation_prompt field contains full prompt text
- [ ] Test regeneration with modified prompt
- [ ] Test manual update with edit history tracking

**Time Estimate**: 2-3 days

**Dependencies**:
- Foundations service (already exists)
- Curriculum manager (already exists)
- Gemini API credentials
- BigQuery `curriculum_problems` table created

---

### Step 3: Implement PromptManagerService (Day 3-4)

**Objective**: Manage versioned prompt templates with performance tracking

**File to Create**: `app/services/prompt_manager_service.py`

**Key Methods**:

```python
class PromptManagerService:
    async def create_template(
        self,
        template_data: PromptTemplateCreate,
        user_id: str
    ) -> PromptTemplateInDB:
        """Create new prompt template (version 1)"""
        pass

    async def update_template(
        self,
        template_id: str,
        updates: PromptTemplateUpdate,
        user_id: str
    ) -> PromptTemplateInDB:
        """
        Update template (creates new version).
        Deactivates previous version, creates new version N+1.
        """
        pass

    async def activate_version(
        self,
        template_id: str
    ) -> PromptTemplateInDB:
        """
        Activate a specific template version.
        Deactivates all other versions of same template_name.
        """
        pass

    async def get_active_template(
        self,
        template_type: str,
        template_name: Optional[str] = None
    ) -> PromptTemplateInDB:
        """
        Get currently active template for a type.
        Used during generation to fetch prompt.
        """
        pass

    async def calculate_performance_metrics(
        self,
        template_id: str
    ) -> PerformanceMetrics:
        """
        Calculate performance from evaluations.

        Query problem_evaluations/content_evaluations where:
        - generation_prompt matches this template
        - Calculate avg scores, approval rate
        """
        pass

    async def get_performance_summary(
        self,
        template_type: Optional[str] = None
    ) -> List[PromptTemplatePerformanceSummary]:
        """Get performance summary for all templates"""
        pass

    def render_template(
        self,
        template: PromptTemplateInDB,
        variables: Dict[str, Any]
    ) -> str:
        """
        Substitute variables into template.

        Example:
        template.template_text = "Generate a {problem_type} for {subskill_id}"
        variables = {"problem_type": "multiple_choice", "subskill_id": "LA006-03-A"}
        Returns: "Generate a multiple_choice for LA006-03-A"
        """
        pass
```

**Implementation Notes**:

1. **Template Storage**:
   ```python
   # Store in BigQuery prompt_templates table
   template_data = {
       "template_id": str(uuid.uuid4()),
       "template_name": "problem_generation_v1",
       "template_type": "problem_generation",
       "template_text": prompt_text,
       "template_variables": ["subskill_id", "grade_level", ...],
       "version": 1,
       "is_active": True,  # First version auto-active
       "created_by": user_id,
       "created_at": datetime.utcnow()
   }
   ```

2. **Performance Calculation**:
   ```sql
   -- Query to calculate performance
   SELECT
     AVG(overall_score) as avg_score,
     SUM(CASE WHEN final_recommendation = 'approve' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as approval_rate,
     AVG(pedagogical_approach_score) as avg_pedagogical,
     AVG(alignment_score) as avg_alignment,
     COUNT(*) as usage_count
   FROM problem_evaluations
   WHERE evaluation_prompt = @template_text
   ```

3. **Version Management**:
   ```python
   # When updating, create new version
   async def update_template(self, template_id, updates, user_id):
       # Get current template
       current = await self.get_template(template_id)

       # Deactivate current
       await self._deactivate(template_id)

       # Create new version
       new_version = current.version + 1
       new_template = PromptTemplateCreate(
           template_name=current.template_name,
           template_type=current.template_type,
           template_text=updates.template_text or current.template_text,
           version=new_version,
           is_active=True
       )

       return await self.create_template(new_template, user_id)
   ```

**Testing Checklist**:
- [ ] Create template with variables
- [ ] Render template with variable substitution
- [ ] Update template (creates version 2)
- [ ] Activate specific version
- [ ] Calculate performance metrics from evaluations
- [ ] Verify only one active version per template_name

**Time Estimate**: 1-2 days

**Dependencies**:
- BigQuery `prompt_templates` table created
- Python string formatting (built-in)

---

### Step 4: Implement ProblemEvaluationService (Day 5-6)

**Objective**: Orchestrate 3-tier evaluation pipeline for problems

**File to Create**: `app/services/problem_evaluation_service.py`

**Key Methods**:

```python
class ProblemEvaluationService:
    def __init__(self):
        self.structural_validator = StructuralValidator()
        self.heuristics_validator = HeuristicsValidator()
        self.llm_judge = LLMJudge()

    async def evaluate_problem(
        self,
        problem_id: str,
        skip_llm: bool = False
    ) -> ProblemEvaluationResult:
        """
        Run 3-tier evaluation on a problem.

        Steps:
        1. Fetch problem from BigQuery
        2. Run Tier 1 (structural validation)
        3. Run Tier 2 (heuristics)
        4. [Optional] Run Tier 3 (LLM judge)
        5. Calculate final recommendation
        6. Store evaluation in BigQuery with prompt metadata
        7. Return result
        """
        pass

    async def batch_evaluate(
        self,
        subskill_id: str,
        version_id: str
    ) -> List[ProblemEvaluationResult]:
        """Evaluate all problems for a subskill"""
        pass

    async def get_evaluation(
        self,
        problem_id: str
    ) -> Optional[ProblemEvaluationResult]:
        """Get latest evaluation for a problem"""
        pass

    def calculate_final_recommendation(
        self,
        structural: StructuralValidationResult,
        heuristic: HeuristicValidationResult,
        llm_judgment: Optional[LLMJudgment]
    ) -> str:
        """
        Determine approve/revise/reject.

        Logic:
        - Reject if Tier 1 fails (structural issues)
        - Reject if Tier 2 visual overflow risk
        - Reject if LLM scores ≤ 3
        - Revise if LLM scores 4-6
        - Revise if LLM suggests improvements
        - Approve if all pass and scores ≥ 7
        """
        pass
```

**Implementation Guide**:

1. **Tier 1 - Structural Validation**:
   ```python
   # Already implemented in evaluation framework
   from app.evaluation.structural_validator import StructuralValidator

   validator = StructuralValidator()
   structural_result = validator.validate(problem_json)

   if not structural_result.passed:
       # Don't proceed to Tier 2/3 if structure invalid
       return early_rejection(structural_result)
   ```

2. **Tier 2 - Heuristics**:
   ```python
   from app.evaluation.heuristics_validator import HeuristicsValidator

   heuristics_validator = HeuristicsValidator()
   heuristic_result = heuristics_validator.validate(
       problem_json,
       grade_level=grade_level
   )

   # Check visual coherence
   if heuristic_result.visual_coherence.has_overflow_risk:
       # This is a hard failure - UI will break
       return rejection(heuristic_result)
   ```

3. **Tier 3 - LLM Judge**:
   ```python
   from app.evaluation.llm_judge import LLMJudge

   # Build evaluation context
   context = {
       "subskill_id": subskill_id,
       "subskill_description": subskill.description,
       "grade_level": grade_level,
       "problem": problem_json
   }

   llm_judge = LLMJudge()
   llm_judgment = await llm_judge.evaluate(
       problem=problem_json,
       context=context,
       temperature=0.3  # Lower temp for consistency
   )

   # llm_judgment contains:
   # - reasoning (chain of thought)
   # - 5 dimension scores + justifications
   # - recommended_action (approve/revise/reject)
   # - improvement_suggestions
   # - evaluation_prompt (STORED for replicability)
   ```

4. **Store Evaluation with Metadata**:
   ```python
   evaluation_data = {
       "evaluation_id": str(uuid.uuid4()),
       "problem_id": problem_id,
       "evaluation_timestamp": datetime.utcnow(),

       # Tier 1
       "tier1_passed": structural_result.passed,
       "tier1_issues": structural_result.issues,

       # Tier 2
       "tier2_passed": heuristic_result.passed,
       "readability_score": heuristic_result.readability_score,
       "visual_coherence_passed": heuristic_result.visual_coherence.passes_constraints,
       "tier2_issues": heuristic_result.failures + heuristic_result.warnings,

       # Tier 3
       "pedagogical_approach_score": llm_judgment.pedagogical_approach_score,
       "pedagogical_approach_justification": llm_judgment.pedagogical_approach_justification,
       "alignment_score": llm_judgment.alignment_score,
       # ... other scores
       "llm_reasoning": llm_judgment.reasoning,
       "llm_suggestions": llm_judgment.improvement_suggestions,

       # LLM Metadata (for replicability)
       "evaluation_prompt": llm_judgment.evaluation_prompt,
       "evaluation_model": llm_judgment.evaluation_model,
       "evaluation_temperature": llm_judgment.evaluation_temperature,

       # Final
       "final_recommendation": final_recommendation,
       "overall_score": calculate_overall_score(llm_judgment),

       # Full report JSON
       "evaluation_report_json": json.dumps({
           "structural": structural_result.dict(),
           "heuristic": heuristic_result.dict(),
           "llm_judgment": llm_judgment.dict() if llm_judgment else None
       })
   }

   await db.insert("problem_evaluations", evaluation_data)
   ```

**Testing Checklist**:
- [ ] Evaluate problem with all 3 tiers
- [ ] Verify evaluation stored with all metadata fields
- [ ] Test skip_llm flag (Tier 1+2 only)
- [ ] Test structural failure → reject without Tier 2/3
- [ ] Test visual overflow → reject
- [ ] Verify evaluation_prompt field populated
- [ ] Test batch evaluation (10 problems)

**Time Estimate**: 2 days

**Dependencies**:
- Evaluation framework (already exists in `app/evaluation/`)
- BigQuery `problem_evaluations` table created
- Gemini API credentials (for LLM judge)

---

### Step 5: Implement ContentEvaluationService (Day 7-8)

**Objective**: Evaluate reading content packages for pedagogical quality

**File to Create**: `app/services/content_evaluation_service.py`

**Key Methods**:

```python
class ContentEvaluationService:
    async def evaluate_content(
        self,
        subskill_id: str,
        version_id: str,
        skip_llm: bool = False
    ) -> ContentEvaluationResult:
        """
        Evaluate reading content package.

        Steps:
        1. Fetch all sections for subskill from BigQuery
        2. Run Tier 1 (readability per section)
        3. Run Tier 2 (content heuristics)
        4. [Optional] Run Tier 3 (LLM pedagogical assessment)
        5. Calculate final recommendation
        6. Store evaluation
        """
        pass

    async def get_evaluation(
        self,
        subskill_id: str,
        version_id: str
    ) -> Optional[ContentEvaluationResult]:
        """Get latest evaluation for content package"""
        pass
```

**Implementation Guide**:

1. **Tier 1 - Readability Validation**:
   ```python
   import textstat

   section_readability = []
   for section in sections:
       # Calculate Flesch-Kincaid grade level
       fk_score = textstat.flesch_kincaid_grade(section.content_text)

       # Check if within target ±2 grades
       target_grade = grade_to_number(grade_level)  # K=0, 1st=1, etc.
       appropriate = (target_grade - 2) <= fk_score <= (target_grade + 2)

       section_readability.append({
           "section_id": section.section_id,
           "readability_score": fk_score,
           "appropriate": appropriate,
           "issues": [] if appropriate else [f"Grade level {fk_score} outside target {target_grade}±2"]
       })

   avg_readability = sum(s["readability_score"] for s in section_readability) / len(sections)
   tier1_passed = all(s["appropriate"] for s in section_readability)
   ```

2. **Tier 2 - Content Heuristics**:
   ```python
   # Word count compliance
   SECTION_TYPE_WORD_COUNTS = {
       "INTRODUCTION_MOTIVATION": (150, 250),
       "INTUITIVE_EXPLANATION": (300, 500),
       "FORMAL_DEFINITION": (200, 400),
       "WORKED_EXAMPLES": (400, 800),
       "COMMON_ERRORS": (300, 500),
       "CONNECTIONS_EXTENSIONS": (200, 400)
   }

   section_word_counts = []
   for section in sections:
       word_count = len(section.content_text.split())
       section_type = section.section_type
       min_words, max_words = SECTION_TYPE_WORD_COUNTS.get(section_type, (0, 999999))

       compliant = min_words <= word_count <= max_words
       section_word_counts.append({
           "section_id": section.section_id,
           "section_type": section_type,
           "word_count": word_count,
           "target_min": min_words,
           "target_max": max_words,
           "compliant": compliant
       })

   # Interactive primitives count
   total_primitives = sum(
       len(section.interactive_primitives or [])
       for section in sections
   )
   min_primitives_met = total_primitives >= 2

   # Visual snippets count
   visual_count = sum(
       1 for section in sections
       if section.has_visual_snippet
   )

   tier2_passed = (
       all(s["compliant"] for s in section_word_counts) and
       min_primitives_met
   )
   ```

3. **Tier 3 - LLM Pedagogical Assessment**:
   ```python
   # Build prompt for content evaluation
   prompt = f"""
   Evaluate this reading content package for pedagogical quality.

   Subskill: {subskill_description}
   Grade Level: {grade_level}
   Learning Objectives: {objectives}

   Content Sections:
   {format_sections_for_prompt(sections)}

   Assess on these dimensions (1-10 scale):

   1. COVERAGE: Do the sections address all learning objectives comprehensively?
   2. ENGAGEMENT: Are examples age-appropriate and engaging for {grade_level} students?
   3. COHERENCE: Is there logical flow and smooth transitions between sections?
   4. ACCURACY: Is all content factually correct with sound explanations?
   5. INCLUSIVITY: Are examples diverse and culturally sensitive?

   Provide:
   - Score and justification for each dimension
   - Overall reasoning
   - Recommended action (approve/approve_with_suggestions/revise/reject)
   - Specific improvement suggestions

   Respond in JSON format.
   """

   llm_judgment = await self.llm_judge.evaluate_content(
       prompt=prompt,
       temperature=0.3
   )

   # Store with evaluation_prompt for replicability
   ```

4. **Store Evaluation**:
   ```python
   evaluation_data = {
       "evaluation_id": str(uuid.uuid4()),
       "subskill_id": subskill_id,
       "version_id": version_id,
       "evaluation_timestamp": datetime.utcnow(),

       # Tier 1
       "tier1_passed": tier1_passed,
       "avg_readability_score": avg_readability,
       "section_readability_scores": section_readability,

       # Tier 2
       "tier2_passed": tier2_passed,
       "section_word_counts": section_word_counts,
       "primitive_count": total_primitives,
       "visual_snippet_count": visual_count,
       "min_primitives_met": min_primitives_met,

       # Tier 3
       "coverage_score": llm_judgment.coverage_score,
       "coverage_justification": llm_judgment.coverage_justification,
       # ... other dimensions
       "llm_reasoning": llm_judgment.reasoning,
       "llm_suggestions": llm_judgment.improvement_suggestions,

       # LLM Metadata
       "evaluation_prompt": prompt,
       "evaluation_model": "gemini-flash",
       "evaluation_temperature": 0.3,

       # Final
       "final_recommendation": calculate_final_recommendation(tier1_passed, tier2_passed, llm_judgment),
       "overall_score": calculate_content_score(llm_judgment),

       "evaluation_report_json": json.dumps({...})
   }

   await db.insert("content_evaluations", evaluation_data)
   ```

**Testing Checklist**:
- [ ] Evaluate reading content package with 5 sections
- [ ] Verify readability scores calculated per section
- [ ] Test word count compliance checking
- [ ] Test primitive/visual counting
- [ ] Verify LLM evaluation with 5 dimension scores
- [ ] Confirm evaluation_prompt stored
- [ ] Test final recommendation logic

**Time Estimate**: 2 days

**Dependencies**:
- `textstat` library (add to requirements.txt)
- Content service (to fetch reading packages)
- BigQuery `content_evaluations` table created
- Gemini API credentials

---

## Week 3-4: API Endpoints

### Step 6: Create Problem API Endpoints (Week 3, Day 1-2)

**File to Create**: `app/api/endpoints/problems.py`

**Endpoints to Implement**:

```python
router = APIRouter(prefix="/api/subskills", tags=["problems"])

@router.post("/{subskill_id}/problems/generate")
async def generate_problems(
    subskill_id: str,
    request: ProblemGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate N problems for a subskill"""
    pass

@router.get("/{subskill_id}/problems")
async def list_problems(
    subskill_id: str,
    version_id: str = Query(...)
):
    """List all problems for a subskill"""
    pass

@router.get("/problems/{problem_id}", prefix="/api")
async def get_problem(problem_id: str):
    """Get specific problem"""
    pass

@router.put("/problems/{problem_id}", prefix="/api")
async def update_problem(
    problem_id: str,
    updates: ProblemUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update problem manually"""
    pass

@router.post("/problems/{problem_id}/regenerate", prefix="/api")
async def regenerate_problem(
    problem_id: str,
    modified_prompt: Optional[str] = None
):
    """Regenerate problem with same/modified prompt"""
    pass

@router.delete("/problems/{problem_id}", prefix="/api")
async def delete_problem(problem_id: str):
    """Delete problem"""
    pass
```

**Testing**: Use Swagger UI at `/docs` to test all endpoints

---

### Step 7: Create Evaluation API Endpoints (Week 3, Day 3-4)

**File to Create**: `app/api/endpoints/evaluations.py`

**Endpoints**:
- `POST /api/problems/{problem_id}/evaluation/evaluate`
- `GET /api/problems/{problem_id}/evaluation`
- `POST /api/subskills/{subskill_id}/problems/batch-evaluate`
- `POST /api/subskills/{subskill_id}/content/evaluation/evaluate`
- `GET /api/subskills/{subskill_id}/content/evaluation`

---

### Step 8: Create Prompt Management Endpoints (Week 3, Day 5)

**File to Create**: `app/api/endpoints/prompts.py`

**Endpoints**:
- `POST /api/prompts` - Create template
- `GET /api/prompts` - List templates
- `PUT /api/prompts/{template_id}` - Update
- `POST /api/prompts/{template_id}/activate` - Activate version
- `GET /api/prompts/performance` - Analytics

---

### Step 9: Create Dashboard Endpoint (Week 4, Day 1)

**File to Create**: `app/api/endpoints/dashboard.py`

**Endpoint**:
```python
@router.get("/api/content-quality-dashboard")
async def get_dashboard(
    subject: Optional[str] = None,
    status: Optional[str] = None,
    version_id: Optional[str] = None
):
    """
    Get content quality dashboard data.

    Returns:
    - List of subskills with:
      - Reading content evaluation status
      - Problem count and approval status
      - Overall readiness indicator
    """
    # Query the content_quality_dashboard view
    pass
```

---

## Week 5-6: Frontend UI

### Step 10: Create Problem Generator UI (Week 5, Day 1-3)

**Component**: `curriculum-designer-app/src/components/problems/ProblemGeneratorPanel.tsx`

**Features**:
- Form: count, types, temperature
- Generate button
- Loading state with progress
- Results grid with problem cards
- Quick actions (edit, regenerate, delete)

**API Integration**:
```typescript
const generateProblems = async (request: ProblemGenerationRequest) => {
  const response = await fetch(
    `/api/subskills/${subskillId}/problems/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    }
  );
  return response.json();
};
```

---

### Step 11: Create Evaluation Viewers (Week 5, Day 4-5)

**Components**:
- `ProblemEvaluationView.tsx` - 3-tier results with scores
- `ContentEvaluationView.tsx` - Reading content evaluation
- `EvaluationScoreBar.tsx` - Reusable score visualization (1-10 bar)

**UI Elements**:
- Traffic light badges (🟢 approve, 🟡 revise, 🔴 reject)
- Expandable tier sections
- Score bars with justifications
- Improvement suggestions list
- Prompt viewer (collapsible)

---

### Step 12: Create Unified Dashboard (Week 6, Day 1-3)

**Component**: `UnifiedContentReview.tsx`

**Features**:
- Table view of all subskills
- Columns: subskill name, reading score, problem count, status
- Filters (status, subject)
- Drill-down to details
- Batch actions toolbar

---

### Step 13: Create Prompt Debugger (Week 6, Day 4-5)

**Component**: `PromptDebugger.tsx`

**Features**:
- View all prompts for content
- Compare generation vs evaluation prompts
- Copy to clipboard
- Performance metrics table
- Version comparison

---

## Week 7: Testing

### Step 14: Unit Tests

**Create test files**:
- `tests/services/test_problem_generator_service.py`
- `tests/services/test_problem_evaluation_service.py`
- `tests/services/test_content_evaluation_service.py`
- `tests/services/test_prompt_manager_service.py`

**Target**: 80% code coverage

**Run tests**:
```bash
cd curriculum-authoring-service
pytest tests/ --cov=app --cov-report=html
```

---

### Step 15: Integration Tests

**Test end-to-end workflows**:
1. Generate problems → auto-evaluate → retrieve results
2. Update problem → re-evaluate → verify changes
3. Create prompt template → use in generation → track performance
4. Evaluate content → review results → publish

**Example test**:
```python
async def test_full_problem_workflow():
    # Generate
    problems = await problem_service.generate_problems(
        subskill_id="test-subskill",
        version_id="v1",
        count=5,
        auto_evaluate=True
    )

    # Verify stored with metadata
    assert len(problems) == 5
    for problem in problems:
        assert problem.generation_prompt is not None
        assert problem.generation_model == "gemini-2.5-flash"

    # Check evaluations created
    for problem in problems:
        evaluation = await evaluation_service.get_evaluation(problem.problem_id)
        assert evaluation is not None
        assert evaluation.evaluation_prompt is not None
        assert evaluation.final_recommendation in ["approve", "revise", "reject"]
```

---

### Step 16: Load Testing

**Test BigQuery performance**:
```python
# Generate 1000 problems and evaluate all
# Measure query times for dashboard

import time

start = time.time()
dashboard_data = await dashboard_service.get_dashboard()
duration = time.time() - start

assert duration < 3.0  # Must load in under 3 seconds
```

---

## Week 8: Production Deployment

### Step 17: Deploy to Staging

**Tasks**:
1. Update environment variables in Cloud Run
2. Deploy FastAPI service to staging
3. Run BigQuery table creation scripts in staging dataset
4. Deploy Next.js frontend to Vercel staging
5. Smoke test all endpoints

---

### Step 18: User Acceptance Testing

**With content team**:
1. Generate problems for 10 subskills
2. Review evaluation results
3. Iterate on low-scoring content
4. Publish complete packages
5. Gather feedback on UX

---

### Step 19: Production Deployment

**Checklist**:
- [ ] All tests passing (unit + integration)
- [ ] Load tests passing
- [ ] UAT sign-off
- [ ] Documentation complete
- [ ] Monitoring and alerts configured
- [ ] Rollback plan documented

**Deploy**:
1. Create production BigQuery tables
2. Deploy backend to production Cloud Run
3. Deploy frontend to Vercel production
4. Monitor error logs for 24 hours
5. Enable for content team

---

## Critical Path Dependencies

```
Week 1-2: Services
├── Step 1: BigQuery Tables (REQUIRED for all)
├── Step 2: ProblemGeneratorService (REQUIRED for Step 4)
├── Step 3: PromptManagerService (REQUIRED for Step 2)
├── Step 4: ProblemEvaluationService (depends on Step 2)
└── Step 5: ContentEvaluationService (independent)

Week 3-4: API
├── Step 6-9: All endpoints (depend on services)

Week 5-6: Frontend
├── Step 10-13: All UI (depend on API)

Week 7: Testing
├── Step 14-16: All tests (depend on all code)

Week 8: Deployment
└── Step 17-19: Staging → UAT → Production
```

---

## Resource Requirements

### Engineering Team

- **Backend Engineer** (2 weeks full-time): Services + API
- **Frontend Engineer** (2 weeks full-time): React components
- **QA Engineer** (1 week): Testing and UAT coordination
- **AI/ML Engineer** (1 week part-time): Prompt optimization and LLM judge tuning

### Infrastructure

- **BigQuery**: ~$50/month (estimate for 100K evaluations)
- **Gemini API**: ~$100/month (estimate for 10K evaluations with Flash)
- **Cloud Run**: Existing resources sufficient
- **Firestore**: Existing resources sufficient

### Total Estimated Cost

- **Development Time**: 8 weeks
- **Monthly Operational Cost**: ~$150
- **One-Time Migration**: N/A (new system)

---

## Risk Mitigation Strategies

### If Gemini API Becomes Unavailable

**Fallback**: Disable Tier 3 (LLM judge), continue with Tier 1+2 only
**Implementation**: Add circuit breaker pattern in evaluation service

### If BigQuery Queries Are Too Slow

**Mitigation**: Use materialized views, pre-compute dashboard metrics
**Implementation**: Create scheduled query to refresh materialized views hourly

### If Content Team Needs Training

**Solution**: Create video tutorials, in-app tooltips, documentation
**Timeline**: 1 week for documentation, concurrent with development

---

## Success Criteria

**Launch Criteria**:
- [ ] All 4 BigQuery tables created and tested
- [ ] All 4 services implemented with tests
- [ ] All API endpoints functional
- [ ] Frontend UI complete and user-tested
- [ ] 80% test coverage achieved
- [ ] Performance benchmarks met (< 3s dashboard load)
- [ ] UAT sign-off from content manager

**30-Day Post-Launch**:
- [ ] 5+ content authors actively using system
- [ ] 100+ subskills with complete content packages
- [ ] 70%+ approval rate on generated problems
- [ ] Zero production incidents
- [ ] Content team feedback score ≥ 4/5

---

## Communication Plan

**Weekly Status Updates**:
- Slack: #content-authoring-updates channel
- Every Friday: Progress report with % complete per phase

**Stakeholder Reviews**:
- End of Week 2: Services demo
- End of Week 4: API + UI demo
- End of Week 6: Full system walkthrough
- Week 8: Production deployment decision meeting

**Documentation**:
- **Developer Docs**: API reference (OpenAPI), service architecture
- **User Docs**: How-to guides, video tutorials
- **Runbook**: Deployment procedures, troubleshooting

---

## Handoff Checklist

When transitioning this project to another developer:

- [ ] Share this NEXT_STEPS.md document
- [ ] Share PRD_UNIFIED_CONTENT_SYSTEM.md
- [ ] Share UNIFIED_CONTENT_SYSTEM_IMPLEMENTATION.md
- [ ] Run SQL scripts to create BigQuery tables
- [ ] Show location of Pydantic models (`app/models/problems.py`)
- [ ] Show evaluation framework (`app/evaluation/`)
- [ ] Demonstrate existing content service for reference
- [ ] Provide Gemini API credentials
- [ ] Grant BigQuery write access
- [ ] Schedule 30-minute kickoff call to answer questions

---

## Quick Start for New Developer

**Day 1 Setup**:
1. Clone `curriculum-authoring-service` repository
2. Install dependencies: `pip install -r requirements.txt`
3. Add `textstat` to requirements.txt if not present
4. Run BigQuery SQL scripts (Step 1)
5. Verify tables created successfully
6. Read PRD document (30 minutes)
7. Review evaluation framework code (1 hour)
8. Start implementing ProblemGeneratorService (reference `backend/app/services/problems.py`)

**First Week Goal**: Complete Steps 1-5 (database + all services)

---

## Questions or Blockers?

**If stuck on**:
- **BigQuery issues**: Check dataset permissions, verify table schema
- **Gemini API**: Confirm API key valid, check quota limits
- **Service architecture**: Reference existing `content_service.py` as template
- **Evaluation framework**: All validators already implemented, just orchestrate

**Contact**:
- Technical questions: Reference this document and PRD
- Product questions: Review PRD requirements
- Architecture questions: See UNIFIED_CONTENT_SYSTEM_IMPLEMENTATION.md

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Next Review**: End of Phase 2 (Week 2)
