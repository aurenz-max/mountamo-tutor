import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, FileText, Loader2, TrendingUp, AlertCircle, Lightbulb, Target, HelpCircle, GraduationCap, RotateCcw, ChevronDown, ChevronUp, X, ThumbsUp, AlertTriangle, Star, Trophy } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { useEngagement } from '@/contexts/EngagementContext';

interface PracticeContentProps {
  content: {
    problems: Array<{
      id: string;
      problem_id: string;
      type: string;
      subject: string;
      skill_id: string;
      subskill_id: string;
      difficulty: number;
      timestamp: string;
      problem_data: {
        problem_type: string;
        problem: string;
        options?: string[];
        correct_answer: string;
        answer?: string; // Some problems have this instead of correct_answer
        success_criteria?: string[];
        teaching_note?: string;
        grade_level?: string;
        metadata?: any;
        // Simplified problem fields
        visual_type?: string;
      };
    }>;
    problem_count: number;
    estimated_time_minutes: number;
    grade_level?: string;
  };
  isCompleted: boolean;
  onComplete: () => void;
  onAskAI: (message: string) => void;
  studentId?: number;
}

// Import your existing DrawingCanvas and ProblemRenderer
import DrawingCanvas from '@/components/packages/ui/DrawingCanvas'; // Adjust path as needed
import ProblemRenderer, { type ProblemRendererRef } from '@/components/practice/ProblemRenderer';

