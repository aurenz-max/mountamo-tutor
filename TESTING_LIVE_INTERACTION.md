# Testing Live Interaction Problem Type

## Backend Testing (Verify First)

### 1. Test Backend Integration
```bash
cd backend
pytest tests/test_live_interaction_validation.py -v
```
All tests should pass ✅

### 2. Generate a Sample Live Interaction Problem
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

Expected response should include:
- `problem_type`: "live_interaction"
- `prompt`: Object with `system`, `first_message`, `session_intro`
- `visual_content`: Object with `type` and `data`
- `interaction_config`: Object with `mode` and `targets`
- `evaluation`: Feedback configuration

### 3. Test Submission
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

Expected response should include:
- `review.score`: Number (0-10)
- `review.correct`: Boolean
- `review.feedback`: String feedback message
- `review.detailed_results`: Object with target info and visual effect

## Frontend Testing

### 1. Start the Frontend Development Server
```bash
cd my-tutoring-app
npm run dev
```

### 2. Navigate to Practice Session
1. Go to practice/problem set page
2. Select a topic with live_interaction problems
3. Generate problem set

### 3. Test Live Interaction Problem Rendering

**Expected Behavior:**
- [ ] Problem renders with "Live Interaction" badge
- [ ] Visual content displays (card-grid or other visual type)
- [ ] Target selection buttons appear
- [ ] PracticeAICoach sidebar appears on the right side
- [ ] Main content shifts left to accommodate AI Coach

### 4. Test Target Selection

**Action:** Click on a target (e.g., "Red Circle")

**Expected Behavior:**
- [ ] Target becomes visually selected (blue border, indicator)
- [ ] Selection is stored in component state
- [ ] If AI Coach is connected, selection is sent to WebSocket
- [ ] AI Coach may provide real-time feedback via audio/text

### 5. Test Submission Flow

**Action:** Click "Submit Answer" button

**Expected Behavior:**
- [ ] Problem is submitted to backend
- [ ] Feedback is returned and displayed
- [ ] Correct targets show green highlight
- [ ] Incorrect selection shows red highlight
- [ ] Score displays (e.g., "8/10")
- [ ] Visual effect plays (sparkles for success)
- [ ] Hint displays if answer was incorrect
- [ ] AI Coach receives submission result notification

### 6. Test Navigation

**Action:** Navigate to next/previous problems

**Expected Behavior:**
- [ ] AI Coach sidebar hides when navigating to non-live_interaction problems
- [ ] Layout adjusts back to full width
- [ ] AI Coach sidebar reappears when returning to live_interaction problem
- [ ] Previous selections are preserved

### 7. Test AI Coach Integration

**Prerequisites:**
- Backend practice-tutor WebSocket endpoint must be running
- Student must be authenticated

**Action:**
1. Start a live_interaction problem
2. Click "Connect & Start" in AI Coach sidebar
3. Click on different targets

**Expected Behavior:**
- [ ] AI Coach connects via WebSocket
- [ ] Session ready message appears
- [ ] AI tutor provides introduction via audio
- [ ] Target selections trigger AI responses
- [ ] Can ask for hints/explanations via quick help buttons
- [ ] Microphone button allows voice interaction
- [ ] After submission, AI provides personalized feedback

### 8. Test Different Visual Types

**card-grid (Implemented):**
- [ ] Cards render in grid layout
- [ ] Cards show shapes/colors correctly
- [ ] Hover effects work
- [ ] Selection highlights work

**object-collection (Already exists):**
- [ ] Objects display in collection
- [ ] Count matches expected
- [ ] Icons/emojis render

**Other visual types:**
- [ ] Falls back gracefully with warning message

### 9. Test Error Cases

**No targets available:**
- [ ] Component displays gracefully without crashing

**Invalid visual data:**
- [ ] Error boundary catches issues
- [ ] Fallback message displays

**Submission fails:**
- [ ] Error message displays
- [ ] Can retry submission

**AI Coach connection fails:**
- [ ] Can still complete problem without AI Coach
- [ ] Submission works independently

## Component Integration Checklist

