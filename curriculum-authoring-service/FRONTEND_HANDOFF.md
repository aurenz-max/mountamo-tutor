# Frontend Development Handoff - Unified Content Authoring System

**Date:** 2025-01-20
**Backend Status:** Phase 2 Core Services (75% Complete) + APIs LIVE ✅
**Ready for:** Full frontend integration (no mocks needed!)

---

## 📋 What's Ready for Frontend Integration

### ✅ Completed Backend Services

#### 1. **PromptManagerService**
Location: `app/services/prompt_manager_service.py`

**Purpose:** Manage versioned prompt templates used for AI content generation and evaluation.

**Key Capabilities:**
- Create/update prompt templates with automatic versioning
- Activate/deactivate template versions (only one active per type)
- Calculate performance metrics from evaluation results
- Render templates with variable substitution

**Data Models:**
```typescript
// TypeScript interfaces for frontend

interface PromptTemplate {
  template_id: string;
  template_name: string;
  template_type: 'problem_generation' | 'content_generation' | 'problem_evaluation' | 'content_evaluation';
  template_text: string;
  template_variables: string[];
  version: number;
  is_active: boolean;
  usage_count: number;
  performance_metrics?: {
    avg_evaluation_score?: number;
    approval_rate?: number;
    avg_pedagogical_score?: number;
    avg_alignment_score?: number;
    avg_clarity_score?: number;
    avg_correctness_score?: number;
    avg_bias_score?: number;
    total_generations: number;
    total_approvals: number;
    total_revisions: number;
    total_rejections: number;
  };
  created_at: string;
  updated_at: string;
  created_by?: string;
  change_notes?: string;
}

interface CreatePromptTemplateRequest {
  template_name: string;
  template_type: 'problem_generation' | 'content_generation' | 'problem_evaluation' | 'content_evaluation';
  template_text: string;
  template_variables: string[];
  is_active?: boolean;
  change_notes?: string;
}

interface UpdatePromptTemplateRequest {
  template_text?: string;
  template_variables?: string[];
  is_active?: boolean;
  change_notes?: string;
}
```

**API Endpoints (✅ NOW LIVE):**
```typescript
// These endpoints are ready to use NOW!

// List all templates (with optional filters)
GET /api/prompts?template_type=problem_generation&active_only=true
Response: PromptTemplate[]

// Get specific template
GET /api/prompts/{template_id}
Response: PromptTemplate

// Create new template (auto-increments version)
POST /api/prompts
Body: CreatePromptTemplateRequest
Response: PromptTemplate

// Update existing template
PUT /api/prompts/{template_id}
Body: UpdatePromptTemplateRequest
Response: PromptTemplate

// Activate specific version
POST /api/prompts/{template_id}/activate
Response: PromptTemplate

// Get performance metrics
GET /api/prompts/{template_id}/performance
Response: PerformanceMetrics
```

---

#### 2. **ProblemGeneratorService**
Location: `app/services/problem_generator_service.py`

**Purpose:** Generate practice problems using Gemini AI with full metadata tracking.

**Key Capabilities:**
- Generate 5-10 problems per batch
- Supports 4 problem types: multiple_choice, true_false, fill_in_blanks, short_answer
- Auto-trigger evaluation after generation
- Regenerate problems with modified prompts
- Manual editing with full edit history
- Complete replicability (stores all generation parameters)

