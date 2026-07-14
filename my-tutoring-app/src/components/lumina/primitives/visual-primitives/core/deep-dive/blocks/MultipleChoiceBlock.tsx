'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { MultipleChoiceBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaAnswerChoice, LuminaActionButton, LuminaFeedbackCard, LuminaReadAloud, type AnswerChoiceState } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';

interface MultipleChoiceBlockProps {
  data: MultipleChoiceBlockData;
  index: number;
  /** Called when the student submits an answer */
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
  /** Bridge to the DeepDive live tutor for a contextual, answer-free hint */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-reader (K) presentation — reader-fit PRE band contract: the tutor reads
   * the question + choices aloud (auto on first view + 🔊 replay), options render
   * picture-primary, a single tap chooses (no Check), and adult chrome is hidden.
   */
  preReader?: boolean;
}

const MultipleChoiceBlock: React.FC<MultipleChoiceBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
  preReader = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);
  // Pre-reader retry state — the wrongly-tapped picture stays marked until the
  // next tap so feedback lands on the touched object (reader-fit rule 5).
  const [retryIndex, setRetryIndex] = useState<number | null>(null);

  // The spoken STIMULUS beat — question + every choice, read by the tutor.
  // The [QUIZ_READ_ALOUD] tag is enacted by the catalog PRE-READER READ-ALOUD
  // directive (survives the lesson-mode brevity cap). Answer key never spoken.
  const readAloudMessage =
    `[QUIZ_READ_ALOUD] A pre-reader is on the "${data.label || 'Quick Quiz'}" question and cannot read it. `
    + `Read the question aloud word for word, then each choice slowly with its letter, then ask which one they pick. `
    + `Question: "${data.question}". Choices: ${data.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}.`;

  // ORIENT/STIMULUS auto-beat at PRE — fires once when the question first
  // scrolls into view (all blocks mount together in stack layout, so mount-time
  // firing would read every quiz at once). Ref-guarded against re-fire.
  const blockRef = useRef<HTMLDivElement | null>(null);
  const readAloudFiredRef = useRef(false);
  useEffect(() => {
    if (!preReader || !onAskTutor || answered || readAloudFiredRef.current) return;
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
  }, [preReader, onAskTutor, answered, readAloudMessage]);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answered) return;
      SoundManager.select();
      setSelectedIndex(optionIndex);
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (selectedIndex === null || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (selectedIndex === data.correctIndex) {
      SoundManager.playCorrect();
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      // After 2 wrong attempts, reveal answer
      SoundManager.playIncorrect();
      setAnswered(true);
      setShowExplanation(true);
      setSelectedIndex(data.correctIndex);
      onAnswer(data.id, false, newAttempts);
    } else {
      // Wrong but can try again — reset selection
      SoundManager.playIncorrect();
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  // Pre-reader flow: single tap = choose (the selection is atomic, so no Check
  // button — reader-fit rule 2). Same two-attempt policy as the deliberate flow.
  const handleChoose = useCallback(
    (optionIndex: number) => {
      if (answered) return;
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setSelectedIndex(optionIndex);

      if (optionIndex === data.correctIndex) {
        SoundManager.playCorrect();
        setRetryIndex(null);
        setAnswered(true);
        setShowExplanation(true);
        onAnswer(data.id, true, newAttempts);
      } else if (newAttempts >= 2) {
        SoundManager.playIncorrect();
        setRetryIndex(null);
        setAnswered(true);
        setShowExplanation(true);
        setSelectedIndex(data.correctIndex);
        onAnswer(data.id, false, newAttempts);
      } else {
        // First miss — feedback lands on the tapped picture and the tutor gives
        // an eyes-free spoken hint (RECOVER beat), never revealing the answer.
        SoundManager.playIncorrect();
        setRetryIndex(optionIndex);
        onAskTutor?.(
          `[QUIZ_RETRY] The pre-reader tapped "${data.options[optionIndex]}" on the question "${data.question}" — not correct. `
          + `Give ONE warm spoken hint without revealing the answer, and invite them to tap another picture.`,
        );
      }
    },
    [answered, attempts, data, onAnswer, onAskTutor],
  );

  const wasCorrect = selectedIndex === data.correctIndex;

  // ── Pre-reader render: picture-primary grid, tap = choose ──────────
  if (preReader) {
    return (
      <BlockWrapper label={data.label} index={index} accent="amber" variant="compact">
        <div ref={blockRef} className="space-y-4">
          <div className="flex items-start gap-3">
            <p className="text-slate-100 font-medium text-lg leading-relaxed flex-1">{data.question}</p>
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

          <div className="grid grid-cols-2 gap-3">
            {data.options.map((option, i) => {
              let state: AnswerChoiceState = 'idle';
              if (answered) {
                if (i === data.correctIndex) state = 'correct';
                else if (i === selectedIndex) state = 'incorrect';
                else state = 'dimmed';
              } else if (i === retryIndex) {
                state = 'incorrect';
              }
              return (
                <LuminaAnswerChoice
                  key={i}
                  state={state}
                  disabled={answered}
                  onClick={() => handleChoose(i)}
                  className="p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[7rem]"
                >
                  <span className="text-5xl leading-none" aria-hidden>
                    {data.optionEmojis?.[i] || '⭐'}
                  </span>
                  <span className="text-base text-slate-100">{option}</span>
                </LuminaAnswerChoice>
              );
            })}
          </div>

          {showExplanation && (
            <LuminaFeedbackCard
              status={wasCorrect ? 'correct' : 'incorrect'}
              label={wasCorrect ? '🎉 You did it!' : '💛 Good try!'}
            >
              {data.explanation}
            </LuminaFeedbackCard>
          )}
        </div>
      </BlockWrapper>
    );
  }

  // ── Standard render: deliberate select-then-Check flow ─────────────
  return (
    <BlockWrapper label={data.label} index={index} accent="amber" variant="compact">
      <div className="space-y-4">
        <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.question}</p>

        <div className="space-y-2">
          {data.options.map((option, i) => {
            let state: AnswerChoiceState;
            if (!answered) {
              state = i === selectedIndex ? 'selected' : 'idle';
            } else if (i === data.correctIndex) {
              state = 'correct';
            } else if (i === selectedIndex) {
              state = 'incorrect';
            } else {
              state = 'dimmed';
            }

            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                disabled={answered}
                onClick={() => handleSelect(i)}
                className="p-3 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-mono">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </span>
              </LuminaAnswerChoice>
            );
          })}
        </div>

        {!answered && (
          <div className="flex flex-wrap items-center gap-3">
            <LuminaActionButton
              action="check"
              onClick={handleSubmit}
              disabled={selectedIndex === null}
            />
            <BlockTutorHelp
              onAskTutor={onAskTutor}
              message={`[STUDENT_HELP_REQUEST] The student is stuck on this multiple-choice question: "${data.question}". Options: ${data.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}. The correct answer is "${data.options[data.correctIndex]}". Guide them toward the reasoning with a question or hint — do NOT reveal or name the correct option.`}
            />
          </div>
        )}

        {showExplanation && (
          <div className="space-y-1">
            <LuminaFeedbackCard
              status={wasCorrect ? 'correct' : 'incorrect'}
              label={
                wasCorrect
                  ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                  : 'Answer revealed'
              }
            >
              {data.explanation}
            </LuminaFeedbackCard>
            <p className="text-xs text-slate-500 px-1">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </p>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
};

export default MultipleChoiceBlock;
