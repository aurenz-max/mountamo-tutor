'use client';

import React, { useState, useCallback } from 'react';
import type { MultipleChoiceBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaAnswerChoice, LuminaActionButton, LuminaFeedbackCard, type AnswerChoiceState } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

interface MultipleChoiceBlockProps {
  data: MultipleChoiceBlockData;
  index: number;
  /** Called when the student submits an answer */
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
}

const MultipleChoiceBlock: React.FC<MultipleChoiceBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

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

  const wasCorrect = selectedIndex === data.correctIndex;

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
          <LuminaActionButton
            action="check"
            onClick={handleSubmit}
            disabled={selectedIndex === null}
          />
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