**Data Models:**
```typescript
interface Problem {
  problem_id: string;
  subskill_id: string;
  version_id: string;
  problem_type: 'multiple_choice' | 'true_false' | 'fill_in_blanks' | 'short_answer';
  problem_json: MultipleChoiceProblem | TrueFalseProblem | FillInBlanksProblem | ShortAnswerProblem;

  // Generation metadata (for replicability)
  generation_prompt?: string;
  generation_model?: string;
  generation_temperature?: number;
  generation_timestamp?: string;
  generation_duration_ms?: number;

  // Status
  is_draft: boolean;
  is_active: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
  edit_history?: EditHistoryEntry[];
}

interface MultipleChoiceProblem {
  id?: string;
  question_text: string;
  options: string[];  // Always 4 options
  correct_answer_index: number;  // 0-3
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TrueFalseProblem {
  id?: string;
  statement: string;
  correct_answer: boolean;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface FillInBlanksProblem {
  id?: string;
  question_text: string;  // Use {blank} or similar placeholder
  blanks: string[];  // Correct answers for each blank
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ShortAnswerProblem {
  id?: string;
  question_text: string;
  sample_answers: string[];  // Multiple acceptable answers
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface EditHistoryEntry {
  timestamp: string;
  user: string;
  changes: Record<string, any>;
}

interface GenerateProblemsRequest {
  subskill_id: string;
  version_id: string;
  count?: number;  // Default 5
  problem_types?: ('multiple_choice' | 'true_false' | 'fill_in_blanks' | 'short_answer')[];
  temperature?: number;  // 0.0-1.0, default 0.7
  auto_evaluate?: boolean;  // Default true
  custom_prompt?: string;  // Override default prompt
}

interface RegenerateProblemRequest {
  modified_prompt?: string;
  temperature?: number;
}

interface UpdateProblemRequest {
  problem_json?: any;
  is_draft?: boolean;
  is_active?: boolean;
}
```

**API Endpoints (✅ NOW LIVE):**
```typescript
// Generate problems for a subskill
POST /api/subskills/{subskill_id}/problems/generate
Body: GenerateProblemsRequest
Response: Problem[]

// List problems for a subskill
GET /api/subskills/{subskill_id}/problems?version_id=v1&active_only=false
Response: Problem[]

// Get specific problem
GET /api/problems/{problem_id}
Response: Problem

// Update problem (manual edit)
PUT /api/problems/{problem_id}
Body: UpdateProblemRequest
Response: Problem

// Regenerate problem
POST /api/problems/{problem_id}/regenerate
Body: RegenerateProblemRequest
Response: Problem

// Delete problem
DELETE /api/problems/{problem_id}
Response: { success: boolean }
```

---

### 🔄 In Progress (Backend - Week 2)

#### 3. **ProblemEvaluationService** (Starting Next)
**Purpose:** Evaluate problems through 3-tier pipeline and provide quality scores.

**Expected API Endpoints:**
```typescript
// Evaluate a problem
POST /api/problems/{problem_id}/evaluate
Body: { skip_llm?: boolean }
Response: ProblemEvaluation

// Get evaluation for a problem
GET /api/problems/{problem_id}/evaluation
Response: ProblemEvaluation

// Batch evaluate all problems for a subskill
POST /api/subskills/{subskill_id}/problems/batch-evaluate
Response: ProblemEvaluation[]
```

**Expected Data Model:**
```typescript
interface ProblemEvaluation {
  evaluation_id: string;
  problem_id: string;
  evaluation_timestamp: string;

  // Tier 1: Structural
  tier1_passed: boolean;
  tier1_issues: string[];

  // Tier 2: Heuristics
  tier2_passed: boolean;
  readability_score?: number;
  readability_appropriate: boolean;
  has_placeholders: boolean;
  has_overflow_risk: boolean;
  tier2_issues: string[];

  // Tier 3: LLM Judge
  pedagogical_approach_score: number;  // 1-10
  pedagogical_approach_justification: string;
  alignment_score: number;
  alignment_justification: string;
  clarity_score: number;
  clarity_justification: string;
  correctness_score: number;
  correctness_justification: string;
  bias_score: number;
  bias_justification: string;

  llm_reasoning: string;
  llm_overall_quality: 'excellent' | 'good' | 'needs_revision' | 'unacceptable';
  llm_recommended_action: 'approve' | 'approve_with_suggestions' | 'revise' | 'reject';
  llm_suggestions: string[];

  // Metadata
  evaluation_prompt?: string;
  evaluation_model?: string;

  // Final
  final_recommendation: 'approve' | 'revise' | 'reject';
  overall_score: number;  // 0-10
}
```

---

#### 4. **ContentEvaluationService** (Week 2)
**Purpose:** Evaluate reading content packages for pedagogical quality.

