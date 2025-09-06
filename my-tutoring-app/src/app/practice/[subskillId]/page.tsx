// app/practice/[subskillId]/page.tsx - Updated with persistent AI Coach
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';
import SyllabusSelector from '@/components/practice/SyllabusSelector';
import ProblemSet from '@/components/practice/ProblemSet';
import AICoach from '@/components/dashboard/AICoach'; // Import your AICoach
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw, ArrowLeft, Home, MessageCircle, X } from 'lucide-react';

interface PracticeSubskillPageProps {
  params: {
    subskillId: string;
  };
}

const PracticeSubskillPage: React.FC<PracticeSubskillPageProps> = ({ params }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const { subskillId } = params;
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState(null);
  
  // AI Coach state
  const [showAICoach, setShowAICoach] = useState(false);
  
  useEffect(() => {
    const initializePracticeSession = async () => {
      if (!userProfile?.student_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Try to fetch activity data to get more context
        let activity = null;
        
        try {
          const data = await authApi.getDailyPlan(userProfile.student_id);
          activity = data.activities?.find((act: any) => act.id === subskillId);
          console.log('Found activity data:', activity);
        } catch (apiError) {
          console.log('Daily plan API call failed, continuing without activity data:', apiError);
        }
        
        setActivityData(activity);
        
        // Create topic selection based on subskillId and activity data
        const topicSelection = createTopicFromSubskillId(subskillId, activity);
        
        if (topicSelection) {
          setSelectedTopic(topicSelection);
          console.log('Auto-started practice session with:', topicSelection);
        }
      } catch (err) {
        console.log('Error initializing practice session:', err);
        // Still try to create a basic topic selection
        const fallbackTopic = createTopicFromSubskillId(subskillId, null);
        if (fallbackTopic) {
          setSelectedTopic(fallbackTopic);
        }
      } finally {
        setLoading(false);
      }
    };

    initializePracticeSession();
  }, [subskillId, userProfile?.student_id]);

  // Create AI Coach context for this practice session
  const practiceContext = {
    type: 'practice' as const,
    title: activityData?.title || selectedTopic?.skill?.description || 'Practice Problems',
    focus_area: `Practice session for ${selectedTopic?.skill?.description || subskillId}`,
    metadata: {
      subskillId,
      activityData,
      selectedTopic,
      sessionType: 'practice_problems'
    }
  };

  // Create topic selection from subskillId
  const createTopicFromSubskillId = (subskillId: string, activity: any) => {
    // Parse the subskillId to extract meaningful information
    // Format: rec-COUNT001-01-A or similar
    const parts = subskillId.replace(/^rec-/, '').split('-');
    
    let skill = parts[0] || 'COUNT001';
    let subskill = parts.slice(1).join('-') || '01-A';
    
    // Get subject from URL parameter (passed from ActivityCard) or activity metadata
    const subjectFromUrl = searchParams?.get('subject');
    const detectedSubject = subjectFromUrl || activity?.metadata?.subject || 'mathematics';
    
    // Create a structured topic selection that matches your existing format
    const topicSelection = {
      subject: detectedSubject,
      selection: {
        unit: activity?.metadata?.unit_id || skill.substring(0, 5), // e.g., COUNT
        skill: skill, // e.g., COUNT001
        subskill: subskillId // Use full subskillId as subskill identifier
      },
      // Extract from activity data if available
      unit: {
        title: activity?.metadata?.unit_title || `Unit: ${skill.substring(0, 5)}`
      },
      skill: {
        description: activity?.title || activity?.description || 
                    subskillId.replace(/^rec-/, '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      },
      subskill: {
        description: activity?.description || 
                    `Practice problems for ${subskillId.replace(/^rec-/, '').replace(/-/g, ' ')}`
      },
      difficulty_range: {
        target: activity?.metadata?.difficulty || 3.0
      },
      autoStart: true, // This tells ProblemSet to start immediately
      fromCardInterface: true // This indicates it came from the new card interface
    };

    return topicSelection;
  };
  
  const handleTopicSelect = (topic: any) => {
    setSelectedTopic(topic);
  };
  
  const handleBackToSelector = () => {
    setSelectedTopic(null);
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // Quick access to other learning methods for this activity
  const handleSwitchLearningMethod = () => {
    router.push('/dashboard');
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
          {/* Enhanced Header with Card-Based Navigation */}
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
                {activityData && (
                  <>
                    <div className="h-4 w-px bg-gray-300" />
                    <span className="text-sm text-gray-500">
                      Practice Problems
                    </span>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {activityData && (
                  <div className="flex items-center space-x-2 text-sm">
                    {activityData.metadata?.from_recommendations && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                        AI-Recommended
                      </span>
                    )}
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {activityData.estimated_time || '12-15 mins'}
                    </span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      {activityData.points || 23} points
                    </span>
                  </div>
                )}
                
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
                
                {/* Switch Learning Method */}
                <Button 
                  onClick={handleSwitchLearningMethod}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Switch Method
                </Button>
              </div>
            </div>
            
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500">
              Dashboard → Practice Problems → {selectedTopic?.skill?.description || subskillId.replace(/^rec-/, '').replace(/-/g, ' ')}
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Practice Problems</h1>
              <p className="text-gray-500">
                {selectedTopic 
                  ? `Working on: ${selectedTopic.skill?.description || selectedTopic.selection.skill || 'Selected Topic'}` 
                  : 'Loading your practice session...'}
              </p>
              {activityData && (
                <p className="text-sm text-blue-600 mt-1">
                  {activityData.description}
                </p>
              )}
            </div>
            
            {/* Learning Method Switcher */}
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <span className="text-gray-500">Also try:</span>
              <Button
                onClick={() => router.push(`/tutoring/live/${subskillId}`)}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                AI Tutoring
              </Button>
              <Button
                onClick={() => router.push(`/content/packages/${subskillId}`)}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                Videos
              </Button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600">Setting up your practice session...</p>
            </div>
          ) : (
            <>
              {!selectedTopic ? (
                <div className="max-w-xl mx-auto">
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      Unable to auto-start practice session. Please select a topic manually.
                    </p>
                  </div>
                  <SyllabusSelector onSelect={handleTopicSelect} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4 flex items-center justify-between">
                    <Button
                      onClick={handleBackToSelector}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Change Topic
                    </Button>
                    
                    {selectedTopic.fromCardInterface && (
                      <div className="text-sm text-green-600 font-medium">
                        ✓ Started from learning cards
                      </div>
                    )}
                  </div>
                  
                  <ProblemSet 
                    currentTopic={selectedTopic} 
                    numProblems={5} 
                    autoStart={selectedTopic.autoStart}
                    fromDashboard={selectedTopic.fromCardInterface}
                    studentId={userProfile.student_id}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI Coach Sidebar */}
      {showAICoach && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50">
          <AICoach
            studentId={userProfile.student_id}
            mode="sidebar"
            context={practiceContext}
            onClose={() => setShowAICoach(false)}
            className="h-full"
            persistConnection={true}
          />
        </div>
      )}
    </div>
  );
};

export default PracticeSubskillPage;