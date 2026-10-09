'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaSectionLabel,
} from '../../../ui';
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
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import type {
  PracticeProblemSolution,
  PracticeStep,
} from './practice-problem-types';
import {
  PROBLEM_ID,
  describePracticeWork,
  flaggedLines,
  practiceMiss,
  workspaceAssignment,
  workspaceScene,
} from './practiceProblemWorkspace';
import {
  MARK_LINES_LEVER,
  markedFact,
  practiceProblemLevers,
  startingLevers,
  supportWith,
} from './practiceProblemLevers';

// ═══════════════════════════════════════════════════════════════════════
// PracticeProblem — standalone canvas-based derivation primitive.
//
// Single problem. Student writes their derivation by hand on the canvas;
// transcription + live coaching keep them oriented; pressing Done dispatches
// a compareWork judge call. Scripted path: one attempt, a verdict and a
// side-by-side comparison against the canonical solution. Workspace path
// (the live tutor owns the lesson): the verdict is the activity's checked
// gesture; a not-correct verdict keeps the worked solution hidden and the
// learner's work on the board until the runtime reopens it (Try again).
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

/** The lesson's one problem as a workspace item. */
type PracticeChallenge = PracticeProblemData & { id: string };

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
  | { kind: 'reveal'; snapshot: TranscribedLine[]; verdict: JudgeVerdict }
  /** Workspace path: a not-correct verdict, the work still on the board, the worked solution hidden. */
  | { kind: 'checked'; snapshot: TranscribedLine[]; verdict: JudgeVerdict };

