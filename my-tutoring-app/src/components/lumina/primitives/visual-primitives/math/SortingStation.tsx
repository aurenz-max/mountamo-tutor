'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaDropZone,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SortingStationMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** Picture-primary bin icon for the pre-reader (K) render — a single emoji that stands for
   *  the whole group (e.g. Need → 🏠, Want → 🎁). Non-load-bearing: sort correctness is by
   *  `rule`, never by the icon. Missing → the K render falls back to a color-coded circle. */
  bucketEmoji?: string;
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
  /**
   * Worked-example fade (easy tier, sort-family modes): the id of ONE object pre-placed in
   * its correct bin as a model. It is EXCLUDED from the gradeable set (not counted toward
   * "all placed", not gradeable, not removable) so it never doubles as a freebie answer.
   */
  modelItemId?: string;
  /** Bin index the model item is pre-placed into (its correct category). */
  modelItemBin?: number;
}

export interface SortingStationData {
  title: string;
  description?: string;
  challenges: SortingStationChallenge[];
  maxCategories: number;
  showCounts: boolean;
  showTallyChart: boolean;
  gradeBand: 'K' | '1';
  /** Within-mode support tier ('easy' = max scaffolding). Set when a tier was applied;
   *  the tutor reads it to keep its reveal level consistent with the on-screen scaffold. */
  supportTier?: 'easy' | 'medium' | 'hard';

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
  'sort-by-one':       { label: 'Sort by One',     icon: '🎨', accentColor: 'orange' },
  'sort-by-attribute': { label: 'Pick & Sort',     icon: '🔍', accentColor: 'purple' },
  'count-and-compare': { label: 'Count & Compare', icon: '📊', accentColor: 'blue' },
  'two-attributes':    { label: 'Two Attributes',  icon: '🔗', accentColor: 'emerald' },
  'odd-one-out':       { label: 'Odd One Out',     icon: '🤔', accentColor: 'amber' },
  'tally-record':      { label: 'Tally Record',    icon: '📝', accentColor: 'cyan' },
};

