import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface DragItem {
  id: string;
  image_url: string;
  label?: string;
}

interface DropZone {
  id: string;
  image_url: string;
  label?: string;
  max_items?: number;
}

interface SolutionRule {
  type: 'count' | 'specific_ids' | 'any';
  value: number | string[];
}

interface DragAndDropZoneProps {
  parameters: {
    prompt: string;
    draggable_items: DragItem[];
    drop_zone: DropZone;
    solution_rule: SolutionRule;
  };
  disabled?: boolean;
  initialValue?: string[];
  onUpdate?: (value: any, isComplete?: boolean) => void;
  showValidation?: boolean;
}

export default function DragAndDropZone({ 
  parameters,
  disabled = false,
  initialValue = [],
  onUpdate,
  showValidation = false
}: DragAndDropZoneProps) {
  const {
    prompt,
    draggable_items,
    drop_zone,
    solution_rule
  } = parameters;

  // Track which items are in the drop zone
  const [droppedItems, setDroppedItems] = useState<string[]>(initialValue);
  
  // Track drag state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Evaluate if the current state is correct
  const evaluateCorrectness = useCallback((items: string[]) => {
    switch (solution_rule.type) {
      case 'count':
        return items.length === (solution_rule.value as number);
      case 'specific_ids':
        const required = solution_rule.value as string[];
        return required.every(id => items.includes(id)) && 
               items.every(id => required.includes(id));
      case 'any':
        return items.length > 0;
      default:
        return false;
    }
  }, [solution_rule]);

  const isCorrect = useMemo(() => evaluateCorrectness(droppedItems), [droppedItems, evaluateCorrectness]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    if (disabled) return;
    setDraggedItem(itemId);
    e.dataTransfer.setData('text/plain', itemId);
  }, [disabled]);

  // Handle drag over drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId || droppedItems.includes(itemId)) return;
    
    // Check max items limit
    if (drop_zone.max_items && droppedItems.length >= drop_zone.max_items) {
      return;
    }
    
    const newDroppedItems = [...droppedItems, itemId];
    setDroppedItems(newDroppedItems);
    setDraggedItem(null);
    
    // Update parent
    if (onUpdate) {
      onUpdate(newDroppedItems, evaluateCorrectness(newDroppedItems));
    }
  }, [disabled, droppedItems, drop_zone.max_items, onUpdate, evaluateCorrectness]);

  // Handle item removal from drop zone
  const handleRemoveItem = useCallback((itemId: string) => {
    if (disabled) return;
    
    const newDroppedItems = droppedItems.filter(id => id !== itemId);
    setDroppedItems(newDroppedItems);
    
    if (onUpdate) {
      onUpdate(newDroppedItems, evaluateCorrectness(newDroppedItems));
    }
  }, [disabled, droppedItems, onUpdate, evaluateCorrectness]);

  // Filter available items (not in drop zone)
  const availableItems = draggable_items.filter(item => !droppedItems.includes(item.id));

  return (
    <Card className={`${disabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6 space-y-6">
        {/* Prompt */}
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800">{prompt}</p>
          {showValidation && (
            <div className={`mt-2 flex items-center justify-center gap-2 ${
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

        {/* Available Items */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">Available Items:</h4>
          <div className="flex flex-wrap gap-3 min-h-[80px] p-3 bg-gray-50 rounded-lg border">
            {availableItems.map((item) => (
              <div
                key={item.id}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, item.id)}
                className={`
                  w-16 h-16 bg-white rounded-lg border-2 border-gray-200 
                  flex items-center justify-center cursor-move
                  hover:border-blue-300 transition-colors
                  ${draggedItem === item.id ? 'opacity-50' : ''}
                  ${disabled ? 'cursor-not-allowed' : ''}
                `}
              >
                {item.image_url.endsWith('.svg') || item.image_url.includes('icon') ? (
                  <div className="text-2xl">
                    {item.label ? item.label.charAt(0) : '📦'}
                  </div>
                ) : (
                  <img 
                    src={item.image_url} 
                    alt={item.label || item.id}
                    className="w-12 h-12 object-contain"
                    draggable={false}
                  />
                )}
              </div>
            ))}
            {availableItems.length === 0 && (
              <p className="text-gray-400 text-sm">No items available</p>
            )}
          </div>
        </div>

        {/* Drop Zone */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            {drop_zone.label || 'Drop Zone'}:
          </h4>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              min-h-[120px] p-4 rounded-lg border-2 border-dashed
              flex flex-wrap gap-3 items-start content-start
              transition-colors
              ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}
              ${showValidation && isCorrect ? 'border-green-400 bg-green-50' : ''}
              ${showValidation && !isCorrect && droppedItems.length > 0 ? 'border-red-400 bg-red-50' : ''}
            `}
          >
            {/* Drop zone background image/icon */}
            {droppedItems.length === 0 && (
              <div className="w-full flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="text-4xl mb-2">
                  {drop_zone.image_url.includes('basket') ? '🧺' : '📦'}
                </div>
                <p className="text-sm">Drop items here</p>
              </div>
            )}
            
            {/* Dropped Items */}
            {droppedItems.map((itemId) => {
              const item = draggable_items.find(i => i.id === itemId);
              if (!item) return null;
              
              return (
                <div
                  key={itemId}
                  className="relative w-16 h-16 bg-white rounded-lg border-2 border-blue-300 flex items-center justify-center"
                >
                  {item.image_url.endsWith('.svg') || item.image_url.includes('icon') ? (
                    <div className="text-2xl">
                      {item.label ? item.label.charAt(0) : '📦'}
                    </div>
                  ) : (
                    <img 
                      src={item.image_url} 
                      alt={item.label || item.id}
                      className="w-12 h-12 object-contain"
                    />
                  )}
                  {!disabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveItem(itemId)}
                      className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-full"
                    >
                      ×
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Count indicator */}
          <div className="mt-2 text-sm text-gray-600 text-center">
            {droppedItems.length} item{droppedItems.length !== 1 ? 's' : ''} 
            {drop_zone.max_items && ` (max: ${drop_zone.max_items})`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}