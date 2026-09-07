'use client';

/**
 * Production Problem — the TAP surface (DI off) of a production item
 * (KC redesign P2, 2026-09-05).
 *
 * The judged loop is the primary surface for these items: the child SEES the
 * stimulus and SAYS the answer (or, for `point_to`, touches the sign). This
 * component renders when there is no microphone — the same stimulus, and the
 * closed fallback menu the generator shipped with the item (`options`, which
 * always contains the correct answer). For `point_to` the printed sentence's
 * tokens ARE the menu, so the child touches a token here too.
 *
 * It is honest about what it measures: on this surface a `say_it` is a
 * picture-primary recognition, and the metrics say so (`multiple-choice`
 * shape, with the item kind in studentWork). Production evidence comes from
 * the judged surface.
 *
 * UI from the Lumina kit (LuminaAnswerChoice / LuminaFeedbackCard /
 * LuminaActionButton / LuminaReadAloud); the stimulus is the shared inset
 * renderer.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductionProblemData } from '../../types';
import { InsetRenderer, NumberSentenceTokens } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type MultipleChoiceMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
import {
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaReadAloud,
  type AnswerChoiceState,
} from '../../ui';

interface ProductionProblemProps {
  data: ProductionProblemData;
}

export const ProductionProblem: React.FC<ProductionProblemProps> = ({ data }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime] = useState(Date.now());

  const { instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<MultipleChoiceMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `production-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const isPoint = data.kind === 'point_to' && data.stimulus.insetType === 'number-sentence';
  const preReader = data.preReader === true;
  const onAskTutor = data.onAskTutor;

  const menuSpoken = isPoint
    ? ''
    : ` The choices are: ${data.options.map((o) => o.text).join(', ')}.`;
  const readAloudMessage =
    `[QUIZ_READ_ALOUD] A pre-reader is on this question and cannot read it. `
    + `Read this aloud warmly, exactly: "${data.ask}"${menuSpoken} `
    + `Do not say which is right and do not add hints.`;

  const readAloudFiredRef = useRef(false);
  useEffect(() => {
    if (!preReader || !onAskTutor || isSubmitted || readAloudFiredRef.current) return;
    readAloudFiredRef.current = true;
    const timer = setTimeout(() => onAskTutor(readAloudMessage), 400);
    return () => clearTimeout(timer);
  }, [preReader, onAskTutor, isSubmitted, readAloudMessage]);

  const commit = useCallback((optionId: string) => {
    if (hasSubmittedEvaluation || isSubmitted) return;
    setSelectedId(optionId);
    setIsSubmitted(true);
    const isCorrect = optionId === data.correctOptionId;
    const metrics: MultipleChoiceMetrics = {
      type: 'multiple-choice',
      isCorrect,
      selectedOptionId: optionId,
      correctOptionId: data.correctOptionId,
      attemptCount: 1,
      timeToFirstAnswer: Date.now() - startTime,
      changedAnswer: false,
    };
    submitEvaluation(isCorrect, isCorrect ? 100 : 0, metrics, {
      studentWork: {
        surface: 'tap',
        kind: data.kind,
        selectedOptionId: optionId,
        ask: data.ask,
        expectedAnswer: data.expectedAnswer,
      },
    });
  }, [hasSubmittedEvaluation, isSubmitted, data, startTime, submitEvaluation]);

  const handleReset = () => {
    setSelectedId(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isCorrect = selectedId === data.correctOptionId;

  const choiceState = (id: string): AnswerChoiceState => {
    if (!isSubmitted) return selectedId === id ? 'selected' : 'idle';
    return id === data.correctOptionId ? 'correct' : selectedId === id ? 'incorrect' : 'dimmed';
  };

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h3 className={`${preReader ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} font-bold text-white leading-tight`}>
          {data.ask}
        </h3>
        {onAskTutor && (
          <LuminaReadAloud
            iconOnly
            size={preReader ? 'lg' : 'md'}
            label="Read this to me"
            onClick={() => { SoundManager.tap(); onAskTutor(readAloudMessage); }}
          />
        )}
      </div>

      {/* The stimulus — for point_to the tokens are the answer surface. */}
      {isPoint && data.stimulus.insetType === 'number-sentence' ? (
        <div className="mb-8">
          <NumberSentenceTokens
            data={data.stimulus}
            onTokenTap={(id) => { SoundManager.select(); commit(id); }}
            tappedId={isSubmitted && !isCorrect ? selectedId : null}
            revealId={isSubmitted ? data.targetTokenId ?? null : null}
            disabled={isSubmitted}
          />
        </div>
      ) : (
        <>
          <InsetRenderer inset={data.stimulus} className="border-0 bg-transparent" />
          <div className={`grid gap-4 mb-8 ${data.options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {data.options.map((option) => (
              <LuminaAnswerChoice
                key={option.id}
                state={choiceState(option.id)}
                disabled={isSubmitted}
                onClick={() => { SoundManager.select(); commit(option.id); }}
                className="flex flex-col items-center justify-center gap-2 text-center min-h-[6rem]"
                aria-label={option.text}
              >
                {option.emoji && <span className="text-4xl leading-none" aria-hidden>{option.emoji}</span>}
                <span className={`${preReader && option.emoji ? 'text-base text-slate-300' : 'text-2xl font-bold text-white'}`}>
                  {option.text}
                </span>
              </LuminaAnswerChoice>
            ))}
          </div>
        </>
      )}

      {isSubmitted && (
        <div className="space-y-4">
          <LuminaFeedbackCard
            status={isCorrect ? 'correct' : 'incorrect'}
            label={preReader ? (isCorrect ? '⭐ Yes!' : 'Try again') : undefined}
          >
            {preReader ? null : (isCorrect ? data.rationale : `Not quite — the answer is ${data.expectedAnswer}.`)}
          </LuminaFeedbackCard>
          {!isCorrect && (
            <div className="flex justify-center">
              <LuminaActionButton
                action="retry"
                onClick={() => { SoundManager.tap(); handleReset(); }}
                className={preReader ? 'text-xl px-10 py-6' : ''}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
