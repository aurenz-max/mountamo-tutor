'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, CheckCircle, XCircle, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { AssessmentProblemReviewItem } from '@/types/assessment';

interface QuestionReviewProps {
  problemReviews: AssessmentProblemReviewItem[];
  onClose: () => void;
}

const QuestionReview: React.FC<QuestionReviewProps> = ({ problemReviews, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect'>('all');

  const filteredReviews = problemReviews.filter(review => {
    if (filterType === 'correct') return review.is_correct;
    if (filterType === 'incorrect') return !review.is_correct;
    return true;
  });

  const currentReview = filteredReviews[currentIndex];
  const totalFiltered = filteredReviews.length;

  const goToNext = () => {
    if (currentIndex < totalFiltered - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const changeFilter = (newFilter: 'all' | 'correct' | 'incorrect') => {
    setFilterType(newFilter);
    setCurrentIndex(0); // Reset to first item when changing filter
  };

  if (!currentReview) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-gray-600 mb-4">No questions to review</p>
          <Button onClick={onClose} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Close Review
              </Button>

              <div className="text-sm text-gray-600">
                Question {currentIndex + 1} of {totalFiltered}
                {filterType !== 'all' && (
                  <span className="ml-1">({filterType})</span>
                )}
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex gap-2">
              <Button
                onClick={() => changeFilter('all')}
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
              >
                All ({problemReviews.length})
              </Button>
              <Button
                onClick={() => changeFilter('correct')}
                variant={filterType === 'correct' ? 'default' : 'outline'}
                size="sm"
                className="text-green-600"
              >
                Correct ({problemReviews.filter(r => r.is_correct).length})
              </Button>
              <Button
                onClick={() => changeFilter('incorrect')}
                variant={filterType === 'incorrect' ? 'default' : 'outline'}
                size="sm"
                className="text-red-600"
              >
                Incorrect ({problemReviews.filter(r => !r.is_correct).length})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-8">
          {/* Question Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {currentReview.is_correct ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <h2 className="text-xl font-semibold text-gray-900">
                  Question {currentIndex + 1}
                </h2>
              </div>

              <Badge
                className={
                  currentReview.is_correct
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }
              >
                {currentReview.is_correct ? 'Correct' : 'Incorrect'}
              </Badge>
            </div>

            {/* Question Metadata */}
            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
              <Badge variant="outline">{currentReview.skill_name}</Badge>
              <Badge variant="outline">{currentReview.subskill_name}</Badge>
              <Badge variant="outline">{currentReview.problem_type}</Badge>
              <Badge variant="outline">Score: {currentReview.score}/10</Badge>
            </div>
          </div>

          {/* Answer Comparison */}
          <div className="space-y-6">
            {/* Student's Answer */}
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-l-blue-500">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                Your Answer
              </h3>
              <p className="text-gray-700">
                {currentReview.student_answer_text || 'No answer provided'}
              </p>
            </div>

            {/* Correct Answer */}
            <div className={`p-4 rounded-lg border-l-4 ${
              currentReview.is_correct
                ? 'bg-green-50 border-l-green-500'
                : 'bg-red-50 border-l-red-500'
            }`}>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                {currentReview.is_correct ? 'Correct! ✓' : 'Correct Answer'}
              </h3>
              <p className="text-gray-700">
                {currentReview.correct_answer_text}
              </p>
            </div>

            {/* Learning Context */}
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-l-blue-500">
              <h3 className="font-semibold text-gray-900 mb-2">
                Learning Context
              </h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p><strong>Unit:</strong> {currentReview.unit_title}</p>
                <p><strong>Skill:</strong> {currentReview.skill_name}</p>
                <p><strong>Topic:</strong> {currentReview.subskill_name}</p>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <Button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="text-sm text-gray-600 text-center">
              <p>Question {currentIndex + 1} of {totalFiltered}</p>
              {filterType !== 'all' && (
                <p className="text-xs mt-1">Showing {filterType} answers only</p>
              )}
            </div>

            <Button
              onClick={goToNext}
              disabled={currentIndex === totalFiltered - 1}
              variant="outline"
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default QuestionReview;