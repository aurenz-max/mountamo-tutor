'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordSorterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface WordCard {
  id: string;
  word: string;
  emoji?: string;
  correctBucket: string;
}

export interface MatchPair {
  id: string;
  term: string;
  termEmoji?: string;
  match: string;
  matchEmoji?: string;
}

export interface WordSorterChallenge {
  id: string;
  type: 'binary_sort' | 'ternary_sort' | 'match_pairs';
  instruction: string;
  bucketLabels?: string[];
  words?: WordCard[];
  pairs?: MatchPair[];
}

export interface WordSorterData {
  title: string;
  description?: string;
  gradeLevel: string;
  sortingTopic: string;
  challenges: WordSorterChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordSorterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  binary_sort:  { label: 'Two Buckets',   icon: '📂', accentColor: 'purple' },
  ternary_sort: { label: 'Three Buckets', icon: '🗂️', accentColor: 'blue' },
  match_pairs:  { label: 'Match Pairs',   icon: '🔗', accentColor: 'emerald' },
};

const BUCKET_COLORS = [
  { bg: 'bg-violet-500/10', border: 'border-violet-400/30', text: 'text-violet-300', active: 'ring-violet-400' },
  { bg: 'bg-sky-500/10', border: 'border-sky-400/30', text: 'text-sky-300', active: 'ring-sky-400' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300', active: 'ring-emerald-400' },
];

/** Partial credit: 1st try = 100%, 2nd = 75%, 3rd = 50%, 4th+ = 25%. */
function attemptScore(attempts: number): number {
  if (attempts <= 1) return 100;
  if (attempts === 2) return 75;
  if (attempts === 3) return 50;
  return 25;
}

// ============================================================================
// Component
// ============================================================================

interface WordSorterProps {
  data: WordSorterData;
  className?: string;
}

const WordSorter: React.FC<WordSorterProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel = 'K',
    sortingTopic,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ─── Shared hooks ──────────────────────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ─── Domain state ──────────────────────────────────────────────
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [bucketAssignments, setBucketAssignments] = useState<Map<string, string>>(new Map());
  // match_pairs: which term is selected, and which pairs have been matched
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Map<string, string>>(new Map()); // termId → matchId
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // ─── Refs ──────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `word-sorter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ─── Current challenge ─────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // ─── Unsorted words ────────────────────────────────────────────
  const unsortedWords = useMemo(() => {
    if (!currentChallenge?.words) return [];
    return currentChallenge.words.filter(w => !bucketAssignments.has(w.id));
  }, [currentChallenge, bucketAssignments]);

  // ─── Words per bucket ──────────────────────────────────────────
  const wordsInBuckets = useMemo(() => {
    if (!currentChallenge?.words || !currentChallenge?.bucketLabels) return new Map<string, WordCard[]>();
    const map = new Map<string, WordCard[]>();
    for (const label of currentChallenge.bucketLabels) {
      map.set(label, []);
    }
    for (const [wordId, bucketLabel] of Array.from(bucketAssignments.entries())) {
      const word = currentChallenge.words.find(w => w.id === wordId);
      if (word) {
        const arr = map.get(bucketLabel) || [];
        arr.push(word);
        map.set(bucketLabel, arr);
      }
    }
    return map;
  }, [currentChallenge, bucketAssignments]);

  // ─── Unmatched items for match_pairs ───────────────────────────
  const unmatchedTerms = useMemo(() => {
    if (!currentChallenge?.pairs) return [];
    return currentChallenge.pairs.filter(p => !matchedPairs.has(p.id));
  }, [currentChallenge, matchedPairs]);

  // Stable shuffled order for the matches column — computed once per challenge
  const matchDisplayOrderRef = useRef<{ challengeId: string; order: { id: string; text: string; emoji?: string }[] }>({ challengeId: '', order: [] });
  if (currentChallenge?.type === 'match_pairs' && currentChallenge.pairs && matchDisplayOrderRef.current.challengeId !== currentChallenge.id) {
    const items = currentChallenge.pairs.map(p => ({ id: p.id, text: p.match, emoji: p.matchEmoji }));
    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    matchDisplayOrderRef.current = { challengeId: currentChallenge.id, order: items };
  }

  const unmatchedMatches = useMemo(() => {
    if (!currentChallenge?.pairs) return [];
    const matchedSet = new Set(matchedPairs.values());
    return matchDisplayOrderRef.current.order.filter(m => !matchedSet.has(m.id));
  }, [currentChallenge, matchedPairs]);

  // ─── Evaluation ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<WordSorterMetrics>({
    primitiveType: 'word-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ─── AI Tutoring ───────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? '',
    instruction: currentChallenge?.instruction ?? '',
    bucketLabels: currentChallenge?.bucketLabels ?? [],
    wordsSorted: bucketAssignments.size + matchedPairs.size,
    totalWords: (currentChallenge?.words?.length ?? 0) + (currentChallenge?.pairs?.length ?? 0),
    attemptNumber: currentAttempts + 1,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    gradeLevel,
    sortingTopic,
  }), [
    currentChallenge, bucketAssignments.size, matchedPairs.size,
    currentAttempts, currentChallengeIndex, challenges.length, gradeLevel, sortingTopic,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'word-sorter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ─── Activity introduction ─────────────────────────────────────
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Word Sorter activity for grade ${gradeLevel}. Topic: ${sortingTopic}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}" (${currentChallenge?.type}). `
      + `Introduce warmly: "Let's sort some words together!"`,
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, gradeLevel, sortingTopic, sendText]);

  // ─── Handle word selection (sort modes) ────────────────────────
  const handleWordClick = useCallback((wordId: string) => {
    if (hasSubmittedEvaluation || !currentChallenge) return;
    setSelectedWordId(prev => prev === wordId ? null : wordId);
  }, [hasSubmittedEvaluation, currentChallenge]);

  // ─── Handle bucket click (drop word into bucket) ───────────────
  const handleBucketClick = useCallback((bucketLabel: string) => {
    if (hasSubmittedEvaluation || !currentChallenge || !selectedWordId) return;

    const word = currentChallenge.words?.find(w => w.id === selectedWordId);
    if (!word) return;

    if (word.correctBucket === bucketLabel) {
      setBucketAssignments(prev => new Map(prev).set(word.id, bucketLabel));
      setFeedback('Correct!');
      setFeedbackType('success');
      setSelectedWordId(null);
      sendText(
        `[ANSWER_CORRECT] Student correctly sorted "${word.word}" into "${bucketLabel}". Brief encouragement.`,
        { silent: true },
      );
    } else {
      incrementAttempts();
      setFeedback(`Try again — "${word.word}" doesn't belong in "${bucketLabel}".`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student tried to put "${word.word}" in "${bucketLabel}" but it belongs in "${word.correctBucket}". Give a hint without revealing the answer.`,
        { silent: true },
      );
    }

    // Clear feedback after 2s
    setTimeout(() => { setFeedback(''); setFeedbackType(''); }, 2000);
  }, [hasSubmittedEvaluation, currentChallenge, selectedWordId, incrementAttempts, sendText]);

  // ─── Handle match pair selection ───────────────────────────────
  const handleTermClick = useCallback((termId: string) => {
    if (hasSubmittedEvaluation) return;
    setSelectedTermId(prev => prev === termId ? null : termId);
  }, [hasSubmittedEvaluation]);

  const handleMatchClick = useCallback((matchId: string) => {
    if (hasSubmittedEvaluation || !selectedTermId || !currentChallenge?.pairs) return;

    const pair = currentChallenge.pairs.find(p => p.id === selectedTermId);
    if (!pair) return;

    if (pair.id === matchId) {
      // Correct match
      setMatchedPairs(prev => new Map(prev).set(pair.id, matchId));
      setSelectedTermId(null);
      setFeedback(`"${pair.term}" → "${pair.match}"`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student matched "${pair.term}" with "${pair.match}". Brief encouragement.`,
        { silent: true },
      );
    } else {
      const wrongMatch = currentChallenge.pairs.find(p => p.id === matchId);
      incrementAttempts();
      setFeedback('Not quite — try a different match.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student tried to match "${pair.term}" with "${wrongMatch?.match ?? '?'}". Correct match is "${pair.match}". Give a hint.`,
        { silent: true },
      );
    }

    setTimeout(() => { setFeedback(''); setFeedbackType(''); }, 2000);
  }, [hasSubmittedEvaluation, selectedTermId, currentChallenge, incrementAttempts, sendText]);

  // ─── Check if current challenge is done ────────────────────────
  const isChallengeAllSorted = useMemo(() => {
    if (!currentChallenge) return false;
    if (currentChallenge.type === 'match_pairs') {
      return (currentChallenge.pairs?.length ?? 0) > 0 &&
        matchedPairs.size >= (currentChallenge.pairs?.length ?? 0);
    }
    return (currentChallenge.words?.length ?? 0) > 0 &&
      bucketAssignments.size >= (currentChallenge.words?.length ?? 0);
  }, [currentChallenge, bucketAssignments.size, matchedPairs.size]);

  // ─── Auto-record result when all items sorted ──────────────────
  const hasRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isChallengeAllSorted || !currentChallenge || hasRecordedRef.current === currentChallenge.id) return;
    hasRecordedRef.current = currentChallenge.id;

    const score = attemptScore(currentAttempts);
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      score,
    });
  }, [isChallengeAllSorted, currentChallenge, currentAttempts, recordResult]);

  // ─── Advance ───────────────────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / challenges.length,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their word sorting skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const totalScore = challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0);
        const score = Math.round(totalScore / challenges.length);
        const allCorrect = challengeResults.every(r => r.correct);

        const metrics: WordSorterMetrics = {
          type: 'word-sorter',
          sortingAccuracy: score,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          wordsProcessed: challenges.reduce((s, ch) =>
            s + (ch.words?.length ?? 0) + (ch.pairs?.length ?? 0), 0),
        };

        submitEvaluation(allCorrect, score, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain state for next challenge
    setFeedback('');
    setFeedbackType('');
    setSelectedWordId(null);
    setBucketAssignments(new Map());
    setSelectedTermId(null);
    setMatchedPairs(new Map());
    hasRecordedRef.current = null;

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (${nextChallenge.type}). Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // ─── Auto-submit on complete ───────────────────────────────────
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ─── Local score ───────────────────────────────────────────────
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // ─── Render: Sort Challenge (binary/ternary) ───────────────────
  const renderSortChallenge = () => {
    if (!currentChallenge?.words || !currentChallenge?.bucketLabels) return null;

    return (
      <div className="space-y-6">
        {/* Word Pool */}
        <div className="space-y-2">
          <p className="text-sm text-slate-400 font-medium">Tap a word, then tap the bucket it belongs in:</p>
          <div className="flex flex-wrap gap-3 justify-center min-h-[60px] p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            {unsortedWords.length === 0 && (
              <p className="text-slate-500 text-sm">All words sorted!</p>
            )}
            {unsortedWords.map(word => (
              <button
                key={word.id}
                onClick={() => handleWordClick(word.id)}
                className={`
                  px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer
                  ${selectedWordId === word.id
                    ? 'bg-white/20 border-white/40 text-white ring-2 ring-white/30 scale-105'
                    : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10 hover:border-white/25'
                  }
                `}
              >
                {word.emoji && <span className="mr-1.5">{word.emoji}</span>}
                {word.word}
              </button>
            ))}
          </div>
        </div>

        {/* Buckets */}
        <div className={`grid gap-4 ${currentChallenge.bucketLabels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {currentChallenge.bucketLabels.map((label, idx) => {
            const color = BUCKET_COLORS[idx] || BUCKET_COLORS[0];
            const wordsHere = wordsInBuckets.get(label) || [];

            return (
              <button
                key={label}
                onClick={() => handleBucketClick(label)}
                disabled={!selectedWordId}
                className={`
                  rounded-xl border-2 border-dashed p-4 min-h-[140px] transition-all
                  ${color.bg} ${color.border}
                  ${selectedWordId
                    ? `cursor-pointer hover:border-solid hover:ring-2 hover:${color.active}`
                    : 'cursor-default'
                  }
                `}
              >
                <h3 className={`text-sm font-bold ${color.text} mb-3 text-center`}>
                  {label}
                </h3>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {wordsHere.map(w => (
                    <Badge
                      key={w.id}
                      variant="secondary"
                      className="bg-white/10 text-slate-200 border-white/10 text-xs"
                    >
                      {w.emoji && <span className="mr-1">{w.emoji}</span>}
                      {w.word}
                    </Badge>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Render: Match Pairs Challenge ─────────────────────────────
  const renderMatchPairsChallenge = () => {
    if (!currentChallenge?.pairs) return null;

    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400 font-medium">Tap a word on the left, then tap its match on the right:</p>

        <div className="grid grid-cols-2 gap-6">
          {/* Terms column */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Words</p>
            {currentChallenge.pairs.map(pair => {
              const isMatched = matchedPairs.has(pair.id);
              const isSelected = selectedTermId === pair.id;

              return (
                <button
                  key={pair.id}
                  onClick={() => !isMatched && handleTermClick(pair.id)}
                  disabled={isMatched}
                  className={`
                    w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left
                    ${isMatched
                      ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300 opacity-60'
                      : isSelected
                        ? 'bg-violet-500/20 border-violet-400/40 text-white ring-2 ring-violet-400/40'
                        : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10 cursor-pointer'
                    }
                  `}
                >
                  {pair.termEmoji && <span className="mr-1.5">{pair.termEmoji}</span>}
                  {pair.term}
                  {isMatched && <span className="float-right text-emerald-400">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Matches column */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Matches</p>
            {unmatchedMatches.map(m => (
              <button
                key={m.id}
                onClick={() => handleMatchClick(m.id)}
                disabled={!selectedTermId}
                className={`
                  w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left
                  ${selectedTermId
                    ? 'bg-white/5 border-white/15 text-slate-200 hover:bg-sky-500/10 hover:border-sky-400/30 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-slate-400 cursor-default'
                  }
                `}
              >
                {m.emoji && <span className="mr-1.5">{m.emoji}</span>}
                {m.text}
              </button>
            ))}
            {/* Show matched items (greyed) */}
            {currentChallenge.pairs
              .filter(p => matchedPairs.has(p.id))
              .map(p => (
                <div
                  key={`matched-${p.id}`}
                  className="w-full px-4 py-3 rounded-xl border bg-emerald-500/10 border-emerald-400/20 text-emerald-300 text-sm font-medium opacity-60"
                >
                  {p.matchEmoji && <span className="mr-1.5">{p.matchEmoji}</span>}
                  {p.match}
                  <span className="float-right">✓</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardContent className="p-6 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg font-semibold">{title}</CardTitle>
          <Badge variant="outline" className="border-white/20 text-slate-300 text-xs">
            {currentChallengeIndex + 1} / {challenges.length}
          </Badge>
        </div>
        {description && (
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Phase Summary (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Word Sorting Complete!"
            celebrationMessage="You sorted all the words!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Challenge instruction */}
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-slate-200 text-sm font-medium">
                {currentChallenge.instruction}
              </p>
            </div>

            {/* Challenge type badge */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/5 border-white/10 text-slate-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
              {currentAttempts > 0 && (
                <Badge variant="secondary" className="bg-amber-500/10 border-amber-400/20 text-amber-300 text-xs">
                  {currentAttempts} wrong
                </Badge>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`p-3 rounded-lg text-sm font-medium text-center transition-all ${
                feedbackType === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-300'
                  : 'bg-red-500/10 border border-red-400/20 text-red-300'
              }`}>
                {feedback}
              </div>
            )}

            {/* Challenge content */}
            {(currentChallenge.type === 'binary_sort' || currentChallenge.type === 'ternary_sort')
              ? renderSortChallenge()
              : renderMatchPairsChallenge()
            }

            {/* Next button (appears when challenge is fully sorted) */}
            {isChallengeAllSorted && !allChallengesComplete && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={advanceToNextChallenge}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                >
                  Next Challenge →
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WordSorter;
