'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SentenceAnalyzerMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SentenceWord {
  id: string;
  text: string;
  partOfSpeech: string;      // Noun, Verb, Adjective, Adverb, etc.
  grammaticalRole: string;   // Subject, Predicate, Direct Object, etc.
}

export interface SentenceAnalyzerChallenge {
  id: string;
  type: 'identify_pos' | 'identify_role' | 'label_all' | 'parse_structure';

  /** The full sentence text */
  sentence: string;

  /** Words with grammar info (answer key) */
  words: SentenceWord[];

  // --- identify_pos fields ---
  /** Which word to ask about (index into words array) */
  targetWordIndex?: number;
  /** Multiple-choice options for part of speech */
  posOptions?: string[];
  /** Correct part of speech */
  correctPos?: string;

  // --- identify_role fields ---
  /** Multiple-choice options for grammatical role */
  roleOptions?: string[];
  /** Correct grammatical role */
  correctRole?: string;

  // --- parse_structure fields ---
  /** Sentence type classification answer */
  sentenceType?: string;
  /** MC options for sentence type */
  sentenceTypeOptions?: string[];

  /** Explanation shown after answering */
  explanation: string;
}

export interface SentenceAnalyzerData {
  title: string;
  description: string;
  gradeLevel: string;

  challenges: SentenceAnalyzerChallenge[];

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SentenceAnalyzerMetrics>) => void;
}

// ============================================================================
// Props & Constants
// ============================================================================

interface SentenceAnalyzerProps {
  data: SentenceAnalyzerData;
  className?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify_pos: { label: 'Identify POS', icon: 'Aa', accentColor: 'blue' },
  identify_role: { label: 'Identify Role', icon: 'Rr', accentColor: 'purple' },
  label_all: { label: 'Label All', icon: 'La', accentColor: 'amber' },
  parse_structure: { label: 'Parse Structure', icon: 'Ps', accentColor: 'emerald' },
};

const POS_COLORS: Record<string, string> = {
  Noun: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  Verb: 'bg-red-500/20 border-red-500/40 text-red-300',
  Adjective: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  Adverb: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  Pronoun: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  Preposition: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
  Conjunction: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  Determiner: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  Interjection: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
};

function getPosColor(pos: string): string {
  return POS_COLORS[pos] || 'bg-white/10 border-white/20 text-slate-300';
}

// ============================================================================
// Component
// ============================================================================

