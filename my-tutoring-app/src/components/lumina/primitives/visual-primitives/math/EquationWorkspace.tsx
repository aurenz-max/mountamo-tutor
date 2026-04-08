'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EquationWorkspaceMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EquationWorkspaceSolutionStep {
  operation: string;
  operationId: string;
  resultLatex: string;
}

export interface EquationWorkspaceOperation {
  id: string;
  label: string;
  category: 'arithmetic' | 'algebraic' | 'trigonometric' | 'logarithmic' | 'radical';
}

export interface EquationWorkspaceChallenge {
  id: string;
  type: 'guided-solve' | 'solve' | 'multi-step' | 'identify-operation';
  instruction: string;
  equation: string;
  targetVariable: string;
  solutionSteps: EquationWorkspaceSolutionStep[];
  availableOperations: EquationWorkspaceOperation[];
  /** For identify-operation: the correct next operation ID */
  correctOperationId?: string;
  knownValues?: Record<string, number>;
}

export interface EquationWorkspaceData {
  title: string;
  description?: string;
  context?: string;
  variableDefinitions?: Array<{
    symbol: string;
    name: string;
    unit?: string;
  }>;
  challenges: EquationWorkspaceChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationWorkspaceMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'guided-solve': { label: 'Guided Solve', icon: '\uD83D\uDCA1', accentColor: 'blue' },
  'solve': { label: 'Solve', icon: '\uD83E\uDDE9', accentColor: 'purple' },
  'multi-step': { label: 'Multi-Step', icon: '\uD83D\uDD17', accentColor: 'emerald' },
  'identify-operation': { label: 'Identify Operation', icon: '\uD83C\uDFAF', accentColor: 'amber' },
};

