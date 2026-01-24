'use client';

import React, { useState } from 'react';
import { TrueFalseProblemData, VisualObjectCollection, VisualComparisonData, LetterTracingData, LetterPictureData, AlphabetSequenceData, RhymingPairsData, SightWordCardData, SoundSortData } from '../../types';
import { ObjectCollection, ComparisonPanel, LetterPicture, AlphabetSequence, RhymingPairs, SightWordCard, SoundSort } from '../visual-primitives';
import { LetterTracing } from '../LetterTracing';
import {
  usePrimitiveEvaluation,
  type TrueFalseMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';

/**
 * True/False Problem Component
 *
 * EVALUATION INTEGRATION:
 * - Tracks student responses and performance on true/false questions
 * - Submits evaluation metrics on answer submission
 * - Supports competency tracking via skillId/subskillId/objectiveId
 * - Enables retry mechanism with resetAttempt
 */

interface TrueFalseProblemProps {
  data: TrueFalseProblemData;
}

export const TrueFalseProblem: React.FC<TrueFalseProblemProps> = ({ data }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<TrueFalseMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `true-false-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSelect = (answer: boolean) => {
    if (isSubmitted) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const isCorrect = selectedAnswer === data.correct;

    // Build evaluation metrics
    const metrics: TrueFalseMetrics = {
      type: 'true-false',
      isCorrect,
      selectedAnswer,
      correctAnswer: data.correct,
    };

    // Submit evaluation result
    submitEvaluation(
      isCorrect,
      isCorrect ? 100 : 0,
      metrics,
      {
        studentWork: {
          selectedAnswer,
          statement: data.statement,
        },
      }
    );
  };

  const handleReset = () => {
    setSelectedAnswer(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isCorrect = selectedAnswer === data.correct;

  return (
    <div className="w-full">
      {/* Statement */}
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
        {data.statement}
      </h3>

      {/* Visual Primitive (if present) */}
      {data.visual && (
        <div className="mb-8">
          {data.visual.type === 'object-collection' && (
            <ObjectCollection data={data.visual.data as VisualObjectCollection} />
          )}
          {data.visual.type === 'comparison-panel' && (
            <ComparisonPanel data={data.visual.data as VisualComparisonData} />
          )}
          {data.visual.type === 'letter-tracing' && (
            <LetterTracing data={data.visual.data as LetterTracingData} />
          )}
          {data.visual.type === 'letter-picture' && (
            <LetterPicture data={data.visual.data as LetterPictureData} />
          )}
          {data.visual.type === 'alphabet-sequence' && (
            <AlphabetSequence data={data.visual.data as AlphabetSequenceData} />
          )}
          {data.visual.type === 'rhyming-pairs' && (
            <RhymingPairs data={data.visual.data as RhymingPairsData} />
          )}
          {data.visual.type === 'sight-word-card' && (
            <SightWordCard data={data.visual.data as SightWordCardData} />
          )}
          {data.visual.type === 'sound-sort' && (
            <SoundSort data={data.visual.data as SoundSortData} />
          )}
        </div>
      )}

      {/* True/False Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
        {[
          { value: true, label: 'True', icon: '✓' },
          { value: false, label: 'False', icon: '✗' }
        ].map(({ value, label, icon }) => {
          let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";

          if (selectedAnswer === value) {
            statusClass = "border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
          }

          if (isSubmitted) {
            if (value === data.correct) {
              statusClass = "border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
            } else if (selectedAnswer === value && value !== data.correct) {
              statusClass = "border-red-500 bg-red-500/20 opacity-60";
            } else {
              statusClass = "opacity-40 border-transparent bg-black/20";
            }
          }

          return (
            <button
              key={label}
              onClick={() => handleSelect(value)}
              disabled={isSubmitted}
              className={`relative p-8 rounded-xl border transition-all duration-300 group ${statusClass}`}
            >
              <div className="flex flex-col items-center gap-3">
                <span className={`text-4xl transition-colors ${selectedAnswer === value || (isSubmitted && value === data.correct) ? 'text-white' : 'text-slate-400'}`}>
                  {icon}
                </span>
                <span className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors">{label}</span>
              </div>

              {isSubmitted && value === data.correct && (
                <div className="absolute top-2 right-2 text-emerald-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Verify Answer
          </button>
        ) : (
          <div className="w-full space-y-4">
            <div className="animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isCorrect ?
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  }
                </svg>
                <span>{isCorrect ? 'Correct Analysis' : 'Insight'}</span>
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
            {/* Try Again Button */}
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
