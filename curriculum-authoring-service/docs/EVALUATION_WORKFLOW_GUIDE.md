# Evaluation-Based Prompt Improvement Workflow

## Overview

The curriculum authoring system now uses an **evaluation-driven approach** to build a library of high-quality prompts. Instead of relying on static "default" templates, the system:

1. Generates problems with **automatic context variety** (primitives)
2. Evaluates generated problems for quality
3. Stores high-scoring prompts (>85%) as proven templates
4. Builds a library of effective prompts through real-world testing

## For Frontend Developers

### Key Changes

#### ✅ What Changed
- **Removed**: "default" template dependency - no more static template required
- **Added**: Context Variety Mode - automatic primitive sampling creates variation
- **Updated**: Template editor now optional - shows helpful message when no template exists
- **Simplified**: Removed template feedback panel from problem generation UI

#### ✅ What Stayed the Same
- Problem generation API endpoint: `POST /api/subskills/{subskill_id}/problems/generate`
- Problem evaluation API endpoint: `POST /api/subskills/{subskill_id}/problems/batch-evaluate`
- All existing hooks: `useGenerateProblems()`, `useBatchEvaluateProblems()`

### How to Use the New Workflow

#### 1. Generate Problems (No Template Required!)

```typescript
import { useGenerateProblems } from '@/lib/curriculum-authoring/problems-hooks';

const generateMutation = useGenerateProblems();

// Generate problems - context variety happens automatically
await generateMutation.mutateAsync({
  subskillId: 'skill-123',
  request: {
    version_id: 'v1',
    count: 5,
    problem_types: ['multiple_choice', 'true_false'], // Optional
    temperature: 0.7,
    auto_evaluate: true, // Recommended: evaluate immediately
    custom_prompt: undefined, // Leave empty to use context variety
  },
});
```

**What happens behind the scenes:**
- System samples 2× count primitives (objects, characters, scenarios, locations)
- Injects primitives into base prompt for each problem type
- Each problem gets unique context variety
- Actual prompts (with primitives) stored in `generation_prompt` field

#### 2. Evaluate Generated Problems

```typescript
import { useBatchEvaluateProblems } from '@/lib/curriculum-authoring/problems-hooks';

const batchEvaluateMutation = useBatchEvaluateProblems();

// Evaluate all problems for a subskill
await batchEvaluateMutation.mutateAsync({
  subskillId: 'skill-123',
  versionId: 'v1',
  skipLlm: false, // Use AI evaluation
});

// Results include scores for each problem
const results = batchEvaluateMutation.data;
// [
//   {
//     problem_id: "prob-1",
//     overall_score: 8.7,
//     final_recommendation: "approve",
//     ...
//   },
//   ...
// ]
```

**Evaluation Criteria:**
- ✅ **Approve**: overall_score ≥ 8.5 (85%)
- ⚠️ **Revise**: 6.0 ≤ overall_score < 8.5
- ❌ **Reject**: overall_score < 6.0

#### 3. View High-Quality Prompts

```typescript
// Query problems with high scores
import { useProblems } from '@/lib/curriculum-authoring/problems-hooks';

const { data: problems } = useProblems(subskillId, versionId);

// Filter for approved problems
const approvedProblems = problems?.filter(p =>
  !p.is_draft && p.is_active
) || [];

// Each problem has its generation_prompt stored
// You can inspect high-scoring prompts to understand what works
```

#### 4. (Optional) Promote High-Scoring Prompts to Templates

For prompts that consistently score >85%, you can promote them to the template library:

```typescript
// This would be a new feature to implement
import { useCreatePrompt } from '@/lib/curriculum-authoring/problems-hooks';

const createPromptMutation = useCreatePrompt();

// Promote a high-scoring prompt to template
await createPromptMutation.mutateAsync({
  template_name: `${subskill_name}_proven_v1`,
  template_type: 'problem_generation',
  template_text: problem.generation_prompt, // The proven prompt
  template_variables: extractVariables(problem.generation_prompt),
  is_active: true,
  change_notes: `Promoted from evaluation: avg score ${avgScore}`,
});
```

### UI Components

#### PromptTemplateEditor Component

