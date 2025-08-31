'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles, Home, BookOpen, HelpCircle, Edit3 } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import LoadingOverlay from './LoadingOverlay';
import ProblemRenderer, { type ProblemRendererRef } from './ProblemRenderer';

interface Problem {
  problem_id?: string;
  problem_type?: string;
  prompt?: string;          // New simplified structure
  problem?: string;         // Keep for backward compatibility
  answer?: string;          // Keep for backward compatibility
  interaction?: {           // New interactive structure
    type: string;
    parameters: any;
  };
  success_criteria?: string[];
  teaching_note?: string;
  learning_objective?: string;
  metadata?: {
    skill?: {
      id?: string;
      description?: string;
    };
    subskill?: {
      id?: string;
      description?: string;
    };
    difficulty?: number;
    concept_group?: string;
  };
  // MCQ fields
  id?: string;
  subject?: string;
  unit_id?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  question?: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  correct_option_id?: string;
  rationale?: string;
}

interface ProblemSetProps {
  currentTopic: any;
  studentId?: number;
  numProblems?: number;
  autoStart?: boolean;
  fromDashboard?: boolean;
}

// Enhanced helper function to clean IDs and extract components
const parseActivityId = (activityId: string) => {
  // Remove "rec-" prefix if present
  const cleanId = activityId.startsWith('rec-') ? activityId.substring(4) : activityId;
  
  // For COUNT001-01-A format:
  // - Unit: COUNT001
  // - Skill: COUNT001-01  
  // - Subskill: COUNT001-01-A
  
  const parts = cleanId.split('-');
  if (parts.length >= 3) {
    const unit = parts[0]; // COUNT001
    const skill = `${parts[0]}-${parts[1]}`; // COUNT001-01
    const subskill = cleanId; // COUNT001-01-A
    
    return { unit, skill, subskill, cleanId };
  }
  
  // Fallback for simpler IDs
  return { 
    unit: parts[0] || cleanId, 
    skill: cleanId, 
    subskill: cleanId, 
    cleanId 
  };
};


