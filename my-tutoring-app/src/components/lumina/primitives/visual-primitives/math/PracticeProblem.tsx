'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  WhiteboardCanvas,
  type WhiteboardRef,
} from '../../../components/scratch-pad/WhiteboardCanvas';
import {
  BackgroundType,
  type Stroke,
  type ToolType,
} from '../../../components/scratch-pad/types';
import { KaTeX, MixedContent } from '../../annotated-example/StepContentRenderer';
import {
  useTranscription,
  type TranscribedLine,
} from '../../annotated-example/useTranscription';
import { RevealView } from '../../annotated-example/RevealView';
import { InsetRenderer } from '../../problem-primitives/insets/InsetRenderer';
import type {
  RichAnnotatedExampleData,
  RichExampleStep,
  StepContent,
} from '../../annotated-example/types';
import type {
  JudgeVerdict,
  LiveReviewState,
  LiveReviewStatus,
} from '../../../service/annotated-example/judge-types';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PracticeProblemMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type {
  PracticeProblemSolution,
  PracticeStep,
} from './practice-problem-types';

// ═══════════════════════════════════════════════════════════════════════
// PracticeProblem — standalone canvas-based derivation primitive.
//
// Single problem, single attempt. Student writes their derivation by hand
// on the canvas; transcription + live coaching keep them oriented; pressing
// Done dispatches a compareWork judge call and reveals a verdict with a
// side-by-side comparison against the canonical solution.
//
// Distinct from AnnotatedExample's Try-It act: not portal-mounted, not
// gated on a watched worked example, and authored independently by the
// manifest. Shares the underlying infrastructure (useTranscription,
// RevealView, InsetRenderer, judge API, KaTeX renderers) but owns its
// layout and state machine end-to-end.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Practice canvas data. Strict subset of the rich AnnotatedExample shape:
 * carries the lean `PracticeStep[]` for canvas + judge wiring, plus the
 * standard manifest evaluation hooks.
 */
export interface PracticeProblemData
  extends Omit<PracticeProblemSolution, 'difficulty' | 'evalMode' | 'gradeLevel'> {
  /** Difficulty band (drives eval mode + IRT calibration). */
  difficulty?: PracticeProblemSolution['difficulty'];
  /** Eval mode key surfaced to the backend metrics submission. */
  evalMode?: PracticeProblemSolution['evalMode'];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PracticeProblemMetrics>) => void;
}

// ── Judge envelope adapter ──────────────────────────────────────────
//
// The shared judge / live-reviewer / RevealView chain expects
// `RichExampleStep[]`. The lean shape stays the source of truth on the
// canvas + storage; we synthesize a structurally-valid rich envelope only at
// the moment of POSTing to /api/lumina or rendering RevealView's collapsed
// worked-solution accordion. This keeps AnnotatedExample's pipeline
// untouched while practice owns a leaner generation schema.
//
// Per-type wrap rules:
//   - algebra: empty transitions, result = canonicalBody. The judge's
//     `stepBodySummary` falls back to `result: ${result}` when transitions is
//     empty, and `extractCanonicalAnswer` reads `result` from the last step
//     to ground the prompt's "expected final answer" hint.
//   - non-algebra: stuff canonicalBody into the salient field of the typed
//     content (table.caption, graph.expression, case-split.condition,
//     diagram.altText). The body summary remains coherent.

function buildStepContent(step: PracticeStep): StepContent {
  switch (step.type) {
    case 'algebra':
      return { type: 'algebra', transitions: [], result: step.canonicalBody };
    case 'table':
      return { type: 'table', caption: step.canonicalBody, headers: [], rows: [] };
    case 'graph-sketch':
      return {
        type: 'graph-sketch',
        expression: step.canonicalBody,
        keyPoints: [],
        domain: [-10, 10],
        range: [-10, 10],
        features: [],
      };
    case 'case-split':
      return { type: 'case-split', condition: step.canonicalBody, cases: [] };
    case 'diagram':
      return { type: 'diagram', imagePrompt: '', labels: [], altText: step.canonicalBody };
  }
}