const SentenceAnalyzer: React.FC<SentenceAnalyzerProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `sentence-analyzer-${Date.now()}`;

  // ---- Shared hooks ----
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

  // ---- Evaluation hook ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
  } = usePrimitiveEvaluation<SentenceAnalyzerMetrics>({
    primitiveType: 'sentence-analyzer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel,
    challengeCount: challenges.length,
    currentChallenge: challenges[currentChallengeIndex],
  }), [title, gradeLevel, challenges, currentChallengeIndex]);

  const { sendText } = useLuminaAI({
    primitiveType: 'sentence-analyzer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ---- Local state ----
  const [selectedOption, setSelectedOption] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showExplanation, setShowExplanation] = useState(false);

  // label_all state
  const [labeledWords, setLabeledWords] = useState<Record<string, string>>({});
  const [activeLabelIndex, setActiveLabelIndex] = useState(0);
  const [labelAllChecked, setLabelAllChecked] = useState(false);

  // parse_structure state: step 1 = group words, step 2 = classify type
  const [parseStep, setParseStep] = useState<1 | 2>(1);
  const [wordGroups, setWordGroups] = useState<Record<string, 'subject' | 'predicate'>>({});

  const currentChallenge = challenges[currentChallengeIndex];

  // ---- Reset local state when advancing ----
  const resetLocalState = useCallback(() => {
    setSelectedOption('');
    setFeedback('');
    setFeedbackType('');
    setShowExplanation(false);
    setLabeledWords({});
    setActiveLabelIndex(0);
    setLabelAllChecked(false);
    setParseStep(1);
    setWordGroups({});
  }, []);

  // ---- Submit final evaluation ----
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const correct = challengeResults.filter(r => r.correct).length;
    const total = challengeResults.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const metrics: SentenceAnalyzerMetrics = {
      type: 'sentence-analyzer',
      gradeLevel,
      totalChallenges: challenges.length,
      challengesCorrect: correct,
      posIdentifyCorrect: challengeResults.filter(r => r.challengeType === 'identify_pos' && r.correct).length,
      roleIdentifyCorrect: challengeResults.filter(r => r.challengeType === 'identify_role' && r.correct).length,
      labelAllAccuracy: (() => {
        const labelResults = challengeResults.filter(r => r.challengeType === 'label_all');
        if (labelResults.length === 0) return 0;
        const avgScore = labelResults.reduce((sum, r) => sum + ((r.score as number) ?? 0), 0) / labelResults.length;
        return Math.round(avgScore);
      })(),
      parseStructureCorrect: challengeResults.filter(r => r.challengeType === 'parse_structure' && r.correct).length,
    };

    submitEvaluation(score >= 50, score, metrics, { challengeResults });

    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
    sendText(`[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${score}%. Give encouraging phase-specific feedback.`, { silent: true });
  }, [hasSubmittedEvaluation, challengeResults, challenges.length, gradeLevel, submitEvaluation, phaseResults, sendText]);

  // ---- Handle advance to next challenge ----
  const handleNext = useCallback(() => {
    resetLocalState();
    if (!advanceProgress()) {
      submitFinalEvaluation();
    } else {
      const nextCh = challenges[currentChallengeIndex + 1];
      sendText(`[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: "${nextCh?.sentence}". Introduce it briefly.`, { silent: true });
    }
  }, [resetLocalState, advanceProgress, submitFinalEvaluation, challenges, currentChallengeIndex, sendText]);

  // ============================================================================
  // Check Handlers
  // ============================================================================

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedOption) return;

    const isPos = currentChallenge.type === 'identify_pos';
    const correct = isPos ? currentChallenge.correctPos : currentChallenge.correctRole;
    const isCorrect = selectedOption === correct;

    incrementAttempts();

    if (isCorrect) {
      setFeedback('Correct!');
      setFeedbackType('success');
      setShowExplanation(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        challengeType: currentChallenge.type,
      });
      sendText(`[ANSWER_CORRECT] Student correctly identified ${isPos ? 'part of speech' : 'grammatical role'} as "${selectedOption}". Congratulate briefly.`, { silent: true });
    } else {
      setFeedback(`Not quite. ${isPos ? 'Think about what this word does in the sentence.' : 'Consider how this word functions grammatically.'}`);
      setFeedbackType('error');

      if (currentAttempts + 1 >= 2) {
        setShowExplanation(true);
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          challengeType: currentChallenge.type,
        });
      }

      sendText(`[ANSWER_INCORRECT] Student chose "${selectedOption}" but correct is "${correct}". ${currentAttempts + 1 >= 2 ? 'Max attempts reached.' : 'Give a hint.'}`, { silent: true });
    }
  }, [currentChallenge, selectedOption, currentAttempts, incrementAttempts, recordResult, sendText]);

  const handleCheckLabelAll = useCallback(() => {
    if (!currentChallenge) return;

    const words = currentChallenge.words;
    let correctCount = 0;
    words.forEach(w => {
      if (labeledWords[w.id]?.toLowerCase() === w.partOfSpeech.toLowerCase()) {
        correctCount++;
      }
    });

    const accuracy = Math.round((correctCount / words.length) * 100);
    const isCorrect = accuracy >= 80; // 80% threshold

    setLabelAllChecked(true);
    setFeedback(`${correctCount} of ${words.length} correct (${accuracy}%)`);
    setFeedbackType(isCorrect ? 'success' : 'error');
    setShowExplanation(true);

    recordResult({
      challengeId: currentChallenge.id,
      correct: isCorrect,
      attempts: 1,
      score: accuracy,
      challengeType: currentChallenge.type,
    });

    sendText(`[LABEL_ALL_COMPLETE] Student labeled ${correctCount}/${words.length} words correctly (${accuracy}%). ${isCorrect ? 'Congratulate.' : 'Point out common POS patterns.'}`, { silent: true });
  }, [currentChallenge, labeledWords, recordResult, sendText]);

  const handleCheckParseStructure = useCallback(() => {
    if (!currentChallenge) return;

    if (parseStep === 1) {
      // Check word groupings
      const words = currentChallenge.words;
      let groupCorrect = 0;
      words.forEach(w => {
        const expected = w.grammaticalRole.toLowerCase().includes('subject') ? 'subject' : 'predicate';
        if (wordGroups[w.id] === expected) groupCorrect++;
      });

      const groupAccuracy = Math.round((groupCorrect / words.length) * 100);

      if (groupAccuracy >= 70) {
        setFeedback('Good grouping! Now classify the sentence type.');
        setFeedbackType('success');
        setParseStep(2);
      } else {
        setFeedback('Try again. The subject tells WHO or WHAT, the predicate tells what they DO.');
        setFeedbackType('error');
        incrementAttempts();

        if (currentAttempts + 1 >= 2) {
          // Reveal correct grouping and move on
          const correctGroups: Record<string, 'subject' | 'predicate'> = {};
          words.forEach(w => {
            correctGroups[w.id] = w.grammaticalRole.toLowerCase().includes('subject') ? 'subject' : 'predicate';
          });
          setWordGroups(correctGroups);
          setFeedback('Here are the correct groups. Now classify the sentence type.');
          setFeedbackType('success');
          setParseStep(2);
        }
      }
      return;
    }

    // Step 2: check sentence type
    const isCorrect = selectedOption.toLowerCase() === currentChallenge.sentenceType?.toLowerCase();

    incrementAttempts();

    if (isCorrect) {
      setFeedback('Correct!');
      setFeedbackType('success');
    } else {
      setFeedback(`The sentence is ${currentChallenge.sentenceType}.`);
      setFeedbackType('error');
    }

    setShowExplanation(true);

    // Compute overall score for this challenge
    const words = currentChallenge.words;
    let groupCorrect = 0;
    words.forEach(w => {
      const expected = w.grammaticalRole.toLowerCase().includes('subject') ? 'subject' : 'predicate';
      if (wordGroups[w.id] === expected) groupCorrect++;
    });
    const groupScore = (groupCorrect / words.length) * 50;
    const typeScore = isCorrect ? 50 : 0;
    const totalScore = Math.round(groupScore + typeScore);

    recordResult({
      challengeId: currentChallenge.id,
      correct: isCorrect && groupScore >= 35,
      attempts: currentAttempts + 1,
      score: totalScore,
      challengeType: currentChallenge.type,
    });

    sendText(`[PARSE_COMPLETE] Student ${isCorrect ? 'correctly' : 'incorrectly'} classified sentence as "${selectedOption}" (correct: "${currentChallenge.sentenceType}"). Score: ${totalScore}%.`, { silent: true });
  }, [currentChallenge, parseStep, wordGroups, selectedOption, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderSentenceDisplay = (highlightIndex?: number) => {
    if (!currentChallenge) return null;
    return (
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {currentChallenge.words.map((word, idx) => {
            const isHighlighted = highlightIndex !== undefined && idx === highlightIndex;
            return (
              <span
                key={word.id}
                className={`text-xl font-serif px-2 py-1 rounded transition-all ${
                  isHighlighted
                    ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40 font-bold'
                    : 'text-slate-100'
                }`}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedback) return null;
    return (
      <div className={`px-4 py-2 rounded-lg text-sm font-medium text-center ${
        feedbackType === 'success'
          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
          : 'bg-red-500/20 border border-red-500/40 text-red-300'
      }`}>
        {feedback}
      </div>
    );
  };

  const renderExplanation = () => {
    if (!showExplanation || !currentChallenge) return null;
    return (
      <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-3 space-y-1">
        <p className="text-xs text-violet-400 uppercase tracking-wide font-semibold">Explanation</p>
        <p className="text-sm text-slate-200">{currentChallenge.explanation}</p>
      </div>
    );
  };

  // ---- identify_pos / identify_role ----
  const renderIdentifyChallenge = () => {
    if (!currentChallenge) return null;

    const isPos = currentChallenge.type === 'identify_pos';
    const options = isPos ? currentChallenge.posOptions : currentChallenge.roleOptions;
    const targetWord = currentChallenge.words[currentChallenge.targetWordIndex ?? 0];

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-slate-400 text-sm">
            What is the <span className="text-amber-300 font-semibold">{isPos ? 'part of speech' : 'grammatical role'}</span> of
            the highlighted word <span className="font-bold text-amber-300">&ldquo;{targetWord?.text}&rdquo;</span>?
          </p>
        </div>

        {renderSentenceDisplay(currentChallenge.targetWordIndex ?? 0)}

        <div className="grid grid-cols-2 gap-2">
          {(options || []).map((option) => {
            const isSelected = selectedOption === option;
            const correct = isPos ? currentChallenge.correctPos : currentChallenge.correctRole;
            const showResult = showExplanation;
            const isCorrectOption = option === correct;

            return (
              <button
                key={option}
                onClick={() => !showExplanation && setSelectedOption(option)}
                disabled={showExplanation}
                className={`
                  text-left px-4 py-3 rounded-lg border transition-all text-sm
                  ${showResult && isSelected && isCorrectOption ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : ''}
                  ${showResult && isSelected && !isCorrectOption ? 'bg-red-500/20 border-red-500/40 text-red-300' : ''}
                  ${showResult && !isSelected && isCorrectOption ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : ''}
                  ${!showResult && isSelected ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : ''}
                  ${!showResult && !isSelected ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : ''}
                `}
              >
                {option}
              </button>
            );
          })}
        </div>

        {renderFeedback()}
        {renderExplanation()}

        <div className="flex justify-end">
          {!showExplanation ? (
            <Button
              variant="ghost"
              onClick={handleCheckIdentify}
              disabled={!selectedOption}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
            >
              Check Answer
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleNext}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ---- label_all ----
  const renderLabelAllChallenge = () => {
    if (!currentChallenge) return null;

    const words = currentChallenge.words;
    const allPOS = Array.from(new Set(words.map(w => w.partOfSpeech))).sort();
    const allLabeled = Object.keys(labeledWords).length === words.length;

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-slate-400 text-sm">
            Label the <span className="text-amber-300 font-semibold">part of speech</span> for each word.
            {!labelAllChecked && (
              <span className="text-slate-500"> Click a word, then select its POS.</span>
            )}
          </p>
        </div>

        {/* Words with labels */}
        <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5">
          <div className="flex flex-wrap gap-3 justify-center">
            {words.map((word, idx) => {
              const label = labeledWords[word.id];
              const isActive = idx === activeLabelIndex && !labelAllChecked;
              const isCorrect = labelAllChecked && label?.toLowerCase() === word.partOfSpeech.toLowerCase();
              const isWrong = labelAllChecked && label && label.toLowerCase() !== word.partOfSpeech.toLowerCase();

              return (
                <div
                  key={word.id}
                  onClick={() => !labelAllChecked && setActiveLabelIndex(idx)}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-all rounded-lg p-2 ${
                    isActive ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : ''
                  }`}
                >
                  <span className={`text-lg font-serif ${
                    isActive ? 'text-amber-300 font-bold' : 'text-slate-100'
                  }`}>
                    {word.text}
                  </span>
                  {label ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        labelAllChecked
                          ? isCorrect
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-500/20 border-red-500/40 text-red-300'
                          : getPosColor(label)
                      }`}
                    >
                      {label}
                      {isWrong && <span className="ml-1 text-[9px] opacity-70">({word.partOfSpeech})</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-slate-500">
                      ?
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* POS selector */}
        {!labelAllChecked && (
          <div className="flex flex-wrap gap-2 justify-center">
            {allPOS.map(pos => (
              <Button
                key={pos}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLabeledWords(prev => ({ ...prev, [words[activeLabelIndex].id]: pos }));
                  // Auto-advance to next unlabeled word
                  const nextUnlabeled = words.findIndex((w, i) => i > activeLabelIndex && !labeledWords[w.id]);
                  if (nextUnlabeled >= 0) {
                    setActiveLabelIndex(nextUnlabeled);
                  } else {
                    const firstUnlabeled = words.findIndex(w => !labeledWords[w.id] && w.id !== words[activeLabelIndex].id);
                    if (firstUnlabeled >= 0) setActiveLabelIndex(firstUnlabeled);
                  }
                }}
                className={`text-xs ${getPosColor(pos)}`}
              >
                {pos}
              </Button>
            ))}
          </div>
        )}

        {renderFeedback()}
        {renderExplanation()}

        <div className="flex justify-end">
          {!labelAllChecked ? (
            <Button
              variant="ghost"
              onClick={handleCheckLabelAll}
              disabled={!allLabeled}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
            >
              Check Labels
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleNext}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ---- parse_structure ----
  const renderParseStructureChallenge = () => {
    if (!currentChallenge) return null;

    const words = currentChallenge.words;

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-slate-400 text-sm">
            {parseStep === 1 ? (
              <>Group each word as <span className="text-blue-300 font-semibold">Subject</span> or <span className="text-emerald-300 font-semibold">Predicate</span>. Click words to toggle.</>
            ) : (
              <>Now classify the <span className="text-amber-300 font-semibold">sentence type</span>.</>
            )}
          </p>
        </div>

        {/* Words with subject/predicate grouping */}
        <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5">
          <div className="flex flex-wrap gap-2 justify-center">
            {words.map((word) => {
              const group = wordGroups[word.id];
              const canToggle = parseStep === 1 && !showExplanation;

              return (
                <button
                  key={word.id}
                  onClick={() => {
                    if (!canToggle) return;
                    setWordGroups(prev => {
                      const current = prev[word.id];
                      if (!current) return { ...prev, [word.id]: 'subject' };
                      if (current === 'subject') return { ...prev, [word.id]: 'predicate' };
                      const next = { ...prev };
                      delete next[word.id];
                      return next;
                    });
                  }}
                  disabled={!canToggle}
                  className={`px-3 py-2 rounded-lg border transition-all text-base font-serif ${
                    group === 'subject'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : group === 'predicate'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {word.text}
                  {group && (
                    <span className="ml-1 text-[9px] uppercase opacity-60">
                      {group === 'subject' ? 'S' : 'P'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
            <span><span className="text-blue-400">Blue</span> = Subject</span>
            <span><span className="text-emerald-400">Green</span> = Predicate</span>
            <span>Click to cycle: none &rarr; S &rarr; P &rarr; none</span>
          </div>
        </div>

        {/* Step 2: Sentence type classification */}
        {parseStep === 2 && (
          <div className="grid grid-cols-2 gap-2">
            {(currentChallenge.sentenceTypeOptions || []).map((option) => {
              const isSelected = selectedOption === option;
              const showResult = showExplanation;
              const isCorrectOption = option.toLowerCase() === currentChallenge.sentenceType?.toLowerCase();

              return (
                <button
                  key={option}
                  onClick={() => !showExplanation && setSelectedOption(option)}
                  disabled={showExplanation}
                  className={`
                    text-left px-4 py-3 rounded-lg border transition-all text-sm
                    ${showResult && isSelected && isCorrectOption ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : ''}
                    ${showResult && isSelected && !isCorrectOption ? 'bg-red-500/20 border-red-500/40 text-red-300' : ''}
                    ${showResult && !isSelected && isCorrectOption ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : ''}
                    ${!showResult && isSelected ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : ''}
                    ${!showResult && !isSelected ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : ''}
                  `}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {renderFeedback()}
        {renderExplanation()}

        <div className="flex justify-end">
          {!showExplanation ? (
            <Button
              variant="ghost"
              onClick={handleCheckParseStructure}
              disabled={
                parseStep === 1
                  ? Object.keys(wordGroups).length < words.length
                  : !selectedOption
              }
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
            >
              {parseStep === 1 ? 'Check Groups' : 'Check Type'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleNext}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const localOverallScore = challengeResults.length > 0
    ? Math.round(challengeResults.filter(r => r.correct).length / challengeResults.length * 100)
    : 0;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <p className="text-sm text-slate-400">{description}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                Grade {gradeLevel}
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs">
                {currentChallengeIndex + 1} of {challenges.length}
              </Badge>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentChallenge.type === 'identify_pos' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : currentChallenge.type === 'identify_role' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
              : currentChallenge.type === 'label_all' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {PHASE_TYPE_CONFIG[currentChallenge.type]?.label || currentChallenge.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase summary when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            heading="Analysis Complete!"
            celebrationMessage="You completed all sentence challenges!"
            className="mb-6"
          />
        )}

        {/* Challenge content */}
        {!allChallengesComplete && (
          <>
            {(currentChallenge.type === 'identify_pos' || currentChallenge.type === 'identify_role') && renderIdentifyChallenge()}
            {currentChallenge.type === 'label_all' && renderLabelAllChallenge()}
            {currentChallenge.type === 'parse_structure' && renderParseStructureChallenge()}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SentenceAnalyzer;
