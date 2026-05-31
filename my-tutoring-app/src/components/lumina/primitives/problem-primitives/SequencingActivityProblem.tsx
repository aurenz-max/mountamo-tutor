'use client';

import React, { useState } from 'react';
import { SequencingActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type SequencingActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import { LuminaFeedbackCard, LuminaActionButton, answerStateClasses } from '../../ui';

/**
 * Sequencing Activity Problem Component
 *
 * UI: the drag-and-drop ordering surface is the bespoke "painting" and stays
 * custom. Only the eval-loop chrome (feedback banner, action buttons) comes
 * from the Lumina UI kit (LuminaFeedbackCard / LuminaActionButton).
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
  const [isSubmitted, setIsSubmitted] = useState(false);

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
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleDragStart = (index: number) => {
    if (isSubmitted) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
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
    setIsSubmitted(false);
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
          const isWrongPosition = isSubmitted && data.items[index] !== item;

          // Graded position colors are tokenized; the drag-in-progress state is bespoke.
          let statusClass = answerStateClasses.idle;
          if (draggedIndex === index) {
            statusClass = "border-blue-500 bg-blue-500/20 opacity-50"; // bespoke: dragging
          }
          if (isSubmitted) {
            statusClass = isCorrectPosition ? answerStateClasses.correct : answerStateClasses.incorrect;
          }

          return (
            <div
              key={`${item}-${index}`}
              draggable={!isSubmitted}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`p-4 rounded-xl border transition-all duration-300 cursor-move ${statusClass} ${!isSubmitted && 'hover:border-white/20 hover:bg-white/10'}`}
            >
              <div className="flex items-center gap-4">
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
            </div>
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
