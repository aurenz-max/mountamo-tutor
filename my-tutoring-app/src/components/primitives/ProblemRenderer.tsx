import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowRight, RotateCcw } from 'lucide-react';

// Import primitive components
import StaticText from './StaticText';
import DragAndDropZone from './DragAndDropZone';
import NumberTracing from './NumberTracing';
import MultipleChoice from './MultipleChoice';
import ObjectCounter from './ObjectCounter';

interface ProblemRendererProps {
  /** The composable problem template from the backend */
  composableTemplate: {
    problem_id: string;
    learning_objective: string;
    layout: {
      type: string;
      containers: Array<{
        id: string;
        primitives: Array<{
          primitive_id: string;
          primitive_type: string;
          parameters: any;
          state_dependencies?: Array<{
            target_id: string;
            required_state: string;
            action: string;
          }>;
          visible?: boolean;
          enabled?: boolean;
        }>;
      }>;
    };
    evaluation_logic: {
      criteria: Array<{
        primitive_id: string;
        criterion_type: string;
        weight?: number;
        required_value?: any;
      }>;
      passing_score?: number;
      partial_credit_enabled?: boolean;
    };
  };
  
  /** Student's existing responses (for resuming/reviewing) */
  initialResponses?: Record<string, any>;
  
  /** Whether this is read-only (review mode) */
  disabled?: boolean;
  
  /** Callback when student completes all primitives */
  onComplete?: (responses: Record<string, any>) => void;
  
  /** Callback when student responds to a primitive */
  onPrimitiveResponse?: (primitiveId: string, response: any) => void;
}

