# Quest Generation Implementation

## Overview
This document describes the implementation of the generative quest card feature for Lumina Practice Mode, inspired by the vibe-coded app design.

## Features Implemented

### 1. **AI-Powered Quest Generation**
- Generates 4 personalized "learning quests" for each subject
- Each quest has:
  - Creative, adventure-themed title
  - Engaging description
  - Appropriate Lucide icon
  - Subject-specific focus area
  - Difficulty level (beginner/intermediate/advanced)

### 2. **Warm-Up Questions**
- Interactive warm-up question appears when a subject is selected
- Multiple choice format with instant feedback
- Includes a fun fact after answering
- Helps engage students before starting the main quest

### 3. **Modern UI Enhancements**

#### SpotlightCard Component
Located: `my-tutoring-app/src/components/lumina/components/SpotlightCard.tsx`

Features:
- **Glassmorphism effect** - Semi-transparent background with backdrop blur
- **Mouse-tracking spotlight** - Glowing effect that follows cursor position
- **Animated border glow** - Radial gradient border that responds to hover
- **Smooth transitions** - All interactions have polished 300ms transitions
- **Customizable colors** - RGB color prop for subject-specific theming

Technical Implementation:
```tsx
// The spotlight uses CSS custom properties and radial gradients
background: `radial-gradient(
  600px circle at ${position.x}px ${position.y}px,
  rgba(var(--glow-color), 0.15),
  transparent 40%
)`
```

### 4. **Enhanced Practice Workflow**

New 4-step flow:
1. **Setup** - Select subject, grade level, question count
2. **Quest Selection** - AI generates 4 quests, shows warm-up question
3. **Practice** - Complete problems for selected quest
4. **Results** - View AI-powered assessment and recommendations

## Architecture

### Service Layer
**File**: `my-tutoring-app/src/components/lumina/service/problems/quest-generator.ts`

Functions:
- `generateQuests()` - Generates quest cards using Gemini AI
- `generateWarmUpQuestion()` - Creates engaging warm-up questions
- Uses structured JSON output with schema validation
- Includes fallback data for error resilience

### API Routes
**File**: `my-tutoring-app/src/app/api/lumina/route.ts`

New endpoints:
- `POST /api/lumina` with `action: 'generateQuests'`
- `POST /api/lumina` with `action: 'generateWarmUpQuestion'`

### Client API Wrappers
**File**: `my-tutoring-app/src/components/lumina/service/geminiClient-api.ts`

Exports:
```typescript
export interface Quest {
  title: string;
  description: string;
  icon: string;
  focusArea: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export const generateQuests = async (
  subject: string,
  gradeLevel: string,
  count: number = 4
): Promise<Quest[]>

export const generateWarmUpQuestion = async (
  subject: string,
  gradeLevel: string
): Promise<WarmUpQuestion>
```

### UI Components

#### PracticeModeEnhanced
**File**: `my-tutoring-app/src/components/lumina/components/PracticeModeEnhanced.tsx`

Key features:
- Manages 4-step practice workflow
- Loads quests and warm-up in parallel using `Promise.all()`
- Integrates SpotlightCard for quest display
- Maintains original practice and results functionality
- Subject-specific color theming

#### SpotlightCard
**File**: `my-tutoring-app/src/components/lumina/components/SpotlightCard.tsx`

Props:
```typescript
interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
  color?: string; // RGB format: "255, 100, 50"
}
```

## Usage Example

```tsx
import { PracticeMode } from './components/PracticeModeEnhanced';

function App() {
  return (
    <PracticeMode onBack={() => console.log('Back clicked')} />
  );
}
```

## Subject Color Mapping

Each subject has a unique color theme:
- **Mathematics**: Sky blue (56, 189, 248)
- **Science**: Green (74, 222, 128)
- **Language Arts**: Purple (192, 132, 252)
- **Social Studies**: Yellow (250, 204, 21)
- **Reading**: Red (248, 113, 113)
- **Writing**: Violet (167, 139, 250)

## Quest Icon Mapping

Icons are emoji-based for universal compatibility:
- 🧬 DNA
- 🚀 Rocket
- 🧪 Flask
- 🌿 Leaf
- 🔢 Calculator
- 📐 Layers
- 🔍 Search
- 📊 Database
- ✨ Sparkles
- 🧠 Brain
- ⚡ Zap
- ⚛️ Atom
- 🔬 Microscope

## AI Prompt Design

### Quest Generation Prompt
The AI is instructed to:
- Create adventure-themed titles
- Focus on specific sub-topics within the subject
- Include appropriate difficulty progression
- Use relevant scientific/academic icon names
- Make quests feel like exploration journeys

### Warm-Up Question Prompt
The AI is instructed to:
- Create quick, engaging questions
- Spark curiosity about the subject
- Be age-appropriate for the grade level
- Include interesting fun facts

## Error Handling

All AI generation functions include:
1. **Try-catch blocks** for network/API errors
2. **Fallback data** - Predefined quests if AI fails
3. **User-friendly error messages** displayed in UI
4. **Console logging** for debugging

## Performance Optimizations

1. **Parallel Loading**: Quests and warm-up load simultaneously
2. **Lazy Imports**: API route imports services on demand
3. **React useEffect**: Triggers quest generation only when needed
4. **Skeleton Loading**: Shows animated placeholders while loading

## Future Enhancements

Potential improvements:
- [ ] Save favorite quests to user profile
- [ ] Track quest completion history
- [ ] Add quest difficulty badges
- [ ] Implement quest chaining (complete one to unlock next)
- [ ] Add quest rewards/achievements
- [ ] Generate quest-specific problem mixes (not just random types)
- [ ] Add quest preview mode
- [ ] Support custom user-created quests

## Testing

To test the implementation:

1. Start the dev server:
```bash
cd my-tutoring-app && npm run dev
```

2. Navigate to Lumina Practice Mode

3. Select a subject (e.g., "Science")

4. Observe:
   - Warm-up question appears
   - 4 AI-generated quest cards display
   - Hover effects work on cards
   - Clicking a quest starts practice session

## Files Modified/Created

### Created:
- `src/components/lumina/service/problems/quest-generator.ts`
- `src/components/lumina/components/SpotlightCard.tsx`
- `src/components/lumina/components/PracticeModeEnhanced.tsx`
- `src/components/lumina/docs/QUEST_GENERATION_IMPLEMENTATION.md`

### Modified:
- `src/app/api/lumina/route.ts` - Added quest generation endpoints
- `src/components/lumina/service/geminiClient-api.ts` - Added client wrappers
- `src/components/lumina/App.tsx` - Updated import to use PracticeModeEnhanced

## Dependencies

No new dependencies required! Uses existing:
- `@google/genai` - Already in use for Gemini AI
- `lucide-react` - Icons (referenced but uses emoji fallback)
- React hooks - useState, useEffect

## Credits

Design inspiration: Vibe-coded practice app with spotlight cards
Implementation: Following existing Lumina service patterns
