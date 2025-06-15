import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, FileText, Loader2, TrendingUp, AlertCircle, Lightbulb, Target, HelpCircle, GraduationCap, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

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

// Import your existing DrawingCanvas
import DrawingCanvas from '@/components/packages/ui/DrawingCanvas'; // Adjust path as needed

export function PracticeContent({ 
  content, 
  isCompleted, 
  onComplete, 
  onAskAI, 
  studentId = 1 
}: PracticeContentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, {
    type: 'option' | 'text' | 'canvas';
    value: number | string | null;
    feedback?: any;
    isSubmitted?: boolean;
  }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  const canvasRef = useRef<any>(null);

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

  // Render help buttons for before submission
  const renderHelpButtons = () => {
    if (currentAnswer?.isSubmitted) {
      return null; // Don't show help after submission
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Need Help?
        </h5>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(createPracticeHelpPrompt(currentProblem, 'hint'))}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 flex items-center gap-1"
          >
            <Lightbulb className="w-3 h-3" />
            Get a Hint
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(createPracticeHelpPrompt(currentProblem, 'approach'))}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 flex items-center gap-1"
          >
            <Target className="w-3 h-3" />
            Help with Approach
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(createPracticeHelpPrompt(currentProblem, 'stuck'))}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            I'm Stuck!
          </Button>
        </div>
        
        <p className="text-xs text-blue-600">
          💡 The AI tutor will guide you through the problem without giving away the answer.
        </p>
      </div>
    );
  };

  // Render post-submission help for incorrect answers
  const renderPostSubmissionHelp = () => {
    if (!currentAnswer?.isSubmitted || !currentAnswer?.feedback) {
      return null;
    }
    
    const score = getScore(currentAnswer.feedback.review);
    
    // Only show additional help if they got it wrong or partially correct
    if (score >= 8) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
          <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Great job! Want to learn more?
          </h5>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(`I got this problem correct: "${currentProblem.problem_data.problem}". Can you explain why this approach works and show me how this concept applies to real-world situations?`)}
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            <GraduationCap className="w-3 h-3 mr-1" />
            Learn More About This Concept
          </Button>
        </div>
      );
    }
    
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
        <h5 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          Want to understand this better?
        </h5>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(`I got this problem wrong: "${currentProblem.problem_data.problem}". My answer was incorrect. Can you help me understand where I went wrong and how to think about this type of problem correctly? Don't just give me the answer - help me learn the approach.`)}
            className="text-yellow-600 border-yellow-300 hover:bg-yellow-50 flex items-center gap-1"
          >
            <GraduationCap className="w-3 h-3" />
            Learn from Mistake
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(`Can you give me a similar practice problem to this one so I can try the concept again? Problem: "${currentProblem.problem_data.problem}"`)}
            className="text-yellow-600 border-yellow-300 hover:bg-yellow-50 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Try Similar Problem
          </Button>
        </div>
      </div>
    );
  };

  const submitProblemToBackend = async (answerData: {
    type: 'option' | 'text' | 'canvas';
    value: number | string | null;
    canvasData?: string;
  }) => {
    if (!currentProblem) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // Prepare student answer based on type
      let studentAnswer = '';
      if (answerData.type === 'option' && currentProblem.problem_data.options && answerData.value !== null) {
        studentAnswer = currentProblem.problem_data.options[answerData.value as number];
      } else if (answerData.type === 'text') {
        studentAnswer = answerData.value as string;
      } else if (answerData.type === 'canvas') {
        studentAnswer = 'Canvas submission';
      }

      const submissionPayload = {
        student_id: studentId,
        subject: currentProblem.subject,
        problem: currentProblem,
        solution_image: answerData.canvasData || null,
        skill_id: currentProblem.skill_id || currentProblem.problem_data.metadata?.skill?.id || '',
        subskill_id: currentProblem.subskill_id || currentProblem.problem_data.metadata?.subskill?.id || '',
        student_answer: studentAnswer,
        canvas_used: answerData.type === 'canvas'
      };

      const response = await api.submitProblem(submissionPayload);

      // Store the feedback
      setQuestionAnswers(prev => ({
        ...prev,
        [currentQuestion]: {
          ...answerData,
          feedback: {
            review: response.review,
            competency: response.competency
          },
          isSubmitted: true
        }
      }));

      setShowExplanation(true);

      // Send feedback to AI tutor with enhanced context
      const score = getScore(response.review);
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

  const handleAnswerSelect = async (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    
    const answerData = {
      type: 'option' as const,
      value: answerIndex
    };

    // Auto-submit for multiple choice
    await submitProblemToBackend(answerData);
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
    
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  const isCorrectAnswer = (optionIndex: number) => {
    if (!currentProblem.problem_data.options) return false;
    return currentProblem.problem_data.options[optionIndex] === getCorrectAnswer();
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

  const renderAnswerInterface = () => {
    const problemType = currentProblem.problem_data.problem_type.toLowerCase();
    
    // Multiple Choice
    if (currentProblem.problem_data.options) {
      return (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Select your answer:</h4>
          {currentProblem.problem_data.options.map((option, idx) => (
            <Button
              key={idx}
              onClick={() => handleAnswerSelect(idx)}
              variant="outline"
              disabled={currentAnswer?.isSubmitted || isSubmitting}
              className={`w-full text-left p-4 h-auto justify-start transition-all ${
                selectedAnswer === idx
                  ? isCorrectAnswer(idx)
                    ? 'bg-green-50 border-green-300 text-green-800 hover:bg-green-50'
                    : 'bg-red-50 border-red-300 text-red-800 hover:bg-red-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                  selectedAnswer === idx
                    ? isCorrectAnswer(idx)
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-red-100 border-red-300 text-red-700'
                    : 'border-gray-300 text-gray-600'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="font-medium">{option}</span>
              </div>
            </Button>
          ))}
        </div>
      );
    }
    
    // Text Answer
    if (problemType.includes('short answer') || problemType.includes('problem solving') || 
        problemType.includes('creative thinking') || problemType.includes('application')) {
      return (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Write your answer:</h4>
          <Textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="min-h-[100px]"
            disabled={currentAnswer?.isSubmitted || isSubmitting}
          />
          <Button
            onClick={handleTextSubmit}
            disabled={!textAnswer.trim() || currentAnswer?.isSubmitted || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Answer'
            )}
          </Button>
        </div>
      );
    }
    
    // Default: Canvas + text option
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">
                {currentQuestion + 1}
              </div>
              <div>
                <CardTitle className="text-xl">Question {currentQuestion + 1}</CardTitle>
                <p className="text-sm text-muted-foreground">
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
          
          <div className="bg-white rounded-lg p-4">
            <Badge variant="secondary" className="mb-3">
              {currentProblem.problem_data.problem_type}
            </Badge>
            <p className="text-xl font-medium text-gray-900">
              {currentProblem.problem_data.problem}
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Display */}
          {submissionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Submission Error</span>
              </div>
              <p className="text-red-700 mt-1">{submissionError}</p>
            </div>
          )}

          {/* Help Buttons - Show before submission */}
          {renderHelpButtons()}

          {/* Drawing Canvas - always show for work area */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Work Area</h4>
            <div className="bg-gray-50 rounded-lg p-4" style={{ height: '400px' }}>
              <DrawingCanvas
                ref={canvasRef}
                onSubmit={handleCanvasSubmit}
                loading={isSubmitting}
              />
            </div>
            {!currentAnswer?.isSubmitted && (
              <Button
                onClick={handleCanvasSubmit}
                disabled={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting Canvas Work...
                  </>
                ) : (
                  'Submit Canvas Work'
                )}
              </Button>
            )}
          </div>
          
          {/* Answer Interface */}
          {renderAnswerInterface()}

          {/* Feedback Display */}
          {currentAnswer?.feedback && (
            <div className="space-y-3">
              {/* Score Display */}
              <div className={`p-4 rounded-lg ${
                getScore(currentAnswer.feedback.review) >= 8 ? 'bg-green-50 border border-green-200' :
                getScore(currentAnswer.feedback.review) >= 6 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className={`w-5 h-5 ${
                    getScore(currentAnswer.feedback.review) >= 8 ? 'text-green-600' :
                    getScore(currentAnswer.feedback.review) >= 6 ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                  <span className="font-semibold text-lg">
                    Score: {getScore(currentAnswer.feedback.review)}/10
                  </span>
                </div>
                <p className="text-gray-700">{getFeedbackText(currentAnswer.feedback.review)}</p>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Correct answer:</strong> {getCorrectAnswer()}
                </p>
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
          )}

          {/* Post-submission help */}
          {renderPostSubmissionHelp()}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              onClick={() => navigateQuestion('prev')}
              disabled={currentQuestion === 0}
              variant="outline"
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
            >
              Next →
            </Button>
          </div>

          {/* Completion Status */}
          {allAnswered && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Great work!</h3>
              <p className="text-gray-600 mb-4">
                You've answered all {content.problems.length} practice problems.
              </p>
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
                    'Complete Practice Session'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}