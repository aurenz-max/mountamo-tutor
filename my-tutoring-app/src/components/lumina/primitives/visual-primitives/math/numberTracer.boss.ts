/**
 * number-tracer's boss (`components/live-activity/boss.ts`), bespoke because every mode is a numeral written on the
 * canvas, which the canvas checks itself: the card is `numberTracer.card.ts`; this file validates a lesson, lists its
 * items, asks one, carries the lever set and plays the harness.
 */
import type { NumberTracerChallenge, NumberTracerData } from './NumberTracer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { NUMBER_TRACER_LEVERS, SIMPLER_SUFFIX, guideOf, practiceFor } from './numberTracerLevers';
import { numberTracerCard, type NumberTracerMiss } from './numberTracer.card';

const MODES = ['trace', 'copy', 'write', 'sequence'];

/** Reject a writing set whose challenges cannot be attempted. */
export function validateNumberTracerData(value: unknown): NumberTracerData {
  const d = value as NumberTracerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !MODES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || !Number.isInteger(c.digit) || c.digit < 0 || c.digit > 20))
    throw new Error('Generated number tracer has invalid lesson content.');
  // A `sequence` ask has to say WHICH box is empty, or there is nothing to write.
  if (d.challenges.some(c => c.type === 'sequence'
      && (!Array.isArray(c.sequenceNumbers) || !c.sequenceNumbers.length
        || !Number.isInteger(c.missingIndex) || c.missingIndex! < 0
        || c.missingIndex! >= c.sequenceNumbers!.length)))
    throw new Error('A number-tracer sequence challenge has no writable blank.');
  return d;
}

export const numberTracerBoss = defineBoss<NumberTracerData, NumberTracerChallenge, NumberTracerMiss>({
  card: numberTracerCard,
  validate: validateNumberTracerData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // Writing the canvas checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: NUMBER_TRACER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/NumberTracer.tsx',
    instanceId: 'tracer',
    defaults: { grade: 'Kindergarten', mode: 'trace', topic: 'Writing the numerals zero through five' },
    mounted: 'canvas',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as NumberTracerData).challenges ?? [];
      const id = String(ctx.itemId ?? '');
      const parent = all.find(c => c.id === id.replace(/~simpler$/, ''));
      return parent && id.endsWith(SIMPLER_SUFFIX) ? practiceFor(parent) ?? undefined : parent;
    },
    // `trace` only: the right answer follows the item's own guide strokes, densified; the wrong one is the same
    // strokes shifted off the guide. Other modes need a drawn numeral the vision judge reads, which the driver
    // cannot produce, so they throw (journey-sweep-baseline: handoff 21 SW-7).
    play: (right, c) => {
      if (c.type !== 'trace') throw new Error(`Number-tracer ${c.type} is not driven at W1`);
      const dx = right ? 0 : 160;
      const strokes = guideOf(c).map(stroke => stroke.slice(1).flatMap((b, k) => {
        const a = stroke[k];
        return Array.from({ length: 12 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 12 + dx, y: a.y + ((b.y - a.y) * i) / 12 }));
      }).concat([{ x: stroke[stroke.length - 1].x + dx, y: stroke[stroke.length - 1].y }]));
      return [{ type: 'draw', strokes }, { type: 'choose', label: 'Check' }];
    },
  },
});
