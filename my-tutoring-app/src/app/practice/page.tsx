'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';
import ProblemSet from '@/components/practice/ProblemSet';
import PracticeAICoach from '@/components/practice/PracticeAICoach';
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw, Home, MessageCircle } from 'lucide-react';
import Link from 'next/link';

const PracticePage = () => {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);
  
  // AI Coach state
  const [showAICoach, setShowAICoach] = useState(false);
  
  // Communication state between ProblemSet and PracticeAICoach
  const [currentProblemContext, setCurrentProblemContext] = useState(null);
  const practiceAICoachRef = useRef(null);
  
  useEffect(() => {
    // Check if there's a saved practice selection in localStorage
    const savedSelection = localStorage.getItem('selectedPractice');
    
    if (savedSelection) {
      try {
        const parsedSelection = JSON.parse(savedSelection);
        setSelectedTopic(parsedSelection);
        
        // Clear the localStorage item to prevent auto-loading on future visits
        // unless we want to maintain state across page refreshes
        localStorage.removeItem('selectedPractice');
        
        // Set flag to track if we auto-started
        if (parsedSelection.autoStart) {
          setAutoStarted(true);
        }
      } catch (e) {
        console.error('Error parsing saved selection:', e);
      }
    }
    
    setLoading(false);
  }, []);
  
  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
  };
  
  const handleBackToSelector = () => {
    setSelectedTopic(null);
    setAutoStarted(false);
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // Communication handlers between ProblemSet and PracticeAICoach
  const handleProblemChange = (problem, index, isSubmitted) => {
    setCurrentProblemContext({
      currentProblem: problem,
      currentIndex: index,
      totalProblems: problem ? 1 : 0, // This will be updated when we know the total
      isSubmitted
    });
  };

  const handleSubmissionResult = (result) => {
    // Send result to PracticeAICoach if it's active
    if (showAICoach && practiceAICoachRef.current && result) {
      try {
        practiceAICoachRef.current.sendSubmissionResult(result);
      } catch (error) {
        console.error('Error sending submission result to PracticeAICoach:', error);
      }
    }
  };

  // Create AI Coach context for this practice session
  const practiceContext = {
    type: 'practice',
    title: selectedTopic?.skill?.description || 'Practice Problems',
    focus_area: `Practice session for ${selectedTopic?.skill?.description || 'selected topic'}`,
    metadata: {
      selectedTopic,
      sessionType: 'practice_problems'
    }
  };

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading user profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-300 ${showAICoach ? 'mr-80' : ''}`}>
        <div className="container mx-auto p-4 h-full overflow-y-auto">
          {/* Enhanced Header */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  onClick={handleBackToDashboard}
                  variant="ghost" 
                  className="flex items-center text-gray-600"
                >
                  <Home className="mr-1" size={16} />
                  Dashboard
                </Button>
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-sm text-gray-500">Practice Problems</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* AI Coach Toggle */}
                <Button
                  onClick={() => setShowAICoach(!showAICoach)}
                  variant={showAICoach ? "default" : "outline"}
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{showAICoach ? 'Hide' : 'Show'} AI Coach</span>
                </Button>
              </div>
            </div>
            
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500">
              Dashboard → Practice Problems → {selectedTopic?.skill?.description || 'Topic Selection'}
            </div>
          </div>
      
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Practice Problems</h1>
              <p className="text-gray-500">
                {selectedTopic 
                  ? `Working on: ${selectedTopic.skill?.description || selectedTopic.selection.skill || 'Selected Topic'}` 
                  : 'Select a topic to practice'}
              </p>
            </div>
          </div>
      
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600">Loading your practice session...</p>
            </div>
          ) : (
            <>
              {!selectedTopic ? (
                <div className="max-w-xl mx-auto">
                  <SyllabusSelector onSelect={handleTopicSelect} />
                </div>
              ) : (
                <div className="space-y-4">
                  {autoStarted && (
                    <div className="mb-4">
                      <Button
                        onClick={handleBackToSelector}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" /> Change Topic
                      </Button>
                    </div>
                  )}
                  
                  <ProblemSet 
                    currentTopic={selectedTopic} 
                    numProblems={5} 
                    autoStart={selectedTopic.autoStart}
                    studentId={userProfile.student_id}
                    onProblemChange={handleProblemChange}
                    onSubmissionResult={handleSubmissionResult}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Practice AI Coach Sidebar */}
      {showAICoach && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50">
          <PracticeAICoach
            ref={practiceAICoachRef}
            studentId={userProfile.student_id}
            practiceContext={{
              subject: selectedTopic?.subject || 'mathematics',
              skill_description: selectedTopic?.skill?.description,
              subskill_description: selectedTopic?.subskill?.description,
              skill_id: selectedTopic?.selection?.skill || selectedTopic?.id,
              subskill_id: selectedTopic?.selection?.subskill || selectedTopic?.id
            }}
            problemContext={currentProblemContext}
            onClose={() => setShowAICoach(false)}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
};

export default PracticePage;