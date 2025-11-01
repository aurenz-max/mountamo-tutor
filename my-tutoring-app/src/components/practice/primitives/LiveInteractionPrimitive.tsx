'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Lightbulb, Sparkles } from 'lucide-react';
import type { LiveInteractionPrimitiveProps } from './types';
import { VisualPrimitiveRenderer } from '../visuals/VisualPrimitiveRenderer';
import { formatFeedback } from '@/lib/feedbackUtils';

/**
 * LiveInteractionPrimitive - Interactive problem component for real-time engagement
 *
 * This component renders live interaction problems that combine:
 * - Visual interactive elements (clickable cards, draggable objects)
 * - Real-time AI tutoring via PracticeAICoach
 * - Immediate feedback with visual effects
 * - Standard submission flow for grading
 *
 * It follows the primitives pattern: "dumb" UI component that only renders
 * and emits events. State management is handled by parent controller.
 */
const LiveInteractionPrimitive: React.FC<LiveInteractionPrimitiveProps> = ({
  problem,
  isSubmitted,
  currentResponse,
  feedback,
  onUpdate,
  disabled = false,
  disableFeedback = false,
  aiCoachRef
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(
    currentResponse?.selected_target_id || null
  );
  const [showVisualEffect, setShowVisualEffect] = useState(false);

  // Update selected target from currentResponse prop
  useEffect(() => {
    if (currentResponse?.selected_target_id) {
      setSelectedTarget(currentResponse.selected_target_id);
    }
  }, [currentResponse]);

  // Show visual effect when feedback is received
  useEffect(() => {
    if (isSubmitted && feedback?.review?.detailed_results?.visual_effect) {
      setShowVisualEffect(true);
      // Hide effect after animation completes
      const timer = setTimeout(() => setShowVisualEffect(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, feedback]);

  const handleTargetClick = (targetId: string) => {
    if (disabled || isSubmitted) return;

    setSelectedTarget(targetId);

    // Update parent with response data
    onUpdate({
      selected_target_id: targetId,
      interaction_mode: problem.interaction_config.mode
    });

    // Notify AI Coach of target selection for real-time feedback (if available)
    if (aiCoachRef?.current && !isSubmitted) {
      aiCoachRef.current.sendTargetSelection(targetId);
    }
  };

  const getTargetState = (targetId: string) => {
    if (!isSubmitted) {
      return selectedTarget === targetId ? 'selected' : 'default';
    }

    const target = problem.interaction_config.targets.find(t => t.id === targetId);
    if (target?.is_correct) return 'correct';
    if (selectedTarget === targetId && !target?.is_correct) return 'incorrect';
    return 'default';
  };

  const renderVisualEffect = () => {
    if (!showVisualEffect || !feedback?.review?.detailed_results) return null;

    const visualEffect = feedback.review.detailed_results.visual_effect;

    if (visualEffect === 'success_animation') {
      return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="animate-bounce">
            <Sparkles className="w-24 h-24 text-yellow-400 drop-shadow-lg" />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Problem Card */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Live Interaction
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
              {problem.prompt.instruction}
            </h3>
          </div>

          {/* Visual Content Area - NEW STRUCTURE SUPPORT */}
          <div className="relative">
            {renderVisualEffect()}

            <div className="space-y-4">
              {/* Display Visual (informational content) */}
              {problem.visual_content?.display_visual && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <VisualPrimitiveRenderer
                    visualData={{
                      type: problem.visual_content.display_visual.visual_type,
                      data: problem.visual_content.display_visual.visual_data
                    }}
                    className=""
                  />
                </div>
              )}

              {/* Interaction Visual (NEW LOCATION: in interaction_config) */}
              {problem.interaction_config?.interaction_visual && (
                <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
                  <VisualPrimitiveRenderer
                    visualData={{
                      type: problem.interaction_config.interaction_visual.visual_type,
                      data: problem.interaction_config.interaction_visual.visual_data
                    }}
                    className=""
                    interactionConfig={problem.interaction_config}
                    selectedTargetId={selectedTarget}
                    onTargetClick={handleTargetClick}
                    isSubmitted={isSubmitted}
                    getTargetState={getTargetState}
                  />
                </div>
              )}

              {/* LEGACY FALLBACK: Old location (visual_content.interaction_visual) */}
              {!problem.interaction_config?.interaction_visual && problem.visual_content?.interaction_visual && (
                <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
                  <VisualPrimitiveRenderer
                    visualData={{
                      type: problem.visual_content.interaction_visual.visual_type,
                      data: problem.visual_content.interaction_visual.visual_data
                    }}
                    className=""
                    interactionConfig={problem.interaction_config}
                    selectedTargetId={selectedTarget}
                    onTargetClick={handleTargetClick}
                    isSubmitted={isSubmitted}
                    getTargetState={getTargetState}
                  />
                </div>
              )}

              {/* LEGACY: Single visual format (backward compatibility) */}
              {!problem.visual_content?.display_visual && !problem.visual_content?.interaction_visual &&
               problem.visual_content?.visual_type && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <VisualPrimitiveRenderer
                    visualData={{
                      type: problem.visual_content.visual_type,
                      data: problem.visual_content.visual_data
                    }}
                    className=""
                    interactionConfig={problem.interaction_config}
                    selectedTargetId={selectedTarget}
                    onTargetClick={handleTargetClick}
                    isSubmitted={isSubmitted}
                    getTargetState={getTargetState}
                  />

                  {/* LEGACY: Interactive Overlay for targets with descriptions */}
                  {problem.interaction_config.mode === 'click' &&
                    problem.interaction_config.targets.some(t => t.description) && (
                    <div className="mt-4 space-y-3">
                      {problem.interaction_config.targets.map((target) => {
                        const state = getTargetState(target.id);

                        return (
                          <div
                            key={target.id}
                            onClick={() => handleTargetClick(target.id)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              state === 'correct'
                                ? 'bg-green-50 border-green-300 shadow-md'
                                : state === 'incorrect'
                                  ? 'bg-red-50 border-red-300'
                                  : state === 'selected'
                                    ? 'bg-blue-50 border-blue-300 shadow-md'
                                    : isSubmitted
                                      ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                                state === 'correct'
                                  ? 'bg-green-100 border-green-300'
                                  : state === 'incorrect'
                                    ? 'bg-red-100 border-red-300'
                                    : state === 'selected'
                                      ? 'bg-blue-100 border-blue-300'
                                      : 'border-gray-300'
                              }`}>
                                {state === 'correct' && <CheckCircle className="w-5 h-5 text-green-600" />}
                                {state === 'incorrect' && <XCircle className="w-5 h-5 text-red-600" />}
                                {state === 'selected' && !isSubmitted && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                              </div>
                              <div className="flex-1">
                                <span className={`text-base ${
                                  state === 'correct'
                                    ? 'text-green-800 font-medium'
                                    : state === 'incorrect'
                                      ? 'text-red-800'
                                      : state === 'selected'
                                        ? 'text-blue-800 font-medium'
                                        : 'text-gray-700'
                                }`}>
                                  {target.description}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Feedback after submission */}
          {isSubmitted && !disableFeedback && feedback?.review && (
            <div className="space-y-3">
              {/* Main feedback message */}
              <div className={`p-4 rounded-lg border-2 ${
                feedback.review.correct
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start gap-2">
                  {feedback.review.correct ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      feedback.review.correct ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {formatFeedback(feedback.review.feedback)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Hint for incorrect answers */}
              {!feedback.review.correct && feedback.review.detailed_results?.hint && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Hint:</span> {feedback.review.detailed_results.hint}
                    </p>
                  </div>
                </div>
              )}

              {/* Score display */}
              {feedback.review.score !== undefined && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">Score:</span>
                  <Badge className="bg-blue-600 text-white">
                    {feedback.review.score}/10
                  </Badge>
                </div>
              )}

              {/* Additional feedback details */}
              {feedback.review.detailed_results?.target_description && (
                <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">You selected:</span>{' '}
                  {feedback.review.detailed_results.target_description}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveInteractionPrimitive;
