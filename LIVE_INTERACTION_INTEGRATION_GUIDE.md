# Live Interaction Problem Type - Frontend Integration Guide

## Overview

The `live_interaction` problem type is a new interactive problem format that combines:
- **Real-time AI tutoring** via Gemini Live (audio + WebSocket)
- **Visual interactive elements** (clickable cards, draggable objects, etc.)
- **Immediate feedback** with visual effects and audio responses
- **Standard submission flow** for grading and competency tracking

This problem type is **fully integrated** into your existing submission service, universal validator, and review components as of this implementation.

---

## 🎯 What is a Live Interaction Problem?

A live_interaction problem presents students with a visual scene (e.g., a grid of shape cards) and asks them to interact with it (click, drag, trace, or speak) to answer a question. An AI tutor guides them through voice, providing hints and encouragement.

### Key Features
- **Multimodal interaction**: Students can click targets, speak answers, drag items, or trace shapes
- **AI-powered guidance**: Gemini Live provides real-time voice tutoring throughout the session
- **Immediate visual feedback**: Correct answers trigger success animations, incorrect ones show hints
- **Integrated grading**: Submissions are validated and scored just like any other problem type

---

## 📦 Backend Integration (Already Complete)

The backend now fully supports `live_interaction`:

### ✅ What's Already Done
1. **QuestionType enum** extended with `LIVE_INTERACTION` ([question_types.py:15](backend/app/shared/question_types.py#L15))
2. **LiveInteractionQuestion** and **LiveInteractionResponse** classes created ([question_types.py:81-87, 141-144](backend/app/shared/question_types.py#L81-L144))
3. **Problem Converter** handles conversion from raw live_interaction data ([problem_converter.py:428-472](backend/app/services/problem_converter.py#L428-L472))
4. **Universal Validator** validates submissions and returns feedback ([universal_validator.py:688-750](backend/app/services/universal_validator.py#L688-L750))
5. **All problem_types lists updated** across services
6. **Test suite created** for validation ([test_live_interaction_validation.py](backend/tests/test_live_interaction_validation.py))

### 🔌 API Endpoints

#### Generate Live Interaction Problem
```http
POST /api/problems/generate
Content-Type: application/json

{
  "subject": "math",
  "skill_id": "shape_recognition",
  "subskill_id": "identify_circles",
  "count": 1
}
```

**Response includes:**
```json
{
  "problem_type": "live_interaction",
  "id": "live_int_001",
  "prompt": {
    "system": "You are a helpful tutor...",
    "first_message": "Can you click on the circle?",
    "session_intro": "Let's practice identifying shapes!"
  },
  "visual_content": {
    "type": "card-grid",
    "data": {
      "cards": [
        {"id": "shape_1", "shape": "circle", "color": "red"},
        {"id": "shape_2", "shape": "square", "color": "blue"}
      ]
    }
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {
        "id": "shape_1",
        "is_correct": true,
        "description": "Red circle"
      },
      {
        "id": "shape_2",
        "is_correct": false,
        "description": "Blue square"
      }
    ]
  },
  "evaluation": {
    "success_criteria": ["Correctly identify the circle"],
    "feedback": {
      "correct": {
        "audio": "Great job! That's the circle!",
        "visual_effect": "success_animation"
      },
      "incorrect": {
        "audio": "Not quite. Look for the round shape!",
        "hint": "A circle is round with no corners.",
        "visual_effect": "try_again"
      }
    }
  }
}
```

#### Submit Live Interaction Answer
```http
POST /api/problems/submit
Content-Type: application/json

{
  "problem": { /* full problem object */ },
  "student_answer": "shape_1",
  "primitive_response": {
    "selected_target_id": "shape_1",
    "interaction_mode": "click"
  },
  "subject": "math",
  "skill_id": "shape_recognition",
  "subskill_id": "identify_circles",
  "canvas_used": false
}
```

**Response:**
```json
{
  "review": {
    "score": 10.0,
    "correct": true,
    "feedback": "Great job! That's the circle!",
    "student_answer": "Selected: shape_1",
    "correct_answer": "Correct target(s): shape_1",
    "detailed_results": {
      "selected_target_id": "shape_1",
      "target_description": "Red circle",
      "is_target_correct": true,
      "visual_effect": "success_animation",
      "interaction_mode": "click"
    }
  },
  "competency": { /* standard competency update */ },
  "points": 10,
  "engagement": { /* XP and streak data */ }
}
```

---

## 🎨 Frontend Implementation Guide

### 1. Problem Rendering

The `ProblemRenderer` component already routes `live_interaction` to the `ComposableProblemComponent`:

**Location:** [my-tutoring-app/src/components/practice/ProblemRenderer.tsx:146-147](my-tutoring-app/src/components/practice/ProblemRenderer.tsx#L146-L147)

```typescript
case 'live_interaction':
  return 'liveInteraction';

// Then renders with:
case 'liveInteraction':
case 'composable':
  return <ComposableProblemComponent ... />
```

### 2. Creating a Live Interaction Component

You should create a dedicated component for live_interaction problems:

**Recommended location:** `my-tutoring-app/src/components/practice/LiveInteractionProblem.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface LiveInteractionProblemProps {
  problem: LiveInteractionProblem;
  onUpdate: (response: any) => void;
  isSubmitted: boolean;
  feedback?: any;
  currentResponse?: any;
}

const LiveInteractionProblem: React.FC<LiveInteractionProblemProps> = ({
  problem,
  onUpdate,
  isSubmitted,
  feedback,
  currentResponse
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const handleTargetClick = (targetId: string) => {
    if (isSubmitted) return; // Don't allow changes after submission

    setSelectedTarget(targetId);

    // Update parent with response data
    onUpdate({
      selected_target_id: targetId,
      interaction_mode: problem.interaction_config.mode
    });
  };

  return (
    <div className="live-interaction-container">
      {/* Question Text */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold">{problem.prompt.first_message}</h2>
      </div>

      {/* Visual Content Renderer */}
      <VisualContentRenderer
        visualContent={problem.visual_content}
        targets={problem.interaction_config.targets}
        selectedTarget={selectedTarget}
        onTargetClick={handleTargetClick}
        isSubmitted={isSubmitted}
      />

      {/* Feedback Display (after submission) */}
      {isSubmitted && feedback && (
        <FeedbackDisplay
          feedback={feedback}
          visualEffect={feedback.detailed_results?.visual_effect}
        />
      )}
    </div>
  );
};

export default LiveInteractionProblem;
```

### 3. Visual Content Renderer

Create a renderer that handles different visual types:

```typescript
const VisualContentRenderer: React.FC<{
  visualContent: any;
  targets: Array<{id: string, is_correct: boolean, description: string}>;
  selectedTarget: string | null;
  onTargetClick: (id: string) => void;
  isSubmitted: boolean;
}> = ({ visualContent, targets, selectedTarget, onTargetClick, isSubmitted }) => {

  const renderCardGrid = () => {
    const cards = visualContent.data.cards;

    return (
      <div className="grid grid-cols-3 gap-4">
        {cards.map((card: any) => {
          const target = targets.find(t => t.id === card.id);
          const isSelected = selectedTarget === card.id;

          return (
            <div
              key={card.id}
              onClick={() => onTargetClick(card.id)}
              className={`
                border-4 rounded-lg p-6 cursor-pointer transition-all
                ${isSelected ? 'border-blue-500 scale-105' : 'border-gray-300'}
                ${isSubmitted ? 'cursor-not-allowed opacity-60' : 'hover:scale-110'}
              `}
            >
              {/* Render shape based on card.shape */}
              <ShapeRenderer shape={card.shape} color={card.color} />
              <p className="text-sm text-center mt-2">{target?.description}</p>
            </div>
          );
        })}
      </div>
    );
  };

  // Route to appropriate renderer based on visual_content.type
  switch (visualContent.type) {
    case 'card-grid':
      return renderCardGrid();
    case 'object-collection':
      return renderObjectCollection();
    // Add more visual types as needed
    default:
      return <div>Unsupported visual type: {visualContent.type}</div>;
  }
};
```

### 4. Integration with Practice Tutor (WebSocket)

The practice tutor WebSocket endpoint handles live_interaction problems with real-time AI guidance:

**Backend endpoint:** [backend/app/api/endpoints/practice_tutor.py](backend/app/api/endpoints/practice_tutor.py)

#### Connecting to Practice Tutor

```typescript
const usePracticeTutor = (problem: LiveInteractionProblem) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [tutorMessage, setTutorMessage] = useState<string>('');

  useEffect(() => {
    // Connect to practice tutor WebSocket
    const socket = new WebSocket('ws://localhost:8000/api/practice-tutor/ws');

    socket.onopen = () => {
      // Authenticate
      socket.send(JSON.stringify({
        type: 'auth',
        token: getAuthToken()
      }));

      // Send problem context
      socket.send(JSON.stringify({
        type: 'start_session',
        topic_context: {
          subject: problem.subject,
          skill_id: problem.skill_id,
          subskill_id: problem.subskill_id
        },
        live_problem: problem
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'audio') {
        // Play audio from tutor
        playAudioChunk(data.audio);
      } else if (data.type === 'text') {
        setTutorMessage(data.message);
      } else if (data.type === 'target_evaluation') {
        // Handle immediate feedback from target selection
        handleTargetFeedback(data);
      }
    };

    setWs(socket);

    return () => socket.close();
  }, [problem]);

  const sendTargetSelection = (targetId: string) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'target_selected',
        target_id: targetId
      }));
    }
  };

  return { tutorMessage, sendTargetSelection };
};
```

#### Sending Target Selections for Real-Time Feedback

When a student clicks a target, you can:
1. **Option A:** Send to WebSocket for immediate AI feedback (without grading)
2. **Option B:** Submit via standard `/submit` endpoint for official grading

```typescript
const handleTargetClick = (targetId: string) => {
  setSelectedTarget(targetId);

  // Option A: Send to WebSocket for immediate feedback (practice mode)
  sendTargetSelection(targetId);

  // Option B: Update state for later submission (assessment mode)
  onUpdate({
    selected_target_id: targetId,
    interaction_mode: 'click'
  });
};
```

### 5. Feedback Display

Show visual effects and feedback based on the response:

```typescript
const FeedbackDisplay: React.FC<{
  feedback: any;
  visualEffect?: string;
}> = ({ feedback, visualEffect }) => {

  const isCorrect = feedback.review?.correct;

  return (
    <div className={`mt-6 p-4 rounded-lg ${
      isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
    } border-2`}>
      {/* Visual Effect Animation */}
      {visualEffect === 'success_animation' && <SuccessAnimation />}
      {visualEffect === 'try_again' && <TryAgainAnimation />}

      {/* Feedback Text */}
      <p className="text-lg font-semibold mb-2">
        {feedback.review?.feedback}
      </p>

      {/* Score */}
      <p className="text-sm">
        Score: {feedback.review?.score}/10
      </p>

      {/* Hint (if incorrect) */}
      {!isCorrect && feedback.review?.detailed_results?.hint && (
        <div className="mt-2 p-2 bg-yellow-100 rounded">
          <p className="text-sm">💡 Hint: {feedback.review.detailed_results.hint}</p>
        </div>
      )}
    </div>
  );
};
```

---

## 🎯 Implementation Checklist for Frontend Dev

### Phase 1: Basic Rendering (1-2 days)
- [ ] Create `LiveInteractionProblem.tsx` component
- [ ] Create `VisualContentRenderer.tsx` for rendering different visual types
- [ ] Implement card-grid visual type (most common for K-1)
- [ ] Add click interaction handling
- [ ] Test with sample live_interaction problem from backend

### Phase 2: Submission Flow (1 day)
- [ ] Connect to existing `onUpdate` callback to capture responses
- [ ] Format response as `{selected_target_id, interaction_mode}`
- [ ] Test submission through existing `ProblemSet` component
- [ ] Verify feedback displays correctly after submission
- [ ] Test with both correct and incorrect answers

### Phase 3: Practice Tutor Integration (2-3 days)
- [ ] Create WebSocket connection hook `usePracticeTutor`
- [ ] Implement audio playback from Gemini Live
- [ ] Send target selections to WebSocket for real-time feedback
- [ ] Display tutor messages during interaction
- [ ] Add microphone capture for speech-based interactions
- [ ] Test full practice session with AI guidance

### Phase 4: Visual Enhancements (1-2 days)
- [ ] Add visual effects (success_animation, try_again)
- [ ] Create shape renderers (circle, square, triangle, etc.)
- [ ] Add hover states and selection animations
- [ ] Implement drag-and-drop for `drag` mode interactions
- [ ] Add trace interaction for `trace` mode (optional)

### Phase 5: Additional Visual Types (ongoing)
- [ ] Implement `object-collection` visual type
- [ ] Implement `comparison-panel` visual type
- [ ] Implement `number-line` visual type
- [ ] Add support for custom visual primitives from backend

---

## 🧪 Testing Your Implementation

### Test Problem Generation

```bash
curl -X POST http://localhost:8000/api/problems/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "math",
    "skill_id": "shape_recognition",
    "subskill_id": "identify_circles",
    "count": 1
  }'
```

### Test Submission

```bash
curl -X POST http://localhost:8000/api/problems/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "problem": { /* problem from generation */ },
    "student_answer": "shape_1",
    "primitive_response": {
      "selected_target_id": "shape_1",
      "interaction_mode": "click"
    },
    "subject": "math",
    "skill_id": "shape_recognition",
    "subskill_id": "identify_circles",
    "canvas_used": false
  }'
```

### Run Backend Tests

```bash
cd backend
pytest tests/test_live_interaction_validation.py -v
```

All tests should pass ✅

---

## 📚 Key Data Structures

### LiveInteractionProblem Type
```typescript
interface LiveInteractionProblem {
  problem_type: 'live_interaction';
  id: string;
  prompt: {
    system: string;           // AI tutor system instruction
    first_message: string;    // Initial question to student
    session_intro: string;    // Session introduction
  };
  visual_content: {
    type: string;             // e.g., "card-grid", "object-collection"
    data: any;                // Visual-specific data
  };
  interaction_config: {
    mode: 'click' | 'speech' | 'drag' | 'trace';
    targets: Array<{
      id: string;
      is_correct: boolean;
      description: string;
    }>;
  };
  evaluation: {
    success_criteria: string[];
    feedback: {
      correct: {
        audio: string;
        visual_effect: string;
      };
      incorrect: {
        audio: string;
        hint: string;
        visual_effect: string;
      };
    };
  };
  subject: string;
  skill_id: string;
  subskill_id: string;
}
```

### Submission Response Type
```typescript
interface LiveInteractionResponse {
  selected_target_id: string;
  interaction_mode: string;
}
```

---

## 🎓 Example User Flow

1. **Student starts practice session**
   - Frontend requests live_interaction problem from `/api/problems/generate`
   - Backend returns problem with visual content and interaction config

2. **Student connects to AI tutor** (optional for practice mode)
   - WebSocket connection established to `/api/practice-tutor/ws`
   - AI tutor introduces the problem via audio
   - Student can ask questions, get hints

3. **Student interacts with visual**
   - Clicks on a target (e.g., "shape_1")
   - Frontend updates selection state
   - Optionally sends to WebSocket for immediate feedback

4. **Student submits answer**
   - Frontend calls `onSubmit` with `primitive_response: {selected_target_id, interaction_mode}`
   - Backend validates, returns score and feedback
   - Frontend displays visual effect and feedback text

5. **Review after assessment**
   - QuestionReview component shows:
     - "Your Answer: Selected: shape_1"
     - "Correct Answer: Correct target(s): shape_1"
     - Score, skill, and subskill badges

---

## 🔗 Related Files

### Backend (All integrated ✅)
- [backend/app/shared/question_types.py](backend/app/shared/question_types.py) - Type definitions
- [backend/app/services/problem_converter.py](backend/app/services/problem_converter.py) - Conversion logic
- [backend/app/services/universal_validator.py](backend/app/services/universal_validator.py) - Validation logic
- [backend/app/api/endpoints/practice_tutor.py](backend/app/api/endpoints/practice_tutor.py) - WebSocket tutor
- [backend/app/generators/content_schemas.py](backend/app/generators/content_schemas.py) - Problem schemas
- [backend/tests/test_live_interaction_validation.py](backend/tests/test_live_interaction_validation.py) - Tests

### Frontend (Needs implementation 🚧)
- [my-tutoring-app/src/components/practice/ProblemRenderer.tsx](my-tutoring-app/src/components/practice/ProblemRenderer.tsx) - Already routes to ComposableProblemComponent
- [my-tutoring-app/src/components/assessment/results/QuestionReview.tsx](my-tutoring-app/src/components/assessment/results/QuestionReview.tsx) - Already supports generic display
- **NEW:** `my-tutoring-app/src/components/practice/LiveInteractionProblem.tsx` - To be created
- **NEW:** `my-tutoring-app/src/components/practice/VisualContentRenderer.tsx` - To be created

---

## 🚀 Quick Start

1. **Test backend integration:**
   ```bash
   cd backend
   pytest tests/test_live_interaction_validation.py -v
   ```
   All tests should pass ✅

2. **Generate a sample problem:**
   Use the API or create a fixture in your frontend code

3. **Create basic LiveInteractionProblem component:**
   Start with card-grid visual type and click interactions

4. **Wire up to ProblemRenderer:**
   Add to the switch statement (already done!)

5. **Test submission flow:**
   Submit an answer and verify it validates correctly

---

## 💡 Tips & Best Practices

1. **Reuse existing components:** ComposableProblemComponent might already have visual renderers you can use
2. **Start simple:** Implement `card-grid` + `click` mode first, add other modes later
3. **Test with real AI:** Connect to practice tutor WebSocket early for the full experience
4. **Visual effects matter:** Students love seeing success animations - make them fun!
5. **Accessibility:** Ensure keyboard navigation works for all interactions
6. **Mobile support:** Test touch interactions on tablets (common for K-1)

---

## 📞 Questions?

The backend integration is **100% complete** and tested. If you need:
- Additional visual types added to schemas
- Changes to feedback structure
- New interaction modes beyond click/speech/drag/trace

Just ask! The system is designed to be extensible.

---

**Happy coding! 🎉**
