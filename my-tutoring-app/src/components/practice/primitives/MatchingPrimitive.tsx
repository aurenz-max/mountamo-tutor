'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import type { MatchingPrimitiveProps } from './types';

/**
 * MatchingPrimitive - A "dumb" UI component for Matching Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 * All state management and submission logic is handled by the parent controller.
 */
const MatchingPrimitive: React.FC<MatchingPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false,
  disableFeedback = false
}) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleMatch = (leftId: string, rightId: string) => {
    if (disabled || isSubmitted) return;
    
    const currentMatches = currentResponse?.student_matches || [];
    const newMatches = [
      ...currentMatches.filter(m => m.left_id !== leftId && m.right_id !== rightId),
      { left_id: leftId, right_id: rightId }
    ];
    
    onUpdate({ student_matches: newMatches });
  };

  const handleClearMatch = (leftId: string) => {
    if (disabled || isSubmitted) return;
    
    const currentMatches = currentResponse?.student_matches || [];
    const newMatches = currentMatches.filter(m => m.left_id !== leftId);
    
    onUpdate({ student_matches: newMatches });
  };

  const getMatchedRightId = (leftId: string): string | undefined => {
    return currentResponse?.student_matches?.find(m => m.left_id === leftId)?.right_id;
  };

  const isRightItemUsed = (rightId: string): boolean => {
    return (currentResponse?.student_matches || []).some(m => m.right_id === rightId);
  };

  const getRightItemText = (rightId: string): string => {
    const item = problem.right_items.find(item => item.id === rightId);
    return item ? item.text : rightId;
  };

  const getMatchEvaluation = (leftId: string) => {
    if (!isSubmitted || !feedback?.matchingReview) return null;
    return feedback.matchingReview.match_evaluations?.find((e: any) => e.left_id === leftId);
  };

  const isCorrectMatch = (leftId: string): boolean => {
    if (disableFeedback || !isSubmitted) return false;
    const evaluation = getMatchEvaluation(leftId);
    return evaluation?.is_correct || false;
  };

  const isIncorrectMatch = (leftId: string): boolean => {
    if (disableFeedback || !isSubmitted) return false;
    const evaluation = getMatchEvaluation(leftId);
    return evaluation && !evaluation.is_correct;
  };

  const getExpectedMatches = (leftId: string): string[] => {
    const evaluation = getMatchEvaluation(leftId);
    return evaluation?.expected_right_ids || [];
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, rightId: string) => {
    if (disabled || isSubmitted) return;
    setDraggedItem(rightId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled || isSubmitted) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, leftId: string) => {
    e.preventDefault();
    if (draggedItem && !disabled && !isSubmitted) {
      handleMatch(leftId, draggedItem);
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Simple click-to-match for mobile/accessibility
  const handleRightItemClick = (rightId: string) => {
    if (disabled || isSubmitted) return;
    
    // Find first unmatched left item
    const unmatchedLeftItem = problem.left_items.find(leftItem => 
      !getMatchedRightId(leftItem.id)
    );
    
    if (unmatchedLeftItem) {
      handleMatch(unmatchedLeftItem.id, rightId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Question Card with full metadata display */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-purple-600 border-purple-200">
              Matching Question
            </Badge>
            {problem.metadata?.skill && (
              <Badge variant="secondary" className="text-xs">
                {problem.metadata.skill.description || problem.skill_id}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Prompt */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 leading-relaxed">
              {problem.prompt}
            </h3>
          </div>

          {/* Matching interactive area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800 mb-3">Items to Match</h4>
          {problem.left_items.map((leftItem) => {
            const matchedRightId = getMatchedRightId(leftItem.id);
            const isCorrect = isCorrectMatch(leftItem.id);
            const isIncorrect = isIncorrectMatch(leftItem.id);
            const expectedMatches = getExpectedMatches(leftItem.id);

            return (
              <div
                key={leftItem.id}
                className={`p-4 rounded-lg border-2 border-dashed transition-colors ${
                  isCorrect
                    ? 'border-green-300 bg-green-50'
                    : isIncorrect
                      ? 'border-red-300 bg-red-50'
                      : draggedItem
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, leftItem.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{leftItem.text}</p>
                    {leftItem.image_url && (
                      <img 
                        src={leftItem.image_url} 
                        alt={leftItem.text}
                        className="mt-2 max-w-full h-auto max-h-20 object-contain"
                      />
                    )}
                    {matchedRightId && (
                      <div className="mt-2 flex items-center text-sm">
                        <ArrowRight className="w-4 h-4 text-gray-400 mr-2" />
                        <span className={
                          isCorrect 
                            ? 'text-green-700' 
                            : isIncorrect 
                              ? 'text-red-700' 
                              : 'text-gray-700'
                        }>
                          {getRightItemText(matchedRightId)}
                        </span>
                        {isSubmitted && !disableFeedback && (
                          <span className="ml-2">
                            {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {isIncorrect && <XCircle className="w-4 h-4 text-red-600" />}
                          </span>
                        )}
                      </div>
                    )}
                    {isSubmitted && !disableFeedback && isIncorrect && expectedMatches.length > 0 && (
                      <div className="mt-2 text-xs text-green-600">
                        Expected: {expectedMatches.map(rightId => getRightItemText(rightId)).join(' or ')}
                      </div>
                    )}
                  </div>
                  {matchedRightId && !isSubmitted && !disabled && (
                    <Button
                      onClick={() => handleClearMatch(leftItem.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800 mb-3">Options</h4>
          {problem.right_items.map((rightItem) => {
            const isUsed = isRightItemUsed(rightItem.id);
            
            return (
              <div
                key={rightItem.id}
                draggable={!disabled && !isSubmitted}
                onDragStart={(e) => handleDragStart(e, rightItem.id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleRightItemClick(rightItem.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSubmitted
                    ? 'border-gray-300 bg-gray-50 cursor-default'
                    : isUsed
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
                } ${draggedItem === rightItem.id ? 'opacity-50' : ''} ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <p className="font-medium">{rightItem.text}</p>
                {rightItem.image_url && (
                  <img 
                    src={rightItem.image_url} 
                    alt={rightItem.text}
                    className="mt-2 max-w-full h-auto max-h-20 object-contain"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Show detailed feedback after submission */}
      {isSubmitted && !disableFeedback && feedback?.matchingReview && (
        <div className="space-y-2 mt-6">
          <h4 className="font-medium text-gray-800">Match Details:</h4>
          {feedback.matchingReview.match_evaluations?.map((evaluation: any) => (
            <div key={evaluation.left_id} className={`p-3 rounded-lg border ${
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
                    {problem.left_items.find(l => l.id === evaluation.left_id)?.text || evaluation.left_id} → {getRightItemText(evaluation.right_id)}
                  </p>
                  <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                    {evaluation.feedback}
                  </p>
                  {!evaluation.is_correct && evaluation.expected_right_ids?.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Expected: {evaluation.expected_right_ids.map((rightId: string) => 
                        getRightItemText(rightId)
                      ).join(' or ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Show rationale after submission */}
          {(problem.rationale_global || feedback?.matchingReview?.explanation) && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
              <p className="text-blue-700">{feedback.matchingReview.explanation}</p>
              {problem.rationale_global && (
                <p className="text-blue-700 mt-2">{problem.rationale_global}</p>
              )}
            </div>
          )}
          
          {/* Show general feedback after submission */}
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
      </CardContent>
    </Card>
    </div>
  );
};

export default MatchingPrimitive;