function toRichEnvelope(steps: PracticeStep[], canonicalAnswer: string): RichExampleStep[] {
  return steps.map((step, idx) => {
    const isLast = idx === steps.length - 1;
    // Always wrap the LAST step as algebra with result=canonicalAnswer so the
    // judge's `extractCanonicalAnswer` returns the authored answer regardless
    // of step type. The type tag matters more on intermediate steps where the
    // judge prompt uses it to set expectations.
    const content: StepContent = isLast
      ? { type: 'algebra', transitions: [], result: canonicalAnswer || step.canonicalBody }
      : buildStepContent(step);
    return {
      id: idx,
      title: step.title,
      content,
      annotations: {
        steps: '',
        strategy: step.strategy,
        misconceptions: step.misconceptions,
        connections: '',
      },
    };
  });
}

type Phase =
  | { kind: 'solving' }
  | { kind: 'judging'; snapshot: TranscribedLine[] }
  | { kind: 'judge-error'; message: string }
  | { kind: 'reveal'; snapshot: TranscribedLine[]; verdict: JudgeVerdict };

interface PracticeProblemProps {
  data: PracticeProblemData;
  className?: string;
}

const VERDICT_TO_SCORE: Record<JudgeVerdict['verdict'], number> = {
  correct: 100,
  partial: 60,
  incorrect: 0,
};

