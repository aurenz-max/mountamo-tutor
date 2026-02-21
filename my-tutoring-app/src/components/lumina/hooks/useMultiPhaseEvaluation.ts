import { useChallengeProgress } from './useChallengeProgress';
import { usePhaseResults } from './usePhaseResults';
import type { ChallengeResult, UseChallengeProgressReturn } from './useChallengeProgress';
import type { PhaseConfig, PhaseResult } from './usePhaseResults';

// Re-export all types from one place
export type { ChallengeResult, UseChallengeProgressReturn } from './useChallengeProgress';
export type { PhaseConfig, PhaseResult } from './usePhaseResults';

// ── Types ────────────────────────────────────────────────────────

export interface UseMultiPhaseEvaluationOptions<TChallenge> {
  /** Full list of challenges for this activity. */
  challenges: TChallenge[];
  /** Extract the unique ID from a challenge. */
  getChallengeId: (ch: TChallenge) => string;
  /** Extract the phase/type from a challenge (for grouping). */
  getChallengeType: (ch: TChallenge) => string;
  /** Maps each phase type to its display config (label, icon, accentColor). */
  phaseConfig: Record<string, PhaseConfig>;
  /** Optional custom scoring per phase. Default: count-based `(correct / total) * 100`. */
  getScore?: (results: ChallengeResult[]) => number;
}

export interface UseMultiPhaseEvaluationReturn extends UseChallengeProgressReturn {
  /** Phase results ready for PhaseSummaryPanel. Empty until isComplete. */
  phaseResults: PhaseResult[];
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Composite hook that combines challenge progress tracking with phase result
 * computation. Use this for the common multi-phase primitive pattern.
 *
 * For primitives that need finer control, use `useChallengeProgress` and
 * `usePhaseResults` individually.
 *
 * @example
 * ```tsx
 * const PHASE_CONFIG = {
 *   build:    { label: 'Build',    icon: '🔨', accentColor: 'purple' as const },
 *   subitize: { label: 'Subitize', icon: '⚡', accentColor: 'amber' as const },
 * };
 *
 * const {
 *   currentIndex, currentAttempts, results, isComplete,
 *   recordResult, incrementAttempts, advance, phaseResults,
 * } = useMultiPhaseEvaluation({
 *   challenges,
 *   getChallengeId: (ch) => ch.id,
 *   getChallengeType: (ch) => ch.type,
 *   phaseConfig: PHASE_CONFIG,
 * });
 * ```
 */
export function useMultiPhaseEvaluation<TChallenge>(
  options: UseMultiPhaseEvaluationOptions<TChallenge>,
): UseMultiPhaseEvaluationReturn {
  const {
    challenges,
    getChallengeId,
    getChallengeType,
    phaseConfig,
    getScore,
  } = options;

  const progress = useChallengeProgress({ challenges, getChallengeId });

  const phaseResults = usePhaseResults({
    challenges,
    results: progress.results,
    isComplete: progress.isComplete,
    getChallengeType,
    phaseConfig,
    getScore,
  });

  return { ...progress, phaseResults };
}
