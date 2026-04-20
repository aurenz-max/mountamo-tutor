'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import type { StoichiometryLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface StoichSubstance {
  formula: string;
  molarMass: number;
  coefficient: number;
}

export interface StoichReaction {
  equation: string;
  reactants: StoichSubstance[];
  products: StoichSubstance[];
}

export type StoichChallengeType = 'convert' | 'limiting' | 'yield';

export interface StoichChallenge {
  id: string;
  type: StoichChallengeType;
  instruction: string;
  hint: string;
  narration: string;
  askFor: string;

  givenFormulaA: string;
  givenMassA: number;
  givenFormulaB: string | null;
  givenMassB: number | null;

  /** For convert/yield: numeric answer (g or mol). For limiting: ignored. */
  targetAnswer: number;
  /** For convert/yield: which substance the numeric answer refers to. */
  answerFormula: string | null;
  /** For convert/yield: 'g' or 'mol'. */
  answerUnit: 'g' | 'mol' | null;
  /** Acceptable +/- range on numeric answer. */
  tolerance: number;
  /** For limiting: which formula is the limiting reagent. */
  targetAnswerFormula: string | null;
  /** For yield: actual experimental yield in grams. If present, student computes percent yield. */
  actualYield: number | null;
}

export interface StoichShowOptions {
  showMoleLadder: boolean;
  showLeftovers: boolean;
  showRatioStrip: boolean;
  showPercentYield: boolean;
}

export interface StoichiometryLabData {
  title: string;
  description?: string;
  reaction: StoichReaction;
  challenges: StoichChallenge[];
  showOptions?: Partial<StoichShowOptions>;
  gradeBand?: '8' | '9-10' | '11-12';

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoichiometryLabMetrics>) => void;
}

// ============================================================================
// Phase config (shared challenge progression)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  convert:  { label: 'Convert',         icon: '⚖️', accentColor: 'blue' },
  limiting: { label: 'Limiting Reagent', icon: '🧪', accentColor: 'amber' },
  yield:    { label: 'Yield',            icon: '📈', accentColor: 'emerald' },
};

// ============================================================================
// Helpers
// ============================================================================

function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(digits);
}

/** Render chemical formula with subscripts. */
function renderFormula(formula: string): React.ReactNode {
  if (!formula) return null;
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < formula.length) {
    const char = formula[i];
    if (/\d/.test(char) && i > 0 && /[a-zA-Z)]/.test(formula[i - 1])) {
      parts.push(<sub key={i} className="text-[0.75em]">{char}</sub>);
    } else {
      parts.push(<span key={i}>{char}</span>);
    }
    i++;
  }
  return <span className="font-mono">{parts}</span>;
}

/** Find a substance by formula across reactants and products. */
function findSubstance(reaction: StoichReaction, formula: string): StoichSubstance | null {
  return [...reaction.reactants, ...reaction.products].find(s => s.formula === formula) ?? null;
}

/** Compute moles from grams given molar mass. */
function gramsToMoles(grams: number, molarMass: number): number {
  if (!molarMass) return 0;
  return grams / molarMass;
}

/** Compute grams from moles given molar mass. */
function molesToGrams(moles: number, molarMass: number): number {
  return moles * molarMass;
}

/** Determine the limiting reagent and how many moles of each product can form. */
interface ReactionResult {
  limitingFormula: string;
  excessFormula: string;
  productMoles: Record<string, number>;
  productGrams: Record<string, number>;
  leftoverMolesByFormula: Record<string, number>;
  leftoverGramsByFormula: Record<string, number>;
}

