import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { NumberTracerChallenge } from '../../primitives/visual-primitives/math/NumberTracer';

export type NumberTracerSequenceMove = 'contrast_gap_positions_in_one_run';

// Describes the sequence task only. trace/copy/write show the numeral to write, so an observation about
// which number belongs in a count has no executable content there (and write's instruction shows it: NT-10).
export const numberTracerSequenceTeaching: TeachingCapability<NumberTracerSequenceMove> = {
  activity: 'number-tracer',
  task: 'A counting run of four consecutive whole numbers is shown with one number replaced by a question mark, never the first or the last '
    + '(for example 3, 4, ?, 6). Runs stay inside the lesson\'s number window: 0 to 9 in Kindergarten, up to 20 in Grade 1 (for example 12, ?, 14, 15). '
    + 'The learner works out the hidden number and writes it by hand on a blank canvas; a judge reads the drawing, and a wrong or unreadable number is marked and can be retried. '
    + 'No tracing guide for the hidden number is shown. After two tries a hint says to count up by ones. '
    + 'The learner does not count backward, skip-count, choose the run, or type an answer.',
  moves: [{
    id: 'contrast_gap_positions_in_one_run',
    description: 'Show the same four-number run on two consecutive items with the question mark in a different place: 3, ?, 5, 6 and then 3, 4, ?, 6, '
      + 'so the hidden number is 4 the first time and 5 the second. In a Grade 1 window: 12, ?, 14, 15 and then 12, 13, ?, 15. '
      + 'The visible numbers are the same on both items and only the position of the gap changes the answer, which is one more than the number before the gap and one less than the number after it; '
      + 'an answer taken from the end of the run, from one neighbour, or from counting on past the last number cannot be right on both items. '
      + 'Replaces the run of one item; holds the item count, the number window, the run length of four, gaps inside the run, answers that differ between items, and the support level. '
      + 'Does not teach how to form or orient a numeral, reversed digits, how teen numbers are written, counting backward, or numbers outside the window.',
  }],
};

const RUN_LENGTH = 4;

/** Code-owned task gate. The generator honours no named run from the topic, so there is no anchor to outrank. */
export function eligibleNumberTracerTeaching(task: AdaptationTask): boolean {
  return ['K', '1'].includes((task.grade ?? '').toUpperCase()) && task.mode === 'sequence';
}

/** Delivery gate on the manifest config; the generator still runs the full task gate. */
export function numberTracerDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'sequence';
}

export type NumberTracerAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';

const isRun = (c: NumberTracerChallenge) => c.type === 'sequence' && Array.isArray(c.sequenceNumbers)
  && c.sequenceNumbers.length === RUN_LENGTH && c.sequenceNumbers.every((n, k, s) => k === 0 || n === s[k - 1] + 1)
  && typeof c.missingIndex === 'number' && c.missingIndex > 0 && c.missingIndex < RUN_LENGTH - 1
  && c.digit === c.sequenceNumbers[c.missingIndex];
const sameRunOtherGap = (a: NumberTracerChallenge, b: NumberTracerChallenge) => isRun(a) && isRun(b)
  && a.sequenceNumbers![0] === b.sequenceNumbers![0] && a.missingIndex !== b.missingIndex;

/** Recomputed from the rendered fields: consecutive items showing one run with the gap in two places. */
export function compiledGapPositionContrast(challenges: readonly NumberTracerChallenge[]) {
  const targets: string[] = [];
  for (let i = 0; i + 1 < challenges.length; i++) {
    if (sameRunOtherGap(challenges[i], challenges[i + 1])) targets.push(challenges[i].id, challenges[i + 1].id);
  }
  const unique = Array.from(new Set(targets));
  return { targets: unique, count: unique.length };
}

/** Rewrites the item after an anchor (preferring a later anchor, so the session opens on an ordinary item)
 *  to the anchor's run with the other interior gap. Count, ids, window, tier flags and distinct answers hold. */
export function selectGapPositionContrast(
  baseline: readonly NumberTracerChallenge[], move: NumberTracerSequenceMove | null, random: () => number = Math.random,
) {
  const result = (challenges: readonly NumberTracerChallenge[], status: NumberTracerAdaptationStatus) =>
    ({ challenges, status, ...compiledGapPositionContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (baseline.length < 2 || !baseline.every(isRun)) return result(baseline, 'insufficient-capacity');
  if (compiledGapPositionContrast(baseline).count) return result(baseline, 'already-targeted');
  // The builder's answer rule: distinct while the window has room, otherwise never a neighbour's answer.
  const distinct = new Set(baseline.map(c => c.digit)).size === baseline.length;
  const options: Array<{ anchor: number; replace: number }> = [];
  for (let anchor = 0; anchor + 1 < baseline.length; anchor++) {
    const replace = anchor + 1;
    const answer = baseline[anchor].sequenceNumbers![0] + (RUN_LENGTH - 1 - baseline[anchor].missingIndex!);
    const clashes = distinct ? baseline.some((c, i) => i !== replace && c.digit === answer) : baseline[replace + 1]?.digit === answer;
    if (!clashes) options.push({ anchor, replace });
  }
  if (!options.length) return result(baseline, 'insufficient-capacity');
  const later = options.filter(o => o.anchor > 0);
  const pool = later.length ? later : options;
  const { anchor, replace } = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  const run = [...baseline[anchor].sequenceNumbers!];
  const missingIndex = RUN_LENGTH - 1 - baseline[anchor].missingIndex!;
  const next = baseline.map((c, i) => (i === replace ? { ...c, sequenceNumbers: run, missingIndex, digit: run[missingIndex] } : c));
  return result(next, 'targeted');
}
