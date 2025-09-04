'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, MessageSquare, Lightbulb } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface ShortAnswerQuestion {
  id: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty: string;
  question: string;
  rationale: string;
  teaching_note: string;
  success_criteria: string[];
  metadata?: {
    [key: string]: any;
  };
}

interface ShortAnswerSubmission {
  short_answer: ShortAnswerQuestion;
  student_answer: string;
}

interface ShortAnswerReview {
  is_correct: boolean;
  student_answer: string;
  sample_answers: string[];
  explanation: string;
  answer_feedback: string;
  score: number;
  quality_assessment: {
    completeness: number;
    accuracy: number;
    clarity: number;
    depth: number;
  };
  improvement_suggestions: string[];
  key_concepts_mentioned: Array<{
    concept: string;
    mentioned: boolean;
    importance: 'high' | 'medium' | 'low';
  }>;
  metadata: {
    [key: string]: any;
  };
}

interface ShortAnswerComponentProps {
  shortAnswer: ShortAnswerQuestion;
  onNext?: () => void;
  onComplete?: (review: ShortAnswerReview) => void;
  onNewQuestion?: () => void;
}

const ShortAnswerComponent: React.FC<ShortAnswerComponentProps> = ({
  shortAnswer,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ShortAnswerReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!studentAnswer.trim()) {
      setError('Please provide an answer before submitting.');
      return;
    }

    if (studentAnswer.trim().length < 5) {
      setError('Please provide a more detailed answer (at least 5 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: ShortAnswerSubmission = {
        short_answer: shortAnswer,
        student_answer: studentAnswer.trim()
      };

      const reviewResult: ShortAnswerReview = await authApi.submitShortAnswer(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting Short Answer:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setStudentAnswer('');
    setSubmitted(false);
    setReview(null);
    setError(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityBg = (score: number) => {
    if (score >= 8) return 'bg-green-100';
    if (score >= 6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {shortAnswer.question}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            shortAnswer.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : shortAnswer.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {shortAnswer.difficulty}
          </span>
          {shortAnswer.skill_id && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {shortAnswer.skill_id}
            </span>
          )}
        </div>
      </div>

      {/* Success Criteria Hints */}
      {shortAnswer.success_criteria && shortAnswer.success_criteria.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start mb-2">
            <Lightbulb className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <h4 className="font-medium text-yellow-800">Success Criteria:</h4>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
            {shortAnswer.success_criteria.map((criteria, index) => (
              <li key={index}>{criteria}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Answer Input */}
      <div className="space-y-3">
        <label htmlFor="student-answer" className="text-sm font-medium text-gray-700">
          Your Answer:
        </label>
        <Textarea
          id="student-answer"
          value={studentAnswer}
          onChange={(e) => setStudentAnswer(e.target.value)}
          placeholder="Provide a clear and detailed answer..."
          disabled={submitted}
          className="min-h-[100px] resize-none"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{studentAnswer.length} characters</span>
          <span>Minimum 5 characters required</span>
        </div>
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
            disabled={!studentAnswer.trim() || studentAnswer.length < 5 || loading}
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
        <Alert className={review.score >= 7 ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
          <div className="flex items-center">
            {review.score >= 7 ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <MessageSquare className="w-5 h-5 text-blue-600 mr-2" />
            )}
            <AlertDescription className={review.score >= 7 ? 'text-green-800' : 'text-blue-800'}>
              <strong>
                {review.score >= 7 ? 'Great Answer!' : 'Good Effort!'}
              </strong>
              <span className="ml-2">Score: {review.score}/10</span>
            </AlertDescription>
          </div>
        </Alert>

        {/* Your Answer */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <MessageSquare className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-800 mb-2">Your Answer:</p>
              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">{review.student_answer}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Assessment */}
        {review.quality_assessment && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Quality Assessment:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(review.quality_assessment).map(([aspect, score]) => (
                <div key={aspect} className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center font-bold text-lg ${getQualityBg(score)} ${getQualityColor(score)}`}>
                    {score}
                  </div>
                  <p className="text-sm font-medium text-gray-700 capitalize">{aspect}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Concepts */}
        {review.key_concepts_mentioned && review.key_concepts_mentioned.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Key Concepts:</h4>
            {review.key_concepts_mentioned.map((concept, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                concept.mentioned 
                  ? 'bg-green-50 border-green-200' 
                  : concept.importance === 'high'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {concept.mentioned ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <span className={`font-medium ${
                      concept.mentioned ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {concept.concept}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    concept.importance === 'high' 
                      ? 'bg-red-100 text-red-800'
                      : concept.importance === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {concept.importance}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answer Feedback */}
        {review.answer_feedback && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <HelpCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Feedback on Your Answer:</p>
                <p className="text-blue-700">{review.answer_feedback}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sample Answers */}
        {review.sample_answers && review.sample_answers.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <Award className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-800 mb-2">Sample Answers:</p>
                <div className="space-y-2">
                  {review.sample_answers.map((answer, index) => (
                    <div key={index} className="p-3 bg-green-100 rounded border border-green-200">
                      <p className="text-green-800 whitespace-pre-wrap">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Improvement Suggestions */}
        {review.improvement_suggestions && review.improvement_suggestions.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <Lightbulb className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800 mb-2">Suggestions for Improvement:</p>
                <ul className="list-disc list-inside space-y-1 text-orange-700">
                  {review.improvement_suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* General Explanation */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Explanation:</p>
              <p className="text-gray-700">{review.explanation}</p>
            </div>
          </div>
        </div>

        {shortAnswer.teaching_note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Teaching Note:</p>
                <p className="text-blue-700">{shortAnswer.teaching_note}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Short Answer Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default ShortAnswerComponent;