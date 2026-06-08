'use client';

import React, { useMemo, useState } from 'react';
import { CategorizationActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type CategorizationActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
// The drag-and-drop categorization surface is the bespoke "painting" and stays custom.
import { LuminaFeedbackCard, LuminaActionButton, answerStateClasses } from '../../ui';

interface CategorizationActivityProblemProps {
  data: CategorizationActivityProblemData;
}

export const CategorizationActivityProblem: React.FC<CategorizationActivityProblemProps> = ({ data }) => {
  // Shuffle items once so sequential category ordering from Gemini doesn't reveal answers
  const shuffledItems = useMemo(() => {
    const items = [...data.categorizationItems];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [data.categorizationItems]);

  const [itemCategories, setItemCategories] = useState<{ [itemText: string]: string }>({});
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
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
  } = usePrimitiveEvaluation<CategorizationActivityMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `categorization-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleDragStart = (itemText: string) => {
    if (isSubmitted) return;
    setDraggedItem(itemText);
  };

  const handleDrop = (category: string) => {
    if (isSubmitted || !draggedItem) return;
    SoundManager.snap();
    setItemCategories(prev => ({ ...prev, [draggedItem]: category }));
    setDraggedItem(null);
  };

  const checkItemCategory = (itemText: string): boolean | null => {
    if (!isSubmitted) return null;
    const item = data.categorizationItems.find(i => i.itemText === itemText);
    if (!item) return null;
    return itemCategories[itemText] === item.correctCategory;
  };

  const handleSubmit = () => {
    const allPlaced = data.categorizationItems.every(item => itemCategories[item.itemText]);
    if (!allPlaced || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    // Build per-category results
    const categoryResults = data.categories.map(category => {
      const itemsPlaced = data.categorizationItems
        .filter(item => itemCategories[item.itemText] === category)
        .map(item => item.itemText);
      const correctItems = data.categorizationItems
        .filter(item => item.correctCategory === category)
        .map(item => item.itemText);
      const correctInCategory = itemsPlaced.filter(itemText =>
        data.categorizationItems.find(i => i.itemText === itemText)?.correctCategory === category
      ).length;
      const precision = itemsPlaced.length > 0 ? Math.round((correctInCategory / itemsPlaced.length) * 100) : 0;

      return {
        categoryId: category,
        categoryName: category,
        itemsPlaced,
        correctItems,
        precision,
      };
    });

    const correctlyCategorized = data.categorizationItems.filter(
      item => itemCategories[item.itemText] === item.correctCategory
    ).length;
    const totalItems = data.categorizationItems.length;
    const accuracy = totalItems > 0 ? Math.round((correctlyCategorized / totalItems) * 100) : 0;
    const allCorrect = correctlyCategorized === totalItems;

    const metrics: CategorizationActivityMetrics = {
      type: 'categorization-activity',
      totalItems,
      correctlyCategorized,
      accuracy,
      categoryResults,
    };

    submitEvaluation(
      allCorrect,
      accuracy,
      metrics,
      {
        studentWork: {
          itemCategories,
          instruction: data.instruction,
          categories: data.categories,
        },
      }
    );
  };

  const handleReset = () => {
    setItemCategories({});
    setDraggedItem(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const getUncategorizedItems = () => {
    return shuffledItems.filter(item => !itemCategories[item.itemText]);
  };

  const getItemsInCategory = (category: string) => {
    return shuffledItems.filter(item => itemCategories[item.itemText] === category);
  };

  const allCorrect = isSubmitted && data.categorizationItems.every(item => checkItemCategory(item.itemText));

  return (
    <div className="w-full">
      {/* Instruction */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.instruction}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      <p className="text-slate-400 mb-6 text-sm">
        Drag items into the correct category.
      </p>

      {/* Uncategorized Items — bespoke drag source (the painting), stays custom */}
      {getUncategorizedItems().length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-dashed border-white/20 bg-black/10">
          <div className="text-sm text-slate-400 mb-3 font-mono uppercase tracking-wider">Items to Categorize</div>
          <div className="flex flex-wrap gap-2">
            {getUncategorizedItems().map((item) => (
              <div
                key={item.itemText}
                draggable={!isSubmitted}
                onDragStart={() => handleDragStart(item.itemText)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg cursor-move hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <span className="text-slate-200 font-medium">{item.itemText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Columns — bespoke drop targets (the painting), stays custom */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.categories.map((category) => {
          const itemsInCategory = getItemsInCategory(category);

          return (
            <div
              key={category}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(category)}
              className="p-4 rounded-xl border border-white/10 bg-white/5 min-h-[200px]"
            >
              <h4 className="text-lg font-bold text-blue-400 mb-4">{category}</h4>
              <div className="space-y-2">
                {itemsInCategory.map((item) => {
                  const isCorrect = checkItemCategory(item.itemText);
                  // Placed-chip default is bespoke; graded colors are tokenized.
                  let statusClass = "bg-black/20 border-white/10"; // bespoke: placed, pre-submit
                  if (isSubmitted && isCorrect !== null) {
                    statusClass = isCorrect ? answerStateClasses.correct : answerStateClasses.incorrect;
                  }

                  return (
                    <div
                      key={item.itemText}
                      draggable={!isSubmitted}
                      onDragStart={() => handleDragStart(item.itemText)}
                      className={`px-3 py-2 rounded-lg border transition-all ${statusClass} ${!isSubmitted && 'cursor-move hover:bg-black/30'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 text-sm">{item.itemText}</span>
                        {isSubmitted && isCorrect !== null && (
                          <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={getUncategorizedItems().length > 0}
            onClick={handleSubmit}
          >
            Verify Categories
          </LuminaActionButton>
        ) : (
          <div className="w-full space-y-4">
            <LuminaFeedbackCard
              status={allCorrect ? 'correct' : 'insight'}
              label={allCorrect ? 'Correct Analysis' : undefined}
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
