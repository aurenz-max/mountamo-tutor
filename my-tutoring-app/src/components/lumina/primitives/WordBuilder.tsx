import React, { useState, useEffect } from 'react';
import { WordBuilderData, WordPart, TargetWord } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, Sparkles, Book, Lightbulb } from 'lucide-react';

interface WordBuilderProps {
  data: WordBuilderData;
  className?: string;
}

interface ConstructedWord {
  targetId: string;
  slots: (WordPart | null)[];
  isComplete: boolean;
  isCorrect: boolean;
}

const WordBuilder: React.FC<WordBuilderProps> = ({ data, className }) => {
  const [constructedWords, setConstructedWords] = useState<Record<string, ConstructedWord>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  // Initialize constructed words for each target
  useEffect(() => {
    const initial: Record<string, ConstructedWord> = {};
    data.targets.forEach((target) => {
      initial[target.word] = {
        targetId: target.word,
        slots: [null, null, null], // prefix, root, suffix
        isComplete: false,
        isCorrect: false,
      };
    });
    setConstructedWords(initial);
  }, [data.targets]);

  // Get available parts for a specific target word
  const getPartsForTarget = (target: TargetWord): WordPart[] => {
    return data.availableParts.filter(part => target.parts.includes(part.id));
  };

  const handleDrop = (targetWord: string, slotIndex: number, part: WordPart) => {
    setConstructedWords((prev) => {
      const word = prev[targetWord];
      const newSlots = [...word.slots];

      // Determine the correct slot based on part type
      const typeIndex = part.type === 'prefix' ? 0 : part.type === 'root' ? 1 : 2;

      // Only allow placement in the correct type slot
      if (slotIndex !== typeIndex) {
        return prev;
      }

      newSlots[slotIndex] = part;

      // Check if word is complete
      const target = data.targets.find(t => t.word === targetWord);
      const isComplete = newSlots.every(slot => slot !== null);
      let isCorrect = false;

      if (isComplete && target) {
        const placedPartIds = newSlots.map(slot => slot!.id);
        isCorrect = target.parts.every(partId => placedPartIds.includes(partId));

        if (isCorrect) {
          setShowFeedback(prev => ({ ...prev, [targetWord]: true }));
          setTimeout(() => {
            setShowFeedback(prev => ({ ...prev, [targetWord]: false }));
          }, 3000);
        }
      }

      return {
        ...prev,
        [targetWord]: {
          ...word,
          slots: newSlots,
          isComplete,
          isCorrect,
        },
      };
    });
  };

  const handleRemovePart = (targetWord: string, slotIndex: number) => {
    setConstructedWords((prev) => {
      const word = prev[targetWord];
      const partToRemove = word.slots[slotIndex];
      if (!partToRemove) return prev;

      const newSlots = [...word.slots];
      newSlots[slotIndex] = null;

      return {
        ...prev,
        [targetWord]: {
          ...word,
          slots: newSlots,
          isComplete: false,
          isCorrect: false,
        },
      };
    });
  };

  const isPartUsedInWord = (partId: string, targetWord: string): boolean => {
    const word = constructedWords[targetWord];
    if (!word) return false;
    return word.slots.some(slot => slot?.id === partId);
  };

  const getPartColor = (type: 'prefix' | 'root' | 'suffix') => {
    switch (type) {
      case 'prefix':
        return 'bg-purple-500/20 border-purple-500/50 text-purple-300';
      case 'root':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-300';
      case 'suffix':
        return 'bg-green-500/20 border-green-500/50 text-green-300';
    }
  };

  const getSlotLabel = (index: number) => {
    switch (index) {
      case 0:
        return 'Prefix';
      case 1:
        return 'Root';
      case 2:
        return 'Suffix';
      default:
        return '';
    }
  };

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{data.title}</h2>
        <p className="text-slate-400 text-sm md:text-base">Build words by dragging parts into the correct slots</p>
      </div>

      {/* Target Words - Each as a Self-Contained Card */}
      <div className="space-y-6">
        {data.targets.map((target) => {
          const constructed = constructedWords[target.word];
          if (!constructed) return null;

          const partsForThisWord = getPartsForTarget(target);

          return (
            <motion.div
              key={target.word}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 md:p-6"
            >
              {/* Target Info */}
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <Book className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                    <h3 className="text-lg md:text-xl font-bold text-white">Build: {target.word}</h3>
                  </div>
                  {constructed.isCorrect && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2 text-emerald-400"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Complete!</span>
                    </motion.div>
                  )}
                </div>
                <p className="text-xs md:text-sm text-slate-400 sm:ml-8">{target.definition}</p>
              </div>

              {/* Construction Slots */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
                  {constructed.slots.map((part, slotIndex) => (
                    <div
                      key={slotIndex}
                      className={`relative w-full sm:w-36 md:w-40 h-24 sm:h-28 md:h-32 rounded-lg border-2 border-dashed transition-all ${
                        part
                          ? getPartColor(part.type)
                          : 'border-slate-600 bg-slate-900/50'
                      }`}
                    >
                      {/* Slot Label */}
                      <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 px-2 bg-slate-900 text-[10px] md:text-xs font-mono text-slate-400 uppercase tracking-wider">
                        {getSlotLabel(slotIndex)}
                      </div>

                      {part ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="w-full h-full flex flex-col items-center justify-center p-3 relative group"
                        >
                          <button
                            onClick={() => handleRemovePart(target.word, slotIndex)}
                            className="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                          <div className="text-xl md:text-2xl font-bold text-center mb-1">{part.text}</div>
                          <div className="text-[10px] md:text-xs text-center opacity-80 line-clamp-2">{part.meaning}</div>
                        </motion.div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Sparkles className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Available Parts for THIS Word Only */}
              <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-mono uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" />
                  Word Parts
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {partsForThisWord.map((part) => {
                    const isUsed = isPartUsedInWord(part.id, target.word);

                    return (
                      <motion.button
                        key={part.id}
                        onClick={() => {
                          if (!isUsed) {
                            const typeIndex = part.type === 'prefix' ? 0 : part.type === 'root' ? 1 : 2;
                            handleDrop(target.word, typeIndex, part);
                          }
                        }}
                        whileHover={!isUsed ? { scale: 1.05 } : {}}
                        whileTap={!isUsed ? { scale: 0.95 } : {}}
                        disabled={isUsed}
                        className={`relative rounded-lg border-2 p-3 transition-all ${
                          isUsed
                            ? 'opacity-30 cursor-not-allowed'
                            : getPartColor(part.type) + ' hover:shadow-lg cursor-pointer'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-base md:text-lg font-bold mb-1">{part.text}</div>
                          <div className="text-[10px] uppercase font-mono mb-1 opacity-60">{part.type}</div>
                          <div className="text-xs opacity-80 line-clamp-2">{part.meaning}</div>
                        </div>
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {showFeedback[target.word] && constructed.isCorrect && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-4 mt-4"
                  >
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-emerald-400 mb-1">Perfect!</h4>
                        <p className="text-sm text-slate-300 mb-2">{target.definition}</p>
                        <p className="text-sm text-slate-400 italic">"{target.sentenceContext}"</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs md:text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-purple-500/20 border border-purple-500/50"></div>
          <span className="text-slate-400">Prefix</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-blue-500/20 border border-blue-500/50"></div>
          <span className="text-slate-400">Root</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-green-500/20 border border-green-500/50"></div>
          <span className="text-slate-400">Suffix</span>
        </div>
      </div>
    </div>
  );
};

export default WordBuilder;