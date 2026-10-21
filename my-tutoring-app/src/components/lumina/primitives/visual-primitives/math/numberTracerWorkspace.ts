/**
 * Number tracer on the shared tutor/JEV teaching workspace (boss: `numberTracer.boss.ts`).
 *
 * Pure: the component and any probe read the same scene. The canvas checks the writing itself (geometry, then the
 * vision judge), so no key is published; on a sequence item the missing number is the answer and never appears in
 * the scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { NumberTracerChallenge } from './NumberTracer';
import type { NumberTracerMiss } from './numberTracer.card';

export type { NumberTracerMiss } from './numberTracer.card';

/** The checked writing in the learner's terms. `writtenAs` is the judge's reading, when it had one. */
export const describeWriting = (score: number, writtenAs: string | null) =>
  `${writtenAs ? `Wrote something read as ${writtenAs}` : 'Wrote on the canvas'}; the canvas scored it ${score}%`;

/** What a wrong check shows, from what the check read (the misses are listed on the card). */
export function numberTracerMiss(target: number, work: { writtenAs: string | null; accuracy: number; coverage: number }): NumberTracerMiss {
  const read = work.writtenAs?.trim();
  if (read) {
    const want = String(target);
    if (read === want) return 'poorly_formed';
    if (want.length > 1 && read === want.split('').reverse().join('')) return 'digits_swapped';
    return /^\d+$/.test(read) ? 'other_numeral' : 'not_readable';
  }
  return work.coverage < 50 && work.accuracy >= 50 ? 'part_left_out' : 'shape_off';
}

export function workspaceScene(challenge: NumberTracerChallenge, view: { strokes: number }): SceneOf {
  const sequence = challenge.type === 'sequence';
  const shown = sequence && challenge.sequenceNumbers
    ? challenge.sequenceNumbers.map((n, i) => (i === challenge.missingIndex ? '_' : String(n))).join(', ') : null;
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      ...(shown ? { printedSequence: shown } : { numeral: challenge.digit }),
      strokesDrawn: view.strokes,
    },
  };
}
