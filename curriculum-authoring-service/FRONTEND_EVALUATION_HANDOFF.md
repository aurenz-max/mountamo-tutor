# Frontend Handoff: Problem Evaluation System (FR-2)

**Date**: 2025-11-21
**Backend Status**: ✅ **COMPLETE** - All endpoints implemented and ready for integration
**Feature**: 3-Tier Problem Evaluation System

---

## 🎯 What Was Built

The backend now has a **complete 3-tier evaluation system** for practice problems:

- **Tier 1**: Structural validation (schema compliance)
- **Tier 2**: Heuristic validation (readability, visual coherence, placeholders)
- **Tier 3**: LLM-as-judge (pedagogical quality assessment with 5 scoring dimensions)

### Key Features
✅ Three evaluation API endpoints
✅ Automatic evaluation during problem generation (if `auto_evaluate: true`)
✅ Batch evaluation for all problems in a subskill
✅ Complete evaluation results with recommendations (approve/revise/reject)
✅ All evaluation data stored in BigQuery with full metadata

---

## 🔌 API Endpoints Available

### Base URL
```
http://localhost:8000/api
```

### 1. **Evaluate Single Problem**
Trigger evaluation for a specific problem.

**Endpoint**: `POST /problems/{problem_id}/evaluation/evaluate`

**Query Parameters**:
- `skip_llm` (boolean, optional): Skip Tier 3 LLM evaluation (default: `false`)

**Example Request**:
```bash
curl -X POST "http://localhost:8000/api/problems/83de98fb-cd9c-4ead-9d32-f834bd139a63/evaluation/evaluate"
```

**Example Response**:
```json
{
  "success": true,
  "message": "Evaluation complete: approve",
  "data": {
    "evaluation_id": "eval-123",
    "problem_id": "83de98fb-cd9c-4ead-9d32-f834bd139a63",
    "evaluation_timestamp": "2025-11-21T16:52:26Z",

    "tier1_passed": true,
    "tier1_issues": [],

    "tier2_passed": true,
    "readability_score": 3.2,
    "visual_coherence_passed": true,
    "tier2_issues": [],

    "pedagogical_approach_score": 8,
    "alignment_score": 9,
    "clarity_score": 8,
    "correctness_score": 9,
    "bias_score": 10,
    "llm_reasoning": "This problem effectively uses...",
    "llm_suggestions": [
      "Consider adding a visual diagram...",
      "The teaching note could include..."
    ],

    "final_recommendation": "approve",
    "overall_score": 8.6,

    "structural_result": { /* Full Tier 1 details */ },
    "heuristic_result": { /* Full Tier 2 details */ },
    "llm_judgment": { /* Full Tier 3 details */ }
  }
}
```

---

### 2. **Get Problem Evaluation**
Retrieve the latest evaluation for a problem.

**Endpoint**: `GET /problems/{problem_id}/evaluation`

**Example Request**:
```bash
curl -X GET "http://localhost:8000/api/problems/83de98fb-cd9c-4ead-9d32-f834bd139a63/evaluation"
```

**Returns**: Same structure as evaluate endpoint (or 404 if no evaluation exists)

---

### 3. **Batch Evaluate Subskill**
Evaluate all problems for a subskill in one request.

**Endpoint**: `POST /subskills/{subskill_id}/problems/batch-evaluate`

**Query Parameters**:
- `version_id` (string, **required**): Version ID for the curriculum
- `skip_llm` (boolean, optional): Skip Tier 3 for faster testing (default: `false`)

**Example Request**:
```bash
curl -X POST "http://localhost:8000/api/subskills/math.1a.counting.1-5/problems/batch-evaluate?version_id=v1"
```

**Example Response**:
```json
{
  "success": true,
  "message": "Evaluated 8 problems: 5 approve, 2 revise, 1 reject",
  "count": 8,
  "data": [
    { /* Evaluation result 1 */ },
    { /* Evaluation result 2 */ },
    // ... 8 total
  ]
}
```

---

## 📊 Evaluation Result Fields

### Top-Level Fields
| Field | Type | Description |
|-------|------|-------------|
| `evaluation_id` | string | Unique evaluation identifier |
| `problem_id` | string | Problem being evaluated |
| `evaluation_timestamp` | datetime | When evaluation was performed |
| `final_recommendation` | enum | **"approve"**, **"revise"**, or **"reject"** |
| `overall_score` | float | Composite score (0-10) |

