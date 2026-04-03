import { ADAPTIVE } from './constants';
import type { AdaptiveItemResult, SessionDecision } from './types';

/**
 * Pure decision function — 0ms, no side effects, fully testable.
 * Called after every item completion to decide what happens next.
 *
 * Priority order (most impactful first):
 *   1. early-exit        — mastery demonstrated
 *   2. end-session       — max items hit
 *   3. insert-example    — 2 consecutive failures
 *   4. switch-representation — 2 failures, try different primitive
 *   5. extend-offer      — queue done + on a streak
 *   6. continue          — default
 */
export function decideNext(
  results: AdaptiveItemResult[],
  workedExamplesUsed: number,
  hasMorePrefetched: boolean,
): SessionDecision {
  const now = Date.now();
  const scored = results.filter((r) => !r.isWorkedExample);
  const recentScores = scored.slice(-3).map((r) => r.score);

  // -----------------------------------------------------------------------
  // 1. EARLY EXIT — 3 consecutive high scores across 2+ manifest batches
  // -----------------------------------------------------------------------
  if (scored.length >= ADAPTIVE.MIN_ITEMS) {
    const tail = scored.slice(-ADAPTIVE.EARLY_EXIT_STREAK);
    if (tail.length >= ADAPTIVE.EARLY_EXIT_STREAK) {
      const allHigh = tail.every((r) => r.score >= ADAPTIVE.HIGH_SCORE);
      const uniqueBatches = new Set(tail.map((r) => r.manifestBatchIndex));
      if (allHigh && uniqueBatches.size >= ADAPTIVE.EARLY_EXIT_MIN_BATCHES) {
        return {
          action: 'early-exit',
          reason: `${ADAPTIVE.EARLY_EXIT_STREAK} consecutive scores \u2265${ADAPTIVE.HIGH_SCORE} across ${uniqueBatches.size} batches`,
          timestamp: now,
          inputScores: tail.map((r) => r.score),
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 2. MAX ITEMS — hard cap
  // -----------------------------------------------------------------------
  if (scored.length >= ADAPTIVE.MAX_ITEMS) {
    return {
      action: 'end-session',
      reason: `Hit max items (${ADAPTIVE.MAX_ITEMS})`,
      timestamp: now,
      inputScores: recentScores,
    };
  }

  // -----------------------------------------------------------------------
  // 3. INSERT WORKED EXAMPLE — 2 consecutive failures (non-example items)
  // -----------------------------------------------------------------------
  if (workedExamplesUsed < ADAPTIVE.MAX_WORKED_EXAMPLES && scored.length >= 2) {
    const last2 = scored.slice(-2);
    const bothFailed = last2.every((r) => r.score < ADAPTIVE.FAILURE_SCORE);
    if (bothFailed) {
      return {
        action: 'insert-example',
        reason: `2 consecutive scores <${ADAPTIVE.FAILURE_SCORE} (${last2.map((r) => r.score).join(', ')})`,
        timestamp: now,
        inputScores: last2.map((r) => r.score),
        exampleTopic: last2[0].topic,
        newTargetMode: Math.max(
          ADAPTIVE.MIN_SCAFFOLDING_MODE,
          last2[0].scaffoldingMode - ADAPTIVE.SCAFFOLDING_DROP_ON_SWITCH,
        ),
      };
    }
  }

  // -----------------------------------------------------------------------
  // 4. SWITCH REPRESENTATION — 2 failures with a visual primitive available
  // -----------------------------------------------------------------------
  if (scored.length >= 2) {
    const last2 = scored.slice(-2);
    const bothFailed = last2.every((r) => r.score < ADAPTIVE.FAILURE_SCORE);
    const hasPrimitive = last2.some((r) => r.primitiveId !== null);
    if (bothFailed && hasPrimitive) {
      const usedPrimitives = last2
        .map((r) => r.primitiveId)
        .filter((id): id is string => id !== null);
      return {
        action: 'switch-representation',
        reason: `2 failures with primitives [${usedPrimitives.join(', ')}] — switching visual`,
        timestamp: now,
        inputScores: last2.map((r) => r.score),
        excludePrimitives: usedPrimitives,
        newTargetMode: Math.max(
          ADAPTIVE.MIN_SCAFFOLDING_MODE,
          last2[0].scaffoldingMode - ADAPTIVE.SCAFFOLDING_DROP_ON_SWITCH,
        ),
      };
    }
  }

  // -----------------------------------------------------------------------
  // 5. EXTEND OFFER — no more prefetched items + on a streak
  // -----------------------------------------------------------------------
  if (!hasMorePrefetched && scored.length >= ADAPTIVE.MIN_ITEMS) {
    const recent2 = scored.slice(-2);
    if (recent2.length >= 2 && recent2.every((r) => r.score >= ADAPTIVE.EXTENSION_STREAK)) {
      return {
        action: 'extend-offer',
        reason: `Queue empty, last 2 scores \u2265${ADAPTIVE.EXTENSION_STREAK} — offering extension`,
        timestamp: now,
        inputScores: recent2.map((r) => r.score),
      };
    }
  }

  // -----------------------------------------------------------------------
  // 6. DEFAULT — continue to next item
  // -----------------------------------------------------------------------
  return {
    action: 'continue',
    reason: 'Normal progression',
    timestamp: now,
    inputScores: recentScores,
  };
}

/**
 * Adapt scaffolding mode based on the latest score.
 * Called after each scored item to adjust difficulty for the next manifest call.
 */
export function adaptScaffoldingMode(currentMode: number, score: number): number {
  if (score >= ADAPTIVE.HIGH_SCORE) {
    return Math.min(ADAPTIVE.MAX_SCAFFOLDING_MODE, currentMode + 1);
  }
  if (score < ADAPTIVE.FAILURE_SCORE) {
    return Math.max(ADAPTIVE.MIN_SCAFFOLDING_MODE, currentMode - 1);
  }
  return currentMode;
}
