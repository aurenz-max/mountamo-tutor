'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, GripVertical } from 'lucide-react';
import type { SequencingPrimitiveProps } from './types';

/**
 * SequencingPrimitive - A "dumb" UI component for Sequencing Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 */
const SequencingPrimitive: React.FC<SequencingPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false
}) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  
  // Initialize sequence if not provided
  const currentSequence = currentResponse?.student_sequence || [...problem.items];

  const handleDragStart = (e: React.DragEvent, item: string) => {
    if (disabled || isSubmitted) return;
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetItem: string) => {
    e.preventDefault();
    if (!draggedItem || disabled || isSubmitted || draggedItem === targetItem) return;

    const newSequence = [...currentSequence];
    const draggedIndex = newSequence.indexOf(draggedItem);
    const targetIndex = newSequence.indexOf(targetItem);

    // Remove dragged item and insert at target position
    newSequence.splice(draggedIndex, 1);
    newSequence.splice(targetIndex, 0, draggedItem);

    onUpdate({ student_sequence: newSequence });
    setDraggedItem(null);
  };

  const moveItem = (item: string, direction: 'up' | 'down') => {
    if (disabled || isSubmitted) return;
    
    const newSequence = [...currentSequence];
    const currentIndex = newSequence.indexOf(item);
    
    if (direction === 'up' && currentIndex > 0) {
      [newSequence[currentIndex], newSequence[currentIndex - 1]] = 
      [newSequence[currentIndex - 1], newSequence[currentIndex]];
    } else if (direction === 'down' && currentIndex < newSequence.length - 1) {
      [newSequence[currentIndex], newSequence[currentIndex + 1]] = 
      [newSequence[currentIndex + 1], newSequence[currentIndex]];
    }
    
    onUpdate({ student_sequence: newSequence });
  };

  const getItemFeedback = (item: string) => {
    if (!isSubmitted || !feedback?.sequencingReview) return null;
    return feedback.sequencingReview.sequence_feedback?.find((f: any) => f.item === item);
  };

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
        <p className="text-gray-900">{problem.instruction}</p>
      </div>

      {/* Sequencing Interface */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-800 mb-3">Drag items to arrange them in the correct order:</h4>
        {currentSequence.map((item, index) => {
          const itemFeedback = getItemFeedback(item);
          const isCorrect = itemFeedback?.is_correct;
          const isIncorrect = itemFeedback && !itemFeedback.is_correct;
          
          return (
            <div
              key={`${item}-${index}`}
              draggable={!disabled && !isSubmitted}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item)}
              className={`flex items-center p-3 rounded-lg border-2 cursor-move transition-all ${
                disabled || isSubmitted
                  ? isCorrect
                    ? 'border-green-300 bg-green-50'
                    : isIncorrect
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-gray-50 cursor-default'
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
                {isSubmitted && (
                  <span className="ml-2">
                    {isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {isIncorrect && <XCircle className="w-5 h-5 text-red-600" />}
                  </span>
                )}
              </div>
              {!disabled && !isSubmitted && (
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

      {/* Show feedback after submission */}
      {isSubmitted && feedback?.sequencingReview && (
        <div className="space-y-4">
          {!feedback.sequencingReview.is_correct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-3">Correct Order:</h4>
              <div className="space-y-2">
                {feedback.sequencingReview.correct_sequence?.map((item: string, index: number) => (
                  <div key={`correct-${index}`} className="flex items-center p-2 bg-green-100 rounded">
                    <span className="bg-green-200 text-green-800 text-sm font-medium px-2 py-1 rounded mr-3">
                      {index + 1}
                    </span>
                    <span className="text-green-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show explanation */}
          {feedback.sequencingReview.explanation && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Explanation:</h4>
              <p className="text-gray-700">{feedback.sequencingReview.explanation}</p>
            </div>
          )}

          {/* Show teaching note */}
          {problem.teaching_note && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Teaching Note:</h4>
              <p className="text-blue-700">{problem.teaching_note}</p>
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

export default SequencingPrimitive;