'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, CheckCircle2, ThumbsUp, Lightbulb, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
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
    concept_group?: string; // Added for new API
  };
}

interface ProblemSetProps {
  currentTopic: any;
  studentId?: number;
  numProblems?: number;
  autoStart?: boolean;
  fromDashboard?: boolean; // Added to track if this came from dashboard recommendation
}

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
  const [useComposableProblems, setUseComposableProblems] = useState(false);
  const drawingRef = useRef<any>(null);

  // Auto-start problem generation if specified - MODIFIED to never use recommendations by default
  useEffect(() => {
    if (autoStart && currentTopic && problems.length === 0 && !loadingSet) {
      // Always use standard problem set by default, even when coming from dashboard
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
      // Use the new skill-based problem generation API
      const skillProblemsRequest = {
        student_id: studentId,
        subject: currentTopic.subject || 'mathematics',
        skill_id: currentTopic.selection.skill,
        subskill_id: currentTopic.selection.subskill,
        count: numProblems
      };
      
      console.log('Requesting skill-based problems:', skillProblemsRequest);
      
      // Call the new API endpoint
      const problemsArray = await api.getSkillProblems(skillProblemsRequest);
      
      setProblems(problemsArray);
      // Initialize attempt and feedback tracking arrays
      setProblemAttempted(new Array(problemsArray.length).fill(false));
      setProblemFeedback(new Array(problemsArray.length).fill(null));
      setCurrentIndex(0);
    } catch (error: any) {
      console.error('Error generating problem set:', error);
      setError(error.message || 'An error occurred while generating the problem set.');
      
      // If the skill-based problem generation fails, fall back to the old method
      try {
        console.warn('Falling back to individual problem generation');
        await generateProblemSetFallback();
      } catch (fallbackError: any) {
        console.error('Fallback also failed:', fallbackError);
        setError('Failed to generate problems. Please try again later.');
      }
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Fallback to the original method of generating problems one by one
  const generateProblemSetFallback = async () => {
    const problemsArray = [];
    
    // Generate multiple problems for the set using the original method
    for (let i = 0; i < numProblems; i++) {
      const problemRequest = {
        subject: currentTopic.subject,
        unit: {
          id: currentTopic.selection.unit,
          title: currentTopic.unit?.title || ''
        },
        skill: {
          id: currentTopic.selection.skill,
          description: currentTopic.skill?.description || ''
        },
        subskill: {
          id: currentTopic.selection.subskill,
          description: currentTopic.subskill?.description || ''
        },
        difficulty: currentTopic.difficulty_range?.target || 3.0
      };
      
      const response = await api.generateProblem(problemRequest);
      problemsArray.push(response);
    }
    
    setProblems(problemsArray);
    // Initialize attempt and feedback tracking arrays
    setProblemAttempted(new Array(problemsArray.length).fill(false));
    setProblemFeedback(new Array(problemsArray.length).fill(null));
    setCurrentIndex(0);
  };

  // Generate composable problems using the new primitives system
  const generateComposableProblems = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingRecommendations(false);
    
    try {
      const problemsArray = [];
      
      // Generate multiple composable problems
      for (let i = 0; i < numProblems; i++) {
        const problemRequest = {
          subject: currentTopic.subject,
          unit_id: currentTopic.selection.unit,
          skill_id: currentTopic.selection.skill,
          subskill_id: currentTopic.selection.subskill,
          difficulty: currentTopic.difficulty_range?.target || 3.0
        };
        
        console.log('Requesting composable problem:', problemRequest);
        
        const response = await authApi.generateComposableProblem(problemRequest);
        
        // The response should include composable_template field
        if (response.composable_template) {
          // Add the composable template to the problem data
          const problemWithTemplate = {
            ...response,
            problem_data: {
              ...response,
              template: response.composable_template
            }
          };
          problemsArray.push(problemWithTemplate);
        } else {
          console.warn('Composable problem missing template:', response);
          problemsArray.push(response);
        }
      }
      
      setProblems(problemsArray);
      setProblemAttempted(new Array(problemsArray.length).fill(false));
      setProblemFeedback(new Array(problemsArray.length).fill(null));
      setCurrentIndex(0);
      
      console.log('Generated composable problems:', problemsArray);
      
    } catch (error: any) {
      console.error('Error generating composable problems:', error);
      setError(error.message || 'Failed to generate composable problems. Try regular problems instead.');
    }
    
    setLoadingSet(false);
    setShowLoadingOverlay(false);
  };

  // Generate recommended problems based on student analytics - kept for manual use
  const generateRecommendedProblems = async () => {
    setLoadingSet(true);
    setError(null);
    setFeedback(null);
    setUsingRecommendations(true);
    
    try {
      // If from dashboard recommendation and has specific subskill, use skill-based problems API
      if (fromDashboard && currentTopic.selection.subskill) {
        const skillProblemsRequest = {
          student_id: studentId,
          subject: currentTopic.subject || 'mathematics',
          skill_id: currentTopic.selection.skill,
          subskill_id: currentTopic.selection.subskill,
          count: numProblems
        };
        
        console.log('Requesting skill-based problems for recommendation:', skillProblemsRequest);
        
        // Call the new API endpoint
        const problemsArray = await api.getSkillProblems(skillProblemsRequest);
        
        setProblems(problemsArray);
        // Initialize attempt and feedback tracking arrays
        setProblemAttempted(new Array(problemsArray.length).fill(false));
        setProblemFeedback(new Array(problemsArray.length).fill(null));
      } else {
        // Otherwise use the general recommendation API
        const recommendedProblems = await api.getRecommendedProblems({
          student_id: studentId,
          subject: currentTopic.subject || 'mathematics',
          count: numProblems,
          subskill_id: fromDashboard ? currentTopic.selection.subskill : undefined
        });
        
        // Set the problems state with the received data
        setProblems(recommendedProblems);
        
        // Initialize attempt and feedback tracking arrays
        setProblemAttempted(new Array(recommendedProblems.length).fill(false));
        setProblemFeedback(new Array(recommendedProblems.length).fill(null));
      }
      
      setCurrentIndex(0);
    } catch (error: any) {
      console.error('Error generating recommended problems:', error);
      setError(error.message || 'An error occurred while generating recommended problems.');
      
      // Fallback to standard problem generation if recommendations fail
      setUsingRecommendations(false);
      await generateProblemSet();
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
      
      const submission = {
        subject: currentTopic.subject || 'mathematics',
        problem: currentProblem,
        solution_image: canvasData,
        skill_id: currentProblem.metadata?.skill?.id || currentTopic.selection?.skill || '',
        subskill_id: currentProblem.metadata?.subskill?.id || currentTopic.selection?.subskill || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId
      };
     
      const response = await api.submitProblem(submission);
      
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

  // Navigation functions - unchanged
  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback(problemFeedback[currentIndex + 1]);
      
      // Clear canvas for the next problem if it hasn't been attempted
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

  // Calculation functions - unchanged
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

  // UI helper function - unchanged
  const renderCompletionNotification = () => {
    if (fromDashboard && problemAttempted.every(Boolean)) {
      return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Recommendation Complete!</h3>
          <p className="text-blue-700">
            Great job completing this recommended problem set! This will help improve your proficiency in this skill area.
          </p>
          <div className="mt-2">
            <Button onClick={() => window.location.href = '/'} variant="outline" className="mt-2">
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
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
                  setUseComposableProblems(true);
                  setShowLoadingOverlay(true);
                  generateComposableProblems();
                }}
                disabled={loadingSet}
                size="lg"
                className="w-64 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loadingSet ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating Interactive Problems...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🎯</span>
                    Try Interactive Problems!
                  </>
                )}
              </Button>
              
              <div className="text-center text-sm text-gray-500 max-w-lg">
                <p><strong>Interactive Problems:</strong> Step-by-step guided activities with drag-and-drop, number tracing, and visual interactions!</p>
              </div>
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
                    {useComposableProblems && (
                      <span className="ml-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2 py-1 rounded-full">
                        Interactive
                      </span>
                    )}
                  </h2>
                  {(usingRecommendations || fromDashboard) && (
                    <p className="text-sm text-blue-600 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Personalized based on your learning analytics
                    </p>
                  )}
                  {useComposableProblems && (
                    <p className="text-sm text-purple-600 flex items-center">
                      <span className="mr-1">🎯</span>
                      Interactive step-by-step problems
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
                    className="bg-blue-500 h-2 rounded-full" 
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
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center 
                      ${currentIndex === index 
                        ? 'bg-blue-500 text-white' 
                        : problemAttempted[index] 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-700'}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              {/* Current problem display - ProblemReader removed */}
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
                    {problems[currentIndex]?.metadata?.concept_group && (
                      <span className="text-sm px-2 py-1 rounded bg-green-100 text-green-800">
                        {problems[currentIndex].metadata.concept_group}
                      </span>
                    )}
                  </div>
                </div>
                {/* Problem text displayed directly without ProblemReader */}
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
                      <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          <h3 className="text-sm font-medium flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                            Feedback
                          </h3>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                          {feedbackContent.praise && (
                            <div className="flex items-start">
                              <ThumbsUp className="w-4 h-4 mr-2 text-green-500 mt-0.5" />
                              <p className="text-green-700 dark:text-green-400">{feedbackContent.praise}</p>
                            </div>
                          )}
                          
                          {feedbackContent.guidance && (
                            <div className="flex items-start">
                              <Lightbulb className="w-4 h-4 mr-2 text-blue-500 mt-0.5" />
                              <p className="text-blue-700 dark:text-blue-400">{feedbackContent.guidance}</p>
                            </div>
                          )}
                          
                          {feedbackContent.encouragement && (
                            <div className="flex items-start">
                              <ArrowRight className="w-4 h-4 mr-2 text-purple-500 mt-0.5" />
                              <p className="text-purple-700 dark:text-purple-400">{feedbackContent.encouragement}</p>
                            </div>
                          )}
                          
                          {feedbackContent.nextSteps && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {feedbackContent.nextSteps}
                              </p>
                            </div>
                          )}
                          
                          {feedbackContent.score > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Score:</span>
                                <span className="text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-0.5 rounded">
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

              {/* Problem set completion summary - only show when all problems are attempted */}
              {problemAttempted.every(Boolean) && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-2">Problem Set Complete!</h3>
                  <p className="text-green-700">
                    You've completed all problems in this set with a total score of {calculateTotalScore()} out of {problems.length * 10}.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <Button 
                      onClick={() => {
                        setUseComposableProblems(false);
                        setShowLoadingOverlay(true);
                        generateProblemSet();
                      }}
                      variant="outline"
                    >
                      📝 New Regular Set
                    </Button>
                    <Button 
                      onClick={() => {
                        setUseComposableProblems(true);
                        setShowLoadingOverlay(true);
                        generateComposableProblems();
                      }}
                      className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <span className="mr-2">🎯</span>
                      Try Interactive!
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowLoadingOverlay(true);
                        generateRecommendedProblems();
                      }}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Get Recommendations
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Dashboard recommendation completion notification */}
              {renderCompletionNotification()}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ProblemSet;