### LiveInteractionPrimitive Component
- [ ] Renders problem prompt
- [ ] Displays visual content
- [ ] Handles target clicks
- [ ] Updates parent state via `onUpdate`
- [ ] Shows feedback after submission
- [ ] Displays visual effects
- [ ] Integrates with AI Coach via ref

### CardGrid Visual Component
- [ ] Renders cards in grid
- [ ] Supports different shapes (circle, square, triangle, etc.)
- [ ] Supports color variations
- [ ] Handles image URLs
- [ ] Shows selection states
- [ ] Emits click events

### PracticeAICoach Component
- [ ] Connects to practice-tutor WebSocket
- [ ] Receives problem context
- [ ] Handles target selection messages
- [ ] Handles submission result messages
- [ ] Provides audio feedback
- [ ] Shows conversation history
- [ ] Supports voice interaction

### ProblemSet Integration
- [ ] Shows/hides AI Coach based on problem type
- [ ] Passes problem context to AI Coach
- [ ] Sends submission results to AI Coach
- [ ] Adjusts layout when AI Coach visible

## Browser Console Checks

Look for these console logs during testing:

**Problem Rendering:**
```
Problem type: liveInteraction
```

**Target Selection:**
```
Selected target: shape_1
```

**Submission:**
```
=== UNIFIED PROBLEM SUBMISSION ===
Problem type: liveInteraction
Current response: {selected_target_id: "shape_1", interaction_mode: "click"}
```

**AI Coach:**
```
AI Coach WebSocket connection established for practice-tutor
Practice Tutor connected and ready to help!
```

## Known Issues / Limitations

1. **Visual Types:** Only `card-grid` and existing visual types are implemented. Additional types like `comparison-panel`, `number-line` may need implementation.

2. **Interaction Modes:** Only `click` mode is fully implemented. `drag`, `trace`, and `speech` modes need additional UI components.

3. **AI Coach Audio:** Requires microphone permissions and WebSocket connection to backend.

4. **Backend Dependency:** Live interaction requires the backend practice-tutor WebSocket endpoint to be running for full functionality.

## Next Steps for Full Production

1. **Add More Visual Types:**
   - Implement `comparison-panel` for comparing two items
   - Implement `number-line` for number sequence problems
   - Implement `object-collection` with interaction

2. **Add More Interaction Modes:**
   - `drag`: Implement drag-and-drop for sorting/ordering
   - `trace`: Implement touch/mouse tracing for shape drawing
   - `speech`: Voice recognition for verbal answers

3. **Enhance AI Coach:**
   - Add more sophisticated conversation management
   - Implement session history
   - Add progress tracking within live interaction sessions

4. **Mobile Optimization:**
   - Test touch interactions on tablets
   - Optimize AI Coach layout for smaller screens
   - Implement responsive breakpoints

5. **Accessibility:**
   - Add keyboard navigation for all interactions
   - Implement ARIA labels
   - Add screen reader support

## Success Criteria

The implementation is successful if:

✅ Live interaction problems render correctly
✅ Target selection works and updates state
✅ Submission flow completes successfully
✅ Feedback displays with correct/incorrect states
✅ AI Coach appears for live_interaction problems
✅ AI Coach receives target selections and submission results
✅ Visual effects play on success
✅ Component follows established primitives pattern
✅ Integration works with existing ProblemSet architecture

## Troubleshooting

**Problem doesn't render:**
- Check that `problem_type` is exactly "live_interaction"
- Check browser console for errors
- Verify problem data structure matches `LiveInteractionProblem` interface

**AI Coach doesn't appear:**
- Check that `showAICoach` state is true
- Verify problem type detection in useEffect
- Check browser console for connection errors

**Targets don't respond to clicks:**
- Check that `isSubmitted` is false
- Verify `onUpdate` callback is wired up
- Check browser console for click handler errors

**Submission fails:**
- Verify `primitive_response` format matches backend expectations
- Check network tab for API request/response
- Verify authentication token is valid

**Visual content doesn't display:**
- Check that `visual_content.type` is supported
- Verify `visual_content.data` structure matches component expectations
- Check for VisualPrimitiveRenderer errors in console