### Tier 1: Structural Validation
| Field | Type | Description |
|-------|------|-------------|
| `tier1_passed` | boolean | Passed structural validation |
| `tier1_issues` | string[] | List of structural issues (empty if passed) |

### Tier 2: Heuristic Validation
| Field | Type | Description |
|-------|------|-------------|
| `tier2_passed` | boolean | Passed heuristic checks |
| `readability_score` | float | Flesch-Kincaid grade level |
| `visual_coherence_passed` | boolean | No overflow risk |
| `tier2_issues` | string[] | List of heuristic failures |

### Tier 3: LLM Judge (Pedagogical Quality)
| Field | Type | Description |
|-------|------|-------------|
| `pedagogical_approach_score` | int (1-10) | Is this problem format effective for this skill? |
| `alignment_score` | int (1-10) | Does content match the subskill? |
| `clarity_score` | int (1-10) | Age-appropriate and clear? |
| `correctness_score` | int (1-10) | Factually accurate? |
| `bias_score` | int (1-10) | Inclusive and unbiased? (10 = perfect) |
| `llm_reasoning` | string | Chain-of-thought analysis |
| `llm_suggestions` | string[] | Actionable improvement suggestions |

### Full Nested Objects
- `structural_result`: Complete Tier 1 details
- `heuristic_result`: Complete Tier 2 details (includes visual coherence metrics)
- `llm_judgment`: Complete Tier 3 details (includes all justifications)

---

## 🎨 UI Integration Recommendations

### 1. **Problem List View**
Show evaluation status badges for each problem:

```typescript
interface ProblemWithEvaluation {
  problem_id: string;
  problem_type: string;
  evaluation?: {
    final_recommendation: 'approve' | 'revise' | 'reject';
    overall_score: number;
    tier1_passed: boolean;
    tier2_passed: boolean;
    evaluation_timestamp: string;
  };
}

// Badge colors
const getBadgeColor = (recommendation: string) => {
  switch(recommendation) {
    case 'approve': return 'green';
    case 'revise': return 'yellow';
    case 'reject': return 'red';
    default: return 'gray';
  }
};
```

**Suggested Display**:
```
┌─────────────────────────────────────────────┐
│ Problem 1: "How many apples?"               │
│ ✅ Approve (8.6/10) • Evaluated 2 min ago   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Problem 2: "Count the objects"              │
│ ⚠️ Revise (6.2/10) • Evaluated 5 min ago    │
│ 2 suggestions available                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Problem 3: "True or false question"         │
│ ❌ Reject (3.1/10) • Evaluated 10 min ago   │
│ Structural issues found                     │
└─────────────────────────────────────────────┘
```

---

### 2. **Problem Detail View**
Show comprehensive evaluation breakdown:

```typescript
// Component structure
<ProblemEvaluationPanel>
  <EvaluationOverview
    recommendation={evaluation.final_recommendation}
    overallScore={evaluation.overall_score}
    timestamp={evaluation.evaluation_timestamp}
  />

  <TierResults>
    <Tier1Badge passed={evaluation.tier1_passed} issues={evaluation.tier1_issues} />
    <Tier2Badge passed={evaluation.tier2_passed} readability={evaluation.readability_score} />
    <Tier3ScoreBreakdown scores={llmScores} />
  </TierResults>

  {evaluation.llm_suggestions.length > 0 && (
    <ImprovementSuggestions suggestions={evaluation.llm_suggestions} />
  )}

  <ReasoningPanel reasoning={evaluation.llm_reasoning} />
</ProblemEvaluationPanel>
```

**5-Dimension Score Display**:
```
┌─────────────────────────────────────────────┐
│ Pedagogical Quality Assessment              │
├─────────────────────────────────────────────┤
│ Pedagogical Approach  ████████░░  8/10      │
│ Alignment             █████████░  9/10      │
│ Clarity               ████████░░  8/10      │
│ Correctness           █████████░  9/10      │
│ Bias/Inclusivity      ██████████ 10/10      │
│                                              │
│ Overall Score: 8.6/10                       │
└─────────────────────────────────────────────┘
```

---

### 3. **Bulk Actions**
Enable actions based on evaluation status:

