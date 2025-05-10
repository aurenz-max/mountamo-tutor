'use client';

// pages/tutoring.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import SyllabusSelector from '@/components/gemini-tutor/SyllabusSelector';
import GeminiTutoringSession from '@/components/gemini-tutor/GeminiTutoringSession';

// Types
interface CurriculumSelection {
  subject: string;
  unit?: {
    id: string;
    title: string;
  };
  skill?: {
    id: string;
    description: string;
  };
  subskill?: {
    id: string;
    description: string;
    difficulty_range?: {
      start: number;
      end: number;
      target: number;
    };
  };
}

export default function TutoringPage() {
  // State for curriculum selection
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection | null>(null);
  const [ageGroup, setAgeGroup] = useState('8-10');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  
  // Handles curriculum selection from SyllabusSelector
  const handleCurriculumSelection = (selectedData: any) => {
    // Map the data from SyllabusSelector to match CurriculumSelection interface
    const transformedSelection: CurriculumSelection = {
      subject: selectedData.subject || selectedData.selectedSubject,
      unit: selectedData.unit,
      skill: selectedData.skill,
      subskill: selectedData.subskill,
      // The other properties will come from the full unit/skill/subskill objects
    };
    
    setCurriculumSelection(transformedSelection);
    setIsSessionActive(true);
    setShowSetup(false);
  };
  
  // End the current session
  const handleEndSession = () => {
    setIsSessionActive(false);
    setShowSetup(true);
  };
  
  // Reset selection to create a new session
  const handleNewSession = () => {
    setCurriculumSelection(null);
    setIsSessionActive(false);
    setShowSetup(true);
  };
  
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <Head>
        <title>AI Tutoring - Curriculum-Aligned Education</title>
        <meta name="description" content="Interactive tutoring sessions aligned with curriculum standards" />
      </Head>
      
      <main className="flex flex-col min-h-screen">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 text-center">AI Tutoring</h1>
        
        {showSetup ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
            <div className="lg:col-span-3 bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">Set Up Your Tutoring Session</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-700">Select Age Group</h3>
                <div className="flex flex-wrap gap-3">
                  {['5-7', '8-10', '11-13', '14-16'].map((age) => (
                    <button
                      key={age}
                      className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        ageGroup === age
                          ? 'bg-blue-100 border-2 border-blue-300 text-blue-700'
                          : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={() => setAgeGroup(age)}
                    >
                      {age} years
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <SyllabusSelector onSelect={handleCurriculumSelection} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">About Gemini Tutoring</h3>
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                Our AI tutoring sessions use Google's Gemini AI to provide interactive, 
                curriculum-aligned learning experiences. Each session is customized 
                based on the curriculum focus you select.
              </p>
              
              <h4 className="text-lg font-medium mt-6 mb-3 text-gray-700">Features</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                <li>Voice-based conversation with real-time responses</li>
                <li>Screen sharing for visual explanations</li>
                <li>AI-recommended learning paths based on your progress</li>
                <li>Age-appropriate explanations and examples</li>
                <li>Interactive practice problems</li>
              </ul>
              
              <h4 className="text-lg font-medium mt-6 mb-3 text-gray-700">Tips for a Great Session</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                <li>Use a quiet environment for better voice recognition</li>
                <li>Ask specific questions about topics you find challenging</li>
                <li>Follow the AI's recommendations to focus on areas needing improvement</li>
                <li>Use the screen sharing feature to show your work</li>
                <li>Take notes during the session for later review</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {isSessionActive && curriculumSelection && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Tutoring Session: {curriculumSelection.subject}
                    {curriculumSelection.skill && ` - ${curriculumSelection.skill.description}`}
                  </h2>
                  <button 
                    className="py-2 px-4 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors"
                    onClick={handleNewSession}
                  >
                    New Session
                  </button>
                </div>
                
                <GeminiTutoringSession 
                  initialCurriculum={{
                    subject: curriculumSelection.subject,
                    domain: curriculumSelection.unit,
                    skill: curriculumSelection.skill,
                    subskill: curriculumSelection.subskill,
                  }}
                  ageGroup={ageGroup}
                  onSessionEnd={handleEndSession}
                />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}