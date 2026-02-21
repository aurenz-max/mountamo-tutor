'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberBondMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberBondChallenge {
  id: string;
  type: 'decompose' | 'missing-part' | 'fact-family' | 'build-equation';
  instruction: string;
  whole: number;
  part1?: number | null;
  part2?: number | null;
  allPairs?: [number, number][];
  factFamily?: string[];
  targetEquation?: string;
}

export interface NumberBondData {
  title: string;
  description?: string;
  challenges: NumberBondChallenge[];
  maxNumber: number;
  showCounters: boolean;
  showEquation: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberBondMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  decompose:        { label: 'Decompose',      icon: '🔀', accentColor: 'purple' },
  'missing-part':   { label: 'Missing Part',   icon: '❓', accentColor: 'blue' },
  'fact-family':    { label: 'Fact Family',     icon: '🔄', accentColor: 'emerald' },
  'build-equation': { label: 'Build Equation',  icon: '🧩', accentColor: 'amber' },
};

// Colors for the two-tone counters
const COUNTER_COLORS = {
  left: { fill: '#ef4444', stroke: '#dc2626', label: 'red' },   // red
  right: { fill: '#3b82f6', stroke: '#2563eb', label: 'blue' },  // blue
};

// SVG layout constants
const BOND_WIDTH = 400;
const BOND_HEIGHT = 280;
const WHOLE_CX = BOND_WIDTH / 2;
const WHOLE_CY = 60;
const WHOLE_R = 40;
const PART_R = 35;
const PART_LEFT_CX = BOND_WIDTH / 2 - 100;
const PART_RIGHT_CX = BOND_WIDTH / 2 + 100;
const PART_CY = 200;

// ============================================================================
// Helper: generate all unique pairs for a whole
// ============================================================================

function allPairsForWhole(whole: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 0; a <= Math.floor(whole / 2); a++) {
    pairs.push([a, whole - a]);
  }
  return pairs;
}

// ============================================================================
// Helper: semantic equation parsing for fact-family validation
// ============================================================================

interface ParsedEquation {
  left: number;
  op: '+' | '-';
  right: number;
  result: number;
  valid: boolean;           // math checks out
  usesCorrectNumbers: boolean; // uses exactly {whole, part1, part2}
  canonicalKey: string;     // dedup key, e.g. "6+4=10"
}

/**
 * Parse a student-typed equation like "6 + 4 = 10" or "10 = 6 + 4"
 * into a structured form. Handles whitespace, both `=` directions, etc.
 */
function parseEquation(input: string, whole: number, p1: number, p2: number): ParsedEquation | null {
  const s = input.replace(/\s+/g, '');
  if (!s) return null;

  // Try both forms: "a+b=c" / "a-b=c" and "c=a+b" / "c=a-b"
  const patterns = [
    /^(\d+)([+\-])(\d+)=(\d+)$/,   // a op b = c
    /^(\d+)=(\d+)([+\-])(\d+)$/,   // c = a op b
  ];

  let left: number, op: '+' | '-', right: number, result: number;

  const m1 = s.match(patterns[0]);
  if (m1) {
    left = parseInt(m1[1], 10);
    op = m1[2] as '+' | '-';
    right = parseInt(m1[3], 10);
    result = parseInt(m1[4], 10);
  } else {
    const m2 = s.match(patterns[1]);
    if (m2) {
      result = parseInt(m2[1], 10);
      left = parseInt(m2[2], 10);
      op = m2[3] as '+' | '-';
      right = parseInt(m2[4], 10);
    } else {
      return null;
    }
  }

  const mathCorrect = op === '+'
    ? left + right === result
    : left - right === result;

  // Check the equation uses exactly {whole, part1, part2}
  const nums = [left, right, result].sort((a, b) => a - b);
  const expected = [whole, p1, p2].sort((a, b) => a - b);
  const usesCorrectNumbers = nums[0] === expected[0] && nums[1] === expected[1] && nums[2] === expected[2];

  // Canonical form: always "left op right = result" with smaller operand first for addition
  const canonicalKey = op === '+'
    ? `${Math.min(left, right)}+${Math.max(left, right)}=${result}`
    : `${left}-${right}=${result}`;

  return { left, op, right, result, valid: mathCorrect, usesCorrectNumbers, canonicalKey };
}

