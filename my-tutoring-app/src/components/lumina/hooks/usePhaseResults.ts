import { useMemo } from 'react';
import type { PhaseResult } from '../components/PhaseSummaryPanel';
import type { ChallengeResult } from './useChallengeProgress';

// Re-export for convenience so consumers don't need a separate import
export type { PhaseResult } from '../components/PhaseSummaryPanel';

// ── Types ────────────────────────────────────────────────────────

/** Display config for a single phase type. */
export interface PhaseConfig {
  label: string;
  icon?: string;
  accentColor?: PhaseResult['accentColor'];
}

export interface UsePhaseResultsOptions<TChallenge> {
  /** Full list of challenges. */
  challenges: TChallenge[];
  /** Recorded results from useChallengeProgress. */
  results: ChallengeResult[];
  /** Only compute when all challenges are done. */
  isComplete: boolean;
  /** Extract the phase/type string from a challenge (used for grouping). */
  getChallengeType: (challenge: TChallenge) => string;
  /** Maps each phase type string to display config. */
  phaseConfig: Record<string, PhaseConfig>;
  /**
   * Optional custom scoring function. Receives the ChallengeResults for one
   * phase and returns a 0-100 score.
   *
   * Default: `(correct / total) * 100` (count-based).
   *
   * Use this for accuracy-averaging (e.g. NumberLine):
   * ```ts
   * getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length)
   * ```
   */
  getScore?: (results: ChallengeResult[]) => number;
}

// ── Default scorer ───────────────────────────────────────────────

function defaultScore(results: ChallengeResult[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter((r) => r.correct).length;
  return Math.round((correct / results.length) * 100);
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Computes `PhaseResult[]` from challenge results, grouped by phase type.
 *
 * Replaces the per-primitive `useMemo` that groups challengeResults into a Map
 * and maps them to PhaseResult[]. This exact logic was duplicated in TenFrame,
 * CountingBoard, NumberLine, FunctionMachine, and PatternBuilder.
 *
 * Returns an empty array until `isComplete` is true.
 */
export function usePhaseResults<TChallenge>(
  options: UsePhaseResultsOptions<TChallenge>,
): PhaseResult[] {
  const {
    challenges,
    results,
    isComplete,
    getChallengeType,
    phaseConfig,
    getScore,
  } = options;

  const scorer = getScore ?? defaultScore;

  return useMemo((): PhaseResult[] => {
    if (!isComplete || challenges.length === 0) return [];

    // Group results by phase type, preserving first-seen order
    const typeOrder: string[] = [];
    const grouped = new Map<string, ChallengeResult[]>();

    for (const challenge of challenges) {
      const type = getChallengeType(challenge);
      const challengeId =
        'id' in (challenge as Record<string, unknown>)
          ? (challenge as Record<string, unknown>).id as string
          : '';
      const result = results.find((r) => r.challengeId === challengeId);
      if (!result) continue;

      if (!grouped.has(type)) {
        typeOrder.push(type);
        grouped.set(type, []);
      }
      grouped.get(type)!.push(result);
    }

    return typeOrder.map((type) => {
      const phaseResults = grouped.get(type)!;
      const config = phaseConfig[type] ?? { label: type };
      const totalAttempts = phaseResults.reduce(
        (sum, r) => sum + r.attempts,
        0,
      );
      const score = scorer(phaseResults);

      return {
        label: config.label,
        score,
        attempts: totalAttempts,
        firstTry:
          totalAttempts === phaseResults.length &&
          phaseResults.every((r) => r.correct),
        icon: config.icon,
        accentColor: config.accentColor,
      };
    });
  }, [isComplete, challenges, results, getChallengeType, phaseConfig, scorer]);
}
