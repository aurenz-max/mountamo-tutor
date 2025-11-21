Frontend Implementation Guide: Real-time Spoken Answer Validation
Overview
The backend now implements the send_answer_feedback feature via Gemini Live tool calling. When a student speaks the correct answer, Gemini will automatically call a tool, and the backend will send a WebSocket message to the frontend to trigger visual feedback.
WebSocket Message Format
Message Type: answer_feedback
When the student says the correct (or incorrect) answer, you'll receive this WebSocket message:
{
  "type": "answer_feedback",
  "payload": {
    "is_correct": true,
    "message": "Great job!"
  }
}
Field Descriptions
Field	Type	Description
type	string	Always "answer_feedback"
payload.is_correct	boolean	true if answer is correct, false if incorrect
payload.message	string	Encouraging message from the AI (e.g., "Great job!", "That's it!", "Well done!")
Frontend Implementation Steps
1. Update WebSocket Message Handler
You need to add a handler for the answer_feedback message type in your WebSocket onmessage handler. File: my-tutoring-app/src/components/practice/PracticeAICoach.tsx Location: Around lines 85-105 (in your existing WebSocket message handler)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // ... existing handlers for other message types ...
  
  // NEW: Handle answer feedback
  if (data.type === 'answer_feedback') {
    handleAnswerFeedback(data.payload);
  }
}
2. Implement the Feedback Handler
Create a function to handle the answer feedback and trigger visual effects:
const handleAnswerFeedback = (payload: { is_correct: boolean; message: string }) => {
  console.log('✅ Answer feedback received:', payload);
  
  if (payload.is_correct) {
    // Show success animation/UI
    showCorrectAnswerAnimation(payload.message);
    
    // Optional: Play success sound
    playSuccessSound();
    
    // Optional: Update state/dispatch action
    dispatch({
      type: 'ANSWER_VALIDATED',
      payload: {
        isCorrect: true,
        message: payload.message
      }
    });
  } else {
    // Handle incorrect answer (if needed in future)
    showIncorrectAnswerFeedback(payload.message);
  }
};
3. Create Visual Feedback Components
Here's a recommended implementation for the success animation:
const [showSuccess, setShowSuccess] = useState(false);
const [successMessage, setSuccessMessage] = useState('');

const showCorrectAnswerAnimation = (message: string) => {
  setSuccessMessage(message);
  setShowSuccess(true);
  
  // Auto-hide after 2 seconds (per PRD requirement)
  setTimeout(() => {
    setShowSuccess(false);
  }, 2000);
};
UI Component Example:
{showSuccess && (
  <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top duration-300">
    <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
      <CheckCircle className="w-6 h-6" />
      <span className="font-semibold">{successMessage}</span>
    </div>
  </div>
)}
Or use a toast notification:
import { toast } from 'sonner'; // or your preferred toast library

const showCorrectAnswerAnimation = (message: string) => {
  toast.success(message, {
    duration: 2000,
    icon: '✅',
    className: 'text-lg'
  });
};
4. Optional: Add Celebration Effects
For a more engaging experience, consider adding:
Confetti Animation
import confetti from 'canvas-confetti';

const showCorrectAnswerAnimation = (message: string) => {
  // Show confetti
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
  
  // Show toast
  toast.success(message, { duration: 2000 });
};
Sound Effect
const playSuccessSound = () => {
  const audio = new Audio('/sounds/success.mp3');
  audio.volume = 0.5;
  audio.play().catch(err => console.log('Audio play failed:', err));
};
Complete Example Integration
Here's a complete example showing how to integrate everything:
// PracticeAICoach.tsx or similar component

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { CheckCircle } from 'lucide-react';

export function PracticeAICoach() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    // Initialize WebSocket connection
    const websocket = new WebSocket('ws://your-backend/practice-tutor');
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type) {
        case 'ai_audio':
          handleAIAudio(data);
          break;
          
        case 'ai_text':
          handleAIText(data);
          break;
          
        case 'user_transcription':
          handleUserTranscription(data);
          break;
          
        // NEW: Handle answer feedback
        case 'answer_feedback':
          handleAnswerFeedback(data.payload);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    };
    
    setWs(websocket);
    
    return () => websocket.close();
  }, []);
  
  const handleAnswerFeedback = (payload: { is_correct: boolean; message: string }) => {
    if (payload.is_correct) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Show success toast
      toast.success(payload.message, {
        duration: 2000,
        icon: '✅',
        className: 'text-lg font-semibold'
      });
      
      // Optional: Play sound
      const audio = new Audio('/sounds/success.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {/* ignore errors */});
      
      // Optional: Update analytics or state
      // trackCorrectAnswer();
    }
  };
  
  // ... rest of component
}
Testing the Integration
Test Scenario
Start a practice session with a problem that has a correct_answer field in the problem data
Speak the correct answer into the microphone
Expected behavior:
Gemini recognizes the correct answer
Backend receives tool call from Gemini
Backend sends answer_feedback WebSocket message
Frontend receives message and shows celebration UI
Total latency should be < 2 seconds (per PRD)
Example Problem Data
For testing, ensure your problem has this structure:
{
  "problem_data": {
    "question": "What is the capital of France?",
    "correct_answer": "Paris"
  }
}
Debug Logging
Add console logs to verify the flow:
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨 WebSocket message received:', data.type, data);
  
  if (data.type === 'answer_feedback') {
    console.log('✅ Answer feedback:', data.payload);
    handleAnswerFeedback(data.payload);
  }
};
PRD Requirements Checklist
✅ Immediate feedback: Visual indicator appears within 2 seconds of correct answer
✅ Non-disruptive: Temporary animation/toast (2-second duration recommended)
✅ Clear visual indicator: Green checkmark, success message, celebration effect
✅ WebSocket integration: Listens for answer_feedback message type
✅ Handles both correct/incorrect: payload.is_correct determines behavior
Additional Notes
When Answer Feedback is Triggered
The backend will only send answer_feedback when:
The problem has a correct_answer, answer, or solution field in problem_data
Gemini Live session is active with tool calling enabled
The student speaks their answer (transcribed via Gemini)
Gemini evaluates the transcription and calls the send_answer_feedback tool
Message Flow Diagram
Student speaks → Gemini transcribes → Gemini evaluates → Gemini calls tool
                                                              ↓
Frontend ← WebSocket ← Backend handles tool call ← Gemini tool response
    ↓
Shows celebration UI