export default function ProblemRenderer({
  composableTemplate,
  initialResponses = {},
  disabled = false,
  onComplete,
  onPrimitiveResponse
}: ProblemRendererProps) {
  // Track student responses for each primitive
  const [primitiveStates, setPrimitiveStates] = useState<Record<string, {
    status: 'pending' | 'complete' | 'correct' | 'incorrect';
    value: any;
    attempts?: number;
  }>>(() => {
    // Initialize with existing responses or default state
    const initialStates: Record<string, any> = {};
    
    // Initialize all primitives as pending
    composableTemplate.layout.containers.forEach(container => {
      container.primitives.forEach(primitive => {
        initialStates[primitive.primitive_id] = {
          status: initialResponses[primitive.primitive_id] ? 'complete' : 'pending',
          value: initialResponses[primitive.primitive_id] || null,
          attempts: 0
        };
      });
    });
    
    return initialStates;
  });

  // Check if a primitive should be visible based on state dependencies
  const isPrimitiveVisible = useCallback((primitive: any) => {
    if (primitive.visible === false) return false;
    
    if (!primitive.state_dependencies || primitive.state_dependencies.length === 0) {
      return true;
    }
    
    return primitive.state_dependencies.every((dep: any) => {
      const targetState = primitiveStates[dep.target_id];
      if (!targetState) return false;
      
      const meetsRequirement = targetState.status === dep.required_state;
      
      // Handle different actions
      if (dep.action === 'hide') {
        return !meetsRequirement; // Hide if requirement is met
      } else {
        return meetsRequirement; // Show/enable if requirement is met
      }
    });
  }, [primitiveStates]);

  // Check if a primitive should be enabled
  const isPrimitiveEnabled = useCallback((primitive: any) => {
    if (disabled || primitive.enabled === false) return false;
    
    if (!primitive.state_dependencies || primitive.state_dependencies.length === 0) {
      return true;
    }
    
    return primitive.state_dependencies.every((dep: any) => {
      const targetState = primitiveStates[dep.target_id];
      if (!targetState) return false;
      
      if (dep.action === 'enable') {
        return targetState.status === dep.required_state;
      } else if (dep.action === 'disable') {
        return targetState.status !== dep.required_state;
      }
      
      return true; // Default to enabled
    });
  }, [primitiveStates, disabled]);

  // Handle primitive response updates
  const handlePrimitiveUpdate = useCallback((primitiveId: string, value: any, isComplete: boolean = false) => {
    setPrimitiveStates(prev => {
      const newStates = {
        ...prev,
        [primitiveId]: {
          ...prev[primitiveId],
          value,
          status: isComplete ? 'complete' : 'pending',
          attempts: (prev[primitiveId]?.attempts || 0) + (isComplete ? 1 : 0)
        }
      };
      
      // Check if all primitives are complete
      const allComplete = Object.values(newStates).every(state => state.status === 'complete');
      
      if (allComplete && onComplete) {
        // Extract just the values for the completion callback
        const responses = Object.entries(newStates).reduce((acc, [id, state]) => {
          acc[id] = state.value;
          return acc;
        }, {} as Record<string, any>);
        
        onComplete(responses);
      }
      
      return newStates;
    });
    
    // Notify parent of individual primitive response
    if (onPrimitiveResponse && isComplete) {
      onPrimitiveResponse(primitiveId, value);
    }
  }, [onComplete, onPrimitiveResponse]);

  // Render individual primitive components
  const renderPrimitive = useCallback((primitive: any) => {
    const visible = isPrimitiveVisible(primitive);
    const enabled = isPrimitiveEnabled(primitive);
    const currentState = primitiveStates[primitive.primitive_id];
    
    if (!visible) return null;
    
    const commonProps = {
      disabled: !enabled,
      initialValue: currentState?.value,
      onUpdate: (value: any, isComplete?: boolean) => 
        handlePrimitiveUpdate(primitive.primitive_id, value, isComplete),
      showValidation: currentState?.status === 'complete'
    };
    
    switch (primitive.primitive_type) {
      case 'StaticText':
        return (
          <StaticText
            key={primitive.primitive_id}
            parameters={primitive.parameters}
            {...commonProps}
          />
        );
        
      case 'DragAndDropZone':
        return (
          <DragAndDropZone
            key={primitive.primitive_id}
            parameters={primitive.parameters}
            {...commonProps}
          />
        );
        
      case 'NumberTracing':
        return (
          <NumberTracing
            key={primitive.primitive_id}
            parameters={primitive.parameters}
            {...commonProps}
          />
        );
        
      case 'MultipleChoice':
        return (
          <MultipleChoice
            key={primitive.primitive_id}
            parameters={primitive.parameters}
            {...commonProps}
          />
        );
        
      case 'ObjectCounter':
        return (
          <ObjectCounter
            key={primitive.primitive_id}
            parameters={primitive.parameters}
            {...commonProps}
          />
        );
        
      default:
        return (
          <div key={primitive.primitive_id} className="p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">
              Unknown primitive type: {primitive.primitive_type}
            </p>
          </div>
        );
    }
  }, [isPrimitiveVisible, isPrimitiveEnabled, primitiveStates, handlePrimitiveUpdate]);

  // Calculate completion progress
  const progress = useMemo(() => {
    const totalPrimitives = Object.keys(primitiveStates).length;
    const completedPrimitives = Object.values(primitiveStates).filter(
      state => state.status === 'complete'
    ).length;
    
    return {
      completed: completedPrimitives,
      total: totalPrimitives,
      percentage: totalPrimitives > 0 ? Math.round((completedPrimitives / totalPrimitives) * 100) : 0
    };
  }, [primitiveStates]);

  // Reset all primitive states
  const handleReset = useCallback(() => {
    setPrimitiveStates(prev => {
      const resetStates: Record<string, any> = {};
      Object.keys(prev).forEach(id => {
        resetStates[id] = {
          status: 'pending',
          value: null,
          attempts: 0
        };
      });
      return resetStates;
    });
  }, []);

  // Check if problem is complete
  const isComplete = progress.completed === progress.total && progress.total > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="shadow-lg border-l-4 border-l-blue-500">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Interactive Learning Activity
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {composableTemplate.learning_objective}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {progress.completed} / {progress.total} steps
              </Badge>
              {isComplete && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete!
                </Badge>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          {progress.total > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Layout Rendering */}
      {composableTemplate.layout.containers.map((container) => (
        <div key={container.id} className="space-y-4">
          {container.primitives.map(primitive => renderPrimitive(primitive))}
        </div>
      ))}

      {/* Completion Actions */}
      {isComplete && (
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Great work! You completed all the steps!
              </h3>
              <p className="text-gray-600 mb-4">
                You've successfully worked through this interactive learning activity.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                {onComplete && (
                  <Button 
                    onClick={() => onComplete(
                      Object.entries(primitiveStates).reduce((acc, [id, state]) => {
                        acc[id] = state.value;
                        return acc;
                      }, {} as Record<string, any>)
                    )}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}