'use client';

import React, { useCallback, useState } from 'react';
import {
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  type AnswerChoiceState, LuminaMathText } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';

export interface BlockChoice {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface BlockChoiceCheckProps {
  check: BlockChoice;
  blockId: string;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  /** On the tutor workspace: every check reports here, the block never shows the answer itself, and the host owns Try again. */
  onAttempt?: (correct: boolean, work: string) => void;
  /** Whether the block has already been answered (from parent state). */
  answered?: boolean;
  onAskTutor?: (message: string) => void;
  /** What the learner should look at, for the tutor's help: "WHICH rows of the table to compare". */
  lookAt: string;
  /** The display the question is about, as named to the tutor. */
  about: string;
}

/** A closed question under a data display (a table's rows, a chart's lines): answering it means reading the display above. */
const BlockChoiceCheck: React.FC<BlockChoiceCheckProps> = ({ check, blockId, onAnswer, onAttempt, answered: answeredProp, onAskTutor, lookAt, about }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(answeredProp ? check.correctIndex : null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(answeredProp ?? false);

  const handleSelect = useCallback((optionIndex: number) => {
    if (answered) return;
    SoundManager.select();
    setSelectedIndex(optionIndex);
  }, [answered]);

  const handleSubmit = useCallback(() => {
    if (selectedIndex === null || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    onAttempt?.(selectedIndex === check.correctIndex, `Chose "${check.options[selectedIndex]}"`);
    if (selectedIndex === check.correctIndex) {
      SoundManager.playCorrect();
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(blockId, true, newAttempts);
    } else if (!onAttempt && newAttempts >= 2) {
      SoundManager.playIncorrect();
      setAnswered(true);
      setShowExplanation(true);
      setSelectedIndex(check.correctIndex);
      onAnswer(blockId, false, newAttempts);
    } else {
      SoundManager.playIncorrect();
      setSelectedIndex(null);
    }
  }, [check, selectedIndex, answered, attempts, blockId, onAnswer, onAttempt]);

  const wasCorrect = selectedIndex === check.correctIndex;

  return (
    <div className="mt-5 pt-5 border-t border-white/10 space-y-4">
      <p className="text-slate-100 font-medium text-[15px] leading-relaxed">
        <LuminaMathText text={check.question} />
      </p>

      <div className="space-y-2">
        {check.options.map((option, i) => {
          let state: AnswerChoiceState;
          if (!answered) {
            state = i === selectedIndex ? 'selected' : 'idle';
          } else if (i === check.correctIndex) {
            state = 'correct';
          } else if (i === selectedIndex) {
            state = 'incorrect';
          } else {
            state = 'dimmed';
          }

          return (
            <LuminaAnswerChoice
              key={i}
              aria-label={check.options[i]}
              state={state}
              disabled={answered}
              onClick={() => handleSelect(i)}
              className="p-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-mono">
                  {String.fromCharCode(65 + i)}
                </span>
                <LuminaMathText text={option} />
              </span>
            </LuminaAnswerChoice>
          );
        })}
      </div>

      {!answered && (
        <div className="flex flex-wrap items-center gap-3">
          <LuminaActionButton action="check" onClick={handleSubmit} disabled={selectedIndex === null} />
          <BlockTutorHelp
            onAskTutor={onAskTutor}
            message={`[STUDENT_HELP_REQUEST] The student is stuck on this question about ${about}: "${check.question}". Options: ${check.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}. The correct answer is "${check.options[check.correctIndex]}". Point them at ${lookAt} — do NOT reveal or name the correct option.`}
          />
        </div>
      )}

      {showExplanation && (
        <div className="space-y-1">
          <LuminaFeedbackCard
            status={wasCorrect ? 'correct' : 'incorrect'}
            label={wasCorrect ? (attempts === 1 ? 'Correct!' : 'Correct (2nd try)') : 'Answer revealed'}
          >
            <LuminaMathText text={check.explanation} />
          </LuminaFeedbackCard>
          <p className="text-xs text-slate-500 px-1">
            {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BlockChoiceCheck;
