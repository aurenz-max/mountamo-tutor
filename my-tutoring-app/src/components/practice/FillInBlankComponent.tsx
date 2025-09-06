'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, Edit3 } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import DrawingWorkspace from './DrawingWorkspace';

interface BlankAnswer {
  id: string;
  correct_answers: string[];
  case_sensitive: boolean;
  tolerance?: number;
  hint?: string;
}

interface FillInBlankQuestion {
  id: string;
  subject: string;
  unit_id: string;
  skill_id: string;
  subskill_id: string;
  difficulty: string;
  text_with_blanks: string;
  blanks: BlankAnswer[];
  rationale: string;
  metadata: {
    concept_group?: string;
    detailed_objective?: string;
    [key: string]: any;
  };
}

interface StudentBlankAnswer {
  blank_id: string;
  answer: string;
}

interface FillInBlankSubmission {
  fill_in_blank: FillInBlankQuestion;
  student_answers: StudentBlankAnswer[];
}

interface BlankEvaluation {
  blank_id: string;
  student_answer: string;
  correct_answers: string[];
  is_correct: boolean;
  partial_credit: number;
  feedback: string;
}

interface FillInBlankReview {
  overall_correct: boolean;
  total_score: number;
  blank_evaluations: BlankEvaluation[];
  explanation: string;
  percentage_correct: number;
  metadata: {
    question_id: string;
    [key: string]: any;
  };
}

interface FillInBlankComponentProps {
  fillInBlank: FillInBlankQuestion;
  onNext?: () => void;
  onComplete?: (review: FillInBlankReview) => void;
  onNewQuestion?: () => void;
}

