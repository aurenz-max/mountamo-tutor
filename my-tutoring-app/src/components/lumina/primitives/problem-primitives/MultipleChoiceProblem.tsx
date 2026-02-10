'use client';

import React, { useState } from 'react';
import { MultipleChoiceProblemData, VisualObjectCollection, VisualComparisonData, LetterTracingData, LetterPictureData, AlphabetSequenceData, RhymingPairsData, SightWordCardData, SoundSortData } from '../../types';
import { ObjectCollection, ComparisonPanel, LetterPicture, AlphabetSequence, RhymingPairs, SightWordCard, SoundSort } from '../visual-primitives';
import { LetterTracing } from '../LetterTracing';
import {
  usePrimitiveEvaluation,
  type MultipleChoiceMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Info } from 'lucide-react';

/**
 * Multiple Choice Problem Component
 *
 * EVALUATION INTEGRATION:
 * - Tracks student responses and performance on multiple choice questions
 * - Submits evaluation metrics on answer submission
 * - Supports competency tracking via skillId/subskillId/objectiveId
 * - Enables retry mechanism with resetAttempt
 */

interface MultipleChoiceProblemProps {
  data: MultipleChoiceProblemData;
}

export const MultipleChoiceProblem: React.FC<MultipleChoiceProblemProps> = ({ data }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime] = useState(Date.now());

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
  } = usePrimitiveEvaluation<MultipleChoiceMetrics>({
    primitiveType: 'multiple-choice',
    instanceId: instanceId || `multiple-choice-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSelect = (id: string) => {
    if (isSubmitted) return;
    setSelectedId(id);
  };

  const handleSubmit = () => {
    if (!selectedId || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const isCorrect = selectedId === data.correctOptionId;
    const timeToAnswer = Date.now() - startTime;

    // Build evaluation metrics
    const metrics: MultipleChoiceMetrics = {
      type: 'multiple-choice',
      isCorrect,
      selectedOptionId: selectedId,
      correctOptionId: data.correctOptionId,
      attemptCount: 1,
      timeToFirstAnswer: timeToAnswer,
      changedAnswer: false,
    };

    // Submit evaluation result
    submitEvaluation(
      isCorrect,
      isCorrect ? 100 : 0,
      metrics,
      {
        studentWork: {
          selectedOptionId: selectedId,
          question: data.question,
          options: data.options,
        },
      }
    );
  };

  const handleReset = () => {
    setSelectedId(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isCorrect = selectedId === data.correctOptionId;

  return (
    <div className="w-full">
      {/* Question */}
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
        {data.question}
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

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {data.options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrectOption = option.id === data.correctOptionId;
          const isIncorrectChoice = isSubmitted && isSelected && !isCorrectOption;

          // Determine button variant and styling based on state
          let buttonClasses = "h-auto text-left p-6 border transition-all duration-300";

          if (!isSubmitted) {
            buttonClasses += isSelected
              ? " border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : " border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
          } else {
            if (isCorrectOption) {
              buttonClasses += " border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
            } else if (isIncorrectChoice) {
              buttonClasses += " border-red-500 bg-red-500/20 opacity-60";
            } else {
              buttonClasses += " opacity-40 border-transparent bg-black/20";
            }
          }

          return (
            <Button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={isSubmitted}
              variant="ghost"
              className={buttonClasses}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <Badge
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold border
                      ${isSelected || (isSubmitted && isCorrectOption)
                        ? 'bg-white text-slate-900 border-white'
                        : 'bg-black/30 text-slate-400 border-white/10'}
                    `}
                  >
                    {option.id}
                  </Badge>
                  <span className="text-lg text-slate-200 font-light group-hover:text-white transition-colors">
                    {option.text}
                  </span>
                </div>

                {isSubmitted && isCorrectOption && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                )}
              </div>
            </Button>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <Button
            onClick={handleSubmit}
            disabled={!selectedId}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50"
          >
            Verify Answer
          </Button>
        ) : (
          <div className="w-full space-y-4">
            <Card className="animate-fade-in backdrop-blur-xl bg-black/20 border-white/5">
              <CardContent className="pt-6">
                <div className={`flex items-center gap-3 mb-3 font-bold uppercase tracking-wider ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
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
              </CardContent>
            </Card>

            <Button
              onClick={handleReset}
              variant="ghost"
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium tracking-wide"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
