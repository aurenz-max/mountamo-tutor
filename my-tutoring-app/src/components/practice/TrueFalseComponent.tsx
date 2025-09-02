'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface TrueFalseQuestion {
  id: string;
  subject: string;
  skill_id: string;
  subskill_id: string;
  difficulty: string;
  statement: string;
  correct: boolean;
  prompt: string;
  rationale: string;
  allow_explain_why: boolean;
  trickiness?: string;
  metadata: {
    [key: string]: any;
  };
}

interface TrueFalseSubmission {
  true_false: TrueFalseQuestion;
  selected_answer: boolean;
  explanation?: string;
}

interface TrueFalseReview {
  is_correct: boolean;
  selected_answer: boolean;
  correct_answer: boolean;
  explanation: string;
  student_explanation?: string;
  explanation_feedback?: string;
  metadata: {
    [key: string]: any;
  };
}

interface TrueFalseComponentProps {
  trueFalse: TrueFalseQuestion;
  onNext?: () => void;
  onComplete?: (review: TrueFalseReview) => void;
  onNewQuestion?: () => void;
}

const TrueFalseComponent: React.FC<TrueFalseComponentProps> = ({
  trueFalse,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<TrueFalseReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedAnswer) {
      setError('Please select True or False before submitting.');
      return;
    }

    if (trueFalse.allow_explain_why && !explanation.trim()) {
      setError('Please provide an explanation for your answer.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: TrueFalseSubmission = {
        true_false: trueFalse,
        selected_answer: selectedAnswer === 'true',
        ...(trueFalse.allow_explain_why && { explanation: explanation.trim() })
      };

      const reviewResult: TrueFalseReview = await authApi.submitTrueFalse(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting True/False:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setSelectedAnswer('');
    setExplanation('');
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
        <div className="flex-1">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">{trueFalse.prompt}</p>
            <h3 className="text-lg font-semibold text-gray-900">
              {trueFalse.statement}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            trueFalse.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : trueFalse.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {trueFalse.difficulty}
          </span>
          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
            {trueFalse.skill_id}
          </span>
          {trueFalse.trickiness && trueFalse.trickiness !== 'none' && (
            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
              {trueFalse.trickiness}
            </span>
          )}
        </div>
      </div>

      <RadioGroup
        value={selectedAnswer}
        onValueChange={setSelectedAnswer}
        disabled={submitted}
        className="space-y-4"
      >
        <div className="flex items-center space-x-3">
          <RadioGroupItem
            value="true"
            id="true"
            className={`${
              submitted && trueFalse.correct
                ? 'text-green-600 border-green-600'
                : submitted && selectedAnswer === 'true' && !trueFalse.correct
                  ? 'text-red-600 border-red-600'
                  : ''
            }`}
          />
          <Label
            htmlFor="true"
            className={`flex-1 cursor-pointer text-lg font-medium ${
              submitted && trueFalse.correct
                ? 'text-green-700 bg-green-50 p-3 rounded border border-green-200'
                : submitted && selectedAnswer === 'true' && !trueFalse.correct
                  ? 'text-red-700 bg-red-50 p-3 rounded border border-red-200'
                  : 'hover:bg-gray-50 p-3 rounded hover:border-gray-300'
            }`}
          >
            True
            {submitted && (
              <span className="ml-2">
                {trueFalse.correct && (
                  <CheckCircle className="inline w-5 h-5 text-green-600" />
                )}
                {selectedAnswer === 'true' && !trueFalse.correct && (
                  <XCircle className="inline w-5 h-5 text-red-600" />
                )}
              </span>
            )}
          </Label>
        </div>

        <div className="flex items-center space-x-3">
          <RadioGroupItem
            value="false"
            id="false"
            className={`${
              submitted && !trueFalse.correct
                ? 'text-green-600 border-green-600'
                : submitted && selectedAnswer === 'false' && trueFalse.correct
                  ? 'text-red-600 border-red-600'
                  : ''
            }`}
          />
          <Label
            htmlFor="false"
            className={`flex-1 cursor-pointer text-lg font-medium ${
              submitted && !trueFalse.correct
                ? 'text-green-700 bg-green-50 p-3 rounded border border-green-200'
                : submitted && selectedAnswer === 'false' && trueFalse.correct
                  ? 'text-red-700 bg-red-50 p-3 rounded border border-red-200'
                  : 'hover:bg-gray-50 p-3 rounded hover:border-gray-300'
            }`}
          >
            False
            {submitted && (
              <span className="ml-2">
                {!trueFalse.correct && (
                  <CheckCircle className="inline w-5 h-5 text-green-600" />
                )}
                {selectedAnswer === 'false' && trueFalse.correct && (
                  <XCircle className="inline w-5 h-5 text-red-600" />
                )}
              </span>
            )}
          </Label>
        </div>
      </RadioGroup>

      {trueFalse.allow_explain_why && (
        <div className="space-y-2">
          <Label htmlFor="explanation" className="text-sm font-medium">
            Explain your reasoning:
          </Label>
          <Textarea
            id="explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Why did you choose this answer?"
            disabled={submitted}
            className="min-h-[100px]"
          />
        </div>
      )}

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
            disabled={!selectedAnswer || loading}
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
        <Alert className={review.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center">
            {review.is_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
            )}
            <AlertDescription className={review.is_correct ? 'text-green-800' : 'text-red-800'}>
              <strong>
                {review.is_correct ? 'Correct!' : 'Incorrect'}
              </strong>
            </AlertDescription>
          </div>
        </Alert>

        {!review.is_correct && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <HelpCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Your Answer:</p>
                <p className="text-blue-700">{review.selected_answer ? 'True' : 'False'}</p>
                <p className="font-semibold text-green-800 mt-3 mb-1">Correct Answer:</p>
                <p className="text-green-700">{review.correct_answer ? 'True' : 'False'}</p>
              </div>
            </div>
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

        {review.student_explanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Your Explanation:</p>
                <p className="text-blue-700">{review.student_explanation}</p>
                {review.explanation_feedback && (
                  <>
                    <p className="font-semibold text-gray-800 mt-3 mb-1">Feedback on Your Explanation:</p>
                    <p className="text-gray-700">{review.explanation_feedback}</p>
                  </>
                )}
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
          <HelpCircle className="w-6 h-6" />
          True or False Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default TrueFalseComponent;