**Expected API Endpoints:**
```typescript
// Evaluate content package
POST /api/subskills/{subskill_id}/content/evaluate
Body: { version_id: string, skip_llm?: boolean }
Response: ContentEvaluation

// Get content evaluation
GET /api/subskills/{subskill_id}/content/evaluation?version_id=v1
Response: ContentEvaluation
```

**Expected Data Model:**
```typescript
interface ContentEvaluation {
  evaluation_id: string;
  subskill_id: string;
  version_id: string;
  evaluation_timestamp: string;

  // Tier 1: Readability
  tier1_passed: boolean;
  avg_readability_score: number;
  grade_level_appropriate: boolean;
  section_readability_scores: SectionReadability[];

  // Tier 2: Heuristics
  tier2_passed: boolean;
  section_word_counts: SectionWordCount[];
  primitive_count: number;
  visual_snippet_count: number;
  min_primitives_met: boolean;

  // Tier 3: LLM Assessment
  coverage_score: number;  // 1-10
  coverage_justification: string;
  engagement_score: number;
  engagement_justification: string;
  coherence_score: number;
  coherence_justification: string;
  accuracy_score: number;
  accuracy_justification: string;
  inclusivity_score: number;
  inclusivity_justification: string;

  llm_reasoning: string;
  llm_overall_quality: 'excellent' | 'good' | 'needs_revision' | 'unacceptable';
  llm_recommended_action: 'approve' | 'approve_with_suggestions' | 'revise' | 'reject';
  llm_suggestions: string[];

  // Final
  final_recommendation: 'approve' | 'revise' | 'reject';
  overall_score: number;
}

interface SectionReadability {
  section_id: string;
  score: number;
  appropriate: boolean;
}

interface SectionWordCount {
  section_id: string;
  section_type: string;
  word_count: number;
  compliant: boolean;
}
```

---

## 🎨 Recommended Frontend Components (Priority Order)

### 1. **ProblemGeneratorPanel** (HIGH PRIORITY - Build First)
**Purpose:** UI for generating and managing practice problems

**Features:**
- Form inputs:
  - Subskill selector (dropdown from existing curriculum)
  - Count slider (1-10 problems)
  - Problem type multi-select (checkboxes)
  - Temperature slider (0.0-1.0)
  - Auto-evaluate toggle
  - Custom prompt textarea (optional, advanced)
- "Generate" button with loading state
- Results grid showing generated problems
- Problem cards with:
  - Problem type badge
  - Difficulty badge
  - Quick preview of question
  - Actions: Edit, Regenerate, Delete, View Evaluation
  - Draft/Active status indicator

**User Flow:**
1. Select subskill from curriculum tree
2. Configure generation parameters
3. Click "Generate"
4. View generated problems in grid
5. Click problem card to view full details
6. Edit inline or regenerate individual problems
7. View evaluation results (traffic light: green/yellow/red)
8. Publish approved problems (change is_draft=false, is_active=true)

**Mockup Structure:**
```
┌─────────────────────────────────────────────────┐
│ Problem Generator                                │
├─────────────────────────────────────────────────┤
│ Subskill: [Dropdown: LA006-03-A]                │
│ Count: [Slider: 5 problems]                     │
│ Types: [☑ Multiple Choice] [☑ True/False]      │
│        [☐ Fill in Blanks] [☐ Short Answer]     │
│ Temperature: [Slider: 0.7]                      │
│ [☑] Auto-evaluate after generation              │
│                                                  │
│ [Generate Problems] 🎯                          │
├─────────────────────────────────────────────────┤
│ Generated Problems (5)                           │
│                                                  │
│ ┌──────────────┐ ┌──────────────┐              │
│ │ MC | Medium  │ │ T/F | Easy   │              │
│ │ "Which..."   │ │ "Plants..."  │              │
│ │ ⭐ 8.5/10    │ │ ⭐ 9.2/10    │              │
│ │ ✓ Approved   │ │ ⚠ Revise    │              │
│ │ [Edit] [🔄]  │ │ [Edit] [🔄]  │              │
│ └──────────────┘ └──────────────┘              │
└─────────────────────────────────────────────────┘
```

