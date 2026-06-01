'use client';

import React, { useCallback, useState } from 'react';
import BlockShell from './BlockShell';
import { SoundManager } from '../../../../../utils/SoundManager';
import {
  LuminaSectionLabel,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaBadge,
  LuminaFeedbackCard,
  type AnswerChoiceState,
} from '../../../../../ui';
import type { VocabInContextBlockData } from '../types';

interface VocabInContextBlockProps {
  data: VocabInContextBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const VocabInContextBlock: React.FC<VocabInContextBlockProps> = ({
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
      setSelectedIndex(data.correctIndex);
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="cyan">
      <div className="space-y-4">
        <div>
          <LuminaSectionLabel accent="cyan" size="sm" className="mb-1">
            Vocabulary in context
          </LuminaSectionLabel>
          <p className="text-slate-100 text-[15px] leading-relaxed">
            In the highlighted passage, what does{' '}
            <span className="font-bold italic text-cyan-200 px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">
              {data.word}
            </span>{' '}
            mean here?
          </p>
        </div>

        <div className="space-y-2">
          {data.meanings.map((meaning, i) => {
            let state: AnswerChoiceState;
            if (answered) {
              if (i === data.correctIndex) state = 'correct';
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
              >
                {meaning}
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
                ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                : 'Revealed'}
            </LuminaBadge>
          </div>
        )}

        {showExplanation && (
          <LuminaFeedbackCard status="insight">
            {data.explanation}
          </LuminaFeedbackCard>
        )}
      </div>
    </BlockShell>
  );
};

export default VocabInContextBlock;