**Toolbar Actions**:
- "Evaluate All" - Trigger batch evaluation
- "Regenerate Rejected" - Regenerate all problems with `final_recommendation: "reject"`
- "Export Report" - Download CSV/JSON of all evaluations

```typescript
const bulkActions = {
  evaluateAll: async (subskillId: string, versionId: string) => {
    const response = await fetch(
      `/api/subskills/${subskillId}/problems/batch-evaluate?version_id=${versionId}`,
      { method: 'POST' }
    );
    return response.json();
  },

  filterByRecommendation: (problems: Problem[], recommendation: string) => {
    return problems.filter(p =>
      p.evaluation?.final_recommendation === recommendation
    );
  }
};
```

---

### 4. **Real-Time Evaluation Status**
When generating problems with `auto_evaluate: true`:

```typescript
// Show evaluation progress
const generateWithEvaluation = async () => {
  setStatus('Generating problems...');

  const response = await fetch('/api/subskills/{id}/problems/generate', {
    method: 'POST',
    body: JSON.stringify({
      version_id: 'v1',
      count: 5,
      auto_evaluate: true  // ⭐ Enable auto-evaluation
    })
  });

  const { data: problems } = await response.json();
  setStatus('Evaluating problems...');

  // Poll for evaluations (they run in background)
  await pollEvaluations(problems.map(p => p.problem_id));

  setStatus('Complete!');
};
```

---

## 🔄 Typical User Flows

### Flow 1: Generate → Auto-Evaluate → Review
```
1. User clicks "Generate Problems"
   → POST /subskills/{id}/problems/generate (auto_evaluate: true)

2. Backend generates 5 problems
   → Backend automatically evaluates each problem
   → Stores evaluations in BigQuery

3. Frontend polls for evaluation results
   → GET /problems/{id}/evaluation for each problem

4. Display problems with badges showing evaluation status
```

### Flow 2: Review Existing Problems
```
1. User navigates to subskill problems page

2. Fetch problems
   → GET /subskills/{id}/problems

3. Fetch evaluations for each problem
   → GET /problems/{id}/evaluation (for each)

4. Display list with evaluation badges
```

### Flow 3: Bulk Evaluate
```
1. User clicks "Evaluate All Problems"

2. Trigger batch evaluation
   → POST /subskills/{id}/problems/batch-evaluate?version_id=v1

3. Backend evaluates all problems (may take 30-60 seconds for 10 problems)

4. Display results with summary:
   "Evaluated 10 problems: 7 approve, 2 revise, 1 reject"
```

---

## 🚀 Getting Started

### 1. Test the Endpoints
Use the provided cURL examples to test each endpoint with your existing problems.

### 2. Create TypeScript Types
```typescript
// types/evaluation.ts
export interface ProblemEvaluation {
  evaluation_id: string;
  problem_id: string;
  evaluation_timestamp: string;

  // Summary
  final_recommendation: 'approve' | 'revise' | 'reject';
  overall_score: number;

  // Tier 1
  tier1_passed: boolean;
  tier1_issues: string[];

  // Tier 2
  tier2_passed: boolean;
  readability_score?: number;
  visual_coherence_passed: boolean;
  tier2_issues: string[];

  // Tier 3 (LLM)
  pedagogical_approach_score?: number;
  alignment_score?: number;
  clarity_score?: number;
  correctness_score?: number;
  bias_score?: number;
  llm_reasoning?: string;
  llm_suggestions?: string[];

  // Full nested objects (optional, for detail view)
  structural_result?: StructuralResult;
  heuristic_result?: HeuristicResult;
  llm_judgment?: LLMJudgment;
}
```

### 3. Create API Client Methods
```typescript
// lib/curriculum-authoring/evaluation-api.ts
import { authApiClient } from './auth-api-client';

export const evaluationApi = {
  // Evaluate single problem
  evaluateProblem: async (problemId: string, skipLLM = false) => {
    const response = await authApiClient.post(
      `/problems/${problemId}/evaluation/evaluate`,
      null,
      { params: { skip_llm: skipLLM } }
    );
    return response.data;
  },

  // Get evaluation
  getEvaluation: async (problemId: string) => {
    try {
      const response = await authApiClient.get(
        `/problems/${problemId}/evaluation`
      );
      return response.data?.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No evaluation exists yet
      }
      throw error;
    }
  },

  // Batch evaluate
  batchEvaluate: async (
    subskillId: string,
    versionId: string,
    skipLLM = false
  ) => {
    const response = await authApiClient.post(
      `/subskills/${subskillId}/problems/batch-evaluate`,
      null,
      { params: { version_id: versionId, skip_llm: skipLLM } }
    );
    return response.data;
  }
};
```

