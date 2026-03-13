'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { OrdinalLineMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface OrdinalLineChallenge {
  id: string;
  type: 'identify' | 'match' | 'relative-position' | 'sequence-story' | 'build-sequence';
  instruction: string;
  characters: Array<{ name: string; emoji: string }>;
  targetPosition?: number;         // 1-indexed ordinal
  targetOrdinalWord?: string;      // "third"
  targetOrdinalSymbol?: string;    // "3rd"
  relativeQuery?: 'before' | 'after';
  storyText?: string;
  clues?: Array<{ character: string; position: number }>;
  correctAnswer: string | number;
  options?: Array<string | number>; // multiple choice options
  matchPairs?: Array<{ word: string; symbol: string }>; // for match phase
}

export interface OrdinalLineData {
  title: string;
  description?: string;
  challenges: OrdinalLineChallenge[];
  maxPosition: number;          // 5 for early K, 10 for late K/grade 1
  context: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
  showOrdinalLabels: boolean;
  labelFormat: 'word' | 'symbol' | 'both';
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OrdinalLineMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'identify':          { label: 'Identify',    icon: '\uD83D\uDC46', accentColor: 'orange' },
  'match':             { label: 'Match',       icon: '\uD83D\uDD17', accentColor: 'purple' },
  'relative-position': { label: 'Position',    icon: '\u2194\uFE0F', accentColor: 'blue' },
  'sequence-story':    { label: 'Story',       icon: '\uD83D\uDCD6', accentColor: 'emerald' },
  'build-sequence':    { label: 'Build',       icon: '\uD83E\uDDF1', accentColor: 'amber' },
};

const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

const CONTEXT_THEME: Record<string, { bgEmoji: string; startLabel: string; endLabel: string }> = {
  'race':        { bgEmoji: '\uD83C\uDFC1', startLabel: 'START', endLabel: 'FINISH' },
  'parade':      { bgEmoji: '\uD83C\uDF89', startLabel: 'Beginning', endLabel: 'End' },
  'lunch-line':  { bgEmoji: '\uD83C\uDF7D\uFE0F', startLabel: 'Beginning', endLabel: 'End' },
  'train':       { bgEmoji: '\uD83D\uDE82', startLabel: 'Engine', endLabel: 'Caboose' },
  'bookshelf':   { bgEmoji: '\uD83D\uDCDA', startLabel: 'Left', endLabel: 'Right' },
};

// ============================================================================
// Helpers
// ============================================================================

function getOrdinalLabel(position: number, format: 'word' | 'symbol' | 'both'): string {
  const idx = position - 1;
  const SYMBOLS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const word = ORDINAL_WORDS[idx] || `${position}th`;
  const symbol = SYMBOLS[idx] || `${position}th`;
  if (format === 'word') return word;
  if (format === 'symbol') return symbol;
  return `${symbol} (${word})`;
}

// ============================================================================
// Props
// ============================================================================

