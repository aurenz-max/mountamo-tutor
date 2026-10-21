/**
 * double-number-line's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed value the
 * activity checks: the card is `doubleNumberLine.card.ts`; this file validates a lesson, lists its challenges, asks one,
 * carries the lever set and plays the harness.
 */
import type { DoubleNumberLineChallenge, DoubleNumberLineData } from './DoubleNumberLine';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { answerLabel, ratioLineHarnessValues } from './doubleNumberLineWorkspace';
import { RATIO_LINE_LEVERS, practiceParent, simplerLine } from './doubleNumberLineLevers';
import { doubleNumberLineCard, type DoubleNumberLineMiss } from './doubleNumberLine.card';

const TYPES = ['equivalent_ratios', 'find_missing', 'unit_rate'];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Reject a double-number-line lesson whose challenges cannot be attempted. */
export function validateDoubleNumberLineData(value: unknown): DoubleNumberLineData {
  const d = value as DoubleNumberLineData;
  if (!d || typeof d.title !== 'string' || typeof d.topLabel !== 'string' || typeof d.bottomLabel !== 'string'
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType) || typeof c.prompt !== 'string'))
    throw new Error('Generated double number line has invalid lesson content.');
  // Each target needs what the check reads (a bottom value) and a place on both drawn lines.
  for (const c of d.challenges) {
    const ok = Array.isArray(c.targetPoints) && c.targetPoints.length > 0 && Array.isArray(c.givenPoints)
      && c.topScale?.max > c.topScale?.min && c.bottomScale?.max > c.bottomScale?.min
      && c.targetPoints.every(t => finite(t.topValue) && finite(t.bottomValue)
        && t.topValue >= c.topScale.min && t.topValue <= c.topScale.max
        && t.bottomValue >= c.bottomScale.min && t.bottomValue <= c.bottomScale.max);
    if (!ok) throw new Error(`A double-number-line ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

const labelsOf = (d: DoubleNumberLineData) => ({ topLabel: d.topLabel, bottomLabel: d.bottomLabel });

export const doubleNumberLineBoss = defineBoss<DoubleNumberLineData, DoubleNumberLineChallenge, DoubleNumberLineMiss>({
  card: doubleNumberLineCard,
  validate: validateDoubleNumberLineData,
  items: d => d.challenges,
  ask: c => c.prompt,
  // A typed value the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.prompt, null),
  levers: RATIO_LINE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/DoubleNumberLine.tsx',
    instanceId: 'dnl',
    defaults: { grade: 'Grade 6', mode: 'find_missing', topic: 'Ratios on a double number line' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const d = ctx.data as DoubleNumberLineData;
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = (d.challenges ?? []).find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerLine(parent, labelsOf(d)) ?? undefined : parent;
    },
    // The bottom value typed into the box named for each asked point ("<bottom> when <top> is <n>") and Check. A wrong
    // answer is the item's signature miss from `ratioLineMiss`: the given bottom value on a find-the-rate item, else
    // the top value plus the rate (added once, not scaled).
    play: (right, c, ctx) => {
      const d = ctx.data as DoubleNumberLineData;
      const values = ratioLineHarnessValues(c, right ? 'correct' : 'wrong');
      return [...c.targetPoints.map((t, i) => ({ type: 'write' as const,
        label: answerLabel(d.bottomLabel, d.topLabel, t.topValue), text: values[i] })), { type: 'check' as const }];
    },
  },
});