export const PracticeProblem: React.FC<PracticeProblemProps> = ({ data, className }) => {
  const canvasRef = useRef<WhiteboardRef>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [phase, setPhase] = useState<Phase>({ kind: 'solving' });

  const resolvedInstanceId = useMemo(
    () => data.instanceId ?? `practice-problem-${Date.now()}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, elapsedMs } =
    usePrimitiveEvaluation<PracticeProblemMetrics>({
      primitiveType: 'practice-problem',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      // Hook's onSubmit takes the unparameterized union; widen our typed
      // callback at the boundary so the hook accepts it.
      onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
    });

  const aiPrimitiveData = useMemo(
    () => ({
      title: data.title,
      problem: data.problem.statement,
      equations: data.problem.equations ?? [],
      difficulty: data.difficulty,
      stepCount: data.steps.length,
      currentPhase: phase.kind,
      strokeCount: strokes.length,
    }),
    [data, phase.kind, strokes.length],
  );

  const { sendText } = useLuminaAI({
    primitiveType: 'practice-problem',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  const addToHistory = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
  }, []);

  // Reset state when the parent swaps in a new problem instance.
  useEffect(() => {
    setStrokes([]);
    setPhase({ kind: 'solving' });
  }, [data]);

  // Tell the tutor which problem is loaded — bracketed system message,
  // not student-facing chat. The tutor can use this for opening context
  // if the student requests help.
  useEffect(() => {
    sendText(
      `[PROBLEM_LOADED] Practice problem "${data.title}" (${data.difficulty ?? 'unspecified'} difficulty). ` +
        `Statement: ${data.problem.statement}. ${data.steps.length} canonical steps.`,
      { silent: true },
    );
    // sendText is stable across renders; firing on every problem swap is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.title]);

  const problemContext = useMemo(() => {
    const parts: string[] = [];
    if (data.problem.equations && data.problem.equations.length > 0) {
      parts.push(...data.problem.equations);
    }
    if (data.problem.statement) parts.push(data.problem.statement);
    return parts.join(' — ');
  }, [data.problem]);

  const exportCanvasImage = useCallback(() => {
    return canvasRef.current?.exportImage() ?? '';
  }, []);

  // Synthetic RichExampleStep[] wrapping the lean PracticeStep[]. Used by the
  // shared judge / live-reviewer / RevealView chain; recomputed only when the
  // canonical solution changes.
  const richSteps = useMemo(
    () => toRichEnvelope(data.steps, data.canonicalAnswer),
    [data.steps, data.canonicalAnswer],
  );

  const transcriptionEnabled = phase.kind === 'solving';
  const { lines, isTranscribing, lastError, forceSnapshot, liveReview, isReviewing } =
    useTranscription({
      exportImage: exportCanvasImage,
      strokeCount: strokes.length,
      problemStatement: problemContext,
      enabled: transcriptionEnabled,
      canonicalSteps: richSteps,
      inset: data.problem.inset,
    });

  const handleDone = useCallback(async () => {
    if (phase.kind !== 'solving' || strokes.length === 0) return;

    try {
      await forceSnapshot();
    } catch {
      /* graceful degradation — proceed with whatever lines we have */
    }

    const snapshot: TranscribedLine[] = [...lines];
    setPhase({ kind: 'judging', snapshot });

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compareWork',
          params: {
            problemStatement: problemContext,
            canonicalSteps: richSteps,
            transcribedLines: snapshot,
            inset: data.problem.inset,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Compare failed');
      }

      const verdict = (await response.json()) as JudgeVerdict;
      setPhase({ kind: 'reveal', snapshot, verdict });

      const aligned = verdict.stepAnalysis.filter((a) => a.status === 'aligned').length;
      const shortcut = verdict.stepAnalysis.filter((a) => a.status === 'shortcut').length;
      const errorLines = verdict.stepAnalysis.filter((a) => a.status === 'error').length;
      const extra = verdict.stepAnalysis.filter((a) => a.status === 'extra').length;
      const score = VERDICT_TO_SCORE[verdict.verdict];
      const success = verdict.verdict === 'correct';

      const metrics: PracticeProblemMetrics = {
        type: 'practice-problem',
        evalMode: data.evalMode,
        verdict: verdict.verdict,
        difficulty: data.difficulty,
        strokeCount: strokes.length,
        transcribedLineCount: snapshot.length,
        canonicalStepCount: data.steps.length,
        alignedSteps: aligned,
        shortcutSteps: shortcut,
        errorSteps: errorLines,
        extraSteps: extra,
        finalAnswer: verdict.finalAnswer,
        canonicalAnswer: verdict.canonicalAnswer,
        attempts: 1,
        timeOnTaskMs: elapsedMs,
      };

      if (!hasSubmitted) {
        submitResult(success, score, metrics, { snapshot, verdict });
      }

      sendText(
        `[VERDICT_${verdict.verdict.toUpperCase()}] Practice problem judge resolved. ` +
          `Aligned ${aligned}/${data.steps.length} canonical steps. ` +
          `Final answer: "${verdict.finalAnswer}" vs canonical "${verdict.canonicalAnswer}". ` +
          `Summary: ${verdict.summary}`,
        { silent: true },
      );
    } catch (error) {
      setPhase({
        kind: 'judge-error',
        message: error instanceof Error ? error.message : 'Compare failed',
      });
    }
  }, [
    phase,
    strokes.length,
    forceSnapshot,
    lines,
    problemContext,
    data,
    elapsedMs,
    hasSubmitted,
    submitResult,
    sendText,
  ]);

  const cancelJudge = useCallback(() => {
    if (phase.kind === 'judging' || phase.kind === 'judge-error') {
      setPhase({ kind: 'solving' });
    }
  }, [phase]);

  const handleReset = useCallback(() => {
    setStrokes([]);
    setPhase({ kind: 'solving' });
  }, []);

  // RevealView consumes RichAnnotatedExampleData (the AnnotatedExample wire
  // shape). The lean PracticeStep[] is wrapped into RichExampleStep[] via the
  // judge envelope, which produces structurally-valid step content that
  // RichStepCard can render in the collapsed worked-solution accordion.
  const revealSibling: RichAnnotatedExampleData = useMemo(
    () => ({
      title: data.title,
      subject: data.subject,
      problem: data.problem,
      solutionStrategy: data.solutionStrategy,
      steps: richSteps,
      interactive: false,
    }),
    [data.title, data.subject, data.problem, data.solutionStrategy, richSteps],
  );

  const isJudging = phase.kind === 'judging';
  const judgeError = phase.kind === 'judge-error' ? phase.message : null;
  const showRevealView = phase.kind === 'reveal';
  const canvasReady =
    phase.kind === 'solving' || phase.kind === 'judging' || phase.kind === 'judge-error';

  return (
    <Card
      className={`relative backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden ${className ?? ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className="text-emerald-300 border-emerald-400/40 bg-emerald-500/10 gap-1.5"
          >
            <Sparkles size={11} />
            Practice
          </Badge>
          <Badge
            variant="outline"
            className="text-blue-300 border-blue-400/30 bg-blue-500/10"
          >
            {data.subject}
          </Badge>
          {data.difficulty && (
            <Badge
              variant="outline"
              className="text-slate-300 border-white/20 bg-white/5 capitalize"
            >
              {data.difficulty}
            </Badge>
          )}
        </div>
        <CardTitle className="text-slate-100 text-lg">{data.title}</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* Outer relative shell — RevealView absolute-positions inside this. */}
        <div className="relative min-h-[680px] flex flex-col">
          <AnimatePresence>
            {showRevealView && phase.kind === 'reveal' && (
              <RevealView
                sibling={revealSibling}
                studentLines={phase.snapshot}
                verdict={phase.verdict}
                onShowMeAgain={handleReset}
                onClose={handleReset}
              />
            )}
          </AnimatePresence>

          {!showRevealView && (
            <div className="flex flex-col flex-1">
              {/* Problem statement */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/70 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em] font-semibold">
                    Problem Statement
                  </p>
                </div>
                {data.problem.equations && data.problem.equations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    {data.problem.equations.map((eq, i) => (
                      <KaTeX
                        key={i}
                        latex={eq}
                        display={false}
                        className="text-xl text-white"
                      />
                    ))}
                  </div>
                )}
                <p className="text-base text-slate-100 leading-relaxed">
                  <MixedContent text={data.problem.statement} />
                </p>
                {data.problem.inset && (
                  <div className="mt-3">
                    <InsetRenderer inset={data.problem.inset} />
                  </div>
                )}
              </div>

              {/* Canonical-step ledger — slot row + ambient coaching caption */}
              {data.steps.length > 0 && (
                <div className="px-4 pt-3">
                  <StepLedger
                    steps={data.steps}
                    liveReview={liveReview}
                    isReviewing={isReviewing}
                  />
                </div>
              )}

              <div className="flex-1 flex min-h-0 relative">
                {/* Canvas + toolbar */}
                <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTool('pen')}
                      disabled={!canvasReady}
                      className={`gap-2 border ${
                        tool === 'pen'
                          ? 'bg-blue-500/15 border-blue-400/40 text-blue-200'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <Pencil size={14} />
                      Pen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTool('eraser')}
                      disabled={!canvasReady}
                      className={`gap-2 border ${
                        tool === 'eraser'
                          ? 'bg-blue-500/15 border-blue-400/40 text-blue-200'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <Eraser size={14} />
                      Eraser
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCanvas}
                      disabled={!canvasReady || strokes.length === 0}
                      className="gap-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      Clear
                    </Button>

                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={!canvasReady || strokes.length === 0}
                        className="gap-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 disabled:opacity-40"
                      >
                        <RotateCcw size={14} />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDone}
                        disabled={!canvasReady || strokes.length === 0 || isJudging}
                        className={`gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 font-semibold disabled:opacity-40 ${
                          liveReview?.allStepsComplete
                            ? 'shadow-[0_0_24px_rgba(16,185,129,0.55)] animate-pulse'
                            : ''
                        }`}
                      >
                        {liveReview?.allStepsComplete && <CheckCircle2 size={14} />}
                        Done
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`flex-1 min-h-[420px] relative ${
                      phase.kind === 'solving' ? '' : 'pointer-events-none'
                    }`}
                  >
                    <WhiteboardCanvas
                      ref={canvasRef}
                      tool={tool}
                      color="#f8fafc"
                      width={tool === 'eraser' ? 24 : 3}
                      background={BackgroundType.GRID}
                      strokes={strokes}
                      setStrokes={setStrokes}
                      addToHistory={addToHistory}
                    />

                    {isJudging && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl">
                        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                          <Loader2 size={32} className="text-emerald-300 animate-spin" />
                          <p className="text-sm text-slate-100 font-medium">
                            Checking your work…
                          </p>
                          <p className="text-xs text-slate-500">
                            Comparing your derivation to the worked solution.
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelJudge}
                            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 mt-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {judgeError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl">
                        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                          <AlertTriangle size={32} className="text-amber-400" />
                          <p className="text-sm text-slate-200 font-medium">
                            Couldn&apos;t check your work
                          </p>
                          <p className="text-xs text-slate-500">{judgeError}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Button
                              size="sm"
                              onClick={handleDone}
                              className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30"
                            >
                              Try again
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelJudge}
                              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                            >
                              Back to canvas
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transcription rail — simple stacked list. The y-anchored
                    gutter pattern from TryItYourself is intentionally NOT
                    ported here yet; this is a fresh design space and the
                    rail can evolve independently. */}
                <TranscriptionRail
                  lines={lines}
                  liveReview={liveReview}
                  isTranscribing={isTranscribing}
                  lastError={lastError}
                  canvasReady={canvasReady}
                  strokeCount={strokes.length}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Step Ledger ─────────────────────────────────────────────────────

