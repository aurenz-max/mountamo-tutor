'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from 'lucide-react';
import type { CategorizationPrimitiveProps } from './types';

/**
 * CategorizationPrimitive - A "dumb" UI component for Categorization Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 */
const CategorizationPrimitive: React.FC<CategorizationPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false,
  disableFeedback = false
}) => {
  const handleCategorize = (itemText: string, category: string) => {
    if (disabled || isSubmitted) return;
    
    const newCategorization = {
      ...currentResponse?.student_categorization,
      [itemText]: category
    };
    
    onUpdate({ student_categorization: newCategorization });
  };

  const getItemCategory = (itemText: string): string | undefined => {
    return currentResponse?.student_categorization?.[itemText];
  };

  const getItemFeedback = (itemText: string) => {
    if (!isSubmitted || !feedback?.categorizationReview) return null;
    return feedback.categorizationReview.item_evaluations?.find((e: any) => e.item_text === itemText);
  };

  const isItemCorrect = (itemText: string): boolean => {
    if (disableFeedback || !isSubmitted) return false;
    const itemFeedback = getItemFeedback(itemText);
    return itemFeedback?.is_correct || false;
  };

  const isItemIncorrect = (itemText: string): boolean => {
    if (disableFeedback || !isSubmitted) return false;
    const itemFeedback = getItemFeedback(itemText);
    return itemFeedback && !itemFeedback.is_correct;
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
        <p className="text-gray-900">Categorize each item into the correct category.</p>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {problem.categories.map((category) => (
          <div key={category} className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
            <h4 className="font-medium text-gray-800 mb-3 text-center bg-gray-100 rounded p-2">
              {category}
            </h4>
            <div className="space-y-2">
              {problem.categorization_items
                .filter(item => getItemCategory(item.item_text) === category)
                .map((item) => {
                  const isCorrect = isItemCorrect(item.item_text);
                  const isIncorrect = isItemIncorrect(item.item_text);
                  
                  return (
                    <div
                      key={item.item_text}
                      className={`p-2 rounded border text-sm ${
                        isCorrect
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : isIncorrect
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.item_text}</span>
                        {isSubmitted && !disableFeedback && (
                          <span>
                            {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {isIncorrect && <XCircle className="w-4 h-4 text-red-600" />}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Uncategorized Items */}
      <div className="border-2 border-dashed border-gray-400 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-3">Items to Categorize</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {problem.categorization_items
            .filter(item => !getItemCategory(item.item_text))
            .map((item) => (
              <div
                key={item.item_text}
                className="p-2 bg-white border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-50"
              >
                <div className="mb-2 font-medium text-center">{item.item_text}</div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {problem.categories.map((category) => (
                    <Button
                      key={category}
                      variant="outline"
                      size="sm"
                      onClick={() => handleCategorize(item.item_text, category)}
                      disabled={disabled || isSubmitted}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Show feedback after submission */}
      {isSubmitted && !disableFeedback && feedback?.categorizationReview && (
        <div className="space-y-4">
          {/* Show incorrect items with correct categories */}
          {feedback.categorizationReview.item_evaluations?.some((e: any) => !e.is_correct) && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-800">Item Details:</h4>
              {feedback.categorizationReview.item_evaluations
                .filter((e: any) => !e.is_correct)
                .map((evaluation: any) => (
                  <div key={evaluation.item_text} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <XCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800">
                          {evaluation.item_text}
                        </p>
                        <p className="text-sm text-red-700">
                          Your category: {evaluation.student_category}
                        </p>
                        <p className="text-sm text-green-700">
                          Correct category: {evaluation.correct_category}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Show explanation */}
          {feedback.categorizationReview.explanation && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Explanation:</h4>
              <p className="text-gray-700">{feedback.categorizationReview.explanation}</p>
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

export default CategorizationPrimitive;