/**
 * Build the 4 canonical fact-family keys for a given bond.
 * E.g. for whole=10, p1=6, p2=4:
 *   "4+6=10", "4+6=10" (commutative => same key), "10-4=6", "10-6=4"
 * We return the set of unique canonical keys.
 */
function factFamilyCanonicalKeys(whole: number, p1: number, p2: number): Set<string> {
  const min = Math.min(p1, p2);
  const max = Math.max(p1, p2);
  return new Set([
    `${min}+${max}=${whole}`,  // covers both a+b=c and b+a=c
    `${whole}-${min}=${max}`,
    `${whole}-${max}=${min}`,
  ]);
  // Note: 3 unique canonical keys covers all 4 equations because
  // a+b=c and b+a=c canonicalize to the same key. We accept 4 inputs
  // but the student can write EITHER commutative form — both map to same key.
}

// ============================================================================
// Sub-components
// ============================================================================

/** The classic number bond diagram (circle + branches) */
function BondDiagram({
  whole,
  leftValue,
  rightValue,
  showWhole,
  showLeft,
  showRight,
  highlightLeft,
  highlightRight,
  leftCounters,
  rightCounters,
  interactive,
  onDropLeft,
  onDropRight,
}: {
  whole: number;
  leftValue: number | string;
  rightValue: number | string;
  showWhole: boolean;
  showLeft: boolean;
  showRight: boolean;
  highlightLeft?: boolean;
  highlightRight?: boolean;
  leftCounters?: number;
  rightCounters?: number;
  interactive?: boolean;
  onDropLeft?: () => void;
  onDropRight?: () => void;
}) {
  return (
    <svg
      width={BOND_WIDTH}
      height={BOND_HEIGHT}
      viewBox={`0 0 ${BOND_WIDTH} ${BOND_HEIGHT}`}
      className="max-w-full h-auto"
    >
      {/* Branches */}
      <line
        x1={WHOLE_CX} y1={WHOLE_CY + WHOLE_R}
        x2={PART_LEFT_CX} y2={PART_CY - PART_R}
        stroke="rgba(255,255,255,0.2)" strokeWidth={2.5}
      />
      <line
        x1={WHOLE_CX} y1={WHOLE_CY + WHOLE_R}
        x2={PART_RIGHT_CX} y2={PART_CY - PART_R}
        stroke="rgba(255,255,255,0.2)" strokeWidth={2.5}
      />

      {/* Whole circle */}
      <circle
        cx={WHOLE_CX} cy={WHOLE_CY} r={WHOLE_R}
        fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.5)" strokeWidth={2}
      />
      <text
        x={WHOLE_CX} y={WHOLE_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showWhole ? '#e2e8f0' : 'rgba(148,163,184,0.4)'}
        fontSize={28} fontWeight="bold"
        className="select-none"
      >
        {showWhole ? whole : '?'}
      </text>

      {/* Left part circle */}
      <circle
        cx={PART_LEFT_CX} cy={PART_CY} r={PART_R}
        fill={highlightLeft ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)'}
        stroke={highlightLeft ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}
        strokeWidth={2}
        className={interactive ? 'cursor-pointer' : ''}
        onClick={onDropLeft}
      />
      <text
        x={PART_LEFT_CX} y={PART_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showLeft ? '#fca5a5' : 'rgba(148,163,184,0.4)'}
        fontSize={24} fontWeight="bold"
        className="select-none"
      >
        {showLeft ? leftValue : '?'}
      </text>

      {/* Right part circle */}
      <circle
        cx={PART_RIGHT_CX} cy={PART_CY} r={PART_R}
        fill={highlightRight ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)'}
        stroke={highlightRight ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.3)'}
        strokeWidth={2}
        className={interactive ? 'cursor-pointer' : ''}
        onClick={onDropRight}
      />
      <text
        x={PART_RIGHT_CX} y={PART_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showRight ? '#93c5fd' : 'rgba(148,163,184,0.4)'}
        fontSize={24} fontWeight="bold"
        className="select-none"
      >
        {showRight ? rightValue : '?'}
      </text>

      {/* Counter pips inside circles */}
      {leftCounters !== undefined && leftCounters > 0 && (
        <CounterPips cx={PART_LEFT_CX} cy={PART_CY} count={leftCounters} color={COUNTER_COLORS.left.fill} r={PART_R} />
      )}
      {rightCounters !== undefined && rightCounters > 0 && (
        <CounterPips cx={PART_RIGHT_CX} cy={PART_CY} count={rightCounters} color={COUNTER_COLORS.right.fill} r={PART_R} />
      )}
    </svg>
  );
}

