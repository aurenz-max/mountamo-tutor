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
import { InsetRenderer } from '../problem-primitives/insets/InsetRenderer';
import type { RichAnnotatedExampleData } from './types';
import type { JudgeVerdict, LiveReviewState, LiveReviewStatus } from '../../service/annotated-example/judge-types';

interface TryItYourselfProps {
  /**
   * Pre-hydrated practice problem. The orchestrator (or other upstream
   * caller) supplies this at load time — the primitive never authors
   * problems mid-flight. Multi-phase primitive pattern.
   */
  tryData: RichAnnotatedExampleData;
  onClose: () => void;
  onReturnToWatch: () => void;
  /**
   * Optional callback fired from the reveal view's "Try a new problem"
   * button. The parent decides what new problem to load (re-hydrate the
   * slot, advance to next slot in a plan, etc.) and re-mounts the surface
   * with the new `tryData`. When undefined, the regenerate button is
   * hidden — fits the orchestrated flow where slot navigation lives in
   * the parent.
   */
  onTryAnother?: () => void;
}

/**
 * Single discriminated union for the entire Try-It surface. Replaces the
 * earlier ambient mix of `sibling.status + mode + strokes` so every UI
 * region is a function of one phase value. See PRD § "State machine".
 */
type TryItPhase =
  | { kind: 'solving' }
  | { kind: 'judging'; snapshot: TranscribedLine[] }
  | { kind: 'judge-error'; message: string }
  | { kind: 'reveal'; snapshot: TranscribedLine[]; verdict: JudgeVerdict };

/**
 * Full-screen "Now you try" surface — Phases A–C of the two-act loop.
 *
 * Phase A: solve. Canvas + transcription rail + Done gating (≥1 stroke).
 * Phase B: judge. Compare-work overlay over the canvas (canvas hidden, not
 *          unmounted, so cancelling preserves strokes).
 * Phase C: reveal. Verdict banner + side-by-side comparison + canonical with
 *          all annotation layers on. Footer offers Try-another / Show me
 *          again / Done — Try-another only when the parent provides it.
 *
 * The practice problem is supplied by the parent via `tryData`. The
 * primitive owns canvas / transcription / judge state — never authoring.
 */
