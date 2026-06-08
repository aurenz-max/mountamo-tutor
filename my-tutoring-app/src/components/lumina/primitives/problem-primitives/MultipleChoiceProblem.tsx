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
import { InsetRenderer, renderKatexString } from './insets';
import { SoundManager } from '../../utils/SoundManager';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import {
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  type AnswerChoiceState,
} from '../../ui';

/**
 * Multiple Choice Problem Component
 *
 * EVALUATION INTEGRATION:
 * - Tracks student responses and performance on multiple choice questions
 * - Submits evaluation metrics on answer submission
 * - Supports competency tracking via skillId/subskillId/objectiveId
 * - Enables retry mechanism with resetAttempt
 *
 * UI: the option-answer FSM, feedback banner, and action buttons come from the
 * Lumina UI kit (LuminaAnswerChoice / LuminaFeedbackCard / LuminaActionButton).
 * The question and embedded visual are the bespoke "painting" and stay custom.
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
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSelect = (id: string) => {
    if (isSubmitted) return;
    SoundManager.select();
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

  // Option-answer state machine: which visual state each option is in.
  const choiceState = (optionId: string): AnswerChoiceState =>
    !isSubmitted
      ? selectedId === optionId
        ? 'selected'
        : 'idle'
      : optionId === data.correctOptionId
        ? 'correct'
        : selectedId === optionId
          ? 'incorrect'
          : 'dimmed';

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

      {/* Inset (rich inline content — equation, table, passage, chart, etc.) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {/* Options Grid — LuminaAnswerChoice FSM (renders its own ✓ on correct) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {data.options.map((option) => {
          const state = choiceState(option.id);
          const badgeActive = state === 'selected' || state === 'correct';
          return (
            <LuminaAnswerChoice
              key={option.id}
              state={state}
              disabled={isSubmitted}
              onClick={() => handleSelect(option.id)}
            >
              <div className="flex items-start gap-4 min-w-0">
                <span
                  className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold border ${
                    badgeActive
                      ? 'bg-white text-slate-900 border-white'
                      : 'bg-black/30 text-slate-400 border-white/10'
                  }`}
                >
                  {option.id}
                </span>
                {data.optionFormat === 'katex' ? (
                  <span
                    className="text-lg font-light whitespace-normal break-words"
                    dangerouslySetInnerHTML={{ __html: renderKatexString(option.text) }}
                  />
                ) : (
                  <span className="text-lg font-light whitespace-normal break-words">
                    {option.text}
                  </span>
                )}
              </div>
            </LuminaAnswerChoice>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={!selectedId}
            onClick={handleSubmit}
          >
            Verify Answer
          </LuminaActionButton>
        ) : (
          <div className="w-full space-y-4">
            <LuminaFeedbackCard
              status={isCorrect ? 'correct' : 'insight'}
              label={isCorrect ? 'Correct Analysis' : undefined}
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