function computeReactionOutcome(
  reaction: StoichReaction,
  reactantMasses: Record<string, number>,
): ReactionResult | null {
  if (reaction.reactants.length < 1) return null;

  // Compute moles per reactant and "extents" (moles available / coefficient)
  const extents: { formula: string; moles: number; extent: number; coefficient: number }[] = [];
  for (const r of reaction.reactants) {
    const mass = reactantMasses[r.formula] ?? 0;
    const moles = gramsToMoles(mass, r.molarMass);
    const extent = r.coefficient > 0 ? moles / r.coefficient : 0;
    extents.push({ formula: r.formula, moles, extent, coefficient: r.coefficient });
  }

  // Limiting reagent has the smallest extent
  const limiting = extents.reduce((a, b) => (a.extent <= b.extent ? a : b));
  const excess = extents.reduce((a, b) => (a.extent >= b.extent ? a : b));
  const reactionExtent = limiting.extent;

  // Products formed
  const productMoles: Record<string, number> = {};
  const productGrams: Record<string, number> = {};
  for (const p of reaction.products) {
    const moles = reactionExtent * p.coefficient;
    productMoles[p.formula] = moles;
    productGrams[p.formula] = molesToGrams(moles, p.molarMass);
  }

  // Leftovers
  const leftoverMolesByFormula: Record<string, number> = {};
  const leftoverGramsByFormula: Record<string, number> = {};
  for (const r of extents) {
    const consumed = reactionExtent * r.coefficient;
    const leftoverMoles = Math.max(0, r.moles - consumed);
    const sub = reaction.reactants.find(x => x.formula === r.formula);
    leftoverMolesByFormula[r.formula] = leftoverMoles;
    leftoverGramsByFormula[r.formula] = sub ? molesToGrams(leftoverMoles, sub.molarMass) : 0;
  }

  return {
    limitingFormula: limiting.formula,
    excessFormula: excess.formula,
    productMoles,
    productGrams,
    leftoverMolesByFormula,
    leftoverGramsByFormula,
  };
}

// ============================================================================
// Sub-components
// ============================================================================

