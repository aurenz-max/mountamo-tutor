'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EquationBalancerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { CPK_COLORS } from './constants';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CompoundEntry {
  formula: string;
  coefficient: number;
  atoms: Record<string, number>;
}

export interface EquationData {
  reactants: CompoundEntry[];
  products: CompoundEntry[];
  arrow: '\u2192' | '\u21CC';
}

export interface EquationSolution {
  coefficients: number[];
}

export interface EquationChallenge {
  id: string;
  type: 'count_atoms' | 'spot_imbalance' | 'balance' | 'complex_balance' | 'timed';
  instruction: string;
  equation: string;
  difficulty: 'simple' | 'moderate' | 'complex';
  timeLimit: number | null;
  hint: string;
  narration: string;
  /** Per-challenge structured equation (overrides top-level equation when present) */
  equationData?: EquationData;
  /** Per-challenge solution (overrides top-level solution when present) */
  solutionData?: EquationSolution;
}

export interface EquationBalancerShowOptions {
  showAtomCounter: boolean;
  showMoleculeVisual: boolean;
  showBalanceScale: boolean;
  showGuided: boolean;
  showHistory: boolean;
  maxCoefficient: number;
}

export interface EquationBalancerData {
  title: string;
  description?: string;
  equation: EquationData;
  solution: EquationSolution;
  challenges: EquationChallenge[];
  showOptions?: Partial<EquationBalancerShowOptions>;
  gradeBand?: '6-7' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationBalancerMetrics>) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/** Get CPK color for an element, fallback to neutral */
function getAtomColor(symbol: string): string {
  return CPK_COLORS[symbol] || '#94a3b8';
}

/** Count total atoms on one side of the equation given current coefficients */
function countAtoms(compounds: CompoundEntry[], coefficients: number[]): Record<string, number> {
  const counts: Record<string, number> = {};
  compounds.forEach((compound, i) => {
    const coeff = coefficients[i] ?? 1;
    for (const [element, count] of Object.entries(compound.atoms)) {
      counts[element] = (counts[element] || 0) + count * coeff;
    }
  });
  return counts;
}

/** Check if the equation is balanced given current coefficients */
function isBalanced(
  reactants: CompoundEntry[],
  products: CompoundEntry[],
  reactantCoeffs: number[],
  productCoeffs: number[],
): boolean {
  const rCounts = countAtoms(reactants, reactantCoeffs);
  const pCounts = countAtoms(products, productCoeffs);
  const allElements = Array.from(new Set([...Object.keys(rCounts), ...Object.keys(pCounts)]));
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if ((rCounts[el] || 0) !== (pCounts[el] || 0)) return false;
  }
  return true;
}

/** Get all unique elements across the equation */
function getAllElements(reactants: CompoundEntry[], products: CompoundEntry[]): string[] {
  const elements = new Set<string>();
  [...reactants, ...products].forEach(c => {
    Object.keys(c.atoms).forEach(el => elements.add(el));
  });
  return Array.from(elements).sort();
}

/** Render chemical formula with subscripts */
function renderFormula(formula: string): React.ReactNode {
  // Convert subscript unicode digits and regular digits after letters
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < formula.length) {
    const char = formula[i];
    // Check for subscript unicode characters
    const subscriptMap: Record<string, string> = {
      '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
      '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
    };
    if (subscriptMap[char]) {
      parts.push(<sub key={i} className="text-[0.7em]">{subscriptMap[char]}</sub>);
    } else if (/\d/.test(char) && i > 0 && /[a-zA-Z\u2080-\u2089)]/.test(formula[i - 1])) {
      // Digit after a letter = subscript
      parts.push(<sub key={i} className="text-[0.7em]">{char}</sub>);
    } else {
      parts.push(<span key={i}>{char}</span>);
    }
    i++;
  }
  return <span className="font-mono">{parts}</span>;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Atom circles visualization for a compound */