const CATEGORY_COLORS: Record<string, string> = {
  arithmetic: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  algebraic: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  trigonometric: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  logarithmic: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  radical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

// ============================================================================
// MathDisplay — inline KaTeX renderer
// ============================================================================

function MathDisplay({ latex, display = false, className = '' }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: false, trust: true });
    } catch {
      return `<span style="color:#f87171">${latex}</span>`;
    }
  }, [latex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ============================================================================
// Component
// ============================================================================

const EquationWorkspace: React.FC<EquationWorkspaceData> = (props) => {
  const {
    title,
    description,
    context,
    variableDefinitions,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = props;

  // ── Eval hook ──
  const resolvedInstanceId = instanceId ?? 'equation-workspace-default';
  const startTimeRef = useRef(Date.now());

  const { submitResult, submittedResult } = usePrimitiveEvaluation<EquationWorkspaceMetrics>({
    primitiveType: 'equation-workspace',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI tutoring ──
  const gradeLevel = '9-12';
  const aiPrimitiveData = useMemo(() => ({
    title,
    context,
    challengeCount: challenges.length,
    challengeTypes: Array.from(new Set(challenges.map(c => c.type))),
  }), [title, context, challenges]);

  const { sendText } = useLuminaAI({
    primitiveType: 'equation-workspace',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Shared challenge progress ──
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
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Per-challenge state ──
  const [completedSteps, setCompletedSteps] = useState<EquationWorkspaceSolutionStep[]>([]);
  const [currentEquation, setCurrentEquation] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [incorrectOps, setIncorrectOps] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [challengeSolved, setChallengeSolved] = useState(false);

  const currentChallenge = challenges[currentChallengeIndex];

  // Reset per-challenge state when challenge changes
  useEffect(() => {
    if (currentChallenge) {
      setCompletedSteps([]);
      setCurrentEquation(currentChallenge.equation);
      setFeedback(null);
      setIncorrectOps(0);
      setHintsUsed(0);
      setShowHint(false);
      setSelectedAnswer(null);
      setChallengeSolved(false);
    }
  }, [currentChallenge]);

  // Send intro message for first challenge
  useEffect(() => {
    if (currentChallengeIndex === 0 && currentChallenge) {
      sendText(
        `[NEXT_ITEM] Challenge 1 of ${challenges.length}. Type: ${currentChallenge.type}. ` +
        `Student must solve "${currentChallenge.equation}" for ${currentChallenge.targetVariable}. ` +
        `Introduce the challenge briefly.`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Next expected step index ──
  const nextStepIndex = completedSteps.length;
  const expectedStep = currentChallenge?.solutionSteps[nextStepIndex];

  // ── Handlers ──

  const handleSelectOperation = useCallback((opId: string) => {
    if (!currentChallenge || challengeSolved) return;

    // For identify-operation type, just select
    if (currentChallenge.type === 'identify-operation') {
      setSelectedAnswer(opId);
      return;
    }

    // For solve/guided-solve/multi-step: check if this is the correct next step
    if (expectedStep && opId === expectedStep.operationId) {
      // Correct operation
      const newSteps = [...completedSteps, expectedStep];
      setCompletedSteps(newSteps);
      setCurrentEquation(expectedStep.resultLatex);
      setFeedback({ message: 'Correct!', correct: true });
      setShowHint(false);

      // Check if solved
      if (newSteps.length === currentChallenge.solutionSteps.length) {
        setChallengeSolved(true);
        sendText(
          `[ANSWER_CORRECT] Student solved the equation in ${newSteps.length} steps ` +
          `with ${incorrectOps} incorrect attempts and ${hintsUsed} hints. ` +
          `Congratulate them!`,
          { silent: true },
        );
      } else {
        sendText(
          `[STEP_CORRECT] Student applied "${expectedStep.operation}" correctly. ` +
          `${currentChallenge.solutionSteps.length - newSteps.length} steps remaining. ` +
          `Briefly encourage.`,
          { silent: true },
        );
      }
    } else {
      // Incorrect operation
      incrementAttempts();
      setIncorrectOps(prev => prev + 1);
      const opLabel = currentChallenge.availableOperations.find(o => o.id === opId)?.label ?? opId;
      setFeedback({
        message: `"${opLabel}" isn't the right step here. Think about what isolates ${currentChallenge.targetVariable}.`,
        correct: false,
      });

      sendText(
        `[ANSWER_INCORRECT] Student chose "${opLabel}" but the correct next step is "${expectedStep?.operation}". ` +
        `They have made ${incorrectOps + 1} incorrect attempts. Give a gentle hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, challengeSolved, expectedStep, completedSteps, incorrectOps, hintsUsed, incrementAttempts, sendText]);

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return;

    const correct = selectedAnswer === currentChallenge.correctOperationId;
    const opLabel = currentChallenge.availableOperations.find(o => o.id === selectedAnswer)?.label ?? selectedAnswer;

    if (correct) {
      setChallengeSolved(true);
      setFeedback({ message: 'Correct! That\'s the right next step.', correct: true });
      sendText(
        `[ANSWER_CORRECT] Student correctly identified "${opLabel}" as the next operation. Congratulate briefly.`,
        { silent: true },
      );
    } else {
      incrementAttempts();
      setIncorrectOps(prev => prev + 1);
      const correctLabel = currentChallenge.availableOperations.find(
        o => o.id === currentChallenge.correctOperationId,
      )?.label ?? '';
      setFeedback({
        message: `Not quite. "${opLabel}" isn't the best next step here.`,
        correct: false,
      });
      setSelectedAnswer(null);

      sendText(
        `[ANSWER_INCORRECT] Student chose "${opLabel}" but correct is "${correctLabel}". ` +
        `Give a hint about why the correct operation helps isolate the variable.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedAnswer, incrementAttempts, sendText]);

  const handleUseHint = useCallback(() => {
    if (!currentChallenge || challengeSolved) return;
    setHintsUsed(prev => prev + 1);
    setShowHint(true);
  }, [currentChallenge, challengeSolved]);

  const handleAdvance = useCallback(() => {
    // Record result for current challenge
    const solved = challengeSolved;
    const stepsRequired = currentChallenge?.solutionSteps.length ?? 0;
    const stepsCompleted = currentChallenge?.type === 'identify-operation' ? (solved ? 1 : 0) : completedSteps.length;

    recordResult({
      challengeId: currentChallenge?.id ?? '',
      correct: solved,
      attempts: currentAttempts + 1,
      score: solved ? Math.max(0, Math.round(100 - (incorrectOps * 15) - (hintsUsed * 10))) : 0,
      stepsCompleted,
      stepsRequired,
      incorrectOps,
      hintsUsed,
    });

    if (!advanceProgress()) {
      // All done — submit evaluation
      const elapsed = Date.now() - startTimeRef.current;
      const totalStepsCompleted = challengeResults.reduce(
        (sum, r) => sum + ((r.stepsCompleted as number) ?? 0), 0,
      ) + stepsCompleted;
      const totalStepsRequired = challengeResults.reduce(
        (sum, r) => sum + ((r.stepsRequired as number) ?? 0), 0,
      ) + stepsRequired;
      const totalIncorrect = challengeResults.reduce(
        (sum, r) => sum + ((r.incorrectOps as number) ?? 0), 0,
      ) + incorrectOps;
      const totalHints = challengeResults.reduce(
        (sum, r) => sum + ((r.hintsUsed as number) ?? 0), 0,
      ) + hintsUsed;
      const allSolved = challengeResults.every(r => r.correct) && solved;

      const overallScore = Math.round(
        ([...challengeResults, { score: solved ? Math.max(0, 100 - incorrectOps * 15 - hintsUsed * 10) : 0 }]
          .reduce((sum, r) => sum + ((r.score as number) ?? 0), 0)) / challenges.length,
      );

      submitResult(allSolved, overallScore, {
        type: 'equation-workspace',
        stepsCompleted: totalStepsCompleted,
        stepsRequired: totalStepsRequired,
        incorrectOperations: totalIncorrect,
        hintsUsed: totalHints,
        solved: allSolved,
        solveTime: Math.round(elapsed / 1000),
      });

      return;
    }

    // Send intro for next challenge
    const nextIdx = currentChallengeIndex + 1;
    const next = challenges[nextIdx];
    if (next) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${nextIdx + 1} of ${challenges.length}. ` +
        `Type: ${next.type}. Equation: "${next.equation}", solve for ${next.targetVariable}. ` +
        `Introduce briefly.`,
        { silent: true },
      );
    }
  }, [
    challengeSolved, currentChallenge, completedSteps, currentAttempts,
    incorrectOps, hintsUsed, recordResult, advanceProgress, challengeResults,
    challenges, currentChallengeIndex, submitResult, sendText,
  ]);

  // ── Compute overall score for summary ──
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length);
  }, [allChallengesComplete, challengeResults]);

  const elapsedMs = Date.now() - startTimeRef.current;

  // Send ALL_COMPLETE message
  useEffect(() => {
    if (allChallengesComplete && phaseResults.length > 0) {
      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${localOverallScore}%. ` +
        `Give encouraging phase-specific feedback.`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChallengesComplete]);

  // ── Render helpers ──

  if (!currentChallenge) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-100">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const isIdentifyMode = currentChallenge.type === 'identify-operation';
  const isGuidedMode = currentChallenge.type === 'guided-solve';

  // In guided mode, highlight the expected operation
  const hintOperationId = isGuidedMode && expectedStep ? expectedStep.operationId : null;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
            {context && <p className="text-slate-400 text-sm mt-1">{context}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {currentChallengeIndex + 1} / {challenges.length}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/20 text-slate-300"
            >
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary panel when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Workspace Complete!"
            celebrationMessage="You solved all the equations!"
            className="mb-6"
          />
        )}

        {/* Don't show workspace UI after completion */}
        {!allChallengesComplete && (
          <>
            {/* Instruction */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
              {variableDefinitions && variableDefinitions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {variableDefinitions.map((v) => (
                    <span key={v.symbol} className="text-xs text-slate-400">
                      <MathDisplay latex={v.symbol} /> = {v.name}{v.unit ? ` (${v.unit})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Equation display / Step history */}
            <div className="bg-slate-800/60 border border-white/10 rounded-lg p-6 space-y-3">
              {/* Original equation */}
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-white/20 text-slate-500 text-xs shrink-0">
                  Start
                </Badge>
                <div className={completedSteps.length > 0 ? 'text-slate-500' : 'text-slate-100'}>
                  <MathDisplay latex={currentChallenge.equation} display />
                </div>
              </div>

              {/* Completed steps */}
              {completedSteps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-xs text-emerald-400 italic">{step.operation}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs shrink-0">
                      Step {idx + 1}
                    </Badge>
                    <div className={idx === completedSteps.length - 1 && !challengeSolved ? 'text-slate-100' : 'text-slate-400'}>
                      <MathDisplay latex={step.resultLatex} display />
                    </div>
                  </div>
                </div>
              ))}

              {/* Solved indicator */}
              {challengeSolved && !isIdentifyMode && (
                <div className="flex items-center gap-3 mt-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                    Solved!
                  </Badge>
                  <span className="text-emerald-300 text-sm">
                    <MathDisplay latex={`${currentChallenge.targetVariable}`} /> is isolated
                  </span>
                </div>
              )}

              {/* Target variable reminder */}
              {!challengeSolved && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-slate-500">Goal: Solve for</span>
                  <MathDisplay latex={currentChallenge.targetVariable} className="text-amber-300 text-sm" />
                </div>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-lg p-3 text-sm ${
                feedback.correct
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Identify-operation mode: show partial solution + MC */}
            {isIdentifyMode && !challengeSolved && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  What operation should be applied next?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentChallenge.availableOperations.map((op) => (
                    <Button
                      key={op.id}
                      variant="ghost"
                      className={`justify-start text-left h-auto py-3 px-4 border ${
                        selectedAnswer === op.id
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                      }`}
                      onClick={() => setSelectedAnswer(op.id)}
                    >
                      <Badge variant="outline" className={`mr-2 text-xs ${CATEGORY_COLORS[op.category] ?? ''}`}>
                        {op.category}
                      </Badge>
                      {op.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-200"
                    disabled={!selectedAnswer}
                    onClick={handleCheckIdentify}
                  >
                    Check Answer
                  </Button>
                </div>
              </div>
            )}

            {/* Solve / guided-solve / multi-step: operation menu */}
            {!isIdentifyMode && !challengeSolved && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">
                    Select the next operation:
                  </p>
                  {!isGuidedMode && (
                    <Button
                      variant="ghost"
                      className="text-xs bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                      onClick={handleUseHint}
                    >
                      Hint ({hintsUsed})
                    </Button>
                  )}
                </div>

                {/* Show hint */}
                {showHint && expectedStep && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-200">
                    Think about: what operation would help move terms away from <MathDisplay latex={currentChallenge.targetVariable} />?
                    <br />
                    <span className="text-xs text-amber-400">Category: {expectedStep.operationId.split('_')[0]}</span>
                  </div>
                )}

                {/* Operation buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentChallenge.availableOperations.map((op) => {
                    const isHinted = hintOperationId === op.id;
                    return (
                      <Button
                        key={op.id}
                        variant="ghost"
                        className={`justify-start text-left h-auto py-3 px-4 border transition-all ${
                          isHinted
                            ? 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/20'
                            : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                        }`}
                        onClick={() => handleSelectOperation(op.id)}
                      >
                        <Badge variant="outline" className={`mr-2 text-xs ${CATEGORY_COLORS[op.category] ?? ''}`}>
                          {op.category}
                        </Badge>
                        {op.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advance button when solved */}
            {challengeSolved && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-200"
                  onClick={handleAdvance}
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
                </Button>
              </div>
            )}

            {/* Known values reference */}
            {currentChallenge.knownValues && Object.keys(currentChallenge.knownValues).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Known values:</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(currentChallenge.knownValues).map(([sym, val]) => (
                    <span key={sym} className="text-sm text-slate-300">
                      <MathDisplay latex={`${sym} = ${val}`} />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EquationWorkspace;
