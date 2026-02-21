import { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────

/** A single challenge result. Primitives can add extra fields via the index signature. */
export interface ChallengeResult {
  challengeId: string;
  correct: boolean;
  attempts: number;
  timeMs?: number;
  /** Per-challenge score (0-100). Used by primitives like NumberLine that track accuracy. */
  score?: number;
  /** Primitives can attach extra domain-specific fields (e.g. oneToOne, accuracy). */
  [key: string]: unknown;
}

export interface UseChallengeProgressOptions<TChallenge> {
  /** The full list of challenges for this activity. */
  challenges: TChallenge[];
  /** Extract the unique ID from a challenge object. */
  getChallengeId: (challenge: TChallenge) => string;
}

export interface UseChallengeProgressReturn {
  /** Index of the current challenge (0-based). */
  currentIndex: number;
  /** Number of attempts on the current challenge. */
  currentAttempts: number;
  /** All recorded challenge results so far. */
  results: ChallengeResult[];
  /** True when results have been recorded for every challenge. */
  isComplete: boolean;
  /** Record a result for the current challenge (or update an existing one). */
  recordResult: (result: ChallengeResult) => void;
  /** Increment the attempt counter for the current challenge. */
  incrementAttempts: () => void;
  /**
   * Move to the next challenge. Returns `true` if advanced, `false` if already
   * at the last challenge (i.e. all challenges are done).
   */
  advance: () => boolean;
  /** Reset all progress (index, attempts, results). */
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Manages challenge-by-challenge progression state for multi-phase primitives.
 *
 * Replaces the per-primitive boilerplate of:
 * - `challengeResults` array state
 * - `currentChallengeIndex` state
 * - `currentAttempts` state
 * - completion detection logic
 */
export function useChallengeProgress<TChallenge>(
  options: UseChallengeProgressOptions<TChallenge>,
): UseChallengeProgressReturn {
  const { challenges, getChallengeId } = options;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [results, setResults] = useState<ChallengeResult[]>([]);

  const isComplete =
    challenges.length > 0 && results.length >= challenges.length;

  const recordResult = useCallback(
    (result: ChallengeResult) => {
      setResults((prev) => {
        const existing = prev.findIndex(
          (r) => r.challengeId === result.challengeId,
        );
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = result;
          return next;
        }
        return [...prev, result];
      });
    },
    [],
  );

  const incrementAttempts = useCallback(() => {
    setCurrentAttempts((a) => a + 1);
  }, []);

  const advance = useCallback((): boolean => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= challenges.length) return false;
    setCurrentIndex(nextIndex);
    setCurrentAttempts(0);
    return true;
  }, [currentIndex, challenges.length]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setCurrentAttempts(0);
    setResults([]);
  }, []);

  return {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
    reset,
  };
}
