import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Plus, Minus } from 'lucide-react';

interface ObjectCounterProps {
  parameters: {
    prompt: string;
    object_image_url: string;
    max_count?: number;
    target_count?: number;
  };
  disabled?: boolean;
  initialValue?: number;
  onUpdate?: (value: any, isComplete?: boolean) => void;
  showValidation?: boolean;
}

export default function ObjectCounter({ 
  parameters,
  disabled = false,
  initialValue = 0,
  onUpdate,
  showValidation = false
}: ObjectCounterProps) {
  const {
    prompt,
    object_image_url,
    max_count = 20,
    target_count
  } = parameters;

  const [count, setCount] = useState<number>(initialValue);

  const isCorrect = target_count ? count === target_count : true;

  const handleIncrement = useCallback(() => {
    if (disabled || count >= max_count) return;
    
    const newCount = count + 1;
    setCount(newCount);
    
    if (onUpdate) {
      const isComplete = target_count ? newCount === target_count : false;
      onUpdate({
        count: newCount,
        is_correct: target_count ? newCount === target_count : true
      }, isComplete);
    }
  }, [disabled, count, max_count, onUpdate, target_count]);

  const handleDecrement = useCallback(() => {
    if (disabled || count <= 0) return;
    
    const newCount = count - 1;
    setCount(newCount);
    
    if (onUpdate) {
      const isComplete = target_count ? newCount === target_count : false;
      onUpdate({
        count: newCount,
        is_correct: target_count ? newCount === target_count : true
      }, isComplete);
    }
  }, [disabled, count, onUpdate, target_count]);

  const handleReset = useCallback(() => {
    if (disabled) return;
    
    setCount(0);
    if (onUpdate) {
      onUpdate({
        count: 0,
        is_correct: target_count ? 0 === target_count : true
      }, target_count === 0);
    }
  }, [disabled, onUpdate, target_count]);

  // Render objects in a grid
  const renderObjects = () => {
    const objects = [];
    const columns = Math.min(5, Math.ceil(Math.sqrt(count)));
    
    for (let i = 0; i < count; i++) {
      objects.push(
        <div
          key={i}
          className="w-12 h-12 flex items-center justify-center bg-white rounded-lg border-2 border-blue-200 shadow-sm"
        >
          {object_image_url.includes('star') ? (
            <div className="text-2xl">⭐</div>
          ) : object_image_url.includes('heart') ? (
            <div className="text-2xl">❤️</div>
          ) : object_image_url.includes('circle') ? (
            <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          ) : (
            <div className="text-2xl">🔵</div>
          )}
        </div>
      );
    }
    
    return (
      <div 
        className="grid gap-2 justify-center"
        style={{ 
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          maxWidth: `${columns * 60}px`,
          margin: '0 auto'
        }}
      >
        {objects}
      </div>
    );
  };

  return (
    <Card className={`${disabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6 space-y-6">
        {/* Prompt */}
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800">{prompt}</p>
          {showValidation && target_count && (
            <div className={`mt-2 flex items-center justify-center gap-2 ${
              isCorrect ? 'text-green-600' : 'text-red-600'
            }`}>
              {isCorrect ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Perfect count!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {count < target_count ? 'Count more!' : 'Too many!'}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Counter Display */}
        <div className="text-center">
          <div className={`
            text-4xl font-bold mb-2
            ${showValidation && target_count
              ? isCorrect ? 'text-green-600' : 'text-red-600'
              : 'text-blue-600'
            }
          `}>
            {count}
          </div>
          {target_count && (
            <p className="text-sm text-gray-600">
              Target: {target_count} {target_count === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>

        {/* Objects Display */}
        <div className="min-h-[100px] p-4 bg-gray-50 rounded-lg border">
          {count > 0 ? (
            renderObjects()
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400">
              <p className="text-sm">Tap + to add objects</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={handleDecrement}
            disabled={disabled || count <= 0}
            variant="outline"
            size="lg"
            className="w-16 h-16 rounded-full"
          >
            <Minus className="w-6 h-6" />
          </Button>
          
          <div className="text-center min-w-[80px]">
            <div className="text-2xl font-bold text-gray-800">{count}</div>
            <div className="text-xs text-gray-500">
              {count === 1 ? 'object' : 'objects'}
            </div>
          </div>
          
          <Button
            onClick={handleIncrement}
            disabled={disabled || count >= max_count}
            size="lg"
            className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-6 h-6 text-white" />
          </Button>
        </div>

        {/* Instructions and Limits */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            Tap the buttons to count objects
          </p>
          {max_count && (
            <p className="text-xs text-gray-500">
              Maximum: {max_count} objects
            </p>
          )}
          {count > 0 && (
            <Button
              onClick={handleReset}
              disabled={disabled}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}