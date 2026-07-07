import type { OracleViolation } from './types';

/** Escape a string for literal use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a numeric ceiling from scope-bearing topic language:
 * "Counting to 10", "numbers within 5", "up to 20". Returns undefined when the
 * topic carries no ceiling — callers must then fall back to the primitive's
 * intrinsic ceiling, never a guessed one.
 */
export function parseScopeCeiling(topic: string): number | undefined {
  const m = topic.match(/\b(?:to|within|up to)\s+(\d{1,4})\b/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** True when `text` contains `answer` as a whole word (case-insensitive) — the answer-leak test. */
export function containsWord(text: string, answer: string): boolean {
  if (!answer) return false;
  return new RegExp(`\\b${escapeRegExp(answer)}\\b`, 'i').test(text);
}

/**
 * The "every answer is 5" check: across a challenge set, answers must spread.
 * Flags when more than `maxRepeatFraction` of answers share one value
 * (single-challenge sets are exempt — nothing to vary against).
 */
export function checkAnswerVariety(
  values: Array<string | number>,
  where: string,
  maxRepeatFraction = 0.6,
): OracleViolation | null {
  if (values.length < 3) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  let modeValue = '';
  let modeCount = 0;
  counts.forEach((count, value) => {
    if (count > modeCount) { modeCount = count; modeValue = value; }
  });
  if (modeCount / values.length > maxRepeatFraction) {
    return {
      check: 'clustering',
      where,
      detail: `${modeCount}/${values.length} answers are "${modeValue}" — answers cluster instead of spreading`,
    };
  }
  return null;
}

/** Duplicate-options check for any MCQ-shaped challenge. */
export function checkUniqueOptions(options: unknown[], where: string): OracleViolation | null {
  const strs = options.map((o) => String(o).trim().toLowerCase());
  if (new Set(strs).size !== strs.length) {
    return { check: 'schema', where, detail: `duplicate options: [${options.join(', ')}]` };
  }
  return null;
}

/** Narrow an unknown to a record array, else empty. */
export function asRecordArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'object' && x !== null) as Array<Record<string, unknown>>) : [];
}