/** Small dots arranged inside a part circle to represent counters */
function CounterPips({ cx, cy, count, color, r }: {
  cx: number; cy: number; count: number; color: string; r: number;
}) {
  const DOT_R = 4;
  const positions = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (count <= 0) return pts;
    // Arrange in a grid-like layout inside the circle
    const cols = Math.min(count, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const spacing = Math.min((r * 1.2) / Math.max(cols, 1), (r * 1.2) / Math.max(rows, 1));
    const startX = cx - ((cols - 1) * spacing) / 2;
    const startY = cy - ((rows - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pts.push({ x: startX + col * spacing, y: startY + row * spacing });
    }
    return pts;
  }, [cx, cy, count, r]);

  return (
    <>
      {positions.map((p, i) => (
        <circle
          key={i} cx={p.x} cy={p.y} r={DOT_R}
          fill={color} opacity={0.7}
        />
      ))}
    </>
  );
}

// ============================================================================
// Fact Family Helper — collapsible conceptual explainer
// ============================================================================

const EXAMPLE_EQUATIONS = [
  { eq: '2 + 3 = 5', tip: 'Start with the two parts. Add them together to get the whole.' },
  { eq: '3 + 2 = 5', tip: 'Swap the parts — addition works in any order!' },
  { eq: '5 − 2 = 3', tip: 'Start with the whole. Take away one part and the other part is left.' },
  { eq: '5 − 3 = 2', tip: 'Same idea — take away the other part instead.' },
];