const BIN_COLORS = [
  { bg: 'bg-red-500/10', border: 'border-red-400/30', text: 'text-red-300', hover: 'hover:bg-red-500/20' },
  { bg: 'bg-blue-500/10', border: 'border-blue-400/30', text: 'text-blue-300', hover: 'hover:bg-blue-500/20' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300', hover: 'hover:bg-emerald-500/20' },
  { bg: 'bg-amber-500/10', border: 'border-amber-400/30', text: 'text-amber-300', hover: 'hover:bg-amber-500/20' },
];

/** Guaranteed picture-primary bin icon for the pre-reader (K) render when the generator did
 *  not supply a `bucketEmoji` — a color-coded circle aligned to BIN_COLORS order
 *  (red / blue / emerald→green / amber→yellow). Ensures K bins are NEVER text-only. */
const FALLBACK_BIN_EMOJI = ['🔴', '🔵', '🟢', '🟡'];

// ============================================================================
// Helpers
// ============================================================================

function objectMatchesRule(obj: SortingObject, rule: Record<string, string>): boolean {
  return Object.entries(rule).every(([key, value]) => obj.attributes[key] === value);
}

/** Partial credit: 1st try = 100%, 2nd = 75%, 3rd = 50%, 4th+ = 25%. */
function attemptScore(attempts: number): number {
  if (attempts <= 1) return 100;
  if (attempts === 2) return 75;
  if (attempts === 3) return 50;
  return 25;
}

/**
 * A count-and-compare question may reference only a SUBSET of the on-screen groups —
 * e.g. "Are there more red apples or yellow bananas?" while a third Green group is also
 * shown (hard tier uses 3 groups). Return the categories the question explicitly names so
 * scoring and answer options stay aligned with what was asked. If fewer than 2 are named,
 * it's a global question ("which group has the most?") — return ALL categories.
 * Returned references come from `cats`, so callers can use `cats.indexOf()` to map back.
 */
function comparedCategories(
  cats: SortingCategory[],
  comparisonQuestion: string | undefined,
): SortingCategory[] {
  const q = (comparisonQuestion || '').toLowerCase();
  const named = cats.filter(c => c.label && q.includes(c.label.toLowerCase()));
  return named.length >= 2 ? named : cats;
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
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Pre-reader (Kindergarten) presentation gate: at K the student cannot read bin labels,
  // instructions, counters, or quantitative feedback prose — the render goes picture-primary
  // and adult chrome is hidden (reader-fit band contract). Grade 1 keeps the full chrome.
  const isK = gradeBand === 'K';

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
  const [countComparePhase, setCountComparePhase] = useState<'count' | 'compare'>('count');
  const [enteredBinCounts, setEnteredBinCounts] = useState<Record<string, number>>({});
  const [tallyRecordPhase, setTallyRecordPhase] = useState<'sort' | 'tally'>('sort');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [binFlash, setBinFlash] = useState<Map<number, boolean> | null>(null);
  const binFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (binFlashTimer.current) clearTimeout(binFlashTimer.current);
    },
    []
  );

  // ─── Refs ──────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `sorting-station-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ─── Current challenge ─────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // ─── Worked-example model item (easy tier, sort-family) ────────
  // Pre-place the model object in its correct bin so the student sees ONE done for them.
  // It is excluded from the gradeable set everywhere below (denominator, grading loop,
  // removal) so it can never double as a freebie answer.
  const modelItemId = currentChallenge?.modelItemId;
  useEffect(() => {
    if (!currentChallenge?.modelItemId || currentChallenge.modelItemBin == null) return;
    setBinAssignments(prev => {
      if (prev.has(currentChallenge.modelItemId!)) return prev;
      const next = new Map(prev);
      next.set(currentChallenge.modelItemId!, currentChallenge.modelItemBin!);
      return next;
    });
    // Re-run when the active challenge changes (advance resets binAssignments to empty).
  }, [currentChallenge?.id, currentChallenge?.modelItemId, currentChallenge?.modelItemBin]);

  // ─── Derived categories for sort-by-attribute ──────────────────
  const derivedCategories = useMemo((): SortingCategory[] => {
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
  // Only offer an axis the student can actually finish a clean sort on: EVERY object must
  // carry a value for it (else some object has no valid bin), AND there must be ≥2 distinct
  // values (else it's one group, not a sort). This hides dead/half-populated axes so the
  // chooser shows only choices that form valid groups — and lets the generator author just
  // the two clean attributes it needs instead of padding objects across four.
  const availableAttributes = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'sort-by-attribute') return [];
    const objects = currentChallenge.objects;
    if (objects.length === 0) return [];
    const keys = new Set<string>();
    for (const obj of objects) for (const key of Object.keys(obj.attributes)) keys.add(key);
    return Array.from(keys).filter(key => {
      const values = objects.map(o => o.attributes[key]).filter(Boolean);
      if (values.length !== objects.length) return false; // some object lacks this attribute
      return new Set(values).size >= 2;                    // needs ≥2 groups to be a real sort
    });
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

  // ─── Tutor reveal policy (keeps the tutor consistent with the on-screen scaffold) ──
  // easy → tutor may name the sorting rule / strategy; medium → nudge execution only;
  // hard → must NOT name the category or which object — ask what attribute differs.
  // odd-one-out is a RECOGNITION mode: the "odd" object/reason IS the answer, so the tutor
  // must never name it at ANY tier (the on-screen UI already never reveals oddOneOutReason).
  const tutorRevealClause = useCallback((type: string | undefined): string => {
    const tier = supportTier;
    if (!tier) return '';
    if (type === 'odd-one-out') {
      return ` SUPPORT TIER ${tier}: NEVER reveal which object is the odd one or why — that is the answer. ${tier === 'easy' ? 'You may ask what most of them have in common.' : tier === 'hard' ? 'Only ask the student to compare attributes closely; give no hints toward the answer.' : 'Nudge them to look at shared attributes, without naming the odd one.'}`;
    }
    if (tier === 'easy') {
      return ` SUPPORT TIER easy: you MAY name the sorting rule/strategy and walk one example, but never give the final answer.`;
    }
    if (tier === 'hard') {
      return ` SUPPORT TIER hard: do NOT name the category, attribute, or rule the student must find — ask what attribute they see differs, and never reveal the answer.`;
    }
    return ` SUPPORT TIER medium: the rule is on screen — nudge the student's execution only, do not name the answer.`;
  }, [supportTier]);

  // ─── AI Tutoring ───────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? '',
    // Forwarded so the catalog aiDirectives beat's {{instruction}} resolves at runtime — a
    // generator-only key would render "(not set)". This IS the load-bearing task text the
    // tutor reads aloud to the pre-reader (STIMULUS).
    instruction: currentChallenge?.instruction ?? '',
    sortingAttribute: currentChallenge?.sortingAttribute ?? selectedAttribute ?? '',
    categories: derivedCategories.map(c => c.label),
    objectsSorted: binAssignments.size,
    totalObjects: currentChallenge?.objects.length ?? 0,
    attemptNumber: currentAttempts + 1,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    gradeBand,
    ...(supportTier ? { supportTier } : {}),
  }), [
    currentChallenge, selectedAttribute, derivedCategories, binAssignments.size,
    currentAttempts, currentChallengeIndex, challenges.length, gradeBand, supportTier,
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
      + `Introduce warmly: "Look at all these things! Let's sort them together."`
      + tutorRevealClause(currentChallenge?.type),
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, gradeBand, sendText, tutorRevealClause]);

  // ─── Interaction handlers ──────────────────────────────────────

  const handleObjectClick = useCallback((objId: string) => {
    if (hasSubmittedEvaluation || !currentChallenge) return;
    SoundManager.select();
    const type = currentChallenge.type;

    if (type === 'sort-by-one' || type === 'sort-by-attribute' || (type === 'tally-record' && tallyRecordPhase === 'sort')) {
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
  }, [hasSubmittedEvaluation, currentChallenge, tallyRecordPhase]);

  const handleBinClick = useCallback((binIndex: number) => {
    if (hasSubmittedEvaluation || !selectedObjectId) return;
    SoundManager.snap();
    setBinAssignments(prev => {
      const next = new Map(prev);
      next.set(selectedObjectId, binIndex);
      return next;
    });
    setSelectedObjectId(null);
  }, [hasSubmittedEvaluation, selectedObjectId]);

  const handleRemoveFromBin = useCallback((objId: string) => {
    if (hasSubmittedEvaluation) return;
    if (objId === modelItemId) return; // worked-example model item is locked, not removable
    setBinAssignments(prev => {
      const next = new Map(prev);
      next.delete(objId);
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, modelItemId]);

  const handleAttributeSelect = useCallback((attr: string) => {
    SoundManager.select();
    setSelectedAttribute(attr);
    setBinAssignments(new Map());
    setSelectedObjectId(null);
    setBinFlash(null);
    if (binFlashTimer.current) clearTimeout(binFlashTimer.current);
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
        if (objId === modelItemId) continue; // model item is a freebie — never graded
        totalPlaced++;
        const obj = currentChallenge.objects.find(o => o.id === objId);
        if (obj && binIdx < cats.length && objectMatchesRule(obj, cats[binIdx].rule)) {
          correctCount++;
        }
      }

      const gradeableTotal = currentChallenge.objects.length - (modelItemId ? 1 : 0);
      const allPlaced = totalPlaced === gradeableTotal;
      const allCorrect = allPlaced && correctCount === totalPlaced;

      if (allPlaced) {
        const nextFlash = new Map<number, boolean>();
        cats.forEach((cat, idx) => {
          const placedIds = Array.from(binAssignments.entries())
            .filter(([objId, binIdx]) => objId !== modelItemId && binIdx === idx)
            .map(([objId]) => objId);
          const expectedIds = currentChallenge.objects
            .filter((obj) => obj.id !== modelItemId && objectMatchesRule(obj, cat.rule))
            .map((obj) => obj.id);
          nextFlash.set(
            idx,
            placedIds.length === expectedIds.length && placedIds.every((id) => expectedIds.includes(id)),
          );
        });
        if (binFlashTimer.current) clearTimeout(binFlashTimer.current);
        setBinFlash(nextFlash);
        binFlashTimer.current = setTimeout(() => setBinFlash(null), 900);
      }

      if (allCorrect) {
        SoundManager.playCorrect();
        setFeedback('Perfect sorting!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: attemptScore(currentAttempts + 1) });
        sendText(
          `[ANSWER_CORRECT] Student sorted all ${totalPlaced} objects correctly by ${currentChallenge.sortingAttribute || selectedAttribute}. Celebrate!`,
          { silent: true },
        );
      } else if (!allPlaced) {
        SoundManager.invalid();
        setFeedback(`Place all objects into bins first! (${totalPlaced}/${gradeableTotal} placed)`);
        setFeedbackType('error');
        sendText(
          `[INCOMPLETE] Student only placed ${totalPlaced} of ${gradeableTotal} objects. Encourage: "Keep going! There are more to sort."`,
          { silent: true },
        );
      } else {
        const wrongCount = totalPlaced - correctCount;
        const attempt = currentAttempts + 1;
        SoundManager.playIncorrect();
        setFeedback(`${wrongCount} object${wrongCount > 1 ? 's are' : ' is'} in the wrong bin. Try again!`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] ${wrongCount} of ${totalPlaced} objects misplaced. `
          + `Attempt ${attempt}. ${attempt >= 3 ? `Very specific: "Look at each object's ${currentChallenge.sortingAttribute || selectedAttribute || 'attribute'} — does it match the bin name?"` : attempt >= 2 ? `Hint: "Check each bin — do all the objects in it share the same ${currentChallenge.sortingAttribute || selectedAttribute || 'attribute'}?"` : 'Give a hint about the sorting rule.'}`
          + tutorRevealClause(currentChallenge.type),
          { silent: true },
        );
      }
    }

    else if (type === 'count-and-compare') {
      const cats = currentChallenge.categories || [];
      const binCounts = cats.map((cat, idx) => ({
        label: cat.label,
        count: (autoSortedBins.get(idx) || []).length,
      }));

      // ── Phase 1: Count each bin ──
      if (countComparePhase === 'count') {
        let allCountsCorrect = true;
        for (let i = 0; i < cats.length; i++) {
          const expected = binCounts[i].count;
          const entered = enteredBinCounts[cats[i].label] ?? -1;
          if (entered !== expected) {
            allCountsCorrect = false;
            break;
          }
        }

        if (allCountsCorrect) {
          SoundManager.playCorrect();
          setFeedback('Great counting! Now answer the question.');
          setFeedbackType('success');
          setCountComparePhase('compare');
          sendText(
            `[COUNTS_CORRECT] Student correctly counted all bins: ${binCounts.map(b => `${b.label}=${b.count}`).join(', ')}. `
            + `Now transitioning to comparison question: "${currentChallenge.comparisonQuestion}". Say: "Nice counting! Now, look at those numbers..."`,
            { silent: true },
          );
        } else {
          const attempt = currentAttempts + 1;
          const wrongBins = cats.filter((cat, i) => (enteredBinCounts[cat.label] ?? -1) !== binCounts[i].count);
          SoundManager.playIncorrect();
          setFeedback(`Some counts aren't right. Try counting ${wrongBins.map(c => c.label).join(' and ')} again!`);
          setFeedbackType('error');
          sendText(
            `[ANSWER_INCORRECT] Student miscounted bins: ${wrongBins.map(c => `${c.label} (entered ${enteredBinCounts[c.label] ?? '?'}, actual ${binCounts.find(b => b.label === c.label)?.count})`).join(', ')}. `
            + `Attempt ${attempt}. ${attempt >= 3 ? 'Give a very specific hint: "Point to each object one at a time as you count."' : attempt >= 2 ? 'Give a hint: "Try touching each object as you count it."' : 'Encourage: "Count carefully — point to each one!"'}`,
            { silent: true },
          );
        }
        return; // Don't fall through to advance logic
      }

      // ── Phase 2: Compare ──
      if (!comparisonAnswer) return;
      // The question may reference only SOME of the groups (e.g. "more red or yellow?" with a
      // third Green group present) — compare only the named groups, not the global max/min.
      const comparedCats = comparedCategories(cats, currentChallenge.comparisonQuestion);
      const comparedCounts = comparedCats.map(cat => ({
        label: cat.label,
        count: (autoSortedBins.get(cats.indexOf(cat)) || []).length,
      }));
      const allEqual = comparedCounts.length > 0 && comparedCounts.every(b => b.count === comparedCounts[0].count);
      const question = (currentChallenge.comparisonQuestion || '').toLowerCase();
      const asksFewer = /fewer|fewest|less|least|smallest/.test(question);

      let correctLabel: string;
      if (allEqual) {
        correctLabel = '__equal__';
      } else if (asksFewer) {
        const min = Math.min(...comparedCounts.map(b => b.count));
        correctLabel = comparedCounts.find(b => b.count === min)!.label;
      } else {
        const max = Math.max(...comparedCounts.map(b => b.count));
        correctLabel = comparedCounts.find(b => b.count === max)!.label;
      }

      const correct = comparisonAnswer === correctLabel;
      if (correct) {
        SoundManager.playCorrect();
        setFeedback('Correct! Great comparing!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: attemptScore(currentAttempts + 1) });
        sendText(
          `[ANSWER_CORRECT] Student correctly compared: "${comparisonAnswer}". Counts were ${binCounts.map(b => `${b.label}=${b.count}`).join(', ')}. Celebrate and reinforce the comparison!`,
          { silent: true },
        );
      } else {
        const attempt = currentAttempts + 1;
        SoundManager.playIncorrect();
        setFeedback('Not quite. Look at your counts again!');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student chose "${comparisonAnswer}" but correct is "${correctLabel}". Counts: ${binCounts.map(b => `${b.label}=${b.count}`).join(', ')}. `
          + `Attempt ${attempt}. ${attempt >= 3 ? 'Very specific hint: "Look — one group has MORE. Which number is bigger?"' : attempt >= 2 ? 'Hint: "Compare the numbers you counted. Which is bigger?"' : 'Encourage: "Look at the numbers you counted!"'}`,
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
        SoundManager.playCorrect();
        setFeedback('You found them all!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: attemptScore(currentAttempts + 1) });
        sendText(
          `[ANSWER_CORRECT] Student correctly identified all objects matching ${JSON.stringify(rule)}. Celebrate!`,
          { silent: true },
        );
      } else {
        const missed = Array.from(correctIds).filter(id => !selectedObjects.has(id)).length;
        const extra = selectedArr.filter(id => !correctIds.has(id)).length;
        const attempt = currentAttempts + 1;
        let msg = 'Not quite.';
        if (missed > 0) msg += ` You missed ${missed}.`;
        if (extra > 0) msg += ` ${extra} ${extra === 1 ? "doesn't" : "don't"} belong.`;
        SoundManager.playIncorrect();
        setFeedback(msg);
        setFeedbackType('error');
        const ruleKeys = Object.keys(rule);
        sendText(
          `[ANSWER_INCORRECT] Missed ${missed}, selected ${extra} extras. `
          + `Attempt ${attempt}. ${attempt >= 3 ? `Very specific: "You need objects that are BOTH ${ruleKeys.map(k => `${k}=${rule[k]}`).join(' AND ')}. Check each one."` : attempt >= 2 ? `[ATTRIBUTE_HINT] Hint: "Remember, it needs TWO things: the right ${ruleKeys[0]} AND the right ${ruleKeys[1]}."` : 'Give a two-attribute hint.'}`
          + tutorRevealClause('two-attributes'),
          { silent: true },
        );
      }
    }

    else if (type === 'odd-one-out') {
      if (!selectedOddOne) return;
      const correct = selectedOddOne === currentChallenge.oddOneOut;
      if (correct) {
        SoundManager.playCorrect();
        setFeedback(`Yes! ${currentChallenge.oddOneOutReason || "It doesn't belong!"}`);
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: attemptScore(currentAttempts + 1) });
        sendText(
          `[ANSWER_CORRECT] Student correctly identified the odd one out. Reason: ${currentChallenge.oddOneOutReason}. `
          + `[EXPLAIN_WHY] Ask the student to explain their reasoning: "You got it! Can you tell me WHY that one doesn't belong?" This builds metacognitive skills.`,
          { silent: true },
        );
      } else {
        const attempt = currentAttempts + 1;
        SoundManager.playIncorrect();
        setFeedback('That one fits in! Look for the one that is different.');
        setFeedbackType('error');
        setSelectedOddOne(null);
        sendText(
          `[ANSWER_INCORRECT] Student chose wrong object for odd-one-out. `
          + `Attempt ${attempt}. ${attempt >= 3 ? `Very specific: "Most of these are the same kind of thing. One is totally different. Which one?"` : attempt >= 2 ? 'Hint: "Look at what makes most of them similar. One doesn\'t share that."' : 'Hint: "What do most of these have in common?"'}`
          + tutorRevealClause('odd-one-out'),
          { silent: true },
        );
      }
    }

    else if (type === 'tally-record') {
      const cats = currentChallenge.categories || [];

      // ── Phase 1: Sort objects into bins ──
      if (tallyRecordPhase === 'sort') {
        if (cats.length === 0) return;

        let correctCount = 0;
        let totalPlaced = 0;

        for (const [objId, binIdx] of Array.from(binAssignments.entries())) {
          if (objId === modelItemId) continue; // model item is a freebie — never graded
          totalPlaced++;
          const obj = currentChallenge.objects.find(o => o.id === objId);
          if (obj && binIdx < cats.length && objectMatchesRule(obj, cats[binIdx].rule)) {
            correctCount++;
          }
        }

        const gradeableTotal = currentChallenge.objects.length - (modelItemId ? 1 : 0);
        const allPlaced = totalPlaced === gradeableTotal;
        const allCorrect = allPlaced && correctCount === totalPlaced;

        if (allCorrect) {
          SoundManager.playCorrect();
          setFeedback('Great sorting! Now count each group.');
          setFeedbackType('success');
          setTallyRecordPhase('tally');
          sendText(
            `[SORT_PHASE_COMPLETE] Student correctly sorted all ${totalPlaced} objects into bins. `
            + `Now transitioning to tally phase. Say: "Awesome sorting! Now let's count how many are in each group."`,
            { silent: true },
          );
        } else if (!allPlaced) {
          SoundManager.invalid();
          setFeedback(`Sort all objects first! (${totalPlaced}/${gradeableTotal} placed)`);
          setFeedbackType('error');
          sendText(
            `[INCOMPLETE] Student placed ${totalPlaced} of ${gradeableTotal} objects. Encourage: "Keep going — sort them all!"`,
            { silent: true },
          );
        } else {
          const attempt = currentAttempts + 1;
          const wrongCount = totalPlaced - correctCount;
          SoundManager.playIncorrect();
          setFeedback(`${wrongCount} object${wrongCount > 1 ? 's are' : ' is'} in the wrong bin. Try again!`);
          setFeedbackType('error');
          sendText(
            `[ANSWER_INCORRECT] ${wrongCount} of ${totalPlaced} objects misplaced in tally-record sort phase. `
            + `Attempt ${attempt}. ${attempt >= 3 ? 'Very specific hint: "Look at each object — what type is it? Put it with the matching group."' : attempt >= 2 ? 'Hint: "Read the group names carefully. Which group does each object belong to?"' : 'Give a hint about the sorting rule.'}`,
            { silent: true },
          );
        }
        return; // Don't fall through
      }

      // ── Phase 2: Record tallies from student's sorted bins ──
      let allCorrect = true;
      for (let i = 0; i < cats.length; i++) {
        const expected = (objectsInBins.get(i) || []).length;
        const entered = tallyCounts[cats[i].label] ?? 0;
        if (entered !== expected) {
          allCorrect = false;
          break;
        }
      }

      if (allCorrect) {
        SoundManager.playCorrect();
        setFeedback('Perfect tallies!');
        setFeedbackType('success');
        recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: attemptScore(currentAttempts + 1) });
        sendText(
          `[ANSWER_CORRECT] Student recorded all tallies correctly from their sorted bins. Celebrate: "You sorted AND counted — great data skills!"`,
          { silent: true },
        );
      } else {
        const attempt = currentAttempts + 1;
        const wrongBins = cats.filter((cat, i) => (tallyCounts[cat.label] ?? 0) !== (objectsInBins.get(i) || []).length);
        SoundManager.playIncorrect();
        setFeedback(`Some counts are off. Count ${wrongBins.map(c => c.label).join(' and ')} again!`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Tally counts wrong for: ${wrongBins.map(c => `${c.label} (entered ${tallyCounts[c.label] ?? 0}, actual ${(objectsInBins.get(cats.indexOf(c)) || []).length})`).join(', ')}. `
          + `Attempt ${attempt}. ${attempt >= 3 ? 'Very specific: "Point to each item in the bin and count out loud: one, two, three..."' : attempt >= 2 ? 'Hint: "Touch each object as you count it."' : 'Encourage: "Count each bin carefully!"'}`,
          { silent: true },
        );
      }
    }
  }, [
    currentChallenge, derivedCategories, binAssignments, selectedAttribute,
    comparisonAnswer, selectedObjects, selectedOddOne, tallyCounts,
    autoSortedBins, objectsInBins, currentAttempts, incrementAttempts, recordResult, sendText,
    countComparePhase, enteredBinCounts, tallyRecordPhase, modelItemId,
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
        // Partial credit: average per-challenge scores (which factor in attempts)
        const totalScore = challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0);
        const score = Math.round(totalScore / challenges.length);
        const allCorrect = challengeResults.every(r => r.correct);

        const metrics: SortingStationMetrics = {
          type: 'sorting-station',
          sortingAccuracy: score,
          categoriesUsed: maxCategories,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          allCorrect,
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
    setCountComparePhase('count');
    setEnteredBinCounts({});
    setTallyRecordPhase('sort');
    setBinFlash(null);
    if (binFlashTimer.current) clearTimeout(binFlashTimer.current);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Introduce it briefly.`
      + tutorRevealClause(nextChallenge.type),
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, maxCategories, currentChallengeIndex,
    tutorRevealClause,
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
    const totalScore = challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0);
    return Math.round(totalScore / challenges.length);
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
      case 'count-and-compare': return countComparePhase === 'count'
        ? Object.keys(enteredBinCounts).length > 0
        : comparisonAnswer !== null;
      case 'two-attributes': return selectedObjects.size > 0;
      case 'odd-one-out': return selectedOddOne !== null;
      case 'tally-record': return tallyRecordPhase === 'sort'
        ? binAssignments.size > 0
        : Object.keys(tallyCounts).length > 0;
      default: return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, binAssignments.size, selectedAttribute, comparisonAnswer, selectedObjects.size, selectedOddOne, tallyCounts, countComparePhase, enteredBinCounts, tallyRecordPhase]);

  // ─── PRE (K) odd-one-out: tap = choose ─────────────────────────
  // Selecting the odd object is an ATOMIC choice, so at K it auto-submits — no separate
  // Check button (band contract rule 2). The ref latches per selected id so an unrelated
  // re-render (handleCheckAnswer identity churn) can't double-submit; a wrong tap clears
  // selectedOddOne, resetting the latch so the next tap re-checks. Sort-family modes are
  // multi-part constructions and keep their explicit Check.
  const autoCheckedOddRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isK || currentChallenge?.type !== 'odd-one-out') return;
    if (!selectedOddOne) {
      autoCheckedOddRef.current = null;
      return;
    }
    if (!isCurrentChallengeComplete && autoCheckedOddRef.current !== selectedOddOne) {
      autoCheckedOddRef.current = selectedOddOne;
      handleCheckAnswer();
    }
  }, [isK, currentChallenge?.type, selectedOddOne, isCurrentChallengeComplete, handleCheckAnswer]);

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
        {(currentChallenge.type === 'sort-by-one' || currentChallenge.type === 'tally-record' || selectedAttribute) && (
          <>
            {/* Unsorted objects */}
            <div className="bg-slate-800/20 rounded-xl p-4 border border-white/5">
              {!isK && <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Unsorted Objects</p>}
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
              {selectedObjectId && !isK && (
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
                const flashedResult = binFlash?.get(idx);
                const zoneState: DropZoneState = flashedResult !== undefined
                  ? flashedResult
                    ? 'correct'
                    : 'incorrect'
                  : itemsInBin.length > 0
                    ? 'filled'
                    : 'idle';
                return (
                  <div
                    key={cat.label}
                    onClick={() => selectedObjectId && handleBinClick(idx)}
                    className={`min-h-[100px] text-left ${selectedObjectId ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {isK ? (
                      /* Pre-reader: the bin is a PICTURE (emoji or color-coded circle) with the
                         word as a small caption — the word never gates, the tutor names each bin. */
                      <div className="flex flex-col items-center gap-0.5 mb-2">
                        <span className="text-3xl leading-none" aria-hidden>
                          {cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}
                        </span>
                        <span className={`text-xs font-medium ${color.text}`}>{cat.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
                        {showCounts && (
                          <Badge className={`${color.bg} ${color.border} ${color.text} text-xs`}>
                            {itemsInBin.length}
                          </Badge>
                        )}
                      </div>
                    )}
                    <LuminaDropZone
                      state={zoneState}
                      emptyPrompt={isK ? '' : 'Tap to place object here'}
                      className="min-h-[64px] content-center justify-center p-2"
                    >
                      {itemsInBin.map(obj => {
                        const isModel = obj.id === modelItemId;
                        return (
                          <button
                            key={obj.id}
                            onClick={(e) => { e.stopPropagation(); if (!isModel) handleRemoveFromBin(obj.id); }}
                            title={isModel ? 'Example — already placed for you' : undefined}
                            className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 border transition-all duration-150 ${
                              isModel
                                ? 'bg-emerald-500/10 border-emerald-400/30 cursor-default'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-105 cursor-pointer'
                            }`}
                          >
                            <span className="text-lg">{obj.emoji}</span>
                            <span className="text-[9px] text-slate-400 leading-tight text-center break-words max-w-[72px]">{obj.label}</span>
                            {isModel && <span className="text-[8px] text-emerald-300 leading-none">example</span>}
                          </button>
                        );
                      })}
                    </LuminaDropZone>
                  </div>
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

    // Count-and-compare (two-phase: count → compare)
    if (type === 'count-and-compare') {
      const cats = currentChallenge.categories || [];

      // Phase 1: Count each bin
      if (countComparePhase === 'count') {
        return (
          <>
            {renderPreSortedBins(cats)}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 space-y-3">
              <p className="text-slate-300 text-sm text-center font-medium">
                How many are in each group? Count carefully!
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                {cats.map((cat, idx) => {
                  const color = BIN_COLORS[idx % BIN_COLORS.length];
                  const count = enteredBinCounts[cat.label] ?? 0;
                  return (
                    <div key={cat.label} className="flex flex-col items-center gap-1.5">
                      <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
                      <div className="flex items-center gap-0">
                        <button
                          onClick={() => {
                            SoundManager.tick();
                            setEnteredBinCounts(prev => ({
                              ...prev,
                              [cat.label]: Math.max((prev[cat.label] ?? 0) - 1, 0),
                            }));
                          }}
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
                          onClick={() => {
                            SoundManager.tick();
                            setEnteredBinCounts(prev => ({
                              ...prev,
                              [cat.label]: Math.min((prev[cat.label] ?? 0) + 1, 20),
                            }));
                          }}
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

      // Phase 2: Comparison question (counts locked, shown as badges)
      // Only offer the groups the question actually names — offering a group it never
      // mentions (e.g. Green for "more red or yellow?") is a misleading distractor.
      const comparedCats = comparedCategories(cats, currentChallenge.comparisonQuestion);
      const answerOptions = [
        ...comparedCats.map(cat => ({ value: cat.label, display: cat.label })),
        { value: '__equal__', display: "They're equal!" },
      ];
      return (
        <>
          {renderPreSortedBins(cats)}
          {/* Show locked counts */}
          <div className="flex justify-center gap-4 mb-1">
            {cats.map((cat, idx) => {
              const color = BIN_COLORS[idx % BIN_COLORS.length];
              return (
                <Badge key={cat.label} className={`${color.bg} ${color.border} ${color.text} text-sm px-3 py-1`}>
                  {cat.label}: {enteredBinCounts[cat.label] ?? 0}
                </Badge>
              );
            })}
          </div>
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
          {!isK && (
            <p className="text-slate-400 text-xs mb-3 text-center">
              Tap the one that doesn&apos;t belong
            </p>
          )}
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
                <span className={isK ? 'text-4xl' : 'text-2xl'}>{obj.emoji}</span>
                <span className="text-[11px] text-slate-400 leading-tight text-center break-words max-w-[80px]">{obj.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Tally-record (two-phase: sort → tally)
    if (type === 'tally-record') {
      const cats = currentChallenge.categories || [];

      // Phase 1: Sort objects into bins (reuse sorting UI)
      if (tallyRecordPhase === 'sort') {
        return renderSortingUI();
      }

      // Phase 2: Tally the student's sorted bins
      return (
        <>
          {/* Show student's sorted bins (locked) */}
          <div className={`grid gap-3 ${cats.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {cats.map((cat, idx) => {
              const color = BIN_COLORS[idx % BIN_COLORS.length];
              const items = objectsInBins.get(idx) || [];
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
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 space-y-3">
            <p className="text-slate-300 text-sm text-center font-medium">
              Now count how many you sorted into each group:
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
                        onClick={() => {
                          SoundManager.tick();
                          setTallyCounts(prev => ({
                            ...prev,
                            [cat.label]: Math.max((prev[cat.label] ?? 0) - 1, 0),
                          }));
                        }}
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
                        onClick={() => {
                          SoundManager.tick();
                          setTallyCounts(prev => ({
                            ...prev,
                            [cat.label]: Math.min((prev[cat.label] ?? 0) + 1, 20),
                          }));
                        }}
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
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!isK && (
            <LuminaBadge accent="orange" className="text-xs">
              Grade 1
            </LuminaBadge>
          )}
        </div>
        {!isK && description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Challenge progress badges — adult chrome (rule 7), hidden for the pre-reader */}
        {challenges.length > 0 && !isK && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasType = challenges.some(c => c.type === type);
              if (!hasType) return null;
              const isActive = currentChallenge?.type === type;
              return isActive ? (
                <Badge
                  key={type}
                  className="text-xs bg-orange-500/20 border-orange-400/50 text-orange-300"
                >
                  {config.icon} {config.label}
                </Badge>
              ) : (
                <Badge
                  key={type}
                  className="text-xs bg-slate-800/30 border-slate-700/30 text-slate-500"
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

        {/* Instruction (phase-aware) — on-screen text; hidden for the pre-reader (the tutor
            voices the task + names the bins via the ORIENT/DISAMBIGUATE aiDirectives beat) */}
        {currentChallenge && !allChallengesComplete && !isK && (
          <LuminaPanel>
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.type === 'count-and-compare' && countComparePhase === 'count'
                ? 'First, count how many are in each group!'
                : currentChallenge.type === 'tally-record' && tallyRecordPhase === 'sort'
                ? `Sort the objects into groups, then we'll count them!`
                : currentChallenge.type === 'tally-record' && tallyRecordPhase === 'tally'
                ? 'Great sorting! Now record the tally for each group.'
                : currentChallenge.instruction}
            </p>
            {/* Phase indicator for multi-phase challenges */}
            {currentChallenge.type === 'count-and-compare' && (
              <div className="flex gap-2 mt-2">
                <Badge className={`text-[10px] ${countComparePhase === 'count' ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' : 'bg-slate-800/30 border-slate-700/30 text-slate-500'}`}>
                  1. Count
                </Badge>
                <Badge className={`text-[10px] ${countComparePhase === 'compare' ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' : 'bg-slate-800/30 border-slate-700/30 text-slate-500'}`}>
                  2. Compare
                </Badge>
              </div>
            )}
            {currentChallenge.type === 'tally-record' && (
              <div className="flex gap-2 mt-2">
                <Badge className={`text-[10px] ${tallyRecordPhase === 'sort' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-slate-800/30 border-slate-700/30 text-slate-500'}`}>
                  1. Sort
                </Badge>
                <Badge className={`text-[10px] ${tallyRecordPhase === 'tally' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-slate-800/30 border-slate-700/30 text-slate-500'}`}>
                  2. Tally
                </Badge>
              </div>
            )}
          </LuminaPanel>
        )}

        {/* Challenge-specific UI */}
        {renderChallengeUI()}

        {/* Feedback — quantitative text prose ("N in the wrong bin") is hidden for the
            pre-reader (rule 5); the bin flash, sound, and the tutor's spoken hint carry it */}
        {feedback && !isK && (
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
            {!isCurrentChallengeComplete && !allChallengesComplete && !(isK && currentChallenge?.type === 'odd-one-out') && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={!canCheck || hasSubmittedEvaluation}
              >
                {currentChallenge?.type === 'count-and-compare' && countComparePhase === 'count'
                  ? 'Check Counts'
                  : currentChallenge?.type === 'tally-record' && tallyRecordPhase === 'sort'
                  ? 'Check Sort'
                  : currentChallenge?.type === 'tally-record' && tallyRecordPhase === 'tally'
                  ? 'Check Tallies'
                  : 'Check Answer'}
              </LuminaActionButton>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                Next Challenge
              </LuminaActionButton>
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SortingStation;
