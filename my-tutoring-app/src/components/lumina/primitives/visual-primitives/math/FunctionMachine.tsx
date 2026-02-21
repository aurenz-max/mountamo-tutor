'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FunctionMachineMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import CalculatorInput from '../../input-primitives/CalculatorInput';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface MachineConfig {
  id: string;
  rule: string;
  label?: string;
  showRule?: boolean;
}

export interface FunctionMachineChallenge {
  type: 'discover' | 'predict' | 'create' | 'chain';
  instruction: string;
  rule: string;
  showRule?: boolean;
  inputQueue?: number[];
  chainedRules?: string[];
  hint?: string;
}

export interface FunctionMachineData {
  title: string;
  description: string;
  rule?: string;
  showRule?: boolean;
  inputQueue?: number[];
  outputDisplay?: 'immediate' | 'animated' | 'hidden';
  chainable?: boolean;
  ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
  gradeBand?: '3-4' | '5' | 'advanced';
  chainedMachines?: MachineConfig[];
  challenges?: FunctionMachineChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FunctionMachineMetrics>) => void;
}

// ============================================================================
// Phase System
// ============================================================================

type Phase = 'observe' | 'predict' | 'discover' | 'create';

const PHASE_CONFIG: Record<Phase, { label: string; description: string; icon: string }> = {
  observe: { label: 'Observe', description: 'Watch inputs transform into outputs', icon: '👁️' },
  predict: { label: 'Predict', description: 'Guess the output before you see it', icon: '🔮' },
  discover: { label: 'Discover', description: 'Figure out the hidden rule', icon: '💡' },
  create: { label: 'Create', description: 'Build your own function machine', icon: '🛠️' },
};

const PHASES: Phase[] = ['observe', 'predict', 'discover', 'create'];

/** Phase type config for usePhaseResults hook (maps challenge types to display config). */
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  discover: { label: 'Discover', icon: '💡', accentColor: 'emerald' },
  predict: { label: 'Predict', icon: '🔮', accentColor: 'amber' },
  create: { label: 'Create', icon: '🛠️', accentColor: 'purple' },
  chain: { label: 'Chain', icon: '🔗', accentColor: 'blue' },
};

// ============================================================================
// Helpers
// ============================================================================