const ProblemSet: React.FC<ProblemSetProps> = ({ 
  currentTopic, 
  studentId = 1, 
  numProblems = 1,
  autoStart = false,
  fromDashboard = false
}) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSet, setLoadingSet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [problemAttempted, setProblemAttempted] = useState<boolean[]>([]);
  const [problemFeedback, setProblemFeedback] = useState<any[]>([]);
  const [primitiveResponses, setPrimitiveResponses] = useState<any[]>([]);
  const [usingRecommendations, setUsingRecommendations] = useState(false);
  const [usingMCQ, setUsingMCQ] = useState(false);
  const [usingFillInBlank, setUsingFillInBlank] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const problemRendererRef = useRef<ProblemRendererRef>(null);

  // Auto-start problem generation if specified
  useEffect(() => {
    if (autoStart && currentTopic && problems.length === 0 && !loadingSet) {
      setShowLoadingOverlay(true);
      generateProblemSet();
    }
  }, [currentTopic, autoStart]);

  // Generate a set of problems using the skill-based problems API
  const generateProblemSet = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingRecommendations(false);
    setUsingMCQ(false);
    setUsingFillInBlank(false);
    
    try {
      // Parse IDs from the current topic
      let skillId, subskillId, unitId;
      
      if (currentTopic.selection) {
        // Parse the subskill first since it contains the full hierarchy
        const subskillParsed = parseActivityId(currentTopic.selection.subskill || '');
        const skillParsed = parseActivityId(currentTopic.selection.skill || '');
        
        // Use subskill parsing as the primary source of truth
        unitId = subskillParsed.unit;
        subskillId = subskillParsed.subskill;
        
        // Derive skill_id from subskill_id if needed
        // For COUNT001-01-A, skill should be COUNT001-01
        if (subskillParsed.skill && subskillParsed.skill !== subskillParsed.unit) {
          skillId = subskillParsed.skill;
        } else {
          // Fallback to the skill selection if it looks more complete
          skillId = skillParsed.skill || skillParsed.cleanId;
        }
      } else if (currentTopic.id) {
        // Parse from activity ID directly
        const parsed = parseActivityId(currentTopic.id);
        unitId = parsed.unit;
        skillId = parsed.skill;
        subskillId = parsed.subskill;
      } else {
        throw new Error('No valid skill/subskill identifiers found in currentTopic');
      }
      
      console.log('=== DEBUG: ID Parsing ===');
      console.log('Original currentTopic:', JSON.stringify(currentTopic, null, 2));
      console.log('Parsed IDs:', { unitId, skillId, subskillId });
      
      // Validate required IDs
      if (!skillId || !subskillId) {
        throw new Error(`Missing required IDs - skill_id: ${skillId}, subskill_id: ${subskillId}`);
      }
      
      // Use the skill-based problem generation API
      const skillProblemsRequest = {
        subject: currentTopic.subject || 'mathematics',
        skill_id: skillId,
        subskill_id: subskillId,
        count: numProblems
      };
      
      console.log('=== API REQUEST ===');
      console.log('Requesting skill-based problems:', skillProblemsRequest);
      
      // Call the skill-problems API endpoint
      const problemsArray = await authApi.getSkillProblems(skillProblemsRequest);
      
      console.log('=== API RESPONSE ===');
      console.log('Problems received:', problemsArray);
      
      if (!problemsArray || problemsArray.length === 0) {
        throw new Error('No problems returned from skill-problems API');
      }
      
      setProblems(problemsArray);
      setProblemAttempted(new Array(problemsArray.length).fill(false));
      setProblemFeedback(new Array(problemsArray.length).fill(null));
      setPrimitiveResponses(new Array(problemsArray.length).fill(null));
      setCurrentIndex(0);
      
    } catch (error: any) {
      console.error('=== ERROR ===');
      console.error('Error generating problem set:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      });
      
      setError(`Failed to generate problems: ${error.message || 'Unknown error'}`);
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Generate recommended problems using recommendations API
  const generateRecommendedProblems = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingRecommendations(true);
    setUsingMCQ(false);
    setUsingFillInBlank(false);
    
    try {
      console.log('=== RECOMMENDATIONS REQUEST ===');
      
      const recommendedProblems = await authApi.getRecommendedProblems({
        subject: currentTopic.subject || 'mathematics',
        count: numProblems
      });
      
      console.log('Recommended problems received:', recommendedProblems);
      
      if (!recommendedProblems || recommendedProblems.length === 0) {
        throw new Error('No recommended problems returned');
      }
      
      setProblems(recommendedProblems);
      setProblemAttempted(new Array(recommendedProblems.length).fill(false));
      setProblemFeedback(new Array(recommendedProblems.length).fill(null));
      setCurrentIndex(0);
      
    } catch (error: any) {
      console.error('Error generating recommended problems:', error);
      setError(`Failed to generate recommended problems: ${error.message}`);
      setUsingRecommendations(false);
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Generate MCQ problems using MCQ API
  const generateMCQProblems = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingMCQ(true);
    setUsingRecommendations(false);
    setUsingFillInBlank(false);
    
    try {
      // Parse IDs from the current topic
      let skillId, subskillId, unitId;
      
      if (currentTopic.selection) {
        const subskillParsed = parseActivityId(currentTopic.selection.subskill || '');
        const skillParsed = parseActivityId(currentTopic.selection.skill || '');
        
        unitId = subskillParsed.unit;
        subskillId = subskillParsed.subskill;
        
        if (subskillParsed.skill && subskillParsed.skill !== subskillParsed.unit) {
          skillId = subskillParsed.skill;
        } else {
          skillId = skillParsed.skill || skillParsed.cleanId;
        }
      } else if (currentTopic.id) {
        const parsed = parseActivityId(currentTopic.id);
        unitId = parsed.unit;
        skillId = parsed.skill;
        subskillId = parsed.subskill;
      } else {
        throw new Error('No valid skill/subskill identifiers found in currentTopic');
      }
      
      console.log('=== MCQ GENERATION REQUEST ===');
      console.log('Parsed IDs:', { unitId, skillId, subskillId });
      
      // Validate required IDs
      if (!skillId || !subskillId) {
        throw new Error(`Missing required IDs - skill_id: ${skillId}, subskill_id: ${subskillId}`);
      }
      
      // Generate multiple MCQ problems
      const mcqProblems = [];
      for (let i = 0; i < numProblems; i++) {
        const mcqRequest = {
          subject: currentTopic.subject || 'mathematics',
          unit_id: unitId,
          skill_id: skillId,
          subskill_id: subskillId,
          difficulty: 'medium',
          distractor_style: 'plausible'
        };
        
        console.log(`Generating MCQ ${i + 1}/${numProblems}:`, mcqRequest);
        
        const mcq = await authApi.generateMCQ(mcqRequest);
        if (mcq) {
          mcqProblems.push(mcq);
        }
      }
      
      if (mcqProblems.length === 0) {
        throw new Error('Failed to generate any MCQ problems');
      }
      
      console.log('=== MCQ PROBLEMS GENERATED ===');
      console.log('MCQ problems received:', mcqProblems);
      
      setProblems(mcqProblems);
      setProblemAttempted(new Array(mcqProblems.length).fill(false));
      setProblemFeedback(new Array(mcqProblems.length).fill(null));
      setPrimitiveResponses(new Array(mcqProblems.length).fill(null));
      setCurrentIndex(0);
      
    } catch (error: any) {
      console.error('=== MCQ GENERATION ERROR ===');
      console.error('Error generating MCQ problems:', error);
      setError(`Failed to generate MCQ problems: ${error.message || 'Unknown error'}`);
      setUsingMCQ(false);
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Generate Fill-in-the-Blank problems using FillInBlank API
  const generateFillInBlankProblems = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingFillInBlank(true);
    setUsingMCQ(false);
    setUsingRecommendations(false);
    
    try {
      // Parse IDs from the current topic
      let skillId, subskillId, unitId;
      
      if (currentTopic.selection) {
        const subskillParsed = parseActivityId(currentTopic.selection.subskill || '');
        const skillParsed = parseActivityId(currentTopic.selection.skill || '');
        
        unitId = subskillParsed.unit;
        subskillId = subskillParsed.subskill;
        
        if (subskillParsed.skill && subskillParsed.skill !== subskillParsed.unit) {
          skillId = subskillParsed.skill;
        } else {
          skillId = skillParsed.skill || skillParsed.cleanId;
        }
      } else if (currentTopic.id) {
        const parsed = parseActivityId(currentTopic.id);
        unitId = parsed.unit;
        skillId = parsed.skill;
        subskillId = parsed.subskill;
      } else {
        throw new Error('No valid skill/subskill identifiers found in currentTopic');
      }
      
      console.log('=== FILL-IN-THE-BLANK GENERATION REQUEST ===');
      console.log('Parsed IDs:', { unitId, skillId, subskillId });
      
      // Validate required IDs
      if (!skillId || !subskillId) {
        throw new Error(`Missing required IDs - skill_id: ${skillId}, subskill_id: ${subskillId}`);
      }
      
      // Generate multiple Fill-in-the-Blank problems
      const fillInBlankProblems = [];
      for (let i = 0; i < numProblems; i++) {
        const fibRequest = {
          subject: currentTopic.subject || 'mathematics',
          unit_id: unitId,
          skill_id: skillId,
          subskill_id: subskillId,
          difficulty: 'medium',
          blank_style: 'standard'
        };
        
        console.log(`Generating Fill-in-the-Blank ${i + 1}/${numProblems}:`, fibRequest);
        
        const fib = await authApi.generateFillInBlank(fibRequest);
        if (fib) {
          fillInBlankProblems.push(fib);
        }
      }
      
      if (fillInBlankProblems.length === 0) {
        throw new Error('Failed to generate any Fill-in-the-Blank problems');
      }
      
      console.log('=== FILL-IN-THE-BLANK PROBLEMS GENERATED ===');
      console.log('Fill-in-the-Blank problems received:', fillInBlankProblems);
      
      setProblems(fillInBlankProblems);
      setProblemAttempted(new Array(fillInBlankProblems.length).fill(false));
      setProblemFeedback(new Array(fillInBlankProblems.length).fill(null));
      setPrimitiveResponses(new Array(fillInBlankProblems.length).fill(null));
      setCurrentIndex(0);
      
    } catch (error: any) {
      console.error('=== FILL-IN-THE-BLANK GENERATION ERROR ===');
      console.error('Error generating Fill-in-the-Blank problems:', error);
      setError(`Failed to generate Fill-in-the-Blank problems: ${error.message || 'Unknown error'}`);
      setUsingFillInBlank(false);
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Handle submission of the current problem
  const handleSubmit = async (submissionData: any) => {
    if (!problems[currentIndex]) return;
   
    setSubmitting(true);
    setError(null);
   
    try {
      const currentProblem = problems[currentIndex];
      
      // Parse IDs for submission
      const parsed = parseActivityId(
        currentProblem.metadata?.subskill?.id || 
        currentTopic.selection?.subskill || 
        currentTopic.id || 
        ''
      );

      let response;
      
      // If this is already a processed review (from MCQ/FIB components), use it directly
      if (submissionData.review || submissionData.originalReview) {
        response = submissionData;
      } else {
        // For composable/drawing problems, submit to backend
        const submission = {
          subject: currentTopic.subject || 'mathematics',
          problem: currentProblem,
          skill_id: parsed.skill,
          subskill_id: parsed.subskill,
          ...submissionData
        };
        
        console.log('=== SUBMISSION ===');
        console.log('Submitting problem:', {
          parsed_ids: parsed,
          submission_ids: {
            skill_id: parsed.skill,
            subskill_id: parsed.subskill
          }
        });
       
        response = await authApi.submitProblem(submission);
      }
      
      // Update the attempted and feedback states for this problem
      const newAttempted = [...problemAttempted];
      newAttempted[currentIndex] = true;
      setProblemAttempted(newAttempted);
      
      const newFeedback = [...problemFeedback];
      newFeedback[currentIndex] = response;
      setProblemFeedback(newFeedback);
      
      setFeedback(response);
    } catch (error: any) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    }
    
    setSubmitting(false);
  };

  // Navigation functions
  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback(problemFeedback[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFeedback(problemFeedback[currentIndex - 1]);
    }
  };

  // Handle primitive response updates
  const handlePrimitiveUpdate = (value: any) => {
    const newResponses = [...primitiveResponses];
    newResponses[currentIndex] = value;
    setPrimitiveResponses(newResponses);
  };

  // Calculation functions
  const calculateTotalScore = () => {
    return problemFeedback.reduce((sum, fb) => {
      if (fb && fb.review) {
        const reviewData = fb.review;
        let score = 0;
        
        if (typeof reviewData.evaluation === 'object' && reviewData.evaluation.score) {
          score = reviewData.evaluation.score;
        } else if (typeof reviewData.evaluation === 'number') {
          score = reviewData.evaluation;
        } else if (typeof reviewData.evaluation === 'string') {
          score = parseFloat(reviewData.evaluation);
        }
        
        return sum + score;
      }
      return sum;
    }, 0);
  };

  const calculateProgress = () => {
    const attemptedCount = problemAttempted.filter(Boolean).length;
    return (attemptedCount / problems.length) * 100;
  };

  // Completion notification
  const renderCompletionNotification = () => {
    if (problemAttempted.every(Boolean)) {
      if (fromDashboard) {
        const parsed = parseActivityId(currentTopic.selection?.subskill || currentTopic.id || '');
        
        return (
          <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <div className="flex items-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 mr-2" />
              <h3 className="font-bold text-green-800 text-lg">Learning Objective Complete!</h3>
            </div>
            <p className="text-green-700 mb-4">
              Outstanding work! You've successfully completed the practice problems for this learning objective.
            </p>
            <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Problems Completed:</span>
                  <span className="ml-2 font-bold text-green-600">{problems.length}/{problems.length}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Total Score:</span>
                  <span className="ml-2 font-bold text-green-600">{calculateTotalScore()}/{problems.length * 10}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => window.location.href = `/daily-learning/${parsed.subskill}`} 
                variant="outline"
                className="flex items-center"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Back to Learning Hub
              </Button>
              <Button 
                onClick={() => window.location.href = '/'} 
                className="bg-blue-600 hover:bg-blue-700 flex items-center"
              >
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          </div>
        );
      } else {
        return (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">Problem Set Complete!</h3>
            <p className="text-green-700 mb-4">
              You've completed all problems with a total score of {calculateTotalScore()} out of {problems.length * 10}.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateProblemSet();
                }}
                variant="outline"
              >
                Start New Set
              </Button>
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateRecommendedProblems();
                }}
                className="flex items-center justify-center"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Get Recommendations
              </Button>
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateMCQProblems();
                }}
                variant="outline"
                className="flex items-center justify-center"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Try Multiple Choice
              </Button>
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateFillInBlankProblems();
                }}
                variant="outline"
                className="flex items-center justify-center"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Try Fill-in-the-Blank
              </Button>
            </div>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <>
      {showLoadingOverlay && (
        <LoadingOverlay 
          isRecommended={usingRecommendations}
          message={usingRecommendations 
            ? "Creating personalized problems based on your learning history..." 
            : "Creating problem set for your selected topic..."}
        />
      )}
      
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Debug Information in Development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-xs font-mono">
              <div><strong>Current Topic:</strong> {JSON.stringify(currentTopic, null, 2)}</div>
              {currentTopic.selection && (
                <div><strong>Parsed Selection:</strong> {JSON.stringify({
                  skill: parseActivityId(currentTopic.selection.skill || ''),
                  subskill: parseActivityId(currentTopic.selection.subskill || '')
                }, null, 2)}</div>
              )}
            </div>
          )}

          {problems.length === 0 ? (
            <div className="flex flex-col gap-4 items-center">
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateProblemSet();
                }}
                disabled={loadingSet}
                size="lg"
                className="w-64"
              >
                {loadingSet ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating Problem Set...
                  </>
                ) : 'Start Standard Problem Set'}
              </Button>
              
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateRecommendedProblems();
                }}
                disabled={loadingSet}
                size="lg"
                variant="outline"
                className="w-64"
              >
                {loadingSet ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading Recommendations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get Recommended Problems
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateMCQProblems();
                }}
                disabled={loadingSet}
                size="lg"
                variant="outline"
                className="w-64"
              >
                {loadingSet ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating MCQ...
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Generate Multiple Choice
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => {
                  setShowLoadingOverlay(true);
                  generateFillInBlankProblems();
                }}
                disabled={loadingSet}
                size="lg"
                variant="outline"
                className="w-64"
              >
                {loadingSet ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Fill-in-the-Blank...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Generate Fill-in-the-Blank
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Problem Set Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-medium">
                    {usingMCQ
                      ? 'Multiple Choice Questions'
                      : usingFillInBlank
                        ? 'Fill-in-the-Blank Questions'
                        : usingRecommendations || fromDashboard
                          ? 'Recommended Problems' 
                          : `Problem Set: ${currentTopic.skill?.description || 'Mathematics'}`}
                  </h2>
                  {usingMCQ && (
                    <p className="text-sm text-purple-600 flex items-center">
                      <HelpCircle className="w-3 h-3 mr-1" />
                      Multiple choice practice questions
                    </p>
                  )}
                  {usingFillInBlank && (
                    <p className="text-sm text-orange-600 flex items-center">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Fill-in-the-blank practice questions
                    </p>
                  )}
                  {(usingRecommendations || fromDashboard) && !usingMCQ && !usingFillInBlank && (
                    <p className="text-sm text-blue-600 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Personalized based on your learning analytics
                    </p>
                  )}
                  {fromDashboard && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ From Learning Hub recommendation
                    </p>
                  )}
                </div>
                {problemAttempted.some(Boolean) && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Score: {calculateTotalScore()} / {problems.length * 10}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress indicator */}
              <div className="mb-1">
                <div className="flex justify-between mb-1 text-sm">
                  <span>Progress</span>
                  <span>{problemAttempted.filter(Boolean).length}/{problems.length} Problems</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${calculateProgress()}%` }}
                  ></div>
                </div>
              </div>

              {/* Problem navigation buttons */}
              <div className="flex gap-2 mb-2 overflow-x-auto py-2">
                {problems.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentIndex(index);
                      setFeedback(problemFeedback[index]);
                    }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all 
                      ${currentIndex === index 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : problemAttempted[index] 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              {/* Current problem display */}
              <div className="text-lg font-medium p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-gray-500">Problem {currentIndex + 1} of {problems.length}</span>
                  <div className="flex items-center gap-2">
                    {problems[currentIndex]?.metadata?.subskill?.description && (
                      <span className="text-sm px-2 py-1 rounded bg-purple-100 text-purple-800">
                        {problems[currentIndex].metadata.subskill.description}
                      </span>
                    )}
                    {problems[currentIndex]?.metadata?.difficulty && (
                      <span className="text-sm px-2 py-1 rounded bg-blue-100 text-blue-800">
                        Difficulty: {problems[currentIndex].metadata.difficulty.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  {/* Display question for MCQ, text_with_blanks for Fill-in-the-Blank, or prompt/problem for other types */}
                  {problems[currentIndex]?.question || 
                   problems[currentIndex]?.text_with_blanks || 
                   problems[currentIndex]?.prompt || 
                   problems[currentIndex]?.problem}
                </div>
              </div>
              
              {/* Use ProblemRenderer to delegate to appropriate component */}
              <ProblemRenderer
                ref={problemRendererRef}
                problem={problems[currentIndex]}
                isSubmitted={problemAttempted[currentIndex]}
                onSubmit={handleSubmit}
                onUpdate={handlePrimitiveUpdate}
                currentResponse={primitiveResponses[currentIndex]}
                feedback={problemFeedback[currentIndex]}
                submitting={submitting}
              />

              {/* Submit button */}
              {!problemAttempted[currentIndex] && (
                <Button 
                  onClick={async () => {
                    if (problemRendererRef.current) {
                      try {
                        await problemRendererRef.current.submitProblem();
                      } catch (error: any) {
                        console.error('Submission error:', error);
                        setError(error.message || 'Failed to submit answer. Please try again.');
                      }
                    }
                  }}
                  disabled={submitting}
                  size="lg"
                  className="w-full"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : 'Submit Answer'}
                </Button>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={currentIndex === problems.length - 1}
                  className="flex items-center gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Problem set completion summary */}
              {renderCompletionNotification()}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ProblemSet;
