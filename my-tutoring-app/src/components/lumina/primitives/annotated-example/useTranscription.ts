'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveReviewState } from '../../service/annotated-example/judge-types';
import type { Inset, RichExampleStep } from './types';

export interface TranscribedLine {
  latex: string;
  confidence: number;
}

interface UseTranscriptionOptions {
  /**
   * Returns a base64 PNG of the current canvas. Typically wired to
   * `WhiteboardCanvas`'s `exportImage` via a ref.
   */
  exportImage: () => string;
  /**
   * Stroke count from the canvas. The hook keys its debounce off changes
   * to this value — every new stroke restarts the inactivity timer.
   */
  strokeCount: number;
  /**
   * The problem the student is solving. Sent with every snapshot so the
   * vision call knows what context to interpret the handwriting in.
   */
  problemStatement: string;
  /**
   * Optional structured visual data the problem references (table, chart,
   * number line, etc.). Forwarded to transcribeWork + reviewProgress so
   * those calls see the same data the student is reading from.
   */
  inset?: Inset;
  /**
   * When false, the hook does nothing. Lets the consumer pause snapshots
   * (e.g. while the Reveal view is open) without unmounting.
   */
  enabled: boolean;
  /**
   * The canonical solution. When provided, the hook chains a
   * `reviewProgress` call after each successful transcription that yields
   * new lines, exposing live coaching state in `liveReview`. Pass an empty
   * array to disable live review (transcription still runs).
   */
  canonicalSteps?: RichExampleStep[];
  /**
   * Milliseconds of stroke inactivity before a snapshot fires. Default 1500
   * matches ScratchPad's existing Live Mode.
   */
  debounceMs?: number;
}

export interface UseTranscriptionResult {
  lines: TranscribedLine[];
  isTranscribing: boolean;
  lastError: string | null;
  /**
   * Force a snapshot immediately, bypassing the debounce. Resolves once the
   * call completes (or fails). Use from Done to flush before `compareWork`.
   */
  forceSnapshot: () => Promise<void>;
  /** Latest live-review state. Null until the first review call returns. */
  liveReview: LiveReviewState | null;
  /** True while a `reviewProgress` call is in flight. */
  isReviewing: boolean;
}

/**
 * Debounced snapshot loop for the AnnotatedExample Try-It surface.
 *
 * On every change to `strokeCount`, the hook waits `debounceMs` of inactivity,
 * then exports the canvas and POSTs to /api/lumina with `transcribeWork`.
 * Result lines are mirrored to state for the rail to render.
 *
 * When `canonicalSteps` is non-empty, every successful transcription that
 * yields a NEW set of lines (length grew or last line's KaTeX changed)
 * also fires `reviewProgress` to refresh the live coaching state. The
 * reviewer is text-only and cheap; same generation-counter discipline as
 * transcription so a slow review can't overwrite a newer one.
 *
 * Concurrency: a generation counter discards results from snapshots that
 * fired before the latest one. This is what keeps the rail from flickering
 * back to stale state when a slow request finishes after a fast one.
 *
 * Failure: errors are swallowed onto `lastError` (the rail dims, the
 * student keeps writing). The Try-It surface is additive — a failed
 * snapshot must never block Done.
 */
export function useTranscription(opts: UseTranscriptionOptions): UseTranscriptionResult {
  const { exportImage, strokeCount, problemStatement, enabled, canonicalSteps, inset } = opts;
  const debounceMs = opts.debounceMs ?? 1500;

  const [lines, setLines] = useState<TranscribedLine[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [liveReview, setLiveReview] = useState<LiveReviewState | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const generationRef = useRef(0);
  const inFlightRef = useRef(0);
  const reviewGenRef = useRef(0);
  const reviewedLinesKeyRef = useRef<string>('');

  const reviewKey = useCallback((rls: TranscribedLine[]) => {
    // Stable identity for "have these lines already been reviewed?". Length
    // change OR final-line latex change triggers a re-review; identical
    // arrays skip the call.
    return `${rls.length}::${rls[rls.length - 1]?.latex ?? ''}`;
  }, []);

  const runReview = useCallback(
    async (currentLines: TranscribedLine[]) => {
      if (!canonicalSteps || canonicalSteps.length === 0) return;
      if (currentLines.length === 0) {
        setLiveReview(null);
        reviewedLinesKeyRef.current = '';
        return;
      }
      const key = reviewKey(currentLines);
      if (key === reviewedLinesKeyRef.current) return;
      reviewedLinesKeyRef.current = key;

      const generation = ++reviewGenRef.current;
      setIsReviewing(true);
      try {
        const response = await fetch('/api/lumina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reviewProgress',
            params: {
              problemStatement,
              canonicalSteps,
              transcribedLines: currentLines,
              inset,
            }
          }),
        });
        if (!response.ok) throw new Error('Review request failed');
        const data = (await response.json()) as LiveReviewState;
        if (generation !== reviewGenRef.current) return;
        setLiveReview(data);
      } catch (error) {
        // Reviewer failure degrades silently per PRD acceptance criteria
        // — the rail keeps transcribing, the progress band hides.
        console.warn('[reviewProgress] failed', error);
      } finally {
        if (generation === reviewGenRef.current) setIsReviewing(false);
      }
    },
    [canonicalSteps, problemStatement, reviewKey, inset],
  );

  const runSnapshot = useCallback(async () => {
    if (!enabled) return;
    const generation = ++generationRef.current;
    inFlightRef.current += 1;
    setIsTranscribing(true);

    try {
      const imageBase64 = exportImage();
      if (!imageBase64) {
        return;
      }

      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transcribeWork',
          params: { imageBase64, problemStatement, inset },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = (await response.json()) as { lines?: TranscribedLine[] };

      // Discard if a newer snapshot has already started.
      if (generation !== generationRef.current) return;

      const nextLines = Array.isArray(data.lines) ? data.lines : [];
      setLines(nextLines);
      setLastError(null);

      // Chain the live reviewer if canonicalSteps were provided.
      // Intentionally fire-and-forget — the rail and review states are
      // independent surfaces.
      void runReview(nextLines);
    } catch (error) {
      if (generation !== generationRef.current) return;
      setLastError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setIsTranscribing(false);
    }
  }, [enabled, exportImage, problemStatement, runReview, inset]);

  // Debounce on stroke-count changes. First stroke starts the timer; every
  // additional stroke before the timer fires resets it. No snapshot when
  // the canvas is empty.
  useEffect(() => {
    if (!enabled) return;
    if (strokeCount === 0) {
      setLines([]);
      setLiveReview(null);
      reviewedLinesKeyRef.current = '';
      return;
    }
    const handle = setTimeout(() => {
      runSnapshot();
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [strokeCount, enabled, debounceMs, runSnapshot]);

  return {
    lines,
    isTranscribing,
    lastError,
    forceSnapshot: runSnapshot,
    liveReview,
    isReviewing,
  };
}