interface PracticeProblemProps {
  data: PracticeProblemData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const VERDICT_TO_SCORE: Record<JudgeVerdict['verdict'], number> = {
  correct: 100,
  partial: 60,
  incorrect: 0,
};

function verdictMetrics(
  data: PracticeProblemData, verdict: JudgeVerdict, snapshot: TranscribedLine[], strokeCount: number,
  attempts: number, elapsedMs: number,
): PracticeProblemMetrics {
  const count = (status: string) => verdict.stepAnalysis.filter((a) => a.status === status).length;
  return {
    type: 'practice-problem',
    evalMode: data.evalMode,
    verdict: verdict.verdict,
    difficulty: data.difficulty,
    strokeCount,
    transcribedLineCount: snapshot.length,
    canonicalStepCount: data.steps.length,
    alignedSteps: count('aligned'),
    shortcutSteps: count('shortcut'),
    errorSteps: count('error'),
    extraSteps: count('extra'),
    finalAnswer: verdict.finalAnswer,
    canonicalAnswer: verdict.canonicalAnswer,
    attempts,
    timeOnTaskMs: elapsedMs,
  };
}

const PracticeProblemSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  PracticeProblemProps & { tutorOwned: boolean; useController: (options: ProgressOptions<PracticeChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const canvasRef = useRef<WhiteboardRef>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [phase, setPhase] = useState<Phase>({ kind: 'solving' });

  const stableInstanceIdRef = useRef(data.instanceId ?? `practice-problem-${Date.now()}`);
  const resolvedInstanceId = data.instanceId ?? stableInstanceIdRef.current;

  // ── Progress. One item, the problem; on the workspace path the runtime owns it. ──
  const challenges = useMemo<PracticeChallenge[]>(() => [{ ...data, id: PROBLEM_ID }], [data]);
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: (result) => finish.current(result),
  });
  /** Workspace path: a checked answer stays closed until Try again on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The judge's verdict is the workspace's checked gesture. A ref, so `handleDone` keeps its deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  // Within-mode SUPPORT TIER reveal flags. Absent → full scaffold (no tier).
  // Display-only: these gate what the canvas SHOWS, never the canonical steps
  // the judge compares against.
  const tierSupport = data.support ?? {
    showStepSkeleton: true,
    showFirstStepHint: true,
    showStrategyPreview: true,
  };
  // Levers (practiceProblemLevers.ts): the tutor's pulls on this problem, and the learner's lines the last check
  // flagged. The tier's scaffolds are where the levers start; a pull adds to them, never removes one.
  const [pulled, setPulled] = useState<string[]>([]);
  const [flagged, setFlagged] = useState<string[]>([]);
  const leversOn = useMemo(() => Array.from(new Set([...startingLevers(tierSupport), ...pulled])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.support, pulled]);
  const support = supportWith(tierSupport, leversOn);
  const markedLines = tutorOwned && pulled.includes(MARK_LINES_LEVER) ? flagged : [];
  const firstStep = data.steps[0];

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
      // Support tier so the tutor calibrates how much it reveals (mirrors the
      // on-screen scaffold withdrawal). easy → may walk the first step; hard →
      // names no step. Absent → 'medium' default reveal posture.
      supportTier: data.supportTier ?? 'medium',
      stepCount: data.steps.length,
      currentPhase: phase.kind,
      strokeCount: strokes.length,
    }),
    [data, phase.kind, strokes.length],
  );

  // Its context carries the problem's tier policy for the scripted tutor; off on the workspace path, where the
  // scripted cues send nothing.
  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'practice-problem',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const addToHistory = useCallback((stroke: Stroke) => {
    if (workspaceClosed.current) return;
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const clearCanvas = useCallback(() => {
    if (workspaceClosed.current) return;
    SoundManager.tap();
    setStrokes([]);
  }, []);

  // Reset state when the parent swaps in a new problem instance.
  useEffect(() => {
    setStrokes([]);
    setPhase({ kind: 'solving' });
    setPulled([]);
    setFlagged([]);
  }, [data]);

  // Workspace path: the item opens on an empty board; Try again reopens it with the learner's work kept, so they
  // fix the line that went wrong rather than rewrite the derivation.
  openItem.current = (retry) => {
    setPhase({ kind: 'solving' });
    if (retry) return;
    setStrokes([]); setPulled([]); setFlagged([]);
  };

  // Tell the tutor which problem is loaded — bracketed system message,
  // not student-facing chat. The tutor can use this for opening context
  // if the student requests help.
  useEffect(() => {
    // Tier-aware reveal policy: mirrors the on-screen scaffold withdrawal so the
    // tutor can't hand back what a hard tier hid. NEVER reveals the final answer
    // at any tier.
    const tier = data.supportTier ?? 'medium';
    const revealClause =
      tier === 'easy'
        ? 'SUPPORT TIER easy: the student keeps the worked-step skeleton and a first-step prompt on screen. ' +
          'If they ask for help you MAY name the strategy and walk them through the FIRST step only — never compute it for them, never reveal the final answer.'
        : tier === 'hard'
          ? 'SUPPORT TIER hard: the student has NO worked-step skeleton and NO first-step prompt. ' +
            'Do NOT name any solution step or the strategy. Ask what the problem is asking and what they notice; let them choose the method. Never reveal the answer.'
          : 'SUPPORT TIER medium: the student sees the worked-step skeleton (step titles) but no first-step prompt. ' +
            'Nudge execution of the step they are on; do not pre-name the first move or reveal the answer.';
    sendText(
      `[PROBLEM_LOADED] Practice problem "${data.title}" (${data.difficulty ?? 'unspecified'} step band). ` +
        `Statement: ${data.problem.statement}. ${data.steps.length} canonical steps. ${revealClause}`,
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

  /** The last judged attempt, for the workspace path's submission. */
  const lastJudged = useRef<{ verdict: JudgeVerdict; snapshot: TranscribedLine[]; strokeCount: number } | null>(null);

