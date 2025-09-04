'use client';

import React from 'react';
import type { ShortAnswerPrimitiveProps } from './types';

/**
 * ShortAnswerPrimitive - A "dumb" UI component for Short Answer Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 */
const ShortAnswerPrimitive: React.FC<ShortAnswerPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false
}) => {
  const handleAnswerChange = (value: string) => {
    if (disabled || isSubmitted) return;
    onUpdate({ student_answer: value });
  };

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">Question:</h4>
        <p className="text-gray-900 text-lg font-medium">{problem.question}</p>
      </div>

      {/* Answer Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Your Answer:
        </label>
        <textarea
          value={currentResponse?.student_answer || ''}
          onChange={(e) => handleAnswerChange(e.target.value)}
          disabled={disabled || isSubmitted}
          placeholder="Type your answer here..."
          className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Show feedback after submission */}
      {isSubmitted && feedback?.shortAnswerReview && (
        <div className="space-y-4">
          {/* Show expected answer if available */}
          {problem.answer && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Expected Answer:</h4>
              <p className="text-green-700">{problem.answer}</p>
            </div>
          )}

          {/* Show explanation */}
          {feedback.shortAnswerReview.explanation && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Explanation:</h4>
              <p className="text-gray-700">{feedback.shortAnswerReview.explanation}</p>
            </div>
          )}

          {/* Show score */}
          {feedback.shortAnswerReview.score !== undefined && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                <span className="font-medium">Score:</span> {feedback.shortAnswerReview.score}/10
                {feedback.shortAnswerReview.is_correct !== undefined && (
                  <span className={`ml-2 font-medium ${
                    feedback.shortAnswerReview.is_correct ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({feedback.shortAnswerReview.is_correct ? 'Correct' : 'Needs Improvement'})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Show general feedback */}
          {feedback?.review && (
            <div className="mt-4 space-y-3">
              {feedback.review.feedback?.praise && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">{feedback.review.feedback.praise}</p>
                </div>
              )}
              {feedback.review.feedback?.guidance && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-1">Guidance:</h4>
                  <p className="text-blue-700">{feedback.review.feedback.guidance}</p>
                </div>
              )}
              {feedback.review.feedback?.encouragement && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 font-medium">{feedback.review.feedback.encouragement}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShortAnswerPrimitive;