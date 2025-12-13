# AI Helper Guide

## Overview

The AI Helper is an intelligent tutoring assistant that provides progressive hints to students during practice sessions without revealing the answer. It's designed to guide students toward understanding concepts rather than simply giving them answers.

## Features

### 3-Level Hint System

The AI Helper offers three progressive levels of assistance:

1. **Small Hint (Level 1)** 💡
   - A gentle nudge in the right direction
   - Highlights one key concept to think about
   - 2-3 sentences maximum
   - Doesn't explain the concept fully

2. **Medium Hint (Level 2)** 🔍
   - More specific guidance on the concept
   - Explains relevant concepts more clearly
   - May include analogies or related examples
   - 3-4 sentences
   - Still doesn't solve the problem

3. **Big Hint (Level 3)** 🎯
   - Detailed explanation without the answer
   - Thorough walkthrough of concepts and thinking process
   - May explain why certain options might be wrong or right
   - 4-6 sentences
   - Never directly states which answer is correct

## How It Works

### Student Experience

1. **Access**: Students see a floating "Need Help?" button in the bottom-right corner during practice
2. **Request Hint**: Click the button to open the AI Helper panel
3. **Choose Level**: Select from Small, Medium, or Big hint levels
4. **Review Guidance**: Read the AI-generated hint tailored to the current problem
5. **Progressive Support**: Can unlock higher hint levels if still stuck
6. **Encouragement**: Receives positive reinforcement to try solving with current knowledge

### Technical Implementation

```typescript
// Component Usage
<AIHelper
  problem={currentProblem}
  onRequestHint={handleRequestHint}
/>

// Hint Generation Handler
const handleRequestHint = async (hintLevel: number): Promise<string> => {
  return await generateProblemHint(currentProblem, hintLevel);
};
```

### Hint Generation Process

1. **Context Assembly**: Combines problem question, options, grade level, and difficulty
2. **AI Prompting**: Uses carefully crafted prompts that instruct the AI to:
   - Guide without revealing answers
   - Explain concepts clearly
   - Use encouraging language
   - Adapt to the requested hint level
3. **Response**: Returns a focused, educational hint

## Integration Points

### Files Modified/Created

1. **`components/AIHelper.tsx`** - Main helper UI component
2. **`components/PracticeMode.tsx`** - Integration into practice flow
3. **`service/geminiClient-api.ts`** - Client-side API wrapper
4. **`service/problems/hint-generator.ts`** - Hint generation logic (NEW)
5. **`app/api/lumina/route.ts`** - API endpoint handler

### API Endpoint

```typescript
POST /api/lumina
{
  "action": "generateProblemHint",
  "params": {
    "problem": ProblemData,
    "hintLevel": 1 | 2 | 3
  }
}
```

## Design Principles

### Educational Philosophy

- **Socratic Method**: Guide students to discover answers themselves
- **Progressive Disclosure**: Start with minimal help, escalate as needed
- **Conceptual Focus**: Emphasize understanding over memorization
- **Positive Reinforcement**: Encourage effort and persistence

### AI Safety Rules

The AI is explicitly instructed to:
- ✅ Guide thinking about relevant concepts
- ✅ Explain why to consider certain aspects
- ✅ Use encouraging, supportive language
- ✅ Be concise and focused
- ❌ Never reveal the correct answer
- ❌ Never state which option is correct

## UI/UX Features

### Visual Design

- **Floating Button**: Non-intrusive, always accessible
- **Gradient Theme**: Indigo-to-purple gradient matching the app's aesthetic
- **Pulse Animation**: Subtle attention-grabbing effect
- **Panel Layout**: Clean, organized presentation of hints and options

### State Management

- **Hint Caching**: Previously unlocked hints are stored and can be re-viewed
- **Loading States**: Clear feedback during AI generation
- **Error Handling**: Graceful fallback with retry options
- **Progress Indicators**: Shows which hints have been unlocked

### Responsive Behavior

- Fixed positioning for easy access
- Collapsible panel to maximize workspace
- Smooth animations for open/close transitions
- Mobile-friendly touch targets

## Best Practices

### For Students

1. Try solving the problem first before requesting hints
2. Start with the smallest hint level
3. Take time to understand each hint before moving to the next level
4. Use hints to learn concepts, not just to get answers

### For Educators

1. Monitor hint usage patterns to identify struggling concepts
2. Review AI-generated hints for quality and appropriateness
3. Adjust problem difficulty based on hint usage statistics
4. Supplement with additional resources when hints are frequently needed

## Future Enhancements

Potential improvements to consider:

1. **Hint History**: Track which hints helped most for analytics
2. **Adaptive Difficulty**: Adjust problem difficulty based on hint usage
3. **Concept Mapping**: Link hints to specific curriculum standards
4. **Personalization**: Remember student preferences for hint style
5. **Multilingual Support**: Generate hints in multiple languages
6. **Voice Mode**: Audio hints for accessibility
7. **Collaborative Hints**: AI suggests peer collaboration when appropriate

## Troubleshooting

### Common Issues

**Hint not generating**
- Check API connectivity
- Verify Gemini AI credentials
- Check browser console for errors

**Inappropriate hints**
- Review AI prompts in `service/problems/hint-generator.ts`
- Adjust hint level descriptions
- Report issues for prompt refinement

**Performance issues**
- Implement hint caching
- Add request debouncing
- Consider server-side caching for common problems

## Code Examples

### Custom Hint Generation

```typescript
// Import from the problems service
import { generateProblemHint } from '@/components/lumina/service/problems/hint-generator';

// Generate a hint with custom parameters
const customHint = await generateProblemHint(
  {
    ...problem,
    question: "Modified question",
    gradeLevel: "middle-school"
  },
  2 // Medium hint level
);
```

### Extending Hint Levels

```typescript
// Add a new hint level
const hintLevelDescriptions = {
  1: "Small hint...",
  2: "Medium hint...",
  3: "Big hint...",
  4: "Extra help..." // New level
};
```

## Support

For issues or questions about the AI Helper:
- Check the console logs for error messages
- Review the hint generation prompts in `service/problems/hint-generator.ts`
- Test with different problem types to ensure compatibility
- Verify that the Gemini AI service is properly configured

---

Built with ❤️ for better learning experiences