The template editor now has two modes:

**Mode 1: No Template (Default - Context Variety Mode)**
```tsx
<PromptTemplateEditor
  templateName="default"
  templateType="problem_generation"
  onPromptChange={setCustomPrompt}
/>
```

Shows:
- 📘 Info alert: "Context Variety Mode: Problem generation uses automatic context variety..."
- 📝 Optional textarea for custom prompt override
- 💡 Hint: "High-scoring prompts (>85%) can be promoted to templates"

**Mode 2: Active Template Exists**
- Shows template text with performance metrics
- Allows editing/customization
- Displays approval rate, avg score, usage count

#### ProblemGenerationPanel Component

Simplified interface without template dependency:

```tsx
<ProblemGenerationPanel subskill={subskill} />
```

Features:
- Generate problems with automatic variety
- Batch evaluate all problems
- Batch regenerate rejected problems
- View problem cards with evaluation scores

### API Reference

#### Generate Problems
```typescript
POST /api/subskills/{subskill_id}/problems/generate

Request Body:
{
  version_id: string;
  count: number;
  problem_types?: string[]; // Optional, AI selects if omitted
  temperature?: number; // Default: 0.7
  auto_evaluate?: boolean; // Default: false
  custom_prompt?: string; // Optional override
}

Response:
[
  {
    problem_id: string;
    problem_type: string;
    generation_prompt: string; // Actual prompt with primitives
    // ... problem data
  }
]
```

#### Batch Evaluate Problems
```typescript
POST /api/subskills/{subskill_id}/problems/batch-evaluate

Request Body:
{
  version_id: string;
  skip_llm?: boolean; // Default: false
}

Response:
[
  {
    problem_id: string;
    overall_score: number; // 0-10
    pedagogical_approach_score: number;
    alignment_score: number;
    clarity_score: number;
    correctness_score: number;
    bias_score: number;
    final_recommendation: "approve" | "revise" | "reject";
    detailed_feedback: string;
  }
]
```

#### Get Best Performing Prompts (Production)
```typescript
GET /api/prompts/production/prompts/best-performing
  ?template_type=problem_generation
  &min_approval_rate=0.85
  &min_evaluations=5

Response:
{
  success: true,
  data: {
    template: {
      template_id: string;
      template_name: string;
      template_text: string; // The proven prompt
      version: number;
      performance_metrics: {
        avg_evaluation_score: number;
        approval_rate: number;
        total_generations: number;
      }
    },
    selection_pool_size: number;
    rationale: string;
  }
}
```

### Recommended Workflow for UI

#### Step 1: Generate Problems Page
```tsx
function GenerateProblemsPage() {
  return (
    <div>
      <h1>Generate Problems</h1>

      {/* Shows context variety mode by default */}
      <PromptTemplateEditor
        templateName="default"
        templateType="problem_generation"
        onPromptChange={setCustomPrompt}
      />

      {/* Generation controls */}
      <ProblemCountSelector value={count} onChange={setCount} />
      <ProblemTypeSelector selected={types} onChange={setTypes} />
      <AutoEvaluateToggle checked={autoEval} onChange={setAutoEval} />

      {/* Generate button */}
      <Button onClick={handleGenerate}>
        Generate {count} Problems
      </Button>
    </div>
  );
}
```

#### Step 2: Review Problems Page
```tsx
function ReviewProblemsPage() {
  const { data: problems } = useProblems(subskillId, versionId);

  return (
    <div>
      <h1>Review Generated Problems</h1>

      {/* Stats */}
      <Stats
        total={problems.length}
        approved={problems.filter(p => p.evaluation?.final_recommendation === 'approve').length}
        avgScore={calculateAvgScore(problems)}
      />

      {/* Batch actions */}
      <Button onClick={handleBatchEvaluate}>
        Evaluate All
      </Button>
      <Button onClick={handleBatchRegenerate}>
        Regenerate Rejected
      </Button>

      {/* Problem cards */}
      {problems.map(problem => (
        <ProblemCard
          key={problem.problem_id}
          problem={problem}
          showEvaluation
          showPrompt // Show the generation prompt used
        />
      ))}
    </div>
  );
}
```