---

### 2. **ProblemEvaluationView** (HIGH PRIORITY)
**Purpose:** Display evaluation results for a single problem

**Features:**
- 3-tier results display:
  - **Tier 1 (Structural)**: ✓/✗ with issues list
  - **Tier 2 (Heuristics)**: ✓/✗ with warnings
  - **Tier 3 (LLM Judge)**: Score bars for 5 dimensions
- Traffic light overall indicator
  - 🟢 Green: Approve (score ≥ 8.0)
  - 🟡 Yellow: Revise (score 6.0-7.9)
  - 🔴 Red: Reject (score < 6.0)
- LLM reasoning and suggestions (collapsible)
- "View Generation Prompt" button (opens modal)
- "View Evaluation Prompt" button (opens modal)
- Action buttons: Accept, Request Revision, Reject

**Mockup Structure:**
```
┌─────────────────────────────────────────────────┐
│ Problem Evaluation                               │
│ Overall: 🟢 8.5/10 - Approved                   │
├─────────────────────────────────────────────────┤
│ Tier 1: Structural Validation         ✓ PASS   │
│   ✓ All required fields present                 │
│   ✓ Valid enums and types                       │
├─────────────────────────────────────────────────┤
│ Tier 2: Heuristics                     ✓ PASS   │
│   ✓ Readability: Grade 2.3 (target: K)         │
│   ✓ No placeholders                             │
│   ⚠ Total characters: 420 (slightly long)       │
├─────────────────────────────────────────────────┤
│ Tier 3: LLM Pedagogical Assessment              │
│   Pedagogical Approach  █████████░ 9/10         │
│   Alignment             ████████░░ 8/10         │
│   Clarity               █████████░ 9/10         │
│   Correctness           ██████████ 10/10        │
│   Bias                  ████████░░ 8/10         │
│                                                  │
│ [▼] LLM Reasoning                               │
│   "This problem effectively uses concrete..."   │
│                                                  │
│ [▼] Improvement Suggestions (2)                 │
│   • Consider simplifying the question stem      │
│   • Add more diverse character names            │
├─────────────────────────────────────────────────┤
│ [View Generation Prompt] [View Eval Prompt]     │
│ [✓ Accept] [⚠ Request Revision] [✗ Reject]    │
└─────────────────────────────────────────────────┘
```

---

### 3. **PromptDebugger** (MEDIUM PRIORITY)
**Purpose:** View and compare prompts used for generation and evaluation

**Features:**
- Side-by-side view of:
  - Generation prompt
  - Evaluation prompt
- Syntax highlighting
- Copy to clipboard button
- Link to template version used
- Variables used (highlighted)
- Performance metrics for this template

**Mockup Structure:**
```
┌─────────────────────────────────────────────────┐
│ Prompt Debugger - Problem #abc123               │
├─────────────────────────────────────────────────┤
│ Generation Prompt        │ Evaluation Prompt    │
│ Template: default_v3     │ Template: eval_v2    │
│ [Copy 📋]                │ [Copy 📋]            │
├──────────────────────────┼──────────────────────┤
│ You are an expert...     │ Evaluate this...     │
│                          │                      │
│ Subskill: {subskill}    │ Problem: {problem}   │
│ Grade: {grade_level}    │ Grade: {grade}       │
│ ...                      │ ...                  │
│                          │                      │
├──────────────────────────┴──────────────────────┤
│ Template Performance                             │
│ • Usage: 142 generations                        │
│ • Avg Score: 8.3/10                             │
│ • Approval Rate: 78%                            │
└─────────────────────────────────────────────────┘
```

---

### 4. **UnifiedContentReview** (MEDIUM PRIORITY)
**Purpose:** Dashboard view of all content packages by status

**Features:**
- Table view with columns:
  - Subskill ID & Description
  - Reading Content Status (🟢/🟡/🔴)
  - Problems Count (X approved / Y total)
  - Overall Status (Ready to Publish / Needs Work / Incomplete)
  - Actions (View Details, Regenerate Rejected, Publish)
