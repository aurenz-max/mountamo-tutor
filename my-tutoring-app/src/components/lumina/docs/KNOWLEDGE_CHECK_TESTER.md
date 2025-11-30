# Knowledge Check Problem Tester (AI-Powered)

## Overview

The Knowledge Check Problem Tester is an AI-powered testing tool that uses Gemini to generate and preview specific problem types for rapid iteration and testing. This tool integrates the same LLM generation system used in the main Lumina product, allowing you to quickly create realistic problems for testing.

## Accessing the Tester

1. Navigate to the Lumina app home screen
2. Look for the "Testing Tools" section
3. Click the **"📝 Test Knowledge Check Problems"** button

## Features

### AI-Powered Generation

Instead of manually filling out forms, the tester uses AI to generate complete, high-quality problems based on your specifications:

- **Topic-Based**: Enter any topic (e.g., "Photosynthesis", "Fractions")
- **Context-Aware**: Add optional context for more targeted problems
- **Grade-Level Adaptive**: Automatically adjusts language and complexity
- **Bulk Generation**: Generate 1-10 problems at once

### Two-Panel Interface

- **Left Panel (Generator)**: Configure and generate problems using AI
- **Right Panel (Preview)**: See live rendering of generated problems

### Currently Available Generators

4 problem types with AI generation:

1. **Multiple Choice** ✅ - 4-option questions with rationale
2. **True/False** ✅ - Statements with explanations
3. **Categorization Activity** ✅ - Sort items into categories
4. **Sequencing Activity** ✅ - Order items correctly

### Coming Soon

4 additional generators in development:

5. **Fill in Blanks** 🚧
6. **Matching Activity** 🚧
7. **Scenario Question** 🚧
8. **Short Answer** 🚧

## Usage Guide

### Basic Workflow

1. **Enter Topic**: Type a topic like "Photosynthesis" or "The Solar System"
2. **Select Problem Type**: Choose from available generators
3. **Set Grade Level**: Choose from Toddler to PhD
4. **Set Count**: How many problems to generate (1-10)
5. **Click Generate**: AI creates problems instantly

### Action Buttons

- **Generate & Preview**: Replace current preview with new problems
- **Add to List**: Append new problems to existing collection
- **Clear**: Remove all problems from preview

### Quick Topics

Click any suggested topic to auto-fill:
- Photosynthesis
- Fractions
- Solar System
- Water Cycle
- Grammar Rules
- Cell Structure

## Example Usage

### Testing a Single Problem Type

```
Topic: "Photosynthesis"
Grade Level: Elementary
Problem Type: Multiple Choice
Count: 3
```

Click "Generate & Preview" → Instantly see 3 AI-generated multiple choice questions about photosynthesis, adapted for elementary students.

### Testing Mixed Problem Types

1. Generate 2 True/False problems on "Water Cycle" → Click "Add to List"
2. Switch to Multiple Choice → Generate 2 problems → Click "Add to List"
3. Switch to Sequencing → Generate 1 problem → Click "Add to List"
4. Preview shows all 5 problems together as they would appear in an assessment

### Testing Grade-Level Adaptation

Same topic, different grade levels:
1. Set to "Preschool" → Generate problems → See simple language
2. Set to "High School" → Generate problems → See advanced vocabulary
3. Compare how AI adapts content complexity

## AI Generation Features

### Automatic Quality Features

All AI-generated problems include:
- **Appropriate Difficulty**: Easy, Medium, or Hard progression
- **Educational Rationale**: Clear explanations of correct answers
- **Teaching Notes**: Pedagogical guidance for educators
- **Success Criteria**: Learning objectives being assessed
- **Grade-Level Language**: Vocabulary adapted to student age

### Multiple Choice Specific
- 4 well-crafted options (A, B, C, D)
- Plausible distractors based on common misconceptions
- Randomized correct answer positions
- Detailed rationale explaining why the answer is correct

### True/False Specific
- Clear, unambiguous statements
- Natural mix of true and false
- Explanations address misconceptions
- No trick questions or wordplay

### Categorization Specific
- Logical category groupings
- Clear categorization criteria
- Mixed difficulty items

