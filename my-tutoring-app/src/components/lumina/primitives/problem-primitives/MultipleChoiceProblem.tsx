'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  LuminaReadAloud,
  type AnswerChoiceState,
} from '../../ui';

/**
 * Multiple Choice Problem Component — the TAP surface (DI off).
 *
 * VOICE LIVES IN THE JUDGED LOOP NOW (qa/di/BACKLOG.md item 23 slice 2): when
 * the DI modality is on, KnowledgeCheck's judged surface speaks the question
 * and the menu, and the child SAYS which choice it is (`closed_set_choice`) —
 * this component never mounts. The interim per-problem voice chrome that
 * used to live here (a capture hook, the sayable-label gate, a mic orb
 * beside the Verify button) is deleted, not hidden. The sayable-vs-not fork
 * it computed survives as `choiceSpokenReason` in `knowledgeCheckScript.ts`
 * — the same arithmetic, judged-loop-grade (contract R6, re-based).
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
    primitiveType: 'knowledge-check',
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

  // Grade + report a specific option. Both tap-Verify and the PRE one-tap
  // choose land here.
  const submitWith = useCallback((optionId: string) => {
    if (hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const isCorrect = optionId === data.correctOptionId;
    const timeToAnswer = Date.now() - startTime;

    const metrics: MultipleChoiceMetrics = {
      type: 'multiple-choice',
      isCorrect,
      selectedOptionId: optionId,
      correctOptionId: data.correctOptionId,
      attemptCount: 1,
      timeToFirstAnswer: timeToAnswer,
      changedAnswer: false,
    };

    submitEvaluation(
      isCorrect,
      isCorrect ? 100 : 0,
      metrics,
      {
        studentWork: {
          selectedOptionId: optionId,
          question: data.question,
          options: data.options,
        },
      }
    );
  }, [hasSubmittedEvaluation, data.correctOptionId, data.question, data.options, startTime, submitEvaluation]);

  const handleSubmit = () => {
    if (!selectedId) return;
    submitWith(selectedId);
  };

  const handleReset = () => {
    setSelectedId(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isCorrect = selectedId === data.correctOptionId;

  // ── Pre-reader (K) presentation — reader-fit PRE band contract ───────────────
  // The tutor reads the question + every choice aloud (auto on first view + 🔊
  // replay), options render picture-primary (emoji), a single tap chooses (no
  // Verify), and adult chrome is hidden. Injected by KnowledgeCheck at K.
  const preReader = data.preReader === true;
  const onAskTutor = data.onAskTutor;
  const readAloudMessage =
    `[QUIZ_READ_ALOUD] A pre-reader is on this question and cannot read it. `
    + `Read the question aloud word for word, then each choice slowly with its letter, then ask which one they pick. `
    + `Question: "${data.question}". Choices: ${data.options.map((o) => `${o.id}) ${o.text}`).join('; ')}.`;

  // Auto ORIENT/STIMULUS beat at PRE — fires once when the question scrolls into
  // view (stacked problems mount together, so mount-time firing would read every
  // problem at once). Ref-guarded against re-fire.
  const blockRef = useRef<HTMLDivElement | null>(null);
  const readAloudFiredRef = useRef(false);
  useEffect(() => {
    if (!preReader || !onAskTutor || isSubmitted || readAloudFiredRef.current) return;
    const el = blockRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !readAloudFiredRef.current) {
          readAloudFiredRef.current = true;
          onAskTutor(readAloudMessage);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preReader, onAskTutor, isSubmitted, readAloudMessage]);

  // Tap = choose = submit (atomic at PRE — no Verify button, reader-fit rule 2).
  // Feedback lands on the tapped choice via choiceState; the container speaks the
  // correct/incorrect beat and plays the outcome chime.
  const handleChoose = useCallback((optionId: string) => {
    if (isSubmitted) return;
    setSelectedId(optionId);
    submitWith(optionId);
  }, [isSubmitted, submitWith]);

  // Option-answer state machine: which visual state each option is in.
  const choiceState = (option: { id: string; text: string }): AnswerChoiceState => {
    if (!isSubmitted) {
      return selectedId === option.id ? 'selected' : 'idle';
    }
    return option.id === data.correctOptionId
      ? 'correct'
      : selectedId === option.id
        ? 'incorrect'
        : 'dimmed';
  };

  // ── Pre-reader render: picture-primary grid, tap = choose, read-aloud ────────
  if (preReader) {
    return (
      <div ref={blockRef} className="w-full">
        <div className="flex items-start gap-3 mb-6">
          <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight flex-1">
            {data.question}
          </h3>
          {onAskTutor && (
            <LuminaReadAloud
              iconOnly
              size="md"
              aria-label="Hear the question again"
              className="flex-shrink-0"
              onClick={() => {
                SoundManager.tap();
                onAskTutor(readAloudMessage);
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {data.options.map((option) => (
            <LuminaAnswerChoice
              key={option.id}
              state={choiceState(option)}
              disabled={isSubmitted}
              onClick={() => handleChoose(option.id)}
              className="p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[8rem]"
            >
              <span className="text-6xl leading-none" aria-hidden>
                {option.emoji || '⭐'}
              </span>
              <span className="text-lg text-slate-100">{option.text}</span>
            </LuminaAnswerChoice>
          ))}
        </div>

        {isSubmitted && (
          <div className="w-full flex flex-col items-center gap-4">
            <LuminaFeedbackCard
              status={isCorrect ? 'correct' : 'insight'}
              label={isCorrect ? '🎉 You did it!' : '💛 Good try!'}
            >
              {data.rationale}
            </LuminaFeedbackCard>
            <LuminaActionButton
              action="retry"
              onClick={() => {
                readAloudFiredRef.current = false;
                handleReset();
              }}
            />
          </div>
        )}
      </div>
    );
  }

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
          const state = choiceState(option);
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
