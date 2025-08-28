import React, { useState, useCallback } from 'react';
import { ProblemTemplate as ProblemTemplateType, PrimitiveAnswer } from '../primitives/core/PrimitiveTypes';
import { PrimitiveRenderer } from './PrimitiveRenderer';

interface ProblemTemplateProps {
  template: ProblemTemplateType;
  disabled?: boolean;
  initialAnswer?: PrimitiveAnswer;
  onChange?: (answer: PrimitiveAnswer) => void;
  onSubmit?: (answer: PrimitiveAnswer) => void;
  showValidation?: boolean;
}

export function ProblemTemplate({
  template,
  disabled = false,
  initialAnswer,
  onChange,
  onSubmit,
  showValidation = true
}: ProblemTemplateProps) {
  const [currentAnswer, setCurrentAnswer] = useState<PrimitiveAnswer | null>(initialAnswer || null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Handle answer changes from the primitive
  const handleAnswerChange = useCallback((answer: PrimitiveAnswer) => {
    setCurrentAnswer(answer);
    setHasInteracted(true);
    
    if (onChange) {
      onChange(answer);
    }
  }, [onChange]);

  // Handle submission
  const handleSubmit = useCallback(() => {
    if (currentAnswer && onSubmit) {
      onSubmit(currentAnswer);
    }
  }, [currentAnswer, onSubmit]);

  // Check if answer is valid based on template requirements
  const isValidAnswer = (): boolean => {
    if (!currentAnswer) return false;
    
    switch (template.grading_config.type) {
      case 'exact_match':
        return currentAnswer.value !== null && currentAnswer.value !== undefined;
      case 'fuzzy_match':
        return currentAnswer.value !== null && currentAnswer.value !== undefined;
      case 'range_match':
        return typeof currentAnswer.value === 'number';
      default:
        return currentAnswer.value !== null && currentAnswer.value !== undefined;
    }
  };

  const isValid = isValidAnswer();
  const canSubmit = isValid && !disabled;

  return (
    <div className="problem-template-container">
      {/* Problem Statement */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
              ?
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {template.problem_text}
              </h3>
              
              {/* Template metadata */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                  {template.subject}
                </span>
                
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ~{template.metadata.estimated_time_minutes} min
                </span>
                
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Level {template.metadata.difficulty}
                </span>
              </div>

              {/* Tags */}
              {template.metadata.tags && template.metadata.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {template.metadata.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual/Interactive Component */}
      {template.type === 'visual' && template.primitive && (
        <div className="mb-6">
          <PrimitiveRenderer
            primitiveConfig={template.primitive}
            templateId={template.id}
            disabled={disabled}
            initialAnswer={initialAnswer}
            onChange={handleAnswerChange}
          />
        </div>
      )}

      {/* Multiple Choice (for hybrid problems) */}
      {template.type === 'multiple_choice' && template.params.options && (
        <div className="mb-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Select your answer:</h4>
            {template.params.options.map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => handleAnswerChange({
                  type: 'multiple_choice',
                  value: idx,
                  metadata: { option_text: option }
                })}
                disabled={disabled}
                className={`w-full text-left p-3 border rounded-lg transition-all ${
                  currentAnswer?.value === idx
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    currentAnswer?.value === idx
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-300'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Input (for open-ended problems) */}
      {template.type === 'text' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Answer:
          </label>
          <textarea
            value={currentAnswer?.value || ''}
            onChange={(e) => handleAnswerChange({
              type: 'text',
              value: e.target.value
            })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            rows={4}
            placeholder="Enter your answer here..."
          />
        </div>
      )}

      {/* Validation and Submission */}
      <div className="space-y-4">
        {/* Validation Messages */}
        {showValidation && hasInteracted && (
          <div className="text-sm">
            {!currentAnswer ? (
              <div className="text-gray-500">Please provide an answer.</div>
            ) : !isValid ? (
              <div className="text-amber-600">Please complete your answer.</div>
            ) : (
              <div className="text-green-600">✓ Answer provided</div>
            )}
          </div>
        )}

        {/* Submit Button */}
        {onSubmit && (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              canSubmit
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {disabled ? 'Submitted' : canSubmit ? 'Submit Answer' : 'Complete Answer to Submit'}
          </button>
        )}

        {/* Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && currentAnswer && (
          <details className="text-xs bg-gray-50 p-2 rounded border">
            <summary className="cursor-pointer text-gray-600">Debug: Current Answer</summary>
            <pre className="mt-2 overflow-auto">{JSON.stringify(currentAnswer, null, 2)}</pre>
          </details>
        )}
      </div>

      {/* Accessibility Notes */}
      {template.metadata.accessibility_notes && (
        <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Accessibility:</strong> {template.metadata.accessibility_notes}
        </div>
      )}
    </div>
  );
}