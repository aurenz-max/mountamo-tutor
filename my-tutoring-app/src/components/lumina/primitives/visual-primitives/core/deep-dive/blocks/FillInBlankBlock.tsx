'use client';

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import type { FillInBlankBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface FillInBlankBlockProps {
  data: FillInBlankBlockData;
  index: number;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
}

const FillInBlankBlock: React.FC<FillInBlankBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
}) => {
  const { sentence, blankIndex, correctAnswer, wordBank, label } = data;
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showResult, setShowResult] = useState(false);

  // Split sentence into words for rendering with blank
  const words = sentence.split(' ');

  const handleWordSelect = useCallback(
    (word: string) => {
      if (answered) return;
      setSelectedWord((prev) => (prev === word ? null : word));
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (!selectedWord || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const isCorrect = selectedWord.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    if (isCorrect) {
      setAnswered(true);
      setShowResult(true);
      onAnswer(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      setAnswered(true);
      setShowResult(true);
      setSelectedWord(correctAnswer);
      onAnswer(data.id, false, newAttempts);
    } else {
      // Wrong but can try again
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
            const isCorrectAnswer = answered && selectedWord?.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
            const isWrongRevealed = answered && !isCorrectAnswer;

            return (
              <span key={i}>
                <span
                  className={`inline-block min-w-[80px] px-3 py-0.5 mx-1 rounded-lg border-b-2 text-center font-medium transition-all ${
                    answered
                      ? isCorrectAnswer
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                      : displayWord
                        ? 'bg-purple-500/15 border-purple-400/40 text-purple-100'
                        : 'bg-white/5 border-white/20 text-slate-500'
                  }`}
                >
                  {displayWord || '______'}
                </span>
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
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-mono">Word Bank</p>
            <div className="flex flex-wrap gap-2">
              {wordBank.map((word, i) => (
                <button
                  key={i}
                  onClick={() => handleWordSelect(word)}
                  disabled={answered}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selectedWord === word
                      ? 'bg-purple-500/20 border-purple-400/40 text-purple-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit button */}
        {!answered && (
          <button
            onClick={handleSubmit}
            disabled={!selectedWord}
            className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 hover:bg-purple-500/20 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        )}

        {/* Result badge */}
        {showResult && (
          <div className="flex items-center gap-2">
            <Badge
              className={
                selectedWord?.toLowerCase().trim() === correctAnswer.toLowerCase().trim() && attempts <= 1
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : selectedWord?.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }
            >
              {selectedWord?.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
                ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                : 'Incorrect'}
            </Badge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
};

export default FillInBlankBlock;