### 4. Create React Hooks
```typescript
// lib/curriculum-authoring/evaluation-hooks.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { evaluationApi } from './evaluation-api';

export const useEvaluation = (problemId: string) => {
  return useQuery({
    queryKey: ['evaluation', problemId],
    queryFn: () => evaluationApi.getEvaluation(problemId),
    enabled: !!problemId
  });
};

export const useEvaluateProblem = () => {
  return useMutation({
    mutationFn: ({ problemId, skipLLM }: { problemId: string; skipLLM?: boolean }) =>
      evaluationApi.evaluateProblem(problemId, skipLLM)
  });
};

export const useBatchEvaluate = () => {
  return useMutation({
    mutationFn: ({ subskillId, versionId, skipLLM }: {
      subskillId: string;
      versionId: string;
      skipLLM?: boolean;
    }) => evaluationApi.batchEvaluate(subskillId, versionId, skipLLM)
  });
};
```

---

## 💡 UX Tips

### Loading States
- **Evaluation in progress**: Show spinner with "Evaluating problem..." (LLM evaluation can take 3-5 seconds per problem)
- **Batch evaluation**: Show progress bar "Evaluating 3/10 problems..."

### Error States
- **404 on GET evaluation**: "No evaluation available yet. Click 'Evaluate' to run quality assessment."
- **500 on evaluation**: "Evaluation failed. Please try again."

### Success States
- **Approve (green)**: "✅ This problem meets quality standards!"
- **Revise (yellow)**: "⚠️ This problem has suggestions for improvement."
- **Reject (red)**: "❌ This problem has critical issues and should be regenerated."

### Empty States
- If no evaluations exist: Show "Evaluate All Problems" CTA button

---

## 📋 Testing Checklist

- [ ] Can evaluate a single problem via POST
- [ ] Can retrieve evaluation via GET (returns 404 if none exists)
- [ ] Can batch evaluate all problems in a subskill
- [ ] Auto-evaluation works during problem generation (when `auto_evaluate: true`)
- [ ] Evaluation badges display correctly in problem list
- [ ] 5-dimension scores render in problem detail view
- [ ] LLM suggestions are displayed and actionable
- [ ] Can filter problems by recommendation (approve/revise/reject)
- [ ] Loading states work for async evaluation calls

---

## 🐛 Known Issues & Limitations

1. **Evaluation takes 3-5 seconds per problem** (due to LLM call)
   - Use `skip_llm: true` for faster testing
   - Batch evaluation of 10 problems takes ~30-60 seconds

2. **Evaluations are immutable** (not versioned)
   - Each evaluation creates a new record
   - GET endpoint returns the **latest** evaluation
   - Frontend should show evaluation timestamp

3. **No pagination on batch evaluate**
   - Returns all evaluations in one response
   - For subskills with >20 problems, response may be large

---

## 📞 Questions or Issues?

If you encounter any issues or have questions:
1. Check server logs for detailed error messages
2. Verify GEMINI_API_KEY is set in environment
3. Confirm BigQuery `problem_evaluations` table exists
4. Test with `skip_llm: true` to isolate Tier 3 issues

---

## ✅ Summary

**What's Ready**:
- ✅ 3 API endpoints for evaluation
- ✅ Auto-evaluation during problem generation
- ✅ Complete 3-tier evaluation system
- ✅ All evaluation data stored in BigQuery
- ✅ Comprehensive evaluation results with recommendations

**Next Steps for Frontend**:
1. Create TypeScript types for `ProblemEvaluation`
2. Add API client methods to `evaluation-api.ts`
3. Create React hooks for data fetching
4. Build UI components for evaluation display
5. Add bulk action buttons (Evaluate All, Regenerate Rejected)
6. Implement filtering/sorting by evaluation status

**Start with**: Fetching and displaying existing evaluations on the problem list page!

---

**Happy coding! 🚀**
