'use client';

import React, { useState } from 'react';
import { SequencingActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import {
  usePrimitiveEvaluation,
  type SequencingActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';

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

      {/* Sequencing Items */}
      <div className="space-y-3 mb-8">
        {orderedItems.map((item, index) => {
          const isCorrectPosition = isSubmitted && data.items[index] === item;
          const isWrongPosition = isSubmitted && data.items[index] !== item;

          let statusClass = "border-white/10 bg-white/5";
          if (draggedIndex === index) {
            statusClass = "border-blue-500 bg-blue-500/20 opacity-50";
          }
          if (isSubmitted) {
            statusClass = isCorrectPosition
              ? "border-emerald-500 bg-emerald-500/20"
              : "border-red-500 bg-red-500/20";
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
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Verify Order
          </button>
        ) : (
          <div className="w-full space-y-4">
            <div className="animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${isCorrectOrder ? 'text-emerald-400' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isCorrectOrder ?
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  }
                </svg>
                <span>{isCorrectOrder ? 'Perfect Order!' : 'Review the Sequence'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-lg font-light mb-3">
                {data.rationale}
              </p>
              {data.teachingNote && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-sm text-slate-400 italic">
                    💡 {data.teachingNote}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium tracking-wide transition-all shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
