# Quick Start: Evaluation-Based Problem Generation

## TL;DR

✅ **No more default template required**
✅ **Context variety happens automatically**
✅ **High-scoring prompts (>85%) become your library**

## Basic Usage

### 1. Generate Problems (3 lines of code)

```typescript
const generateMutation = useGenerateProblems();

await generateMutation.mutateAsync({
  subskillId: 'skill-123',
  request: {
    version_id: 'v1',
    count: 5,
    auto_evaluate: true, // Recommended!
  },
});
```

**That's it!** Context variety happens automatically.

### 2. View Results

```typescript
const { data: problems } = useProblems(subskillId, versionId);

// Each problem has:
// - problem_data: The actual problem content
// - generation_prompt: The prompt used (includes primitives!)
// - evaluation: Scores and recommendation (if auto_evaluate: true)
```

### 3. Review Quality

```typescript
const approvedProblems = problems.filter(p =>
  p.evaluation?.final_recommendation === 'approve' &&
  p.evaluation?.overall_score >= 8.5
);

console.log(`${approvedProblems.length} high-quality problems!`);
```

## UI Components

### Problem Generation Panel (Drop-in Component)

```tsx
import { ProblemGenerationPanel } from '@/components/curriculum-designer/problems/ProblemGenerationPanel';

function YourPage({ subskill }) {
  return <ProblemGenerationPanel subskill={subskill} />;
}
```

**Includes**:
- ✅ Template editor (optional custom prompts)
- ✅ Problem count slider
- ✅ Problem type selector
- ✅ Temperature control
- ✅ Auto-evaluate toggle
- ✅ Batch actions (evaluate, regenerate)
- ✅ Problem cards with evaluation scores

### Template Editor (Optional Override)

```tsx
import { PromptTemplateEditor } from '@/components/curriculum-designer/problems/PromptTemplateEditor';

<PromptTemplateEditor
  templateName="default"
  templateType="problem_generation"
  onPromptChange={setCustomPrompt}
/>
```

**Shows**:
- "Context Variety Mode" by default
- Optional textarea for custom prompts
- Performance metrics (if template exists)

## API Hooks

### Available Hooks

```typescript
import {
  useGenerateProblems,      // Generate new problems
  useProblems,              // Fetch problems
  useBatchEvaluateProblems, // Evaluate all problems
  useBatchRegenerateProblems, // Regenerate rejected
} from '@/lib/curriculum-authoring/problems-hooks';
```

### Example: Complete Flow

```typescript
function ProblemWorkflow({ subskillId, versionId }) {
  const generateMutation = useGenerateProblems();
  const evaluateMutation = useBatchEvaluateProblems();
  const { data: problems } = useProblems(subskillId, versionId);

  // Step 1: Generate
  const handleGenerate = async () => {
    await generateMutation.mutateAsync({
      subskillId,
      request: { version_id: versionId, count: 5, auto_evaluate: true }
    });
  };

  // Step 2: Evaluate (if not auto)
  const handleEvaluate = async () => {
    await evaluateMutation.mutateAsync({
      subskillId,
      versionId,
    });
  };

  // Step 3: Review
  const stats = {
    total: problems?.length || 0,
    approved: problems?.filter(p => p.evaluation?.final_recommendation === 'approve').length || 0,
    avgScore: problems?.reduce((sum, p) => sum + (p.evaluation?.overall_score || 0), 0) / problems?.length || 0,
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate 5 Problems</button>
      <button onClick={handleEvaluate}>Evaluate All</button>

      <div>
        <p>Total: {stats.total}</p>
        <p>Approved: {stats.approved}</p>
        <p>Avg Score: {stats.avgScore.toFixed(1)}/10</p>
      </div>

      {problems?.map(p => (
        <ProblemCard key={p.problem_id} problem={p} />
      ))}
    </div>
  );
}
```

## What You Get Automatically

### Context Variety

