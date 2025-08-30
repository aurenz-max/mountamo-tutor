'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface MCQOption {
  id: string;
  text: string;
}

interface MCQQuestion {
  id: string;
  subject: string;
  unit_id: string;
  skill_id: string;
  subskill_id: string;
  difficulty: string;
  question: string;
  options: MCQOption[];
  correct_option_id: string;
  rationale: string;
  metadata: {
    concept_group?: string;
    learning_objectives?: string[];
    [key: string]: any;
  };
}

interface MCQSubmission {
  mcq: MCQQuestion;
  selected_option_id: string;
}

interface MCQReview {
  is_correct: boolean;
  selected_option_id: string;
  correct_option_id: string;
  explanation: string;
  selected_option_text: string;
  correct_option_text: string;
  metadata: {
    question_id: string;
    submitted_at: string;
    evaluation_method: string;
  };
}

interface MCQComponentProps {
  mcq: MCQQuestion;
  onNext?: () => void;
  onComplete?: (review: MCQReview) => void;
  onNewQuestion?: () => void;
}

const MCQComponent: React.FC<MCQComponentProps> = ({
  mcq,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<MCQReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedOption) {
      setError('Please select an answer before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: MCQSubmission = {
        mcq: mcq,
        selected_option_id: selectedOption
      };

      const reviewResult: MCQReview = await authApi.submitMCQ(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting MCQ:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setSelectedOption('');
    setSubmitted(false);
    setReview(null);
    setError(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  const getSelectedOptionText = (optionId: string) => {
    const option = mcq.options.find(opt => opt.id === optionId);
    return option ? option.text : optionId;
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {mcq.question}
          </h3>
          {mcq.metadata.concept_group && (
            <div className="flex items-center text-sm text-blue-600 mb-2">
              <BookOpen className="w-4 h-4 mr-1" />
              <span>Topic: {mcq.metadata.concept_group}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            mcq.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : mcq.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {mcq.difficulty}
          </span>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            {mcq.skill_id}
          </span>
        </div>
      </div>

      <RadioGroup
        value={selectedOption}
        onValueChange={setSelectedOption}
        disabled={submitted}
        className="space-y-3"
      >
        {mcq.options.map((option, index) => (
          <div key={option.id} className="flex items-start space-x-3">
            <RadioGroupItem
              value={option.id}
              id={option.id}
              className={`mt-0.5 ${
                submitted && option.id === mcq.correct_option_id
                  ? 'text-green-600 border-green-600'
                  : submitted && option.id === selectedOption && selectedOption !== mcq.correct_option_id
                    ? 'text-red-600 border-red-600'
                    : ''
              }`}
            />
            <Label
              htmlFor={option.id}
              className={`flex-1 cursor-pointer text-base leading-relaxed ${
                submitted && option.id === mcq.correct_option_id
                  ? 'text-green-700 bg-green-50 p-2 rounded border border-green-200'
                  : submitted && option.id === selectedOption && selectedOption !== mcq.correct_option_id
                    ? 'text-red-700 bg-red-50 p-2 rounded border border-red-200'
                    : 'hover:bg-gray-50 p-2 rounded hover:border-gray-300'
              }`}
            >
              <span className="font-semibold mr-2">{getOptionLetter(index)}.</span>
              {option.text}
              {submitted && (
                <span className="ml-2">
                  {option.id === mcq.correct_option_id && (
                    <CheckCircle className="inline w-5 h-5 text-green-600" />
                  )}
                  {option.id === selectedOption && selectedOption !== mcq.correct_option_id && (
                    <XCircle className="inline w-5 h-5 text-red-600" />
                  )}
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>

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
            disabled={!selectedOption || loading}
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

    const selectedOptionText = getSelectedOptionText(review.selected_option_id);
    const correctOptionText = getSelectedOptionText(review.correct_option_id);

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
                <p className="text-blue-700">{selectedOptionText}</p>
                <p className="font-semibold text-green-800 mt-3 mb-1">Correct Answer:</p>
                <p className="text-green-700">{correctOptionText}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Explanation:</p>
              <p className="text-gray-700">{mcq.rationale}</p>
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
          Multiple Choice Question
        </CardTitle>
        {mcq.metadata.learning_objectives && mcq.metadata.learning_objectives.length > 0 && (
          <p className="text-sm text-gray-600">
            Learning Objective: {mcq.metadata.learning_objectives[0]}
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

export default MCQComponent;