function FactFamilyHelper() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mx-auto">
          <span>💡</span>
          <span className="underline underline-offset-2 decoration-slate-600">How do fact families work?</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
          {/* Mini bond diagram: 2 + 3 = 5 */}
          <div className="flex justify-center">
            <svg width={160} height={100} viewBox="0 0 160 100" className="max-w-full h-auto">
              {/* Branches */}
              <line x1={80} y1={30} x2={40} y2={75} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <line x1={80} y1={30} x2={120} y2={75} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              {/* Whole */}
              <circle cx={80} cy={22} r={18} fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.4)" strokeWidth={1.5} />
              <text x={80} y={22} textAnchor="middle" dominantBaseline="central" fill="#e2e8f0" fontSize={16} fontWeight="bold" className="select-none">5</text>
              {/* Left part */}
              <circle cx={40} cy={78} r={16} fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth={1.5} />
              <text x={40} y={78} textAnchor="middle" dominantBaseline="central" fill="#fca5a5" fontSize={14} fontWeight="bold" className="select-none">2</text>
              {/* Right part */}
              <circle cx={120} cy={78} r={16} fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)" strokeWidth={1.5} />
              <text x={120} y={78} textAnchor="middle" dominantBaseline="central" fill="#93c5fd" fontSize={14} fontWeight="bold" className="select-none">3</text>
            </svg>
          </div>
          <p className="text-slate-500 text-xs text-center">
            These 3 numbers make <span className="text-slate-300">4 related equations</span>:
          </p>
          {/* Equation badges with hover tooltips */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {EXAMPLE_EQUATIONS.map(({ eq, tip }) => (
              <div key={eq} className="group relative">
                <div className="bg-slate-700/30 border border-white/10 rounded-lg px-3 py-1.5 text-center text-sm font-mono text-slate-200 cursor-default hover:bg-slate-700/50 transition-colors">
                  {eq}
                </div>
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-52 pointer-events-none">
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs text-slate-300 text-center">
                    {tip}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-[10px] text-center">Hover an equation to see why it works</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Props
// ============================================================================

interface NumberBondProps {
  data: NumberBondData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const NumberBond: React.FC<NumberBondProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    showCounters = true,
    showEquation = true,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared challenge progress
  // -------------------------------------------------------------------------
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
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Decompose state
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [foundPairs, setFoundPairs] = useState<[number, number][]>([]);

  // Missing-part state
  const [missingAnswer, setMissingAnswer] = useState('');

  // Fact-family state
  const [familyInputs, setFamilyInputs] = useState<string[]>(['', '', '', '']);
  const [familyChecked, setFamilyChecked] = useState<(boolean | null)[]>([null, null, null, null]);

  // Build-equation state
  const [equationSlots, setEquationSlots] = useState<string[]>([]);
  const [availableTiles, setAvailableTiles] = useState<string[]>([]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `number-bond-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NumberBondMetrics>({
    primitiveType: 'number-bond',
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
    challengeType: currentChallenge?.type ?? 'decompose',
    whole: currentChallenge?.whole ?? 0,
    part1: currentChallenge?.part1 ?? null,
    part2: currentChallenge?.part2 ?? null,
    missingValue: currentChallenge?.type === 'missing-part'
      ? (currentChallenge.part1 == null ? currentChallenge.whole - (currentChallenge.part2 ?? 0) : currentChallenge.whole - currentChallenge.part1)
      : null,
    pairsFound: foundPairs.length,
    totalPairs: currentChallenge?.allPairs?.length ?? allPairsForWhole(currentChallenge?.whole ?? 0).length,
    attemptNumber: currentAttempts + 1,
    gradeBand,
    maxNumber,
    currentChallengeIndex,
    totalChallenges: challenges.length,
  }), [currentChallenge, foundPairs.length, currentAttempts, gradeBand, maxNumber, currentChallengeIndex, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'number-bond',
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
      `[ACTIVITY_START] Number Bond activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges. Max number: ${maxNumber}. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}, whole: ${currentChallenge?.whole}). `
      + `Introduce warmly: "Let's explore how numbers break apart! We'll look at number bonds today."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, maxNumber, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Reset domain state when challenge changes
  // -------------------------------------------------------------------------
  const resetDomainState = useCallback(() => {
    setFeedback('');
    setFeedbackType('');
    setLeftCount(0);
    setRightCount(0);
    setFoundPairs([]);
    setMissingAnswer('');
    setFamilyInputs(['', '', '', '']);
    setFamilyChecked([null, null, null, null]);
    setEquationSlots([]);
  }, []);

  // Initialize build-equation tiles when challenge changes
  useEffect(() => {
    if (!currentChallenge) return;
    if (currentChallenge.type === 'build-equation') {
      const w = currentChallenge.whole;
      const p1 = currentChallenge.part1 ?? 0;
      const p2 = currentChallenge.part2 ?? 0;
      const tiles = [String(w), String(p1), String(p2), '+', '-', '='];
      // Shuffle tiles
      const shuffled = [...tiles].sort(() => Math.random() - 0.5);
      setAvailableTiles(shuffled);
      setEquationSlots([]);
    }
  }, [currentChallengeIndex, currentChallenge]);

  // -------------------------------------------------------------------------
  // Decompose: add a counter to left or right
  // -------------------------------------------------------------------------
  const whole = currentChallenge?.whole ?? 0;
  const totalCounters = leftCount + rightCount;
  const remainingCounters = whole - totalCounters;

  const handleAddLeft = useCallback(() => {
    if (hasSubmittedEvaluation || remainingCounters <= 0) return;
    setLeftCount(prev => prev + 1);
  }, [hasSubmittedEvaluation, remainingCounters]);

  const handleAddRight = useCallback(() => {
    if (hasSubmittedEvaluation || remainingCounters <= 0) return;
    setRightCount(prev => prev + 1);
  }, [hasSubmittedEvaluation, remainingCounters]);

  const handleResetCounters = useCallback(() => {
    setLeftCount(0);
    setRightCount(0);
  }, []);

  // -------------------------------------------------------------------------
  // Decompose: submit a pair
  // -------------------------------------------------------------------------
  const handleSubmitPair = useCallback(() => {
    if (totalCounters !== whole) {
      setFeedback(`Place all ${whole} counters first!`);
      setFeedbackType('error');
      return;
    }

    const pair: [number, number] = [Math.min(leftCount, rightCount), Math.max(leftCount, rightCount)];
    const alreadyFound = foundPairs.some(p => p[0] === pair[0] && p[1] === pair[1]);

    if (alreadyFound) {
      setFeedback(`You already found ${leftCount} + ${rightCount} = ${whole}!`);
      setFeedbackType('error');
      sendText(
        `[DUPLICATE_PAIR] Student tried ${leftCount} + ${rightCount} but already found this pair. `
        + `Encourage: "You already found that one! Can you think of a different way to split ${whole}?"`,
        { silent: true }
      );
      return;
    }

    const newPairs = [...foundPairs, pair];
    setFoundPairs(newPairs);
    setLeftCount(0);
    setRightCount(0);

    const totalExpected = currentChallenge?.allPairs?.length ?? allPairsForWhole(whole).length;

    setFeedback(`${leftCount} + ${rightCount} = ${whole}! (${newPairs.length} of ${totalExpected} ways found)`);
    setFeedbackType('success');

    sendText(
      `[PAIR_FOUND] Student found ${leftCount} + ${rightCount} = ${whole}. `
      + `${newPairs.length} of ${totalExpected} pairs found. `
      + `Celebrate: "Great! ${leftCount} and ${rightCount} make ${whole}!" `
      + `${newPairs.length < totalExpected ? `Guide: "Can you find another way to make ${whole}?"` : ''}`,
      { silent: true }
    );

    // All pairs found?
    if (newPairs.length >= totalExpected) {
      incrementAttempts();
      recordResult({
        challengeId: currentChallenge!.id,
        correct: true,
        attempts: currentAttempts + 1,
        pairsFound: newPairs.length,
        totalPairs: totalExpected,
      });
    }
  }, [totalCounters, whole, leftCount, rightCount, foundPairs, currentChallenge, currentAttempts, sendText, incrementAttempts, recordResult]);

  // -------------------------------------------------------------------------
  // Missing-part: check answer
  // -------------------------------------------------------------------------
  const handleCheckMissingPart = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const answer = parseInt(missingAnswer, 10);
    const expected = currentChallenge.part1 == null
      ? currentChallenge.whole - (currentChallenge.part2 ?? 0)
      : currentChallenge.whole - (currentChallenge.part1 ?? 0);
    const correct = answer === expected;

    if (correct) {
      setFeedback(`Yes! ${currentChallenge.whole} = ${currentChallenge.part1 ?? expected} + ${currentChallenge.part2 ?? expected}`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly found the missing part: ${expected}. `
        + `Whole: ${currentChallenge.whole}. Congratulate briefly.`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Think: ${currentChallenge.whole} = ${currentChallenge.part1 ?? '?'} + ${currentChallenge.part2 ?? '?'}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer} but correct is ${expected}. `
        + `Whole: ${currentChallenge.whole}, known part: ${currentChallenge.part1 ?? currentChallenge.part2}. `
        + `Attempt ${currentAttempts + 1}. Give a hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, missingAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Fact-family: semantic check for all 4 equations
  // -------------------------------------------------------------------------
  const handleCheckFactFamily = useCallback(() => {
    if (!currentChallenge) return;
    const w = currentChallenge.whole;
    const p1 = currentChallenge.part1 ?? 0;
    const p2 = currentChallenge.part2 ?? 0;
    incrementAttempts();

    const validKeys = factFamilyCanonicalKeys(w, p1, p2);
    const seenKeys = new Set<string>();
    let uniqueCorrect = 0;

    const checks = familyInputs.map((input) => {
      if (!input.trim()) return null;

      const parsed = parseEquation(input, w, p1, p2);
      if (!parsed) return 'parse-error' as const;       // couldn't parse at all
      if (!parsed.valid) return 'bad-math' as const;     // math doesn't check out
      if (!parsed.usesCorrectNumbers) return 'wrong-numbers' as const; // valid math but wrong numbers
      if (seenKeys.has(parsed.canonicalKey)) return 'duplicate' as const;

      if (validKeys.has(parsed.canonicalKey)) {
        seenKeys.add(parsed.canonicalKey);
        uniqueCorrect++;
        return true;
      }
      return 'wrong-numbers' as const;
    });

    setFamilyChecked(checks.map(c => c === true ? true : c === null ? null : false));

    // Need all 3 canonical keys covered (4 input slots, but a+b and b+a share a key)
    const allKeysFound = validKeys.size > 0 && seenKeys.size >= validKeys.size;

    if (allKeysFound) {
      setFeedback('You found the whole fact family!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        factFamilyComplete: true,
      });
      sendText(
        `[ANSWER_CORRECT] Student completed the fact family for ${w} = ${p1} + ${p2}. `
        + `All equations correct! Celebrate the inverse relationship understanding.`,
        { silent: true }
      );
    } else {
      // Build specific feedback per slot
      const hints: string[] = [];
      checks.forEach((c, i) => {
        if (c === 'parse-error') hints.push(`Slot ${i + 1}: couldn't read — use format like "6+4=10"`);
        else if (c === 'bad-math') hints.push(`Slot ${i + 1}: the math doesn't add up`);
        else if (c === 'wrong-numbers') hints.push(`Slot ${i + 1}: use only the numbers ${p1}, ${p2}, and ${w}`);
        else if (c === 'duplicate') hints.push(`Slot ${i + 1}: same equation as another slot`);
      });

      const remaining = validKeys.size - seenKeys.size;
      setFeedback(
        `${uniqueCorrect > 0 ? `${uniqueCorrect} correct so far` : 'Not quite'}` +
        ` — ${remaining} more unique equation${remaining !== 1 ? 's' : ''} needed.` +
        (hints.length > 0 ? ` ${hints[0]}` : '')
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Fact family for ${w}=${p1}+${p2}: ${uniqueCorrect} unique facts found, ${remaining} still needed. `
        + `Issues: ${hints.join('; ')}. Student wrote: ${familyInputs.join(', ')}. `
        + `Remind them: "A fact family uses the SAME three numbers (${p1}, ${p2}, ${w}) in addition AND subtraction."`,
        { silent: true }
      );
    }
  }, [currentChallenge, familyInputs, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Build-equation: tile management
  // -------------------------------------------------------------------------
  const handleTileToSlot = useCallback((tile: string, tileIndex: number) => {
    setAvailableTiles(prev => prev.filter((_, i) => i !== tileIndex));
    setEquationSlots(prev => [...prev, tile]);
  }, []);

  const handleSlotRemove = useCallback((slotIndex: number) => {
    const tile = equationSlots[slotIndex];
    setEquationSlots(prev => prev.filter((_, i) => i !== slotIndex));
    setAvailableTiles(prev => [...prev, tile]);
  }, [equationSlots]);

  const handleCheckEquation = useCallback(() => {
    if (!currentChallenge) return;
    const w = currentChallenge.whole;
    const p1 = currentChallenge.part1 ?? 0;
    const p2 = currentChallenge.part2 ?? 0;
    incrementAttempts();

    const builtEq = equationSlots.join('');
    const parsed = parseEquation(builtEq, w, p1, p2);

    if (!parsed) {
      setFeedback('Arrange the tiles into an equation like 6+4=10');
      setFeedbackType('error');
      return;
    }

    // Accept any valid equation using the correct three numbers
    const correct = parsed.valid && parsed.usesCorrectNumbers;

    if (correct) {
      setFeedback(`Correct! ${builtEq.replace(/\s+/g, '')}`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student built the equation: ${builtEq}. Congratulate!`,
        { silent: true }
      );
    } else if (!parsed.valid) {
      setFeedback('The math doesn\'t add up — check the numbers.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${builtEq}" but the math is wrong. `
        + `Attempt ${currentAttempts + 1}. Hint about checking their arithmetic.`,
        { silent: true }
      );
    } else {
      setFeedback(`Use the numbers from the bond: ${p1}, ${p2}, and ${w}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${builtEq}" — math is correct but wrong numbers. `
        + `Attempt ${currentAttempts + 1}. Remind them to look at the number bond diagram.`,
        { silent: true }
      );
    }
  }, [currentChallenge, equationSlots, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All done — submit evaluation
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their number bond understanding!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const decomposePairs = challengeResults
          .filter(r => (r.pairsFound as number) > 0)
          .reduce((s, r) => s + ((r.pairsFound as number) || 0), 0);
        const factFamilyComplete = challengeResults.some(r => r.factFamilyComplete === true);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: NumberBondMetrics = {
          type: 'number-bond',
          accuracy,
          decomposePairsFound: decomposePairs,
          factFamilyComplete,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(
          correctCount === challenges.length,
          accuracy,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Reset domain state and announce next challenge
    resetDomainState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}, whole: ${nextChallenge.whole}). `
      + `Introduce it briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, resetDomainState, currentChallengeIndex,
  ]);

  // Auto-submit when complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Equation string for display
  // -------------------------------------------------------------------------
  const liveEquation = useMemo(() => {
    if (!currentChallenge || !showEquation) return null;
    if (currentChallenge.type === 'decompose') {
      if (totalCounters === whole && leftCount > 0 && rightCount > 0) {
        return `${leftCount} + ${rightCount} = ${whole}`;
      }
      return `? + ? = ${whole}`;
    }
    if (currentChallenge.type === 'missing-part') {
      const p1 = currentChallenge.part1;
      const p2 = currentChallenge.part2;
      return `${p1 ?? '?'} + ${p2 ?? '?'} = ${currentChallenge.whole}`;
    }
    return null;
  }, [currentChallenge, showEquation, totalCounters, whole, leftCount, rightCount]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasType = challenges.some(c => c.type === type);
              if (!hasType) return null;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    currentChallenge?.type === type
                      ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
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
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Number Bond Diagram */}
        {currentChallenge && !allChallengesComplete && (
          <div className="flex justify-center">
            {currentChallenge.type === 'decompose' && (
              <BondDiagram
                whole={whole}
                leftValue={leftCount || '?'}
                rightValue={rightCount || '?'}
                showWhole={true}
                showLeft={leftCount > 0}
                showRight={rightCount > 0}
                highlightLeft={remainingCounters > 0}
                highlightRight={remainingCounters > 0}
                interactive={remainingCounters > 0}
                onDropLeft={handleAddLeft}
                onDropRight={handleAddRight}
                leftCounters={showCounters ? leftCount : undefined}
                rightCounters={showCounters ? rightCount : undefined}
              />
            )}
            {currentChallenge.type === 'missing-part' && (
              <BondDiagram
                whole={whole}
                leftValue={currentChallenge.part1 ?? '?'}
                rightValue={currentChallenge.part2 ?? '?'}
                showWhole={true}
                showLeft={currentChallenge.part1 != null}
                showRight={currentChallenge.part2 != null}
              />
            )}
            {currentChallenge.type === 'fact-family' && (
              <BondDiagram
                whole={whole}
                leftValue={currentChallenge.part1 ?? 0}
                rightValue={currentChallenge.part2 ?? 0}
                showWhole={true}
                showLeft={true}
                showRight={true}
              />
            )}
            {currentChallenge.type === 'build-equation' && (
              <BondDiagram
                whole={whole}
                leftValue={currentChallenge.part1 ?? 0}
                rightValue={currentChallenge.part2 ?? 0}
                showWhole={true}
                showLeft={true}
                showRight={true}
              />
            )}
          </div>
        )}

        {/* Live Equation Bar */}
        {liveEquation && !allChallengesComplete && (
          <div className="text-center">
            <span className="inline-block bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2 text-slate-200 text-lg font-mono tracking-wider">
              {liveEquation}
            </span>
          </div>
        )}

        {/* === Decompose Controls === */}
        {currentChallenge?.type === 'decompose' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="space-y-3">
            {/* Counter bank */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-slate-400 text-sm">
                Counters remaining: <span className="text-purple-300 font-bold">{remainingCounters}</span>
              </span>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                variant="ghost"
                className="bg-red-500/10 border border-red-400/30 hover:bg-red-500/20 text-red-300"
                onClick={handleAddLeft}
                disabled={remainingCounters <= 0}
              >
                + Left ({leftCount})
              </Button>
              <Button
                variant="ghost"
                className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                onClick={handleAddRight}
                disabled={remainingCounters <= 0}
              >
                + Right ({rightCount})
              </Button>
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                onClick={handleResetCounters}
              >
                Reset
              </Button>
            </div>
            {totalCounters === whole && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                  onClick={handleSubmitPair}
                >
                  Submit Pair
                </Button>
              </div>
            )}
            {/* Found pairs tracker */}
            {foundPairs.length > 0 && (
              <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5">
                <p className="text-slate-400 text-xs mb-2">
                  Ways found: {foundPairs.length} of {currentChallenge.allPairs?.length ?? allPairsForWhole(whole).length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {foundPairs.map((pair, i) => (
                    <Badge key={i} className="bg-purple-500/15 border-purple-400/30 text-purple-300 text-xs">
                      {pair[0]} + {pair[1]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Missing Part Input === */}
        {currentChallenge?.type === 'missing-part' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">What is the missing part?</span>
            <input
              type="number"
              min={0}
              max={maxNumber}
              value={missingAnswer}
              onChange={e => setMissingAnswer(e.target.value)}
              className="w-16 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-purple-400/50"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCheckMissingPart()}
            />
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleCheckMissingPart}
              disabled={!missingAnswer}
            >
              Check
            </Button>
          </div>
        )}

        {/* === Fact Family Inputs === */}
        {currentChallenge?.type === 'fact-family' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm text-center">
              Write all 4 equations using{' '}
              <span className="text-purple-300 font-semibold">{currentChallenge.part1 ?? 0}</span>,{' '}
              <span className="text-purple-300 font-semibold">{currentChallenge.part2 ?? 0}</span>, and{' '}
              <span className="text-purple-300 font-semibold">{currentChallenge.whole}</span>:
            </p>
            <FactFamilyHelper />
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {familyInputs.map((val, i) => (
                <div key={i} className="relative">
                  <input
                    type="text"
                    placeholder={i < 2 ? '_ + _ = _' : '_ \u2212 _ = _'}
                    value={val}
                    onChange={e => {
                      const next = [...familyInputs];
                      next[i] = e.target.value;
                      setFamilyInputs(next);
                    }}
                    className={`w-full px-3 py-1.5 bg-slate-800/50 border rounded-lg text-slate-100 text-center text-sm focus:outline-none ${
                      familyChecked[i] === true
                        ? 'border-emerald-400/50'
                        : familyChecked[i] === false
                          ? 'border-red-400/50'
                          : 'border-white/20 focus:border-purple-400/50'
                    }`}
                  />
                  {familyChecked[i] === true && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">✓</span>
                  )}
                  {familyChecked[i] === false && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-xs">✗</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckFactFamily}
                disabled={familyInputs.every(v => !v.trim())}
              >
                Check Fact Family
              </Button>
            </div>
          </div>
        )}

        {/* === Build Equation === */}
        {currentChallenge?.type === 'build-equation' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="space-y-3">
            {/* Equation slots */}
            <div className="flex items-center justify-center gap-1 min-h-[44px]">
              {equationSlots.length === 0 && (
                <span className="text-slate-500 text-sm italic">Tap tiles below to build the equation</span>
              )}
              {equationSlots.map((tile, i) => (
                <button
                  key={i}
                  onClick={() => handleSlotRemove(i)}
                  className="w-10 h-10 flex items-center justify-center bg-purple-500/15 border border-purple-400/30 rounded-lg text-purple-200 text-lg font-mono hover:bg-purple-500/25 transition-colors"
                >
                  {tile}
                </button>
              ))}
            </div>
            {/* Available tiles */}
            <div className="flex items-center justify-center gap-2">
              {availableTiles.map((tile, i) => (
                <button
                  key={i}
                  onClick={() => handleTileToSlot(tile, i)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-800/50 border border-white/20 rounded-lg text-slate-200 text-lg font-mono hover:bg-white/10 transition-colors"
                >
                  {tile}
                </button>
              ))}
            </div>
            {equationSlots.length > 0 && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleCheckEquation}
                >
                  Check Equation
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next / Complete buttons */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center">
            {isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
          </div>
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

        {/* Hint */}
        {currentChallenge && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">
              {currentChallenge.type === 'decompose' && `Try starting with 0 + ${whole}, then 1 + ${whole - 1}...`}
              {currentChallenge.type === 'missing-part' && `Think: ${currentChallenge.whole} take away ${currentChallenge.part1 ?? currentChallenge.part2} equals...`}
              {currentChallenge.type === 'fact-family' && `Remember: if a + b = c, then c - a = b and c - b = a`}
              {currentChallenge.type === 'build-equation' && `Look at the number bond — which numbers go with + or -?`}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Number Bonds Complete!"
            celebrationMessage={`You completed all ${challenges.length} number bond challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NumberBond;