#### Step 3: Prompt Library Page (New Feature Idea)
```tsx
function PromptLibraryPage() {
  // Query high-performing prompts
  const { data: bestPrompts } = useBestPerformingPrompts({
    minApprovalRate: 0.85,
    minEvaluations: 5,
  });

  return (
    <div>
      <h1>Proven Prompt Library</h1>
      <p>High-quality prompts from evaluations (>85% approval)</p>

      {bestPrompts.map(prompt => (
        <PromptCard
          key={prompt.template_id}
          prompt={prompt}
          metrics={prompt.performance_metrics}
          onPromote={handlePromoteToActive}
          onView={handleViewDetails}
        />
      ))}
    </div>
  );
}
```

### Testing Checklist

- [ ] Generate problems without any template - should use context variety
- [ ] Generate problems with custom prompt - should use custom prompt
- [ ] Batch evaluate problems - should return scores
- [ ] Filter problems by evaluation score
- [ ] View generation_prompt field on each problem
- [ ] Verify prompts have varied contexts (different objects, characters, etc.)
- [ ] Test batch regenerate rejected problems
- [ ] Verify auto_evaluate flag works during generation

### Debugging Tips

#### Check if Context Variety is Working
```typescript
// After generation, inspect the generation_prompt field
const problem = problems[0];
console.log(problem.generation_prompt);

// Should contain lines like:
// **Context Variety Guidelines**:
// **Objects to use**: apple, desk, pencil, backpack
// **Characters to feature**: Emma, Mr. Johnson, Sophia, Liam
// **Scenarios to incorporate**: Morning circle time, Reading a story...
// **Locations to reference**: classroom, library, playground...
```

#### Check Evaluation Results
```typescript
// After evaluation
const evaluation = problem.evaluation;
console.log({
  score: evaluation.overall_score,
  recommendation: evaluation.final_recommendation,
  feedback: evaluation.detailed_feedback,
});
```

#### Monitor Performance
```typescript
// Use the best-performing endpoint to see what's working
const response = await fetch('/api/prompts/production/prompts/best-performing?min_approval_rate=0.85');
const { data } = await response.json();

console.log(`Found ${data.selection_pool_size} high-quality prompts`);
console.log(`Selected prompt has ${data.metrics.approval_rate}% approval`);
```

### Common Pitfalls

❌ **Don't**: Expect a "default" template to exist
✅ **Do**: Leave custom_prompt empty to use context variety

❌ **Don't**: Try to create evaluations manually
✅ **Do**: Use `auto_evaluate: true` or batch evaluate endpoint

❌ **Don't**: Ignore the generation_prompt field
✅ **Do**: Use it to understand what prompts work well

❌ **Don't**: Assume all problem types need the same prompt
✅ **Do**: Let the system create type-specific prompts with variety

### Next Steps

1. **Remove any hardcoded template dependencies** in your frontend code
2. **Test problem generation** without templates - verify context variety works
3. **Implement evaluation workflow** - generate → evaluate → review cycle
4. **(Optional) Build prompt library UI** - showcase high-performing prompts
5. **(Optional) Add prompt promotion feature** - allow promoting proven prompts to templates

### Support

- Backend service: `curriculum-authoring-service/app/services/problem_generator_service.py`
- API endpoints: `curriculum-authoring-service/app/api/prompts.py`
- Frontend hooks: `curriculum-designer-app/lib/curriculum-authoring/problems-hooks.ts`
- UI components: `curriculum-designer-app/components/curriculum-designer/problems/`

### Questions?

Common questions:

**Q: Do I need to create a default template?**
A: No! The system uses context variety automatically.

**Q: Can I still use custom prompts?**
A: Yes, use the `custom_prompt` parameter or paste into the template editor.

**Q: How do I know if a prompt is high-quality?**
A: Check the evaluation score. >85% (8.5/10) is considered high-quality.

**Q: Where are the primitives stored?**
A: In the `generation_prompt` field of each problem, and in `generation_metadata.primitives_used`.

**Q: Can I see which prompts work best?**
A: Yes, use the `/production/prompts/best-performing` endpoint or query problems with high evaluation scores.
