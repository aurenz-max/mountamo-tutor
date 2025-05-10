// components/gemini-tutor/SessionInfoBar.tsx
import React from 'react';

interface SessionInfoBarProps {
  curriculum: {
    subject: string;
    domain?: { id: string; title: string; };
    skill?: { id: string; description: string; };
    subskill?: { 
      id: string; 
      description: string; 
      difficulty_range?: { start: number; end: number; target: number; };
    };
  };
  ageGroup: string;
}

const SessionInfoBar: React.FC<SessionInfoBarProps> = ({ curriculum, ageGroup }) => {
  const focusArea = curriculum.subskill?.description || 
                   curriculum.skill?.description || 
                   curriculum.domain?.title || 
                   curriculum.subject;

  return (
    <div className="bg-gray-50 border-b px-6 py-3">
      <div className="flex items-center text-sm text-gray-600">
        <span className="font-medium">Focus Area:</span>
        <span className="ml-2">{focusArea}</span>
        
        {curriculum.subskill?.difficulty_range && (
          <>
            <span className="mx-3">•</span>
            <span className="font-medium">Difficulty:</span>
            <span className="ml-2">
              Level {curriculum.subskill.difficulty_range.target}/5
            </span>
          </>
        )}
        
        <span className="mx-3">•</span>
        <span className="font-medium">Age Group:</span>
        <span className="ml-2">{ageGroup} years</span>
      </div>
    </div>
  );
};

export default SessionInfoBar;