Every problem gets varied:
- **Objects**: "apple, desk, pencil, backpack"
- **Characters**: "Emma, Mr. Johnson, Sophia, Liam"
- **Scenarios**: "Morning circle time, Reading a story..."
- **Locations**: "classroom, library, playground..."

### Evaluation Scores

Each problem evaluated on:
- **Pedagogical Approach**: Teaching effectiveness
- **Alignment**: Match to learning objectives
- **Clarity**: Clear and understandable
- **Correctness**: Accurate content
- **Bias**: Fair and inclusive
- **Overall**: 0-10 score

### Recommendations

- ✅ **Approve**: Score ≥ 8.5 (85%)
- ⚠️ **Revise**: Score 6.0-8.5
- ❌ **Reject**: Score < 6.0

## Common Patterns

### Pattern 1: Generate → Auto-Evaluate → Review

```typescript
// One API call does it all
await generateMutation.mutateAsync({
  subskillId,
  request: {
    version_id: versionId,
    count: 10,
    auto_evaluate: true, // 👈 Enable this
  },
});

// Problems are generated AND evaluated
// Just review the results
const approved = problems.filter(p => p.evaluation?.final_recommendation === 'approve');
```

### Pattern 2: Generate → Manually Evaluate → Regenerate Bad Ones

```typescript
// Generate first
await generateMutation.mutateAsync({ ... });

// Evaluate later
await evaluateMutation.mutateAsync({ subskillId, versionId });

// Regenerate rejected
await regenerateMutation.mutateAsync({ subskillId, versionId });
```

### Pattern 3: Custom Prompt Override

```typescript
const customPrompt = `
You are creating math problems about addition.
Focus on real-world scenarios like shopping and cooking.
`;

await generateMutation.mutateAsync({
  subskillId,
  request: {
    version_id: versionId,
    count: 5,
    custom_prompt: customPrompt, // 👈 Override variety
  },
});
```

## Debugging

### Check if Variety is Working

```typescript
// After generation, inspect a problem
const problem = problems[0];
console.log(problem.generation_prompt);

// Should see something like:
// **Context Variety Guidelines**:
// **Objects to use**: teacher, log, wall, dish
// **Characters to feature**: David, Ms. Green, Lily, Tom
// ...
```

### Check Evaluation Results

```typescript
const problem = problems[0];
console.log({
  score: problem.evaluation?.overall_score,
  recommendation: problem.evaluation?.final_recommendation,
  feedback: problem.evaluation?.detailed_feedback,
  scores: {
    pedagogical: problem.evaluation?.pedagogical_approach_score,
    alignment: problem.evaluation?.alignment_score,
    clarity: problem.evaluation?.clarity_score,
  }
});
```

### Monitor Performance

```typescript
// Calculate stats
const stats = problems.reduce((acc, p) => {
  if (!p.evaluation) return acc;

  acc.total++;
  if (p.evaluation.final_recommendation === 'approve') acc.approved++;
  if (p.evaluation.final_recommendation === 'revise') acc.revise++;
  if (p.evaluation.final_recommendation === 'reject') acc.rejected++;
  acc.totalScore += p.evaluation.overall_score;

  return acc;
}, { total: 0, approved: 0, revise: 0, rejected: 0, totalScore: 0 });

console.log({
  approvalRate: (stats.approved / stats.total * 100).toFixed(1) + '%',
  avgScore: (stats.totalScore / stats.total).toFixed(1),
  breakdown: `${stats.approved} approved, ${stats.revise} revise, ${stats.rejected} rejected`,
});
```

## FAQs

### Q: Do I need to create a default template?
**A:** No! Context variety happens automatically.

### Q: Can I still use custom prompts?
**A:** Yes, pass `custom_prompt` parameter.

### Q: What if I want consistent prompts?
**A:** Create a custom template and activate it, or use `custom_prompt` parameter.

### Q: How do I know if prompts are high-quality?
**A:** Check `evaluation.overall_score`. Scores ≥ 8.5 are high-quality.