interface OrdinalLineProps {
  data: OrdinalLineData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const OrdinalLine: React.FC<OrdinalLineProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxPosition = 5,
    context = 'race',
    labelFormat = 'symbol',
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null);
  const [matchSelections, setMatchSelections] = useState<Map<string, string>>(new Map());
  const [currentMatchWord, setCurrentMatchWord] = useState<string | null>(null);
  const [buildSlots, setBuildSlots] = useState<Map<number, { name: string; emoji: string }>>(new Map());
  const [selectedBuildCharacter, setSelectedBuildCharacter] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Challenge progress (shared hooks)
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `ordinal-line-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  const contextTheme = CONTEXT_THEME[context] || CONTEXT_THEME['race'];

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<OrdinalLineMetrics>({
    primitiveType: 'ordinal-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    context,
    maxPosition,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'identify',
    instruction: currentChallenge?.instruction ?? '',
    targetPosition: currentChallenge?.targetPosition,
    targetOrdinalWord: currentChallenge?.targetOrdinalWord,
    characters: currentChallenge?.characters?.map(c => c.name).join(', ') ?? '',
    storyText: currentChallenge?.storyText ?? '',
    attemptNumber: currentAttempts + 1,
    correctAnswer: currentChallenge?.correctAnswer,
  }), [
    context, maxPosition, gradeBand, challenges.length,
    currentChallengeIndex, currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'ordinal-line',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is an ordinal positions activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `Context: ${context} with positions up to ${maxPosition}. `
      + `${challenges.length} challenges total. First challenge: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Look at this ${context}! Let's learn about who's first, second, third..."`,
      { silent: true },
    );
  }, [isConnected, challenges.length, context, maxPosition, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Check Answer Logic
  // -------------------------------------------------------------------------
  const checkIdentify = useCallback((): boolean => {
    if (!currentChallenge || selectedPosition === null) return false;
    // correctAnswer may be number (4) or string ("4") depending on source
    const correct = selectedPosition === Number(currentChallenge.correctAnswer);
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! That's the ${getOrdinalLabel(selectedPosition, 'word')} one!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly tapped the ${currentChallenge.targetOrdinalWord ?? getOrdinalLabel(selectedPosition, 'word')} character. Celebrate briefly!`,
        { silent: true },
      );
    } else {
      setFeedback(`Not quite! That's the ${getOrdinalLabel(selectedPosition, 'word')} position. Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student tapped position ${selectedPosition} but correct is ${currentChallenge.correctAnswer} (${currentChallenge.targetOrdinalWord}). `
        + `Attempt ${currentAttempts + 1}. Give a hint: "Count from the front of the line."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedPosition, currentAttempts, sendText, incrementAttempts]);

  const checkMatch = useCallback((): boolean => {
    if (!currentChallenge?.matchPairs) return false;
    const pairs = currentChallenge.matchPairs;
    let allCorrect = true;
    for (const pair of pairs) {
      if (matchSelections.get(pair.word) !== pair.symbol) {
        allCorrect = false;
        break;
      }
    }
    incrementAttempts();

    if (allCorrect) {
      setFeedback('Perfect! All matches are correct!');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student matched all ordinal words to symbols correctly. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback('Some matches are wrong. Try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student has incorrect matches. Attempt ${currentAttempts + 1}. `
        + `Hint: "Read each word slowly — first, second, third..."`,
        { silent: true },
      );
    }
    return allCorrect;
  }, [currentChallenge, matchSelections, currentAttempts, sendText, incrementAttempts]);

  const checkRelativeOrStory = useCallback((): boolean => {
    if (!currentChallenge || selectedOption === null) return false;
    const correct = String(selectedOption) === String(currentChallenge.correctAnswer);
    incrementAttempts();

    if (correct) {
      setFeedback('Correct!');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student answered "${selectedOption}" correctly for ${currentChallenge.type} challenge. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback(`Not quite. The answer is not "${selectedOption}". Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedOption}" but correct is "${currentChallenge.correctAnswer}". `
        + `Challenge type: ${currentChallenge.type}. Attempt ${currentAttempts + 1}. Give a hint.`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedOption, currentAttempts, sendText, incrementAttempts]);

  const checkBuildSequence = useCallback((): boolean => {
    if (!currentChallenge?.clues) return false;
    let allCorrect = true;
    for (const clue of currentChallenge.clues) {
      const placed = buildSlots.get(clue.position);
      if (!placed || placed.name !== clue.character) {
        allCorrect = false;
        break;
      }
    }
    incrementAttempts();

    if (allCorrect) {
      setFeedback('You built the sequence correctly!');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student placed all characters correctly in the sequence. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback('Some characters are in the wrong spot. Try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student has characters in wrong positions. Attempt ${currentAttempts + 1}. `
        + `Hint: "Read each clue carefully and count the positions."`,
        { silent: true },
      );
    }
    return allCorrect;
  }, [currentChallenge, buildSlots, currentAttempts, sendText, incrementAttempts]);

  // Main check handler
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    let correct = false;

    switch (currentChallenge.type) {
      case 'identify':
        correct = checkIdentify();
        break;
      case 'match':
        correct = checkMatch();
        break;
      case 'relative-position':
        correct = checkRelativeOrStory();
        break;
      case 'sequence-story':
        correct = checkBuildSequence();
        break;
      case 'build-sequence':
        correct = checkBuildSequence();
        break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [currentChallenge, currentAttempts, checkIdentify, checkMatch, checkRelativeOrStory, checkBuildSequence, recordResult]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their ordinal number skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        // Compute per-phase accuracy inline
        const phaseAccuracy = (type: string): number => {
          const phaseChallenges = challenges.filter(c => c.type === type);
          if (phaseChallenges.length === 0) return 0;
          const phaseCorrect = phaseChallenges.filter(c =>
            challengeResults.some(r => r.challengeId === c.id && r.correct),
          ).length;
          return Math.round((phaseCorrect / phaseChallenges.length) * 100);
        };

        const metrics: OrdinalLineMetrics = {
          type: 'ordinal-line',
          accuracy,
          identifyAccuracy: phaseAccuracy('identify'),
          matchAccuracy: phaseAccuracy('match'),
          relativePositionAccuracy: phaseAccuracy('relative-position'),
          storyAccuracy: phaseAccuracy('sequence-story'),
          buildAccuracy: phaseAccuracy('build-sequence'),
          attemptsCount: totalAttempts,
          maxPositionReached: maxPosition,
        };

        submitEvaluation(
          correctCount === challenges.length,
          accuracy,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset domain-specific state
    setFeedback('');
    setFeedbackType('');
    setSelectedPosition(null);
    setSelectedOption(null);
    setMatchSelections(new Map());
    setCurrentMatchWord(null);
    setBuildSlots(new Map());
    setSelectedBuildCharacter(null);

    const next = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${next.instruction}" (type: ${next.type}). Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText,
    hasSubmittedEvaluation, maxPosition, submitEvaluation, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Auto-submit on completion
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  // Shuffled symbol order for match phase (stable per challenge)
  const shuffledMatchSymbols = useMemo(() => {
    const pairs = currentChallenge?.matchPairs;
    if (!pairs) return [];
    const symbols = pairs.map(p => p.symbol);
    // Fisher-Yates shuffle with challenge id as seed
    const seed = (currentChallenge?.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const shuffled = [...symbols];
    let s = seed || 42;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // If shuffle produced the same order, rotate by 1
    if (shuffled.every((sym, idx) => sym === symbols[idx]) && shuffled.length > 1) {
      shuffled.push(shuffled.shift()!);
    }
    return shuffled;
  }, [currentChallenge?.id, currentChallenge?.matchPairs]);

  // Shuffled character order for build/story drag-and-drop (stable per challenge)
  const shuffledBuildCharacters = useMemo(() => {
    const chars = currentChallenge?.characters;
    if (!chars || chars.length === 0) return [];
    const seed = (currentChallenge?.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const shuffled = [...chars];
    let s = seed || 42;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.every((ch, idx) => ch.name === chars[idx].name) && shuffled.length > 1) {
      shuffled.push(shuffled.shift()!);
    }
    return shuffled;
  }, [currentChallenge?.id, currentChallenge?.characters]);

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  const canCheck = useMemo(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return false;
    switch (currentChallenge.type) {
      case 'identify': return selectedPosition !== null;
      case 'match': return currentChallenge.matchPairs
        ? matchSelections.size === currentChallenge.matchPairs.length : false;
      case 'relative-position': return selectedOption !== null;
      case 'sequence-story': return currentChallenge.clues
        ? buildSlots.size >= currentChallenge.clues.length : false;
      case 'build-sequence': return currentChallenge.clues
        ? buildSlots.size >= currentChallenge.clues.length : false;
      default: return false;
    }
  }, [currentChallenge, selectedPosition, matchSelections, selectedOption, buildSlots, hasSubmittedEvaluation]);

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------
  const renderCharacterLine = (
    chars: Array<{ name: string; emoji: string }>,
    interactive: boolean,
    highlightPosition?: number,
  ) => (
    <div className="flex items-end justify-center gap-1 sm:gap-2 py-4 px-2">
      {contextTheme.startLabel && (
        <div className="flex flex-col items-center mr-2">
          <span className="text-lg">{context === 'race' ? '\uD83C\uDFC1' : ''}</span>
          <span className="text-[10px] text-slate-500 mt-1">{contextTheme.startLabel}</span>
        </div>
      )}

      {chars.map((char, idx) => {
        const pos = idx + 1;
        const isHighlighted = highlightPosition === pos;
        const isSelected = selectedPosition === pos;

        return (
          <div
            key={idx}
            className={`flex flex-col items-center transition-all duration-200 ${
              interactive ? 'cursor-pointer' : ''
            } ${isSelected ? 'scale-110' : isHighlighted ? 'scale-105' : ''}`}
            onClick={() => {
              if (interactive && !isCurrentChallengeComplete) {
                setSelectedPosition(pos);
                setFeedback('');
                setFeedbackType('');
              }
            }}
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-200 ${
              isSelected
                ? 'bg-orange-500/20 border-2 border-orange-400/60 shadow-lg shadow-orange-500/20'
                : isHighlighted
                  ? 'bg-blue-500/20 border-2 border-blue-400/60 shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}>
              {char.emoji}
            </div>

            <span className={`text-[10px] mt-1 ${
              isSelected ? 'text-orange-300' :
              isHighlighted ? 'text-blue-300' :
              'text-slate-500'
            }`}>
              {char.name}
            </span>
          </div>
        );
      })}

      {contextTheme.endLabel && (
        <div className="flex flex-col items-center ml-2">
          <span className="text-lg">{context === 'race' ? '\uD83C\uDFC1' : ''}</span>
          <span className="text-[10px] text-slate-500 mt-1">{contextTheme.endLabel}</span>
        </div>
      )}
    </div>
  );

  const renderMatchPhase = () => {
    if (!currentChallenge?.matchPairs) return null;
    const pairs = currentChallenge.matchPairs;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Words column */}
          <div className="space-y-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Word</span>
            {pairs.map(pair => (
              <Button
                key={pair.word}
                variant="ghost"
                className={`w-full justify-start text-sm ${
                  currentMatchWord === pair.word
                    ? 'bg-purple-500/20 border-purple-400/40 text-purple-300'
                    : matchSelections.has(pair.word)
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                }`}
                onClick={() => {
                  if (isCurrentChallengeComplete) return;
                  setCurrentMatchWord(pair.word);
                }}
              >
                {pair.word}
                {matchSelections.has(pair.word) && (
                  <span className="ml-auto text-xs text-emerald-400">
                    {'\u2192'} {matchSelections.get(pair.word)}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Symbols column (shuffled) */}
          <div className="space-y-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Symbol</span>
            {shuffledMatchSymbols.map(symbol => {
              const isUsed = Array.from(matchSelections.values()).includes(symbol);
              return (
                <Button
                  key={symbol}
                  variant="ghost"
                  className={`w-full justify-start text-sm ${
                    isUsed
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => {
                    if (isCurrentChallengeComplete || !currentMatchWord) return;
                    setMatchSelections(prev => {
                      const next = new Map(prev);
                      Array.from(next.entries()).forEach(([k, v]) => {
                        if (v === symbol) next.delete(k);
                      });
                      next.set(currentMatchWord, symbol);
                      return next;
                    });
                    setCurrentMatchWord(null);
                  }}
                  disabled={!currentMatchWord}
                >
                  {symbol}
                </Button>
              );
            })}
          </div>
        </div>

        {!currentMatchWord && matchSelections.size < pairs.length && (
          <p className="text-xs text-slate-500 text-center">
            Tap a word on the left, then tap its matching symbol on the right
          </p>
        )}
        {currentMatchWord && (
          <p className="text-xs text-purple-300 text-center">
            Now tap the symbol that matches &quot;{currentMatchWord}&quot;
          </p>
        )}
      </div>
    );
  };

  const renderMultipleChoice = () => {
    if (!currentChallenge?.options) return null;

    return (
      <div className="flex flex-wrap justify-center gap-2">
        {currentChallenge.options.map((opt, idx) => (
          <Button
            key={idx}
            variant="ghost"
            className={`px-4 py-2 text-sm ${
              selectedOption === opt
                ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
            }`}
            onClick={() => {
              if (isCurrentChallengeComplete) return;
              setSelectedOption(opt);
              setFeedback('');
              setFeedbackType('');
            }}
          >
            {opt}
          </Button>
        ))}
      </div>
    );
  };

  const renderBuildSequence = (showClueText = true) => {
    if (!currentChallenge?.clues || !currentChallenge?.characters) return null;
    const chars = currentChallenge.characters;
    const clues = currentChallenge.clues;
    const numSlots = chars.length;

    const placedCharNames = new Set(Array.from(buildSlots.values()).map(c => c.name));
    const availableChars = shuffledBuildCharacters.filter(c => !placedCharNames.has(c.name));

    return (
      <div className="space-y-4">
        {/* Clues (hidden for story mode — the story text serves as the clue) */}
        {showClueText && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Clues</p>
            <ul className="space-y-1">
              {clues.map((clue, idx) => (
                <li key={idx} className="text-sm text-slate-300">
                  Put the <span className="text-amber-300 font-medium">{clue.character}</span> in the{' '}
                  <span className="text-amber-300 font-medium">{getOrdinalLabel(clue.position, 'word')}</span> position
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Slots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: numSlots }, (_, idx) => {
            const pos = idx + 1;
            const placed = buildSlots.get(pos);

            return (
              <div
                key={idx}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => {
                  if (isCurrentChallengeComplete) return;
                  if (selectedBuildCharacter) {
                    const char = chars.find(c => c.name === selectedBuildCharacter);
                    if (char) {
                      setBuildSlots(prev => {
                        const next = new Map(prev);
                        Array.from(next.entries()).forEach(([k, v]) => {
                          if (v.name === selectedBuildCharacter) next.delete(k);
                        });
                        next.set(pos, char);
                        return next;
                      });
                      setSelectedBuildCharacter(null);
                    }
                  } else if (placed) {
                    setBuildSlots(prev => {
                      const next = new Map(prev);
                      next.delete(pos);
                      return next;
                    });
                  }
                }}
              >
                <span className="text-[10px] text-slate-500 mb-1">
                  {getOrdinalLabel(pos, labelFormat)}
                </span>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 border-dashed transition-all ${
                  placed
                    ? 'bg-amber-500/10 border-amber-400/40'
                    : selectedBuildCharacter
                      ? 'border-amber-400/40 bg-amber-500/5 animate-pulse'
                      : 'border-white/20 bg-white/5'
                }`}>
                  {placed?.emoji || ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Available characters */}
        {availableChars.length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 mr-2 self-center">Characters:</span>
            {availableChars.map((char, idx) => (
              <div
                key={idx}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl cursor-pointer transition-all ${
                  selectedBuildCharacter === char.name
                    ? 'bg-amber-500/20 border-2 border-amber-400/50 scale-110'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10'
                }`}
                onClick={() => {
                  if (isCurrentChallengeComplete) return;
                  setSelectedBuildCharacter(
                    selectedBuildCharacter === char.name ? null : char.name,
                  );
                }}
                title={char.name}
              >
                {char.emoji}
              </div>
            ))}
          </div>
        )}

        {!selectedBuildCharacter && availableChars.length > 0 && (
          <p className="text-xs text-slate-500 text-center">
            Tap a character below, then tap a slot to place it
          </p>
        )}
        {selectedBuildCharacter && (
          <p className="text-xs text-amber-300 text-center">
            Now tap a slot to place the {selectedBuildCharacter}
          </p>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
              {contextTheme.bgEmoji} {context}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_TYPE_CONFIG).map(([type, config]) => {
              const hasChallengesOfType = challenges.some(c => c.type === type);
              if (!hasChallengesOfType) return null;
              const isCurrent = currentChallenge?.type === type;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    isCurrent
                      ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Story text (for sequence-story) */}
        {currentChallenge?.storyText && !allChallengesComplete && (
          <div className="bg-emerald-500/5 rounded-lg p-4 border border-emerald-400/10">
            <p className="text-slate-200 text-sm leading-relaxed">
              {'\uD83D\uDCD6'} {currentChallenge.storyText}
            </p>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Character Line (for identify and relative-position phases) */}
        {currentChallenge && !allChallengesComplete &&
          (currentChallenge.type === 'identify' ||
           currentChallenge.type === 'relative-position') && (
          <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-x-auto">
            {renderCharacterLine(
              currentChallenge.characters,
              currentChallenge.type === 'identify',
              currentChallenge.type === 'relative-position' ? currentChallenge.targetPosition : undefined,
            )}
          </div>
        )}

        {/* Match Phase UI */}
        {currentChallenge?.type === 'match' && !allChallengesComplete && !isCurrentChallengeComplete && (
          renderMatchPhase()
        )}

        {/* Multiple Choice (for relative-position and sequence-story) */}
        {currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete &&
          currentChallenge.type === 'relative-position' && (
          renderMultipleChoice()
        )}

        {/* Build Sequence Phase */}
        {currentChallenge?.type === 'build-sequence' && !allChallengesComplete && !isCurrentChallengeComplete && (
          renderBuildSequence()
        )}

        {/* Story Drag-and-Drop (build mechanics, story text serves as clues) */}
        {currentChallenge?.type === 'sequence-story' && !allChallengesComplete && !isCurrentChallengeComplete && (
          renderBuildSequence(false)
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={!canCheck}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint after multiple attempts */}
        {feedbackType === 'error' && currentAttempts >= 2 && currentChallenge && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">
              {currentChallenge.type === 'identify'
                ? `Count from the front: ${ORDINAL_WORDS.slice(0, currentChallenge.characters.length).join(', ')}...`
                : currentChallenge.type === 'match'
                  ? 'Read each word slowly and find the matching number.'
                  : currentChallenge.type === 'build-sequence'
                    ? 'Read each clue one at a time and place that character.'
                    : currentChallenge.type === 'sequence-story'
                      ? 'Read the story again and drag each character to their spot.'
                      : 'Think about the order carefully.'}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Ordinal Line Complete!"
            celebrationMessage={`You mastered ordinal positions in the ${context}!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default OrdinalLine;
