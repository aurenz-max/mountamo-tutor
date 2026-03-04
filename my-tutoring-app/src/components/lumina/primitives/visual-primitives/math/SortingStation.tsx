'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SortingStationMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SortingObject {
  id: string;
  label: string;
  emoji: string;
  attributes: Record<string, string>;
}

export interface SortingCategory {
  label: string;
  rule: Record<string, string>;
}

export interface SortingStationChallenge {
  id: string;
  type: 'sort-by-one' | 'sort-by-attribute' | 'count-and-compare' | 'two-attributes' | 'odd-one-out' | 'tally-record';
  instruction: string;
  objects: SortingObject[];
  sortingAttribute?: string;
  categories?: SortingCategory[];
  oddOneOut?: string;
  oddOneOutReason?: string;
  comparisonQuestion?: string;
  correctComparison?: 'more' | 'fewer' | 'equal';
}

export interface SortingStationData {
  title: string;
  description?: string;
  challenges: SortingStationChallenge[];
  maxCategories: number;
  showCounts: boolean;
  showTallyChart: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SortingStationMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'sort-by-one':       { label: 'Sort by One',     icon: '\uD83C\uDFA8', accentColor: 'orange' },
  'sort-by-attribute': { label: 'Pick & Sort',     icon: '\uD83D\uDD0D', accentColor: 'purple' },
  'count-and-compare': { label: 'Count & Compare', icon: '\uD83D\uDCCA', accentColor: 'blue' },
  'two-attributes':    { label: 'Two Attributes',  icon: '\uD83D\uDD17', accentColor: 'emerald' },
  'odd-one-out':       { label: 'Odd One Out',     icon: '\uD83E\uDD14', accentColor: 'amber' },
  'tally-record':      { label: 'Tally Record',    icon: '\uD83D\uDCDD', accentColor: 'cyan' },
};

