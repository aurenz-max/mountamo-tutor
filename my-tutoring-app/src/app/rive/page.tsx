'use client';

import { useState } from 'react';
import RiveAnimation from '@/components/rive/RiveAnimation';

export default function TutorPage() {
  const [currentAnimation, setCurrentAnimation] = useState('Idle 1');
  
  // Example: Trigger animations based on tutoring interactions
  const handleUserInteraction = (interactionType) => {
    switch(interactionType) {
      case 'question':
        setCurrentAnimation('Question');
        break;
      case 'explanation':
        setCurrentAnimation('Talking 1');
        break;
      case 'greeting':
        setCurrentAnimation('Wave Demo');
        break;
      case 'success':
        setCurrentAnimation('Happy Smile');
        break;
      default:
        setCurrentAnimation('Idle 1');
    }
  };
  
  return (
    <div className="tutor-page">
      <div className="tutor-container">
        <div className="tutor-character">
          <RiveAnimation 
            animationName={currentAnimation}
            src="/animations/water-character.riv" 
          />
        </div>
        
        <div className="tutor-content">
          <h1>Interactive Tutoring</h1>
          <p>Ask a question or select a topic to begin learning</p>
          
          {/* Example UI for triggering different animations */}
          <div className="interaction-buttons">
            <button onClick={() => handleUserInteraction('greeting')}>
              👋 Greet Tutor
            </button>
            <button onClick={() => handleUserInteraction('question')}>
              ❓ Ask Question
            </button>
            <button onClick={() => handleUserInteraction('explanation')}>
              📚 Get Explanation
            </button>
            <button onClick={() => handleUserInteraction('success')}>
              🎉 Celebrate Progress
            </button>
          </div>
          
          {/* Your actual tutoring content here */}
          <div className="lesson-content">
            {/* Lesson content goes here */}
          </div>
        </div>
      </div>
    </div>
  );
}