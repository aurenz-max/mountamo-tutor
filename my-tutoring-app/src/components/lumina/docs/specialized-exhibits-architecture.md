# Specialized Exhibits - Two-Step Architecture

## Overview

The specialized exhibits system has been refactored to use a **two-step generation approach** that separates planning from content creation. This allows us to use lightweight models for planning and powerful models (like `gemini-2.0-flash-thinking-exp-01-21`) for actual content generation.

## Architecture

### Step 1: Intent Generation (Lightweight)

The first LLM call uses `gemini-2.5-flash` to analyze the topic and generate **lightweight intents** that describe what specialized exhibits are needed.

**Input:**
- Topic string
- Educational context

**Output:**
- `specializedExhibitIntents[]` - Array of intent objects

**Intent Schema:**
```typescript
interface SpecializedExhibitIntent {
  id: string;              // Unique identifier (e.g., 'custom_web_1')
  type: 'sentence' | 'math-visual' | 'custom-svg' | 'custom-web';
  title: string;           // Title for the exhibit
  purpose: string;         // What this exhibit should demonstrate
  visualType?: string;     // Optional: For math-visual type
}
```

**Example Intent:**
```json
{
  "id": "custom_web_1",
  "type": "custom-web",
  "title": "Interactive Photosynthesis Simulator",
  "purpose": "Let students adjust light intensity and CO2 levels to see how they affect photosynthesis rate"
}
```

### Step 2: Content Generation (Powerful Model)

Each intent is then processed by a dedicated generator function that uses `gemini-2.0-flash-thinking-exp-01-21` with high thinking levels to create rich, interactive content.

**Generators:**

1. **`generateCustomWebExhibit()`**
   - Creates complete self-contained HTML documents
   - Uses temperature: 1.0 for creativity
   - Max tokens: 15,000
   - Includes full pedagogical guidelines in prompt

2. **`generateCustomSVGExhibit()`**
   - Creates SVG diagrams with educational styling
   - Uses temperature: 0.8
   - Max tokens: 8,000

3. **`generateSentenceExhibit()`**
   - Creates sentence diagrams for grammar
   - Uses structured JSON schema
   - Temperature: 0.7

4. **`generateMathVisualExhibit()`**
   - Creates data for math visualization primitives
   - Dynamic schema based on visualType
   - Temperature: 0.7

## Benefits

### 1. **Reduced Token Usage in Step 1**
The initial LLM call is much lighter because it doesn't need to include:
- Full HTML generation guidelines
- CSS styling specifications
- Interactive JavaScript examples
- Detailed pedagogical principles

### 2. **Higher Quality Content in Step 2**
Each specialized exhibit type gets:
- Dedicated prompts optimized for that content type
- More powerful model with thinking capabilities
- Higher token limits for complex content
- Type-specific validation

### 3. **Better Separation of Concerns**
- Planning (what to create) is separate from creation (how to create it)
- Easier to debug and improve individual generators
- Can swap models per exhibit type as needed

### 4. **Parallel Generation (Future)**
Intents can be generated in parallel since they're independent:
```typescript
const exhibits = await Promise.all(
  intents.map(intent => generateExhibit(intent, topic))
);
```

## Code Flow

```typescript
// Step 1: Generate exhibit structure with intents
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Create exhibit with specializedExhibitIntents...",
  config: { responseSchema: exhibitSchema }
});

const exhibitData = JSON.parse(response.text);

// Step 2: Generate actual content from intents
if (exhibitData.specializedExhibitIntents?.length > 0) {
  const specializedExhibits = await generateSpecializedExhibits(
    exhibitData.specializedExhibitIntents,
    topic
  );
  exhibitData.specializedExhibits = specializedExhibits;
  delete exhibitData.specializedExhibitIntents; // Clean up
}
```

## Frontend Integration

The frontend components remain unchanged - they still consume `specializedExhibits[]`:

```tsx
{exhibitData.specializedExhibits?.map((exhibit, index) => {
  switch (exhibit.type) {
    case 'sentence':
      return <SentenceAnalyzer key={index} data={exhibit} />;
    case 'math-visual':
      return <MathVisuals key={index} data={exhibit} />;
    case 'custom-svg':
    case 'custom-web':
      return <CustomVisual key={index} data={exhibit} />;
    default:
      return null;
  }
})}
```

## File Structure

```
my-tutoring-app/src/components/lumina/
├── types.ts                      # TypeScript interfaces
│   ├── SpecializedExhibitIntent  # Step 1 schema
│   └── SpecializedExhibit        # Step 2 output types
│
├── service/geminiService.ts      # Generation logic
│   ├── generateExhibitContent()           # Main function
│   ├── generateCustomWebExhibit()         # HTML generator
│   ├── generateCustomSVGExhibit()         # SVG generator
│   ├── generateSentenceExhibit()          # Sentence diagram
│   ├── generateMathVisualExhibit()        # Math visual data
│   └── generateSpecializedExhibits()      # Orchestrator
│
└── primitives/                   # React components
    ├── CustomVisual.tsx          # Renders custom-web/custom-svg
    ├── MathVisuals.tsx           # Renders math-visual
    └── SentenceAnalyzer.tsx      # Renders sentence
```

## Future Enhancements

1. **Caching:** Cache generated exhibits by intent hash
2. **Streaming:** Stream exhibit generation progress to UI
3. **Parallel Generation:** Generate multiple exhibits concurrently
4. **A/B Testing:** Test different models per exhibit type
5. **User Feedback:** Allow regeneration of specific exhibits
6. **Version Control:** Track which model/prompt generated each exhibit

## Model Selection Rationale

### Step 1: `gemini-2.5-flash`
- Fast response time for planning
- Good at structured output with schemas
- Cost-effective for high-frequency calls
- Sufficient for intent classification

### Step 2: `gemini-2.0-flash-thinking-exp-01-21`
- Deep thinking for complex content
- Better at creative HTML/SVG generation
- Higher quality interactive experiences
- Worth the extra cost for final output

## Migration Notes

**Before:** One LLM call with massive prompt including all guidelines
**After:** Small planning call + dedicated content generation calls

**Breaking Changes:** None - frontend components unchanged

**New Dependencies:** None - uses existing Gemini SDK

**Performance:** Slightly slower (2 API calls vs 1) but higher quality output
