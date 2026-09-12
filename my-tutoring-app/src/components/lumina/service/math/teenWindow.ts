/**
 * teenWindow — the numeric scope and deterministic coverage for K.NBT.1.
 *
 * The language requirement is not a regex grammar. Flash Lite translates the
 * lesson's topic/objective/intent into a tiny {min,max} schema; code validates
 * that result against the primitive's legal range, then builds the targets.
 * This lets prose such as "up to fifteen", "no greater than sixteen",
 * "twelve through seventeen", and "compose fourteen" retain their meaning.
 *
 * Number selection remains code-owned. The content model may author hints,
 * narration, and titles, but cannot collapse a session onto one convenient
 * value or drift outside the resolved curriculum scope.
 */

import type { PedagogicalScope } from '../scopeContext';
import { resolveScopeRange } from '../scopeRangeResolver';

/** CCSS K.NBT.1's legal range: "numbers from 11 to 19". */
export const TEEN_MIN = 11;
export const TEEN_MAX = 19;

export interface TeenWindow {
  start: number;
  end: number;
}

/**
 * Translate arbitrary curriculum prose into the legal teen-number window.
 * Invalid schema output or resolver failure falls back to the full contract;
 * valid output is hard-clamped by the shared Tier-2 scope resolver.
 */
export const resolveTeenWindow = async (
  scope: PedagogicalScope,
  gradeLevel: string,
): Promise<TeenWindow> => {
  const resolved = await resolveScopeRange(
    scope,
    gradeLevel,
    'the teen-number totals represented as one ten and some ones; a ceiling such as '
      + '"to fifteen" spans from the first teen number through fifteen, while an objective '
      + 'explicitly about one exact number may return that singleton',
    { min: TEEN_MIN, max: TEEN_MAX },
    { allowSingleton: true, resolveTopicOnly: true },
  );

  return resolved
    ? { start: resolved.min, end: resolved.max }
    : { start: TEEN_MIN, end: TEEN_MAX };
};

/**
 * Build `count` code-owned targets that cover the resolved window in order.
 * Wrapping repeats the whole window rather than collapsing onto one number.
 */
export const teenSweep = (window: TeenWindow, count: number): number[] => {
  const start = Math.max(TEEN_MIN, Math.min(TEEN_MAX, window.start));
  const end = Math.max(start, Math.min(TEEN_MAX, window.end));
  const size = end - start + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => start + (i % size));
};
