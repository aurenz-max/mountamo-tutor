import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface MultipleChoiceOption {
  id: string;
  text: string;
  image_url?: string;
}

interface MultipleChoiceProps {
  parameters: {
    prompt: string;
    options: MultipleChoiceOption[];
    correct_option_id: string;
    randomize_options?: boolean;
  };
  disabled?: boolean;
  initialValue?: string;
  onUpdate?: (value: any, isComplete?: boolean) => void;
  showValidation?: boolean;
}

export default function MultipleChoice({ 
  parameters,
  disabled = false,
  initialValue,
  onUpdate,
  showValidation = false
}: MultipleChoiceProps) {
  const {
    prompt,
    options,
    correct_option_id,
    randomize_options = false
  } = parameters;

  const [selectedOption, setSelectedOption] = useState<string | null>(initialValue || null);
  
  // Randomize options if requested (but keep consistent across renders)
  const displayOptions = React.useMemo(() => {
    if (randomize_options) {
      return [...options].sort(() => Math.random() - 0.5);
    }
    return options;
  }, [options, randomize_options]);

  const handleOptionSelect = useCallback((optionId: string) => {
    if (disabled) return;
    
    setSelectedOption(optionId);
    
    const isCorrect = optionId === correct_option_id;
    
    if (onUpdate) {
      onUpdate({
        selected_option_id: optionId,
        is_correct: isCorrect,
        option_text: options.find(opt => opt.id === optionId)?.text
      }, true);
    }
  }, [disabled, correct_option_id, onUpdate, options]);

  const isCorrect = selectedOption === correct_option_id;
  const hasSelection = selectedOption !== null;

  return (
    <Card className={`${disabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6 space-y-4">
        {/* Prompt */}
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800 mb-4">{prompt}</p>
          {showValidation && hasSelection && (
            <div className={`flex items-center justify-center gap-2 ${
              isCorrect ? 'text-green-600' : 'text-red-600'
            }`}>
              {isCorrect ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Try again</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {displayOptions.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const isCorrectOption = option.id === correct_option_id;
            
            let buttonStyle = 'border-gray-300 hover:border-gray-400 hover:bg-gray-50';
            
            if (isSelected) {
              if (showValidation) {
                buttonStyle = isCorrect 
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-red-400 bg-red-50 text-red-800';
              } else {
                buttonStyle = 'border-blue-400 bg-blue-50 text-blue-800';
              }
            } else if (showValidation && hasSelection && isCorrectOption) {
              // Highlight the correct answer when showing validation
              buttonStyle = 'border-green-400 bg-green-50 text-green-800';
            }

            return (
              <Button
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                disabled={disabled}
                variant="outline"
                className={`
                  w-full p-4 h-auto text-left justify-start transition-all
                  ${buttonStyle}
                `}
              >
                <div className="flex items-center gap-4 w-full">
                  {/* Option Letter */}
                  <div className={`
                    w-8 h-8 rounded-full border-2 flex items-center justify-center 
                    text-sm font-bold flex-shrink-0
                    ${isSelected 
                      ? showValidation
                        ? isCorrect
                          ? 'bg-green-100 border-green-400 text-green-700'
                          : 'bg-red-100 border-red-400 text-red-700'
                        : 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'border-gray-300 text-gray-600'
                    }
                  `}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  
                  {/* Option Content */}
                  <div className="flex items-center gap-3 flex-1">
                    {option.image_url && (
                      <img 
                        src={option.image_url}
                        alt={option.text}
                        className="w-12 h-12 object-contain flex-shrink-0"
                      />
                    )}
                    <span className="text-base font-medium">{option.text}</span>
                  </div>
                  
                  {/* Validation Icon */}
                  {showValidation && hasSelection && (
                    <div className="flex-shrink-0">
                      {(isSelected && isCorrect) || (!isSelected && isCorrectOption) ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : isSelected && !isCorrect ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : null}
                    </div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        {/* Instructions */}
        {!hasSelection && (
          <div className="text-center text-sm text-gray-600">
            Select the correct answer
          </div>
        )}
      </CardContent>
    </Card>
  );
}