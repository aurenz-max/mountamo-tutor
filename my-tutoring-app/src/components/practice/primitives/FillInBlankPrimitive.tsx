'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FillInBlankPrimitiveProps } from './types';

/**
 * FillInBlankPrimitive - A "dumb" UI component for Fill-in-the-Blank Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 */
const FillInBlankPrimitive: React.FC<FillInBlankPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false
}) => {
  const handleBlankChange = (blankId: string, value: string) => {
    if (disabled || isSubmitted) return;

    const currentAnswers = currentResponse?.student_answers || [];
    const newAnswers = [
      ...currentAnswers.filter(a => a.blank_id !== blankId),
      { blank_id: blankId, answer: value }
    ];

    onUpdate({ student_answers: newAnswers });
  };

  const getBlankValue = (blankId: string): string => {
    const answer = currentResponse?.student_answers?.find(a => a.blank_id === blankId);
    return answer?.answer || '';
  };

  const getBlankEvaluation = (blankId: string) => {
    if (!isSubmitted || !feedback?.fibReview) return null;
    return feedback.fibReview.blank_evaluations?.find((e: any) => e.blank_id === blankId);
  };

  return (
    <div className="space-y-6">
      {/* Question Card with full metadata display */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-purple-600 border-purple-200">
              Fill in the Blank
            </Badge>
            {problem.metadata?.skill && (
              <Badge variant="secondary" className="text-xs">
                {problem.metadata.skill.description || problem.skill_id}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Fill-in-the-Blank interactive text */}
          <div className="text-lg leading-relaxed p-4 bg-gray-50 rounded-lg border border-gray-200">
        {(() => {
          const text = problem.text_with_blanks;
          const parts = text.split(/(\{\{[^}]+\}\})/);
          
          return parts.map((part, partIndex) => {
            const blankMatch = part.match(/\{\{([^}]+)\}\}/);
            if (blankMatch) {
              const blankId = blankMatch[1];
              const evaluation = getBlankEvaluation(blankId);
              const isCorrect = evaluation?.is_correct;
              const isIncorrect = evaluation && !evaluation.is_correct;
              
              return (
                <span key={partIndex} className="inline-flex items-center mx-1">
                  <input
                    type="text"
                    value={getBlankValue(blankId)}
                    onChange={(e) => handleBlankChange(blankId, e.target.value)}
                    disabled={disabled || isSubmitted}
                    placeholder="___"
                    className={`inline-block w-20 h-8 text-center text-sm border rounded px-2 ${
                      isCorrect 
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : isIncorrect
                          ? 'border-red-500 bg-red-50 text-red-800'
                          : 'border-gray-300'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {isSubmitted && (
                    <span className="ml-1">
                      {isCorrect && <span className="w-4 h-4 text-green-600">✓</span>}
                      {isIncorrect && <span className="text-red-600 text-sm">✗</span>}
                    </span>
                  )}
                </span>
              );
            }
            return <span key={partIndex}>{part}</span>;
          });
        })()} 
      </div>
      
      {/* Show detailed feedback after submission */}
      {isSubmitted && feedback?.fibReview && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-800">Answer Details:</h4>
          {feedback.fibReview.blank_evaluations?.map((evaluation: any) => (
            <div key={evaluation.blank_id} className={`p-3 rounded-lg border ${
              evaluation.is_correct 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start">
                {evaluation.is_correct ? (
                  <span className="w-4 h-4 text-green-600 mr-2 mt-0.5">✓</span>
                ) : (
                  <span className="w-4 h-4 text-red-600 mr-2 mt-0.5">✗</span>
                )}
                <div>
                  <p className={`font-semibold ${evaluation.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                    Blank {evaluation.blank_id}: 
                    <span className="font-normal ml-1">"{evaluation.student_answer}"</span>
                  </p>
                  <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                    {evaluation.feedback}
                  </p>
                  {!evaluation.is_correct && (
                    <p className="text-sm text-gray-600 mt-1">
                      Expected: {evaluation.correct_answers?.join(' or ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Show rationale after submission */}
          {problem.rationale && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
              <p className="text-blue-700">{problem.rationale}</p>
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

export default FillInBlankPrimitive;