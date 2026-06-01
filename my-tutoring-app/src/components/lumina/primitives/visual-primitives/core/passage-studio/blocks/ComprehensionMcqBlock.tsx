'use client';

import React, { useCallback, useState } from 'react';
import {
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaBadge,
  LuminaFeedbackCard,
  type AnswerChoiceState,
} from '../../../../../ui';
import BlockShell from './BlockShell';
import { SoundManager } from '../../../../../utils/SoundManager';
import type { ComprehensionMcqBlockData } from '../types';

interface ComprehensionMcqBlockProps {
  data: ComprehensionMcqBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const ComprehensionMcqBlock: React.FC<ComprehensionMcqBlockProps> = ({
  data,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = useCallback(
    (i: number) => {
      if (answered) return;
      SoundManager.select();
      setSelectedIndex(i);
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (selectedIndex === null || answered) return;
    const next = attempts + 1;
    setAttempts(next);
    if (selectedIndex === data.correctIndex) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    if (selectedIndex === data.correctIndex) {
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(data.id, true, next);
    } else if (next >= 2) {
      setAnswered(true);
      setShowExplanation(true);
      setSelectedIndex(data.correctIndex);
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="amber">
      <div className="space-y-4">
        <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.question}</p>

        <div className="space-y-2">
          {data.options.map((option, i) => {
            let state: AnswerChoiceState;
            if (answered) {
              if (i === data.correctIndex) {
                state = 'correct';
              } else if (i === selectedIndex && i !== data.correctIndex) {
                state = 'incorrect';
              } else {
                state = 'dimmed';
              }
            } else if (i === selectedIndex) {
              state = 'selected';
            } else {
              state = 'idle';
            }
            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                onClick={() => handleSelect(i)}
                disabled={answered}
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

        {answered && (
          <div className="flex items-center gap-2">
            <LuminaBadge
              accent={
                selectedIndex === data.correctIndex && attempts <= 1
                  ? 'emerald'
                  : selectedIndex === data.correctIndex
                    ? 'amber'
                    : 'rose'
              }
            >
              {selectedIndex === data.correctIndex
                ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                : 'Incorrect'}
            </LuminaBadge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {showExplanation && (
          <LuminaFeedbackCard
            status={selectedIndex === data.correctIndex ? 'correct' : 'insight'}
            teachingNote={
              data.evidenceAnchor
                ? 'Look for the highlighted evidence in the passage above.'
                : undefined
            }
          >
            {data.explanation}
          </LuminaFeedbackCard>
        )}
      </div>
    </BlockShell>
  );
};

export default ComprehensionMcqBlock;