export function PracticeContent({ 
  content, 
  isCompleted, 
  onComplete, 
  onAskAI, 
  studentId = 1 
}: PracticeContentProps) {
  // Engagement tracking
  const { processEngagementResponse } = useEngagement();
  const [isRefreshingProblems, setIsRefreshingProblems] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, {
    type: 'option' | 'text' | 'canvas';
    value: number | string | null;
    feedback?: any;
    isSubmitted?: boolean;
    attempts?: number;
  }>>({});
  const [reviewMode, setReviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showWorkArea, setShowWorkArea] = useState(false);
  const [inContextHint, setInContextHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  
  const canvasRef = useRef<any>(null);
  const problemRendererRef = useRef<ProblemRendererRef>(null);

  // Helper function to determine if problem needs ProblemRenderer
  const needsProblemRenderer = (problem: any) => {
    const problemData = problem.problem_data;
    const fullProblemData = problemData.full_problem_data || {};
    
    // Check for structured problem types that ProblemRenderer handles
    return !!(
      problemData.template || // Visual/composable problems
      (fullProblemData.question && fullProblemData.options && Array.isArray(fullProblemData.options)) || // MCQ with structured options
      fullProblemData.text_with_blanks || // Fill-in-the-blank
      (fullProblemData.left_items && fullProblemData.right_items) || // Matching
      (fullProblemData.statement && fullProblemData.correct !== undefined) || // True/False
      fullProblemData.items || // Sequencing
      fullProblemData.categories || // Categorization
      fullProblemData.scenario // Scenario questions
    );
  };

  // Helper function to transform package problem data to ProblemRenderer format
  const transformProblemData = (problem: any) => {
    const problemData = problem.problem_data;
    const fullProblemData = problemData.full_problem_data || {};
    
    // For multiple choice problems - check full_problem_data first
    if (fullProblemData.options && Array.isArray(fullProblemData.options)) {
      return {
        ...fullProblemData,
        question: fullProblemData.question || problemData.problem,
        rationale: fullProblemData.rationale || problemData.teaching_note,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For fill-in-the-blank problems
    if (fullProblemData.text_with_blanks && fullProblemData.blanks) {
      return {
        ...fullProblemData,
        question: fullProblemData.text_with_blanks,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For true/false problems
    if (fullProblemData.statement && fullProblemData.correct !== undefined) {
      return {
        ...fullProblemData,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For matching problems
    if (fullProblemData.left_items && fullProblemData.right_items) {
      return {
        ...fullProblemData,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For categorization problems
    if (fullProblemData.categories && fullProblemData.categorization_items) {
      return {
        ...fullProblemData,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For scenario questions
    if (fullProblemData.scenario && fullProblemData.scenario_question) {
      return {
        ...fullProblemData,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For sequencing problems
    if (fullProblemData.items && Array.isArray(fullProblemData.items)) {
      return {
        ...fullProblemData,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // Fallback - check old format at top level
    if (problemData.options && Array.isArray(problemData.options)) {
      // If options are strings (old format), create object structure
      const correctAnswer = problemData.correct_answer || problemData.answer;
      const correctOptionId = problemData.options.findIndex((opt: string) => opt === correctAnswer);
      
      return {
        ...problemData,
        question: problemData.problem,
        options: problemData.options.map((opt: string, idx: number) => ({
          id: String.fromCharCode(65 + idx), // A, B, C, D...
          text: opt
        })),
        correct_option_id: correctOptionId >= 0 ? String.fromCharCode(65 + correctOptionId) : undefined,
        rationale: problemData.teaching_note,
        // Include required fields from the parent problem
        subject: problem.subject || problemData.subject || 'Unknown',
        unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
        skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
        subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
      };
    }
    
    // For other types, return as-is with problem mapped to question
    return {
      ...problemData,
      question: problemData.problem,
      // Include required fields from the parent problem
      subject: problem.subject || problemData.subject || 'Unknown',
      unit_id: problem.unit_id || problemData.unit_id || 'default_unit',
      skill_id: problem.skill_id || problemData.skill_id || problemData.metadata?.skill?.id || 'default_skill',
      subskill_id: problem.subskill_id || problemData.subskill_id || problemData.metadata?.subskill?.id || 'default_subskill'
    };
  };

  if (!content.problems || content.problems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Practice Problems Available</h3>
            <p className="text-gray-500 mb-4">This package doesn't include practice problems yet.</p>
            <Button
              variant="outline"
              onClick={() => onAskAI("Can you create some practice problems for this topic?")}
            >
              Ask AI to create practice problems
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentProblem = content.problems[currentQuestion];
  const currentAnswer = questionAnswers[currentQuestion];
  const allAnswered = Object.keys(questionAnswers).length === content.problems.length;

  // Get the correct answer - handle both formats
  const getCorrectAnswer = () => {
    return currentProblem.problem_data.correct_answer || currentProblem.problem_data.answer;
  };

  // Enhanced helper function for creating structured help prompts
  const createPracticeHelpPrompt = (problem: any, helpType: 'hint' | 'approach' | 'stuck' = 'hint') => {
    const problemText = problem.problem_data.problem;
    const correctAnswer = problem.problem_data.correct_answer || problem.problem_data.answer;
    const problemType = problem.problem_data.problem_type;
    
    let helpPrompt = `I need help with this practice problem:

PROBLEM: ${problemText}

PROBLEM TYPE: ${problemType}

INSTRUCTOR NOTE: This student is asking for help with the above problem. The correct answer is "${correctAnswer}" but DO NOT reveal this to the student. Instead:

1. Guide them through the thinking process using questions
2. Help them identify what the problem is asking for  
3. Break it down into smaller steps
4. Ask them to explain their reasoning
5. Point them toward the right approach without giving away the answer
6. Encourage them to try different strategies if they're stuck

`;

    // Customize the prompt based on help type
    switch (helpType) {
      case 'hint':
        helpPrompt += `Please give me a hint to get started with this problem, but don't solve it for me!`;
        break;
      case 'approach':
        helpPrompt += `Can you help me understand what approach I should take to solve this problem? Don't give me the answer, just help me think about the strategy.`;
        break;
      case 'stuck':
        helpPrompt += `I'm stuck on this problem. Can you ask me some questions to help me think through it step by step?`;
        break;
    }
    
    return helpPrompt;
  };

  // Get hint directly and show inline
  const getInContextHint = async (helpType: 'hint' | 'approach' | 'stuck' = 'hint') => {
    setIsLoadingHint(true);
    setInContextHint(null);
    
    try {
      // Simulate getting AI response - in a real implementation you'd have an API call here
      const prompt = createPracticeHelpPrompt(currentProblem, helpType);
      onAskAI(prompt);
      
      // For now, show a placeholder - you'd replace this with actual AI response
      setTimeout(() => {
        let hintText = '';
        switch (helpType) {
          case 'hint':
            hintText = '💡 Think about what the problem is asking you to find first. What information are you given?';
            break;
          case 'approach':
            hintText = '🎯 Break this problem down into smaller steps. What would be your first step?';
            break;
          case 'stuck':
            hintText = '❓ Let me ask you this: What part of the problem seems most confusing to you right now?';
            break;
        }
        setInContextHint(hintText);
        setIsLoadingHint(false);
      }, 1000);
    } catch (error) {
      setIsLoadingHint(false);
    }
  };

  // Render help buttons for tools column
  const renderHelpButtons = () => {
    if (currentAnswer?.isSubmitted) {
      return null;
    }

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-800 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-600" />
          Need Help?
        </h4>
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getInContextHint('hint')}
            className="w-full justify-start text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Get a Hint
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getInContextHint('approach')}
            className="w-full justify-start text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            Help with Approach
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getInContextHint('stuck')}
            className="w-full justify-start text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            I'm Stuck!
          </Button>
        </div>
      </div>
    );
  };

  // Render post-submission help for tools column
  const renderPostSubmissionHelp = () => {
    if (!currentAnswer?.isSubmitted || !currentAnswer?.feedback) {
      return null;
    }
    
    const score = getScore(currentAnswer.feedback.review);
    
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-800">Additional Help</h4>
        {score >= 8 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAskAI(`I got this problem correct: "${currentProblem.problem_data.problem}". Can you explain why this approach works and show me how this concept applies to real-world situations?`)}
            className="w-full justify-start text-green-700 hover:bg-green-50 flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            Learn More About This Concept
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAskAI(`I got this problem wrong: "${currentProblem.problem_data.problem}". My answer was incorrect. Can you help me understand where I went wrong and how to think about this type of problem correctly? Don't just give me the answer - help me learn the approach.`)}
              className="w-full justify-start text-amber-700 hover:bg-amber-50 flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              Learn from Mistake
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAskAI(`Can you give me a similar practice problem to this one so I can try the concept again? Problem: "${currentProblem.problem_data.problem}"`)}
              className="w-full justify-start text-amber-700 hover:bg-amber-50 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Similar Problem
            </Button>
          </div>
        )}
      </div>
    );
  };

  const submitProblemToBackend = async (answerData: {
    type: 'option' | 'text' | 'canvas' | 'visual';
    value: number | string | null;
    canvasData?: string;
    primitiveAnswer?: any;
  }) => {
    if (!currentProblem) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      let response;
      
      // If this is already a processed review (from primitive components), use it directly
      if (answerData.primitiveAnswer && (answerData.primitiveAnswer.review || answerData.primitiveAnswer.originalReview)) {
        response = answerData.primitiveAnswer;
      } else {
        // For all other problems, submit to unified backend endpoint using ProblemSet.tsx structure
        const submission = {
          subject: currentProblem.subject || 'mathematics',
          problem: currentProblem.problem_data, // Use the problem_data structure like ProblemSet
          skill_id: currentProblem.skill_id,
          subskill_id: currentProblem.subskill_id,
          // Include primitive_response for structured problems
          primitive_response: answerData.primitiveAnswer || null
        };

        // Add additional fields based on answer type
        if (answerData.type === 'option' && answerData.value !== null) {
          const options = currentProblem.problem_data.full_problem_data?.options || currentProblem.problem_data.options;
          if (options && Array.isArray(options)) {
            const selectedOption = options[answerData.value as number];
            submission.student_answer = typeof selectedOption === 'string' ? selectedOption : selectedOption.text;
          }
        } else if (answerData.type === 'text') {
          submission.student_answer = answerData.value as string;
        } else if (answerData.type === 'canvas') {
          submission.student_answer = 'Canvas submission';
          submission.canvas_used = true;
        } else if (answerData.type === 'visual') {
          submission.student_answer = 'Visual/primitive response';
        }

        // Only include canvas data if there's actual canvas work
        if (answerData.canvasData && answerData.canvasData !== 'data:image/png;base64,') {
          submission.solution_image = answerData.canvasData;
        }

        console.log('=== PACKAGES SUBMISSION ===');
        console.log('Submitting to unified endpoint:', {
          problem_type: currentProblem.problem_data.problem_type,
          skill_id: currentProblem.skill_id,
          subskill_id: currentProblem.subskill_id,
          has_primitive_response: !!submission.primitive_response,
          submission_keys: Object.keys(submission)
        });
       
        // Use the unified submission endpoint (same as ProblemSet)
        response = await authApi.submitProblem(submission);
      }

      // Process engagement response for XP animations and toast notifications
      if (response && typeof response === 'object' && 'xp_earned' in response) {
        // Format the response to match the expected engagement format
        const engagementResponse = {
          success: true,
          xp_earned: response.xp_earned || 0,
          base_xp: response.base_xp || response.xp_earned || 0,
          streak_bonus_xp: response.streak_bonus_xp || 0,
          total_xp: response.total_xp || 0,
          level_up: response.level_up || false,
          new_level: response.new_level || 1,
          previous_level: response.previous_level || 1,
          current_streak: response.current_streak || 0,
          previous_streak: response.previous_streak || 0,
          points_earned: response.points_earned || response.xp_earned || 0,
          engagement_transaction: response.engagement_transaction || null
        };
        
        processEngagementResponse(engagementResponse);
      }

      // Get the score to determine next steps
      const score = getScore(response.review);
      const currentAttempts = (questionAnswers[currentQuestion]?.attempts || 0) + 1;
      
      // Store the feedback
      setQuestionAnswers(prev => ({
        ...prev,
        [currentQuestion]: {
          ...answerData,
          feedback: {
            review: response.review,
            competency: response.competency
          },
          isSubmitted: score >= 8 || currentAttempts >= 2, // Only mark as submitted if correct OR this is their second attempt
          attempts: currentAttempts
        }
      }));

      // Implement Multi-Stage Feedback Logic
      if (score < 8 && currentAttempts === 1) {
        // First incorrect attempt - enter review mode
        setReviewMode(true);
        setShowExplanation(false); // Don't show full explanation yet
      } else {
        // Either correct answer or second attempt - show full feedback
        setReviewMode(false);
        setShowExplanation(true);
      }

      // Send feedback to AI tutor with enhanced context
      const feedbackText = getFeedbackText(response.review);
      
      onAskAI(`I just submitted my answer for: "${currentProblem.problem_data.problem}" 
        
My answer was: ${studentAnswer}
Score received: ${score}/10
Feedback: ${feedbackText}

INSTRUCTOR NOTE: The student just submitted an answer. Please provide encouraging feedback about their work and briefly explain the concept without giving away answers to future problems. Focus on the learning process and celebrating their effort.`);

    } catch (error) {
      console.error('Error submitting problem:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    // No auto-submit - user must click Submit Work button
  };
  
  // Multi-Stage Feedback handlers
  const handleTryAgain = () => {
    setReviewMode(false);
    setShowExplanation(false);
    // Clear the canvas for a fresh attempt
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
    // Reset any selected answers but keep the question data for attempt tracking
    setSelectedAnswer(null);
    setTextAnswer('');
  };
  
  const handleShowAnswer = () => {
    setReviewMode(false);
    setShowExplanation(true);
    // Mark as fully submitted
    setQuestionAnswers(prev => ({
      ...prev,
      [currentQuestion]: {
        ...prev[currentQuestion],
        isSubmitted: true
      }
    }));
  };
  
  // Try Another Set functionality for replayability
  const handleTryAnotherSet = async () => {
    setIsRefreshingProblems(true);
    try {
      // Clear all current answers and reset state
      setQuestionAnswers({});
      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setTextAnswer('');
      setShowExplanation(false);
      setSubmissionError(null);
      setInContextHint(null);
      setIsLoadingHint(false);
      setReviewMode(false);
      
      // Clear canvas
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
      }
      
      // Force a page refresh to trigger dynamic problem hydration
      // The backend will automatically generate new problems when the package is fetched again
      window.location.reload();
      
    } catch (error) {
      console.error('Error refreshing problems:', error);
      setSubmissionError('Failed to load new problems. Please try again.');
    } finally {
      setIsRefreshingProblems(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textAnswer.trim()) return;
    
    const answerData = {
      type: 'text' as const,
      value: textAnswer.trim()
    };

    await submitProblemToBackend(answerData);
  };

  const handleCanvasSubmit = async () => {
    if (!canvasRef.current) return;
    
    const canvasData = canvasRef.current.getCanvasData();
    if (!canvasData) {
      alert('Please draw your solution on the canvas first.');
      return;
    }

    const answerData = {
      type: 'canvas' as const,
      value: null,
      canvasData
    };

    await submitProblemToBackend(answerData);
  };

  const navigateQuestion = (direction: 'prev' | 'next' | number) => {
    let newIndex: number;
    
    if (typeof direction === 'number') {
      newIndex = direction;
    } else if (direction === 'prev') {
      newIndex = Math.max(0, currentQuestion - 1);
    } else {
      newIndex = Math.min(content.problems.length - 1, currentQuestion + 1);
    }
    
    setCurrentQuestion(newIndex);
    const answer = questionAnswers[newIndex];
    
    // Reset UI state
    setSelectedAnswer(answer?.type === 'option' ? answer.value as number : null);
    setTextAnswer(answer?.type === 'text' ? answer.value as string : '');
    setShowExplanation(!!answer?.isSubmitted);
    setSubmissionError(null);
    setInContextHint(null);
    setIsLoadingHint(false);
    setShowWorkArea(false);
    setReviewMode(false); // Reset review mode when navigating
    
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  const isCorrectAnswer = (optionIndex: number) => {
    const options = currentProblem.problem_data.full_problem_data?.options || currentProblem.problem_data.options;
    if (!options || !Array.isArray(options)) return false;
    
    const fullProblemData = currentProblem.problem_data.full_problem_data;
    
    // If using structured data with correct_option_id
    if (fullProblemData && fullProblemData.correct_option_id) {
      const option = options[optionIndex];
      return typeof option === 'object' ? option.id === fullProblemData.correct_option_id : false;
    }
    
    // Fallback to string comparison
    const correctAnswer = getCorrectAnswer();
    const option = options[optionIndex];
    const optionText = typeof option === 'string' ? option : option.text;
    return optionText === correctAnswer;
  };

  // Helper functions for feedback (borrowed from ProblemPanel)
  const getScore = (review: any) => {
    if (!review?.evaluation) return null;
    return typeof review.evaluation === 'number' 
      ? review.evaluation 
      : review.evaluation?.score || 0;
  };

  const getFeedbackText = (review: any) => {
    if (!review?.feedback) return '';
    return typeof review.feedback === 'string' 
      ? review.feedback 
      : review.feedback?.praise || 'Good effort!';
  };

  // Single submit function for all work (canvas + multiple choice selection + visual)
  const handleSubmitWork = async () => {
    if (currentAnswer?.isSubmitted) return;

    // For problems that use ProblemRenderer, let it handle submission through onSubmit callback
    if (needsProblemRenderer(currentProblem) && problemRendererRef.current) {
      try {
        await problemRendererRef.current.submitProblem();
      } catch (error: any) {
        console.error('Submission error:', error);
        setSubmissionError(error.message || 'Failed to submit answer. Please try again.');
      }
      return;
    }

    const canvasData = canvasRef.current?.getCanvasData();

    // For multiple choice, submit the selected option (with optional canvas work)
    const options = currentProblem.problem_data.full_problem_data?.options || currentProblem.problem_data.options;
    if (options && Array.isArray(options)) {
      if (selectedAnswer === null) {
        alert('Please select an answer before submitting.');
        return;
      }
      
      const answerData = {
        type: 'option' as const,
        value: selectedAnswer,
        canvasData: canvasData || null
      };
      await submitProblemToBackend(answerData);
      return;
    }

    // For all other types, submit canvas work
    if (canvasData) {
      const answerData = {
        type: 'canvas' as const,
        value: null,
        canvasData
      };
      await submitProblemToBackend(answerData);
      return;
    }

    // Allow submission even without canvas work for open-ended questions
    const answerData = {
      type: 'canvas' as const,
      value: 'No work shown',
      canvasData: null
    };
    await submitProblemToBackend(answerData);
  };

  // Check if user has provided any answer or work
  const hasAnswer = () => {
    // For problems that use ProblemRenderer, check if primitive answer exists
    if (needsProblemRenderer(currentProblem)) {
      return currentAnswer?.primitiveAnswer != null;
    }
    // For multiple choice, check if option is selected
    const options = currentProblem.problem_data.full_problem_data?.options || currentProblem.problem_data.options;
    if (options && Array.isArray(options)) {
      return selectedAnswer !== null;
    }
    // For other types, always allow submission (they can use canvas or not)
    return true;
  };
  
  // Check if there's canvas work
  const hasCanvasWork = () => {
    return canvasRef.current?.getCanvasData();
  };

  const renderAnswerInterface = () => {
    // Check if this is a specialized problem type that should use ProblemRenderer
    if (needsProblemRenderer(currentProblem)) {
      return (
        <div className="space-y-4">
          <ProblemRenderer
            ref={problemRendererRef}
            problem={transformProblemData(currentProblem)}
            isSubmitted={currentAnswer?.isSubmitted || false}
            currentResponse={currentAnswer?.primitiveAnswer}
            feedback={currentAnswer?.feedback}
            onSubmit={async (submissionData) => {
              // Handle submission from ProblemRenderer using the same structure as ProblemSet
              const answerData = {
                type: 'visual' as const,
                value: 'visual_response',
                primitiveAnswer: submissionData.primitive_response || submissionData,
                canvasData: null // ProblemRenderer handles its own visual elements
              };
              await submitProblemToBackend(answerData);
            }}
            onUpdate={(value) => {
              // Store the primitive answer for submission
              setQuestionAnswers(prev => ({
                ...prev,
                [currentQuestion]: {
                  type: 'visual' as const,
                  value: 'visual_response',
                  primitiveAnswer: value,
                  isSubmitted: false,
                  attempts: prev[currentQuestion]?.attempts || 0
                }
              }));
            }}
            submitting={isSubmitting}
          />
        </div>
      );
    }
    
    // Multiple Choice - show options for selection only (fallback for simple string options)
    const options = currentProblem.problem_data.full_problem_data?.options || currentProblem.problem_data.options;
    if (options && Array.isArray(options)) {
      return (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 text-sm">Select your answer:</h4>
          {options.map((option, idx) => {
            const optionText = typeof option === 'string' ? option : option.text;
            return (
            <Button
              key={idx}
              onClick={() => setSelectedAnswer(idx)}
              variant="outline"
              disabled={currentAnswer?.isSubmitted}
              className={`w-full text-left p-3 h-auto justify-start transition-all ${
                selectedAnswer === idx
                  ? currentAnswer?.isSubmitted
                    ? isCorrectAnswer(idx)
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                    : 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  selectedAnswer === idx
                    ? currentAnswer?.isSubmitted
                      ? isCorrectAnswer(idx)
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-red-100 border-red-300 text-red-700'
                      : 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'border-gray-300 text-gray-600'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="font-medium">{optionText}</span>
              </div>
            </Button>
            );
          })}
        </div>
      );
    }
    
    // For all other types, no additional interface needed - just use canvas
    return null;
  };


  return (
    <div className="max-w-7xl mx-auto">
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">
              {currentQuestion + 1}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Question {currentQuestion + 1}</h1>
              <p className="text-sm text-gray-600">
                of {content.problems.length} • ~{content.estimated_time_minutes} minutes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
              {Object.keys(questionAnswers).length} / {content.problems.length} answered
            </Badge>
            {currentAnswer?.isSubmitted && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                ✓ Submitted
              </Badge>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigateQuestion('prev')}
            disabled={currentQuestion === 0}
            variant="outline"
            size="sm"
          >
            ← Previous
          </Button>
          
          <div className="flex items-center gap-2">
            {content.problems.map((_, idx) => (
              <Button
                key={idx}
                onClick={() => navigateQuestion(idx)}
                size="sm"
                variant={
                  idx === currentQuestion 
                    ? "default" 
                    : questionAnswers[idx]?.isSubmitted
                      ? "secondary" 
                      : "outline"
                }
                className="w-8 h-8 p-0"
              >
                {idx + 1}
              </Button>
            ))}
          </div>

          <Button
            onClick={() => navigateQuestion('next')}
            disabled={currentQuestion === content.problems.length - 1}
            variant="outline"
            size="sm"
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Problem Zone */}
        <div className="lg:col-span-3 space-y-6">
          {/* Question Card - Enhanced Visual Prominence */}
          <Card className="shadow-lg border-l-4 border-l-orange-500">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
              <Badge variant="secondary" className="w-fit">
                {currentProblem.problem_data.problem_type}
              </Badge>
              <CardTitle className="text-xl font-semibold text-gray-900 leading-relaxed mt-2">
                {currentProblem.problem_data.problem}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Error Display */}
              {submissionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">Submission Error</span>
                  </div>
                  <p className="text-red-700 mt-1">{submissionError}</p>
                </div>
              )}

              {/* In-Context Hint Display */}
              {(inContextHint || isLoadingHint) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {setInContextHint(null); setIsLoadingHint(false);}}
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">AI Hint</span>
                  </div>
                  {isLoadingHint ? (
                    <div className="flex items-center gap-2 text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  ) : (
                    <p className="text-blue-800">{inContextHint}</p>
                  )}
                </div>
              )}
              
              {/* Answer Interface */}
              {renderAnswerInterface()}
              
              {/* Work Area - Always show in main column */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-800 mb-3">
                  {needsProblemRenderer(currentProblem) ? 'Additional Work Area' : 'Work Area'}
                </h4>
                <div className="bg-gray-50 rounded-lg p-4" style={{ height: '500px' }}>
                  <DrawingCanvas
                    ref={canvasRef}
                    loading={isSubmitting}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {needsProblemRenderer(currentProblem) 
                    ? 'Use this area for additional work, notes, or scratch calculations'
                    : 'Use the work area above to show your thinking, draw diagrams, or work through the problem'
                  }
                </p>
              </div>
              
              {/* Submit Button or Review Mode Actions */}
              {!currentAnswer?.isSubmitted && !reviewMode && (
                <div className="mt-6">
                  <Button
                    onClick={handleSubmitWork}
                    disabled={!hasAnswer() || isSubmitting}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting Work...
                      </>
                    ) : (
                      'Submit Work'
                    )}
                  </Button>
                </div>
              )}
              
              {/* Review Mode Actions - Multi-Stage Feedback */}
              {reviewMode && currentAnswer?.feedback && (
                <div className="mt-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-amber-800">Let's Review Your Work</span>
                    </div>
                    <p className="text-amber-700 mb-4">
                      {getFeedbackText(currentAnswer.feedback.review)}
                    </p>
                    <p className="text-sm text-amber-600">
                      Take another look at your work above. Can you spot what might need to be adjusted?
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={handleTryAgain}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      onClick={handleShowAnswer}
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3"
                    >
                      Show Me the Answer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Display */}
          {currentAnswer?.feedback && (
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Enhanced Score Display with Better Visual Feedback */}
                  <div className={`p-5 rounded-xl border-2 ${
                    getScore(currentAnswer.feedback.review) >= 8 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
                    getScore(currentAnswer.feedback.review) >= 6 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' :
                    'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getScore(currentAnswer.feedback.review) >= 8 ? (
                        <div className="flex items-center gap-2">
                          <Trophy className="w-6 h-6 text-green-600" />
                          <span className="font-bold text-xl text-green-800">
                            Excellent! {getScore(currentAnswer.feedback.review)}/10
                          </span>
                        </div>
                      ) : getScore(currentAnswer.feedback.review) >= 6 ? (
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-6 h-6 text-yellow-600" />
                          <span className="font-bold text-xl text-yellow-800">
                            Good work! {getScore(currentAnswer.feedback.review)}/10
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                          <span className="font-bold text-xl text-red-800">
                            Keep trying! {getScore(currentAnswer.feedback.review)}/10
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Enhanced Feedback Text with Better Styling */}
                    <div className={`p-4 rounded-lg ${
                      getScore(currentAnswer.feedback.review) >= 8 ? 'bg-white/60 border border-green-100' :
                      getScore(currentAnswer.feedback.review) >= 6 ? 'bg-white/60 border border-yellow-100' :
                      'bg-white/60 border border-red-100'
                    }`}>
                      <p className="text-gray-800 font-medium leading-relaxed">{getFeedbackText(currentAnswer.feedback.review)}</p>
                    </div>
                    
                    {/* Correct Answer Display with Better Visual Hierarchy */}
                    <div className="mt-4 p-3 bg-white/80 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-800 text-sm">Correct Answer:</span>
                      </div>
                      <p className="text-gray-700 font-medium">{getCorrectAnswer()}</p>
                    </div>
                    
                    {/* Success Criteria Display - Phase 1 Quick Win */}
                    {currentProblem.problem_data.success_criteria && getScore(currentAnswer.feedback.review) >= 8 && (
                      <div className="mt-4 p-3 bg-green-25 border border-green-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-800 text-sm">Why this was a great answer:</span>
                        </div>
                        <ul className="text-sm text-green-700 space-y-1">
                          {currentProblem.problem_data.success_criteria.map((criteria, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span>{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* "Why was this correct?" Button - Phase 1 Quick Win */}
                    {getScore(currentAnswer.feedback.review) >= 8 && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAskAI(`I got this problem correct: "${currentProblem.problem_data.problem}". Can you explain why this approach works and help me understand the underlying concept in more detail? Connect this back to the broader learning objective and show me how this concept applies in other situations.`)}
                          className="text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-2"
                        >
                          <Lightbulb className="w-4 h-4" />
                          Why was this the correct answer?
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Competency Update */}
                  {currentAnswer.feedback.competency && currentAnswer.feedback.competency.new_competency !== undefined && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Progress Update</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Competency: {currentAnswer.feedback.competency.previous_competency?.toFixed(1)} → {currentAnswer.feedback.competency.new_competency.toFixed(1)}
                        {currentAnswer.feedback.competency.delta !== undefined && (
                          <span className={`ml-2 font-semibold ${
                            currentAnswer.feedback.competency.delta > 0 ? 'text-green-600' : 
                            currentAnswer.feedback.competency.delta < 0 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            ({currentAnswer.feedback.competency.delta > 0 ? '+' : ''}{currentAnswer.feedback.competency.delta.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completion Status */}
          {allAnswered && (
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Great work!</h3>
                  <p className="text-gray-600 mb-4">
                    You've answered all {content.problems.length} practice problems.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => onAskAI("Can you review my overall performance on these practice problems and give me feedback on areas where I did well and areas I can improve? Please help me understand the key concepts I should focus on.")}
                      >
                        Get Overall Feedback
                      </Button>
                      <Button 
                        onClick={onComplete}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={isCompleted}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Completed
                          </>
                        ) : (
                          <>
                            <span>Complete Practice Session</span>
                            <span className="ml-2 text-yellow-200 font-semibold">+20 XP</span>
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Try Another Set - Phase 2 Replayability */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-3">
                          Want to practice more with different problems?
                        </p>
                        <Button
                          onClick={handleTryAnotherSet}
                          disabled={isRefreshingProblems}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2"
                        >
                          {isRefreshingProblems ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading New Problems...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Practice Again (New Problems)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Tools & Support Zone */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Tools & Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Help Buttons */}
              {renderHelpButtons()}
              
              {/* Post-submission help */}
              {renderPostSubmissionHelp()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}