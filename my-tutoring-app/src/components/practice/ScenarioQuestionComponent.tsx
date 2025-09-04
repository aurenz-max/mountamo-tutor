'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, FileText, Lightbulb } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface ScenarioQuestion {
  id: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty: string;
  scenario: string;
  scenario_question: string;
  scenario_answer: string;
  rationale: string;
  teaching_note: string;
  success_criteria: string[];
  metadata?: {
    [key: string]: any;
  };
}

interface ScenarioSubmission {
  scenario_question: ScenarioQuestion;
  student_answer: string;
}

interface ScenarioReview {
  is_correct: boolean;
  student_answer: string;
  expected_answer: string;
  explanation: string;
  answer_feedback: string;
  score: number;
  similarity_score: number;
  key_points_covered: Array<{
    point: string;
    covered: boolean;
    feedback?: string;
  }>;
  metadata: {
    [key: string]: any;
  };
}

interface ScenarioQuestionComponentProps {
  scenario: ScenarioQuestion;
  onNext?: () => void;
  onComplete?: (review: ScenarioReview) => void;
  onNewQuestion?: () => void;
}

const ScenarioQuestionComponent: React.FC<ScenarioQuestionComponentProps> = ({
  scenario,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ScenarioReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!studentAnswer.trim()) {
      setError('Please provide an answer before submitting.');
      return;
    }

    if (studentAnswer.trim().length < 10) {
      setError('Please provide a more detailed answer (at least 10 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: ScenarioSubmission = {
        scenario_question: scenario,
        student_answer: studentAnswer.trim()
      };

      const reviewResult: ScenarioReview = await authApi.submitScenarioQuestion(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting Scenario Question:', err);
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

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            scenario.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : scenario.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {scenario.difficulty}
          </span>
          {scenario.skill_id && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {scenario.skill_id}
            </span>
          )}
        </div>
      </div>

      {/* Scenario */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start mb-3">
          <FileText className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <h3 className="text-lg font-semibold text-blue-900">Scenario</h3>
        </div>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {scenario.scenario}
        </p>
      </div>

      {/* Question */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start mb-3">
          <HelpCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <h4 className="text-lg font-semibold text-yellow-900">Question</h4>
        </div>
        <p className="text-gray-800 font-medium">
          {scenario.scenario_question}
        </p>
      </div>

      {/* Answer Input */}
      <div className="space-y-3">
        <label htmlFor="student-answer" className="text-sm font-medium text-gray-700">
          Your Answer:
        </label>
        <Textarea
          id="student-answer"
          value={studentAnswer}
          onChange={(e) => setStudentAnswer(e.target.value)}
          placeholder="Provide a detailed answer based on the scenario above..."
          disabled={submitted}
          className="min-h-[120px] resize-none"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{studentAnswer.length} characters</span>
          <span>Minimum 10 characters required</span>
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
            disabled={!studentAnswer.trim() || studentAnswer.length < 10 || loading}
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
        <Alert className={review.is_correct ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
          <div className="flex items-center">
            {review.is_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <Lightbulb className="w-5 h-5 text-blue-600 mr-2" />
            )}
            <AlertDescription className={review.is_correct ? 'text-green-800' : 'text-blue-800'}>
              <strong>
                {review.is_correct ? 'Excellent Answer!' : 'Good Effort!'}
              </strong>
              {review.score && (
                <span className="ml-2">Score: {review.score}/10</span>
              )}
              {review.similarity_score && (
                <span className="ml-2">Similarity: {Math.round(review.similarity_score)}%</span>
              )}
            </AlertDescription>
          </div>
        </Alert>

        {/* Your Answer */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <FileText className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-800 mb-2">Your Answer:</p>
              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">{review.student_answer}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expected Answer */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 mb-2">Sample Answer:</p>
              <div className="p-3 bg-green-100 rounded border border-green-200">
                <p className="text-green-800 whitespace-pre-wrap">{review.expected_answer}</p>
              </div>
            </div>
          </div>
        </div>

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

        {/* Key Points Coverage */}
        {review.key_points_covered && review.key_points_covered.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Key Points Analysis:</h4>
            {review.key_points_covered.map((point, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                point.covered 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start">
                  {point.covered ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${point.covered ? 'text-green-800' : 'text-yellow-800'}`}>
                      {point.point}
                    </p>
                    {point.feedback && (
                      <p className={`text-sm mt-1 ${point.covered ? 'text-green-700' : 'text-yellow-700'}`}>
                        {point.feedback}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

        {scenario.teaching_note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Teaching Note:</p>
                <p className="text-blue-700">{scenario.teaching_note}</p>
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
          <FileText className="w-6 h-6" />
          Scenario Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default ScenarioQuestionComponent;