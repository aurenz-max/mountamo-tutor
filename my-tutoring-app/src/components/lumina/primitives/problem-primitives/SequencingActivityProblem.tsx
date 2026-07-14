'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SequencingActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type SequencingActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Shared visual state comes from the Lumina UI kit; drag mechanics stay bespoke.
import {
  LuminaActionButton,
  LuminaDropZone,
  LuminaFeedbackCard,
  type DropZoneState,
} from '../../ui';

/**
 * Sequencing Activity Problem Component
 *
 * UI: ordering mechanics stay bespoke while drop-zone and eval-loop chrome
 * come from the Lumina UI kit.
 */

interface SequencingActivityProblemProps {
  data: SequencingActivityProblemData;
}

export const SequencingActivityProblem: React.FC<SequencingActivityProblemProps> = ({ data }) => {
  const [orderedItems, setOrderedItems] = useState<string[]>(() => {
    // Shuffle items initially
    return [...data.items].sort(() => Math.random() - 0.5);
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showGradingFlash, setShowGradingFlash] = useState(false);
  const gradingFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    },
    []
  );

  // Destructure evaluation props (injected by KnowledgeCheck/ProblemRenderer)
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data as any;

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<SequencingActivityMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `sequencing-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleDragStart = (index: number) => {
    if (isSubmitted) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setHoveredIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setHoveredIndex(null);
    if (isSubmitted || draggedIndex === null) return;

    SoundManager.snap();
    const newItems = [...orderedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setOrderedItems(newItems);
    setDraggedIndex(null);
  };

  const handleSubmit = () => {
    if (hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const correctlyPlaced = orderedItems.filter((item, i) => data.items[i] === item).length;
    const totalItems = data.items.length;
    const sequenceAccuracy = totalItems > 0 ? Math.round((correctlyPlaced / totalItems) * 100) : 0;
    const isCorrectOrder = correctlyPlaced === totalItems;

    if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    setShowGradingFlash(true);
    gradingFlashTimer.current = setTimeout(() => setShowGradingFlash(false), 900);

    const metrics: SequencingActivityMetrics = {
      type: 'sequencing-activity',
      totalItems,
      correctlyPlaced,
      sequenceAccuracy,
      studentSequence: orderedItems,
      correctSequence: data.items,
    };

    submitEvaluation(
      isCorrectOrder,
      sequenceAccuracy,
      metrics,
      {
        studentWork: {
          orderedItems,
          instruction: data.instruction,
        },
      }
    );
  };

  const handleReset = () => {
    setOrderedItems([...data.items].sort(() => Math.random() - 0.5));
    setDraggedIndex(null);
    setHoveredIndex(null);
    setIsSubmitted(false);
    setShowGradingFlash(false);
    if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    resetEvaluationAttempt();
  };

  const isCorrectOrder = JSON.stringify(orderedItems) === JSON.stringify(data.items);

  return (
    <div className="w-full">
      {/* Instruction */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.instruction}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      <p className="text-slate-400 mb-6 text-sm">
        Drag and drop to arrange items in the correct order.
      </p>

      {/* Sequencing Items — bespoke drag surface, left untouched */}
      <div className="space-y-3 mb-8">
        {orderedItems.map((item, index) => {
          const isCorrectPosition = isSubmitted && data.items[index] === item;
          const zoneState: DropZoneState =
            hoveredIndex === index
              ? 'dragOver'
              : showGradingFlash
                ? isCorrectPosition
                  ? 'correct'
                  : 'incorrect'
                : 'filled';

          return (
            <LuminaDropZone
              key={`${item}-${index}`}
              state={zoneState}
              emptyPrompt="Drop item here"
              draggable={!isSubmitted}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setHoveredIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              className={`min-h-0 flex-nowrap items-stretch justify-stretch gap-0 p-0 ${!isSubmitted ? 'cursor-move' : 'cursor-default'} ${draggedIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="flex w-full items-center gap-4 p-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/20 text-slate-400 font-mono text-sm">
                  {index + 1}
                </div>
                <span className="text-slate-200 font-medium flex-1">{item}</span>
                {!isSubmitted && (
                  <div className="text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                  </div>
                )}
                {isSubmitted && (
                  <span className={isCorrectPosition ? 'text-emerald-400' : 'text-red-400'}>
                    {isCorrectPosition ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </LuminaDropZone>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton action="check" onClick={handleSubmit}>
            Verify Order
          </LuminaActionButton>
        ) : (
          <div className="w-full space-y-4">
            <LuminaFeedbackCard
              status={isCorrectOrder ? 'correct' : 'insight'}
              label={isCorrectOrder ? 'Perfect Order!' : 'Review the Sequence'}
              teachingNote={data.teachingNote}
            >
              {data.rationale}
            </LuminaFeedbackCard>
            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        )}
      </div>
    </div>
  );
};
