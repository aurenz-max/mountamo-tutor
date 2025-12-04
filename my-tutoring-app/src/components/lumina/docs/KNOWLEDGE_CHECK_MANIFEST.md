# Knowledge Check in Manifest-First Architecture

This guide shows how to use the Knowledge Check system with the manifest-first architecture.

## Quick Start

Add a knowledge check to your manifest by specifying the problem type in the `config`:

```typescript
const manifest: ExhibitManifest = {
  topic: "Photosynthesis",
  gradeLevel: "elementary",
  themeColor: "#10b981",
  layout: [
    {
      componentId: 'knowledge-check',
      instanceId: 'kc_1',
      title: 'Test Your Understanding',
      intent: 'Assess understanding of photosynthesis process',
      config: {
        problemType: 'matching_activity',  // Specify the type!
        count: 1,
        difficulty: 'medium',
        gradeLevel: 'elementary'
      }
    }
  ]
};
```

## Available Problem Types

| Problem Type | Best For | Complexity |
|-------------|----------|-----------|
| `multiple_choice` | Concept assessment, comprehension testing | Medium |
| `true_false` | Quick fact checking, misconception identification | Simple |
| `fill_in_blanks` | Vocabulary practice, key term recall | Simple |
| `matching_activity` | Building relationships, connecting concepts | Complex |
| `sequencing_activity` | Process understanding, chronological ordering | Simple |
| `categorization_activity` | Classification skills, grouping by attributes | Complex |
| `scenario_question` | Real-world application, critical thinking | Complex |
| `short_answer` | Open-ended responses, explanation practice | Simple |

## Configuration Options

### Required Fields

```typescript
{
  componentId: 'knowledge-check',
  instanceId: string,  // Unique ID (e.g., 'kc_1')
  title: string,       // Display title
  intent: string,      // What to assess (used as context for LLM)
  config: {
    problemType: ProblemType  // The type of problem to generate
  }
}
```

### Optional Fields

```typescript
config: {
  problemType: 'matching_activity',
  count?: number,           // Default: 1
  difficulty?: string,      // 'easy' | 'medium' | 'hard'
  gradeLevel?: string,      // Overrides manifest gradeLevel
  context?: string          // Additional context (defaults to intent)
}
```

## Examples

### Example 1: Matching Activity

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_scientists',
  title: 'Match Scientists to Their Discoveries',
  intent: 'Test knowledge of famous scientists and their contributions',
  config: {
    problemType: 'matching_activity',
    count: 1,
    difficulty: 'medium'
  }
}
```

**Generated Output:**
- Left column: Scientists (Newton, Curie, Einstein, etc.)
- Right column: Their discoveries
- Student drags to match them

### Example 2: True/False Warm-up

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_warmup',
  title: 'Quick Facts Check',
  intent: 'Review basic plant biology facts',
  config: {
    problemType: 'true_false',
    count: 4,          // Generate 4 T/F statements
    difficulty: 'easy',
    gradeLevel: 'elementary'
  }
}
```

**Generated Output:**
- 4 true/false statements about plants
- Mix of true and false
- Educational rationales for each

### Example 3: Fill in Blanks

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_vocab',
  title: 'Complete the Sentences',
  intent: 'Test key vocabulary: chlorophyll, glucose, oxygen',
  config: {
    problemType: 'fill_in_blanks',
    count: 2,
    difficulty: 'medium'
  }
}
```

**Generated Output:**
- Sentences with blanks: "Plants use [blank_1] to make [blank_2]"
- Word bank with correct answers + distractors
- Drag-and-drop interface

### Example 4: Multiple Choice

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_concepts',
  title: 'Check Your Understanding',
  intent: 'Assess comprehension of water cycle stages',
  config: {
    problemType: 'multiple_choice',
    count: 3,
    difficulty: 'medium'
  }
}
```

**Generated Output:**
- 3 multiple choice questions
- 4 options each (A, B, C, D)
- Detailed rationales
- Teaching notes for educators

