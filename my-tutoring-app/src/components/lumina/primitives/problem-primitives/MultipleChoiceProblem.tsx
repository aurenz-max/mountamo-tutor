'use client';

import React, { useCallback, useMemo, useState } from 'react';
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
import { useVoiceChoice } from '../../hooks/useVoiceChoice';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import {
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaMicListener,
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
 * VOICE (see /add-voice-control): the student can pick an option hands-free by
 * SAYING its label — a single-unit useVoiceChoice runs the mic/judge and a spoken
 * verdict routes into the SAME select→submit path a tap uses, so the tap path is
 * unchanged and voice is purely additive. MCQ options are frequently NOT sayable
 * (katex math, bare numbers, symbols, long phrases, or duplicate labels), so
 * voice self-gates on `multipleChoiceVoiceReady` — the mic only appears when every
 * option is a short plain-English word. When many problems stack on one screen
 * the screen owner passes `voiceEligible` so only one mic is ever live (the engine
 * has no global single-mic lock).
 *
 * UI: the option-answer FSM, feedback banner, and action buttons come from the
 * Lumina UI kit (LuminaAnswerChoice / LuminaFeedbackCard / LuminaActionButton).
 * The question and embedded visual are the bespoke "painting" and stay custom.
 */

// A label is sayable only if it's a short plain-English word/phrase: letters,
// spaces, apostrophes, hyphens; ≤3 words; ≤24 chars. This deliberately excludes
// bare numbers, katex, and math symbols — judge classes that aren't benched yet
// (see /add-spoken-judge: quality is per content CLASS, not per primitive).
const SAYABLE_LABEL = /^[a-z][a-z' -]*$/;
function isSayableLabel(raw: string): boolean {
  const l = raw.trim().toLowerCase();
  if (!l || l.length > 24) return false;
  if (l.split(/\s+/).length > 3) return false;
  return SAYABLE_LABEL.test(l);
}

/**
 * Is this MCQ answerable by voice? True only when NONE of the guards trip:
 * katex-rendered options, any non-sayable label, duplicate labels (a voice
 * verdict would misroute), or a missing correct option. Exported so the screen
 * owner (KnowledgeCheck) can hand the single live mic to a genuinely voice-ready
 * problem rather than parking it on an unsayable one.
 */
export function multipleChoiceVoiceReady(data: MultipleChoiceProblemData): boolean {
  if (data.optionFormat === 'katex') return false;
  if (!data.options?.length) return false;
  const labels = data.options.map((o) => o.text.trim().toLowerCase());
  if (labels.some((l) => !isSayableLabel(l))) return false;
  if (new Set(labels).size !== labels.length) return false; // ambiguous when spoken
  return data.options.some((o) => o.id === data.correctOptionId);
}

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

  // Grade + report a specific option. `viaVoice` rides the studentWork so the
  // screen owner can skip its outcome chime (useVoiceChoice already played one)
  // and so voice usage is measurable. Both tap-Verify and voice land here.
  const submitWith = useCallback((optionId: string, viaVoice: boolean) => {
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
        viaVoice,
      }
    );
  }, [hasSubmittedEvaluation, data.correctOptionId, data.question, data.options, startTime, submitEvaluation]);

  const handleSubmit = () => {
    if (!selectedId) return;
    submitWith(selectedId, false);
  };

  // ── Voice: say an option label to answer hands-free ─────────────────────────
  // Only when every option is a short sayable word (see multipleChoiceVoiceReady).
  const sayable = useMemo(() => multipleChoiceVoiceReady(data), [data]);

  // Map a lowercased spoken label back to its option id (the grading key).
  const idByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of data.options) m.set(o.text.trim().toLowerCase(), o.id);
    return m;
  }, [data.options]);

  // The single answerable unit; options are the on-screen labels (lowercased —
  // both controllers compare lowercase). `answer` is the grading key the
  // controller never sends to the judge.
  const voiceItems = useMemo(() => {
    if (!sayable) return [];
    const correct = data.options.find((o) => o.id === data.correctOptionId);
    return [{
      answer: (correct?.text ?? '').trim().toLowerCase(),
      options: data.options.map((o) => o.text.trim().toLowerCase()),
    }];
  }, [sayable, data.options, data.correctOptionId]);

  // Eligible unless the screen owner parked this problem (only one mic may be
  // live across stacked problems). Closed once answered or if not sayable.
  const voiceEligible = (data.voiceEligible ?? true) && !isSubmitted && sayable;

  const voice = useVoiceChoice({
    items: voiceItems,
    gradeLevel: data.gradeLevel,
    active: voiceEligible,
    onSubmit: (_idx, word) => {
      if (isSubmitted) return;
      const id = idByLabel.get(word);
      if (!id) return;
      setSelectedId(id);
      submitWith(id, true);
    },
  });

  const handleReset = () => {
    setSelectedId(null);
    setIsSubmitted(false);
    resetEvaluationAttempt();
    voice.reset();
  };

  const isCorrect = selectedId === data.correctOptionId;

  // Option-answer state machine: which visual state each option is in. A voice
  // verdict that degraded to a tap-confirm highlights its button pre-submit.
  const choiceState = (option: { id: string; text: string }): AnswerChoiceState => {
    if (!isSubmitted) {
      if (selectedId === option.id) return 'selected';
      if (voice.highlight?.word === option.text.trim().toLowerCase()) return 'selected';
      return 'idle';
    }
    return option.id === data.correctOptionId
      ? 'correct'
      : selectedId === option.id
        ? 'incorrect'
        : 'dimmed';
  };

  const showMic = voiceItems.length > 0 && !isSubmitted && (data.voiceEligible ?? true);

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

      {/* Voice: hands-free option pick. Orb only while the mic is in play
          (sayable + eligible + unanswered) so stacked problems never show idle orbs. */}
      {showMic && (
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
            idleLabel="Say your answer"
            listeningLabel="Say an answer"
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
