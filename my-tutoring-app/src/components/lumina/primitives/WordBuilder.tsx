'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import type { WordBuilderMetrics } from '../evaluation/types';
import { useChallengeProgress } from '../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../hooks/usePhaseResults';
import PhaseSummaryPanel from '../components/PhaseSummaryPanel';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  X,
  Sparkles,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Puzzle,
} from 'lucide-react';
import type {
  WordBuilderData,
  WordPart,
  TargetWord,
} from '../types';

// ============================================================================
// Props
// ============================================================================

interface WordBuilderProps {
  data: WordBuilderData;
  className?: string;
}

// ============================================================================
// Phase Config (for PhaseSummaryPanel)
// ============================================================================

const COMPLEXITY_PHASE_CONFIG: Record<string, PhaseConfig> = {
  simple_affix: { label: 'Simple Affixes', icon: '🟢', accentColor: 'emerald' },
  compound_affix: { label: 'Compound Affixes', icon: '🟡', accentColor: 'amber' },
  greek_latin: { label: 'Greek/Latin Roots', icon: '🟠', accentColor: 'orange' },
  multi_morpheme: { label: 'Multi-Morpheme', icon: '🔴', accentColor: 'pink' },
};

// ============================================================================
// Helpers
// ============================================================================

const PART_COLORS: Record<string, string> = {
  prefix: 'bg-purple-500/20 border-purple-400/40 text-purple-200',
  root: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
  suffix: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
};

const SLOT_LABEL_COLORS: Record<string, string> = {
  prefix: 'text-purple-400',
  root: 'text-blue-400',
  suffix: 'text-emerald-400',
};

function getRequiredSlots(target: TargetWord, allParts: WordPart[]): string[] {
  // Determine which slot types are needed from the target's part IDs
  const types: string[] = [];
  for (const partId of target.parts) {
    const part = allParts.find((p) => p.id === partId);
    if (part && !types.includes(part.type)) {
      types.push(part.type);
    }
  }
  // Ensure canonical order: prefix → root → suffix
  const order = ['prefix', 'root', 'suffix'];
  return order.filter((t) => types.includes(t));
}

// ============================================================================
// Component
// ============================================================================

