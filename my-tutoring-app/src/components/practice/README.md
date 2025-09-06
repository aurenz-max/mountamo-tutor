# Unified Practice System Architecture

## Overview

This document describes the refactored practice system that provides a parsimonious, maintainable, and scalable integration of problem primitives across the tutoring application.

## Architecture Goals

✅ **Parsimonious**: Minimal code duplication, single source of truth
✅ **Maintainable**: Clear separation of concerns, consistent interfaces
✅ **Scalable**: Easy to add new primitives, extensible design

## Core Components

### 1. Problem Primitives (`/primitives/`)

**Purpose**: Individual UI components for different problem types
**Design**: "Dumb" components that only handle rendering and user interaction

#### Available Primitives
- `MCQPrimitive` - Multiple Choice Questions
- `FillInBlankPrimitive` - Fill-in-the-Blank questions
- `TrueFalsePrimitive` - True/False questions
- `MatchingPrimitive` - Concept matching
- `SequencingPrimitive` - Ordering/sequencing tasks
- `CategorizationPrimitive` - Category classification
- `ScenarioQuestionPrimitive` - Scenario-based questions
- `ShortAnswerPrimitive` - Short answer responses

#### Primitive Interface
```typescript
interface ProblemPrimitiveProps<TProblem, TResponse> {
  problem: TProblem;
  isSubmitted: boolean;
  currentResponse?: TResponse;
  feedback?: any;
  onUpdate: (response: TResponse) => void;
  disabled?: boolean;
  submitting?: boolean;
}
```

### 2. Problem Utilities (`/utils/problemUtils.ts`)

**Purpose**: Shared utilities for problem handling, type detection, and submission

#### Key Functions

**Problem Type Detection**
```typescript
detectProblemType(problem: GenericProblem): ProblemType
```
Automatically determines problem type from problem data structure.

**Generic Submission Handler**
```typescript
submitProblem(
  problem: GenericProblem,
  response: GenericResponse,
  context?: SubmissionContext
): Promise<SubmissionResult>
```
Unified submission logic that routes to appropriate API endpoints.

**Feedback Formatting**
```typescript
formatFeedback(review: any, problemType: ProblemType): FormattedFeedback
```
Standardizes feedback format across different problem types.

### 3. ProblemRenderer (`/ProblemRenderer.tsx`)

**Purpose**: Thin wrapper that orchestrates primitive rendering and submission

**Before (527 lines)**: Complex component with extensive submission logic
**After (150 lines)**: Clean wrapper that delegates to utilities

#### Key Improvements
- Removed 400+ lines of duplicated submission logic
- Unified error handling
- Consistent feedback display
- Easy to extend with new primitives

### 4. Integration Points

#### ProblemSet Component
- Uses ProblemRenderer with context
- Passes skill/subskill information for proper API routing
- Maintains existing navigation and progress tracking

#### PracticeContent Component
- Integrated ProblemRenderer with data format conversion
- Maintains package-specific features (AI hints, completion tracking)
- Preserves existing UI/UX patterns

## Data Flow

```
User Interaction → Primitive → ProblemRenderer → Utilities → API → Feedback → Primitive
```

1. **User interacts** with primitive component
2. **Primitive emits** response via `onUpdate`
3. **ProblemRenderer** receives response and calls utilities
4. **Utilities handle** type detection and API routing
5. **API returns** standardized feedback
6. **Feedback flows back** to primitive for display

## Benefits Achieved

### ✅ Parsimony
- **Single submission handler** instead of 8 separate implementations
- **Unified type detection** instead of scattered logic
- **Consistent feedback formatting** across all primitives

### ✅ Maintainability
- **Clear separation of concerns**: UI, logic, and data handling
- **Consistent interfaces**: All primitives follow same pattern
- **Centralized utilities**: Changes in one place affect all components

### ✅ Scalability
- **Add new primitives**: Just create component + add to type detection
- **Extend functionality**: Modify utilities without touching UI
- **API changes**: Update submission handler once for all primitives

## Usage Examples

### Adding a New Primitive

1. **Create the primitive component** following the interface
```typescript
const NewPrimitive: React.FC<NewPrimitiveProps> = ({
  problem, isSubmitted, currentResponse, feedback, onUpdate, disabled
}) => {
  // Implementation
};
```

2. **Add to type detection** in `problemUtils.ts`
```typescript
if (problem.new_field) return 'newType';
```

3. **Add submission logic** in `submitProblem` function
```typescript
case 'newType':
  // Handle new type submission
  break;
```

### Using in Components

```typescript
<ProblemRenderer
  problem={currentProblem}
  isSubmitted={isAnswered}
  onSubmit={handleSubmission}
  onUpdate={handleResponseUpdate}
  currentResponse={responses[currentIndex]}
  feedback={feedbacks[currentIndex]}
  context={{
    subject: 'mathematics',
    skill_id: currentProblem.skill_id,
    subskill_id: currentProblem.subskill_id,
    student_id: studentId
  }}
/>
```

## Migration Path

### Completed ✅
- Unified problem type detection
- Generic submission handler
- Refactored ProblemRenderer
- Updated ProblemSet integration
- PracticeContent integration framework

### Future Enhancements 🔄
- Complete PracticeContent data format alignment
- Add comprehensive error handling
- Implement loading states
- Add primitive-specific validation
- Create primitive testing utilities

## File Structure

```
src/components/practice/
├── primitives/
│   ├── index.ts              # Primitive exports
│   ├── types.ts              # Primitive interfaces
│   ├── MCQPrimitive.tsx      # Individual primitives
│   ├── FillInBlankPrimitive.tsx
│   └── ...
├── utils/
│   └── problemUtils.ts       # Shared utilities
├── ProblemRenderer.tsx       # Main renderer (refactored)
├── ProblemSet.tsx           # Practice page (updated)
└── README.md                # This documentation
```

## Conclusion

The refactored architecture achieves the goals of parsimony, maintainability, and scalability by:

1. **Centralizing logic** in reusable utilities
2. **Standardizing interfaces** across all components
3. **Separating concerns** between UI and business logic
4. **Providing clear extension points** for future development

This foundation makes it easy to maintain existing functionality while rapidly adding new features and primitives.