const BIN_COLORS = [
  { bg: 'bg-red-500/10', border: 'border-red-400/30', text: 'text-red-300', hover: 'hover:bg-red-500/20' },
  { bg: 'bg-blue-500/10', border: 'border-blue-400/30', text: 'text-blue-300', hover: 'hover:bg-blue-500/20' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300', hover: 'hover:bg-emerald-500/20' },
  { bg: 'bg-amber-500/10', border: 'border-amber-400/30', text: 'text-amber-300', hover: 'hover:bg-amber-500/20' },
];

// ============================================================================
// Helpers
// ============================================================================

function objectMatchesRule(obj: SortingObject, rule: Record<string, string>): boolean {
  return Object.entries(rule).every(([key, value]) => obj.attributes[key] === value);
}

// ============================================================================
// Props
// ============================================================================

interface SortingStationProps {
  data: SortingStationData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const SortingStation: React.FC<SortingStationProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxCategories = 3,
    showCounts = true,
    gradeBand = 'K',
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
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [binAssignments, setBinAssignments] = useState<Map<string, number>>(new Map());
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [selectedOddOne, setSelectedOddOne] = useState<string | null>(null);
  const [tallyCounts, setTallyCounts] = useState<Record<string, number>>({});
  const [comparisonAnswer, setComparisonAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // ─── Refs ──────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `sorting-station-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ─── Current challenge ─────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // ─── Derived categories for sort-by-attribute ──────────────────
  const derivedCategories = useMemo(() => {
    if (!currentChallenge) return [];
    if (currentChallenge.type === 'sort-by-attribute' && selectedAttribute) {
      const values = new Set(
        currentChallenge.objects
          .map(o => o.attributes[selectedAttribute])
          .filter(Boolean),
      );
      return Array.from(values).map(v => ({
        label: v.charAt(0).toUpperCase() + v.slice(1),
        rule: { [selectedAttribute]: v },
      }));
    }
    return currentChallenge.categories || [];
  }, [currentChallenge, selectedAttribute]);

  // ─── Unsorted objects ──────────────────────────────────────────
  const unsortedObjects = useMemo(() => {
    if (!currentChallenge) return [];
    return currentChallenge.objects.filter(obj => !binAssignments.has(obj.id));
  }, [currentChallenge, binAssignments]);

  // ─── Objects per bin ───────────────────────────────────────────
  const objectsInBins = useMemo(() => {
    if (!currentChallenge) return new Map<number, SortingObject[]>();
    const map = new Map<number, SortingObject[]>();
    for (const [objId, binIdx] of Array.from(binAssignments.entries())) {
      const obj = currentChallenge.objects.find(o => o.id === objId);
      if (obj) {
        if (!map.has(binIdx)) map.set(binIdx, []);
        map.get(binIdx)!.push(obj);
      }
    }
    return map;
  }, [currentChallenge, binAssignments]);

  // ─── Auto-sorted bins (for count-and-compare / tally-record) ──
  const autoSortedBins = useMemo(() => {
    if (!currentChallenge || !currentChallenge.categories) {
      return new Map<number, SortingObject[]>();
    }
    const map = new Map<number, SortingObject[]>();
    for (const obj of currentChallenge.objects) {
      const idx = currentChallenge.categories.findIndex(cat =>
        objectMatchesRule(obj, cat.rule),
      );
      if (idx >= 0) {
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(obj);
      }
    }
    return map;
  }, [currentChallenge]);

  // ─── Available attributes for sort-by-attribute chooser ────────
  const availableAttributes = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'sort-by-attribute') return [];
    const attrs = new Set<string>();
    for (const obj of currentChallenge.objects) {
      for (const key of Object.keys(obj.attributes)) attrs.add(key);
    }
    return Array.from(attrs);
  }, [currentChallenge]);

  // ─── Evaluation ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SortingStationMetrics>({
    primitiveType: 'sorting-station',
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
    sortingAttribute: currentChallenge?.sortingAttribute ?? selectedAttribute ?? '',
    categories: derivedCategories.map(c => c.label),
    objectsSorted: binAssignments.size,
    totalObjects: currentChallenge?.objects.length ?? 0,
    attemptNumber: currentAttempts + 1,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    gradeBand,
  }), [
    currentChallenge, selectedAttribute, derivedCategories, binAssignments.size,
    currentAttempts, currentChallengeIndex, challenges.length, gradeBand,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'sorting-station',
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
      `[ACTIVITY_START] This is a Sorting Station activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges total. First challenge: "${currentChallenge?.instruction}" (${currentChallenge?.type}). `
      + `Objects: ${currentChallenge?.objects.map(o => `${o.emoji} ${o.label}`).join(', ')}. `
      + `Introduce warmly: "Look at all these things! Let's sort them together."`,
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, gradeBand, sendText]);

  // ─── Interaction handlers ──────────────────────────────────────

  const handleObjectClick = useCallback((objId: string) => {
    if (hasSubmittedEvaluation || !currentChallenge) return;
    const type = currentChallenge.type;

    if (type === 'sort-by-one' || type === 'sort-by-attribute') {
      setSelectedObjectId(prev => prev === objId ? null : objId);
    } else if (type === 'two-attributes') {
      setSelectedObjects(prev => {
        const next = new Set(prev);
        if (next.has(objId)) next.delete(objId);
        else next.add(objId);
        return next;
      });
    } else if (type === 'odd-one-out') {
      setSelectedOddOne(prev => prev === objId ? null : objId);
    }
  }, [hasSubmittedEvaluation, currentChallenge]);

  const handleBinClick = useCallback((binIndex: number) => {
    if (hasSubmittedEvaluation || !selectedObjectId) return;
    setBinAssignments(prev => {
      const next = new Map(prev);
      next.set(selectedObjectId, binIndex);
      return next;
    });
    setSelectedObjectId(null);
  }, [hasSubmittedEvaluation, selectedObjectId]);

  const handleRemoveFromBin = useCallback((objId: string) => {
    if (hasSubmittedEvaluation) return;
    setBinAssignments(prev => {
      const next = new Map(prev);
      next.delete(objId);
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  const handleAttributeSelect = useCallback((attr: string) => {
    setSelectedAttribute(attr);
    setBinAssignments(new Map());
    setSelectedObjectId(null);
    if (isConnected) {
      sendText(
        `[ATTRIBUTE_CHOSEN] Student chose to sort by "${attr}". Encourage: "Great choice! Let's sort by ${attr}."`,
        { silent: true },
      );
    }
  }, [isConnected, sendText]);

  // ─── Check answer ──────────────────────────────────────────────

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const type = currentChallenge.type;

    if (type === 'sort-by-one' || type === 'sort-by-attribute') {
      const cats = derivedCategories;
      if (cats.length === 0) return;

      let correctCount = 0;
      let totalPlaced = 0;

      for (const [objId, binIdx] of Array.from(binAssignments.entries())) {
        totalPlaced++;
        const obj = currentChallenge.objects.find(o => o.id === objId);
        if (obj && binIdx < cats.length && objectMatchesRule(obj, cats[binIdx].rule)) {
          correctCount++;
        }
      }

      const allPlaced = totalPlaced === currentChallenge.objects.length;
      const allCorrect = allPlaced && correctCount === totalPlaced;

      if (allCorrect) {
        setFeedback('Perfect sorting!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
        sendText(
          `[ANSWER_CORRECT] Student sorted all ${totalPlaced} objects correctly by ${currentChallenge.sortingAttribute || selectedAttribute}. Celebrate!`,
          { silent: true },
        );
      } else if (!allPlaced) {
        setFeedback(`Place all objects into bins first! (${totalPlaced}/${currentChallenge.objects.length} placed)`);
        setFeedbackType('error');
        sendText(
          `[INCOMPLETE] Student only placed ${totalPlaced} of ${currentChallenge.objects.length} objects. Encourage: "Keep going! There are more to sort."`,
          { silent: true },
        );
      } else {
        const wrongCount = totalPlaced - correctCount;
        setFeedback(`${wrongCount} object${wrongCount > 1 ? 's are' : ' is'} in the wrong bin. Try again!`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] ${wrongCount} of ${totalPlaced} objects misplaced. Attempt ${currentAttempts + 1}. Give a hint about the sorting rule.`,
          { silent: true },
        );
      }
    }

    else if (type === 'count-and-compare') {
      if (!comparisonAnswer) return;
      // Compute correct answer from actual bin counts rather than trusting Gemini
      const cats = currentChallenge.categories || [];
      const binCounts = cats.map((cat, idx) => ({
        label: cat.label,
        count: (autoSortedBins.get(idx) || []).length,
      }));
      const allEqual = binCounts.length > 0 && binCounts.every(b => b.count === binCounts[0].count);
      const question = (currentChallenge.comparisonQuestion || '').toLowerCase();
      const asksFewer = /fewer|fewest|less|least|smallest/.test(question);

      let correctLabel: string;
      if (allEqual) {
        correctLabel = '__equal__';
      } else if (asksFewer) {
        const min = Math.min(...binCounts.map(b => b.count));
        correctLabel = binCounts.find(b => b.count === min)!.label;
      } else {
        // Default: question asks about "more"
        const max = Math.max(...binCounts.map(b => b.count));
        correctLabel = binCounts.find(b => b.count === max)!.label;
      }

      const correct = comparisonAnswer === correctLabel;
      if (correct) {
        setFeedback('Correct! Great comparing!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
        sendText(
          `[ANSWER_CORRECT] Student correctly picked "${comparisonAnswer}". Celebrate!`,
          { silent: true },
        );
      } else {
        setFeedback('Not quite. Count each group and try again!');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student chose "${comparisonAnswer}" but correct is "${correctLabel}". Attempt ${currentAttempts + 1}. Hint: count each group carefully.`,
          { silent: true },
        );
      }
    }

    else if (type === 'two-attributes') {
      const cats = currentChallenge.categories || [];
      if (cats.length === 0) return;
      const rule = cats[0].rule;
      const correctIds = new Set(
        currentChallenge.objects.filter(o => objectMatchesRule(o, rule)).map(o => o.id),
      );
      const selectedArr = Array.from(selectedObjects);
      const allCorrect = selectedArr.length === correctIds.size
        && selectedArr.every(id => correctIds.has(id));

      if (allCorrect) {
        setFeedback('You found them all!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
        sendText(
          `[ANSWER_CORRECT] Student correctly identified all objects matching ${JSON.stringify(rule)}. Celebrate!`,
          { silent: true },
        );
      } else {
        const missed = Array.from(correctIds).filter(id => !selectedObjects.has(id)).length;
        const extra = selectedArr.filter(id => !correctIds.has(id)).length;
        let msg = 'Not quite.';
        if (missed > 0) msg += ` You missed ${missed}.`;
        if (extra > 0) msg += ` ${extra} ${extra === 1 ? "doesn't" : "don't"} belong.`;
        setFeedback(msg);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Missed ${missed}, selected ${extra} extras. Attempt ${currentAttempts + 1}. Give a two-attribute hint.`,
          { silent: true },
        );
      }
    }

    else if (type === 'odd-one-out') {
      if (!selectedOddOne) return;
      const correct = selectedOddOne === currentChallenge.oddOneOut;
      if (correct) {
        setFeedback(`Yes! ${currentChallenge.oddOneOutReason || "It doesn't belong!"}`);
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
        sendText(
          `[ANSWER_CORRECT] Student correctly identified the odd one out. Reason: ${currentChallenge.oddOneOutReason}. Ask: "How did you know?"`,
          { silent: true },
        );
      } else {
        setFeedback('That one fits in! Look for the one that is different.');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student chose wrong object for odd-one-out. Attempt ${currentAttempts + 1}. Hint: "What do most of these have in common?"`,
          { silent: true },
        );
      }
    }

    else if (type === 'tally-record') {
      const cats = currentChallenge.categories || [];
      let allCorrect = true;
      for (let i = 0; i < cats.length; i++) {
        const expected = (autoSortedBins.get(i) || []).length;
        const entered = tallyCounts[cats[i].label] ?? 0;
        if (entered !== expected) {
          allCorrect = false;
          break;
        }
      }

      if (allCorrect) {
        setFeedback('Perfect tallies!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
        sendText(`[ANSWER_CORRECT] Student recorded all tallies correctly. Celebrate!`, { silent: true });
      } else {
        setFeedback('Some counts are off. Count each group carefully!');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Tally counts don't match. Attempt ${currentAttempts + 1}. Hint: "Point to each object as you count."`,
          { silent: true },
        );
      }
    }
  }, [
    currentChallenge, derivedCategories, binAssignments, selectedAttribute,
    comparisonAnswer, selectedObjects, selectedOddOne, tallyCounts,
    autoSortedBins, currentAttempts, incrementAttempts, recordResult, sendText,
  ]);

  // ─── Advance ───────────────────────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their sorting skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const sortingCorrect = challengeResults.filter(r => r.correct).length;
        const score = Math.round((sortingCorrect / challenges.length) * 100);

        const metrics: SortingStationMetrics = {
          type: 'sorting-station',
          sortingAccuracy: score,
          categoriesUsed: maxCategories,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          sortingCorrect === challenges.length,
          score,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset domain state
    setFeedback('');
    setFeedbackType('');
    setSelectedObjectId(null);
    setBinAssignments(new Map());
    setSelectedAttribute(null);
    setSelectedObjects(new Set());
    setSelectedOddOne(null);
    setTallyCounts({});
    setComparisonAnswer(null);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, maxCategories, currentChallengeIndex,
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
      (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // ─── Is current challenge answered ─────────────────────────────
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  // ─── Can check answer ──────────────────────────────────────────
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return false;
    switch (currentChallenge.type) {
      case 'sort-by-one': return binAssignments.size > 0;
      case 'sort-by-attribute': return selectedAttribute !== null && binAssignments.size > 0;
      case 'count-and-compare': return comparisonAnswer !== null;
      case 'two-attributes': return selectedObjects.size > 0;
      case 'odd-one-out': return selectedOddOne !== null;
      case 'tally-record': return Object.keys(tallyCounts).length > 0;
      default: return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, binAssignments.size, selectedAttribute, comparisonAnswer, selectedObjects.size, selectedOddOne, tallyCounts]);

  // ─── Render helpers ────────────────────────────────────────────

  const renderSortingUI = () => {
    if (!currentChallenge) return null;
    const categories = currentChallenge.type === 'sort-by-attribute'
      ? derivedCategories
      : (currentChallenge.categories || []);

    return (
      <>
        {/* Attribute selector for sort-by-attribute */}
        {currentChallenge.type === 'sort-by-attribute' && !selectedAttribute && (
          <div className="space-y-2">
            <p className="text-slate-300 text-sm text-center">How do you want to sort these objects?</p>
            <div className="flex justify-center gap-2">
              {availableAttributes.map(attr => (
                <Button
                  key={attr}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 capitalize"
                  onClick={() => handleAttributeSelect(attr)}
                >
                  By {attr}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Objects pile and bins */}
        {(currentChallenge.type === 'sort-by-one' || selectedAttribute) && (
          <>
            {/* Unsorted objects */}
            <div className="bg-slate-800/20 rounded-xl p-4 border border-white/5">
              <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Unsorted Objects</p>
              {unsortedObjects.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  {unsortedObjects.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => handleObjectClick(obj.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 ${
                        selectedObjectId === obj.id
                          ? 'bg-orange-500/20 border-2 border-orange-400 scale-110 shadow-lg shadow-orange-500/20'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105'
                      }`}
                    >
                      <span className="text-2xl">{obj.emoji}</span>
                      <span className="text-[11px] text-slate-400 leading-tight text-center break-words max-w-[80px]">{obj.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center italic">All objects sorted!</p>
              )}
              {selectedObjectId && (
                <p className="text-orange-300 text-xs text-center mt-2 animate-pulse">
                  Click a bin below to place it
                </p>
              )}
            </div>

            {/* Sorting bins */}
            <div className={`grid gap-3 ${
              categories.length <= 2 ? 'grid-cols-2'
              : categories.length === 3 ? 'grid-cols-3'
              : 'grid-cols-4'
            }`}>
              {categories.map((cat, idx) => {
                const color = BIN_COLORS[idx % BIN_COLORS.length];
                const itemsInBin = objectsInBins.get(idx) || [];
                return (
                  <button
                    key={cat.label}
                    onClick={() => handleBinClick(idx)}
                    disabled={!selectedObjectId}
                    className={`rounded-xl p-3 border-2 border-dashed transition-all duration-150 min-h-[100px] text-left ${color.bg} ${color.border} ${
                      selectedObjectId ? `${color.hover} cursor-pointer` : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
                      {showCounts && (
                        <Badge className={`${color.bg} ${color.border} ${color.text} text-xs`}>
                          {itemsInBin.length}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center min-h-[32px]">
                      {itemsInBin.map(obj => (
                        <button
                          key={obj.id}
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromBin(obj.id); }}
                          className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all duration-150 cursor-pointer"
                        >
                          <span className="text-lg">{obj.emoji}</span>
                          <span className="text-[9px] text-slate-400 leading-tight text-center break-words max-w-[72px]">{obj.label}</span>
                        </button>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  };

  const renderPreSortedBins = (cats: SortingCategory[]) => (
    <div className={`grid gap-3 ${cats.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {cats.map((cat, idx) => {
        const color = BIN_COLORS[idx % BIN_COLORS.length];
        const items = autoSortedBins.get(idx) || [];
        return (
          <div key={cat.label} className={`rounded-xl p-3 border ${color.bg} ${color.border}`}>
            <div className="mb-2">
              <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {items.map(obj => (
                <div key={obj.id} className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 bg-white/5 border border-white/10">
                  <span className="text-lg">{obj.emoji}</span>
                  <span className="text-[9px] text-slate-400 leading-tight text-center break-words max-w-[72px]">{obj.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderChallengeUI = () => {
    if (!currentChallenge || allChallengesComplete) return null;
    const type = currentChallenge.type;

    // Sort-by-one / Sort-by-attribute
    if (type === 'sort-by-one' || type === 'sort-by-attribute') {
      return renderSortingUI();
    }

    // Count-and-compare
    if (type === 'count-and-compare') {
      const cats = currentChallenge.categories || [];
      // Build answer options from category labels + an "equal" option
      const answerOptions = [
        ...cats.map(cat => ({ value: cat.label, display: cat.label })),
        { value: '__equal__', display: "They're equal!" },
      ];
      return (
        <>
          {renderPreSortedBins(cats)}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 text-center space-y-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.comparisonQuestion}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {answerOptions.map(opt => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  className={`${
                    comparisonAnswer === opt.value
                      ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                      : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => setComparisonAnswer(opt.value)}
                >
                  {opt.display}
                </Button>
              ))}
            </div>
          </div>
        </>
      );
    }

    // Two-attributes
    if (type === 'two-attributes') {
      return (
        <div className="bg-slate-800/20 rounded-xl p-4 border border-white/5">
          <p className="text-slate-400 text-xs mb-3 text-center">Tap all objects that match</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {currentChallenge.objects.map(obj => (
              <button
                key={obj.id}
                onClick={() => handleObjectClick(obj.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 ${
                  selectedObjects.has(obj.id)
                    ? 'bg-emerald-500/20 border-2 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/20'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105'
                }`}
              >
                <span className="text-2xl">{obj.emoji}</span>
                <span className="text-[11px] text-slate-300 leading-tight text-center break-words max-w-[80px]">{obj.label}</span>
                <div className="flex flex-wrap gap-0.5 justify-center max-w-[80px]">
                  {Object.entries(obj.attributes).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-[9px] leading-tight px-1 rounded bg-white/5 text-slate-500"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {selectedObjects.size > 0 && (
            <p className="text-emerald-300 text-xs text-center mt-2">
              {selectedObjects.size} selected
            </p>
          )}
        </div>
      );
    }

    // Odd-one-out
    if (type === 'odd-one-out') {
      return (
        <div className="bg-slate-800/20 rounded-xl p-4 border border-white/5">
          <p className="text-slate-400 text-xs mb-3 text-center">
            Tap the one that doesn&apos;t belong
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {currentChallenge.objects.map(obj => (
              <button
                key={obj.id}
                onClick={() => handleObjectClick(obj.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 ${
                  selectedOddOne === obj.id
                    ? 'bg-amber-500/20 border-2 border-amber-400 scale-110 shadow-lg shadow-amber-500/20'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105'
                }`}
              >
                <span className="text-2xl">{obj.emoji}</span>
                <span className="text-[11px] text-slate-400 leading-tight text-center break-words max-w-[80px]">{obj.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Tally-record
    if (type === 'tally-record') {
      const cats = currentChallenge.categories || [];
      return (
        <>
          {renderPreSortedBins(cats)}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 space-y-3">
            <p className="text-slate-300 text-sm text-center font-medium">
              Record the count for each group:
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {cats.map((cat, idx) => {
                const color = BIN_COLORS[idx % BIN_COLORS.length];
                const count = tallyCounts[cat.label] ?? 0;
                return (
                  <div key={cat.label} className="flex flex-col items-center gap-1.5">
                    <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
                    <div className="flex items-center gap-0">
                      <button
                        onClick={() =>
                          setTallyCounts(prev => ({
                            ...prev,
                            [cat.label]: Math.max((prev[cat.label] ?? 0) - 1, 0),
                          }))
                        }
                        disabled={count <= 0}
                        className={`w-9 h-10 rounded-l-lg border border-white/20 flex items-center justify-center text-lg font-bold transition-colors ${
                          count <= 0
                            ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 active:bg-white/15'
                        }`}
                      >
                        &minus;
                      </button>
                      <div className={`w-12 h-10 flex items-center justify-center border-y border-white/20 text-lg font-bold tabular-nums ${color.text} bg-slate-800/60`}>
                        {count}
                      </div>
                      <button
                        onClick={() =>
                          setTallyCounts(prev => ({
                            ...prev,
                            [cat.label]: Math.min((prev[cat.label] ?? 0) + 1, 20),
                          }))
                        }
                        disabled={count >= 20}
                        className={`w-9 h-10 rounded-r-lg border border-white/20 flex items-center justify-center text-lg font-bold transition-colors ${
                          count >= 20
                            ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 active:bg-white/15'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  // ─── Main render ───────────────────────────────────────────────

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
            {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
          </Badge>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge progress badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasType = challenges.some(c => c.type === type);
              if (!hasType) return null;
              const isActive = currentChallenge?.type === type;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    isActive
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

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Challenge-specific UI */}
        {renderChallengeUI()}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400'
            : feedbackType === 'error' ? 'text-red-400'
            : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={!canCheck || hasSubmittedEvaluation}
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
                <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Sorting Complete!"
            celebrationMessage={`You completed all ${challenges.length} sorting challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default SortingStation;