const WordBuilder: React.FC<WordBuilderProps> = ({ data, className }) => {
  const targets = data.targets;

  // Challenge progression
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress<TargetWord>({
    challenges: targets,
    getChallengeId: (t) => t.word,
  });

  // Phase results for summary panel
  const phaseResults = usePhaseResults<TargetWord>({
    challenges: targets,
    results,
    isComplete,
    getChallengeType: () => data.complexityLevel,
    phaseConfig: COMPLEXITY_PHASE_CONFIG,
  });

  // Evaluation hook
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<WordBuilderMetrics>({
    primitiveType: 'word-builder',
    instanceId: data.title,
  });

  // Current challenge state
  const currentTarget = targets[currentIndex];
  const requiredSlots = useMemo(
    () => (currentTarget ? getRequiredSlots(currentTarget, data.availableParts) : []),
    [currentTarget, data.availableParts],
  );

  // Slots: map slot type → placed WordPart | null
  const [slots, setSlots] = useState<Record<string, WordPart | null>>({});
  const [showCorrect, setShowCorrect] = useState(false);
  const [showIncorrect, setShowIncorrect] = useState(false);
  const [revealedHint, setRevealedHint] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Reset slots when challenge changes
  useEffect(() => {
    const init: Record<string, WordPart | null> = {};
    for (const slotType of requiredSlots) {
      init[slotType] = null;
    }
    setSlots(init);
    setShowCorrect(false);
    setShowIncorrect(false);
    setRevealedHint(false);
    startTimeRef.current = Date.now();
  }, [currentIndex, requiredSlots]);

  // Which parts are placed in slots
  const placedPartIds = useMemo(
    () => new Set(Object.values(slots).filter(Boolean).map((p) => p!.id)),
    [slots],
  );

  // Check answer
  const allSlotsFilled = requiredSlots.every((t) => slots[t] !== null);

  const handlePlacePart = useCallback(
    (part: WordPart) => {
      if (showCorrect) return;
      const slotType = part.type;
      if (!requiredSlots.includes(slotType)) return;

      setSlots((prev) => ({ ...prev, [slotType]: part }));
      setShowIncorrect(false);
    },
    [requiredSlots, showCorrect],
  );

  const handleRemovePart = useCallback(
    (slotType: string) => {
      if (showCorrect) return;
      setSlots((prev) => ({ ...prev, [slotType]: null }));
      setShowIncorrect(false);
    },
    [showCorrect],
  );

  const handleCheck = useCallback(() => {
    if (!currentTarget || !allSlotsFilled) return;

    incrementAttempts();

    // Build placed IDs in slot order
    const placedIds = requiredSlots.map((t) => slots[t]!.id);
    const isCorrect = currentTarget.parts.length === placedIds.length &&
      currentTarget.parts.every((id, i) => id === placedIds[i]);

    if (isCorrect) {
      setShowCorrect(true);
      const timeMs = Date.now() - startTimeRef.current;
      recordResult({
        challengeId: currentTarget.word,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs,
      });
    } else {
      setShowIncorrect(true);
    }
  }, [currentTarget, allSlotsFilled, requiredSlots, slots, incrementAttempts, recordResult, currentAttempts]);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const handleRetry = useCallback(() => {
    const init: Record<string, WordPart | null> = {};
    for (const slotType of requiredSlots) {
      init[slotType] = null;
    }
    setSlots(init);
    setShowIncorrect(false);
  }, [requiredSlots]);

  // Submit evaluation when complete
  useEffect(() => {
    if (isComplete && !hasSubmitted && results.length > 0) {
      const correct = results.filter((r) => r.correct).length;
      const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
      const firstTry = results.filter((r) => r.attempts === 1 && r.correct).length;
      const accuracy = Math.round((correct / results.length) * 100);

      submitResult(accuracy >= 70, accuracy, {
        type: 'word-builder',
        complexityLevel: data.complexityLevel,
        wordsCompleted: correct,
        wordsTotal: results.length,
        accuracy,
        attemptsCount: totalAttempts,
        firstTryCorrect: firstTry,
      });
    }
  }, [isComplete, hasSubmitted, results, submitResult, data.complexityLevel]);

  // ── Summary view ──
  if (isComplete) {
    const correct = results.filter((r) => r.correct).length;
    const accuracy = Math.round((correct / results.length) * 100);

    return (
      <div className={`max-w-3xl mx-auto space-y-4 ${className ?? ''}`}>
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-purple-400" />
              {data.title} — Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="border-white/20 text-slate-300 text-sm">
                {correct}/{results.length} words built
              </Badge>
              <Badge variant="outline" className="border-white/20 text-slate-300 text-sm">
                {accuracy}% accuracy
              </Badge>
            </div>
            {/* Word review */}
            <div className="space-y-2 mt-3">
              {targets.map((target) => {
                const r = results.find((res) => res.challengeId === target.word);
                return (
                  <div
                    key={target.word}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5"
                  >
                    {r?.correct ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-100">{target.word}</span>
                    <span className="text-slate-400 text-sm truncate">{target.definition}</span>
                    {r && (
                      <Badge variant="outline" className="ml-auto border-white/10 text-slate-400 text-xs shrink-0">
                        {r.attempts === 1 ? '1st try' : `${r.attempts} tries`}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <PhaseSummaryPanel phases={phaseResults} />
      </div>
    );
  }

  if (!currentTarget) return null;

  // ── Active challenge view ──
  return (
    <div className={`max-w-3xl mx-auto space-y-4 ${className ?? ''}`}>
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-purple-400" />
              {data.title}
            </CardTitle>
            <Badge variant="outline" className="border-white/20 text-slate-400">
              {currentIndex + 1} / {targets.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-4">
            {targets.map((t, i) => {
              const r = results.find((res) => res.challengeId === t.word);
              let dotClass = 'w-2 h-2 rounded-full ';
              if (r?.correct) dotClass += 'bg-emerald-400';
              else if (i === currentIndex) dotClass += 'bg-purple-400';
              else dotClass += 'bg-white/15';
              return <div key={i} className={dotClass} />;
            })}
          </div>

          {/* Clue — definition-based hint, never the word itself */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-400 font-mono uppercase tracking-wider mb-1">
              Build the word that means:
            </p>
            <p className="text-slate-100 text-lg font-medium">{currentTarget.hint}</p>
          </div>

          {/* Hint toggle */}
          {!revealedHint && !showCorrect && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 mb-4"
              onClick={() => setRevealedHint(true)}
            >
              <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
              Show context
            </Button>
          )}
          <AnimatePresence>
            {revealedHint && !showCorrect && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-slate-400 italic mb-4"
              >
                &ldquo;{currentTarget.sentenceContext}&rdquo;
              </motion.p>
            )}
          </AnimatePresence>

          {/* Construction slots */}
          <div className="flex flex-wrap items-end justify-center gap-3 mb-6">
            {requiredSlots.map((slotType) => {
              const part = slots[slotType];
              return (
                <div key={slotType} className="flex flex-col items-center gap-1">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest ${
                      SLOT_LABEL_COLORS[slotType] ?? 'text-slate-500'
                    }`}
                  >
                    {slotType}
                  </span>
                  <div
                    className={`relative w-28 h-20 sm:w-32 sm:h-24 rounded-lg border-2 transition-all flex items-center justify-center ${
                      part
                        ? `${PART_COLORS[part.type]} border-solid`
                        : 'border-dashed border-slate-600 bg-slate-900/50'
                    } ${showCorrect ? 'ring-2 ring-emerald-400/50' : ''} ${
                      showIncorrect && part ? 'ring-2 ring-red-400/50' : ''
                    }`}
                  >
                    {part ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center p-2 relative group w-full h-full justify-center"
                      >
                        {!showCorrect && (
                          <button
                            onClick={() => handleRemovePart(slotType)}
                            className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                        <span className="text-lg font-bold">{part.text}</span>
                        <span className="text-[10px] opacity-70">{part.meaning}</span>
                      </motion.div>
                    ) : (
                      <Sparkles className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Correct feedback */}
          <AnimatePresence>
            {showCorrect && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-4 mb-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-300 mb-1">
                      Correct! The word is &ldquo;{currentTarget.word}&rdquo;
                    </p>
                    <p className="text-sm text-slate-300">{currentTarget.definition}</p>
                    <p className="text-sm text-slate-400 italic mt-1">
                      &ldquo;{currentTarget.sentenceContext}&rdquo;
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Incorrect feedback */}
          <AnimatePresence>
            {showIncorrect && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-4"
              >
                <p className="text-sm text-red-300">
                  Not quite — check the meaning of each part and try again.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-3">
            {showCorrect ? (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                onClick={handleNext}
              >
                {currentIndex + 1 < targets.length ? (
                  <>
                    Next Word <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                ) : (
                  'See Results'
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 disabled:opacity-40"
                  disabled={!allSlotsFilled}
                  onClick={handleCheck}
                >
                  Check
                </Button>
                {showIncorrect && (
                  <Button
                    variant="ghost"
                    className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Clear
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available parts palette */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Word Parts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {data.availableParts.map((part) => {
              const isPlaced = placedPartIds.has(part.id);
              const slotExists = requiredSlots.includes(part.type);

              return (
                <Button
                  key={part.id}
                  variant="ghost"
                  disabled={isPlaced || !slotExists || showCorrect}
                  onClick={() => handlePlacePart(part)}
                  className={`h-auto py-3 px-3 flex flex-col items-center gap-1 transition-all ${
                    isPlaced
                      ? 'opacity-30 cursor-not-allowed'
                      : `${PART_COLORS[part.type]} hover:brightness-125 cursor-pointer`
                  } ${!slotExists && !isPlaced ? 'opacity-50' : ''}`}
                >
                  <span className="text-base font-bold">{part.text}</span>
                  <span className="text-[10px] font-mono uppercase opacity-60">{part.type}</span>
                  <span className="text-xs opacity-80">{part.meaning}</span>
                </Button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-white/5">
            {['prefix', 'root', 'suffix'].map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${PART_COLORS[type].split(' ')[0]}`} />
                <span className="text-xs text-slate-500 capitalize">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WordBuilder;
