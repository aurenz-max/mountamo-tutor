'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Eye, Pencil, Eraser, Trash2, Loader2, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { WhiteboardCanvas, type WhiteboardRef } from '../../components/scratch-pad/WhiteboardCanvas';
import { BackgroundType, type Stroke, type ToolType } from '../../components/scratch-pad/types';
import { KaTeX, MixedContent } from './StepContentRenderer';
import { useTranscription, type TranscribedLine } from './useTranscription';
import { RevealView } from './RevealView';
import type { RichAnnotatedExampleData } from './types';
import type { JudgeVerdict, LiveReviewState, LiveReviewStatus } from '../../service/annotated-example/judge-types';

interface TryItYourselfProps {
  /** The original worked example. Used as the seed for the sibling problem. */
  data: RichAnnotatedExampleData;
  /** Optional grade context for the sibling generator. Defaults to 'general'. */
  gradeLevel?: string;
  onClose: () => void;
  onReturnToWatch: () => void;
}

interface SiblingPayload {
  data: RichAnnotatedExampleData;
  rationale: string;
}

/**
 * Single discriminated union for the entire Try-It surface. Replaces the
 * earlier ambient mix of `sibling.status + mode + strokes` so every UI
 * region is a function of one phase value. See PRD § "State machine".
 */
type TryItPhase =
  | { kind: 'generating-sibling' }
  | { kind: 'sibling-error'; message: string }
  | { kind: 'solving'; sibling: SiblingPayload }
  | { kind: 'judging'; sibling: SiblingPayload; snapshot: TranscribedLine[] }
  | { kind: 'judge-error'; sibling: SiblingPayload; message: string }
  | { kind: 'reveal'; sibling: SiblingPayload; snapshot: TranscribedLine[]; verdict: JudgeVerdict };

/**
 * Full-screen "Now you try" surface — Phases A–D of the two-act loop.
 *
 * Phase A: solve. Canvas + transcription rail + Done gating (≥1 stroke).
 * Phase B: judge. Compare-work overlay over the canvas (canvas hidden, not
 *          unmounted, so cancelling preserves strokes).
 * Phase C: reveal. Verdict banner + side-by-side comparison + canonical with
 *          all annotation layers on.
 * Phase D: next-action. Try a new problem / Show me again / Done for now —
 *          rendered as the reveal-view footer.
 *
 * Sibling generation runs once on mount; "Try a new problem" from Phase C
 * resets the canvas and re-enters `generating-sibling` for a fresh sibling.
 */
