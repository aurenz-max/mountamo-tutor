'use client';

import React, { useState } from 'react';
import { FillInBlanksProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type FillInBlanksMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Kit chrome: blank slot, word-bank chips + tray, feedback banner, action
// buttons. (See lumina/ui/index.ts for the full list.) Chips grade via the
// shared answerStateClasses token — same colors as every other answer surface.
import {
  LuminaFillBlankSlot,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaChip,
  LuminaChipBank,
  type FillBlankState,
  type ChipState,
} from '../../ui';

interface FillInBlanksProblemProps {
  data: FillInBlanksProblemData;
}

export const FillInBlanksProblem: React.FC<FillInBlanksProblemProps> = ({ data }) => {
  const [selectedWords, setSelectedWords] = useState<{ [blankId: string]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [availableWords] = useState<string[]>(
    [...data.wordBank].sort(() => Math.random() - 0.5) // Shuffle word bank
  );

  // Destructure evaluation props (injected by KnowledgeCheck/ProblemRenderer)
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data as any;

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<FillInBlanksMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `fill-in-blanks-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleWordSelect = (blankId: string, word: string) => {
    if (isSubmitted) return;

    // If word is already selected for this blank, deselect it
    if (selectedWords[blankId] === word) {
      setSelectedWords(prev => {
        const newState = { ...prev };
        delete newState[blankId];
        return newState;
      });
      return;
    }

    // If word is selected for another blank, deselect it from there
    const prevBlankId = Object.keys(selectedWords).find(id => selectedWords[id] === word);
    if (prevBlankId) {
      setSelectedWords(prev => {
        const newState = { ...prev };
        delete newState[prevBlankId];
        newState[blankId] = word;
        return newState;
      });
    } else {
      setSelectedWords(prev => ({ ...prev, [blankId]: word }));
    }
  };

  const checkAnswer = (blankId: string): boolean | null => {
    if (!isSubmitted) return null;
    const blank = data.blanks.find(b => b.id === blankId);
    if (!blank) return null;

    const selectedWord = selectedWords[blankId] || '';
    return blank.caseSensitive
      ? selectedWord === blank.correctAnswer
      : selectedWord.toLowerCase() === blank.correctAnswer.toLowerCase();
  };

  const handleSubmit = () => {
    const allFilled = data.blanks.every(blank => selectedWords[blank.id]);
    if (!allFilled || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    // Build per-blank results
    const blankResults = data.blanks.map(blank => {
      const selectedWord = selectedWords[blank.id] || '';
      const isCorrect = blank.caseSensitive
        ? selectedWord === blank.correctAnswer
        : selectedWord.toLowerCase() === blank.correctAnswer.toLowerCase();
      return {
        blankId: blank.id,
        selectedAnswer: selectedWord,
        correctAnswer: blank.correctAnswer,
        isCorrect,
      };
    });

    const correctBlanks = blankResults.filter(r => r.isCorrect).length;
    const totalBlanks = data.blanks.length;
    const accuracy = totalBlanks > 0 ? Math.round((correctBlanks / totalBlanks) * 100) : 0;
    const allCorrect = correctBlanks === totalBlanks;

    const metrics: FillInBlanksMetrics = {
      type: 'fill-in-blanks',
      totalBlanks,
      correctBlanks,
      incorrectBlanks: totalBlanks - correctBlanks,
      accuracy,
      blankResults,
    };

    submitEvaluation(
      allCorrect,
      accuracy,
      metrics,
      {
        studentWork: {
          selectedWords,
          textWithBlanks: data.textWithBlanks,
        },
      }
    );
  };

  const handleReset = () => {
    setSelectedWords({});
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  const isWordUsed = (word: string): boolean => {
    return Object.values(selectedWords).includes(word);
  };

  const isWordCorrect = (word: string): boolean | null => {
    if (!isSubmitted) return null;
    return data.blanks.some(blank => {
      const match = blank.caseSensitive
        ? word === blank.correctAnswer
        : word.toLowerCase() === blank.correctAnswer.toLowerCase();
      return match && selectedWords[blank.id] === word;
    });
  };

  // Parse text with blanks — each blank renders as a LuminaFillBlankSlot.
  const renderTextWithBlanks = () => {
    const parts = data.textWithBlanks.split(/(\[blank_\d+\])/g);

    return parts.map((part, idx) => {
      const blankMatch = part.match(/\[blank_(\d+)\]/);
      if (blankMatch) {
        const blankId = `blank_${blankMatch[1]}`;
        const selectedWord = selectedWords[blankId];
        const isCorrect = checkAnswer(blankId);

        const blankState: FillBlankState = !selectedWord
          ? 'empty'
          : !isSubmitted
            ? 'filled'
            : isCorrect
              ? 'correct'
              : 'incorrect';

        return (
          <LuminaFillBlankSlot
            key={idx}
            state={blankState}
            value={selectedWord}
            onClick={() => {
              // Click a filled blank (pre-submit) to remove its word.
              if (!isSubmitted && selectedWord) {
                SoundManager.tap();
                setSelectedWords(prev => {
                  const newState = { ...prev };
                  delete newState[blankId];
                  return newState;
                });
              }
            }}
          />
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const allCorrect = isSubmitted && data.blanks.every(blank => checkAnswer(blank.id));

  return (
    <div className="w-full space-y-8">
      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {/* Text with blanks */}
      <div className="text-xl md:text-2xl text-slate-200 leading-relaxed font-light">
        {renderTextWithBlanks()}
      </div>

      {/* Word Bank — kit chip bank; chips grade via the shared answerStateClasses token */}
      <div className="space-y-2">
        <LuminaChipBank label="Word Bank">
          {availableWords.map((word, idx) => {
            const used = isWordUsed(word);
            const correct = isWordCorrect(word);

            const chipState: ChipState = isSubmitted
              ? correct === true
                ? 'correct'
                : correct === false
                  ? 'incorrect'
                  : 'dimmed'
              : used
                ? 'dimmed'
                : 'idle';

            return (
              <LuminaChip
                key={idx}
                state={chipState}
                disabled={isSubmitted}
                onClick={() => {
                  if (isSubmitted) return;

                  if (!used) {
                    // Select for the first available blank
                    const firstEmptyBlank = data.blanks.find(blank => !selectedWords[blank.id]);
                    if (firstEmptyBlank) {
                      SoundManager.snap();
                      handleWordSelect(firstEmptyBlank.id, word);
                    }
                  } else {
                    // Deselect
                    const blankId = Object.keys(selectedWords).find(id => selectedWords[id] === word);
                    if (blankId) {
                      SoundManager.tap();
                      setSelectedWords(prev => {
                        const newState = { ...prev };
                        delete newState[blankId];
                        return newState;
                      });
                    }
                  }
                }}
              >
                {word}
              </LuminaChip>
            );
          })}
        </LuminaChipBank>
        {!isSubmitted && (
          <p className="text-sm text-slate-400 italic px-1">
            Click a word to place it in the next blank, or click a filled blank to remove it
          </p>
        )}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={!data.blanks.every(blank => selectedWords[blank.id])}
            onClick={handleSubmit}
          >
            Check Answers
          </LuminaActionButton>
        ) : (
          <div className="w-full space-y-4">
            <LuminaFeedbackCard
              status={allCorrect ? 'correct' : 'insight'}
              label={allCorrect ? 'Perfect!' : 'Review Your Answers'}
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