/** Safely evaluate a rule string at a given x value */
const evaluateRule = (rule: string, x: number): number | null => {
  if (!rule || !rule.trim()) return null;
  try {
    const expression = rule.replace(/x/g, String(x));
    if (!/^[\d+\-*/().^\s]+$/.test(expression)) return null;
    const safeExpression = expression.replace(/\^/g, '**');
    const result = new Function('return ' + safeExpression)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
};

/** Normalize rule strings for comparison */
const normalizeRule = (r: string): string => {
  if (!r) return '';
  return r.replace(/\s/g, '').toLowerCase().replace(/\*/g, '');
};

/** Grade-level label helper */
const gradeLabel = (band?: string): string => {
  switch (band) {
    case '3-4': return 'Grade 3';
    case '5': return 'Grade 5';
    case 'advanced': return 'Grade 7';
    default: return 'Grade 5';
  }
};

// ============================================================================
// Component
// ============================================================================

interface FunctionMachineProps {
  data: FunctionMachineData;
  className?: string;
}

const FunctionMachine: React.FC<FunctionMachineProps> = ({ data, className }) => {
  const {
    title,
    description,
    rule = '',
    showRule = false,
    inputQueue = [1, 2, 3, 4, 5],
    outputDisplay = 'animated',
    chainable = false,
    ruleComplexity = 'oneStep',
    gradeBand = '3-4',
    chainedMachines = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `function-machine-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge Progress (shared hook)
  // -------------------------------------------------------------------------
  const {
    currentIndex: _currentChallengeIndex,
    currentAttempts: _currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult: _recordResult,
    incrementAttempts: _incrementAttempts,
    advance: _advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => `${ch.type}-${ch.rule}`,
  });

  // -------------------------------------------------------------------------
  // Phase Results (shared hook — used when challenges are provided)
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [phase, setPhase] = useState<Phase>('observe');
  const [currentInput, setCurrentInput] = useState<number | null>(null);
  const [currentOutput, setCurrentOutput] = useState<number | null>(null);
  const [processedPairs, setProcessedPairs] = useState<Array<{ input: number; output: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableInputs, setAvailableInputs] = useState<number[]>(inputQueue);
  const [customInput, setCustomInput] = useState('');

  // Prediction state
  const [prediction, setPrediction] = useState('');
  const [predictionResult, setPredictionResult] = useState<'correct' | 'incorrect' | null>(null);
  const [predictionsCorrect, setPredictionsCorrect] = useState(0);
  const [predictionsTotal, setPredictionsTotal] = useState(0);

  // Discovery state
  const [guessedRule, setGuessedRule] = useState('');
  const [guessResult, setGuessResult] = useState<'correct' | 'incorrect' | null>(null);
  const [guessAttempts, setGuessAttempts] = useState(0);

  // Create state
  const [createdRule, setCreatedRule] = useState('');
  const [createTestInput, setCreateTestInput] = useState('');
  const [createPairs, setCreatePairs] = useState<Array<{ input: number; output: number }>>([]);

  // Chaining state
  const [activeChainMachines, setActiveChainMachines] = useState<MachineConfig[]>(
    chainedMachines.length > 0 ? chainedMachines : rule ? [{ id: 'machine-1', rule, label: 'Machine 1', showRule }] : []
  );
  const [chainResults, setChainResults] = useState<Array<{ machineId: string; input: number; output: number }>>([]);
  const [showChainView, setShowChainView] = useState(chainable && chainedMachines.length > 1);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FunctionMachineMetrics>({
    primitiveType: 'function-machine',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    rule,
    showRule,
    processedPairs,
    guessedRule,
    gradeBand,
    ruleComplexity,
    phase,
    pairsCount: processedPairs.length,
    predictionsCorrect,
    predictionsTotal,
    guessAttempts,
    ruleDiscovered: guessResult === 'correct',
    chainedMachineCount: activeChainMachines.length,
    isChaining: showChainView,
  }), [rule, showRule, processedPairs, guessedRule, gradeBand, ruleComplexity, phase,
       predictionsCorrect, predictionsTotal, guessAttempts, guessResult, activeChainMachines.length, showChainView]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'function-machine',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeLabel(gradeBand),
  });

  // Introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Function machine activity: "${title}". Rule: ${showRule ? rule : 'hidden'}. `
      + `Grade band: ${gradeBand}. Complexity: ${ruleComplexity}. `
      + `${showRule ? 'Learning mode — rule is visible.' : 'Discovery mode — student must figure out the rule.'} `
      + `Introduce the activity warmly and explain the first step.`,
      { silent: true }
    );
  }, [isConnected]);

  // -------------------------------------------------------------------------
  // Exploration-based Phase Summary (fallback when no challenges provided)
  // -------------------------------------------------------------------------
  // FunctionMachine's phase summary is computed from exploration state
  // (processedPairs, predictions, guessAttempts) rather than from challenge
  // results. When the challenges array is populated, usePhaseResults provides
  // the summary; otherwise this exploration-based computation is used.
  const explorationPhaseResults = useMemo(() => {
    if (!hasSubmittedEvaluation) return [];
    // If usePhaseResults produced results, defer to those
    if (phaseResults.length > 0) return [];

    const phases: Array<{
      label: string;
      score: number;
      attempts: number;
      firstTry: boolean;
      icon?: string;
      accentColor?: 'purple' | 'blue' | 'emerald' | 'amber' | 'cyan' | 'pink' | 'orange';
    }> = [];

    // Observe phase: score based on thoroughness of exploration
    const observeScore = processedPairs.length >= 5 ? 100
      : processedPairs.length >= 3 ? 85
      : processedPairs.length >= 2 ? 70
      : 50;
    phases.push({
      label: 'Observation',
      score: observeScore,
      attempts: processedPairs.length,
      firstTry: processedPairs.length >= 3,
      icon: '👁️',
      accentColor: 'blue',
    });

    // Predict phase: only include if the student made predictions
    if (predictionsTotal > 0) {
      const predictScore = Math.round((predictionsCorrect / predictionsTotal) * 100);
      phases.push({
        label: 'Prediction',
        score: predictScore,
        attempts: predictionsTotal,
        firstTry: predictionsCorrect === predictionsTotal,
        icon: '🔮',
        accentColor: 'amber',
      });
    }

    // Discover phase: score based on guess attempts
    const discoverScore = Math.max(50, 100 - ((guessAttempts - 1) * 10));
    phases.push({
      label: 'Rule Discovery',
      score: discoverScore,
      attempts: guessAttempts,
      firstTry: guessAttempts === 1,
      icon: '💡',
      accentColor: 'emerald',
    });

    return phases;
  }, [hasSubmittedEvaluation, phaseResults.length, processedPairs.length, predictionsTotal, predictionsCorrect, guessAttempts]);

  /** Resolved phase results: prefer hook-computed results, fall back to exploration-based. */
  const resolvedPhaseResults = phaseResults.length > 0 ? phaseResults : explorationPhaseResults;

  // -------------------------------------------------------------------------
  // Process value through the machine
  // -------------------------------------------------------------------------
  const processValue = useCallback(async (input: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setCurrentInput(input);
    setCurrentOutput(null);
    setAvailableInputs(prev => prev.filter(v => v !== input));

    await new Promise(resolve => setTimeout(resolve, 700));

    const output = evaluateRule(rule, input);
    if (output === null) {
      setIsProcessing(false);
      setCurrentInput(null);
      return;
    }

    setCurrentOutput(output);
    await new Promise(resolve => setTimeout(resolve, 500));

    const newPair = { input, output };
    setProcessedPairs(prev => [...prev, newPair]);

    // In predict phase, check prediction
    if (phase === 'predict' && prediction.trim()) {
      const predicted = parseFloat(prediction);
      const isCorrect = !isNaN(predicted) && Math.abs(predicted - output) < 0.01;
      setPredictionResult(isCorrect ? 'correct' : 'incorrect');
      setPredictionsTotal(t => t + 1);
      if (isCorrect) {
        setPredictionsCorrect(c => c + 1);
        sendText(`[PREDICTION_CORRECT] Student predicted output ${predicted} for input ${input}. Correct! Celebrate briefly.`, { silent: true });
      } else {
        sendText(`[PREDICTION_INCORRECT] Student predicted ${predicted} for input ${input}, but output is ${output}. Encourage and give a hint about the pattern.`, { silent: true });
      }
      setPrediction('');
    }

    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentInput(null);
    setCurrentOutput(null);
    setIsProcessing(false);

    // Phase progression hint
    if (phase === 'observe' && processedPairs.length + 1 >= 3) {
      sendText(`[PHASE_HINT] Student has observed ${processedPairs.length + 1} pairs. Suggest moving to Predict or Discover phase.`, { silent: true });
    }
  }, [isProcessing, rule, phase, prediction, processedPairs.length, sendText]);

  // -------------------------------------------------------------------------
  // Check rule guess
  // -------------------------------------------------------------------------
  const checkGuess = useCallback(() => {
    if (!guessedRule.trim() || !rule) return;
    setGuessAttempts(a => a + 1);

    // Check by normalizing AND by functional equivalence
    const normalizedGuess = normalizeRule(guessedRule);
    const normalizedActual = normalizeRule(rule);
    let isCorrect = normalizedGuess === normalizedActual;

    // Functional equivalence: test with multiple inputs
    if (!isCorrect) {
      const testInputs = [0, 1, 2, 3, 5, 10, -1];
      isCorrect = testInputs.every(x => {
        const expected = evaluateRule(rule, x);
        const guessed = evaluateRule(guessedRule, x);
        return expected !== null && guessed !== null && Math.abs(expected - guessed) < 0.01;
      });
    }

    setGuessResult(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      const observeScore = processedPairs.length >= 5 ? 100 : processedPairs.length >= 3 ? 85 : processedPairs.length >= 2 ? 70 : 50;
      const discoverScore = Math.max(50, 100 - (guessAttempts * 10));
      const predictScore = predictionsTotal > 0 ? Math.round((predictionsCorrect / predictionsTotal) * 100) : null;
      const overallScore = Math.max(50, 100 - (guessAttempts * 10));

      sendText(
        `[ALL_COMPLETE] Student discovered the rule after ${guessAttempts + 1} attempts! `
        + `They guessed "${guessedRule}", rule was "${rule}". `
        + `Phase scores: Observation ${observeScore}% (${processedPairs.length} pairs), `
        + `${predictScore !== null ? `Prediction ${predictScore}% (${predictionsCorrect}/${predictionsTotal}), ` : ''}`
        + `Discovery ${discoverScore}% (${guessAttempts + 1} attempts). `
        + `Overall: ${overallScore}%. Give encouraging phase-specific feedback and celebrate!`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        submitEvaluation(
          true,
          Math.max(50, 100 - (guessAttempts * 10)),
          {
            type: 'function-machine',
            functionRule: rule,
            ruleDiscovered: true,
            inputsExplored: processedPairs.map(p => p.input),
            outputsObserved: processedPairs.map(p => p.output),
            attemptsToDiscover: guessAttempts + 1,
            hintsUsed: 0,
            predictionsCorrect,
            predictionsTotal,
            phase,
            chainDepth: activeChainMachines.length > 1 ? activeChainMachines.length : undefined,
          },
        );
      }
    } else {
      sendText(
        `[GUESS_INCORRECT] Student guessed "${guessedRule}" but rule is "${rule}". `
        + `Attempt ${guessAttempts + 1}. Pairs seen: ${processedPairs.map(p => `${p.input}→${p.output}`).join(', ')}. `
        + `Give a targeted hint based on the pattern.`,
        { silent: true }
      );
    }
  }, [guessedRule, rule, guessAttempts, processedPairs, predictionsCorrect, predictionsTotal,
      phase, activeChainMachines.length, sendText, submitEvaluation, hasSubmittedEvaluation]);

  // -------------------------------------------------------------------------
  // Chain processing
  // -------------------------------------------------------------------------
  const processChain = useCallback(async (input: number) => {
    if (isProcessing || activeChainMachines.length < 2) return;
    setIsProcessing(true);
    setChainResults([]);

    let currentVal = input;
    const results: Array<{ machineId: string; input: number; output: number }> = [];

    for (const machine of activeChainMachines) {
      const output = evaluateRule(machine.rule, currentVal);
      if (output === null) break;
      results.push({ machineId: machine.id, input: currentVal, output });
      currentVal = output;
      setChainResults([...results]);
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    setChainResults(results);
    setIsProcessing(false);

    if (results.length === activeChainMachines.length) {
      const finalOutput = results[results.length - 1].output;
      sendText(
        `[CHAIN_COMPLETE] Input ${input} went through ${results.length} machines: `
        + results.map(r => `${r.input}→${r.output}`).join(', ')
        + `. Final output: ${finalOutput}. Ask what the combined rule might be.`,
        { silent: true }
      );
    }
  }, [isProcessing, activeChainMachines, sendText]);

  // -------------------------------------------------------------------------
  // Create phase: test student-created rule
  // -------------------------------------------------------------------------
  const testCreatedRule = useCallback(() => {
    const input = parseFloat(createTestInput);
    if (isNaN(input) || !createdRule.trim()) return;

    const output = evaluateRule(createdRule, input);
    if (output !== null) {
      setCreatePairs(prev => [...prev, { input, output }]);
      setCreateTestInput('');
      sendText(
        `[CREATE_TEST] Student created rule "${createdRule}" and tested input ${input} → output ${output}. `
        + `Encourage and ask about the pattern they created.`,
        { silent: true }
      );
    }
  }, [createTestInput, createdRule, sendText]);

  // -------------------------------------------------------------------------
  // Add custom input
  // -------------------------------------------------------------------------
  const addCustomInput = useCallback(() => {
    const value = parseFloat(customInput);
    if (!isNaN(value) && !availableInputs.includes(value)) {
      setAvailableInputs(prev => [...prev, value]);
      setCustomInput('');
    }
  }, [customInput, availableInputs]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------
  const reset = useCallback(() => {
    setProcessedPairs([]);
    setCurrentInput(null);
    setCurrentOutput(null);
    setGuessedRule('');
    setGuessResult(null);
    setGuessAttempts(0);
    setAvailableInputs(inputQueue);
    setPrediction('');
    setPredictionResult(null);
    setPredictionsCorrect(0);
    setPredictionsTotal(0);
    setCreatePairs([]);
    setCreatedRule('');
    setChainResults([]);
    setPhase('observe');
  }, [inputQueue]);

  // -------------------------------------------------------------------------
  // Phase advancement
  // -------------------------------------------------------------------------
  const advancePhase = useCallback(() => {
    const currentIdx = PHASES.indexOf(phase);
    if (currentIdx < PHASES.length - 1) {
      const nextPhase = PHASES[currentIdx + 1];
      setPhase(nextPhase);
      sendText(
        `[PHASE_CHANGE] Moving to "${nextPhase}" phase. `
        + `${PHASE_CONFIG[nextPhase].description}. `
        + `Guide the student on what to do next.`,
        { silent: true }
      );
    }
  }, [phase, sendText]);

  // -------------------------------------------------------------------------
  // Error: no rule configured
  // -------------------------------------------------------------------------
  if (!rule || !rule.trim()) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-red-500/20 ${className || ''}`}>
        <CardHeader>
          <CardTitle className="text-red-300">Configuration Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-200/80">No function rule provided. Please provide a valid rule (e.g., &quot;x + 3&quot;, &quot;2*x&quot;, &quot;x^2&quot;).</p>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className={`w-full max-w-6xl mx-auto my-8 space-y-6 ${className || ''}`}>
      {/* Header Card */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center border border-blue-400/40">
                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-slate-100">{title}</CardTitle>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-400/40 text-blue-300 text-xs">
                {gradeBand === '3-4' ? 'Grades 3-4' : gradeBand === '5' ? 'Grade 5' : 'Advanced'}
              </Badge>
              <Badge variant="outline" className="border-purple-400/40 text-purple-300 text-xs">
                {ruleComplexity === 'oneStep' ? 'One-Step' : ruleComplexity === 'twoStep' ? 'Two-Step' : 'Expression'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Phase Navigation */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {PHASES.map((p, idx) => {
              const config = PHASE_CONFIG[p];
              const isActive = p === phase;
              const isPast = PHASES.indexOf(p) < PHASES.indexOf(phase);
              const isNext = PHASES.indexOf(p) === PHASES.indexOf(phase) + 1;

              return (
                <React.Fragment key={p}>
                  {idx > 0 && (
                    <div className={`w-8 h-px ${isPast ? 'bg-green-400/60' : 'bg-slate-600/40'}`} />
                  )}
                  <button
                    onClick={() => {
                      setPhase(p);
                      sendText(`[PHASE_CHANGE] Student switched to "${p}" phase. ${config.description}. Guide them.`, { silent: true });
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : isPast
                        ? 'bg-green-500/10 border border-green-400/30 text-green-300'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                    }`}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Success Celebration */}
      {guessResult === 'correct' && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/50">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center border-2 border-yellow-300/50 shadow-[0_0_30px_rgba(250,204,21,0.4)]">
              <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-green-100 mb-2">Rule Discovered!</h3>
            <div className="inline-block px-6 py-3 bg-slate-900/50 border border-green-400/40 rounded-xl mb-4">
              <span className="text-sm text-green-300 font-mono">f(x) = </span>
              <span className="text-xl font-bold text-white font-mono">{rule}</span>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-green-200">{processedPairs.length}</div>
                <div className="text-green-300/70">Pairs Tested</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-200">{guessAttempts}</div>
                <div className="text-green-300/70">Attempts</div>
              </div>
              {predictionsTotal > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-green-200">{predictionsCorrect}/{predictionsTotal}</div>
                  <div className="text-green-300/70">Predictions</div>
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={reset} className="mt-6 bg-white/5 border border-white/20 hover:bg-white/10">
              Try Another Challenge
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase Summary Panel */}
      {hasSubmittedEvaluation && resolvedPhaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={resolvedPhaseResults}
          overallScore={submittedResult?.score}
          durationMs={elapsedMs}
          heading="Challenge Complete!"
          celebrationMessage="You explored the function machine and discovered the hidden rule!"
          className="mb-6"
        />
      )}

      {/* Machine Visualization (single or chain) */}
      {showChainView && activeChainMachines.length > 1 ? (
        /* ============= Chained Machines View ============= */
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
              <span>Chained Machines</span>
              <Badge variant="outline" className="border-purple-400/40 text-purple-300">
                {activeChainMachines.length} machines
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 overflow-x-auto py-4">
              {activeChainMachines.map((machine, idx) => (
                <React.Fragment key={machine.id}>
                  {idx > 0 && (
                    <div className="flex flex-col items-center flex-shrink-0">
                      <svg className="w-10 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 40 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12H36M28 6L36 12L28 18" />
                      </svg>
                      {chainResults[idx - 1] && (
                        <span className="text-xs text-purple-300 font-mono">{chainResults[idx - 1].output}</span>
                      )}
                    </div>
                  )}
                  <div className={`flex-shrink-0 w-36 h-36 rounded-xl border-2 flex flex-col items-center justify-center relative transition-all ${
                    chainResults.some(r => r.machineId === machine.id)
                      ? 'bg-green-500/10 border-green-400/40'
                      : 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-400/40'
                  }`}>
                    <div className="text-xs text-slate-400 font-mono mb-1">{machine.label || `Machine ${idx + 1}`}</div>
                    {machine.showRule ? (
                      <div className="text-lg font-bold text-white font-mono">f(x) = {machine.rule}</div>
                    ) : (
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                    {chainResults.find(r => r.machineId === machine.id) && (
                      <div className="mt-2 text-xs text-green-300 font-mono">
                        {chainResults.find(r => r.machineId === machine.id)!.input} → {chainResults.find(r => r.machineId === machine.id)!.output}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Chain input controls */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-400">Feed a value:</span>
              {[1, 2, 3, 4, 5].map(v => (
                <Button
                  key={v}
                  variant="ghost"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => processChain(v)}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-white font-mono"
                >
                  {v}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ============= Single Machine View ============= */
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-6 md:gap-8">
              {/* Input Hopper */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-blue-400 font-mono uppercase tracking-wider mb-2">Input</span>
                <div className="w-20 h-28 border-2 border-blue-400/40 rounded-t-lg bg-blue-500/10 relative flex items-center justify-center">
                  {currentInput !== null && (
                    <div className="w-11 h-11 rounded-full bg-blue-500/30 border-2 border-blue-400/60 flex items-center justify-center text-white font-bold animate-bounce text-sm">
                      {currentInput}
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <svg className="w-10 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 40 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12H36M28 6L36 12L28 18" />
              </svg>

              {/* Machine Body */}
              <div className="relative">
                <div className={`w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-400/40 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)] ${isProcessing ? 'border-blue-400/70' : ''}`}>
                  {isProcessing && <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />}
                  <div className="relative z-10 text-center px-3">
                    <div className="text-xs text-blue-300 font-mono mb-2 uppercase">Function Rule</div>
                    {showRule || guessResult === 'correct' ? (
                      <div className="text-xl font-bold text-white font-mono bg-slate-900/30 px-3 py-1.5 rounded-lg border border-blue-400/20">
                        f(x) = {rule}
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                    {isProcessing && (
                      <div className="text-blue-300 text-xs animate-pulse mt-2">Processing...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <svg className="w-10 h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 40 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12H36M28 6L36 12L28 18" />
              </svg>

              {/* Output Chute */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-purple-400 font-mono uppercase tracking-wider mb-2">Output</span>
                <div className="w-20 h-28 border-2 border-purple-400/40 rounded-b-lg bg-purple-500/10 relative flex items-center justify-center">
                  {currentOutput !== null && outputDisplay !== 'hidden' && (
                    <div className={`w-11 h-11 rounded-full bg-purple-500/30 border-2 border-purple-400/60 flex items-center justify-center text-white font-bold text-sm ${outputDisplay === 'animated' ? 'animate-bounce' : ''}`}>
                      {currentOutput}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Panel (predict phase) */}
      {phase === 'predict' && guessResult !== 'correct' && (
        <Card className="backdrop-blur-xl bg-amber-500/10 border-amber-400/30">
          <CardContent className="py-5">
            <h4 className="text-amber-200 font-semibold mb-3">Predict the Output</h4>
            <p className="text-sm text-amber-100/80 mb-4">
              Choose an input below, but first type your prediction for what the output will be!
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-amber-300 text-sm">My prediction:</span>
              <input
                type="text"
                value={prediction}
                onChange={(e) => { setPrediction(e.target.value); setPredictionResult(null); }}
                placeholder="?"
                className="w-24 px-3 py-2 bg-slate-800/50 text-white rounded-lg border border-amber-400/40 focus:border-amber-400 focus:outline-none text-center font-mono"
              />
              {predictionResult === 'correct' && (
                <Badge className="bg-green-500/20 text-green-300 border-green-400/40">Correct!</Badge>
              )}
              {predictionResult === 'incorrect' && (
                <Badge className="bg-red-500/20 text-red-300 border-red-400/40">Not quite</Badge>
              )}
              {predictionsTotal > 0 && (
                <span className="text-xs text-amber-300/70 ml-auto">{predictionsCorrect}/{predictionsTotal} correct</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Queue */}
      {(phase === 'observe' || phase === 'predict') && guessResult !== 'correct' && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400">Available Inputs</h4>
              {availableInputs.length > 0 && (
                <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-xs">
                  {availableInputs.length} remaining
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              {availableInputs.length > 0 ? (
                availableInputs.map((value, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    disabled={isProcessing || (phase === 'predict' && !prediction.trim())}
                    onClick={() => processValue(value)}
                    className="bg-blue-500/15 border border-blue-400/40 hover:bg-blue-500/30 text-white font-bold"
                  >
                    {value}
                  </Button>
                ))
              ) : (
                <p className="text-slate-400 text-sm">All inputs used. Add a custom value or advance to the next phase.</p>
              )}
            </div>
            <div className="max-w-xs">
              <CalculatorInput
                label="Custom Value"
                value={customInput}
                onChange={setCustomInput}
                onSubmit={addCustomInput}
                placeholder="0"
                showSubmitButton={true}
                allowNegative={true}
                allowDecimal={true}
                maxLength={10}
                disabled={isProcessing}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processed Pairs */}
      {processedPairs.length > 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400">Input → Output Pairs</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-300/70">{processedPairs.length} tested</span>
                {!showRule && processedPairs.length >= 2 && guessResult !== 'correct' && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse text-xs">
                    Ready to guess!
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {processedPairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-600/30 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-blue-300 font-bold">{pair.input}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-purple-300 font-bold">{pair.output}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discover Phase: Guess the Rule */}
      {(phase === 'discover' || (processedPairs.length >= 2 && phase !== 'create')) && !showRule && guessResult !== 'correct' && (
        <Card className="backdrop-blur-xl bg-amber-500/10 border-amber-400/30">
          <CardContent className="py-5">
            <h4 className="text-amber-200 font-semibold mb-3 text-center">Can you guess the rule?</h4>
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <span className="text-amber-300 font-mono">f(x) =</span>
              <input
                type="text"
                value={guessedRule}
                onChange={(e) => { setGuessedRule(e.target.value); setGuessResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && checkGuess()}
                placeholder="e.g., x + 3"
                className="flex-1 max-w-xs px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-amber-400/40 focus:border-amber-400 focus:outline-none font-mono"
              />
              <Button
                variant="ghost"
                onClick={checkGuess}
                className="bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-amber-200"
              >
                Check
              </Button>
            </div>
            {guessResult === 'incorrect' && (
              <>
                <div className="mt-3 p-3 bg-red-500/15 border border-red-400/30 rounded-lg text-center">
                  <span className="text-red-200 text-sm">Not quite! Study the pairs more carefully. {guessAttempts >= 3 ? 'Try looking at the difference between inputs and outputs.' : ''}</span>
                </div>
                <div className="mt-2 text-center text-xs text-slate-500">{guessAttempts} attempt{guessAttempts !== 1 ? 's' : ''} so far</div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Phase */}
      {phase === 'create' && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-5">
            <h4 className="text-slate-100 font-semibold mb-3">Create Your Own Function Machine</h4>
            <p className="text-sm text-slate-400 mb-4">
              Write a rule and test it with different inputs. See what patterns emerge!
            </p>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-blue-300 font-mono">f(x) =</span>
              <input
                type="text"
                value={createdRule}
                onChange={(e) => setCreatedRule(e.target.value)}
                placeholder="e.g., 2*x + 1"
                className="flex-1 max-w-xs px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-blue-400/40 focus:border-blue-400 focus:outline-none font-mono"
              />
            </div>
            {createdRule.trim() && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-sm text-slate-400">Test input:</span>
                <input
                  type="text"
                  value={createTestInput}
                  onChange={(e) => setCreateTestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && testCreatedRule()}
                  placeholder="x"
                  className="w-20 px-3 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-600/40 focus:border-blue-400 focus:outline-none text-center font-mono"
                />
                <Button
                  variant="ghost"
                  onClick={testCreatedRule}
                  className="bg-white/5 border border-white/20 hover:bg-white/10"
                >
                  Run
                </Button>
              </div>
            )}
            {createPairs.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {createPairs.map((pair, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-800/40 border border-slate-600/30 text-center text-sm">
                    <span className="text-blue-300 font-mono">{pair.input}</span>
                    <span className="text-slate-500 mx-1">→</span>
                    <span className="text-purple-300 font-mono">{pair.output}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chain toggle & controls */}
      {chainable && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="text-sm text-slate-300">Machine Chaining</h4>
                <Badge variant="outline" className="border-purple-400/30 text-purple-300 text-xs">
                  Composition
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!showChainView && activeChainMachines.length < 2) {
                    setActiveChainMachines(prev => [
                      ...prev,
                      { id: `machine-${prev.length + 1}`, rule: 'x + 1', label: `Machine ${prev.length + 1}`, showRule: true }
                    ]);
                  }
                  setShowChainView(!showChainView);
                }}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-sm"
              >
                {showChainView ? 'Single View' : 'Chain View'}
              </Button>
            </div>
            {showChainView && (
              <div className="mt-3 text-xs text-slate-400">
                Output of each machine becomes the input for the next. This is function composition: g(f(x)).
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How to Use (first time) */}
      {processedPairs.length === 0 && phase === 'observe' && guessResult !== 'correct' && (
        <Card className="backdrop-blur-xl bg-amber-500/5 border-amber-400/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/30 flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
              <div>
                <h4 className="text-amber-200 font-medium text-sm mb-1">How it works</h4>
                <ol className="text-xs text-amber-100/80 space-y-1 list-decimal list-inside">
                  <li>Click an input number to feed it into the machine</li>
                  <li>Watch the machine process it and produce an output</li>
                  <li>Study the input → output patterns to discover the hidden rule</li>
                  <li>Use the phase tabs above to guide your exploration</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls Bar */}
      {guessResult !== 'correct' && (
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            variant="ghost"
            onClick={reset}
            className="bg-red-500/15 border border-red-400/30 hover:bg-red-500/25 text-red-200"
          >
            Reset
          </Button>
          {PHASES.indexOf(phase) < PHASES.length - 1 && (
            <Button
              variant="ghost"
              onClick={advancePhase}
              className="bg-blue-500/15 border border-blue-400/30 hover:bg-blue-500/25 text-blue-200"
            >
              Next Phase: {PHASE_CONFIG[PHASES[PHASES.indexOf(phase) + 1]].label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default FunctionMachine;