- Filters:
  - Status (All / Ready / Needs Work / Incomplete)
  - Subject
  - Grade Level
  - Unit
- Search by subskill ID or description
- Batch operations toolbar:
  - "Regenerate all rejected problems"
  - "Re-evaluate all"
  - "Publish selected" (bulk)

**Mockup Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Content Quality Dashboard                                    │
├─────────────────────────────────────────────────────────────┤
│ Filters: [Status: All ▼] [Subject: Math ▼] [Search...]     │
│                                                              │
│ [Batch Actions ▼]                                           │
├──────┬─────────────────┬──────────┬──────────┬─────────────┤
│ Sub  │ Description     │ Reading  │ Problems │ Status      │
├──────┼─────────────────┼──────────┼──────────┼─────────────┤
│ LA01 │ Letter Recog... │ 🟢 9.2  │ 8/10 ✓  │ 🟢 Ready    │
│ LA02 │ Phonics...      │ 🟡 7.5  │ 5/10 ✓  │ 🟡 Needs... │
│ MA01 │ Counting...     │ 🔴 5.2  │ 0/10 ✓  │ 🔴 Incomp.. │
│ ...  │ ...             │ ...      │ ...      │ ...         │
└──────┴─────────────────┴──────────┴──────────┴─────────────┘
```

---

### 5. **PromptTemplateManager** (LOW PRIORITY - Can wait)
**Purpose:** Manage prompt templates and versions

**Features:**
- List of all templates by type
- Version history timeline
- Active version indicator
- Performance comparison chart
- Create new version
- Activate/deactivate versions
- A/B testing comparison

---

## ✅ API Status - READY NOW!

### APIs Already Implemented:
All core problem and prompt APIs are **LIVE and ready to use**:

**✅ Problem CRUD (Complete)**
- ✅ `POST /api/subskills/{id}/problems/generate`
- ✅ `GET /api/subskills/{id}/problems`
- ✅ `GET /api/problems/{id}`
- ✅ `PUT /api/problems/{id}`
- ✅ `POST /api/problems/{id}/regenerate`
- ✅ `DELETE /api/problems/{id}`

**✅ Prompt Endpoints (Complete)**
- ✅ `GET /api/prompts`
- ✅ `POST /api/prompts`
- ✅ `PUT /api/prompts/{id}`
- ✅ `POST /api/prompts/{id}/activate`
- ✅ `GET /api/prompts/active/{name}/{type}`
- ✅ `GET /api/prompts/{id}/performance`
- ✅ `GET /api/prompts/types`

**🔜 Coming This Week: Evaluation Endpoints**
- ⏳ `POST /api/problems/{id}/evaluate`
- ⏳ `GET /api/problems/{id}/evaluation`
- ⏳ `POST /api/subskills/{id}/problems/batch-evaluate`
- ⏳ `POST /api/subskills/{id}/content/evaluate`
- ⏳ `GET /api/subskills/{id}/content/evaluation`

**🔜 Coming Next Week: Dashboard**
- ⏳ `GET /api/content-quality-dashboard`

---

## 💻 Development Approach

### ✅ Option 1: Use Real APIs NOW! (RECOMMENDED)
**APIs are live - start integrating immediately:**

1. Create TypeScript interfaces (provided above) ✅
2. Set up API client using examples below ✅
3. Build UI components connected to real endpoints
4. Use React Query for data fetching and caching
5. Add loading/error states
6. Test with real data from BigQuery

**Advantages:**
- No mock data needed - APIs are ready!
- Real problems generated from Gemini AI
- Immediate feedback on API design
- Faster path to production
- True end-to-end testing

**Sample Mock Data:**
```typescript
// mock/problems.ts
export const mockProblems: Problem[] = [
  {
    problem_id: 'prob_001',
    subskill_id: 'LA006-03-A',
    version_id: 'v1',
    problem_type: 'multiple_choice',
    problem_json: {
      question_text: 'Which letter comes after B?',
      options: ['A', 'C', 'D', 'E'],
      correct_answer_index: 1,
      explanation: 'C comes after B in the alphabet.',
      difficulty: 'easy'
    },
    generation_prompt: 'Generate kindergarten alphabet problems...',
    generation_model: 'gemini-2.0-flash-exp',
    generation_temperature: 0.7,
    generation_timestamp: '2025-01-20T10:30:00Z',
    generation_duration_ms: 2500,
    is_draft: false,
    is_active: true,
    created_at: '2025-01-20T10:30:00Z',
    updated_at: '2025-01-20T10:30:00Z',
    last_edited_by: 'user_001'
  },
  // Add 5-10 more examples
];

