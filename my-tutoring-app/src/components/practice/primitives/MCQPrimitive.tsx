'use client';

import React from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from 'lucide-react';
import type { MCQPrimitiveProps } from './types';

/**
 * MCQPrimitive - A "dumb" UI component for Multiple Choice Questions
 * 
 * This component only renders UI based on props and emits events.
 * It does NOT manage its own state or handle API calls.
 * All state management and submission logic is handled by the parent controller.
 */
const MCQPrimitive: React.FC<MCQPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false
}) => {
  const handleOptionChange = (optionId: string) => {
    if (disabled || isSubmitted) return;
    onUpdate({ selected_option_id: optionId });
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  const isOptionCorrect = (optionId: string) => {
    return isSubmitted && optionId === problem.correct_option_id;
  };

  const isOptionIncorrectlySelected = (optionId: string) => {
    return isSubmitted && 
           currentResponse?.selected_option_id === optionId && 
           optionId !== problem.correct_option_id;
  };

  return (
    <div className="space-y-6">
      {/* Question Card with full metadata display like the screenshot */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-purple-600 border-purple-200">
              Multiple Choice Question
            </Badge>
            {problem.metadata?.skill && (
              <Badge variant="secondary" className="text-xs">
                {problem.metadata.skill.description || problem.skill_id}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Question Text */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 leading-relaxed">
              {problem.question}
            </h3>
          </div>

          {/* MCQ Options */}
          <div className="space-y-3">
            {problem.options.map((option, index) => {
              const isSelected = currentResponse?.selected_option_id === option.id;
              const isCorrect = isOptionCorrect(option.id);
              const isIncorrectSelection = isOptionIncorrectlySelected(option.id);

              return (
                <div 
                  key={option.id} 
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
                  onClick={() => !disabled && !isSubmitted && handleOptionChange(option.id)}
                >
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
                      {isSelected && !isSubmitted ? '●' : getOptionLetter(index)}
                    </div>
                    <span className={`flex-1 text-base ${
                      isCorrect
                        ? 'text-green-800 font-medium'
                        : isIncorrectSelection
                          ? 'text-red-800'
                          : isSelected
                            ? 'text-blue-800 font-medium'
                            : 'text-gray-700'
                    }`}>
                      {option.text}
                    </span>
                    {isSubmitted && (
                      <div className="ml-2">
                        {isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {isIncorrectSelection && <XCircle className="w-5 h-5 text-red-600" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show rationale after submission */}
          {isSubmitted && problem.rationale && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
              <p className="text-blue-700 leading-relaxed">{problem.rationale}</p>
            </div>
          )}

          {/* Show feedback after submission */}
          {isSubmitted && feedback?.review && (
            <div className="space-y-3">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default MCQPrimitive;