  const handleDone = useCallback(async () => {
    if (phase.kind !== 'solving' && phase.kind !== 'judge-error') return;
    if (strokes.length === 0 || workspaceClosed.current) return;

    SoundManager.tap();

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
      const success = verdict.verdict === 'correct';
      lastJudged.current = { verdict, snapshot, strokeCount: strokes.length };
      // The worked solution is shown once the problem is solved, or on the scripted path's single attempt.
      setPhase(success || !tutorOwned ? { kind: 'reveal', snapshot, verdict } : { kind: 'checked', snapshot, verdict });
      if (success) SoundManager.playCorrect();
      else if (tutorOwned) SoundManager.playIncorrect();
      // The lines `mark_lines` can mark: the learner's own, as the checker flagged them on this check.
      setFlagged(success ? [] : flaggedLines(verdict));

      // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
      const written = snapshot.map((l) => l.latex);
      commitCheck.current(describePracticeWork(written, strokes.length), success,
        success ? undefined : practiceMiss(written, verdict));

      // The workspace path submits the scored session from `onFinished` (below).
      if (!tutorOwned && !hasSubmitted) {
        const metrics = verdictMetrics(data, verdict, snapshot, strokes.length, 1, elapsedMs);
        submitResult(success, VERDICT_TO_SCORE[verdict.verdict], metrics, { snapshot, verdict });
      }

      const aligned = verdict.stepAnalysis.filter((a) => a.status === 'aligned').length;
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
    richSteps,
    data,
    elapsedMs,
    hasSubmitted,
    submitResult,
    sendText,
    tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item score counts
  // corrections and whose evidence carries each not-correct verdict's named miss.
  finish.current = (result) => {
    if (hasSubmitted) return;
    const last = lastJudged.current;
    const metrics: PracticeProblemMetrics = last
      ? verdictMetrics(data, last.verdict, last.snapshot, last.strokeCount, result.attemptsCount, elapsedMs)
      : { type: 'practice-problem', evalMode: data.evalMode, verdict: result.passed ? 'correct' : 'incorrect',
        difficulty: data.difficulty, strokeCount: strokes.length, transcribedLineCount: 0,
        canonicalStepCount: data.steps.length, alignedSteps: 0, shortcutSteps: 0, errorSteps: 0, extraSteps: 0,
        finalAnswer: '', canonicalAnswer: '', attempts: result.attemptsCount, timeOnTaskMs: elapsedMs };
    submitResult(result.passed, result.accuracy, metrics,
      { snapshot: last?.snapshot, verdict: last?.verdict, challengeResults: result.outcomes,
        learningResponses: result.learningResponses, teachingAttempts: result.teachingAttempts,
        assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  const cancelJudge = useCallback(() => {
    if (phase.kind === 'judging' || phase.kind === 'judge-error') {
      setPhase({ kind: 'solving' });
    }
  }, [phase]);

  const handleReset = useCallback(() => {
    if (workspaceClosed.current) return;
    SoundManager.tap();
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
  const checkedMiss = phase.kind === 'checked' ? phase.verdict : null;
  const canvasReady =
    phase.kind === 'solving' || phase.kind === 'judging' || phase.kind === 'judge-error';
  /** The learner may write and press Done: never while a checked answer waits for Try again. */
  const canEdit = canvasReady && !workspaceClosed.current;

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned) return;
    const scene = workspaceScene(data, {
      lines: lines.map((l) => l.latex), strokes: strokes.length, support,
      stepsReached: liveReview?.completedSteps ?? 0, judging: isJudging,
    });
    const levers = practiceProblemLevers(data, leversOn, flagged);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(markedLines.length ? { markedLines: markedFact(markedLines) } : {}) },
      readyForResponse: !isJudging,
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (!lever) return `No lever ${id} on this problem.`;
        if (lever.pulled) return `${id} is already on the screen.`;
        setPulled((prev) => [...prev, id]);
        return true as const;
      },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // Pip outlines the whiteboard during the tutor's cue, looks where the child
  // writes, receives the work while the judge compares it, and celebrates only
  // a correct verdict. It never reads, corrects, or submits the derivation.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: 'problem',
    label: 'Your whiteboard',
    solved: phase.kind === 'reveal' && phase.verdict.verdict === 'correct',
    checking: isJudging,
    handover: true,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  return (
    <LuminaCard className={`relative overflow-hidden ${className ?? ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <LuminaBadge accent="emerald" className="border-emerald-400/40 bg-emerald-500/10 gap-1.5">
            <Sparkles size={11} />
            Practice
          </LuminaBadge>
          <LuminaBadge accent="blue" className="border-blue-400/30 bg-blue-500/10">
            {data.subject}
          </LuminaBadge>
          {data.difficulty && (
            <LuminaBadge className="capitalize">{data.difficulty}</LuminaBadge>
          )}
        </div>
        <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
        {/* Pip's dock stays in the header so it holds one position through solving,
            judging, and the reveal overlay. */}
        {pip.store && <div {...pip.dock} className={`${pip.dock.className} mt-3`} />}
      </LuminaCardHeader>

      <LuminaCardContent className="p-0">
        {/* Outer relative shell — RevealView absolute-positions inside this. */}
        <div className="relative min-h-[680px] flex flex-col">
          <AnimatePresence>
            {showRevealView && phase.kind === 'reveal' && (
              <RevealView
                sibling={revealSibling}
                studentLines={phase.snapshot}
                verdict={phase.verdict}
                // Workspace path: the problem is solved and the runtime owns what comes next, so closing keeps the work.
                onShowMeAgain={tutorOwned ? () => setPhase({ kind: 'solving' }) : handleReset}
                onClose={tutorOwned ? () => setPhase({ kind: 'solving' }) : handleReset}
              />
            )}
          </AnimatePresence>

          {!showRevealView && (
            <div className="flex flex-col flex-1">
              {/* Problem statement */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <LuminaSectionLabel accent="emerald" size="sm" className="mb-2">
                  Problem Statement
                </LuminaSectionLabel>
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

                {/* Support tier — strategy preview (easy/medium). Names the
                    approach only; the canonical solutionStrategy is authored to
                    never reveal the answer. Withdrawn at hard. */}
                {support.showStrategyPreview && data.solutionStrategy && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-400/20 bg-blue-500/5 px-3 py-2">
                    <Sparkles size={13} className="text-blue-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-100/90 leading-snug italic">
                      <MixedContent text={data.solutionStrategy} />
                    </p>
                  </div>
                )}

                {/* Support tier — first-step starter prompt (easy only). Shows
                    the FIRST step's method-shape title + strategy to get the
                    student moving; never its body/result. Withdrawn at medium+. */}
                {support.showFirstStepHint && firstStep && (
                  <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold mb-1">
                      Start here
                    </p>
                    <p className="text-xs text-emerald-100/90 leading-snug">
                      <span className="font-medium">{firstStep.title}.</span>{' '}
                      {firstStep.strategy}
                    </p>
                  </div>
                )}
              </div>

              {/* Canonical-step ledger — slot row + ambient coaching caption.
                  At hard, showTitles=false withholds the method-shape titles
                  (bare numbered slots), so the student plans unaided. */}
              {data.steps.length > 0 && (
                <div className="px-4 pt-3">
                  <StepLedger
                    steps={data.steps}
                    liveReview={liveReview}
                    isReviewing={isReviewing}
                    showTitles={support.showStepSkeleton}
                  />
                </div>
              )}

              <div className="flex-1 flex min-h-0 relative">
                {/* Canvas + toolbar */}
                <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
                  <div className="flex items-center gap-2">
                    <LuminaButton
                      size="sm"
                      onClick={() => {
                        if (workspaceClosed.current) return;
                        SoundManager.tap();
                        setTool('pen');
                      }}
                      disabled={!canEdit}
                      className={`gap-2 ${
                        tool === 'pen'
                          ? 'bg-blue-500/15 border-blue-400/40 text-blue-200 hover:bg-blue-500/20'
                          : 'text-slate-300'
                      }`}
                    >
                      <Pencil size={14} />
                      Pen
                    </LuminaButton>
                    <LuminaButton
                      size="sm"
                      onClick={() => {
                        if (workspaceClosed.current) return;
                        SoundManager.tap();
                        setTool('eraser');
                      }}
                      disabled={!canEdit}
                      className={`gap-2 ${
                        tool === 'eraser'
                          ? 'bg-blue-500/15 border-blue-400/40 text-blue-200 hover:bg-blue-500/20'
                          : 'text-slate-300'
                      }`}
                    >
                      <Eraser size={14} />
                      Eraser
                    </LuminaButton>
                    <LuminaButton
                      size="sm"
                      onClick={clearCanvas}
                      disabled={!canEdit || strokes.length === 0}
                      className="gap-2 text-slate-300 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      Clear
                    </LuminaButton>

                    <div className="ml-auto flex items-center gap-2">
                      <LuminaButton
                        size="sm"
                        onClick={handleReset}
                        disabled={!canEdit || strokes.length === 0}
                        className="gap-2 text-slate-400 disabled:opacity-40"
                      >
                        <RotateCcw size={14} />
                        Reset
                      </LuminaButton>
                      <LuminaButton
                        tone="primary"
                        size="sm"
                        onClick={() => { void handleDone(); }}
                        disabled={!canEdit || strokes.length === 0 || isJudging}
                        className={`gap-2 bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 font-semibold disabled:opacity-40 ${
                          liveReview?.allStepsComplete
                            ? 'shadow-[0_0_24px_rgba(16,185,129,0.55)] animate-pulse'
                            : ''
                        }`}
                      >
                        {liveReview?.allStepsComplete && <CheckCircle2 size={14} />}
                        Done
                      </LuminaButton>
                    </div>
                  </div>

                  {/* Workspace path: a not-correct verdict, said without the worked solution or the checker's notes. */}
                  {checkedMiss && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
                      {checkedMiss.verdict === 'partial'
                        ? 'Checked: part of your work matches, but the solution is not right yet.'
                        : 'Checked: not right yet.'}
                    </div>
                  )}

                  <div
                    {...pip.workspace}
                    className={`flex-1 min-h-[420px] relative ${
                      phase.kind === 'solving' && canEdit ? '' : 'pointer-events-none'
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
                          <LuminaButton
                            size="sm"
                            onClick={cancelJudge}
                            className="text-slate-300 mt-2"
                          >
                            Cancel
                          </LuminaButton>
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
                            <LuminaButton
                              tone="primary"
                              size="sm"
                              onClick={() => { void handleDone(); }}
                              className="bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30"
                            >
                              {/* The shell's own Try again reopens a checked answer; this one only re-sends the check. */}
                              {tutorOwned ? 'Check again' : 'Try again'}
                            </LuminaButton>
                            <LuminaButton
                              size="sm"
                              onClick={cancelJudge}
                              className="text-slate-300"
                            >
                              Back to canvas
                            </LuminaButton>
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
                  marked={markedLines}
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
      </LuminaCardContent>
    </LuminaCard>
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
  /**
   * Support tier: show the procedural step TITLES (the worked-step skeleton /
   * method shape). When false (hard tier), the ledger shows bare numbered
   * slots so the student plans the derivation unaided. Defaults to true (no
   * tier applied → full scaffold). Titles never carry a step's result, so
   * showing them never leaks the answer.
   */
  showTitles?: boolean;
}

const StepLedger: React.FC<StepLedgerProps> = ({
  steps,
  liveReview,
  isReviewing,
  showTitles = true,
}) => {
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
                  {showTitles ? (
                    <span
                      className={`text-xs font-medium truncate ${textClass}`}
                      title={step.title}
                    >
                      {step.title}
                    </span>
                  ) : (
                    // Hard tier: withhold the method-shape title — bare slot only.
                    <span className={`text-xs font-medium truncate ${textClass}`}>
                      Step {i + 1}
                    </span>
                  )}
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
  /** The learner's own lines a pulled `mark_lines` marks: the checker flagged them, the fix is not shown. */
  marked?: readonly string[];
  liveReview: LiveReviewState | null;
  isTranscribing: boolean;
  lastError: string | null;
  canvasReady: boolean;
  strokeCount: number;
}

const TranscriptionRail: React.FC<TranscriptionRailProps> = ({
  lines,
  marked = [],
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
          const isMarked = marked.includes(line.latex);
          return (
            <div
              key={`${i}-${line.latex}`}
              data-marked={isMarked || undefined}
              className={`flex items-start gap-1.5 px-1 ${isMarked ? 'rounded-md ring-2 ring-amber-400/70 bg-amber-500/10 py-1' : ''}`}
            >
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
                {isMarked && (
                  <p className="text-[10px] font-semibold mt-0.5 text-amber-200 leading-snug">Check this line</p>
                )}
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


// The workspace path never mounts the scripted progress; the runtime owns the lesson there.
const PracticeProblem = withWorkspaceController<PracticeProblemProps, ProgressOptions<PracticeChallenge>, Progress>(
  'practice-problem', PracticeProblemSurface, useScriptedProgress, useWorkspaceProgressFor('practice-problem'));

export default PracticeProblem;