### Sequencing Specific
- Process-based or chronological ordering
- 3-6 items per sequence
- Clear logical progression

## Tips for Effective Testing

### 1. Start Simple
- Test one problem type at a time
- Use familiar topics first
- Verify output quality before bulk generation

### 2. Iterate Quickly
- Use "Generate & Preview" for rapid iteration
- Try different topics to test variety
- Adjust grade level to test adaptation

### 3. Test Edge Cases
- Very simple topics (colors, shapes)
- Very complex topics (quantum mechanics)
- Different grade levels for same topic
- Different problem counts

### 4. Build Test Suites
- Use "Add to List" to build multi-problem assessments
- Mix problem types to test variety
- Test problem flow and progression

## Troubleshooting

### Generator Not Available

If you see "Coming Soon" or generator is disabled:
- Problem type doesn't have AI generator yet
- Try Multiple Choice, True/False, Categorization, or Sequencing
- Manual form-based entry coming in future update

### Generation Failed

If generation fails:
- Check internet connection
- Verify `NEXT_PUBLIC_GEMINI_API_KEY` is set
- Try a simpler topic
- Reduce problem count
- Check browser console for errors

### Poor Quality Output

If generated problems aren't good:
- Add more context in the Context field
- Try a more specific topic
- Adjust grade level
- Regenerate (AI is non-deterministic)

### Slow Generation

Generation typically takes 2-5 seconds:
- More problems = longer wait
- Complex topics may take longer
- First generation may be slower (model warmup)

## Integration with Development

### Before Backend Integration

Use the tester to:
- Validate AI generation quality
- Test problem rendering
- Verify data structure compatibility
- Design UI/UX for problem display

### After Backend Integration

Use the tester to:
- Compare frontend vs backend output
- Test specific problem configurations
- Debug rendering issues
- Create test fixtures

## Technical Details

### Data Flow

```
User Input (Topic, Grade, Type)
  ↓
Gemini API Call (geminiService.ts)
  ↓
JSON Response (Structured Output)
  ↓
Type Validation (TypeScript)
  ↓
KnowledgeCheck Component
  ↓
Problem Renderer (Registry Pattern)
```

### Generator Functions

Located in `service/geminiService.ts`:
- `generateMultipleChoiceProblems()`
- `generateTrueFalseProblems()`
- `generateCategorizationProblems()`
- `generateSequencingProblems()`

### Output Format

All generators return arrays of problems matching the type definitions in `types.ts`:

```typescript
{
  type: 'multiple_choice',
  id: 'mc_1',
  difficulty: 'medium',
  gradeLevel: 'elementary',
  question: '...',
  options: [...],
  correctOptionId: 'B',
  rationale: '...',
  teachingNote: '...',
  successCriteria: [...]
}
```

## Keyboard Shortcuts

- **Enter**: Submit in topic field
- **Tab**: Navigate between fields
- **Ctrl/Cmd + Click**: On quick topics for immediate generation

## Comparison to Manual Entry

| Feature | AI Generator | Manual Forms |
|---------|-------------|--------------|
| Speed | ⚡ Instant (2-5s) | 🐌 Slow (1-2 min) |
| Quality | 🎯 Consistent | 🎲 Variable |
| Variety | 🌈 High | 📏 Limited |
| Scale | 📊 1-10 at once | 1️⃣ One at a time |
| Realism | ✅ Production-quality | ⚠️ Test-only |

## Future Enhancements

Planned features:
- [ ] Remaining 4 problem type generators
- [ ] Visual primitive integration
- [ ] Save/export problem sets
- [ ] Import from backend API
- [ ] Custom difficulty targeting
- [ ] Topic suggestions based on curriculum
- [ ] Problem history and favorites

## Related Documentation

- [KNOWLEDGE_CHECK_QUICK_START.md](./KNOWLEDGE_CHECK_QUICK_START.md) - Quick start guide
- [KNOWLEDGE_CHECK_SYSTEM.md](./KNOWLEDGE_CHECK_SYSTEM.md) - Full system documentation
- [MULTIPLE_CHOICE_GENERATION.md](./MULTIPLE_CHOICE_GENERATION.md) - Generation methodology
- [../service/geminiService.ts](../service/geminiService.ts) - Generator implementation
