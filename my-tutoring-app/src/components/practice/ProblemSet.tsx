'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, CheckCircle2, ThumbsUp, Lightbulb, ArrowRight, RefreshCw, Sparkles, Home, BookOpen } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import DrawingWorkspace from './DrawingWorkspace';
import LoadingOverlay from './LoadingOverlay';

interface Problem {
  problem_id: string;
  problem_type: string;
  problem: string;
  answer: string;
  success_criteria: string[];
  teaching_note: string;
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

// Helper function to extract feedback content
const getFeedbackContent = (feedback: any) => {
  if (!feedback || !feedback.review) return null;
  
  const reviewData = feedback.review;
  
  // Extract praise
  let praise = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.praise) {
    praise = reviewData.feedback.praise;
  } else if (typeof reviewData.feedback === 'string') {
    praise = reviewData.feedback;
  }
  
  // Extract guidance
  let guidance = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.guidance) {
    guidance = reviewData.feedback.guidance;
  }
  
  // Extract encouragement
  let encouragement = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.encouragement) {
    encouragement = reviewData.feedback.encouragement;
  }
  
  // Extract next steps
  let nextSteps = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.next_steps) {
    nextSteps = reviewData.feedback.next_steps;
  }
  
  // Extract score
  let score = 0;
  if (typeof reviewData.evaluation === 'object' && reviewData.evaluation.score) {
    score = reviewData.evaluation.score;
  } else if (typeof reviewData.evaluation === 'number') {
    score = reviewData.evaluation;
  } else if (typeof reviewData.evaluation === 'string') {
    score = parseFloat(reviewData.evaluation);
  }
  
  return { praise, guidance, encouragement, nextSteps, score };
};

const ProblemSet: React.FC<ProblemSetProps> = ({ 
  currentTopic, 
  studentId = 1, 
  numProblems = 5,
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
  const [usingRecommendations, setUsingRecommendations] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const drawingRef = useRef<any>(null);

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

  // Handle submission of the current problem
  const handleSubmit = async () => {
    if (!drawingRef.current || !problems[currentIndex]) return;
   
    setSubmitting(true);
    setError(null);
   
    try {
      const canvasData = await drawingRef.current.getCanvasData();
     
      if (!canvasData) {
        throw new Error('No drawing found. Please draw your answer before submitting.');
      }
     
      const currentProblem = problems[currentIndex];
      
      // Parse IDs for submission
      const parsed = parseActivityId(
        currentProblem.metadata?.subskill?.id || 
        currentTopic.selection?.subskill || 
        currentTopic.id || 
        ''
      );
      
      const submission = {
        subject: currentTopic.subject || 'mathematics',
        problem: currentProblem,
        solution_image: canvasData,
        skill_id: parsed.skill,
        subskill_id: parsed.subskill,
        student_answer: '',
        canvas_used: true
      };
     
      console.log('=== SUBMISSION ===');
      console.log('Submitting problem:', {
        parsed_ids: parsed,
        submission_ids: {
          skill_id: parsed.skill,
          subskill_id: parsed.subskill
        }
      });
     
      const response = await authApi.submitProblem(submission);
      
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
      
      if (!problemAttempted[currentIndex + 1] && drawingRef.current) {
        drawingRef.current.clearCanvas();
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFeedback(problemFeedback[currentIndex - 1]);
    }
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
                onClick={() => window.location.href = '/dashboard'} 
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          ) : (
            <div className="space-y-6">
              {/* Problem Set Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-medium">
                    {usingRecommendations || fromDashboard
                      ? 'Recommended Problems' 
                      : `Problem Set: ${currentTopic.skill?.description || 'Mathematics'}`}
                  </h2>
                  {(usingRecommendations || fromDashboard) && (
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
                  {problems[currentIndex]?.problem}
                </div>
              </div>
              
              <DrawingWorkspace 
                ref={drawingRef}
                loading={submitting}
              />

              {/* Feedback or submit button */}
              {!problemFeedback[currentIndex] ? (
                <Button 
                  onClick={handleSubmit}
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
              ) : (
                <div className="space-y-4">
                  {/* Custom feedback display */}
                  {(() => {
                    const feedback = problemFeedback[currentIndex];
                    const feedbackContent = getFeedbackContent(feedback);
                    if (!feedbackContent) return null;
                    
                    return (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                          <h3 className="text-sm font-medium flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                            Feedback
                          </h3>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                          {feedbackContent.praise && (
                            <div className="flex items-start">
                              <ThumbsUp className="w-4 h-4 mr-2 text-green-500 mt-0.5" />
                              <p className="text-green-700">{feedbackContent.praise}</p>
                            </div>
                          )}
                          
                          {feedbackContent.guidance && (
                            <div className="flex items-start">
                              <Lightbulb className="w-4 h-4 mr-2 text-blue-500 mt-0.5" />
                              <p className="text-blue-700">{feedbackContent.guidance}</p>
                            </div>
                          )}
                          
                          {feedbackContent.encouragement && (
                            <div className="flex items-start">
                              <ArrowRight className="w-4 h-4 mr-2 text-purple-500 mt-0.5" />
                              <p className="text-purple-700">{feedbackContent.encouragement}</p>
                            </div>
                          )}
                          
                          {feedbackContent.nextSteps && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-sm text-slate-600">
                                {feedbackContent.nextSteps}
                              </p>
                            </div>
                          )}
                          
                          {feedbackContent.score > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Score:</span>
                                <span className="text-sm font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                  {feedbackContent.score}/10
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
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