const LIVE_TONE: Record<LiveReviewStatus, { bandLabel: string; bandClass: string }> = {
  'on-track': { bandLabel: 'On track', bandClass: 'text-emerald-200' },
  shortcut: { bandLabel: 'Shortcut', bandClass: 'text-cyan-200' },
  'off-track': { bandLabel: 'Off track', bandClass: 'text-rose-200' },
  filler: { bandLabel: '', bandClass: 'text-slate-400' },
};

interface StepLedgerProps {
  steps: Array<{ id: number; title: string }>;
  liveReview: LiveReviewState | null;
  isReviewing: boolean;
}

const StepLedger: React.FC<StepLedgerProps> = ({ steps, liveReview, isReviewing }) => {
  const completedSteps = liveReview?.completedSteps ?? 0;
  const lineReviews = liveReview?.lineReviews ?? [];
  const allStepsComplete = liveReview?.allStepsComplete ?? false;
  const headline = liveReview?.headline ?? null;
  const lastReview = lineReviews[lineReviews.length - 1];
  const lastTone = lastReview ? LIVE_TONE[lastReview.status] : null;
  const activeIndex = allStepsComplete ? -1 : Math.min(completedSteps, steps.length - 1);

  const shortcutSteps = new Set<number>();
  for (const review of lineReviews) {
    if (review.matchedStep === null) continue;
    if (review.status === 'shortcut') shortcutSteps.add(review.matchedStep);
    else shortcutSteps.delete(review.matchedStep);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-1.5">
        {steps.map((step, i) => {
          const isCompleted = i < completedSteps;
          const isActive = i === activeIndex;
          const isShortcut = shortcutSteps.has(i);

          let slotClass: string;
          let textClass: string;
          let ordinalClass: string;
          if (isShortcut && (isCompleted || allStepsComplete)) {
            slotClass = 'bg-cyan-500/15 border-cyan-400/40';
            textClass = 'text-cyan-100';
            ordinalClass = 'text-cyan-300/70';
          } else if (allStepsComplete || isCompleted) {
            slotClass = allStepsComplete
              ? 'bg-emerald-500/20 border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
              : 'bg-emerald-500/15 border-emerald-400/35';
            textClass = 'text-emerald-100';
            ordinalClass = 'text-emerald-300/70';
          } else if (isActive) {
            slotClass = 'bg-slate-900/50 border-white/25';
            textClass = 'text-slate-100';
            ordinalClass = 'text-slate-600';
          } else {
            slotClass = 'bg-slate-900/30 border-slate-800';
            textClass = 'text-slate-500';
            ordinalClass = 'text-slate-600';
          }

          return (
            <div key={step.id} className="flex-1 min-w-0">
              <div
                className={`relative px-3 py-1.5 rounded-md border transition-colors duration-300 ${slotClass}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[9px] font-mono flex-shrink-0 ${ordinalClass}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${textClass}`}
                    title={step.title}
                  >
                    {step.title}
                  </span>
                  {isCompleted && (
                    <CheckCircle2
                      size={11}
                      className={`flex-shrink-0 ml-auto ${
                        isShortcut ? 'text-cyan-300' : 'text-emerald-300'
                      }`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isReviewing && (
          <div className="flex items-center px-2">
            <Loader2 size={12} className="animate-spin text-slate-500" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 min-h-[1rem] px-1">
        {!allStepsComplete && lastTone?.bandLabel && (
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${lastTone.bandClass}`}
          >
            {lastTone.bandLabel}
          </span>
        )}
        <span
          className={`truncate italic text-xs ${
            allStepsComplete ? 'text-emerald-200' : (lastTone?.bandClass ?? 'text-slate-400')
          }`}
        >
          {allStepsComplete
            ? `All ${steps.length} steps complete — press Done when you're ready.`
            : headline || lastReview?.message || ''}
        </span>
      </div>
    </div>
  );
};

// ── Transcription Rail ──────────────────────────────────────────────

const RAIL_STATUS_BORDER: Record<LiveReviewStatus, string> = {
  'on-track': 'border-emerald-400/50 text-emerald-300',
  shortcut: 'border-cyan-400/50 text-cyan-300',
  'off-track': 'border-rose-400/50 text-rose-300',
  filler: 'border-slate-700 text-slate-600',
};

const RAIL_STATUS_SYMBOL: Record<LiveReviewStatus, string> = {
  'on-track': '✓',
  shortcut: '↗',
  'off-track': '⚠',
  filler: ' ',
};

interface TranscriptionRailProps {
  lines: TranscribedLine[];
  liveReview: LiveReviewState | null;
  isTranscribing: boolean;
  lastError: string | null;
  canvasReady: boolean;
  strokeCount: number;
}

const TranscriptionRail: React.FC<TranscriptionRailProps> = ({
  lines,
  liveReview,
  isTranscribing,
  lastError,
  canvasReady,
  strokeCount,
}) => {
  return (
    <div className="w-44 flex-shrink-0 border-l border-white/5 flex flex-col py-3 px-2 bg-slate-950/40">
      <div className="px-1 pb-2 flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
          Your work
        </p>
        {isTranscribing && <Loader2 size={11} className="text-slate-500 animate-spin" />}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {!canvasReady && (
          <p className="text-[10px] text-slate-600 italic px-1">
            Transcription starts when the problem loads.
          </p>
        )}
        {canvasReady && strokeCount === 0 && (
          <p className="text-[10px] text-slate-600 italic px-1">
            Start writing — your lines will appear here.
          </p>
        )}
        {lines.map((line, i) => {
          const review = liveReview?.lineReviews?.[i];
          const status: LiveReviewStatus = review?.status ?? 'filler';
          const lowConfidence = line.confidence < 0.7;
          return (
            <div key={`${i}-${line.latex}`} className="flex items-start gap-1.5 px-1">
              <div
                className={`w-5 h-5 rounded-full bg-slate-950/70 border flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-none ${RAIL_STATUS_BORDER[status]}`}
              >
                {review ? RAIL_STATUS_SYMBOL[review.status] : i + 1}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <KaTeX
                  latex={line.latex}
                  display={false}
                  className={`text-[11px] leading-snug ${lowConfidence ? 'text-slate-500' : 'text-slate-100'}`}
                />
                {review?.message && (
                  <p className="text-[10px] italic mt-0.5 text-slate-400 leading-snug">
                    {review.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {lastError && (
          <p className="text-[9px] text-amber-400/80 italic px-1 mt-2">
            Transcription unreachable — keep working.
          </p>
        )}
      </div>
    </div>
  );
};

export default PracticeProblem;
