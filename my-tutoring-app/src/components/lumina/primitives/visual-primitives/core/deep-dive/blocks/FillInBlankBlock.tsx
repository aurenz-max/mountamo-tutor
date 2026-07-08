'use client';

import React, { useState, useCallback } from 'react';
import type { FillInBlankBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import {
  LuminaChip,
  LuminaChipBank,
  LuminaFillBlankSlot,
  LuminaActionButton,
  LuminaFeedbackCard,
  type FillBlankState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';

interface FillInBlankBlockProps {
  data: FillInBlankBlockData;
  index: number;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  /** Bridge to the DeepDive live tutor for a contextual, answer-free hint */
  onAskTutor?: (message: string) => void;
}

const FillInBlankBlock: React.FC<FillInBlankBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
}) => {
  const { sentence, blankIndex, correctAnswer, wordBank, label } = data;
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showResult, setShowResult] = useState(false);

  // Split sentence into words for rendering with blank
  const words = sentence.split(' ');

  const isCorrect = selectedWord?.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

  const handleWordSelect = useCallback(
    (word: string) => {
      if (answered) return;
      SoundManager.select();
      setSelectedWord((prev) => (prev === word ? null : word));
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (!selectedWord || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const correct = selectedWord.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    if (correct) {
      SoundManager.playCorrect();
      setAnswered(true);
      setShowResult(true);
      onAnswer(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      SoundManager.playIncorrect();
      setAnswered(true);
      setShowResult(true);
      setSelectedWord(correctAnswer);
      onAnswer(data.id, false, newAttempts);
    } else {
      // Wrong but can try again
      SoundManager.playIncorrect();
      setSelectedWord(null);
    }
  }, [selectedWord, answered, attempts, correctAnswer, data.id, onAnswer]);

  // Render the sentence with a blank slot
  const renderSentence = () => {
    return (
      <p className="text-[15px] text-slate-200 leading-relaxed">
        {words.map((word, i) => {
          if (i === blankIndex) {
            // Render the blank slot — word may be "______" or "______," with trailing punct
            const trailingPunct = word.replace(/^_+/, '');
            const displayWord = answered ? correctAnswer : selectedWord;
            const isWrongRevealed = answered && !isCorrect;

            let slotState: FillBlankState;
            if (answered) {
              slotState = isCorrect ? 'correct' : 'incorrect';
            } else {
              slotState = selectedWord ? 'filled' : 'empty';
            }

            return (
              <span key={i}>
                <LuminaFillBlankSlot
                  state={slotState}
                  value={displayWord ?? undefined}
                  placeholder="______"
                  className="min-w-[80px] px-3 py-0.5"
                />
                {trailingPunct && <span>{trailingPunct}</span>}
                {isWrongRevealed && (
                  <span className="text-xs text-slate-500 ml-1">(correct)</span>
                )}
                {' '}
              </span>
            );
          }
          return <span key={i}>{word} </span>;
        })}
      </p>
    );
  };

  return (
    <BlockWrapper label={label} index={index} accent="purple" variant="compact">
      <div className="space-y-4">
        {/* Sentence with blank */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          {renderSentence()}
        </div>

        {/* Word bank */}
        {!answered && (
          <LuminaChipBank label="Word Bank">
            {wordBank.map((word, i) => (
              <LuminaChip
                key={i}
                state={selectedWord === word ? 'selected' : 'idle'}
                onClick={() => handleWordSelect(word)}
                disabled={answered}
              >
                {word}
              </LuminaChip>
            ))}
          </LuminaChipBank>
        )}

        {/* Submit button */}
        {!answered && (
          <div className="flex flex-wrap items-center gap-3">
            <LuminaActionButton action="check" onClick={handleSubmit} disabled={!selectedWord} />
            <BlockTutorHelp
              onAskTutor={onAskTutor}
              message={`[STUDENT_HELP_REQUEST] The student is choosing a word to complete this sentence: "${sentence}". The word bank is: ${wordBank.join(', ')}. The correct word is "${correctAnswer}". Guide them to reason about which word fits — do NOT reveal or name the correct word.`}
            />
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div className="space-y-1">
            <LuminaFeedbackCard
              status={isCorrect ? 'correct' : 'incorrect'}
              label={
                isCorrect
                  ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                  : 'Answer revealed'
              }
            >
              {isCorrect
                ? 'You completed the sentence correctly.'
                : `The correct word was “${correctAnswer}”.`}
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

export default FillInBlankBlock;
