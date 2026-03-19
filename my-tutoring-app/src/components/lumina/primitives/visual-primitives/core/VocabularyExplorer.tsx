'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { VocabularyExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface VocabularyExplorerData {
  title: string;
  topic: string;
  introduction: string;

  terms: Array<{
    id: string;
    word: string;
    pronunciation?: string;
    partOfSpeech: string;
    definition: string;
    exampleSentence: string;
    relatedWords: string[];
    wordOrigin?: string;
    imagePrompt?: string;
  }>;

  challenges?: Array<{
    type: 'match' | 'fill_blank' | 'context' | 'identify';
    question: string;
    // For match: pairs to connect
    matchPairs?: Array<{ term: string; definition: string }>;
    // For fill_blank / context / identify: multiple choice
    sentence?: string;
    blankWord?: string;
    options?: string[];
    correctIndex?: number;
    correctUsage?: string;
    explanation: string;
    relatedTermId: string;
  }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VocabularyExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface VocabularyExplorerProps {
  data: VocabularyExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const VocabularyExplorer: React.FC<VocabularyExplorerProps> = ({ data, className }) => {
  const {
    title,
    topic,
    introduction,
    terms = [],
    challenges = [],
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
  const [currentTermIndex, setCurrentTermIndex] = useState(0);
  const [visitedTerms, setVisitedTerms] = useState<Set<string>>(new Set());
  const [relatedWordClicks, setRelatedWordClicks] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeAnswers, setChallengeAnswers] = useState<Array<{ correct: boolean; attempts: number }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false);
  const [allChallengesComplete, setAllChallengesComplete] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Match challenge state
  const [selectedMatchTerm, setSelectedMatchTerm] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Array<[number, number]>>([]);
  const [matchChecked, setMatchChecked] = useState(false);
  const [matchCorrect, setMatchCorrect] = useState(false);

  // Timing
  const [termEntryTime, setTermEntryTime] = useState(Date.now());
  const [termTimes, setTermTimes] = useState<Record<string, number>>({});

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `vocabulary-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const totalTerms = terms.length;
  const termsExplored = visitedTerms.size;
  const allTermsExplored = termsExplored >= totalTerms;
  const currentTerm = terms[currentTermIndex];

  // Mark first term as visited on mount
  useEffect(() => {
    if (currentTerm && !visitedTerms.has(currentTerm.id)) {
      setVisitedTerms(new Set([currentTerm.id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<VocabularyExplorerMetrics>({
    primitiveType: 'vocabulary-explorer',
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
    topic,
    totalTerms,
    currentWord: currentTerm?.word || '',
    partOfSpeech: currentTerm?.partOfSpeech || '',
    termsExplored,
    challengesCompleted: challengeAnswers.length,
    totalChallenges: challenges.length,
  }), [topic, totalTerms, currentTerm, termsExplored, challengeAnswers.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'vocabulary-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Vocabulary Explorer: "${title}" — Topic: ${topic}. `
      + `${totalTerms} terms to learn. ${challenges.length > 0 ? `${challenges.length} challenges after exploration.` : ''} `
      + `${introduction}. Introduce the vocabulary warmly and encourage exploration.`,
      { silent: true }
    );
  }, [isConnected, title, topic, introduction, totalTerms, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Term Navigation
  // -------------------------------------------------------------------------
  const recordTermTime = useCallback(() => {
    if (!currentTerm) return;
    const elapsed = Date.now() - termEntryTime;
    setTermTimes(prev => ({
      ...prev,
      [currentTerm.id]: (prev[currentTerm.id] || 0) + elapsed,
    }));
  }, [currentTerm, termEntryTime]);

  const handleTermChange = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= totalTerms) return;

    recordTermTime();
    setTermEntryTime(Date.now());
    setCurrentTermIndex(newIndex);

    const term = terms[newIndex];
    setVisitedTerms(prev => {
      const next = new Set(prev);
      next.add(term.id);
      return next;
    });

    if (isConnected) {
      sendText(
        `[TERM_SELECTED] Student selected term ${newIndex + 1} of ${totalTerms}: `
        + `"${term.word}" (${term.partOfSpeech}). `
        + `Terms explored: ${visitedTerms.has(term.id) ? termsExplored : termsExplored + 1}/${totalTerms}. `
        + `Pronounce "${term.word}" and give a brief introduction. Connect to something familiar.`,
        { silent: true }
      );
    }
  }, [totalTerms, terms, recordTermTime, visitedTerms, termsExplored, isConnected, sendText]);

  // Related word click
  const handleRelatedWordClick = useCallback((relatedWord: string) => {
    setRelatedWordClicks(prev => prev + 1);
    const targetIndex = terms.findIndex(
      t => t.word.toLowerCase() === relatedWord.toLowerCase()
    );
    if (targetIndex >= 0) {
      if (isConnected) {
        sendText(
          `[RELATED_WORD_CLICKED] Student clicked related word "${relatedWord}" from "${currentTerm?.word}". `
          + `Briefly explain how these two terms connect.`,
          { silent: true }
        );
      }
      handleTermChange(targetIndex);
    }
  }, [terms, currentTerm, isConnected, sendText, handleTermChange]);

  // Track all terms explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allTermsExplored && !hasNotifiedAllExploredRef.current && isConnected) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_TERMS_EXPLORED] Student explored all ${totalTerms} terms! `
        + `${challenges.length > 0 ? `${challenges.length} vocabulary challenges coming up.` : 'Vocabulary complete!'} `
        + `Congratulate and challenge them to use a new word in their own sentence.`,
        { silent: true }
      );
    }
  }, [allTermsExplored, totalTerms, challenges.length, isConnected, sendText]);

  useEffect(() => {
    if (allTermsExplored && !showSummary) {
      setShowSummary(true);
    }
  }, [allTermsExplored, showSummary]);

  // -------------------------------------------------------------------------
  // Challenge Handling
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const handleStartChallenges = useCallback(() => {
    setShowChallenges(true);
    setCurrentChallengeIndex(0);
    setCurrentAttempts(0);
  }, []);

  // MC answer (fill_blank / context / identify)
  const handleMCAnswer = useCallback((optionIndex: number) => {
    if (!currentChallenge || showChallengeFeedback) return;
    if (currentChallenge.type === 'match') return;

    setSelectedOption(optionIndex);
    setShowChallengeFeedback(true);

    const correct = optionIndex === currentChallenge.correctIndex;
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Challenge ${currentChallengeIndex + 1}/${challenges.length} (${currentChallenge.type}): `
        + `"${currentChallenge.question}" — Student chose "${currentChallenge.options?.[optionIndex]}". `
        + `${correct
          ? 'Correct! Use the word in a new sentence to reinforce.'
          : 'Incorrect. Give a contextual hint using the word\'s definition without revealing the answer.'
        }`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentChallengeIndex, challenges, showChallengeFeedback, currentAttempts, isConnected, sendText]);

  // Match challenge
  const handleMatchTermSelect = useCallback((termIdx: number) => {
    if (matchChecked) return;
    if (matchedPairs.some(([t]) => t === termIdx)) return;
    setSelectedMatchTerm(termIdx);
  }, [matchChecked, matchedPairs]);

  const handleMatchDefSelect = useCallback((defIdx: number) => {
    if (matchChecked || selectedMatchTerm === null) return;
    if (matchedPairs.some(([, d]) => d === defIdx)) return;
    setMatchedPairs(prev => [...prev, [selectedMatchTerm, defIdx]]);
    setSelectedMatchTerm(null);
  }, [matchChecked, selectedMatchTerm, matchedPairs]);

  const handleMatchCheck = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'match') return;
    const pairs = currentChallenge.matchPairs || [];

    // Correct if each term index maps to the same definition index
    const correct = pairs.length === matchedPairs.length &&
      matchedPairs.every(([t, d]) => t === d); // terms and defs are in matching order from generator

    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);
    setMatchChecked(true);
    setMatchCorrect(correct);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
      setShowChallengeFeedback(true);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Match challenge: "${currentChallenge.question}" — `
        + `${correct ? 'All terms matched correctly!' : 'Some matches are wrong. Re-read the definitions carefully.'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, matchedPairs, currentAttempts, isConnected, sendText]);

  // Next challenge
  const handleNextChallenge = useCallback(() => {
    setSelectedOption(null);
    setShowChallengeFeedback(false);
    setSelectedMatchTerm(null);
    setMatchedPairs([]);
    setMatchChecked(false);
    setMatchCorrect(false);
    setCurrentAttempts(0);

    if (currentChallengeIndex + 1 >= challenges.length) {
      setAllChallengesComplete(true);
      recordTermTime();

      const correctCount = challengeAnswers.filter(a => a.correct).length;
      const totalAttempts = challengeAnswers.reduce((sum, a) => sum + a.attempts, 0);
      const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;

      if (isConnected) {
        sendText(
          `[ALL_COMPLETE] Student finished all ${challenges.length} vocabulary challenges. `
          + `Accuracy: ${accuracy}%. Terms explored: ${termsExplored}/${totalTerms}. `
          + `Related word clicks: ${relatedWordClicks}. `
          + `Celebrate vocabulary mastery and encourage using the words.`,
          { silent: true }
        );
      }

      if (!hasSubmittedEvaluation) {
        const avgTimePerTerm = totalTerms > 0
          ? Math.round(Object.values(termTimes).reduce((a, b) => a + b, 0) / totalTerms)
          : 0;

        const byType = (type: string) => {
          const relevant = challenges
            .map((c, i) => ({ ...c, answer: challengeAnswers[i] }))
            .filter(c => c.type === type && c.answer);
          if (relevant.length === 0) return 0;
          return Math.round((relevant.filter(c => c.answer?.correct).length / relevant.length) * 100);
        };

        const metrics: VocabularyExplorerMetrics = {
          type: 'vocabulary-explorer',
          termsExplored,
          totalTerms,
          matchAccuracy: byType('match'),
          fillBlankAccuracy: byType('fill_blank'),
          contextAccuracy: byType('context'),
          challengeAttempts: totalAttempts,
          averageTimePerTerm: avgTimePerTerm,
          relatedWordClicks,
        };

        const overallScore = Math.round(
          (termsExplored / Math.max(totalTerms, 1)) * 30 + accuracy * 0.7
        );

        submitEvaluation(
          accuracy >= 70 && termsExplored >= totalTerms,
          overallScore,
          metrics,
          { challengeAnswers: [...challengeAnswers] }
        );
      }
    } else {
      setCurrentChallengeIndex(prev => prev + 1);
    }
  }, [
    currentChallengeIndex, challenges, challengeAnswers, termsExplored, totalTerms,
    termTimes, relatedWordClicks, isConnected, sendText, hasSubmittedEvaluation,
    submitEvaluation, recordTermTime,
  ]);

  // Auto-submit for display-only
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (challenges.length === 0 && allTermsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      const avgTimePerTerm = totalTerms > 0
        ? Math.round(Object.values(termTimes).reduce((a, b) => a + b, 0) / totalTerms)
        : 0;

      const metrics: VocabularyExplorerMetrics = {
        type: 'vocabulary-explorer',
        termsExplored,
        totalTerms,
        matchAccuracy: 0,
        fillBlankAccuracy: 0,
        contextAccuracy: 0,
        challengeAttempts: 0,
        averageTimePerTerm: avgTimePerTerm,
        relatedWordClicks,
      };

      submitEvaluation(true, 100, metrics, {});
    }
  }, [challenges.length, allTermsExplored, hasSubmittedEvaluation, termsExplored, totalTerms, termTimes, relatedWordClicks, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Render: Term Card
  // -------------------------------------------------------------------------
  const renderTermCard = () => {
    if (!currentTerm) return null;

    return (
      <div className="space-y-4">
        {/* Term header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-slate-100 text-lg font-bold">{currentTerm.word}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-blue-500/10 border-blue-400/20 text-blue-300 text-[10px]">
                {currentTerm.partOfSpeech}
              </Badge>
              {currentTerm.pronunciation && (
                <span className="text-slate-500 text-xs italic">/{currentTerm.pronunciation}/</span>
              )}
            </div>
          </div>
          <span className="text-slate-600 text-xs shrink-0">
            {currentTermIndex + 1} of {totalTerms}
          </span>
        </div>

        {/* Definition */}
        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">Definition</p>
          <p className="text-slate-200 text-sm leading-relaxed">{currentTerm.definition}</p>
        </div>

        {/* Example sentence */}
        <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">In a Sentence</p>
          <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{currentTerm.exampleSentence}&rdquo;</p>
        </div>

        {/* Related words */}
        {currentTerm.relatedWords && currentTerm.relatedWords.length > 0 && (
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-2">Related Words</p>
            <div className="flex flex-wrap gap-2">
              {currentTerm.relatedWords.map((rw, i) => {
                const hasLink = terms.some(t => t.word.toLowerCase() === rw.toLowerCase());
                return hasLink ? (
                  <button
                    key={i}
                    onClick={() => handleRelatedWordClick(rw)}
                    className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-300 text-xs hover:bg-purple-500/20 transition-all"
                  >
                    {rw}
                  </button>
                ) : (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs"
                  >
                    {rw}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Word origin */}
        {currentTerm.wordOrigin && (
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="flex items-start gap-2">
              <Badge className="bg-amber-500/20 border-amber-400/30 text-amber-300 text-[10px] shrink-0">
                Word Origin
              </Badge>
              <p className="text-slate-300 text-xs leading-relaxed">{currentTerm.wordOrigin}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs h-8"
            onClick={() => handleTermChange(currentTermIndex - 1)}
            disabled={currentTermIndex === 0}
          >
            Previous
          </Button>
          <span className="text-slate-500 text-xs">
            Term {currentTermIndex + 1} of {totalTerms}
          </span>
          {currentTermIndex < totalTerms - 1 ? (
            <Button
              variant="ghost"
              className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300 text-xs h-8"
              onClick={() => handleTermChange(currentTermIndex + 1)}
            >
              Next
            </Button>
          ) : (
            <div className="w-[72px]" />
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Challenge {currentChallengeIndex + 1} of {challenges.length}
          </p>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
            {currentChallenge.type.replace('_', ' ')}
          </Badge>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>

        {/* Fill-in-blank sentence display */}
        {currentChallenge.type === 'fill_blank' && currentChallenge.sentence && (
          <p className="text-slate-300 text-sm italic p-3 rounded-lg bg-white/5 border border-white/5">
            &ldquo;{currentChallenge.sentence}&rdquo;
          </p>
        )}

        {/* MC options (fill_blank / context / identify) */}
        {currentChallenge.type !== 'match' && currentChallenge.options && (
          <div className="space-y-2">
            {currentChallenge.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrectOption = i === currentChallenge.correctIndex;
              const showAsCorrect = showChallengeFeedback && isCorrectOption;
              const showAsWrong = showChallengeFeedback && isSelected && !isCorrectOption;

              return (
                <Button
                  key={i}
                  variant="ghost"
                  className={`w-full justify-start text-left h-auto py-3 px-4 text-sm transition-all duration-200 ${
                    showAsCorrect
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                      : showAsWrong
                        ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                        : isSelected
                          ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => handleMCAnswer(i)}
                  disabled={showChallengeFeedback}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        )}

        {/* Match challenge */}
        {currentChallenge.type === 'match' && currentChallenge.matchPairs && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Terms column */}
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Terms</p>
                {currentChallenge.matchPairs.map((pair, i) => {
                  const isMatched = matchedPairs.some(([t]) => t === i);
                  const isActive = selectedMatchTerm === i;
                  const pairIdx = matchedPairs.findIndex(([t]) => t === i);
                  const isCorrectPair = matchChecked && matchedPairs.some(([t, d]) => t === i && t === d);
                  const isWrongPair = matchChecked && !matchCorrect && isMatched && !isCorrectPair;

                  return (
                    <button
                      key={i}
                      onClick={() => handleMatchTermSelect(i)}
                      disabled={matchChecked || isMatched}
                      className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        isCorrectPair
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : isWrongPair
                            ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                            : isActive
                              ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                              : isMatched
                                ? 'bg-purple-500/10 border border-purple-400/30 text-purple-300'
                                : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      {isMatched && <span className="text-purple-400 mr-1">{pairIdx + 1}.</span>}
                      {pair.term}
                    </button>
                  );
                })}
              </div>

              {/* Definitions column */}
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Definitions</p>
                {currentChallenge.matchPairs.map((pair, i) => {
                  const isMatched = matchedPairs.some(([, d]) => d === i);
                  const pairIdx = matchedPairs.findIndex(([, d]) => d === i);
                  const isCorrectPair = matchChecked && matchedPairs.some(([t, d]) => d === i && t === d);
                  const isWrongPair = matchChecked && !matchCorrect && isMatched && !isCorrectPair;

                  return (
                    <button
                      key={i}
                      onClick={() => handleMatchDefSelect(i)}
                      disabled={matchChecked || isMatched || selectedMatchTerm === null}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all duration-200 ${
                        isCorrectPair
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : isWrongPair
                            ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                            : isMatched
                              ? 'bg-purple-500/10 border border-purple-400/30 text-purple-300'
                              : selectedMatchTerm !== null
                                ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 ring-1 ring-blue-400/20'
                                : 'bg-white/5 border border-white/10 text-slate-400'
                      }`}
                    >
                      {isMatched && <span className="text-purple-400 mr-1">{pairIdx + 1}.</span>}
                      {pair.definition}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMatchTerm !== null && !matchChecked && (
              <p className="text-blue-400 text-xs text-center">Now select the matching definition</p>
            )}

            {!showChallengeFeedback && matchedPairs.length >= (currentChallenge.matchPairs?.length || 0) && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                  onClick={handleMatchCheck}
                >
                  Check Matches
                </Button>
              </div>
            )}
            {matchChecked && !matchCorrect && !showChallengeFeedback && (
              <p className="text-amber-400 text-xs text-center">Some matches are wrong — re-read the definitions!</p>
            )}
          </div>
        )}

        {/* Feedback */}
        {showChallengeFeedback && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${
              challengeAnswers[challengeAnswers.length - 1]?.correct ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {challengeAnswers[challengeAnswers.length - 1]?.correct ? 'Correct!' : 'Not quite, but let\'s keep going.'}
            </p>
            <p className="text-slate-400 text-xs">{currentChallenge.explanation}</p>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={handleNextChallenge}
              >
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = challengeAnswers.filter(a => a.correct).length;
    const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">Vocabulary Mastered!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          <span>{termsExplored}/{totalTerms} terms learned</span>
          <span>{correctCount}/{challenges.length} challenges correct</span>
          <span>{relatedWordClicks} related words explored</span>
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#128218;</span>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
            {totalTerms} Terms
          </Badge>
        </div>
        <p className="text-slate-400 text-sm mt-1">{introduction}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {allChallengesComplete ? (
          renderResults()
        ) : showChallenges ? (
          <div className="border-t border-white/10 pt-4">
            <p className="text-slate-300 text-xs font-medium mb-3 uppercase tracking-wider">
              Vocabulary Check
            </p>
            {renderChallenge()}
          </div>
        ) : (
          <>
            {/* Term tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {terms.map((term, i) => {
                const isActive = currentTermIndex === i;
                const isVisited = visitedTerms.has(term.id);

                return (
                  <Button
                    key={term.id}
                    variant="ghost"
                    className={`shrink-0 text-xs px-3 py-2 h-auto transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 border border-white/20 text-slate-100'
                        : isVisited
                          ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                          : 'bg-transparent border border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'
                    }`}
                    onClick={() => handleTermChange(i)}
                  >
                    {term.word}
                    {isVisited && !isActive && <span className="ml-1 text-emerald-400">&#10003;</span>}
                  </Button>
                );
              })}
            </div>

            {/* Term content */}
            <div className="min-h-[200px]">{renderTermCard()}</div>

            {/* Summary (after all explored) */}
            {showSummary && (
              <div className="border-t border-white/10 pt-3">
                <p className="text-emerald-400 text-xs font-medium">
                  All {totalTerms} terms explored!
                </p>
              </div>
            )}

            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>{termsExplored} of {totalTerms} terms explored</span>
              {allTermsExplored && challenges.length > 0 && !showChallenges && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 text-xs h-8"
                  onClick={handleStartChallenges}
                >
                  Start Challenges ({challenges.length})
                </Button>
              )}
              {!allTermsExplored && (
                <span className="text-slate-600">Explore all terms to unlock challenges</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VocabularyExplorer;
