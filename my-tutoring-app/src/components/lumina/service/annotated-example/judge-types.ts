/**
 * Client-safe types for the AnnotatedExample judge.
 *
 * `judge.ts` itself transitively imports `server-only` (via `geminiClient`),
 * so client components can't import from it directly. This module re-exports
 * just the result/payload shapes so the Reveal view, transcription rail, and
 * the TryItYourself state machine can type their props without dragging the
 * server-only Gemini client into the bundle.
 *
 * Keep in sync with `judge.ts` — these are the wire shapes returned by the
 * `/api/lumina` `compareWork` and `transcribeWork` actions.
 */

export type CompareLineStatus = 'aligned' | 'shortcut' | 'error' | 'extra';
export type CompareVerdict = 'correct' | 'partial' | 'incorrect';

export interface CompareLineAnalysis {
  studentLine: string;
  matchedCanonicalStep: number | null;
  status: CompareLineStatus;
  note?: string;
}

export interface JudgeVerdict {
  verdict: CompareVerdict;
  finalAnswer: string;
  canonicalAnswer: string;
  summary: string;
  stepAnalysis: CompareLineAnalysis[];
}

// ── Live Step-by-Step Reviewer ────────────────────────────────────────
//
// Mid-solve coaching state, refreshed on every transcription update that
// produces new lines. The reviewer is text-only and runs cheaply — its
// job is to keep the student oriented (k of N), not to assess. The
// authoritative verdict still comes from compareWork at Done time.

export type LiveReviewStatus = 'on-track' | 'shortcut' | 'off-track' | 'filler';

export interface LiveLineReview {
  /** The KaTeX from the transcription rail. */
  studentLine: string;
  /** Canonical step this line satisfies, if any. Null = off-track or filler. */
  matchedStep: number | null;
  status: LiveReviewStatus;
  /**
   * Short coaching message (1 sentence). For on-track: confirmation + next
   * move. For off-track: graceful redirect — references what to re-check,
   * never reveals the answer. For shortcut: acknowledges the alternate
   * path. For filler: omitted (silent).
   */
  message?: string;
}

export interface LiveReviewState {
  /** Total canonical steps. Pulled from sibling.steps.length. */
  totalSteps: number;
  /** Highest canonical step the student has demonstrably reached. 0 = nothing yet. */
  completedSteps: number;
  /** Per-line review for every transcribed line so far, in order. */
  lineReviews: LiveLineReview[];
  /** When all canonical steps are confirmed — primes the Done button with a "ready" badge. */
  allStepsComplete: boolean;
  /**
   * One-line summary tied to the latest line. Drives the right-aligned
   * status text in the progress band. Empty string when no advice applies.
   */
  headline: string;
}