export const TryItYourself: React.FC<TryItYourselfProps> = ({
  tryData,
  onClose,
  onReturnToWatch,
  onTryAnother,
}) => {
  const canvasRef = useRef<WhiteboardRef>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [phase, setPhase] = useState<TryItPhase>({ kind: 'solving' });

  // ── V4 overlay state ────────────────────────────────────────────────
  // Off-track pins the student has dismissed (resets per problem). The
  // freshly-confirmed on-track badge auto-fades 3s after a new on-track
  // line lands; we track its line index here.
  const [dismissedPins, setDismissedPins] = useState<Set<number>>(new Set());
  const [freshOnTrackIndex, setFreshOnTrackIndex] = useState<number | null>(null);
  // True after ~2.5s of no new strokes. Off-track pins are gated on this
  // so they don't flash red mid-write before the line is even finished.
  const [isStrokeIdle, setIsStrokeIdle] = useState(true);

  const addToHistory = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
  }, []);

  // Reset canvas + phase when the parent swaps tryData (e.g. "Try another"
  // re-hydrates the slot). Keyed off problem statement identity since the
  // bundled tryProblem is reference-stable until the parent rebuilds it.
  useEffect(() => {
    setStrokes([]);
    setPhase({ kind: 'solving' });
    setDismissedPins(new Set());
    setFreshOnTrackIndex(null);
  }, [tryData]);

  const activeProblem = tryData.problem;
  const activeSubject = tryData.subject;

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

  // Pass the canonical steps so the transcription hook chains a
  // `reviewProgress` call after each transcription. The reviewer is the
  // mid-solve coach — without it the rail is a passive mirror and the
  // student writes in silence until Done.
  const canonicalSteps = tryData.steps;
  const activeInset = activeProblem.inset;
  const { lines, isTranscribing, lastError, forceSnapshot, liveReview, isReviewing } = useTranscription({
    exportImage: exportCanvasImage,
    strokeCount: strokes.length,
    problemStatement: problemContext,
    enabled: transcriptionEnabled,
    canonicalSteps,
    inset: activeInset,
  });

  // Auto-fade the on-track confirmation badge: when the latest review is
  // on-track, flash a badge for 3s then clear. Re-arms whenever a newer
  // on-track line lands.
  useEffect(() => {
    const reviews = liveReview?.lineReviews;
    if (!reviews || reviews.length === 0) return;
    const lastIdx = reviews.length - 1;
    if (reviews[lastIdx].status !== 'on-track') return;
    setFreshOnTrackIndex(lastIdx);
    const t = setTimeout(() => setFreshOnTrackIndex((v) => (v === lastIdx ? null : v)), 3000);
    return () => clearTimeout(t);
  }, [liveReview?.lineReviews]);

  const handleDismissPin = useCallback((lineIndex: number) => {
    setDismissedPins((prev) => {
      const next = new Set(prev);
      next.add(lineIndex);
      return next;
    });
  }, []);

  const handleReopenPin = useCallback((lineIndex: number) => {
    setDismissedPins((prev) => {
      if (!prev.has(lineIndex)) return prev;
      const next = new Set(prev);
      next.delete(lineIndex);
      return next;
    });
  }, []);

  // Stroke-idle gate. Mark idle=false the moment a new stroke arrives,
  // and schedule idle=true after 2.5s of inactivity. The off-track pin
  // (which is the only intrusive overlay) is gated on this so it doesn't
  // pop mid-write — the student gets to finish their thought first.
  useEffect(() => {
    setIsStrokeIdle(false);
    const t = setTimeout(() => setIsStrokeIdle(true), 2500);
    return () => clearTimeout(t);
  }, [strokes.length]);

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
    console.log('[TryItYourself] entering judging phase', {
      snapshotLineCount: snapshot.length,
    });
    setPhase({ kind: 'judging', snapshot });

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compareWork',
          params: {
            problemStatement: problemContext,
            canonicalSteps: tryData.steps,
            transcribedLines: snapshot,
            inset: tryData.problem.inset,
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
      setPhase({ kind: 'reveal', snapshot, verdict });
    } catch (error) {
      console.error('[TryItYourself] judge failed', error);
      setPhase({
        kind: 'judge-error',
        message: error instanceof Error ? error.message : 'Compare failed',
      });
    }
  }, [phase, strokes.length, forceSnapshot, lines, problemContext, tryData]);

  const cancelJudge = useCallback(() => {
    if (phase.kind === 'judging' || phase.kind === 'judge-error') {
      setPhase({ kind: 'solving' });
    }
  }, [phase]);

  // ── Phase D handlers ─────────────────────────────────────────────
  // Re-roll is delegated to the parent — the primitive doesn't author. When
  // `onTryAnother` is undefined the reveal-view button is hidden.
  const handleTryNewProblem = useCallback(() => {
    onTryAnother?.();
  }, [onTryAnother]);

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
            sibling={tryData}
            studentLines={phase.snapshot}
            verdict={phase.verdict}
            onTryNewProblem={onTryAnother ? handleTryNewProblem : undefined}
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
                <Card className="relative overflow-hidden backdrop-blur-xl bg-slate-900/40 border border-white/10 ring-1 ring-white/5 p-5 shadow-2xl shadow-black/40">
                  {/* Hairline gradient along the top edge — gives the card
                      a premium "glass panel" feel rather than a flat box. */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

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

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-emerald-400/70 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em] font-semibold">
                          Problem Statement
                        </p>
                      </div>
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
                      {activeInset && <InsetRenderer inset={activeInset} />}
                    </div>
                  </div>

                  {/* Atmospheric color blobs — emerald top-right, blue
                      bottom-left. Together they give the card a soft
                      Lumina aurora glow without dominating the content. */}
                  <div className="pointer-events-none absolute top-0 right-0 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
                  <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
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
              {/* Live progress band — mounted from the start whenever the
                  sibling carries canonical steps so the canvas never
                  reflows when the first review lands. Pre-review the slots
                  render in a muted "future" state, telegraphing the shape
                  of the solve before the student starts writing. */}
              {canonicalSteps && canonicalSteps.length > 0 && (
                <StepLedger
                  steps={canonicalSteps}
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

                {/* Canvas overlays — emerald outlines (on-track), cyan
                    bars (shortcut), auto-fading on-track badge, off-track
                    pin. Hidden during judge/reveal/error overlays which
                    sit above this layer. */}
                {phase.kind === 'solving' && (
                  <CanvasOverlays
                    strokes={strokes}
                    lineCount={lines.length}
                    liveReview={liveReview}
                    freshOnTrackIndex={freshOnTrackIndex}
                    dismissedPins={dismissedPins}
                    isStrokeIdle={isStrokeIdle}
                    onDismissPin={handleDismissPin}
                    onReopenPin={handleReopenPin}
                  />
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

            {/* Margin gutter — narrow column that shares the canvas
                background, with each transcribed line vertically anchored
                next to the strokes that produced it (Y-centroid heuristic
                with graceful fallback to a stacked list). */}
            <MarginGutter
              lines={lines}
              strokes={strokes}
              liveReview={liveReview}
              isTranscribing={isTranscribing}
              lastError={lastError}
              canvasReady={canvasReady}
            />
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

interface StepLedgerProps {
  /** Canonical steps from the sibling — drives slot count and titles. */
  steps: Array<{ id: number; title: string }>;
  liveReview: LiveReviewState | null;
  isReviewing: boolean;
}

/**
 * Step Ledger — horizontal row of named slots along the top of the canvas.
 * Each slot is a canonical step (titled, e.g. "Isolate the variable"). As
 * the student's work satisfies a step, that slot fills with an emerald
 * wash. The active slot (next-up) carries a soft outline and an ambient
 * one-line caption beneath it sourced from the live coaching headline.
 *
 * Replaces the older "Step k of N · ●●○○" progress band. The named slots
 * give each step identity and let the student see the *shape* of the
 * solve before they start — without spoiling the work itself.
 *
 * Until the first review lands, a slim loader stands in so the area
 * doesn't flash empty during the first transcription window.
 */
const StepLedger: React.FC<StepLedgerProps> = ({ steps, liveReview, isReviewing }) => {
  // Pull review state through nullish defaults so the slot row renders
  // identically before and after the first review lands. Mounting the
  // ledger pre-review used to be gated behind an early return, which
  // caused the canvas to reflow downward the moment transcription
  // produced a result — pernicious because in-flight pen contact would
  // suddenly be offset from where the student was writing.
  const completedSteps = liveReview?.completedSteps ?? 0;
  const lineReviews = liveReview?.lineReviews ?? [];
  const allStepsComplete = liveReview?.allStepsComplete ?? false;
  const headline = liveReview?.headline ?? null;
  const lastReview = lineReviews[lineReviews.length - 1];
  const lastTone = lastReview ? LIVE_LINE_TONE[lastReview.status] : null;
  const activeIndex = allStepsComplete ? -1 : Math.min(completedSteps, steps.length - 1);

  // Steps reached via a shortcut line render with a cyan wash instead of
  // emerald — signals "you collapsed past this" rather than "you walked
  // through it." We pick the most-recent review per matched step so a
  // later on-track line on the same step would override the cyan tint.
  const shortcutSteps = new Set<number>();
  for (const review of lineReviews) {
    if (review.matchedStep === null) continue;
    if (review.status === 'shortcut') shortcutSteps.add(review.matchedStep);
    else shortcutSteps.delete(review.matchedStep);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-2"
    >
      {/* Slot row. Slots flex-grow proportionally so longer titles get room. */}
      <div className="flex items-stretch gap-1.5">
        {steps.map((step, i) => {
          const isCompleted = i < completedSteps;
          const isActive = i === activeIndex;
          const isShortcut = shortcutSteps.has(i);

          // Color states. Completed = emerald wash; shortcut-reached =
          // cyan wash; active = subtle outline; future = muted slate.
          // all-complete brightens emerald slots but leaves cyan slots
          // tinted (the shortcut signal persists through completion).
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
            <div key={step.id} className="flex-1 min-w-0 relative">
              <motion.div
                layout
                animate={{
                  backgroundColor: undefined, // Tailwind classes drive the actual color.
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`relative px-3 py-1.5 rounded-md border transition-colors duration-300 ease-out ${slotClass}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[9px] font-mono flex-shrink-0 ${ordinalClass}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-xs font-medium truncate ${textClass}`} title={step.title}>
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
              </motion.div>
            </div>
          );
        })}

        {/* Inline loader chip — signals the coach is reading without
            displacing slot widths. */}
        {isReviewing && (
          <div className="flex items-center px-2">
            <Loader2 size={12} className="animate-spin text-slate-500" />
          </div>
        )}
      </div>

      {/* Ambient caption — always rendered so the ledger's height stays
          stable as coaching messages come and go. Empty until a review
          lands; the min-h reserves the line. */}
      <div className="flex items-center gap-2 min-h-[1rem] px-1">
        {!allStepsComplete && lastTone?.bandLabel && (
          <span className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${lastTone.bandClass}`}>
            {lastTone.bandLabel}
          </span>
        )}
        <span className={`truncate italic text-xs ${
          allStepsComplete ? 'text-emerald-200' : lastTone?.bandClass ?? 'text-slate-400'
        }`}>
          {allStepsComplete
            ? `All ${steps.length} steps complete — press Done when you’re ready.`
            : headline || lastReview?.message || ''}
        </span>
      </div>
    </motion.div>
  );
};

// ── Margin gutter ────────────────────────────────────────────────────
//
// Replaces the older 320px right rail. Each transcribed line is vertically
// anchored beside the strokes that produced it (y-centroid heuristic).
// Status pills sit at the gutter's left edge, reading as track markers
// along the canvas rather than badges on a chat log row.

const ANCHOR_PAD_TOP = 8;
const ANCHOR_PAD_BOTTOM = 8;
const ANCHOR_MIN_SPACING = 56; // px between lines, prevents overlap
const ANCHOR_LINE_HEIGHT = 48;  // approx height of a line card incl. note

/**
 * Cluster strokes into `lineCount` ordered groups by y-centroid. Returns
 * an array of stroke-index arrays (one per transcribed line), or null when
 * the input doesn't admit a sensible partition. Shared between the gutter
 * anchors and the canvas overlay bboxes — keeps both surfaces in sync.
 */
function partitionStrokesByY(
  strokes: Stroke[],
  lineCount: number,
): number[][] | null {
  if (lineCount === 0 || strokes.length < lineCount) return null;

  const indexed: Array<{ i: number; y: number }> = [];
  for (let i = 0; i < strokes.length; i += 1) {
    const pts = strokes[i].points;
    if (pts.length === 0) continue;
    let sum = 0;
    for (const p of pts) sum += p.y;
    indexed.push({ i, y: sum / pts.length });
  }
  if (indexed.length < lineCount) return null;

  indexed.sort((a, b) => a.y - b.y);
  const groupSize = indexed.length / lineCount;
  const groups: number[][] = [];
  for (let g = 0; g < lineCount; g += 1) {
    const start = Math.floor(g * groupSize);
    const end = Math.max(start + 1, Math.floor((g + 1) * groupSize));
    groups.push(indexed.slice(start, end).map((o) => o.i));
  }
  return groups;
}

/**
 * Compute a y-position (in CSS px, within the gutter body) for each
 * transcribed line. Returns null when the heuristic can't safely place
 * lines without overlap or overflow — caller falls back to stacked list.
 */
function computeLineAnchors(
  strokes: Stroke[],
  lineCount: number,
  bodyHeight: number,
): number[] | null {
  if (bodyHeight < ANCHOR_MIN_SPACING * lineCount) return null;
  const groups = partitionStrokesByY(strokes, lineCount);
  if (!groups) return null;

  // Mean y of each partition.
  const groupMeans: number[] = [];
  for (const g of groups) {
    let sum = 0;
    for (const idx of g) {
      const pts = strokes[idx].points;
      let pSum = 0;
      for (const p of pts) pSum += p.y;
      sum += pSum / pts.length;
    }
    groupMeans.push(sum / g.length);
  }

  const minY = Math.min(...groupMeans);
  const maxY = Math.max(...groupMeans);
  if (maxY - minY < 1) return null; // strokes all collapsed.

  const usable = bodyHeight - ANCHOR_PAD_TOP - ANCHOR_PAD_BOTTOM - ANCHOR_LINE_HEIGHT;
  if (usable < ANCHOR_MIN_SPACING * (lineCount - 1)) return null;
  const normalized = groupMeans.map(
    (g) => ANCHOR_PAD_TOP + ((g - minY) / (maxY - minY)) * usable,
  );

  const out: number[] = [normalized[0]];
  for (let i = 1; i < lineCount; i += 1) {
    const next = Math.max(normalized[i], out[i - 1] + ANCHOR_MIN_SPACING);
    out.push(next);
  }
  if (out[out.length - 1] > bodyHeight - ANCHOR_PAD_BOTTOM - ANCHOR_LINE_HEIGHT) {
    return null;
  }
  return out;
}

/** Stroke-bbox for a partition, in CSS-pixel canvas-local coords. */
interface LineBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getLineBboxes(strokes: Stroke[], lineCount: number): Array<LineBbox | null> {
  const groups = partitionStrokesByY(strokes, lineCount);
  if (!groups) return new Array(lineCount).fill(null);

  return groups.map((indices) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const idx of indices) {
      for (const p of strokes[idx].points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (!Number.isFinite(minX)) return null;
    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    };
  });
}

// ── Canvas overlays ──────────────────────────────────────────────────
//
// Annotations layered on top of the canvas. The canvas accumulates
// emerald outlines (on-track), cyan left bars (shortcut), an auto-fading
// badge on the latest on-track line, and a coral pin on the latest
// off-track line. Sibling of <WhiteboardCanvas> with absolute inset-0 +
// pointer-events-none so drawing keeps working underneath.

interface CanvasOverlaysProps {
  strokes: Stroke[];
  lineCount: number;
  liveReview: LiveReviewState | null;
  /** Line index whose on-track badge should still be flashing (auto-fades). */
  freshOnTrackIndex: number | null;
  /** Off-track lines the student dismissed. */
  dismissedPins: Set<number>;
  /** True after ~2.5s of stroke inactivity. Off-track pins are gated on
   *  this so they don't pop mid-write before the line is finished. */
  isStrokeIdle: boolean;
  onDismissPin: (lineIndex: number) => void;
  onReopenPin: (lineIndex: number) => void;
}

const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  strokes,
  lineCount,
  liveReview,
  freshOnTrackIndex,
  dismissedPins,
  isStrokeIdle,
  onDismissPin,
  onReopenPin,
}) => {
  const bboxes = useMemo(() => getLineBboxes(strokes, lineCount), [strokes, lineCount]);
  const reviews = liveReview?.lineReviews;
  if (!reviews || reviews.length === 0) return null;

  // Latest off-track that hasn't been dismissed — only one pin shown at a
  // time so the canvas doesn't clutter on a long off-track run.
  let activePinIndex: number | null = null;
  for (let i = reviews.length - 1; i >= 0; i -= 1) {
    if (reviews[i].status === 'off-track' && !dismissedPins.has(i)) {
      activePinIndex = i;
      break;
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Persistent per-line annotations: outlines for on-track,
          left bars for shortcut. Off-track lines get nothing persistent
          because the active pin handles them. */}
      {reviews.map((review, i) => {
        const bbox = bboxes[i];
        if (!bbox) return null;
        const PAD = 6;

        if (review.status === 'on-track') {
          return (
            <div
              key={`outline-${i}`}
              className="absolute rounded-md border border-emerald-400/30"
              style={{
                left: bbox.x - PAD,
                top: bbox.y - PAD,
                width: bbox.width + PAD * 2,
                height: bbox.height + PAD * 2,
              }}
            />
          );
        }
        if (review.status === 'shortcut') {
          return (
            <div
              key={`bar-${i}`}
              className="absolute w-0.5 bg-cyan-400/60 rounded-full"
              style={{
                left: bbox.x - PAD - 3,
                top: bbox.y - PAD,
                height: bbox.height + PAD * 2,
              }}
            />
          );
        }
        return null;
      })}

      {/* Per-line status pills as overlay buttons. Mirrors the gutter
          markers but inline on the canvas, anchored at the top-right of
          each stroke bbox. Clicking an off-track pill re-opens its
          dismissed pin so the student can revisit the coaching message. */}
      {reviews.map((review, i) => {
        const bbox = bboxes[i];
        if (!bbox) return null;
        const tone = LIVE_LINE_TONE[review.status];
        if (review.status === 'filler') return null;

        const PAD = 6;
        const pillSize = 22;
        const isDismissedOffTrack = review.status === 'off-track' && dismissedPins.has(i);
        const isClickable = review.status === 'off-track';

        const borderClass =
          review.status === 'on-track'
            ? 'border-emerald-400/60'
            : review.status === 'shortcut'
              ? 'border-cyan-400/60'
              : 'border-rose-400/60';

        return (
          <button
            key={`pill-${i}`}
            type="button"
            disabled={!isClickable}
            onClick={isClickable ? () => onReopenPin(i) : undefined}
            aria-label={`Line ${i + 1} ${review.status}${
              isDismissedOffTrack ? ' — click to revisit' : ''
            }`}
            className={`absolute rounded-full bg-slate-950/80 backdrop-blur border flex items-center justify-center text-[11px] font-bold leading-none transition-all ${borderClass} ${
              tone.iconClass
            } ${
              isClickable
                ? 'pointer-events-auto cursor-pointer hover:scale-110 hover:shadow-[0_0_10px_rgba(251,113,133,0.5)]'
                : ''
            } ${isDismissedOffTrack ? 'opacity-70 hover:opacity-100' : ''}`}
            style={{
              left: bbox.x + bbox.width + PAD,
              top: bbox.y - PAD - pillSize / 2,
              width: pillSize,
              height: pillSize,
            }}
          >
            {tone.symbol}
          </button>
        );
      })}

      {/* Latest on-track confirmation badge — emerald check, fades after 3s. */}
      <AnimatePresence>
        {freshOnTrackIndex !== null && bboxes[freshOnTrackIndex] && (
          <motion.div
            key={`badge-${freshOnTrackIndex}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.5 } }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute"
            style={{
              left: bboxes[freshOnTrackIndex]!.x + bboxes[freshOnTrackIndex]!.width + 8,
              top: bboxes[freshOnTrackIndex]!.y + bboxes[freshOnTrackIndex]!.height - 18,
            }}
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/25 border border-emerald-400/60 flex items-center justify-center shadow-[0_0_16px_rgba(52,211,153,0.5)]">
              <CheckCircle2 size={14} className="text-emerald-200" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Off-track pin — coral callout with message + step ref + Got it.
          Gated on stroke idle so it doesn't pop mid-write. The pill above
          stays visible during the write so the student can re-open the
          pin themselves once they're done thinking. */}
      <AnimatePresence>
        {isStrokeIdle && activePinIndex !== null && bboxes[activePinIndex] && (() => {
          const review = reviews[activePinIndex];
          const bbox = bboxes[activePinIndex]!;
          // Pin sits to the right of the strokes if there's room, else above.
          return (
            <motion.div
              key={`pin-${activePinIndex}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute"
              style={{
                left: bbox.x + bbox.width + 12,
                top: bbox.y + bbox.height / 2 - 24,
                maxWidth: 260,
              }}
            >
              <div className="rounded-lg border border-rose-400/50 bg-rose-950/85 backdrop-blur px-3 py-2 shadow-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="text-rose-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {review.matchedStep !== null && (
                      <p className="text-[9px] uppercase tracking-wider text-rose-300/80 font-semibold mb-0.5">
                        Re-check step {review.matchedStep + 1}
                      </p>
                    )}
                    <p className="text-xs text-rose-100 leading-snug">
                      {review.message ?? 'This line drifts from the plan — take another look.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onDismissPin(activePinIndex!)}
                      className="pointer-events-auto mt-1.5 text-[10px] uppercase tracking-wider font-semibold text-rose-200 hover:text-rose-100 transition-colors"
                    >
                      Got it →
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

interface MarginGutterProps {
  lines: TranscribedLine[];
  strokes: Stroke[];
  liveReview: LiveReviewState | null;
  isTranscribing: boolean;
  lastError: string | null;
  canvasReady: boolean;
}

const MarginGutter: React.FC<MarginGutterProps> = ({
  lines,
  strokes,
  liveReview,
  isTranscribing,
  lastError,
  canvasReady,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setBodyHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const anchors = useMemo(
    () => computeLineAnchors(strokes, lines.length, bodyHeight),
    [strokes, lines.length, bodyHeight],
  );

  return (
    <div className="w-40 flex-shrink-0 flex flex-col py-4 pr-2">
      {/* Header — minimal, blends with canvas surface. */}
      <div className="px-2 pb-2 flex items-center justify-between min-h-[1.5rem]">
        <p className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold">
          Your work
        </p>
        {isTranscribing && (
          <Loader2 size={11} className="text-slate-600 animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Body — positioning context for anchored lines, fall-through to
          stacked list when anchors === null. */}
      <div ref={bodyRef} className="flex-1 relative min-h-0 overflow-hidden">
        {!canvasReady && (
          <p className="text-[10px] text-slate-600 italic px-2 pt-1">
            Transcription starts when the problem loads.
          </p>
        )}
        {canvasReady && strokes.length === 0 && (
          <p className="text-[10px] text-slate-600 italic px-2 pt-1">
            Start writing — your lines will appear here beside your work.
          </p>
        )}
        {canvasReady && strokes.length > 0 && lines.length === 0 && !isTranscribing && !lastError && (
          <p className="text-[10px] text-slate-600 italic px-2 pt-1">Reading your work…</p>
        )}

        {anchors === null ? (
          // Fallback: stacked list (anchoring couldn't find a safe layout).
          <div className="space-y-2 px-1 overflow-y-auto h-full">
            {lines.map((line, i) => (
              <GutterLine
                key={`${i}-${line.latex}`}
                index={i}
                line={line}
                review={liveReview?.lineReviews?.[i]}
                positioned={false}
              />
            ))}
          </div>
        ) : (
          // Anchored: each line absolutely positioned by its computed y.
          lines.map((line, i) => (
            <GutterLine
              key={`${i}-${line.latex}`}
              index={i}
              line={line}
              review={liveReview?.lineReviews?.[i]}
              positioned
              top={anchors[i]}
            />
          ))
        )}

        {lastError && (
          <p className="absolute bottom-1 left-1 right-1 text-[9px] text-amber-400/80 italic">
            Transcription unreachable — keep working.
          </p>
        )}
      </div>
    </div>
  );
};

interface GutterLineProps {
  index: number;
  line: TranscribedLine;
  review?: LiveReviewState['lineReviews'][number];
  positioned: boolean;
  top?: number;
}

/** Single transcribed line as marginalia: track-marker pill at left,
 *  KaTeX + optional coaching message to its right. */
const GutterLine: React.FC<GutterLineProps> = ({ index, line, review, positioned, top }) => {
  const tone = review ? LIVE_LINE_TONE[review.status] : null;
  const lowConfidence = line.confidence < 0.7;

  // Pill border color tracks status; absent review = neutral slate marker.
  const pillBorder =
    review?.status === 'on-track'
      ? 'border-emerald-400/50'
      : review?.status === 'shortcut'
        ? 'border-cyan-400/50'
        : review?.status === 'off-track'
          ? 'border-rose-400/50'
          : 'border-slate-700';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, top: positioned ? top : undefined }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={positioned ? 'absolute left-0 right-0 px-1' : 'px-1'}
      style={positioned ? { top } : undefined}
    >
      <div className="flex items-start gap-1.5">
        <div
          className={`w-5 h-5 rounded-full bg-slate-950/70 border flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-none ${pillBorder} ${
            tone?.iconClass ?? 'text-slate-600'
          }`}
          aria-label={review?.status ?? `line ${index + 1}`}
        >
          {tone ? tone.symbol : index + 1}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[11px] leading-snug overflow-hidden">
            <KaTeX
              latex={line.latex}
              display={false}
              className={lowConfidence ? 'text-slate-500' : 'text-slate-100'}
            />
          </div>
          {review?.message && (
            <p className={`text-[10px] italic mt-0.5 leading-snug ${tone?.messageClass ?? 'text-slate-400'}`}>
              {review.message}
            </p>
          )}
          {lowConfidence && !review?.message && (
            <p className="text-[9px] text-amber-400/70 italic mt-0.5">
              Hard to read
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
