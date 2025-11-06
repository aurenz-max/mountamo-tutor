'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProblemSet from '@/components/practice/ProblemSet';
import PracticeAICoach from '@/components/practice/PracticeAICoach';
import { QuickStartSection } from '@/components/practice/QuickStartSection';
import CurriculumExplorer from '@/components/practice/explorer/CurriculumExplorer';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronLeft, RefreshCw, Home, MessageCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { DailyActivity } from '@/lib/dailyActivitiesAPI';
import { useToast } from "@/components/ui/use-toast";

const PracticePage = () => {
  const router = useRouter();
  const { userProfile, getAuthToken } = useAuth();
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);

  // AI Coach state
  const [showAICoach, setShowAICoach] = useState(false);

  // Communication state between ProblemSet and PracticeAICoach
  const [currentProblemContext, setCurrentProblemContext] = useState(null);
  const practiceAICoachRef = useRef(null);

  // Quick Start and Browse Curriculum state
  const [showBrowseCurriculum, setShowBrowseCurriculum] = useState(false);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  
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

  // Handler for Quick Start activity selection
  const handleActivitySelect = (activity: DailyActivity) => {
    // Convert DailyActivity to the format expected by ProblemSet
    if (activity.curriculum_metadata) {
      const { subject, unit, skill, subskill } = activity.curriculum_metadata;

      const topicFormat = {
        subject: subject,
        unit: unit,
        skill: skill,
        subskill: subskill,
        selection: {
          subject: subject,
          unit: unit.id,
          skill: skill.id,
          subskill: subskill.id
        },
        autoStart: true
      };

      setCurrentActivityId(activity.id);
      setSelectedTopic(topicFormat);
      setAutoStarted(true);
      setSessionCompleted(false);

      toast({
        title: "Starting Practice",
        description: `${activity.title} - ${activity.description}`,
      });
    } else {
      toast({
        title: "Error",
        description: "Unable to start practice - missing curriculum information",
        variant: "destructive"
      });
    }
  };

  // Handler for marking activity as complete
  const handleMarkComplete = async (activityId: string, pointsEarned?: number) => {
    try {
      toast({
        title: "Activity Completed!",
        description: pointsEarned ? `You earned ${pointsEarned} points!` : "Great job!",
      });

      // If this was from a problem set session, mark the current activity as complete
      if (currentActivityId === activityId) {
        setSessionCompleted(true);
      }
    } catch (error) {
      console.error('Error marking activity complete:', error);
      toast({
        title: "Error",
        description: "Failed to mark activity as complete",
        variant: "destructive"
      });
    }
  };

  // Handler for curriculum explorer selection
  const handleCurriculumSelect = (selection: any) => {
    // Convert curriculum selection to topic format
    const topicFormat = {
      ...selection,
      autoStart: false
    };

    setSelectedTopic(topicFormat);
    setCurrentActivityId(null); // Not from Quick Start
    setAutoStarted(false);
    setSessionCompleted(false);
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
                <div className="space-y-8">
                  {/* Quick Start Section - No extra wrapper, component handles its own styling */}
                  <QuickStartSection
                    studentId={userProfile.student_id}
                    getAuthToken={getAuthToken}
                    onActivitySelect={handleActivitySelect}
                    onMarkComplete={handleMarkComplete}
                  />

                  {/* Divider with proper separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-50 px-2 text-muted-foreground">or explore</span>
                    </div>
                  </div>

                  {/* Browse Curriculum Section using Collapsible */}
                  <Collapsible
                    open={showBrowseCurriculum}
                    onOpenChange={setShowBrowseCurriculum}
                    className="space-y-2"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-between h-auto py-4"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          <span className="font-semibold">Browse Curriculum</span>
                        </div>
                        {showBrowseCurriculum ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2">
                      <CurriculumExplorer onSelect={handleCurriculumSelect} />
                    </CollapsibleContent>
                  </Collapsible>
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