'use client';

import React, { useCallback, useState } from 'react';
import BlockShell from './BlockShell';
import { SoundManager } from '../../../../../utils/SoundManager';
import {
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaBadge,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../../../ui';
import type { InferenceBuilderBlockData } from '../types';

interface InferenceBuilderBlockProps {
  data: InferenceBuilderBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const InferenceBuilderBlock: React.FC<InferenceBuilderBlockProps> = ({
  data,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

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
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="rose">
      <div className="space-y-4">
        <div>
          <LuminaSectionLabel accent="rose" size="sm" className="mb-1">
            Reading between the lines
          </LuminaSectionLabel>
          <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.question}</p>
        </div>

        <div className="space-y-2">
          {data.candidates.map((candidate, i) => {
            const isCorrect = i === data.correctIndex;
            let state: AnswerChoiceState;
            if (answered) {
              if (isCorrect) state = 'correct';
              else if (i === selectedIndex) state = 'incorrect';
              else state = 'dimmed';
            } else if (i === selectedIndex) {
              state = 'selected';
            } else {
              state = 'idle';
            }
            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                onClick={() => {
                  if (answered) return;
                  SoundManager.select();
                  setSelectedIndex(i);
                }}
                disabled={answered}
                className="p-4"
              >
                <div className="space-y-1.5">
                  <div className="font-medium leading-snug">{candidate.inference}</div>
                  {answered && (
                    <p className="text-xs text-slate-400 italic leading-relaxed">{candidate.rationale}</p>
                  )}
                </div>
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
                selectedIndex === data.correctIndex && attempts === 1
                  ? 'emerald'
                  : selectedIndex === data.correctIndex
                    ? 'amber'
                    : 'rose'
              }
            >
              {selectedIndex === data.correctIndex
                ? attempts === 1 ? 'Strong inference!' : 'Got there'
                : 'Revealed'}
            </LuminaBadge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {showExplanation && (
          <LuminaFeedbackCard status="insight" label="Explanation">
            {data.explanation}
          </LuminaFeedbackCard>
        )}
      </div>
    </BlockShell>
  );
};

export default InferenceBuilderBlock;