export const TryItYourself: React.FC<TryItYourselfProps> = ({
  data,
  gradeLevel,
  onClose,
  onReturnToWatch,
}) => {
  const canvasRef = useRef<WhiteboardRef>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [phase, setPhase] = useState<TryItPhase>({ kind: 'generating-sibling' });
  /**
   * Bumped on "Try a new problem" so the sibling-fetch effect re-runs
   * cleanly without us having to call the fetch imperatively from a
   * callback (which would race with the in-flight cleanup).
   */
  const [siblingGen, setSiblingGen] = useState(0);

  const addToHistory = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
  }, []);

  // ── Sibling generation ────────────────────────────────────────────
  //
  // Fires on mount and again whenever `siblingGen` increments. Captures
  // the generation in a local so a stale response can't overwrite a newer
  // phase if the user clicked "Try a new problem" twice quickly.
  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: 'generating-sibling' });
    setStrokes([]);

    (async () => {
      try {
        const response = await fetch('/api/lumina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateSiblingExample',
            params: {
              originalProblem: data.problem.statement,
              originalStrategy: data.solutionStrategy,
              subject: data.subject,
              gradeContext: gradeLevel ?? 'general',
            },
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error || 'Sibling generation failed');
        }

        const payload = (await response.json()) as SiblingPayload;
        if (!payload.data || !payload.data.problem) {
          throw new Error('Sibling response missing problem data');
        }
        if (cancelled) return;
        setPhase({ kind: 'solving', sibling: payload });
      } catch (error) {
        if (cancelled) return;
        setPhase({
          kind: 'sibling-error',
          message: error instanceof Error ? error.message : 'Sibling generation failed',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data.problem.statement, data.solutionStrategy, data.subject, gradeLevel, siblingGen]);

  // ── Active problem + transcription context ───────────────────────
  //
  // Always derived from `phase` so the displayed problem can never get out
  // of sync with the sibling state.
  const activeSibling = useMemo<SiblingPayload | null>(() => {
    if (phase.kind === 'solving' || phase.kind === 'judging' || phase.kind === 'reveal' || phase.kind === 'judge-error') {
      return phase.sibling;
    }
    return null;
  }, [phase]);

  const activeProblem = activeSibling?.data.problem ?? data.problem;
  const activeSubject = activeSibling?.data.subject ?? data.subject;

  // Stable problem-statement string fed to the transcription prompt as
  // context. Equations + statement combined so the judge can disambiguate
  // the work it's reading.
  const problemContext = useMemo(() => {
    const parts: string[] = [];
    if (activeProblem.equations && activeProblem.equations.length > 0) {
      parts.push(...activeProblem.equations);
    }
    if (activeProblem.statement) parts.push(activeProblem.statement);
    return parts.join(' — ');
  }, [activeProblem]);

  const exportCanvasImage = useCallback(() => {
    return canvasRef.current?.exportImage() ?? '';
  }, []);

  // Transcription stays enabled only during the solve phase. During judge
  // and reveal, the canvas is hidden but mounted (so cancelling judge
  // restores strokes); pausing transcription avoids stale snapshots.
  const transcriptionEnabled = phase.kind === 'solving';

  // Pass the active sibling's canonical steps so the transcription hook
  // chains a `reviewProgress` call after each transcription. The reviewer
  // is the mid-solve coach — without it the rail is a passive mirror and
  // the student writes in silence until Done.
  const canonicalSteps = activeSibling?.data.steps;
  const { lines, isTranscribing, lastError, forceSnapshot, liveReview, isReviewing } = useTranscription({
    exportImage: exportCanvasImage,
    strokeCount: strokes.length,
    problemStatement: problemContext,
    enabled: transcriptionEnabled,
    canonicalSteps,
  });

  // ── Done flow (Phase A → B) ──────────────────────────────────────
  //
  // Force a final snapshot so the judge sees the latest stroke, not a
  // stale debounced one. Then call compareWork. On failure, surface a
  // retryable judge-error state with strokes intact.
  const handleDone = useCallback(async () => {
    console.log('[TryItYourself] Done pressed', {
      phase: phase.kind,
      strokeCount: strokes.length,
      transcribedLineCount: lines.length,
    });
    if (phase.kind !== 'solving') {
      console.log('[TryItYourself] Done ignored — phase is', phase.kind);
      return;
    }
    if (strokes.length === 0) {
      console.log('[TryItYourself] Done ignored — empty canvas');
      return;
    }

    // Best-effort flush — if the snapshot fails, we still proceed to
    // compareWork with whatever lines we already have. The PRD's
    // graceful-degradation principle: never block Done.
    try {
      await forceSnapshot();
    } catch {
      /* swallow — proceed with stale lines */
    }

    // Snapshot lines into a const so the rail can keep updating during the
    // judge call without affecting the verdict input.
    const snapshot: TranscribedLine[] = [...lines];
    const sibling = phase.sibling;
    console.log('[TryItYourself] entering judging phase', {
      snapshotLineCount: snapshot.length,
    });
    setPhase({ kind: 'judging', sibling, snapshot });

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compareWork',
          params: {
            problemStatement: problemContext,
            canonicalSteps: sibling.data.steps,
            transcribedLines: snapshot,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Compare failed');
      }

      const verdict = (await response.json()) as JudgeVerdict;
      console.log('[TryItYourself] judge resolved', {
        verdict: verdict.verdict,
        analyzedLines: verdict.stepAnalysis?.length,
      });
      setPhase({ kind: 'reveal', sibling, snapshot, verdict });
    } catch (error) {
      console.error('[TryItYourself] judge failed', error);
      setPhase({
        kind: 'judge-error',
        sibling,
        message: error instanceof Error ? error.message : 'Compare failed',
      });
    }
  }, [phase, strokes.length, forceSnapshot, lines, problemContext]);

  const cancelJudge = useCallback(() => {
    if (phase.kind === 'judging' || phase.kind === 'judge-error') {
      setPhase({ kind: 'solving', sibling: phase.sibling });
    }
  }, [phase]);

  // ── Phase D handlers ─────────────────────────────────────────────
  const handleTryNewProblem = useCallback(() => {
    // Increment generation counter — the sibling-fetch effect re-runs and
    // sets phase back to 'generating-sibling' / 'solving' on its own.
    setSiblingGen((g) => g + 1);
  }, []);

  const handleShowMeAgain = useCallback(() => {
    onReturnToWatch();
  }, [onReturnToWatch]);

  // Mount-gate the portal so SSR doesn't try to reach for document.body.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const canvasReady = phase.kind === 'solving' || phase.kind === 'judging' || phase.kind === 'judge-error';
  const showRevealView = phase.kind === 'reveal';
  const isJudging = phase.kind === 'judging';
  const judgeError = phase.kind === 'judge-error' ? phase.message : null;
  const siblingError = phase.kind === 'sibling-error' ? phase.message : null;
  const isLoadingSibling = phase.kind === 'generating-sibling';

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950"
    >
      {/* Reveal view replaces the entire surface in Phase C. */}
      <AnimatePresence>
        {showRevealView && phase.kind === 'reveal' && (
          <RevealView
            sibling={phase.sibling.data}
            studentLines={phase.snapshot}
            verdict={phase.verdict}
            onTryNewProblem={handleTryNewProblem}
            onShowMeAgain={handleShowMeAgain}
            onClose={onClose}
          />
        )}
      </AnimatePresence>

      {/* Solve surface — kept mounted under Reveal so canvas state survives
          a "Show me again" round-trip. Hidden when Reveal is shown. */}
      {!showRevealView && (
        <>
          {/* Top bar — problem pinned in a Lumina-themed card. */}
          <div className="px-5 pt-5 pb-4 border-b border-white/5 bg-slate-950 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-900/70 border-white/10 p-5 shadow-xl">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge
                        variant="outline"
                        className="text-emerald-300 border-emerald-400/40 bg-emerald-500/10 gap-1.5"
                      >
                        <Sparkles size={11} />
                        Now you try
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-blue-300 border-blue-400/30 bg-blue-500/10"
                      >
                        {activeSubject}
                      </Badge>
                    </div>

                    {isLoadingSibling ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        <p className="text-sm italic">
                          Generating a practice problem in the same skill family…
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                          Problem Statement
                        </p>
                        {activeProblem.equations && activeProblem.equations.length > 0 && (
                          <div className="flex flex-wrap items-center gap-3">
                            {activeProblem.equations.map((eq, i) => (
                              <KaTeX
                                key={i}
                                latex={eq}
                                display={false}
                                className="text-xl md:text-2xl text-white"
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-base md:text-lg text-slate-100 leading-relaxed">
                          <MixedContent text={activeProblem.statement} />
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pointer-events-none absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
                </Card>
              </div>

              <div className="flex flex-col gap-2 pt-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReturnToWatch}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 gap-2"
                >
                  <Eye size={14} />
                  Show me again
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 gap-2"
                  aria-label="Close try-it surface"
                >
                  <X size={14} />
                  Close
                </Button>
              </div>
            </div>
          </div>

          {/* Body — canvas + transcription rail. */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Canvas area */}
            <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
              {/* Live progress band — populated by reviewProgress after each
                  transcription. Hidden until the first review lands so the
                  area doesn't flash empty. Replaces nothing; sits above the
                  canvas toolbar. */}
              {(liveReview || isReviewing) && canonicalSteps && canonicalSteps.length > 0 && (
                <ProgressBand
                  liveReview={liveReview}
                  isReviewing={isReviewing}
                />
              )}

              {/* Canvas toolbar */}
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
                    onClick={() => setStrokes([])}
                    disabled={!canvasReady || strokes.length === 0}
                    className="gap-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 disabled:opacity-40"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </Button>
                  {/* Done — gated on ≥1 stroke per PRD Phase A refinement.
                      Disabled while judging so a double-click can't fire two
                      compareWork calls. Pulses emerald when the live
                      reviewer reports all canonical steps are reached, so
                      the student knows they can commit. */}
                  <Button
                    size="sm"
                    onClick={handleDone}
                    disabled={!canvasReady || strokes.length === 0 || isJudging}
                    className={`gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 font-semibold disabled:opacity-40 ${
                      liveReview?.allStepsComplete ? 'shadow-[0_0_24px_rgba(16,185,129,0.55)] animate-pulse' : ''
                    }`}
                  >
                    {liveReview?.allStepsComplete && <CheckCircle2 size={14} />}
                    Done
                  </Button>
                </div>
              </div>

              {/* Canvas — pointer-events disabled until sibling is ready or
                  during judging so the student can't write on a placeholder
                  / on a snapshot the judge already has. */}
              <div
                className={`flex-1 min-h-0 relative ${
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

                {/* Sibling-loading overlay — Phase A pre-fetch. */}
                {isLoadingSibling && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-blue-400 animate-spin" />
                      <p className="text-sm text-slate-300 font-medium">
                        Generating your practice problem…
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs text-center">
                        Same skill, different numbers. This usually takes 15–30 seconds.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sibling-error overlay — retry-able. */}
                {siblingError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl">
                    <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                      <AlertTriangle size={32} className="text-amber-400" />
                      <p className="text-sm text-slate-200 font-medium">
                        Couldn&apos;t generate a practice problem
                      </p>
                      <p className="text-xs text-slate-500">{siblingError}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          size="sm"
                          onClick={handleTryNewProblem}
                          className="bg-blue-500/20 border border-blue-400/40 text-blue-200 hover:bg-blue-500/30"
                        >
                          Try again
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onReturnToWatch}
                          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                        >
                          Back to walkthrough
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase B — judge in flight. Canvas stays mounted (so cancel
                    preserves strokes) but is masked. */}
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

                {/* Judge error — retry returns to solving with strokes intact. */}
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

            {/* Transcription rail. */}
            <div className="w-80 border-l border-slate-800 bg-slate-900/40 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Your work
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Transcribed as you write
                  </p>
                </div>
                {isTranscribing && (
                  <Loader2 size={14} className="text-slate-500 animate-spin flex-shrink-0" />
                )}
              </div>
              <div className="flex-1 px-4 py-3 overflow-y-auto space-y-2">
                {!canvasReady && (
                  <div className="text-xs text-slate-600 italic">
                    Transcription starts once your problem loads.
                  </div>
                )}

                {canvasReady && strokes.length === 0 && (
                  <div className="text-xs text-slate-600 italic">
                    Start writing on the canvas to see your work transcribed here.
                  </div>
                )}

                {canvasReady && strokes.length > 0 && lines.length === 0 && !isTranscribing && !lastError && (
                  <div className="text-xs text-slate-600 italic">
                    Waiting for the first transcription…
                  </div>
                )}

                {lines.map((line, i) => {
                  const lowConfidence = line.confidence < 0.7;
                  const review = liveReview?.lineReviews?.[i];
                  const tone = review ? LIVE_LINE_TONE[review.status] : null;
                  return (
                    <motion.div
                      key={`${i}-${line.latex}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`rounded-md px-3 py-2 border ${
                        tone
                          ? tone.rowClass
                          : lowConfidence
                            ? 'bg-slate-900/40 border-slate-800 text-slate-500'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">
                          {i + 1}
                        </span>
                        {tone && (
                          <span
                            className={`text-xs leading-none flex-shrink-0 ${tone.iconClass}`}
                            aria-label={review?.status}
                          >
                            {tone.symbol}
                          </span>
                        )}
                        <KaTeX
                          latex={line.latex}
                          display={false}
                          className={lowConfidence ? 'text-slate-500' : 'text-slate-100'}
                        />
                      </div>
                      {review?.message && (
                        <p className={`text-[11px] italic mt-1.5 ml-5 leading-relaxed ${tone?.messageClass ?? 'text-slate-400'}`}>
                          {review.message}
                        </p>
                      )}
                      {lowConfidence && !review?.message && (
                        <p className="text-[10px] text-amber-400/70 italic mt-1 ml-5">
                          Hard to read — try writing larger
                        </p>
                      )}
                    </motion.div>
                  );
                })}

                {lastError && (
                  <div className="text-xs text-amber-400/80 italic">
                    Couldn&apos;t reach the transcription service — keep working, your Done still goes through.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );

  return createPortal(overlay, document.body);
};

// ── Live-review presentation ─────────────────────────────────────────
//
// Tone map drives both the rail-line tints and the progress-band
// emphasis. Same color language as Reveal so the student sees coherent
// signal across the whole loop: emerald=on-track, cyan=shortcut,
// rose=off-track, slate=filler.

const LIVE_LINE_TONE: Record<
  LiveReviewStatus,
  {
    symbol: string;
    iconClass: string;
    rowClass: string;
    messageClass: string;
    bandLabel: string;
    bandClass: string;
  }
> = {
  'on-track': {
    symbol: '✓',
    iconClass: 'text-emerald-300',
    rowClass: 'bg-emerald-500/5 border-emerald-400/25 text-slate-100',
    messageClass: 'text-emerald-200/85',
    bandLabel: 'On track',
    bandClass: 'text-emerald-200',
  },
  shortcut: {
    symbol: '↗',
    iconClass: 'text-cyan-300',
    rowClass: 'bg-cyan-500/5 border-cyan-400/25 text-slate-100',
    messageClass: 'text-cyan-200/85',
    bandLabel: 'Shortcut',
    bandClass: 'text-cyan-200',
  },
  'off-track': {
    symbol: '⚠',
    iconClass: 'text-rose-300',
    rowClass: 'bg-rose-500/5 border-rose-400/25 text-slate-100',
    messageClass: 'text-rose-200/90',
    bandLabel: 'Off track',
    bandClass: 'text-rose-200',
  },
  filler: {
    symbol: ' ',
    iconClass: 'text-slate-600',
    rowClass: 'bg-slate-900/60 border-slate-800/80 text-slate-300',
    messageClass: 'text-slate-500',
    bandLabel: '',
    bandClass: 'text-slate-400',
  },
};

interface ProgressBandProps {
  liveReview: LiveReviewState | null;
  isReviewing: boolean;
}

/**
 * Thin status strip that sits above the canvas toolbar. Renders N pills
 * (k filled = k canonical steps reached) plus a right-aligned headline
 * sourced from the latest line's coaching message. When `allStepsComplete`
 * is true, the band turns emerald and primes the Done button's pulse.
 *
 * Hidden until the first review lands so the area doesn't flash empty
 * during the first transcription window. When a review is in flight
 * with no prior state, a slim loader is shown so the student knows the
 * coach is paying attention.
 */
const ProgressBand: React.FC<ProgressBandProps> = ({ liveReview, isReviewing }) => {
  if (!liveReview) {
    if (!isReviewing) return null;
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin text-blue-400" />
        Reading your work…
      </div>
    );
  }

  const { totalSteps, completedSteps, lineReviews, allStepsComplete, headline } = liveReview;
  const lastReview = lineReviews[lineReviews.length - 1];
  const lastTone = lastReview ? LIVE_LINE_TONE[lastReview.status] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
        allStepsComplete
          ? 'bg-emerald-500/10 border-emerald-400/40'
          : 'bg-slate-900/50 border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Now you try
        </span>
        <span className={`text-xs font-medium ${allStepsComplete ? 'text-emerald-200' : 'text-slate-300'}`}>
          {allStepsComplete
            ? `All ${totalSteps} steps complete`
            : `Step ${Math.min(completedSteps + 1, totalSteps)} of ${totalSteps}`}
        </span>
      </div>

      {/* N step pills, k filled. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const filled = i < completedSteps;
          return (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                filled
                  ? allStepsComplete
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.55)]'
                    : 'bg-emerald-400/85'
                  : 'bg-slate-700'
              }`}
            />
          );
        })}
      </div>

      {/* Right-aligned headline — falls back to the latest line's message
          when the model didn't supply a separate headline. */}
      <div className={`ml-auto flex items-center gap-2 min-w-0 text-xs ${
        allStepsComplete ? 'text-emerald-200' : lastTone?.bandClass ?? 'text-slate-400'
      }`}>
        {isReviewing && (
          <Loader2 size={11} className="animate-spin text-slate-500 flex-shrink-0" />
        )}
        {!allStepsComplete && lastTone?.bandLabel && (
          <span className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${lastTone.bandClass}`}>
            {lastTone.bandLabel}
          </span>
        )}
        <span className="truncate italic">
          {allStepsComplete
            ? 'Press Done when you’re ready.'
            : headline || lastReview?.message || ''}
        </span>
      </div>
    </motion.div>
  );
};
