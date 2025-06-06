import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, FileText, Loader2, TrendingUp, AlertCircle } from 'lucide-react';
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

      // Send feedback to AI tutor
      const score = getScore(response.review);
      const feedbackText = getFeedbackText(response.review);
      
      onAskAI(`I just submitted my answer for: "${currentProblem.problem_data.problem}" 
        
My answer was: ${studentAnswer}
Score received: ${score}/10
Feedback: ${feedbackText}

Can you help me understand this better?`);

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
                  onClick={() => onAskAI("Can you review my answers and provide feedback on the practice problems I just completed?")}
                >
                  Get AI feedback on all answers
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

          {/* Help Button */}
          {!currentAnswer?.isSubmitted && (
            <div className="text-center pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => onAskAI(`Help me with this practice problem: ${currentProblem.problem_data.problem}`)}
                className="text-orange-600 hover:text-orange-700"
              >
                Need help with this problem? Ask AI →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}