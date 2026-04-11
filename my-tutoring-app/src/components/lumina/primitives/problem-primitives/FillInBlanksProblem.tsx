'use client';

import React, { useState } from 'react';
import { FillInBlanksProblemData } from '../../types';
import { InsetRenderer } from './insets';
import {
  usePrimitiveEvaluation,
  type FillInBlanksMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';

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

  // Parse text with blanks
  const renderTextWithBlanks = () => {
    const parts = data.textWithBlanks.split(/(\[blank_\d+\])/g);

    return parts.map((part, idx) => {
      const blankMatch = part.match(/\[blank_(\d+)\]/);
      if (blankMatch) {
        const blankId = `blank_${blankMatch[1]}`;
        const selectedWord = selectedWords[blankId];
        const isCorrect = checkAnswer(blankId);

        let blankClass = "border-2 border-dashed border-blue-400/50 bg-blue-500/10";
        if (selectedWord && !isSubmitted) {
          blankClass = "border-2 border-blue-500 bg-blue-500/20";
        } else if (isSubmitted) {
          if (isCorrect) {
            blankClass = "border-2 border-emerald-500 bg-emerald-500/20";
          } else {
            blankClass = "border-2 border-red-500 bg-red-500/20";
          }
        }

        return (
          <span key={idx} className="inline-block relative mx-1">
            <div
              className={`inline-flex items-center justify-center min-w-[140px] px-4 py-2 rounded-lg transition-all ${blankClass} cursor-pointer`}
              onClick={() => {
                // Allow deselecting by clicking the blank
                if (!isSubmitted && selectedWord) {
                  setSelectedWords(prev => {
                    const newState = { ...prev };
                    delete newState[blankId];
                    return newState;
                  });
                }
              }}
            >
              {selectedWord ? (
                <span className="text-white font-medium">{selectedWord}</span>
              ) : (
                <span className="text-slate-400 text-sm">Drop word here</span>
              )}
            </div>
            {isSubmitted && isCorrect !== null && (
              <span className={`absolute -top-2 -right-2 text-lg ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                {isCorrect ? '✓' : '✗'}
              </span>
            )}
          </span>
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

      {/* Word Bank */}
      <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
        <h4 className="text-lg font-semibold text-slate-300 mb-4">Word Bank</h4>
        <div className="flex flex-wrap gap-3">
          {availableWords.map((word, idx) => {
            const used = isWordUsed(word);
            const correct = isWordCorrect(word);

            let wordClass = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium cursor-pointer transition-all";

            if (used && !isSubmitted) {
              wordClass = "px-4 py-2 bg-blue-600 text-white rounded-lg font-medium opacity-50";
            } else if (isSubmitted) {
              if (correct === true) {
                wordClass = "px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium";
              } else if (correct === false) {
                wordClass = "px-4 py-2 bg-red-600 text-white rounded-lg font-medium";
              } else {
                // Not used or incorrect placement
                wordClass = "px-4 py-2 bg-slate-700 text-slate-400 rounded-lg font-medium opacity-50";
              }
            }

            return (
              <button
                key={idx}
                className={wordClass}
                onClick={() => {
                  if (isSubmitted) return;

                  if (!used) {
                    // Select for the first available blank
                    const firstEmptyBlank = data.blanks.find(blank => !selectedWords[blank.id]);
                    if (firstEmptyBlank) {
                      handleWordSelect(firstEmptyBlank.id, word);
                    }
                  } else {
                    // Deselect
                    const blankId = Object.keys(selectedWords).find(id => selectedWords[id] === word);
                    if (blankId) {
                      setSelectedWords(prev => {
                        const newState = { ...prev };
                        delete newState[blankId];
                        return newState;
                      });
                    }
                  }
                }}
                disabled={isSubmitted}
              >
                {word}
              </button>
            );
          })}
        </div>
        {!isSubmitted && (
          <p className="text-sm text-slate-400 mt-4 italic">
            Click a word to place it in the next blank, or click a filled blank to remove it
          </p>
        )}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!data.blanks.every(blank => selectedWords[blank.id])}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Check Answers
          </button>
        ) : (
          <div className="w-full space-y-4">
            <div className="animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${allCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {allCorrect ?
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  }
                </svg>
                <span>{allCorrect ? 'Perfect!' : 'Review Your Answers'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-lg font-light mb-3">
                {data.rationale}
              </p>
              {data.teachingNote && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-sm text-slate-400 italic">
                    💡 {data.teachingNote}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium tracking-wide transition-all shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