export const mockEvaluations: ProblemEvaluation[] = [
  {
    evaluation_id: 'eval_001',
    problem_id: 'prob_001',
    evaluation_timestamp: '2025-01-20T10:30:05Z',
    tier1_passed: true,
    tier1_issues: [],
    tier2_passed: true,
    readability_score: 2.1,
    readability_appropriate: true,
    has_placeholders: false,
    has_overflow_risk: false,
    tier2_issues: [],
    pedagogical_approach_score: 9,
    pedagogical_approach_justification: 'Uses concrete letter examples appropriate for kindergarten.',
    alignment_score: 8,
    alignment_justification: 'Well-aligned with subskill objectives.',
    clarity_score: 9,
    clarity_justification: 'Question is clear and unambiguous.',
    correctness_score: 10,
    correctness_justification: 'Correct answer is accurate.',
    bias_score: 8,
    bias_justification: 'No bias detected.',
    llm_reasoning: 'This is a well-constructed problem...',
    llm_overall_quality: 'excellent',
    llm_recommended_action: 'approve',
    llm_suggestions: ['Consider adding a visual representation of the alphabet.'],
    final_recommendation: 'approve',
    overall_score: 8.8
  }
];
```

### Option 2: Wait for APIs (NOT RECOMMENDED)
- Frontend waits until Week 3 to start
- Slower overall progress
- Higher integration risk

---

## 🚀 Recommended Frontend Stack

Based on your existing Next.js setup:

```typescript
// Suggested libraries
- React Query (tanstack/react-query) - API state management
- Zustand - Local state management
- Radix UI - Already using, perfect for this
- Tailwind CSS - Already using
- React Hook Form - Form handling
- Zod - Schema validation (matches backend Pydantic models)
```

**Sample API Client:**
```typescript
// lib/curriculum-authoring-api.ts
import { authApiClient } from '@/lib/authApiClient';

const BASE_URL = '/api';  // Or curriculum-authoring-service URL

export const curriculumAuthoringAPI = {
  // Problems
  generateProblems: async (subskillId: string, request: GenerateProblemsRequest) => {
    return authApiClient.post<Problem[]>(
      `${BASE_URL}/subskills/${subskillId}/problems/generate`,
      request
    );
  },

  listProblems: async (subskillId: string, versionId: string) => {
    return authApiClient.get<Problem[]>(
      `${BASE_URL}/subskills/${subskillId}/problems?version_id=${versionId}`
    );
  },

  getProblem: async (problemId: string) => {
    return authApiClient.get<Problem>(
      `${BASE_URL}/problems/${problemId}`
    );
  },

  updateProblem: async (problemId: string, updates: UpdateProblemRequest) => {
    return authApiClient.put<Problem>(
      `${BASE_URL}/problems/${problemId}`,
      updates
    );
  },

  regenerateProblem: async (problemId: string, request?: RegenerateProblemRequest) => {
    return authApiClient.post<Problem>(
      `${BASE_URL}/problems/${problemId}/regenerate`,
      request || {}
    );
  },

  deleteProblem: async (problemId: string) => {
    return authApiClient.delete(`${BASE_URL}/problems/${problemId}`);
  },

  // Evaluations
  evaluateProblem: async (problemId: string, skipLlm?: boolean) => {
    return authApiClient.post<ProblemEvaluation>(
      `${BASE_URL}/problems/${problemId}/evaluate`,
      { skip_llm: skipLlm }
    );
  },

  getEvaluation: async (problemId: string) => {
    return authApiClient.get<ProblemEvaluation>(
      `${BASE_URL}/problems/${problemId}/evaluation`
    );
  },

  // Prompts
  listPrompts: async (filters?: { template_type?: string; active_only?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.template_type) params.append('template_type', filters.template_type);
    if (filters?.active_only) params.append('active_only', 'true');

    return authApiClient.get<PromptTemplate[]>(
      `${BASE_URL}/prompts?${params}`
    );
  },

  createPrompt: async (request: CreatePromptTemplateRequest) => {
    return authApiClient.post<PromptTemplate>(
      `${BASE_URL}/prompts`,
      request
    );
  },

  activatePrompt: async (templateId: string) => {
    return authApiClient.post<PromptTemplate>(
      `${BASE_URL}/prompts/${templateId}/activate`
    );
  }
};
```

**Sample React Query Hook:**
```typescript
// hooks/useCurriculumAuthoring.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumAuthoringAPI } from '@/lib/curriculum-authoring-api';

