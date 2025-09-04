'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, ArrowUpDown, GripVertical } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface SequencingQuestion {
  id: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty: string;
  instruction: string;
  items: string[];
  rationale: string;
  teaching_note: string;
  success_criteria: string[];
  metadata?: {
    [key: string]: any;
  };
}

interface SequencingSubmission {
  sequencing: SequencingQuestion;
  student_sequence: string[];
}

interface SequencingReview {
  is_correct: boolean;
  student_sequence: string[];
  correct_sequence: string[];
  explanation: string;
  sequence_feedback: Array<{
    item: string;
    correct_position: number;
    student_position: number;
    is_correct: boolean;
  }>;
  total_score: number;
  percentage_correct: number;
  metadata: {
    [key: string]: any;
  };
}

interface SequencingComponentProps {
  sequencing: SequencingQuestion;
  onNext?: () => void;
  onComplete?: (review: SequencingReview) => void;
  onNewQuestion?: () => void;
}

const SequencingComponent: React.FC<SequencingComponentProps> = ({
  sequencing,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  // Shuffle the items initially for display
  const [shuffledItems] = useState<string[]>(() => {
    const items = [...sequencing.items];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  });
  
  const [currentSequence, setCurrentSequence] = useState<string[]>(shuffledItems);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<SequencingReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: string) => {
    if (submitted) return;
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetItem: string) => {
    e.preventDefault();
    if (!draggedItem || submitted || draggedItem === targetItem) return;

    const newSequence = [...currentSequence];
    const draggedIndex = newSequence.indexOf(draggedItem);
    const targetIndex = newSequence.indexOf(targetItem);

    // Remove dragged item and insert at target position
    newSequence.splice(draggedIndex, 1);
    newSequence.splice(targetIndex, 0, draggedItem);

    setCurrentSequence(newSequence);
    setDraggedItem(null);
  };

  const moveItem = (item: string, direction: 'up' | 'down') => {
    if (submitted) return;
    
    const newSequence = [...currentSequence];
    const currentIndex = newSequence.indexOf(item);
    
    if (direction === 'up' && currentIndex > 0) {
      [newSequence[currentIndex], newSequence[currentIndex - 1]] = 
      [newSequence[currentIndex - 1], newSequence[currentIndex]];
    } else if (direction === 'down' && currentIndex < newSequence.length - 1) {
      [newSequence[currentIndex], newSequence[currentIndex + 1]] = 
      [newSequence[currentIndex + 1], newSequence[currentIndex]];
    }
    
    setCurrentSequence(newSequence);
  };

  const handleSubmit = async () => {
    if (currentSequence.length === 0) {
      setError('Please arrange the items before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: SequencingSubmission = {
        sequencing: sequencing,
        student_sequence: currentSequence
      };

      const reviewResult: SequencingReview = await authApi.submitSequencing(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting Sequencing:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setCurrentSequence(shuffledItems);
    setSubmitted(false);
    setReview(null);
    setError(null);
    setDraggedItem(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {sequencing.instruction}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            sequencing.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : sequencing.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {sequencing.difficulty}
          </span>
          {sequencing.skill_id && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {sequencing.skill_id}
            </span>
          )}
        </div>
      </div>

      {/* Sequencing Interface */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-800 mb-3">Drag items to arrange them in the correct order:</h4>
        {currentSequence.map((item, index) => {
          const feedback = review?.sequence_feedback?.find(f => f.item === item);
          const isCorrect = feedback?.is_correct;
          const isIncorrect = feedback && !feedback.is_correct;
          
          return (
            <div
              key={`${item}-${index}`}
              draggable={!submitted}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item)}
              className={`flex items-center p-3 rounded-lg border-2 cursor-move transition-all ${
                submitted
                  ? isCorrect
                    ? 'border-green-300 bg-green-50'
                    : isIncorrect
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-gray-50'
                  : draggedItem === item
                    ? 'border-blue-400 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center flex-1">
                <GripVertical className="w-5 h-5 text-gray-400 mr-3" />
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded mr-3">
                  {index + 1}
                </span>
                <span className={`flex-1 ${
                  isCorrect 
                    ? 'text-green-800 font-medium' 
                    : isIncorrect 
                      ? 'text-red-800' 
                      : 'text-gray-900'
                }`}>
                  {item}
                </span>
                {submitted && (
                  <span className="ml-2">
                    {isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {isIncorrect && <XCircle className="w-5 h-5 text-red-600" />}
                  </span>
                )}
              </div>
              {!submitted && (
                <div className="flex flex-col ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(item, 'up')}
                    disabled={index === 0}
                    className="h-6 px-2 mb-1"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(item, 'down')}
                    disabled={index === currentSequence.length - 1}
                    className="h-6 px-2"
                  >
                    ↓
                  </Button>
                </div>
              )}
            </div>
          );
        })}
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
            {loading ? 'Submitting...' : 'Submit Order'}
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
        <Alert className={review.is_correct ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
          <div className="flex items-center">
            {review.is_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <ArrowUpDown className="w-5 h-5 text-yellow-600 mr-2" />
            )}
            <AlertDescription className={review.is_correct ? 'text-green-800' : 'text-yellow-800'}>
              <strong>
                {review.is_correct ? 'Perfect Sequence!' : `${review.percentage_correct}% Correct`}
              </strong>
              {review.total_score && (
                <span className="ml-2">Score: {review.total_score}/10</span>
              )}
            </AlertDescription>
          </div>
        </Alert>

        {!review.is_correct && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <HelpCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-800 mb-3">Correct Order:</p>
                <div className="space-y-2">
                  {review.correct_sequence.map((item, index) => (
                    <div key={`correct-${index}`} className="flex items-center p-2 bg-green-100 rounded">
                      <span className="bg-green-200 text-green-800 text-sm font-medium px-2 py-1 rounded mr-3">
                        {index + 1}
                      </span>
                      <span className="text-green-800">{item}</span>
                    </div>
                  ))}
                </div>
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

        {sequencing.teaching_note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Teaching Note:</p>
                <p className="text-blue-700">{sequencing.teaching_note}</p>
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
          <ArrowUpDown className="w-6 h-6" />
          Sequencing Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default SequencingComponent;