const MoleculeVisual: React.FC<{
  compound: CompoundEntry;
  coefficient: number;
}> = ({ compound, coefficient }) => {
  // Show individual molecule clusters for each coefficient copy
  const molecules = Array.from({ length: Math.min(coefficient, 4) });

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {molecules.map((_, molIdx) => (
        <div
          key={molIdx}
          className="flex items-center gap-0.5 bg-slate-800/40 rounded-full px-2 py-1 border border-white/5"
        >
          {Object.entries(compound.atoms).map(([element, count]) =>
            Array.from({ length: count }).map((_, atomIdx) => (
              <div
                key={`${element}-${atomIdx}`}
                className="rounded-full border border-white/20 flex items-center justify-center"
                style={{
                  width: element === 'H' ? 16 : 22,
                  height: element === 'H' ? 16 : 22,
                  backgroundColor: getAtomColor(element) + '60',
                  borderColor: getAtomColor(element) + '80',
                }}
              >
                <span className="text-[8px] font-bold text-white/90">{element}</span>
              </div>
            ))
          )}
        </div>
      ))}
      {coefficient > 4 && (
        <span className="text-slate-500 text-xs">+{coefficient - 4} more</span>
      )}
    </div>
  );
};

/** Coefficient adjuster with +/- buttons */
const CoefficientControl: React.FC<{
  value: number;
  onChange: (v: number) => void;
  max: number;
  disabled?: boolean;
  highlight?: boolean;
}> = ({ value, onChange, max, disabled, highlight }) => (
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
      onClick={() => onChange(Math.max(1, value - 1))}
      disabled={disabled || value <= 1}
    >
      -
    </Button>
    <div
      className={`w-8 h-8 flex items-center justify-center rounded-md font-bold text-lg transition-all ${
        highlight
          ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 border scale-110'
          : 'bg-slate-800/50 border-white/10 text-slate-200 border'
      }`}
    >
      {value}
    </div>
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
    >
      +
    </Button>
  </div>
);

