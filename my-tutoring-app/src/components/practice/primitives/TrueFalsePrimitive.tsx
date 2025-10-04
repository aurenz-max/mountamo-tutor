'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from 'lucide-react';
import type { TrueFalsePrimitiveProps } from './types';
import { VisualPrimitiveRenderer } from '../visuals/VisualPrimitiveRenderer';

/**
 * TrueFalsePrimitive - A "dumb" UI component for True/False Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 */
const TrueFalsePrimitive: React.FC<TrueFalsePrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false,
  disableFeedback = false
}) => {
  const handleAnswerChange = (value: boolean) => {
    if (disabled || isSubmitted) return;
    
    onUpdate({
      selected_answer: value,
      explanation: currentResponse?.explanation || ''
    });
  };

  const handleExplanationChange = (explanation: string) => {
    if (disabled || isSubmitted) return;
    
    onUpdate({
      selected_answer: currentResponse?.selected_answer ?? false,
      explanation: explanation
    });
  };

  const isCorrectAnswer = (value: boolean): boolean => {
    return isSubmitted && !disableFeedback && value === problem.correct;
  };

  const isIncorrectSelection = (value: boolean): boolean => {
    return isSubmitted && !disableFeedback &&
           currentResponse?.selected_answer === value &&
           value !== problem.correct;
  };

  return (
    <div className="space-y-6">
      {/* Question Card with full metadata display */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-purple-600 border-purple-200">
              True/False Question
            </Badge>
            {problem.metadata?.skill && (
              <Badge variant="secondary" className="text-xs">
                {problem.metadata.skill.description || problem.skill_id}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Statement */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 leading-relaxed">
              {problem.statement}
            </h3>
          </div>

          {/* Visual Data */}
          {problem.statement_visual_data && (
            <div className="my-6">
              <VisualPrimitiveRenderer
                visualData={problem.statement_visual_data}
                className="w-full"
              />
            </div>
          )}

          {/* True/False Options */}
          <div className="space-y-3">
            {[{value: true, label: 'True'}, {value: false, label: 'False'}].map((option) => {
              const isSelected = currentResponse?.selected_answer === option.value;
              const isCorrect = isCorrectAnswer(option.value);
              const isIncorrect = isIncorrectSelection(option.value);
              
              return (
                <div 
                  key={option.label}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isCorrect
                      ? 'bg-green-50 border-green-300'
                      : isIncorrectSelection
                        ? 'bg-red-50 border-red-300'
                        : isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : isSubmitted
                            ? 'bg-gray-50 border-gray-200'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => !disabled && !isSubmitted && handleAnswerChange(option.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                        isCorrect
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : isIncorrectSelection
                            ? 'bg-red-100 border-red-300 text-red-700'
                            : isSelected
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'border-gray-300 text-gray-600'
                      }`}>
                        {isSelected && !isSubmitted ? '●' : option.value ? 'T' : 'F'}
                      </div>
                      <span className={`text-lg font-medium ${
                        isCorrect
                          ? 'text-green-800'
                          : isIncorrectSelection
                            ? 'text-red-800'
                            : isSelected
                              ? 'text-blue-800'
                              : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                    </div>
                    {isSubmitted && (
                      <div>
                        {isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {isIncorrectSelection && <XCircle className="w-5 h-5 text-red-600" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

      {/* Explanation input if required */}
      {problem.allow_explain_why && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Explain your reasoning:
          </label>
          <textarea
            value={currentResponse?.explanation || ''}
            onChange={(e) => handleExplanationChange(e.target.value)}
            disabled={disabled || isSubmitted}
            placeholder="Why did you choose this answer?"
            className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          />
        </div>
      )}

      {/* Show feedback after submission */}
      {isSubmitted && (
        <div className="space-y-4">
          {/* Show rationale after submission */}
          {problem.rationale && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Explanation:</h4>
              <p className="text-gray-700">{problem.rationale}</p>
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

export default TrueFalsePrimitive;