### Q: Where are the primitives stored?
**A:** In `problem.generation_prompt` and `problem.generation_metadata.primitives_used`.

### Q: Can I see what prompts work best?
**A:** Yes, filter problems by `evaluation.overall_score >= 8.5`.

## Migration from Old System

### Before (Required Template)
```typescript
// ❌ Old way - needed template
const { data: template } = useActivePrompt('default', 'problem_generation');

if (!template) {
  return <div>No template found!</div>;
}

await generateMutation.mutateAsync({ ... });
```

### After (No Template Needed)
```typescript
// ✅ New way - no template needed
await generateMutation.mutateAsync({
  subskillId,
  request: { version_id: versionId, count: 5 }
});
```

## Best Practices

1. **Always use auto_evaluate**: `auto_evaluate: true`
2. **Review scores regularly**: Filter by `overall_score >= 8.5`
3. **Regenerate bad ones**: Use batch regenerate for rejected problems
4. **Monitor variety**: Check that contexts are actually different
5. **Track performance**: Calculate approval rates over time

## Full Example

```typescript
import { useState } from 'react';
import {
  useGenerateProblems,
  useProblems,
  useBatchEvaluateProblems,
  useBatchRegenerateProblems,
} from '@/lib/curriculum-authoring/problems-hooks';
import { ProblemCard } from '@/components/curriculum-designer/problems/ProblemCard';

export function ProblemGenerator({ subskill, versionId }) {
  const [count, setCount] = useState(5);

  const generateMutation = useGenerateProblems();
  const evaluateMutation = useBatchEvaluateProblems();
  const regenerateMutation = useBatchRegenerateProblems();
  const { data: problems, isLoading } = useProblems(subskill.subskill_id, versionId);

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({
      subskillId: subskill.subskill_id,
      request: {
        version_id: versionId,
        count,
        auto_evaluate: true,
      },
    });
  };

  const handleEvaluate = async () => {
    await evaluateMutation.mutateAsync({
      subskillId: subskill.subskill_id,
      versionId,
    });
  };

  const handleRegenerate = async () => {
    await regenerateMutation.mutateAsync({
      subskillId: subskill.subskill_id,
      versionId,
    });
  };

  const stats = {
    total: problems?.length || 0,
    approved: problems?.filter(p => p.evaluation?.final_recommendation === 'approve').length || 0,
    rejected: problems?.filter(p => p.evaluation?.final_recommendation === 'reject').length || 0,
    avgScore: problems?.reduce((sum, p) => sum + (p.evaluation?.overall_score || 0), 0) / (problems?.length || 1),
  };

  return (
    <div>
      <h1>Generate Problems: {subskill.subskill_description}</h1>

      {/* Controls */}
      <div>
        <label>
          Count: {count}
          <input
            type="range"
            min="1"
            max="20"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>

        <button onClick={handleGenerate} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? 'Generating...' : `Generate ${count} Problems`}
        </button>
      </div>

      {/* Stats */}
      <div>
        <p>Total: {stats.total}</p>
        <p>Approved: {stats.approved} ({(stats.approved / stats.total * 100).toFixed(0)}%)</p>
        <p>Rejected: {stats.rejected}</p>
        <p>Avg Score: {stats.avgScore.toFixed(1)}/10</p>
      </div>

      {/* Actions */}
      <div>
        <button onClick={handleEvaluate} disabled={evaluateMutation.isPending}>
          Evaluate All
        </button>
        <button onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
          Regenerate Rejected
        </button>
      </div>

      {/* Problems */}
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {problems?.map(problem => (
            <ProblemCard
              key={problem.problem_id}
              problem={problem}
              subskillId={subskill.subskill_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Next Steps

1. ✅ Use existing `ProblemGenerationPanel` component (easiest)
2. 🔄 Or build custom UI with the hooks (more control)
3. 📊 Track approval rates over time
4. 🎯 Build prompt library from high-scoring prompts

---

**Ready to go!** Just import the components and start generating.
