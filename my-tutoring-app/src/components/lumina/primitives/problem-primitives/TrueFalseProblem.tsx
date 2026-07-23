'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { TrueFalseProblemData, VisualObjectCollection, VisualComparisonData, LetterTracingData, LetterPictureData, AlphabetSequenceData, RhymingPairsData, SightWordCardData, SoundSortData } from '../../types';
import { ObjectCollection, ComparisonPanel, LetterPicture, AlphabetSequence, RhymingPairs, SightWordCard, SoundSort } from '../visual-primitives';
import { LetterTracing } from '../LetterTracing';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import { useVoiceChoice } from '../../hooks/useVoiceChoice';
import { useVoiceViewportGate } from '../../hooks/useVoiceViewportGate';
import {
  usePrimitiveEvaluation,
  type TrueFalseMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import {
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaMicListener,
  type AnswerChoiceState,
} from '../../ui';

/**
 * True/False Problem Component
 *
 * EVALUATION INTEGRATION:
 * - Tracks student responses and performance on true/false questions
 * - Submits evaluation metrics on answer submission
 * - Supports competency tracking via skillId/subskillId/objectiveId
 * - Enables retry mechanism with resetAttempt
 *
 * VOICE (see /add-voice-control): the student can answer hands-free by saying
 * "true" / "false" — the single cleanest voice class (two phonetically distant
 * words, universal across every grade/subject). A single-unit useVoiceChoice
 * runs the mic/judge; a spoken verdict routes into the SAME select→submit path
 * a tap uses, so the tap path is unchanged and voice is purely additive. When
 * many problems stack on one screen, the screen owner passes `voiceEligible` so
 * only one mic is ever live (the engine has no global single-mic lock), and the
 * mic is viewport-gated (useVoiceViewportGate) so an off-screen problem never
 * listens.
 *
 * UI: answer FSM, feedback banner, and action buttons come from the Lumina UI
 * kit (LuminaAnswerChoice / LuminaFeedbackCard / LuminaActionButton). The
 * statement and embedded visual are the bespoke "painting" and stay custom.
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
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSelect = (answer: boolean) => {
    if (isSubmitted) return;
    SoundManager.select();
    setSelectedAnswer(answer);
  };

  // Grade + report a specific answer. `viaVoice` rides the studentWork so the
  // screen owner can skip its outcome chime (useVoiceChoice already played one)
  // and so voice usage is measurable. Both tap-Verify and voice land here.
  const submitWith = useCallback((answer: boolean, viaVoice: boolean) => {
    if (hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const isCorrect = answer === data.correct;

    const metrics: TrueFalseMetrics = {
      type: 'true-false',
      isCorrect,
      selectedAnswer: answer,
      correctAnswer: data.correct,
    };

    submitEvaluation(
      isCorrect,
      isCorrect ? 100 : 0,
      metrics,
      {
        studentWork: {
          selectedAnswer: answer,
          statement: data.statement,
        },
        viaVoice,
      }
    );
  }, [hasSubmittedEvaluation, data.correct, data.statement, submitEvaluation]);

  const handleSubmit = () => {
    if (selectedAnswer === null) return;
    submitWith(selectedAnswer, false);
  };

  // ── Voice: say "true" / "false" to answer hands-free ───────────────────────
  // The single answerable unit; options are the two spoken labels. `answer` is
  // the grading key the controller never sends to the judge.
  const voiceItems = useMemo(
    () => [{ answer: data.correct ? 'true' : 'false', options: ['true', 'false'] }],
    [data.correct],
  );

  // Presence gate: the mic may only be live while this problem is in the
  // viewing window — an off-screen mount must never judge lesson chatter.
  const { ref: viewportRef, inView } = useVoiceViewportGate<HTMLDivElement>();

  // Eligible unless the screen owner parked this problem (only one mic may be
  // live across stacked problems) or it's scrolled out of the viewing window.
  // Closed once answered.
  const voiceEligible = (data.voiceEligible ?? true) && !isSubmitted && inView;

  const voice = useVoiceChoice({
    items: voiceItems,
    gradeLevel: data.gradeLevel,
    active: voiceEligible,
    onSubmit: (_idx, word) => {
      if (isSubmitted) return;
      const answer = word === 'true';
      setSelectedAnswer(answer);
      submitWith(answer, true);
    },
  });

  const handleReset = () => {
    setSelectedAnswer(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
    voice.reset();
  };

  const isCorrect = selectedAnswer === data.correct;

  // Answer-option state machine: which visual state each button is in. A voice
  // verdict that degraded to a tap-confirm highlights its button pre-submit.
  const choiceState = (value: boolean): AnswerChoiceState => {
    if (!isSubmitted) {
      if (selectedAnswer === value) return 'selected';
      const label = value ? 'true' : 'false';
      if (voice.highlight?.word === label) return 'selected';
      return 'idle';
    }
    return value === data.correct
      ? 'correct'
      : selectedAnswer === value
        ? 'incorrect'
        : 'dimmed';
  };

  return (
    <div ref={viewportRef} className="w-full">
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

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {/* True/False Buttons — LuminaAnswerChoice FSM (renders its own ✓ on correct) */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
        {[
          { value: true, label: 'True', icon: '✓' },
          { value: false, label: 'False', icon: '✗' },
        ].map(({ value, label, icon }) => (
          <LuminaAnswerChoice
            key={label}
            state={choiceState(value)}
            disabled={isSubmitted}
            onClick={() => handleSelect(value)}
          >
            <div className="flex flex-col items-center gap-3">
              <span className="text-4xl">{icon}</span>
              <span className="text-xl font-bold">{label}</span>
            </div>
          </LuminaAnswerChoice>
        ))}
      </div>

      {/* Voice: hands-free "true" / "false". Orb only while the mic is in play
          (eligible + unanswered) so stacked problems never show idle orbs. */}
      {!isSubmitted && (data.voiceEligible ?? true) && (
        <div className="flex flex-col items-center mb-8">
          <LuminaMicListener
            state={voice.voice.state}
            level={voice.voice.level}
            isSupported={voice.voice.isSupported}
            dormant={voice.voice.dormant}
            onStart={voice.voice.start}
            onCancel={voice.voice.stop}
            accent="blue"
            size="sm"
            idleLabel="Say “true” or “false”"
            listeningLabel="Say “true” or “false”"
          />
          {voice.note && (
            <p className="text-amber-300 text-sm mt-2 text-center">{voice.note}</p>
          )}
        </div>
      )}

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={selectedAnswer === null}
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