const EquationStrip: React.FC<{ reaction: StoichReaction }> = ({ reaction }) => (
  <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
    <div className="flex items-center justify-center flex-wrap gap-3 text-slate-100 text-lg">
      {reaction.reactants.map((r, i) => (
        <React.Fragment key={`r-${i}`}>
          {i > 0 && <span className="text-slate-500 text-xl font-light">+</span>}
          <div className="flex flex-col items-center">
            <span className="text-amber-300 font-bold text-base">{r.coefficient}</span>
            <span>{renderFormula(r.formula)}</span>
            <span className="text-slate-500 text-xs">{r.molarMass} g/mol</span>
          </div>
        </React.Fragment>
      ))}
      <span className="text-slate-300 text-2xl mx-2">→</span>
      {reaction.products.map((p, i) => (
        <React.Fragment key={`p-${i}`}>
          {i > 0 && <span className="text-slate-500 text-xl font-light">+</span>}
          <div className="flex flex-col items-center">
            <span className="text-emerald-300 font-bold text-base">{p.coefficient}</span>
            <span>{renderFormula(p.formula)}</span>
            <span className="text-slate-500 text-xs">{p.molarMass} g/mol</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const MoleLadder: React.FC<{
  formula: string;
  grams: number;
  molarMass: number;
}> = ({ formula, grams, molarMass }) => {
  const moles = gramsToMoles(grams, molarMass);
  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">📐</span>
        <span className="text-slate-300 text-sm font-medium">
          Mole Ladder · {renderFormula(formula)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm gap-2">
        <div className="flex flex-col items-center bg-slate-900/40 rounded-md px-3 py-2 flex-1 border border-white/5">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Mass</span>
          <span className="text-slate-100 font-mono font-bold">{formatNum(grams)} g</span>
        </div>
        <div className="text-slate-500 text-xs flex flex-col items-center">
          <span>÷ {molarMass}</span>
          <span className="text-slate-600">g/mol</span>
        </div>
        <div className="flex flex-col items-center bg-slate-900/40 rounded-md px-3 py-2 flex-1 border border-white/5">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Moles</span>
          <span className="text-emerald-300 font-mono font-bold">{formatNum(moles, 3)} mol</span>
        </div>
      </div>
    </div>
  );
};

const RatioStrip: React.FC<{ reaction: StoichReaction }> = ({ reaction }) => (
  <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">🔢</span>
      <span className="text-slate-300 text-sm font-medium">Mole Ratios from Coefficients</span>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-slate-200 text-sm font-mono">
      {[...reaction.reactants, ...reaction.products].map((s, i, arr) => (
        <React.Fragment key={`ratio-${i}`}>
          <span className="bg-slate-900/40 rounded px-2 py-1 border border-white/5">
            {s.coefficient} {renderFormula(s.formula)}
          </span>
          {i < arr.length - 1 && <span className="text-slate-500">:</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ============================================================================
// Component
// ============================================================================

interface StoichiometryLabProps {
  data: StoichiometryLabData;
  className?: string;
}

const StoichiometryLab: React.FC<StoichiometryLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    reaction,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '9-10',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showMoleLadder = true,
    showLeftovers = true,
    showRatioStrip = true,
    showPercentYield = gradeBand === '11-12',
  } = showOptionsProp;

  // -------------------------------------------------------------------------
  // Shared progression hooks
  // -------------------------------------------------------------------------

  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress<StoichChallenge>({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults<StoichChallenge>({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------

  type Phase = 'stage' | 'reconcile';
  const [phase, setPhase] = useState<Phase>('stage');
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [studentLimitingChoice, setStudentLimitingChoice] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult | null>(null);

  // Reset per-challenge state when challenge changes
  const prevChallengeIdRef = useRef(currentChallenge?.id);
  useEffect(() => {
    if (prevChallengeIdRef.current !== currentChallenge?.id) {
      prevChallengeIdRef.current = currentChallenge?.id;
      setPhase('stage');
      setStudentAnswer('');
      setStudentLimitingChoice('');
      setFeedback('');
      setFeedbackType('');
      setOpenAccordions([]);
    }
  }, [currentChallenge?.id]);

  // -------------------------------------------------------------------------
  // Computed reaction outcome from given masses
  // -------------------------------------------------------------------------

  const givenMasses = useMemo<Record<string, number>>(() => {
    if (!currentChallenge) return {};
    const m: Record<string, number> = {};
    if (currentChallenge.givenFormulaA) m[currentChallenge.givenFormulaA] = currentChallenge.givenMassA;
    if (currentChallenge.givenFormulaB) m[currentChallenge.givenFormulaB] = currentChallenge.givenMassB ?? 0;
    return m;
  }, [currentChallenge]);

  // For "convert" challenges with only one given mass, we need a sensible
  // default for the other reactant when computing the reaction outcome
  // (we use a stoichiometric excess so the given reactant is limiting).
  const reactionOutcome = useMemo(() => {
    if (!currentChallenge) return null;
    const masses: Record<string, number> = { ...givenMasses };
    // For challenges with only one mass, fill in stoichiometric excess for others
    if (currentChallenge.type === 'convert') {
      const givenSub = findSubstance(reaction, currentChallenge.givenFormulaA);
      if (givenSub) {
        const givenMoles = gramsToMoles(currentChallenge.givenMassA, givenSub.molarMass);
        for (const r of reaction.reactants) {
          if (r.formula !== currentChallenge.givenFormulaA && masses[r.formula] === undefined) {
            // Excess: use 10x stoichiometric requirement
            const requiredMoles = (givenMoles / (givenSub.coefficient || 1)) * r.coefficient;
            masses[r.formula] = molesToGrams(requiredMoles * 10, r.molarMass);
          }
        }
      }
    }
    return computeReactionOutcome(reaction, masses);
  }, [reaction, currentChallenge, givenMasses]);

  // -------------------------------------------------------------------------
  // Refs / evaluation hook
  // -------------------------------------------------------------------------

  const stableInstanceIdRef = useRef(instanceId || `stoichiometry-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startedAtRef = useRef(Date.now());

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<StoichiometryLabMetrics>({
    primitiveType: 'stoichiometry-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI tutoring
  // -------------------------------------------------------------------------

  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    title,
    equation: reaction.equation,
    challengeType: currentChallenge?.type ?? 'convert',
    challengeIndex: currentChallengeIndex,
    totalChallenges: challenges.length,
    instruction: currentChallenge?.instruction ?? '',
    askFor: currentChallenge?.askFor ?? '',
    givenFormulaA: currentChallenge?.givenFormulaA ?? '',
    givenMassA: currentChallenge?.givenMassA ?? 0,
    givenFormulaB: currentChallenge?.givenFormulaB ?? null,
    givenMassB: currentChallenge?.givenMassB ?? null,
    answerFormula: currentChallenge?.answerFormula ?? null,
    answerUnit: currentChallenge?.answerUnit ?? null,
    targetAnswer: currentChallenge?.targetAnswer ?? null,
    targetAnswerFormula: currentChallenge?.targetAnswerFormula ?? null,
    limitingReagent: reactionOutcome?.limitingFormula ?? null,
    productYieldGrams: reactionOutcome?.productGrams ?? {},
    leftoversGrams: reactionOutcome?.leftoverGramsByFormula ?? {},
    studentAnswer,
    studentLimitingChoice,
    phase,
    openAccordions,
    hasOpenedReactionOutput: openAccordions.includes('reaction-output'),
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, title, reaction.equation, currentChallenge, currentChallengeIndex,
    challenges.length, reactionOutcome, studentAnswer, studentLimitingChoice, phase,
    openAccordions, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'stoichiometry-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '8' ? 'Grade 8' : gradeBand === '9-10' ? 'Grade 9-10' : 'Grade 11-12',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Stoichiometry Lab "${title}" for ${gradeBand}. `
      + `Reaction: ${reaction.equation}. The student is on challenge ${currentChallengeIndex + 1} of ${challenges.length} `
      + `(type: ${currentChallenge.type}). Walk them through the mole-map approach: grams → moles → ratio → moles → grams.`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, reaction.equation, currentChallenge, currentChallengeIndex, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------

  const handleAccordionChange = useCallback((values: string[]) => {
    const wasReactionOpen = openAccordions.includes('reaction-output');
    const isReactionOpen = values.includes('reaction-output');
    setOpenAccordions(values);
    if (!wasReactionOpen && isReactionOpen) {
      sendText(
        `[REACTION_VIEW] Student opened the reaction output view. `
        + `Limiting reagent (computed): ${reactionOutcome?.limitingFormula ?? '—'}. `
        + `Help them interpret the products and leftovers.`,
        { silent: true }
      );
    }
  }, [openAccordions, reactionOutcome, sendText]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    let correct = false;
    let feedbackMsg = '';

    if (currentChallenge.type === 'limiting') {
      const choice = studentLimitingChoice.trim();
      const expected = (currentChallenge.targetAnswerFormula ?? '').trim();
      correct = choice !== '' && choice === expected;
      feedbackMsg = correct
        ? `Yes — ${expected} is the limiting reagent. It runs out first and caps the products formed.`
        : `Not quite. The limiting reagent is the one whose moles ÷ coefficient is smallest. Try the mole math again.`;
    } else {
      const num = parseFloat(studentAnswer);
      if (!Number.isFinite(num)) {
        setFeedback('Type a numeric answer first.');
        setFeedbackType('error');
        return;
      }
      const target = currentChallenge.targetAnswer;
      const tol = currentChallenge.tolerance > 0 ? currentChallenge.tolerance : Math.max(0.05 * Math.abs(target), 0.01);
      correct = Math.abs(num - target) <= tol;
      const unitLabel = currentChallenge.answerUnit === 'mol' ? 'mol' : currentChallenge.type === 'yield' && currentChallenge.actualYield != null ? '%' : 'g';
      feedbackMsg = correct
        ? `Correct! ${formatNum(target)} ${unitLabel}. ${currentChallenge.narration}`
        : `Not quite. Expected about ${formatNum(target)} ${unitLabel} (±${formatNum(tol)}). ${currentChallenge.hint}`;
    }

    setFeedback(feedbackMsg);
    setFeedbackType(correct ? 'success' : 'error');
    setPhase('reconcile');

    if (correct) {
      setOpenAccordions(['mole-ladder', 'ratios', 'reaction-output']);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student got challenge ${currentChallenge.id} (${currentChallenge.type}) on attempt ${currentAttempts + 1}. `
        + `Reinforce the mole-map reasoning briefly.`,
        { silent: true }
      );
    } else {
      sendText(
        `[ANSWER_INCORRECT] Student answered "${studentAnswer || studentLimitingChoice}" for ${currentChallenge.type} challenge. `
        + `Correct: ${currentChallenge.type === 'limiting' ? currentChallenge.targetAnswerFormula : currentChallenge.targetAnswer}. `
        + `Attempt ${currentAttempts + 1}. Give a hint that walks one step of the mole-map: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [
    currentChallenge, studentAnswer, studentLimitingChoice, currentAttempts,
    incrementAttempts, recordResult, sendText,
  ]);

  const handleAdvance = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done — submit evaluation
      const correctCount = challengeResults.filter(r => r.correct).length;
      const total = challenges.length;
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

      const convertResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'convert'
      );
      const limitingResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'limiting'
      );
      const yieldResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'yield'
      );

      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');

      sendText(
        `[ALL_COMPLETE] Stoichiometry Lab finished. Phase scores: ${phaseScoreStr}. Overall: ${score}%. `
        + `Celebrate progress and call out which step of the mole-map (grams→moles, ratio, moles→grams) the student handled best.`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const result = submitEvaluation(
          score >= 50,
          score,
          {
            type: 'stoichiometry-lab',
            challengesCorrect: correctCount,
            challengesTotal: total,
            convertCorrect: convertResults.filter(r => r.correct).length,
            convertTotal: challenges.filter(c => c.type === 'convert').length,
            limitingReagentCorrect: limitingResults.filter(r => r.correct).length,
            limitingReagentTotal: challenges.filter(c => c.type === 'limiting').length,
            yieldWithinTolerance: yieldResults.filter(r => r.correct).length,
            yieldTotal: challenges.filter(c => c.type === 'yield').length,
            attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          },
          { challengeResults },
        );
        if (result) setSubmittedResult(result);
      }
      return;
    }

    // Reset per-challenge state for next challenge
    setPhase('stage');
    setStudentAnswer('');
    setStudentLimitingChoice('');
    setFeedback('');
    setFeedbackType('');

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
      + `Type: ${challenges[currentChallengeIndex + 1]?.type}. Set the stage briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, challengeResults, challenges, hasSubmittedEvaluation, submitEvaluation,
    phaseResults, sendText, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const elapsedMs = Date.now() - startedAtRef.current;
  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardHeader>
          <CardTitle className="text-slate-100">{title}</CardTitle>
          {description && <CardDescription className="text-slate-400">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const reactantA = findSubstance(reaction, currentChallenge.givenFormulaA);
  const reactantB = currentChallenge.givenFormulaB
    ? findSubstance(reaction, currentChallenge.givenFormulaB)
    : null;
  const isLimitingType = currentChallenge.type === 'limiting';
  const limitingOptions = isLimitingType
    ? [currentChallenge.givenFormulaA, currentChallenge.givenFormulaB].filter(
        (f): f is string => typeof f === 'string' && f.length > 0,
      )
    : [];

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">⚗️</span>
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-slate-400 text-sm mt-1">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
              Grade {gradeBand}
            </Badge>
            <Badge className="bg-slate-700/40 text-slate-300 border-white/10 text-xs">
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.label ?? currentChallenge.type}
            </Badge>
          </div>
        </div>

        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs">Challenge</span>
            {challenges.map((ch, i) => (
              <div
                key={ch.id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                  challengeResults.some(r => r.challengeId === ch.id && r.correct)
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
        {/* Equation strip — always-visible reference */}
        <EquationStrip reaction={reaction} />

        {/* Instruction + ask */}
        <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
          <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          <p className="text-indigo-300/80 text-xs mt-1">
            <span className="text-indigo-400 font-semibold">Find: </span>
            {currentChallenge.askFor}
          </p>
        </div>

        {/* Given — compact chips (no conversion shown yet) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 text-[10px] uppercase tracking-wider">Given</span>
          {reactantA && (
            <Badge className="bg-blue-500/15 text-blue-200 border-blue-400/30 text-sm font-mono">
              {currentChallenge.givenMassA} g {renderFormula(reactantA.formula)}
            </Badge>
          )}
          {reactantB && currentChallenge.givenMassB != null && (
            <Badge className="bg-blue-500/15 text-blue-200 border-blue-400/30 text-sm font-mono">
              {currentChallenge.givenMassB} g {renderFormula(reactantB.formula)}
            </Badge>
          )}
          {showPercentYield && currentChallenge.type === 'yield' && currentChallenge.actualYield != null && (
            <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/30 text-sm font-mono">
              Actual yield: {formatNum(currentChallenge.actualYield)} g
            </Badge>
          )}
        </div>

        {/* Scaffolding tools — progressive disclosure */}
        <Accordion
          type="multiple"
          value={openAccordions}
          onValueChange={handleAccordionChange}
          className="space-y-2"
        >
          {showMoleLadder && (
            <AccordionItem value="mole-ladder" className="border border-white/10 rounded-lg bg-slate-800/30 px-3">
              <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100 hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <span>📐</span>
                  <span>Step 1 · Convert mass to moles</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  {reactantA && (
                    <MoleLadder
                      formula={reactantA.formula}
                      grams={currentChallenge.givenMassA}
                      molarMass={reactantA.molarMass}
                    />
                  )}
                  {reactantB && currentChallenge.givenMassB != null && (
                    <MoleLadder
                      formula={reactantB.formula}
                      grams={currentChallenge.givenMassB}
                      molarMass={reactantB.molarMass}
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {showRatioStrip && (
            <AccordionItem value="ratios" className="border border-white/10 rounded-lg bg-slate-800/30 px-3">
              <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100 hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <span>🔢</span>
                  <span>Step 2 · Mole ratios from coefficients</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <RatioStrip reaction={reaction} />
              </AccordionContent>
            </AccordionItem>
          )}

          {reactionOutcome && (
            <AccordionItem value="reaction-output" className="border border-white/10 rounded-lg bg-slate-800/30 px-3">
              <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100 hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <span>🧪</span>
                  <span>Step 3 · Run the reaction</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs">Limiting reagent:</span>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[10px]">
                    {renderFormula(reactionOutcome.limitingFormula)}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {reaction.products.map(p => (
                    <div key={p.formula} className="bg-slate-900/40 rounded px-3 py-2 border border-white/5">
                      <div className="text-slate-400 text-xs">Product {renderFormula(p.formula)}</div>
                      <div className="text-emerald-300 font-mono font-bold">
                        {formatNum(reactionOutcome.productGrams[p.formula] ?? 0)} g
                      </div>
                      <div className="text-slate-500 text-xs">
                        ({formatNum(reactionOutcome.productMoles[p.formula] ?? 0, 3)} mol)
                      </div>
                    </div>
                  ))}
                </div>
                {showLeftovers && (
                  <div className="text-xs text-slate-400">
                    Leftover reactants:{' '}
                    {Object.entries(reactionOutcome.leftoverGramsByFormula)
                      .filter(([, g]) => g > 0.001)
                      .map(([f, g]) => `${formatNum(g)} g of ${f}`)
                      .join(', ') || 'none — all consumed!'}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Answer input — visible while attempting */}
        {phase === 'stage' && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5 space-y-2">
            <div className="text-slate-300 text-sm font-medium">Your answer:</div>
            {isLimitingType ? (
              <div className="flex flex-wrap gap-2">
                {limitingOptions.map(formula => (
                  <Button
                    key={formula}
                    variant="ghost"
                    className={`bg-white/5 border hover:bg-white/10 ${
                      studentLimitingChoice === formula
                        ? 'border-amber-400/50 text-amber-300'
                        : 'border-white/20 text-slate-200'
                    }`}
                    onClick={() => setStudentLimitingChoice(formula)}
                  >
                    {renderFormula(formula)}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Enter a number"
                  className="bg-slate-900/60 border-white/10 text-slate-100 max-w-xs"
                />
                <span className="text-slate-400 text-sm">
                  {currentChallenge.answerUnit === 'mol' ? 'mol' :
                    currentChallenge.type === 'yield' && currentChallenge.actualYield != null ? '%' : 'g'}
                  {currentChallenge.answerFormula && (
                    <> of {renderFormula(currentChallenge.answerFormula)}</>
                  )}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
              onClick={handleCheckAnswer}
            >
              Check Answer
            </Button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border text-sm ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
              : 'bg-red-500/10 border-red-400/20 text-red-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Advance */}
        {phase === 'reconcile' && feedbackType === 'success' && !allChallengesComplete && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
              onClick={handleAdvance}
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Try again on incorrect */}
        {phase === 'reconcile' && feedbackType === 'error' && (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={() => {
                setPhase('stage');
                setFeedback('');
                setFeedbackType('');
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Phase summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Stoichiometry Lab Complete!"
            celebrationMessage="You walked the mole-map across every challenge."
            className="mb-2"
          />
        )}

        {/* Mole map info */}
        <Accordion type="single" collapsible>
          <AccordionItem value="mole-map" className="border-white/10">
            <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
              Why we use the mole map
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  <span className="text-slate-200 font-medium">grams → moles → moles → grams.</span>{' '}
                  Mass alone can't tell you how a reaction will run — you need to count particles.
                  Convert mass to moles using molar mass, use the balanced equation's coefficients
                  as a mole-to-mole ratio, then convert back to mass.
                </p>
                <p>
                  The <span className="text-amber-300">limiting reagent</span> is whichever reactant runs out first
                  (smallest moles ÷ coefficient). The other reactant has leftovers and is "in excess".
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default StoichiometryLab;