/** Atom counter table comparing reactant and product atom totals */
const AtomCounterTable: React.FC<{
  elements: string[];
  reactantCounts: Record<string, number>;
  productCounts: Record<string, number>;
}> = ({ elements, reactantCounts, productCounts }) => (
  <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">🔢</span>
      <span className="text-slate-300 text-sm font-medium">Atom Counter</span>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-slate-500 text-xs">
          <th className="text-left py-1">Element</th>
          <th className="text-center py-1">Reactants</th>
          <th className="text-center py-1">Products</th>
          <th className="text-center py-1">Match?</th>
        </tr>
      </thead>
      <tbody>
        {elements.map(el => {
          const rCount = reactantCounts[el] || 0;
          const pCount = productCounts[el] || 0;
          const matched = rCount === pCount && rCount > 0;
          return (
            <tr key={el} className="border-t border-white/5">
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: getAtomColor(el) + '60' }}
                  />
                  <span className="text-slate-200 font-mono font-medium">{el}</span>
                </div>
              </td>
              <td className={`text-center font-mono font-bold ${matched ? 'text-emerald-400' : 'text-red-400'}`}>
                {rCount}
              </td>
              <td className={`text-center font-mono font-bold ${matched ? 'text-emerald-400' : 'text-red-400'}`}>
                {pCount}
              </td>
              <td className="text-center">
                {matched ? (
                  <span className="text-emerald-400 text-base">&#10003;</span>
                ) : (
                  <span className="text-red-400 text-base">&#10007;</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/** Visual balance scale that tips based on total atom mass difference */
const BalanceScale: React.FC<{
  reactantTotal: number;
  productTotal: number;
  balanced: boolean;
}> = ({ reactantTotal, productTotal, balanced }) => {
  const diff = reactantTotal - productTotal;
  const tilt = balanced ? 0 : Math.max(-15, Math.min(15, diff * 3));

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{balanced ? '\u2696\uFE0F' : '\u2696\uFE0F'}</span>
        <span className="text-slate-300 text-sm font-medium">Balance Scale</span>
        {balanced && (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
            Balanced!
          </Badge>
        )}
      </div>

      <div className="relative flex flex-col items-center">
        {/* Beam */}
        <div
          className={`relative w-56 h-1.5 rounded-full transition-transform duration-500 ${
            balanced ? 'bg-emerald-500/60' : 'bg-amber-500/60'
          }`}
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          {/* Left pan (reactants) */}
          <div className="absolute -left-2 -top-6 flex flex-col items-center">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">Reactants</span>
            <div className={`w-14 h-8 rounded-b-lg border-2 flex items-center justify-center font-mono text-sm font-bold ${
              balanced ? 'border-emerald-400/40 text-emerald-400' : 'border-white/20 text-slate-300'
            }`}>
              {reactantTotal}
            </div>
          </div>

          {/* Right pan (products) */}
          <div className="absolute -right-2 -top-6 flex flex-col items-center">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">Products</span>
            <div className={`w-14 h-8 rounded-b-lg border-2 flex items-center justify-center font-mono text-sm font-bold ${
              balanced ? 'border-emerald-400/40 text-emerald-400' : 'border-white/20 text-slate-300'
            }`}>
              {productTotal}
            </div>
          </div>
        </div>

        {/* Fulcrum */}
        <div className="w-4 h-6 bg-slate-600/40 border border-white/10 mt-0.5" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
      </div>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface EquationBalancerProps {
  data: EquationBalancerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const EquationBalancer: React.FC<EquationBalancerProps> = ({ data, className }) => {
  const {
    title,
    description,
    equation,
    solution,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '6-7',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showAtomCounter = true,
    showMoleculeVisual = true,
    showBalanceScale = true,
    showGuided = gradeBand === '6-7',
    showHistory = true,
    maxCoefficient = gradeBand === '6-7' ? 6 : 10,
  } = showOptionsProp;

  // Active equation: use per-challenge equationData when available, otherwise top-level
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const currentChallenge = challenges[currentChallengeIndex] || null;

  const activeEquation = currentChallenge?.equationData ?? equation;
  const activeSolution = currentChallenge?.solutionData ?? solution;

  const { reactants = [], products = [], arrow = '\u2192' } = activeEquation;
  const totalCompounds = reactants.length + products.length;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [reactantCoeffs, setReactantCoeffs] = useState<number[]>(
    () => reactants.map(r => r.coefficient || 1)
  );
  const [productCoeffs, setProductCoeffs] = useState<number[]>(
    () => products.map(p => p.coefficient || 1)
  );
  const [history, setHistory] = useState<Array<{ reactantCoeffs: number[]; productCoeffs: number[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Challenge state (currentChallengeIndex declared above, near activeEquation)
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Guided mode
  const [guidedElement, setGuidedElement] = useState<string | null>(null);
  const [guidedElementIndex, setGuidedElementIndex] = useState(0);

  // Celebration
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasEverBalanced, setHasEverBalanced] = useState(false);

  // Tracking
  const [totalAttemptsAll, setTotalAttemptsAll] = useState(0);
  const [equationsBalanced, setEquationsBalanced] = useState(0);
  const [usedGuidedMode, setUsedGuidedMode] = useState(false);
  const [strategyUsed, setStrategyUsed] = useState('free');
  const [subscriptConfusion, setSubscriptConfusion] = useState(false);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `equation-balancer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Sync coefficients when the active equation changes (per-challenge equations)
  const prevEquationRef = useRef(activeEquation);
  useEffect(() => {
    if (prevEquationRef.current !== activeEquation) {
      prevEquationRef.current = activeEquation;
      setReactantCoeffs(reactants.map(r => r.coefficient || 1));
      setProductCoeffs(products.map(p => p.coefficient || 1));
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [activeEquation, reactants, products]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const allElements = useMemo(() => getAllElements(reactants, products), [reactants, products]);
  const reactantAtomCounts = useMemo(() => countAtoms(reactants, reactantCoeffs), [reactants, reactantCoeffs]);
  const productAtomCounts = useMemo(() => countAtoms(products, productCoeffs), [products, productCoeffs]);
  const balanced = useMemo(
    () => isBalanced(reactants, products, reactantCoeffs, productCoeffs),
    [reactants, products, reactantCoeffs, productCoeffs]
  );
  const reactantTotal = useMemo(
    () => Object.values(reactantAtomCounts).reduce((a, b) => a + b, 0),
    [reactantAtomCounts]
  );
  const productTotal = useMemo(
    () => Object.values(productAtomCounts).reduce((a, b) => a + b, 0),
    [productAtomCounts]
  );

  // (currentChallenge declared above, near activeEquation)
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EquationBalancerMetrics>({
    primitiveType: 'equation-balancer',
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
    gradeBand,
    title,
    currentCoefficients: {
      reactants: reactantCoeffs,
      products: productCoeffs,
    },
    atomCounts: {
      reactants: reactantAtomCounts,
      products: productAtomCounts,
    },
    elements: allElements,
    balancedElements: allElements.filter(el =>
      (reactantAtomCounts[el] || 0) === (productAtomCounts[el] || 0) && (reactantAtomCounts[el] || 0) > 0
    ),
    unbalancedElements: allElements.filter(el =>
      (reactantAtomCounts[el] || 0) !== (productAtomCounts[el] || 0)
    ),
    isBalanced: balanced,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'balance',
    instruction: currentChallenge?.instruction ?? 'Balance the equation',
    attemptNumber: currentAttempts + 1,
    equationString: [
      ...reactants.map((r, i) => `${reactantCoeffs[i]}${r.formula}`),
      arrow,
      ...products.map((p, i) => `${productCoeffs[i]}${p.formula}`),
    ].join(' '),
    guidedMode: guidedElement !== null,
    guidedElement,
  }), [
    gradeBand, title, reactantCoeffs, productCoeffs, reactantAtomCounts, productAtomCounts,
    allElements, balanced, currentChallengeIndex, challenges.length, currentChallenge,
    currentAttempts, reactants, products, arrow, guidedElement,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'equation-balancer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '6-7' ? 'Grade 6-7' : 'Grade 7-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    const equationStr = [
      ...reactants.map(r => r.formula),
      arrow,
      ...products.map(p => p.formula),
    ].join(' ');

    sendText(
      `[ACTIVITY_START] This is an Equation Balancer activity: "${title}" for ${gradeBand}. `
      + `Equation: ${equationStr}. Elements involved: ${allElements.join(', ')}. `
      + `The student needs to adjust coefficients to balance the equation. `
      + `Introduce the activity and remind them: "The same atoms must be on both sides!"`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, reactants, products, arrow, allElements, sendText]);

  // -------------------------------------------------------------------------
  // History Management
  // -------------------------------------------------------------------------

  const pushHistory = useCallback(() => {
    const entry = { reactantCoeffs: [...reactantCoeffs], productCoeffs: [...productCoeffs] };
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, entry];
    });
    setHistoryIndex(prev => prev + 1);
  }, [reactantCoeffs, productCoeffs, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    if (entry) {
      setReactantCoeffs(entry.reactantCoeffs);
      setProductCoeffs(entry.productCoeffs);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    if (entry) {
      setReactantCoeffs(entry.reactantCoeffs);
      setProductCoeffs(entry.productCoeffs);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // -------------------------------------------------------------------------
  // Coefficient Handlers
  // -------------------------------------------------------------------------

  const updateReactantCoeff = useCallback((index: number, value: number) => {
    pushHistory();
    setReactantCoeffs(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setTotalAttemptsAll(prev => prev + 1);
  }, [pushHistory]);

  const updateProductCoeff = useCallback((index: number, value: number) => {
    pushHistory();
    setProductCoeffs(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setTotalAttemptsAll(prev => prev + 1);
  }, [pushHistory]);

  // -------------------------------------------------------------------------
  // Balance Detection
  // -------------------------------------------------------------------------

  const prevBalancedRef = useRef(false);
  useEffect(() => {
    if (balanced && !prevBalancedRef.current && !hasEverBalanced) {
      setShowCelebration(true);
      setHasEverBalanced(true);
      setEquationsBalanced(prev => prev + 1);

      sendText(
        `[EQUATION_BALANCED] The student balanced the equation! `
        + `Coefficients: ${[...reactantCoeffs, ...productCoeffs].join(', ')}. `
        + `Celebrate! "Every element matches on both sides! Matter is conserved \u2014 nothing was created or destroyed, just rearranged."`,
        { silent: true }
      );

      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    prevBalancedRef.current = balanced;
  }, [balanced, hasEverBalanced, reactantCoeffs, productCoeffs, sendText]);

  // -------------------------------------------------------------------------
  // Guided Mode
  // -------------------------------------------------------------------------

  const startGuidedMode = useCallback(() => {
    setUsedGuidedMode(true);
    setStrategyUsed('guided-sequential');
    const unbalanced = allElements.filter(el =>
      (reactantAtomCounts[el] || 0) !== (productAtomCounts[el] || 0)
    );
    if (unbalanced.length > 0) {
      setGuidedElement(unbalanced[0]);
      setGuidedElementIndex(0);

      sendText(
        `[GUIDED_MODE_START] Student entered guided mode. Starting with element: ${unbalanced[0]}. `
        + `Unbalanced elements: ${unbalanced.join(', ')}. "Let's focus on one element at a time. `
        + `Start with ${unbalanced[0]} \u2014 how many ${unbalanced[0]} atoms are on each side?"`,
        { silent: true }
      );
    }
  }, [allElements, reactantAtomCounts, productAtomCounts, sendText]);

  const advanceGuidedElement = useCallback(() => {
    const unbalanced = allElements.filter(el =>
      (reactantAtomCounts[el] || 0) !== (productAtomCounts[el] || 0)
    );
    if (unbalanced.length === 0) {
      setGuidedElement(null);
    } else {
      const nextIdx = (guidedElementIndex + 1) % unbalanced.length;
      setGuidedElement(unbalanced[nextIdx] || null);
      setGuidedElementIndex(nextIdx);
    }
  }, [allElements, reactantAtomCounts, productAtomCounts, guidedElementIndex]);

  // -------------------------------------------------------------------------
  // Challenge Handling
  // -------------------------------------------------------------------------

  const handleCheckBalance = useCallback(() => {
    setCurrentAttempts(prev => prev + 1);

    if (balanced) {
      setFeedback('Perfectly balanced! Every element has the same count on both sides.');
      setFeedbackType('success');

      if (currentChallenge) {
        setChallengeResults(prev => [
          ...prev,
          { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
        ]);
      }

      sendText(
        `[ANSWER_CORRECT] Student balanced the equation on attempt ${currentAttempts + 1}. `
        + `Congratulate and explain conservation of mass.`,
        { silent: true }
      );
    } else {
      const unbalanced = allElements.filter(el =>
        (reactantAtomCounts[el] || 0) !== (productAtomCounts[el] || 0)
      );
      setFeedback(`Not quite! ${unbalanced.join(', ')} ${unbalanced.length === 1 ? 'is' : 'are'} still unbalanced. Keep trying!`);
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student's coefficients don't balance. Unbalanced elements: ${unbalanced.join(', ')}. `
        + `Reactant counts: ${JSON.stringify(reactantAtomCounts)}. Product counts: ${JSON.stringify(productAtomCounts)}. `
        + `Attempt ${currentAttempts + 1}. Give a hint: "${currentChallenge?.hint || 'Try adjusting one coefficient at a time.'}"`,
        { silent: true }
      );
    }
  }, [balanced, currentAttempts, currentChallenge, allElements, reactantAtomCounts, productAtomCounts, sendText]);

  const handleNextChallenge = useCallback(() => {
    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(prev => prev + 1);
      setCurrentAttempts(0);
      setFeedback('');
      setFeedbackType('');
      setHasEverBalanced(false);
      // Reset coefficients to 1
      setReactantCoeffs(reactants.map(r => r.coefficient || 1));
      setProductCoeffs(products.map(p => p.coefficient || 1));
      setHistory([]);
      setHistoryIndex(-1);
      setGuidedElement(null);

      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${challenges[currentChallengeIndex + 1]?.type}. Introduce it briefly.`,
        { silent: true }
      );
    } else {
      // All challenges done
      sendText(
        `[ALL_COMPLETE] Student finished all ${challenges.length} challenges! `
        + `Equations balanced: ${equationsBalanced}. Celebrate!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const score = challenges.length > 0
          ? challengeResults.filter(r => r.correct).length / challenges.length
          : balanced ? 1 : 0;
        submitEvaluation(
          score >= 0.5,
          score,
          {
            type: 'equation-balancer',
            equationsBalanced,
            equationsTotal: challenges.length,
            atomCountingCorrect: challengeResults.filter(r => r.correct).length,
            countingTotal: challenges.length,
            averageAttemptsPerEquation:
              challengeResults.length > 0
                ? challengeResults.reduce((sum, r) => sum + r.attempts, 0) / challengeResults.length
                : 0,
            usedGuidedMode,
            strategyUsed,
            coefficientVsSubscriptConfusion: subscriptConfusion,
            conservationArticulated: hasEverBalanced,
            attemptsCount: totalAttemptsAll,
          },
          { challengeResults },
        );
      }
    }
  }, [
    currentChallengeIndex, challenges, reactants, products, sendText,
    equationsBalanced, challengeResults, hasSubmittedEvaluation, submitEvaluation,
    usedGuidedMode, strategyUsed, subscriptConfusion, hasEverBalanced, totalAttemptsAll, balanced,
  ]);

  const resetCoefficients = useCallback(() => {
    pushHistory();
    setReactantCoeffs(reactants.map(r => r.coefficient || 1));
    setProductCoeffs(products.map(p => p.coefficient || 1));
    setFeedback('');
    setFeedbackType('');
  }, [pushHistory, reactants, products]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">{'\u2696\uFE0F'}</span>
              {title}
            </CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
              {gradeBand === '6-7' ? 'Grade 6-7' : 'Grade 7-8'}
            </Badge>
            {balanced && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs animate-pulse">
                Balanced!
              </Badge>
            )}
          </div>
        </div>

        {/* Challenge progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs">Challenge</span>
            {challenges.map((_, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                  challengeResults.some(r => r.challengeId === challenges[i].id && r.correct)
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                      : 'bg-slate-800/30 border-white/10 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge instruction */}
        {currentChallenge && (
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
            {currentChallenge.difficulty && (
              <Badge className={`mt-1 text-[10px] ${
                currentChallenge.difficulty === 'simple'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : currentChallenge.difficulty === 'moderate'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    : 'bg-red-500/20 text-red-300 border-red-400/30'
              }`}>
                {currentChallenge.difficulty}
              </Badge>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* Equation Display Bar */}
        {/* ============================================================== */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
          <div className="flex items-center justify-center flex-wrap gap-3">
            {/* Reactants */}
            {reactants.map((compound, i) => (
              <React.Fragment key={`r-${i}`}>
                {i > 0 && <span className="text-slate-500 text-xl font-light">+</span>}
                <div className="flex flex-col items-center gap-2">
                  <CoefficientControl
                    value={reactantCoeffs[i]}
                    onChange={(v) => updateReactantCoeff(i, v)}
                    max={maxCoefficient}
                    disabled={balanced && hasEverBalanced}
                    highlight={guidedElement !== null && Object.keys(compound.atoms).includes(guidedElement)}
                  />
                  <span className="text-slate-200 text-lg">{renderFormula(compound.formula)}</span>
                  {showMoleculeVisual && (
                    <MoleculeVisual compound={compound} coefficient={reactantCoeffs[i]} />
                  )}
                </div>
              </React.Fragment>
            ))}

            {/* Arrow */}
            <span className="text-slate-400 text-2xl mx-2">{arrow}</span>

            {/* Products */}
            {products.map((compound, i) => (
              <React.Fragment key={`p-${i}`}>
                {i > 0 && <span className="text-slate-500 text-xl font-light">+</span>}
                <div className="flex flex-col items-center gap-2">
                  <CoefficientControl
                    value={productCoeffs[i]}
                    onChange={(v) => updateProductCoeff(i, v)}
                    max={maxCoefficient}
                    disabled={balanced && hasEverBalanced}
                    highlight={guidedElement !== null && Object.keys(compound.atoms).includes(guidedElement)}
                  />
                  <span className="text-slate-200 text-lg">{renderFormula(compound.formula)}</span>
                  {showMoleculeVisual && (
                    <MoleculeVisual compound={compound} coefficient={productCoeffs[i]} />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Celebration overlay */}
        {showCelebration && (
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20 text-center animate-pulse">
            <p className="text-emerald-300 text-lg font-bold">Equation Balanced!</p>
            <p className="text-emerald-400/80 text-sm mt-1">
              Matter is conserved &mdash; nothing was created or destroyed, just rearranged!
            </p>
          </div>
        )}

        {/* Atom Counter + Balance Scale side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showAtomCounter && (
            <AtomCounterTable
              elements={allElements}
              reactantCounts={reactantAtomCounts}
              productCounts={productAtomCounts}
            />
          )}
          {showBalanceScale && (
            <BalanceScale
              reactantTotal={reactantTotal}
              productTotal={productTotal}
              balanced={balanced}
            />
          )}
        </div>

        {/* Guided Mode */}
        {showGuided && !balanced && (
          <Accordion type="single" collapsible>
            <AccordionItem value="guided" className="border-white/10">
              <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
                Need help? Try Guided Mode
              </AccordionTrigger>
              <AccordionContent>
                {guidedElement === null ? (
                  <div className="space-y-2">
                    <p className="text-slate-400 text-sm">
                      Guided mode walks you through balancing one element at a time.
                    </p>
                    <Button
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={startGuidedMode}
                    >
                      Start Guided Mode
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-amber-300 text-sm font-medium">
                      Focus on <span className="font-bold">{guidedElement}</span>:
                    </p>
                    <p className="text-slate-400 text-sm">
                      Reactants have <span className="text-slate-200 font-mono font-bold">{reactantAtomCounts[guidedElement] || 0}</span> {guidedElement} atoms.
                      Products have <span className="text-slate-200 font-mono font-bold">{productAtomCounts[guidedElement] || 0}</span> {guidedElement} atoms.
                      {(reactantAtomCounts[guidedElement] || 0) === (productAtomCounts[guidedElement] || 0)
                        ? ' They match!'
                        : ' Adjust coefficients to make them equal.'}
                    </p>
                    {(reactantAtomCounts[guidedElement] || 0) === (productAtomCounts[guidedElement] || 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                        onClick={advanceGuidedElement}
                      >
                        Next Element
                      </Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border text-sm ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
              : feedbackType === 'error'
                ? 'bg-red-500/10 border-red-400/20 text-red-300'
                : 'bg-slate-800/30 border-white/5 text-slate-400'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {showHistory && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={undo}
                  disabled={historyIndex < 0}
                >
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                >
                  Redo
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
              onClick={resetCoefficients}
            >
              Reset
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {balanced && hasEverBalanced && currentChallengeIndex < challenges.length - 1 && (
              <Button
                variant="ghost"
                className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
                onClick={handleNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {balanced && hasEverBalanced && currentChallengeIndex >= challenges.length - 1 && challenges.length > 0 && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
                onClick={handleNextChallenge}
              >
                Finish
              </Button>
            )}
            {!balanced && (
              <Button
                variant="ghost"
                className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
                onClick={handleCheckBalance}
              >
                Check Balance
              </Button>
            )}
          </div>
        </div>

        {/* Conservation of Mass Info */}
        <Accordion type="single" collapsible>
          <AccordionItem value="conservation" className="border-white/10">
            <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
              Why do we balance equations?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  <span className="text-slate-200 font-medium">Conservation of Mass:</span> In a chemical reaction,
                  atoms are never created or destroyed &mdash; they just rearrange into new combinations.
                </p>
                <p>
                  A balanced equation has the <span className="text-amber-300">same number of each type of atom</span> on
                  both sides. We change <span className="text-emerald-300">coefficients</span> (the big numbers in front)
                  to balance, but we never change <span className="text-red-300">subscripts</span> (the small numbers
                  inside formulas) &mdash; that would change the molecule itself!
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Completion summary */}
        {allChallengesComplete && (
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20">
            <p className="text-emerald-300 font-bold text-lg mb-2">All Challenges Complete!</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">Equations Balanced:</div>
              <div className="text-slate-200 font-mono">{equationsBalanced} / {challenges.length}</div>
              <div className="text-slate-400">Total Adjustments:</div>
              <div className="text-slate-200 font-mono">{totalAttemptsAll}</div>
              <div className="text-slate-400">Used Guided Mode:</div>
              <div className="text-slate-200">{usedGuidedMode ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EquationBalancer;