### Example 5: Categorization

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_classify',
  title: 'Sort the Animals',
  intent: 'Classify animals by habitat: ocean, desert, forest',
  config: {
    problemType: 'categorization_activity',
    count: 1,
    difficulty: 'easy'
  }
}
```

**Generated Output:**
- 3 categories (ocean, desert, forest)
- 8-10 animals to sort
- Drag-and-drop into correct categories

### Example 6: Sequencing

```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_order',
  title: 'Put in Order',
  intent: 'Arrange butterfly life cycle stages',
  config: {
    problemType: 'sequencing_activity',
    count: 1,
    difficulty: 'easy',
    gradeLevel: 'elementary'
  }
}
```

**Generated Output:**
- Life cycle stages scrambled
- Student drags to reorder
- Checks if sequence is correct

## Multiple Knowledge Checks

You can include multiple knowledge checks in one manifest for scaffolded assessment:

```typescript
const manifest: ExhibitManifest = {
  topic: "The Solar System",
  gradeLevel: "middle-school",
  themeColor: "#3b82f6",
  layout: [
    // ... intro, concept cards, etc ...

    // Warm-up with easy T/F
    {
      componentId: 'knowledge-check',
      instanceId: 'kc_warmup',
      title: 'Quick Facts',
      intent: 'Review basic solar system facts',
      config: {
        problemType: 'true_false',
        count: 3,
        difficulty: 'easy'
      }
    },

    // Core assessment with MC
    {
      componentId: 'knowledge-check',
      instanceId: 'kc_core',
      title: 'Understanding Planets',
      intent: 'Test planet characteristics and positions',
      config: {
        problemType: 'multiple_choice',
        count: 2,
        difficulty: 'medium'
      }
    },

    // Challenge with matching
    {
      componentId: 'knowledge-check',
      instanceId: 'kc_challenge',
      title: 'Match Planets to Features',
      intent: 'Connect planets with their unique characteristics',
      config: {
        problemType: 'matching_activity',
        count: 1,
        difficulty: 'hard'
      }
    }
  ]
};
```

This creates a progression: easy → medium → hard, using different problem types to maintain engagement.

## How It Works

### Phase 1: Manifest Parsing

When the manifest builder encounters a `knowledge-check` component:

1. Reads the `config.problemType`
2. Extracts `count`, `difficulty`, and other parameters
3. Calls `generateKnowledgeCheckContent()` with this config

### Phase 2: Problem Generation

The generator routes to the appropriate problem type generator:

```typescript
// Simplified internal flow
const generator = {
  'multiple_choice': generateMultipleChoiceProblems,
  'true_false': generateTrueFalseProblems,
  'fill_in_blanks': generateFillInBlanksProblems,
  'matching_activity': generateMatchingProblems,
  'sequencing_activity': generateSequencingProblems,
  'categorization_activity': generateCategorizationProblems,
  // ... etc
}[problemType];

const problems = await generator(topic, gradeLevel, count, context);
```

### Phase 3: Rendering

The `KnowledgeCheck` component receives `{ problems }` and uses the problem registry to render each type:

```typescript
<KnowledgeCheck data={{ problems }} />
```

The registry automatically maps each problem type to its component:
- `matching_activity` → `<MatchingActivityProblem />`
- `multiple_choice` → `<MultipleChoiceProblem />`
- etc.

## Backwards Compatibility

If you don't specify `config.problemType`, the system falls back to the legacy single multiple-choice format with visual primitives.

**Legacy format (still works):**
```typescript
{
  componentId: 'knowledge-check',
  instanceId: 'kc_1',
  title: 'Quiz',
  intent: 'Test understanding'
  // No config.problemType specified
}
```

This generates a single multiple-choice question with optional visual primitives (object collections, comparison panels, etc.).

## Best Practices

### 1. Match Problem Type to Learning Objective

- **Factual recall** → `true_false`, `fill_in_blanks`
- **Comprehension** → `multiple_choice`
- **Relationships** → `matching_activity`
- **Processes** → `sequencing_activity`
- **Classification** → `categorization_activity`
- **Application** → `scenario_question`

### 2. Scaffold Difficulty

Start with easier problem types (T/F, sequencing) before harder ones (matching, categorization).

### 3. Use Appropriate Counts

- **Simple types** (T/F, sequencing): 3-5 problems works well
- **Complex types** (matching, categorization): 1-2 problems is enough
- **Medium complexity** (MC, fill-in-blanks): 2-3 problems

### 4. Provide Clear Intent

The `intent` field is used as context for the LLM. Be specific:

**Good:**
```typescript
intent: 'Test understanding of photosynthesis inputs (water, CO2, sunlight) and outputs (glucose, oxygen)'
```

**Less good:**
```typescript
intent: 'Test photosynthesis'
```

### 5. Use Grade-Appropriate Difficulty

```typescript
// Elementary
config: { problemType: 'matching_activity', count: 1, difficulty: 'easy' }

// Middle School
config: { problemType: 'matching_activity', count: 1, difficulty: 'medium' }

// High School
config: { problemType: 'matching_activity', count: 1, difficulty: 'hard' }
```

## Coming Soon

These problem types are defined in the schema but not yet implemented:

- `scenario_question` - Real-world application scenarios
- `short_answer` - Open-ended short responses

The infrastructure is ready; just need to add the generator functions (see `generateMatchingProblems` as a template).

## Summary

The manifest-first knowledge check system gives you:

✅ **Direct control** - Specify exactly what problem type you want
✅ **Simplicity** - One config parameter (`problemType`)
✅ **Flexibility** - Mix multiple problem types in one exhibit
✅ **Quality** - Each generator uses specialized prompts for that type
✅ **Consistency** - All problems follow the same registry architecture

Just add `problemType` to your knowledge check config and let the system handle the rest!
