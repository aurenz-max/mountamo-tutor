'use client';

import React, { useMemo, useState } from 'react';
import { MatchingActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type MatchingActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import { LuminaFeedbackCard, LuminaActionButton, answerStateClasses } from '../../ui';

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface MatchingActivityProblemProps {
  data: MatchingActivityProblemData;
}

export const MatchingActivityProblem: React.FC<MatchingActivityProblemProps> = ({ data }) => {
  const shuffledLeftItems = useMemo(() => shuffle(data.leftItems), [data.leftItems]);
  const shuffledRightItems = useMemo(() => shuffle(data.rightItems), [data.rightItems]);
  const [matches, setMatches] = useState<{ [leftId: string]: string[] }>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
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
  } = usePrimitiveEvaluation<MatchingActivityMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `matching-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleLeftClick = (leftId: string) => {
    if (isSubmitted) return;
    SoundManager.select();
    setSelectedLeft(selectedLeft === leftId ? null : leftId);
  };

  const handleRightClick = (rightId: string) => {
    if (isSubmitted || !selectedLeft) return;

    SoundManager.snap();
    setMatches(prev => {
      const current = prev[selectedLeft] || [];
      const isAlreadyMatched = current.includes(rightId);

      return {
        ...prev,
        [selectedLeft]: isAlreadyMatched
          ? current.filter(id => id !== rightId)
          : [...current, rightId]
      };
    });
  };

  const checkMatch = (leftId: string): boolean | null => {
    if (!isSubmitted) return null;
    const correctMapping = data.mappings.find(m => m.leftId === leftId);
    if (!correctMapping) return null;

    const userRightIds = matches[leftId] || [];
    const correctRightIds = correctMapping.rightIds;

    return (
      userRightIds.length === correctRightIds.length &&
      userRightIds.every(id => correctRightIds.includes(id))
    );
  };

  const handleSubmit = () => {
    if (Object.keys(matches).length === 0 || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    // Build per-pair match results
    const matchResults = data.mappings.map(mapping => {
      const userRightIds = matches[mapping.leftId] || [];
      const isCorrect =
        userRightIds.length === mapping.rightIds.length &&
        userRightIds.every(id => mapping.rightIds.includes(id));
      return {
        itemId: mapping.leftId,
        selectedMatchId: userRightIds.join(','),
        correctMatchId: mapping.rightIds.join(','),
        isCorrect,
      };
    });

    const correctPairs = matchResults.filter(r => r.isCorrect).length;
    const totalPairs = data.mappings.length;
    const accuracy = totalPairs > 0 ? Math.round((correctPairs / totalPairs) * 100) : 0;
    const allCorrect = correctPairs === totalPairs;

    const metrics: MatchingActivityMetrics = {
      type: 'matching-activity',
      totalPairs,
      correctPairs,
      incorrectPairs: totalPairs - correctPairs,
      accuracy,
      matchResults,
    };

    submitEvaluation(
      allCorrect,
      accuracy,
      metrics,
      {
        studentWork: {
          matches,
          prompt: data.prompt,
          leftItems: data.leftItems,
          rightItems: data.rightItems,
        },
      }
    );
  };

  const handleReset = () => {
    setMatches({});
    setSelectedLeft(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isRightMatched = (rightId: string): boolean => {
    return Object.values(matches).some(rightIds => rightIds.includes(rightId));
  };

  const allCorrect = isSubmitted && data.mappings.every(m => checkMatch(m.leftId));

  return (
    <div className="w-full">
      {/* Prompt */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.prompt}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      <p className="text-slate-400 mb-6 text-sm">
        Click a term on the left, then click one or more matching items on the right.
      </p>

      {/* Matching Grid — bespoke click-to-match interaction surface (the painting). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left Column */}
        <div className="space-y-3">
          {shuffledLeftItems.map((item) => {
            const isSelected = selectedLeft === item.id;
            const isCorrect = checkMatch(item.id);
            const hasMatches = (matches[item.id] || []).length > 0;

            // Grading colors are tokenized (answerStateClasses); the "matched"
            // pairing state is bespoke to this matching interaction.
            let statusClass = answerStateClasses.idle;
            if (isSelected) {
              statusClass = answerStateClasses.selected;
            } else if (hasMatches && !isSubmitted) {
              statusClass = "border-purple-500/50 bg-purple-500/10"; // bespoke: paired, pre-submit
            }

            if (isSubmitted && isCorrect !== null) {
              statusClass = isCorrect ? answerStateClasses.correct : answerStateClasses.incorrect;
            }

            return (
              <button
                key={item.id}
                onClick={() => handleLeftClick(item.id)}
                disabled={isSubmitted}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${statusClass}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-medium">{item.text}</span>
                  {hasMatches && (
                    <span className="text-xs text-slate-400 bg-black/20 px-2 py-1 rounded-full">
                      {matches[item.id].length}
                    </span>
                  )}
                  {isSubmitted && isCorrect !== null && (
                    <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                      {isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {shuffledRightItems.map((item) => {
            const isMatchedToSelected = selectedLeft && (matches[selectedLeft] || []).includes(item.id);
            const isMatched = isRightMatched(item.id);

            let statusClass = answerStateClasses.idle;
            if (isMatchedToSelected) {
              statusClass = answerStateClasses.selected;
            } else if (isMatched && !isSubmitted) {
              statusClass = "border-purple-500/50 bg-purple-500/10"; // bespoke: paired, pre-submit
            }

            if (isSubmitted && isMatched) {
              statusClass = "border-slate-600 bg-slate-800/40"; // bespoke: neutral resolved
            }

            return (
              <button
                key={item.id}
                onClick={() => handleRightClick(item.id)}
                disabled={isSubmitted || !selectedLeft}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${statusClass}`}
              >
                <span className="text-slate-200 font-medium">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={Object.keys(matches).length === 0}
            onClick={handleSubmit}
          >
            Verify Matches
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
