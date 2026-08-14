/**
 * Two ways a Lumina primitive turns a finished run into `PhaseResult[]`, kept
 * in one file so the difference is impossible to miss:
 *
 *   - `usePhaseResults` (below) — the CLICK path. Input is
 *     `useChallengeProgress` results; it GROUPS challenges by phase type and
 *     scores each group. One row per phase.
 *   - `phaseResultsFromSummary` (bottom) — the JUDGED path. Input is a judged
 *     run's outcome ledger; there is no grouping and no scoring policy, because
 *     the runner already scored each item by how many corrections the tutor ran.
 *     One row per item.
 *
 * They are not duplicates of each other: different input, different shape out.
 * A judged port must not be pushed through the hook — it would re-derive a
 * score the tutor already gave.
 */

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

// ── The judged path ──────────────────────────────────────────────

/**
 * The four fields every judged summary row carries. Typed structurally rather
 * than as `JudgedRunOutcome` so the four pre-runner ports — which keep their own
 * ledger with extra per-primitive fields — pass their arrays directly.
 */
export interface JudgedOutcomeLike {
  id: string;
  solved: boolean;
  corrections: number;
  score: number;
}

/**
 * One `PhaseResult` per judged ITEM, read off the run's outcome ledger.
 *
 * This was fourteen byte-identical `useMemo` bodies — every judged port mapped
 * its items, found the matching outcome by id, and re-derived the same three
 * numbers. Only the display config varied, so that is the only thing a caller
 * still supplies:
 *
 * ```ts
 * const phaseResults = useMemo<PhaseResult[]>(() => {
 *   if (!evaluation.hasSubmitted) return [];
 *   return phaseResultsFromSummary(items, runner.summary, (item) => MODE_META[item.mode]);
 * }, [evaluation.hasSubmitted, runner.summary, items]);
 * ```
 *
 * The three invariants, and why they are invariant:
 *   - `score` comes from the runner (100/67/33 by corrections) — the tutor's
 *     verdict is the grade; nothing here re-scores it.
 *   - `attempts` is `corrections + 1`: the first ask plus one per correction.
 *   - `firstTry` needs BOTH solved and zero corrections — a capped item that
 *     the lesson moved past is not a first try.
 *
 * An item with no outcome (the run ended before it opened) scores 0 rather than
 * vanishing, so the summary shows the whole lesson, not just what was reached.
 */
export function phaseResultsFromSummary<Item extends { id: string }>(
  items: readonly Item[],
  summary: { outcomes: readonly JudgedOutcomeLike[] } | null | undefined,
  configFor: (item: Item) => PhaseConfig,
): PhaseResult[] {
  if (!summary) return [];
  return items.map((item) => {
    const outcome = summary.outcomes.find((o) => o.id === item.id);
    const corrections = outcome?.corrections ?? 0;
    const config = configFor(item);
    return {
      label: config.label,
      icon: config.icon,
      accentColor: config.accentColor,
      score: outcome?.score ?? 0,
      attempts: corrections + 1,
      firstTry: !!outcome?.solved && corrections === 0,
    };
  });
}
