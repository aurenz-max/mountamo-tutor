'use client';

import React, { useMemo, useState } from 'react';
import { MatchingActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import {
  usePrimitiveEvaluation,
  type MatchingActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';

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
    setSelectedLeft(selectedLeft === leftId ? null : leftId);
  };

  const handleRightClick = (rightId: string) => {
    if (isSubmitted || !selectedLeft) return;

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

      {/* Matching Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left Column */}
        <div className="space-y-3">
          {shuffledLeftItems.map((item) => {
            const isSelected = selectedLeft === item.id;
            const isCorrect = checkMatch(item.id);
            const hasMatches = (matches[item.id] || []).length > 0;

            let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
            if (isSelected) {
              statusClass = "border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
            } else if (hasMatches && !isSubmitted) {
              statusClass = "border-purple-500/50 bg-purple-500/10";
            }

            if (isSubmitted && isCorrect !== null) {
              statusClass = isCorrect
                ? "border-emerald-500 bg-emerald-500/20"
                : "border-red-500 bg-red-500/20";
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

            let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
            if (isMatchedToSelected) {
              statusClass = "border-blue-500 bg-blue-500/20";
            } else if (isMatched && !isSubmitted) {
              statusClass = "border-purple-500/50 bg-purple-500/10";
            }

            if (isSubmitted && isMatched) {
              statusClass = "border-slate-600 bg-slate-800/40";
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
          <button
            onClick={handleSubmit}
            disabled={Object.keys(matches).length === 0}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Verify Matches
          </button>
        ) : (
          <div className="w-full space-y-4">
            <div className="animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${allCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {allCorrect ?
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  }
                </svg>
                <span>{allCorrect ? 'All Correct!' : 'Review Your Matches'}</span>
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