const FillInBlankComponent: React.FC<FillInBlankComponentProps> = ({
  fillInBlank,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<FillInBlankReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drawingRef = useRef<any>(null);

  const handleAnswerChange = (blankId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [blankId]: value
    }));
  };

  const handleSubmit = async () => {
    // Check if all blanks are filled
    const missingBlanks = fillInBlank.blanks.filter(blank => !answers[blank.id]?.trim());
    if (missingBlanks.length > 0) {
      setError(`Please fill in all blanks before submitting.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get canvas data as required by backend
      let canvasData = null;
      if (drawingRef.current) {
        canvasData = await drawingRef.current.getCanvasData();
      }

      // Prepare student answers
      const studentAnswers: StudentBlankAnswer[] = fillInBlank.blanks.map(blank => ({
        blank_id: blank.id,
        answer: answers[blank.id] || ''
      }));

      // Convert to universal problem submission format
      const problemData = {
        subject: fillInBlank.subject,
        problem: {
          id: fillInBlank.id,
          skill_id: fillInBlank.skill_id,
          subskill_id: fillInBlank.subskill_id,
          problem_data: {
            full_problem_data: {
              text_with_blanks: fillInBlank.text_with_blanks,
              blanks: fillInBlank.blanks,
              difficulty: fillInBlank.difficulty,
              rationale: fillInBlank.rationale
            }
          }
        },
        skill_id: fillInBlank.skill_id,
        subskill_id: fillInBlank.subskill_id,
        student_answer: JSON.stringify(studentAnswers),
        canvas_used: !!canvasData,
        solution_image: canvasData
      };

      const reviewResult = await authApi.submitProblem(problemData);
      
      // Convert response to Fill-in-blank format for compatibility (simplified)
      const fibReview: FillInBlankReview = {
        overall_correct: reviewResult.review?.correct || false,
        blank_evaluations: fillInBlank.blanks.map(blank => ({
          blank_id: blank.id,
          student_answer: answers[blank.id] || '',
          correct_answers: blank.correct_answers,
          is_correct: true, // Would need proper evaluation logic
          score: reviewResult.review?.correct ? 10 : 0,
          feedback: reviewResult.review?.feedback?.guidance || ''
        })),
        total_score: reviewResult.review?.score || 0,
        percentage_correct: reviewResult.review?.correct ? 100 : 0,
        explanation: reviewResult.review?.feedback?.guidance || fillInBlank.rationale,
        metadata: {
          question_id: fillInBlank.id,
          submitted_at: new Date().toISOString(),
          evaluation_method: 'universal_submission_service'
        }
      };

      setReview(fibReview);
      setSubmitted(true);

      if (onComplete) {
        onComplete(fibReview);
      }
    } catch (err: any) {
      console.error('Error submitting fill-in-the-blank:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setAnswers({});
    setSubmitted(false);
    setReview(null);
    setError(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  // Parse the text with blanks and render input fields
  const renderTextWithBlanks = () => {
    const text = fillInBlank.text_with_blanks;
    const parts = text.split(/(\{\{[^}]+\}\})/);
    
    return parts.map((part, index) => {
      const blankMatch = part.match(/\{\{([^}]+)\}\}/);
      if (blankMatch) {
        const blankId = blankMatch[1];
        const blank = fillInBlank.blanks.find(b => b.id === blankId);
        const isCorrect = submitted && review?.blank_evaluations.find(e => e.blank_id === blankId)?.is_correct;
        const isIncorrect = submitted && review?.blank_evaluations.find(e => e.blank_id === blankId && !e.is_correct);
        
        return (
          <span key={index} className="inline-flex items-center mx-1">
            <Input
              value={answers[blankId] || ''}
              onChange={(e) => handleAnswerChange(blankId, e.target.value)}
              disabled={submitted}
              placeholder={`Blank ${blankId}`}
              className={`inline-block w-24 h-8 text-center text-sm ${
                isCorrect 
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : isIncorrect
                    ? 'border-red-500 bg-red-50 text-red-800'
                    : 'border-gray-300'
              }`}
            />
            {submitted && (
              <span className="ml-1">
                {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                {isIncorrect && <XCircle className="w-4 h-4 text-red-600" />}
              </span>
            )}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="text-lg font-medium text-gray-900 mb-4 leading-relaxed">
            {renderTextWithBlanks()}
          </div>
          {fillInBlank.metadata.concept_group && (
            <div className="flex items-center text-sm text-blue-600 mb-2">
              <BookOpen className="w-4 h-4 mr-1" />
              <span>Topic: {fillInBlank.metadata.concept_group}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            fillInBlank.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : fillInBlank.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {fillInBlank.difficulty}
          </span>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            {fillInBlank.skill_id}
          </span>
        </div>
      </div>

      {/* Canvas for drawing/work */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Edit3 className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-600">Use the space below for any calculations or work:</span>
        </div>
        <DrawingWorkspace 
          ref={drawingRef}
          loading={loading}
          height={200}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button
          onClick={handleNewQuestion}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Question
        </Button>

        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6"
          >
            {loading ? 'Submitting...' : 'Submit Answer'}
          </Button>
        ) : (
          <>
            {onNext && (
              <Button
                onClick={onNext}
                className="px-6"
              >
                Next Question
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderFeedback = () => {
    if (!review) return null;

    return (
      <div className="mt-6 space-y-4">
        <Alert className={review.overall_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center">
            {review.overall_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
            )}
            <AlertDescription className={review.overall_correct ? 'text-green-800' : 'text-red-800'}>
              <strong>
                {review.overall_correct ? 'Excellent!' : 'Some answers need work'}
              </strong>
              {` You scored ${review.total_score.toFixed(1)}/10 (${review.percentage_correct.toFixed(1)}%)`}
            </AlertDescription>
          </div>
        </Alert>

        {/* Individual blank feedback */}
        {review.blank_evaluations.some(e => !e.is_correct) && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Answer Details:</h4>
            {review.blank_evaluations.map(evaluation => (
              <div key={evaluation.blank_id} className={`p-3 rounded-lg border ${
                evaluation.is_correct 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {evaluation.is_correct ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold ${evaluation.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                      Blank {evaluation.blank_id}: 
                      <span className="font-normal ml-1">"{evaluation.student_answer}"</span>
                    </p>
                    <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                      {evaluation.feedback}
                    </p>
                    {!evaluation.is_correct && (
                      <p className="text-sm text-gray-600 mt-1">
                        Expected: {evaluation.correct_answers.join(' or ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Explanation:</p>
              <p className="text-gray-700">{review.explanation}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="w-6 h-6" />
          Fill in the Blanks
        </CardTitle>
        {fillInBlank.metadata.detailed_objective && (
          <p className="text-sm text-gray-600">
            Learning Objective: {fillInBlank.metadata.detailed_objective}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default FillInBlankComponent;