export function useProblems(subskillId: string, versionId: string) {
  return useQuery({
    queryKey: ['problems', subskillId, versionId],
    queryFn: () => curriculumAuthoringAPI.listProblems(subskillId, versionId),
    staleTime: 5 * 60 * 1000  // 5 minutes
  });
}

export function useGenerateProblems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, request }: {
      subskillId: string;
      request: GenerateProblemsRequest
    }) => curriculumAuthoringAPI.generateProblems(subskillId, request),
    onSuccess: (data, variables) => {
      // Invalidate problems list to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['problems', variables.subskillId]
      });
    }
  });
}

export function useProblemEvaluation(problemId: string) {
  return useQuery({
    queryKey: ['evaluation', problemId],
    queryFn: () => curriculumAuthoringAPI.getEvaluation(problemId),
    enabled: !!problemId
  });
}
```

---

## 📝 Next Steps

### For Frontend Team (Can Start NOW):

1. **Create type definitions** (use TypeScript interfaces above)
2. **Set up mock data** (copy examples above, add 10-20 more)
3. **Build ProblemGeneratorPanel component** with mock data
4. **Build ProblemEvaluationView component** with mock data
5. **Implement basic routing** (if needed)
6. **Add state management** (React Query + Zustand)
7. **Create API client skeleton** (ready to swap mocks for real calls)

### For Backend Team (This Week):

1. **Complete ProblemEvaluationService** (2 days)
2. **Complete ContentEvaluationService** (2 days)
3. **Write unit tests** (1 day)
4. **Next week: Build API endpoints** (5 days)

---

## 📞 Communication & Sync

**Recommended:**
- Daily 15-min sync between backend and frontend
- Shared Slack/Discord channel for quick questions
- Document any API changes in this file
- Weekly demo of progress (Friday EOD)

**Questions for Frontend Team:**
1. Do you prefer REST APIs or GraphQL?
2. Do you need real-time updates (WebSockets) or is polling okay?
3. What's your preferred error handling pattern?
4. Do you need pagination for problem lists, or is client-side filtering okay?
5. Any specific accessibility requirements (WCAG level)?

---

## ❓ FAQ

**Q: Can I start building without the backend APIs?**
A: Yes! Use mock data (examples above). You can build 80% of the UI before APIs are ready.

**Q: When will APIs be available?**
A: Week 3 (starting ~Jan 27). Problem endpoints first, then evaluations, then prompts.

**Q: What's the authentication approach?**
A: Firebase Auth (same as existing system). Use `authApiClient` from your codebase.

**Q: Can I modify the data models?**
A: Small changes okay. Major changes require backend sync. Document in this file.

**Q: What's the deployment strategy?**
A: Staging environment available for testing. Production deploy after UAT (Week 8).

**Q: Can I see a working example?**
A: Check existing `/my-tutoring-app/src/components/packages/` for similar patterns.

---

**Last Updated:** 2025-01-20
**Next Review:** 2025-01-27 (after API endpoints complete)
**Contact:** Backend team lead (Slack: #curriculum-authoring)
